"""
sample_utterances.py

Stage 2 of the simulation pipeline. Given Stage 1 observations and a speaker
config, sample n_utt_seq utterance sequences per (theta_true, obs_idx) and
return an xarray.Dataset.

Two execution paths, auto-dispatched on speaker level + update_internal:

- Fast path (level == 0, OR update_internal == False):
    The speaker's policy P(u | O) is fixed at __init__ from the prior — it
    does not evolve over time. Build the speaker once, extract its
    (|U|, |O|) policy table, and sample all (n_utt_seq, T) draws per
    (theta_true, obs_idx) in batch via the Gumbel-max trick. Speaker
    construction is amortized to a single call instead of
    n_thetas * n_obs_seq * n_utt_seq.

- Slow path (level >= 1 with update_internal == True):
    Fresh speaker per utterance sequence. Sequential per-step
    update_and_speak. Captures log P(u_t | O_t) BEFORE update_and_speak so
    update_internal=True is handled correctly (the policy is recomputed
    after each step, but we need the policy that produced u_t).

Both paths use joblib parallelism at (theta_true, obs_idx) granularity.

RNG semantics
-------------
- Slow path: per-utt-seq seed = task_seed + utt_idx. Each utterance sequence
  gets its own np.random.Generator. Reproducible per (theta_true, obs_idx,
  utt_idx) triple.
- Fast path: a single np.random.Generator(task_seed) drives the Gumbel-max
  batch for all utt_idx in a task. Reproducible per task; the per-utt
  draws are not individually reseedable.
- Fast and slow paths use different RNG access patterns, so the SAME seed
  produces DIFFERENT utterance sequences across the two paths. Within a
  path, the same seed is reproducible.

Output Dataset schema
---------------------
Coords:
    theta_true       (theta_true,)             float
    obs_idx          (obs_idx,)                int
    utt_idx          (utt_idx,)                int
    t                (t,)                      int
    freq_bin         (freq_bin,)               int    (0..m)
    utterance_vocab  (utt_id,)                 str    (the vocabulary)

Data variables:
    observation      (theta_true, obs_idx, t, freq_bin)        int
    utterance_id     (theta_true, obs_idx, utt_idx, t)         int
        Index into utterance_vocab. Use ds.utterance_vocab.values[ds.utterance_id]
        to recover the string.
    log_p_utt        (theta_true, obs_idx, utt_idx, t)         float
        log P(u_t | O_t) under the speaker policy at the moment u_t was sampled.
    utt_seed         (theta_true, obs_idx, utt_idx)            int
        Slow path: task_seed + utt_idx. Fast path: task_seed (same for all
        utt_idx in a task).

Attrs (JSON-encoded for netCDF compat):
    speaker_config   JSON of the speaker dict (numpy arrays converted to lists).
    n_utt_seq, seed, execution_path  scalar metadata.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Tuple, Optional

import numpy as np
import pandas as pd
import xarray as xr
from joblib import Parallel, delayed

from models.simulations.rsa_core import World, create_speaker


_REQUIRED_KEYS = ("speaker", "n_utt_seq")
MAX_N_UTT_SEQ = 10_000  # task seeds are spaced by this; larger n_utt_seq risks collisions


def sample_utterances(
    obs_df: pd.DataFrame,
    world: World,
    config: Dict[str, Any],
) -> xr.Dataset:
    """
    Sample utterance sequences for each observation sequence in obs_df.

    Parameters
    ----------
    obs_df : pandas.DataFrame
        Long-form output of Stage 1, with columns
        ['theta_true', 'obs_idx', 't', 'observation', 'run_seed'].
    world : World
        The world instance from Stage 1 (reused, not rebuilt).
    config : dict
        Required:
            "speaker"   : dict, kwargs forwarded to create_speaker(world, ...).
                          Must include 'level' and (for level>=1) 'omega',
                          'psi', 'update_internal', 'alpha'.
            "n_utt_seq" : int, 1 <= n_utt_seq <= MAX_N_UTT_SEQ.
        Optional:
            "seed"      : int | None. Base seed; per-task seed =
                          seed + task_idx * MAX_N_UTT_SEQ.
            "n_jobs"    : int (default 1). joblib parallelism over
                          (theta_true, obs_idx) tasks. -1 uses all cores.

    Returns
    -------
    xarray.Dataset
        See module docstring for schema.
    """
    speaker_config, n_utt_seq, seed, n_jobs = _validate_and_extract(config)

    # --- pivot obs_df into a dense (n_thetas, n_obs_seq, T, m+1) int array ---
    theta_arr = np.sort(obs_df["theta_true"].unique())
    obs_idx_arr = np.sort(obs_df["obs_idx"].unique())
    t_arr = np.sort(obs_df["t"].unique())
    n_thetas = len(theta_arr)
    n_obs_seq = len(obs_idx_arr)
    T = len(t_arr)
    m_plus_1 = world.m + 1

    expected_rows = n_thetas * n_obs_seq * T
    if len(obs_df) != expected_rows:
        raise ValueError(
            f"obs_df has {len(obs_df)} rows but expected {expected_rows} "
            f"= {n_thetas} thetas * {n_obs_seq} obs_seqs * {T} steps. "
            "Stage 1 should produce a complete Cartesian product."
        )

    df_sorted = obs_df.sort_values(["theta_true", "obs_idx", "t"]).reset_index(drop=True)
    # Each observation is a tuple of length m+1; stack into a 2-D int array then reshape.
    obs_stacked = np.asarray([list(o) for o in df_sorted["observation"]], dtype=np.int64)
    obs_arr = obs_stacked.reshape(n_thetas, n_obs_seq, T, m_plus_1)

    # --- build vocab and observation-column lookup tables ---
    utt_vocab: List[str] = list(world.utterances)
    obs_vocab: List[Tuple[int, ...]] = list(world.observations)
    obs_to_col = {tuple(o): i for i, o in enumerate(obs_vocab)}

    # Map every (i, j, t) observation tuple to its column index in obs_vocab.
    # This is what the fast path uses to look up policy columns.
    flat_obs = obs_arr.reshape(-1, m_plus_1)
    obs_col_flat = np.array(
        [obs_to_col[tuple(int(x) for x in row)] for row in flat_obs],
        dtype=np.int64,
    )
    obs_col_idx_arr = obs_col_flat.reshape(n_thetas, n_obs_seq, T)

    # --- dispatch fast vs slow path ---
    fast_path = _dispatch_fast_path(speaker_config)

    tasks: List[Tuple[int, int, Optional[int]]] = []
    for i in range(n_thetas):
        for j in range(n_obs_seq):
            task_idx = i * n_obs_seq + j
            task_seed = (seed + task_idx * MAX_N_UTT_SEQ) if seed is not None else None
            tasks.append((i, j, task_seed))

    if fast_path:
        # Build the speaker once; the policy is constant across tasks because
        # update_internal=False (or level 0) means it doesn't evolve.
        speaker = create_speaker(world, **speaker_config)
        # Reorder the policy table to match (utt_vocab, obs_vocab) so int indices
        # align with our coords.
        utt_log_prob = (
            speaker.utterance_log_prob_obs
                   .reindex(index=utt_vocab, columns=obs_vocab)
                   .to_numpy(dtype=np.float64)
        )  # shape (|U|, |O|)

        def _run(task):
            i, j, task_seed = task
            return _run_task_fast(
                utt_log_prob,
                obs_col_idx_arr[i, j],
                n_utt_seq,
                task_seed,
            )
    else:
        def _run(task):
            i, j, task_seed = task
            obs_seq = [tuple(int(x) for x in obs_arr[i, j, t]) for t in range(T)]
            return _run_task_slow(
                world,
                speaker_config,
                utt_vocab,
                obs_seq,
                n_utt_seq,
                task_seed,
            )

    if n_jobs == 1:
        results = [_run(task) for task in tasks]
    else:
        results = Parallel(n_jobs=n_jobs, backend="loky")(
            delayed(_run)(task) for task in tasks
        )

    # --- stitch task results into (n_thetas, n_obs_seq, n_utt_seq, T) arrays ---
    utt_id_arr = np.zeros((n_thetas, n_obs_seq, n_utt_seq, T), dtype=np.int32)
    log_p_arr = np.zeros((n_thetas, n_obs_seq, n_utt_seq, T), dtype=np.float64)
    seed_arr = np.full((n_thetas, n_obs_seq, n_utt_seq), -1, dtype=np.int64)
    for (i, j, _), (uid, lp, sd) in zip(tasks, results):
        utt_id_arr[i, j] = uid
        log_p_arr[i, j] = lp
        seed_arr[i, j] = sd

    # --- assemble Dataset ---
    ds = xr.Dataset(
        data_vars={
            "observation": (("theta_true", "obs_idx", "t", "freq_bin"), obs_arr),
            "utterance_id": (("theta_true", "obs_idx", "utt_idx", "t"), utt_id_arr),
            "log_p_utt": (("theta_true", "obs_idx", "utt_idx", "t"), log_p_arr),
            "utt_seed": (("theta_true", "obs_idx", "utt_idx"), seed_arr),
        },
        coords={
            "theta_true": ("theta_true", theta_arr),
            "obs_idx": ("obs_idx", obs_idx_arr),
            "utt_idx": ("utt_idx", np.arange(n_utt_seq, dtype=np.int64)),
            "t": ("t", t_arr),
            "freq_bin": ("freq_bin", np.arange(m_plus_1, dtype=np.int64)),
            "utterance_vocab": ("utt_id", np.array(utt_vocab, dtype="U")),
        },
        attrs={
            "speaker_config": json.dumps(_jsonable(speaker_config)),
            "n_utt_seq": int(n_utt_seq),
            "seed": "None" if seed is None else int(seed),
            "execution_path": "fast" if fast_path else "slow",
        },
    )
    return ds


# =============================================================================
# Helpers
# =============================================================================

def _validate_and_extract(
    config: Dict[str, Any],
) -> Tuple[Dict[str, Any], int, Optional[int], int]:
    missing = [k for k in _REQUIRED_KEYS if k not in config]
    if missing:
        raise KeyError(f"config is missing required keys: {missing}")

    speaker_config = dict(config["speaker"])  # shallow copy; we forward as kwargs
    n_utt_seq = int(config["n_utt_seq"])
    seed = config.get("seed", None)
    n_jobs = int(config.get("n_jobs", 1))

    if n_utt_seq < 1:
        raise ValueError(f"n_utt_seq must be >= 1, got {n_utt_seq}")
    if n_utt_seq > MAX_N_UTT_SEQ:
        raise ValueError(
            f"n_utt_seq must be <= {MAX_N_UTT_SEQ} to prevent task seed collisions, "
            f"got {n_utt_seq}"
        )
    if "level" not in speaker_config:
        raise KeyError("speaker_config must include 'level'")

    return speaker_config, n_utt_seq, seed, n_jobs


def _dispatch_fast_path(speaker_config: Dict[str, Any]) -> bool:
    """
    Fast path applies when the speaker's policy P(u|O) is fixed at __init__:
    - Level 0 (LiteralSpeaker): policy is uniform over true utterances of obs.
    - Level >= 1 with update_internal=False: policy computed once from prior.
    """
    level = speaker_config["level"]
    if level == 0:
        return True
    return not speaker_config.get("update_internal", False)


def _jsonable(speaker_config: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a speaker config dict to JSON-serializable form (numpy → list)."""
    out: Dict[str, Any] = {}
    for k, v in speaker_config.items():
        if isinstance(v, np.ndarray):
            out[k] = v.tolist()
        elif isinstance(v, (np.integer, np.floating)):
            out[k] = v.item()
        else:
            out[k] = v
    return out


def _run_task_fast(
    utt_log_prob: np.ndarray,    # (|U|, |O|)
    obs_col_idx: np.ndarray,     # (T,)
    n_utt_seq: int,
    task_seed: Optional[int],
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Vectorized Gumbel-max sampling for one (theta_true, obs_idx) task.

    Returns
    -------
    utt_ids : (n_utt_seq, T) int32      — index into the utterance vocabulary
    log_p   : (n_utt_seq, T) float64    — log P(chosen_u | O_t) under the policy
    seeds   : (n_utt_seq,) int64        — task_seed repeated (gumbel batch sample)
    """
    T = len(obs_col_idx)
    n_U = utt_log_prob.shape[0]
    rng = np.random.default_rng(task_seed)

    # logp_per_t[t, u] = log P(u | O_t)  (T, |U|)
    logp_per_t = utt_log_prob[:, obs_col_idx].T

    # Gumbel-max: argmax_u (log_p + Gumbel(0, 1)) gives a draw from the categorical.
    # -inf entries (impossible utterances) automatically lose the argmax.
    gumbels = rng.gumbel(size=(n_utt_seq, T, n_U))
    scores = logp_per_t[None, :, :] + gumbels
    utt_ids = scores.argmax(axis=-1).astype(np.int32)  # (n_utt_seq, T)

    # log_p of the chosen utterance under the current policy.
    log_p = np.take_along_axis(
        np.broadcast_to(logp_per_t[None, :, :], (n_utt_seq, T, n_U)),
        utt_ids[..., None],
        axis=-1,
    ).squeeze(-1)

    seeds = np.full(n_utt_seq, task_seed if task_seed is not None else -1, dtype=np.int64)
    return utt_ids, log_p, seeds


def _run_task_slow(
    world: World,
    speaker_config: Dict[str, Any],
    utt_vocab: List[str],
    obs_seq: List[Tuple[int, ...]],
    n_utt_seq: int,
    task_seed: Optional[int],
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Per-utt-seq fresh speaker, sequential update_and_speak. Captures log P(u_t | O_t)
    BEFORE the update so update_internal=True is handled correctly.
    """
    T = len(obs_seq)
    utt_str_to_id = {u: i for i, u in enumerate(utt_vocab)}

    utt_ids = np.zeros((n_utt_seq, T), dtype=np.int32)
    log_p = np.zeros((n_utt_seq, T), dtype=np.float64)
    seeds = np.full(n_utt_seq, -1, dtype=np.int64)

    for utt_idx in range(n_utt_seq):
        utt_seed = (task_seed + utt_idx) if task_seed is not None else None
        rng = np.random.default_rng(utt_seed)
        speaker = create_speaker(world, rng=rng, **speaker_config)
        seeds[utt_idx] = utt_seed if utt_seed is not None else -1

        for t, obs in enumerate(obs_seq):
            # Capture log p BEFORE update_and_speak — this matches what produced u.
            # Note: subscript (df[obs]) selects the tuple-labeled column as a Series.
            # df.loc[:, obs] would (mis)interpret the tuple as a list-like multi-key.
            log_p_pre_series = speaker.utterance_log_prob_obs[obs]
            u = speaker.update_and_speak(obs)
            uid = utt_str_to_id[u]
            utt_ids[utt_idx, t] = uid
            log_p[utt_idx, t] = float(log_p_pre_series.loc[u])

    return utt_ids, log_p, seeds
