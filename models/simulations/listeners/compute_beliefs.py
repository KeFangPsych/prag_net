"""
compute_beliefs.py

Stage 3 of the simulation pipeline. Given Stage 2's utterance Dataset and a
listener config, compute the listener's belief trajectories along
(theta_true, obs_idx, utt_idx, t) and return an xarray.Dataset of marginal
beliefs over theta (and over psi / alpha when the listener is pragmatic).

The listener is fully deterministic given the utterance sequence — no RNG —
so the only data axes here are exactly Stage 2's (theta_true, obs_idx, utt_idx)
plus t.

Two execution paths, auto-dispatched on listener level + update_internal:

- Fast path (level == 0, OR update_internal == False):
    The per-step likelihood log P(u | theta[, psi, alpha]) is fixed at
    listener __init__:
      * Level 0: log P_S0(u | theta) is precomputed in
        listener.utterance_log_likelihood_theta.
      * Level >= 1 with update_internal=False: internal speakers are frozen,
        so listener.utterance_log_likelihood_theta_psi_alpha is the fixed
        (|U|, n_theta, |psi|, |alpha|) table.
    Compute cumulative log posteriors across all (n_traj, T) cells in one
    vectorized numpy operation (fancy index → cumsum → log-softmax →
    marginalize). No Python loop over trajectories or time.

- Slow path (level >= 1 with update_internal == True):
    Internal speakers evolve after each listen_and_update, so per-step
    likelihood depends on history. Fall back to per-trajectory Python loops
    with fresh listener instances. joblib parallelism at the
    (theta_true, obs_idx) level.

Output Dataset
--------------
Coords:
    theta_true, obs_idx, utt_idx, t   (carried forward from utt_ds)
    theta                             (= world.theta_values)
    psi                               (= listener.psi_vals; level >= 1 only)
    alpha_val                         (= listener.alpha_vals; level >= 1 only)

Data variables (always normalized over their last axis to sum to 1):
    belief_theta  (theta_true, obs_idx, utt_idx, t, theta)            float64
    belief_psi    (theta_true, obs_idx, utt_idx, t, psi)               float64   (level >= 1)
    belief_alpha  (theta_true, obs_idx, utt_idx, t, alpha_val)         float64   (level >= 1)

belief_X(t=k) is the posterior after observing u_0..u_k. The prior is not
stored — it's reconstructible from listener_config.

Attrs:
    listener_config (JSON), execution_path
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import xarray as xr
from joblib import Parallel, delayed
from scipy.special import logsumexp

from models.simulations.rsa_core import (
    World, LiteralListener, PragmaticListener_obs_n, create_listener,
)


def compute_listener_beliefs(
    utt_ds: xr.Dataset,
    world: World,
    config: Dict[str, Any],
) -> xr.Dataset:
    """
    Compute belief trajectories for every (theta_true, obs_idx, utt_idx) triple.

    Parameters
    ----------
    utt_ds : xarray.Dataset
        Stage 2 output. Must include `utterance_id` and `utterance_vocab`
        and have dims (theta_true, obs_idx, utt_idx, t [, freq_bin, utt_id]).
    world : World
        World instance from Stage 1 (reused, not rebuilt).
    config : dict
        Required:
            "listener" : dict, kwargs forwarded to create_listener(world, ...).
                         Must include 'level' and (for level>=1) 'omega',
                         'update_internal', 'alpha'.
        Optional:
            "n_jobs"   : int (default 1). joblib parallelism over
                         (theta_true, obs_idx) tasks. -1 uses all cores.
                         Applies only to the slow path.

    Returns
    -------
    xarray.Dataset
        See module docstring for schema.
    """
    if "listener" not in config:
        raise KeyError("config is missing required key: 'listener'")
    listener_config = dict(config["listener"])
    if "level" not in listener_config:
        raise KeyError("listener config must include 'level'")
    n_jobs = int(config.get("n_jobs", 1))

    # Build the listener once. The fast path uses it directly; the slow path
    # only uses it to query psi_vals / alpha_vals for output shape.
    listener = create_listener(world, **listener_config)

    n_thetas = utt_ds.sizes["theta_true"]
    n_obs_seq = utt_ds.sizes["obs_idx"]
    n_utt_seq = utt_ds.sizes["utt_idx"]
    T = utt_ds.sizes["t"]
    level = listener_config["level"]

    fast_path = _dispatch_fast_path(listener_config)

    if fast_path:
        belief_theta_arr, belief_psi_arr, belief_alpha_arr = _fast_path(
            listener, utt_ds, n_thetas, n_obs_seq, n_utt_seq, T,
        )
    else:
        belief_theta_arr, belief_psi_arr, belief_alpha_arr = _slow_path(
            world, listener_config, listener, utt_ds, n_jobs,
        )

    # Assemble Dataset.
    coords: Dict[str, Any] = {
        "theta_true": utt_ds.theta_true,
        "obs_idx": utt_ds.obs_idx,
        "utt_idx": utt_ds.utt_idx,
        "t": utt_ds.t,
        "theta": ("theta", np.asarray(world.theta_values, dtype=np.float64)),
    }
    data_vars: Dict[str, Any] = {
        "belief_theta": (
            ("theta_true", "obs_idx", "utt_idx", "t", "theta"),
            belief_theta_arr,
        ),
    }
    if level >= 1:
        # Coerce alpha_vals to a string array so e.g. "determ" coexists with floats.
        coords["psi"] = ("psi", np.asarray(listener.psi_vals, dtype="U"))
        coords["alpha_val"] = ("alpha_val", np.asarray([str(a) for a in listener.alpha_vals], dtype="U"))
        data_vars["belief_psi"] = (
            ("theta_true", "obs_idx", "utt_idx", "t", "psi"),
            belief_psi_arr,
        )
        data_vars["belief_alpha"] = (
            ("theta_true", "obs_idx", "utt_idx", "t", "alpha_val"),
            belief_alpha_arr,
        )

    ds = xr.Dataset(
        data_vars=data_vars,
        coords=coords,
        attrs={
            "listener_config": json.dumps(_jsonable(listener_config)),
            "execution_path": "fast" if fast_path else "slow",
        },
    )
    return ds


# =============================================================================
# Helpers
# =============================================================================

def _dispatch_fast_path(listener_config: Dict[str, Any]) -> bool:
    """
    Fast path applies whenever the listener's per-step likelihood is fixed:
    - Level 0: log P_S0(u | theta) is always fixed.
    - Level >= 1 with update_internal=False: internal speakers stay frozen,
      so the (|U|, n_theta, |psi|, |alpha|) table is fixed.
    """
    if listener_config["level"] == 0:
        return True
    return not listener_config.get("update_internal", False)


def _jsonable(obj: Any) -> Any:
    """Recursively convert numpy scalars/arrays to Python primitives for JSON."""
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.integer, np.floating)):
        return obj.item()
    if isinstance(obj, (list, tuple)):
        return [_jsonable(x) for x in obj]
    return obj


# -----------------------------------------------------------------------------
# Fast path
# -----------------------------------------------------------------------------

def _fast_path(
    listener,
    utt_ds: xr.Dataset,
    n_thetas: int,
    n_obs_seq: int,
    n_utt_seq: int,
    T: int,
) -> Tuple[np.ndarray, Optional[np.ndarray], Optional[np.ndarray]]:
    """
    Vectorized cumulative posterior across all trajectories.

    Returns
    -------
    belief_theta : (n_thetas, n_obs_seq, n_utt_seq, T, n_theta_grid)
    belief_psi   : same shape but last axis = |psi|, or None for level 0
    belief_alpha : same shape but last axis = |alpha|, or None for level 0
    """
    # u_arr: (n_traj, T) of utterance ids. The 4-D order in utt_ds is
    # (theta_true, obs_idx, utt_idx, t); flattening the first three preserves
    # row-major order so the inverse reshape works.
    u_arr = utt_ds.utterance_id.values.reshape(n_thetas * n_obs_seq * n_utt_seq, T)

    if isinstance(listener, LiteralListener):
        # log_lik_table[u, theta] = log P_S0(u | theta). Reindex defensively to
        # match world.utterances order (which is what utterance_id refers to).
        ll_df = listener.utterance_log_likelihood_theta.reindex(
            index=list(listener.world.utterances)
        )
        log_lik_table = ll_df.values  # (|U|, n_theta)
        log_prior = np.asarray(listener.un_current_log_belief, dtype=np.float64)  # (n_theta,)

        log_lik_per_step = log_lik_table[u_arr]                       # (n_traj, T, n_theta)
        cum_log_lik = np.cumsum(log_lik_per_step, axis=1)             # (n_traj, T, n_theta)
        log_post_unnorm = cum_log_lik + log_prior[None, None, :]
        log_post = log_post_unnorm - logsumexp(log_post_unnorm, axis=2, keepdims=True)
        belief_theta = np.exp(log_post)
        belief_theta = belief_theta.reshape(n_thetas, n_obs_seq, n_utt_seq, T, -1)
        return belief_theta, None, None

    elif isinstance(listener, PragmaticListener_obs_n):
        # Likelihood: dims canonical to (utterance, theta, psi, alpha).
        ll_da = listener.utterance_log_likelihood_theta_psi_alpha.transpose(
            "utterance", "theta", "psi", "alpha"
        )
        # Reindex utterance axis to world.utterances order — same defense as L0.
        ll_da = ll_da.reindex(utterance=list(listener.world.utterances))
        log_lik_table = ll_da.values  # (|U|, n_theta, |psi|, |alpha|)

        prior_da = listener.un_current_log_belief_theta_psi_alpha_joint.transpose(
            "theta", "psi", "alpha"
        )
        log_prior = np.asarray(prior_da.values, dtype=np.float64)  # (n_theta, |psi|, |alpha|)

        # Fancy index gives shape (n_traj, T, n_theta, |psi|, |alpha|).
        log_lik_per_step = log_lik_table[u_arr]
        cum_log_lik = np.cumsum(log_lik_per_step, axis=1)
        log_post_unnorm = cum_log_lik + log_prior[None, None, :, :, :]
        # Global normalizer over (theta, psi, alpha).
        log_Z = logsumexp(log_post_unnorm, axis=(2, 3, 4), keepdims=True)
        log_post = log_post_unnorm - log_Z

        # Marginals — sum out the off-axes in log space, then exp.
        belief_theta = np.exp(logsumexp(log_post, axis=(3, 4))).reshape(
            n_thetas, n_obs_seq, n_utt_seq, T, -1
        )
        belief_psi = np.exp(logsumexp(log_post, axis=(2, 4))).reshape(
            n_thetas, n_obs_seq, n_utt_seq, T, -1
        )
        belief_alpha = np.exp(logsumexp(log_post, axis=(2, 3))).reshape(
            n_thetas, n_obs_seq, n_utt_seq, T, -1
        )
        return belief_theta, belief_psi, belief_alpha

    else:
        raise TypeError(f"Unexpected listener type for fast path: {type(listener).__name__}")


# -----------------------------------------------------------------------------
# Slow path
# -----------------------------------------------------------------------------

def _slow_path(
    world: World,
    listener_config: Dict[str, Any],
    listener,
    utt_ds: xr.Dataset,
    n_jobs: int,
) -> Tuple[np.ndarray, Optional[np.ndarray], Optional[np.ndarray]]:
    """
    Per-trajectory listener loop, joblib parallelism at (theta_true, obs_idx)
    granularity. Each task instantiates n_utt_seq fresh listeners and runs
    them through their utterance sequence.
    """
    n_thetas = utt_ds.sizes["theta_true"]
    n_obs_seq = utt_ds.sizes["obs_idx"]
    n_utt_seq = utt_ds.sizes["utt_idx"]
    T = utt_ds.sizes["t"]
    level = listener_config["level"]
    n_theta_grid = len(world.theta_values)

    if level >= 1:
        n_psi = len(listener.psi_vals)
        n_alpha = len(listener.alpha_vals)
    else:
        n_psi = n_alpha = 0  # unused

    # Convert utterance_ids to vocab strings up front. listen_and_update wants strings.
    utt_vocab = list(utt_ds.utterance_vocab.values)
    u_id_arr = utt_ds.utterance_id.values  # (n_thetas, n_obs_seq, n_utt_seq, T)

    tasks: List[Tuple[int, int, List[List[str]]]] = []
    for i in range(n_thetas):
        for j in range(n_obs_seq):
            u_seqs_str = [
                [utt_vocab[int(u_id_arr[i, j, k, t])] for t in range(T)]
                for k in range(n_utt_seq)
            ]
            tasks.append((i, j, u_seqs_str))

    def _run(task):
        i, j, u_seqs = task
        return _run_listener_task_slow(
            world, listener_config, u_seqs,
            level=level, n_theta_grid=n_theta_grid,
            n_psi=n_psi, n_alpha=n_alpha,
        )

    if n_jobs == 1:
        results = [_run(task) for task in tasks]
    else:
        results = Parallel(n_jobs=n_jobs, backend="loky")(
            delayed(_run)(task) for task in tasks
        )

    belief_theta_arr = np.zeros((n_thetas, n_obs_seq, n_utt_seq, T, n_theta_grid), dtype=np.float64)
    if level >= 1:
        belief_psi_arr = np.zeros((n_thetas, n_obs_seq, n_utt_seq, T, n_psi), dtype=np.float64)
        belief_alpha_arr = np.zeros((n_thetas, n_obs_seq, n_utt_seq, T, n_alpha), dtype=np.float64)
    else:
        belief_psi_arr = None
        belief_alpha_arr = None

    for (i, j, _), (bt, bp, ba) in zip(tasks, results):
        belief_theta_arr[i, j] = bt
        if level >= 1:
            belief_psi_arr[i, j] = bp
            belief_alpha_arr[i, j] = ba

    return belief_theta_arr, belief_psi_arr, belief_alpha_arr


def _run_listener_task_slow(
    world: World,
    listener_config: Dict[str, Any],
    u_seqs_str: List[List[str]],
    level: int,
    n_theta_grid: int,
    n_psi: int,
    n_alpha: int,
) -> Tuple[np.ndarray, Optional[np.ndarray], Optional[np.ndarray]]:
    """
    For one (theta_true, obs_idx) task: run a fresh listener through each of
    n_utt_seq utterance sequences, snapshot beliefs at every t.
    """
    n_utt_seq = len(u_seqs_str)
    T = len(u_seqs_str[0]) if n_utt_seq > 0 else 0

    bt = np.zeros((n_utt_seq, T, n_theta_grid), dtype=np.float64)
    if level >= 1:
        bp = np.zeros((n_utt_seq, T, n_psi), dtype=np.float64)
        ba = np.zeros((n_utt_seq, T, n_alpha), dtype=np.float64)
    else:
        bp = None
        ba = None

    for k, u_seq in enumerate(u_seqs_str):
        listener = create_listener(world, **listener_config)
        for t, u in enumerate(u_seq):
            listener.listen_and_update(u)
            bt[k, t] = listener.current_belief_theta
            if level >= 1:
                bp[k, t] = listener.current_belief_psi
                ba[k, t] = listener.current_belief_alpha

    return bt, bp, ba
