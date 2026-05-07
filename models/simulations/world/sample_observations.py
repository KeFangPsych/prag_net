"""
sample_observations.py

Stage 1 of the simulation pipeline. Given a world spec and a list of true theta
values, sample n_obs_seq observation sequences of length T per theta and return
a tidy long-form DataFrame plus the constructed World (so downstream stages can
reuse it without rebuilding).

Schema of the returned DataFrame
--------------------------------
One row per (theta_true, obs_idx, t):
    theta_true  : float                 # true theta used for sampling
    obs_idx     : int                   # 0..n_obs_seq-1, sequence id within a theta
    t           : int                   # 0..T-1, position within the sequence
    observation : tuple[int, ...]       # frequency tuple from world.observations
    run_seed    : int | None            # per-sequence seed (None if unseeded)

Seed scheme
-----------
A single base `seed` (or None) is passed to World.sample_multiple_runs once
per theta. Inside the World, each sequence uses run_seed = base_seed + obs_idx.
Crucially, this means the *same* run_seed is used for matching obs_idx across
different thetas, so the underlying random stream is aligned and any
differences in the sampled observations are attributable to theta only.
This is desirable for paired/contrast analyses; if you need fully independent
streams across thetas, run sample_observations multiple times with different
seeds and concat.
"""
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd

from models.simulations.rsa_core import World


_REQUIRED_KEYS = ("world", "thetas", "n_obs_seq", "T")


def sample_observations(config: Dict[str, Any]) -> Tuple[pd.DataFrame, World]:
    """
    Sample observation sequences for one or more true theta values.

    Parameters
    ----------
    config : dict
        Required keys:
            "world"     : dict, keyword args forwarded to World(...). Typical
                          keys are n, m, theta_values.
            "thetas"    : iterable of float. True theta values to sample for.
                          Each must be present in world.theta_values
                          (strict match, no silent rounding).
            "n_obs_seq" : int >= 1. Sequences per theta.
            "T"         : int >= 1. Observations per sequence.
        Optional:
            "seed"      : int | None. Base seed shared across thetas; the
                          per-sequence seed is base_seed + obs_idx.
                          None disables reproducibility.

    Returns
    -------
    obs_df : pandas.DataFrame
        Long-form, columns ["theta_true", "obs_idx", "t", "observation", "run_seed"],
        sorted by (theta_true, obs_idx, t).
    world : World
        The constructed World instance.

    Raises
    ------
    KeyError
        If a required config key is missing.
    ValueError
        If n_obs_seq < 1, T < 1, thetas is empty, or any theta is not present
        in world.theta_values.
    """
    missing = [k for k in _REQUIRED_KEYS if k not in config]
    if missing:
        raise KeyError(f"config is missing required keys: {missing}")

    world_kwargs = config["world"]
    thetas = list(config["thetas"])
    n_obs_seq = int(config["n_obs_seq"])
    T = int(config["T"])
    seed = config.get("seed", None)

    if n_obs_seq < 1:
        raise ValueError(f"n_obs_seq must be >= 1, got {n_obs_seq}")
    if T < 1:
        raise ValueError(f"T must be >= 1, got {T}")
    if len(thetas) == 0:
        raise ValueError("thetas must be non-empty")

    # World requires theta_values as np.ndarray; coerce here so callers can pass
    # a Python list (e.g., from a JSON-deserialized meta.json or a config dict).
    world_kwargs = dict(world_kwargs)
    if "theta_values" in world_kwargs and not isinstance(world_kwargs["theta_values"], np.ndarray):
        world_kwargs["theta_values"] = np.asarray(world_kwargs["theta_values"], dtype=float)

    world = World(**world_kwargs)

    # Strict theta validation: fail loudly rather than silently round to nearest.
    # World.sample_run will warn-and-round, which we want to avoid in pipeline use.
    for theta in thetas:
        closest = world.theta_values[np.abs(world.theta_values - theta).argmin()]
        if not np.isclose(theta, closest, rtol=1e-10, atol=1e-10):
            raise ValueError(
                f"theta {theta} not in world.theta_values "
                f"(closest: {closest}; available: {list(world.theta_values)})"
            )

    parts = []
    for theta in thetas:
        df = world.sample_multiple_runs(
            theta=theta,
            n_run=n_obs_seq,
            n_round=T,
            base_seed=seed,
        )
        df = df.rename(columns={
            "theta": "theta_true",
            "run_id": "obs_idx",
            "round_index": "t",
        })
        parts.append(df)

    obs_df = (
        pd.concat(parts, ignore_index=True)
          .loc[:, ["theta_true", "obs_idx", "t", "observation", "run_seed"]]
          .sort_values(["theta_true", "obs_idx", "t"])
          .reset_index(drop=True)
    )
    return obs_df, world
