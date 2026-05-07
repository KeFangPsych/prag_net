"""
run.py — Driver for experiment "n1m5_T60_obs5000_seed42".

Output
------
Sits next to this script in a `raw_do_not_track/` subdirectory so the
experiment's code and data live side-by-side:

    models/simulations/simulation_experiments/n1m5_T60_obs5000_seed42/
        run.py, io.py, ...
        raw_do_not_track/                  # gitignored via the project pattern
            meta.json
            observations.pkl
            <speaker>/
                meta.json
                utterances.pkl
                <listener>/
                    meta.json
                    beliefs.pkl

The "raw_do_not_track" name matches the existing .gitignore convention
(**/raw_do_not_track/) so the data isn't committed.

Idempotence
-----------
By default, any stage whose output file already exists is skipped (and loaded
from disk for downstream stages). Pass --overwrite to redo everything.

Usage
-----
    python models/simulations/simulation_experiments/n1m5_T60_obs5000_seed42/run.py
    python models/simulations/simulation_experiments/n1m5_T60_obs5000_seed42/run.py --overwrite
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

# --- repo-root bootstrap so `from models.simulations...` works from any cwd ---
THIS_FILE = Path(__file__).resolve()
# run.py -> n1m5.../ -> simulation_experiments/ -> simulations/ -> models/ -> repo root
REPO_ROOT = THIS_FILE.parents[4]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import numpy as np  # noqa: E402

from models.simulations.world.sample_observations import sample_observations  # noqa: E402
from models.simulations.speakers.sample_utterances import sample_utterances  # noqa: E402
from models.simulations.listeners.compute_beliefs import compute_listener_beliefs  # noqa: E402

# I/O helpers vendored alongside this experiment (see io.py docstring).
from models.simulations.simulation_experiments.n1m5_T60_obs5000_seed42.io import (  # noqa: E402
    save_observations,
    load_observations,
    save_utterances,
    load_utterances,
    save_beliefs,
)


# =============================================================================
#                          EXPERIMENT CONFIGURATION
# =============================================================================
# All knobs that define this experiment live below. Edit here to redefine the
# run; nothing in the PIPELINE section needs to change for typical edits.

# ----- Identity ------------------------------------------------------------
EXPERIMENT_NAME = "n1m5_T60_obs5000_seed42"
# Outputs live alongside this script in raw_do_not_track/ so code and data for
# one experiment stay together. raw_do_not_track is in the project .gitignore.
OUT_ROOT = THIS_FILE.parent / "raw_do_not_track"

# ----- World ---------------------------------------------------------------
# theta_values is the FULL grid agents reason over (their belief / inference
# support). We include the boundaries 0.0 and 1.0 so the listener doesn't
# a-priori rule out a fully unsuccessful or fully successful generator.
WORLD = {
    "n": 1,
    "m": 5,
    "theta_values": [round(0.1 * k, 1) for k in range(11)],  # [0.0, 0.1, ..., 1.0]
}

# TRUE_THETAS is the (strictly smaller) set of true thetas at which we
# *sample* observation sequences. The boundaries 0.0 and 1.0 are excluded so
# observations come from non-degenerate distributions while remaining in the
# support of the agents' beliefs.
TRUE_THETAS = [round(0.1 * k, 1) for k in range(1, 10)]      # [0.1, 0.2, ..., 0.9]

# ----- Sample sizes --------------------------------------------------------
T = 60
N_OBS_SEQ = 5000
N_UTT_SEQ = 1

# ----- Seeds ---------------------------------------------------------------
OBS_SEED = 42
UTT_SEED_BASE = 1000   # per-speaker offset added on top, so utterance streams
                       # are distinct across speakers but reproducible.

# ----- Speakers ------------------------------------------------------------
# Two level-1 speakers under omega='strat', alpha=3.0, update_internal=False.
# beta is set explicitly to mirror the theoretical convention even when the
# runtime ignores it (psi='inf' disregards beta).
SPEAKERS = {
    "inf_L1strat_a3_b1_uiF": {
        "level": 1,
        "omega": "strat",
        "psi": "inf",
        "alpha": 3.0,
        "beta": 1.0,                  # pure-info convention; runtime ignores beta when psi='inf'
        "update_internal": False,
    },
    "persp_L1strat_a3_b0_uiF": {       # persp = pers+   (persm would be pers-)
        "level": 1,
        "omega": "strat",
        "psi": "pers+",
        "alpha": 3.0,
        "beta": 0.0,                  # pure persuasion
        "update_internal": False,
    },
}

# ----- Listeners -----------------------------------------------------------
# alpha and alpha_vals match the speakers' alpha so internal speaker models
# in the listener are correctly specified; beta defaults to 0 in rsa_core,
# which is what the pers+ internal model wants (and beta is irrelevant for
# the inf internal model).
LISTENERS = {
    "literal_L0": {                   # L0 has no `update_internal` parameter -> no _ui suffix
        "level": 0,
    },
    "credulous_L1coop_a3_uiF": {
        "level": 1,
        "omega": "coop",              # coop -> psi grid collapses to ['inf']
        "update_internal": False,
        "alpha": 3.0,
        "alpha_vals": [3.0],
    },
    "vigilant_L1strat_a3_uiF": {
        "level": 1,
        "omega": "strat",             # strat -> psi grid is ['inf', 'pers+', 'pers-']
        "update_internal": False,
        "alpha": 3.0,
        "alpha_vals": [3.0],
    },
}


# =============================================================================
#                                 PIPELINE
# =============================================================================
# The driver below shouldn't need editing for normal config changes. It calls
# the three stages in order, persisting each stage's output before moving on,
# and skips any stage whose output already exists unless --overwrite is set.

def main(overwrite: bool = False) -> None:
    print(f"Output root: {OUT_ROOT}")
    OUT_ROOT.mkdir(parents=True, exist_ok=True)

    # ----- Stage 1: observations -----
    obs_meta = {
        "world": WORLD, "thetas": TRUE_THETAS,
        "n_obs_seq": N_OBS_SEQ, "T": T, "seed": OBS_SEED,
    }
    obs_pkl = OUT_ROOT / "observations.pkl"
    if obs_pkl.exists() and not overwrite:
        print(f"[Stage 1] {obs_pkl.name} exists — loading.")
        obs_df, world = load_observations(OUT_ROOT)
        print(f"  {len(obs_df):,} rows")
    else:
        print("[Stage 1] Sampling observations...")
        t0 = time.time()
        obs_df, world = sample_observations(obs_meta)
        print(f"  {len(obs_df):,} rows in {time.time()-t0:.1f}s")
        save_observations(OUT_ROOT, obs_df, obs_meta)

    # ----- Stage 2 + Stage 3 nested -----
    for spk_idx, (spk_name, spk_cfg) in enumerate(SPEAKERS.items()):
        spk_dir = OUT_ROOT / spk_name
        utt_meta = {
            "speaker": spk_cfg,
            "n_utt_seq": N_UTT_SEQ,
            "seed": UTT_SEED_BASE + spk_idx,
        }
        utt_pkl = spk_dir / "utterances.pkl"
        if utt_pkl.exists() and not overwrite:
            print(f"[Stage 2: {spk_name}] {utt_pkl.name} exists — loading.")
            utt_ds = load_utterances(spk_dir)
        else:
            print(f"[Stage 2: {spk_name}] Sampling utterances...")
            t0 = time.time()
            utt_ds = sample_utterances(obs_df, world, utt_meta)
            print(
                f"  sizes={dict(utt_ds.sizes)} "
                f"path={utt_ds.attrs['execution_path']} "
                f"in {time.time()-t0:.1f}s"
            )
            save_utterances(spk_dir, utt_ds, utt_meta)

        for lst_name, lst_cfg in LISTENERS.items():
            lst_dir = spk_dir / lst_name
            blf_meta = {"listener": lst_cfg}
            blf_pkl = lst_dir / "beliefs.pkl"
            if blf_pkl.exists() and not overwrite:
                print(f"[Stage 3: {spk_name}/{lst_name}] {blf_pkl.name} exists — skipping.")
                continue
            print(f"[Stage 3: {spk_name}/{lst_name}] Computing beliefs...")
            t0 = time.time()
            belief_ds = compute_listener_beliefs(utt_ds, world, blf_meta)
            print(
                f"  sizes={dict(belief_ds.sizes)} "
                f"path={belief_ds.attrs['execution_path']} "
                f"in {time.time()-t0:.1f}s"
            )
            save_beliefs(lst_dir, belief_ds, blf_meta)

    print(f"\nDone.\nOutput root: {OUT_ROOT}")


if __name__ == "__main__":
    overwrite = "--overwrite" in sys.argv
    main(overwrite=overwrite)
