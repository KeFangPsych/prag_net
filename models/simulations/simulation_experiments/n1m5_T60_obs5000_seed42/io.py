"""
io.py — save/load helpers for THIS experiment.

These helpers are vendored per-experiment rather than living in a shared
module: experiments at different scales may need different storage strategies
(pickle for small runs, chunked zarr / netCDF for large runs, parquet for
tabular). Keeping the I/O alongside the experiment that uses it makes each
experiment self-contained and free to specialize without affecting siblings.

Layout
------
Each stage's output lives in its own directory containing:
    meta.json    Full config dict (JSON, human-readable). The directory is
                 self-describing — you can grep / diff configs without
                 loading the data.
    <stage>.pkl  The actual data:
                 - Stage 1: observations.pkl (a pandas DataFrame)
                 - Stage 2: utterances.pkl   (an xarray Dataset)
                 - Stage 3: beliefs.pkl      (an xarray Dataset)

We deliberately do NOT pickle the World object on disk. World is reconstructed
on load from meta.json["world"] — this keeps the saved data robust to changes
in rsa_core (renaming attributes, adding precomputed tables, etc.).

Format choice for this experiment
---------------------------------
Pickle is used because the env doesn't have h5netcdf / pyarrow / zarr today,
and ~500 MB of pickled DataFrames / Datasets is fine. For a substantially
larger experiment, fork this io.py and swap pickle for `ds.to_netcdf` (Stage
2/3) and `obs_df.to_parquet` (Stage 1) — only two lines change per save/load
pair.
"""
from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd
import xarray as xr

from models.simulations.rsa_core import World


# =============================================================================
# meta.json helpers
# =============================================================================

def _jsonable(obj: Any) -> Any:
    """Recursively convert numpy / pandas types to JSON-serializable primitives."""
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (list, tuple)):
        return [_jsonable(x) for x in obj]
    return obj


def _ensure_dir(p: Path) -> None:
    Path(p).mkdir(parents=True, exist_ok=True)


def _write_meta(out_dir: Path, meta: Dict[str, Any]) -> None:
    out_dir = Path(out_dir)
    _ensure_dir(out_dir)
    (out_dir / "meta.json").write_text(
        json.dumps(_jsonable(meta), indent=2, default=str)
    )


def _read_meta(in_dir: Path) -> Dict[str, Any]:
    return json.loads((Path(in_dir) / "meta.json").read_text())


# =============================================================================
# Stage 1 — observations
# =============================================================================

def save_observations(
    out_dir: Path | str,
    obs_df: pd.DataFrame,
    meta: Dict[str, Any],
) -> None:
    """
    Save the Stage 1 outputs.

    meta should include: 'world', 'thetas', 'n_obs_seq', 'T', 'seed'.
    """
    out_dir = Path(out_dir)
    _ensure_dir(out_dir)
    _write_meta(out_dir, meta)
    obs_df.to_pickle(out_dir / "observations.pkl")


def load_observations(in_dir: Path | str) -> Tuple[pd.DataFrame, World]:
    """
    Load observations and reconstruct the World from meta.json["world"].
    """
    in_dir = Path(in_dir)
    meta = _read_meta(in_dir)
    obs_df = pd.read_pickle(in_dir / "observations.pkl")

    # World requires theta_values as np.ndarray; meta.json stores it as a list
    # (JSON has no native ndarray type), so coerce before instantiating.
    world_kwargs = dict(meta["world"])
    if "theta_values" in world_kwargs and not isinstance(world_kwargs["theta_values"], np.ndarray):
        world_kwargs["theta_values"] = np.asarray(world_kwargs["theta_values"], dtype=float)
    world = World(**world_kwargs)
    return obs_df, world


# =============================================================================
# Stage 2 — utterances
# =============================================================================

def save_utterances(
    out_dir: Path | str,
    utt_ds: xr.Dataset,
    meta: Dict[str, Any],
) -> None:
    """
    meta should include: 'speaker', 'n_utt_seq', 'seed'.
    """
    out_dir = Path(out_dir)
    _ensure_dir(out_dir)
    _write_meta(out_dir, meta)
    with (out_dir / "utterances.pkl").open("wb") as f:
        pickle.dump(utt_ds, f)


def load_utterances(in_dir: Path | str) -> xr.Dataset:
    with (Path(in_dir) / "utterances.pkl").open("rb") as f:
        return pickle.load(f)


# =============================================================================
# Stage 3 — beliefs
# =============================================================================

def save_beliefs(
    out_dir: Path | str,
    belief_ds: xr.Dataset,
    meta: Dict[str, Any],
) -> None:
    """
    meta should include: 'listener'.
    """
    out_dir = Path(out_dir)
    _ensure_dir(out_dir)
    _write_meta(out_dir, meta)
    with (out_dir / "beliefs.pkl").open("wb") as f:
        pickle.dump(belief_ds, f)


def load_beliefs(in_dir: Path | str) -> xr.Dataset:
    with (Path(in_dir) / "beliefs.pkl").open("rb") as f:
        return pickle.load(f)
