#!/usr/bin/env python3
"""
run_coarse_screening.py

Coarse screening script for optimal experiment design.
Runs the full sampling and fitting pipeline for a given (N, M) combination.

Usage:
    python run_coarse_screening.py --n 5 --m 5 --output results_5_5.pkl

For cluster submission, you can run one (N, M) pair per job:
    python run_coarse_screening.py --n 4 --m 5 --output results_4_5.pkl
    python run_coarse_screening.py --n 4 --m 6 --output results_4_6.pkl
    ...
"""

import argparse
import pickle
import time
import os
import sys
from datetime import datetime

import numpy as np

from rsa_optimal_exp_sampling_fun import (
    sample_observation_sequences_multiT, 
    generate_utterances_for_observations_multiT
)

from rsa_optimal_exp_fitting import (
    compute_literal_log_likelihood_multiT, 
    compute_pragmatic_static_log_likelihood_multiT,
    compute_pragmatic_dynamic_log_likelihood_multiT
)


# =============================================================================
# DEFAULT CONFIGURATION
# =============================================================================

# Design space parameters
DEFAULT_Ts = [5, 7, 10, 13, 15]
DEFAULT_THETAs = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

# Sampling parameters (scaled for ~1 hour with 9 cores)
DEFAULT_N_OBS_SEQ = 80    # Number of observation sequences per theta
DEFAULT_N_UTT_SEQ = 25    # Number of utterance sequences per (obs_seq, speaker)

# Random seed for reproducibility
DEFAULT_SEED = 42

# Generating speaker configurations (the 7 models)
TRUE_SPEAKER_CONFIGS = [
    # Literal speaker
    {
        "speaker_type": "literal"
    },
    # Informative speakers
    {
        "speaker_type": "pragmatic",
        "omega": "strat",
        "psi": "inf",
        "alpha": 4.0,
        "update_internal": False
    },
    {
        "speaker_type": "pragmatic",
        "omega": "strat",
        "psi": "inf",
        "alpha": 4.0,
        "update_internal": True
    },
    # Persuade-up speakers
    {
        "speaker_type": "pragmatic",
        "omega": "strat",
        "psi": "pers+",
        "alpha": 4.0,
        "update_internal": False
    },
    {
        "speaker_type": "pragmatic",
        "omega": "strat",
        "psi": "pers+",
        "alpha": 4.0,
        "update_internal": True
    },
    # Persuade-down speakers
    {
        "speaker_type": "pragmatic",
        "omega": "strat",
        "psi": "pers-",
        "alpha": 4.0,
        "update_internal": False
    },
    {
        "speaker_type": "pragmatic",
        "omega": "strat",
        "psi": "pers-",
        "alpha": 4.0,
        "update_internal": True
    },
]

# Fitting speaker goals
FITTING_SPEAKER_PSIS = ["inf", "pers+", "pers-"]


# =============================================================================
# MAIN PIPELINE
# =============================================================================

def run_coarse_screening(
    n: int,
    m: int,
    thetas: list = None,
    Ts: list = None,
    n_obs_seq: int = DEFAULT_N_OBS_SEQ,
    n_utt_seq: int = DEFAULT_N_UTT_SEQ,
    seed: int = DEFAULT_SEED,
    n_jobs: int = -1,
    verbose: int = 1
) -> dict:
    """
    Run the complete coarse screening pipeline for a given (N, M) combination.
    
    Parameters
    ----------
    n : int
        Number of experiments per observation.
    m : int
        Number of Bernoulli trials per experiment.
    thetas : list, optional
        List of theta values to simulate. Default: [0.1, 0.2, ..., 0.9]
    Ts : list, optional
        List of sequence lengths. Default: [5, 7, 10, 13, 15]
    n_obs_seq : int
        Number of observation sequences per theta.
    n_utt_seq : int
        Number of utterance sequences per (obs_seq, speaker).
    seed : int
        Random seed for reproducibility.
    n_jobs : int
        Number of parallel workers. -1 for all cores.
    verbose : int
        Verbosity level (0=silent, 1=progress, 2+=detailed).
    
    Returns
    -------
    dict
        The complete obs_data structure with all samples and fitted likelihoods.
    """
    
    if thetas is None:
        thetas = DEFAULT_THETAs
    if Ts is None:
        Ts = DEFAULT_Ts
    
    start_time = time.time()
    
    # =========================================================================
    # STAGE 1: Sample observation sequences
    # =========================================================================
    
    if verbose >= 1:
        print("=" * 70)
        print(f"COARSE SCREENING: N={n}, M={m}")
        print(f"  Thetas: {thetas}")
        print(f"  Ts: {Ts}")
        print(f"  n_obs_seq: {n_obs_seq}, n_utt_seq: {n_utt_seq}")
        print(f"  Seed: {seed}, n_jobs: {n_jobs}")
        print("=" * 70)
        print("\n[Stage 1] Sampling observation sequences...")
    
    stage1_start = time.time()
    
    obs_data = sample_observation_sequences_multiT(
        n=n, 
        m=m,
        thetas=thetas,
        Ts=Ts,
        n_obs_seq=n_obs_seq,
        random_seed=seed,
        compute_obs_likelihood="all"
    )
    
    stage1_time = time.time() - stage1_start
    if verbose >= 1:
        n_total_obs = len(thetas) * n_obs_seq
        print(f"  Completed: {n_total_obs} observation sequences in {stage1_time:.1f}s")
    
    # =========================================================================
    # STAGE 2: Generate utterances from each speaker model
    # =========================================================================
    
    if verbose >= 1:
        print("\n[Stage 2] Generating utterances from each speaker model...")
    
    stage2_start = time.time()
    
    for i, speaker_config in enumerate(TRUE_SPEAKER_CONFIGS):
        speaker_name = _get_speaker_name(speaker_config)
        
        if verbose >= 2:
            print(f"  Generating from {speaker_name}...")
        
        generate_utterances_for_observations_multiT(
            obs_data=obs_data,
            speaker_config=speaker_config,
            n_utt_seq=n_utt_seq,
            n_jobs=n_jobs,
            verbose=max(0, verbose - 2)
        )
    
    stage2_time = time.time() - stage2_start
    if verbose >= 1:
        n_total_utt = len(thetas) * n_obs_seq * n_utt_seq * len(TRUE_SPEAKER_CONFIGS)
        print(f"  Completed: {n_total_utt} utterance sequences in {stage2_time:.1f}s")
    
    # =========================================================================
    # STAGE 3: Fit literal speaker
    # =========================================================================
    
    if verbose >= 1:
        print("\n[Stage 3] Fitting literal speaker...")
    
    stage3_start = time.time()
    
    compute_literal_log_likelihood_multiT(
        obs_data=obs_data,
        verbose=max(0, verbose - 1)
    )
    
    stage3_time = time.time() - stage3_start
    if verbose >= 1:
        print(f"  Completed in {stage3_time:.1f}s")
    
    # =========================================================================
    # STAGE 4: Fit pragmatic speakers (static and dynamic)
    # =========================================================================
    
    if verbose >= 1:
        print("\n[Stage 4] Fitting pragmatic speakers...")
    
    stage4_start = time.time()
    
    for psi in FITTING_SPEAKER_PSIS:
        psi_name = {"inf": "informative", "pers+": "persuade-up", "pers-": "persuade-down"}[psi]
        
        if verbose >= 2:
            print(f"  Fitting {psi_name} (static)...")
        
        compute_pragmatic_static_log_likelihood_multiT(
            obs_data=obs_data,
            fitting_psi=psi,
            n_jobs=n_jobs,
            verbose=max(0, verbose - 2)
        )
        
        if verbose >= 2:
            print(f"  Fitting {psi_name} (dynamic)...")
        
        compute_pragmatic_dynamic_log_likelihood_multiT(
            obs_data=obs_data,
            fitting_psi=psi,
            n_jobs=n_jobs,
            verbose=max(0, verbose - 2)
        )
    
    stage4_time = time.time() - stage4_start
    if verbose >= 1:
        print(f"  Completed in {stage4_time:.1f}s")
    
    # =========================================================================
    # SUMMARY
    # =========================================================================
    
    total_time = time.time() - start_time
    
    if verbose >= 1:
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)
        print(f"  Stage 1 (obs sampling):    {stage1_time:7.1f}s")
        print(f"  Stage 2 (utt generation):  {stage2_time:7.1f}s")
        print(f"  Stage 3 (literal fit):     {stage3_time:7.1f}s")
        print(f"  Stage 4 (pragmatic fit):   {stage4_time:7.1f}s")
        print(f"  ----------------------------------------")
        print(f"  TOTAL:                     {total_time:7.1f}s ({total_time/60:.1f} min)")
        print("=" * 70)
    
    # Add metadata
    obs_data["_metadata"] = {
        "n": n,
        "m": m,
        "thetas": thetas,
        "Ts": Ts,
        "n_obs_seq": n_obs_seq,
        "n_utt_seq": n_utt_seq,
        "seed": seed,
        "timestamp": datetime.now().isoformat(),
        "timing": {
            "stage1_obs_sampling": stage1_time,
            "stage2_utt_generation": stage2_time,
            "stage3_literal_fit": stage3_time,
            "stage4_pragmatic_fit": stage4_time,
            "total": total_time
        }
    }
    
    return obs_data


def _get_speaker_name(config: dict) -> str:
    """Get a human-readable name for a speaker configuration."""
    if config["speaker_type"] == "literal":
        return "literal"
    else:
        psi = config["psi"]
        update = "T" if config["update_internal"] else "F"
        psi_prefix = {"inf": "inf", "pers+": "persp", "pers-": "persm"}[psi]
        return f"{psi_prefix}_{update}"


# =============================================================================
# CLI INTERFACE
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Run coarse screening for optimal experiment design.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run with defaults (N=5, M=5)
  python run_coarse_screening.py --n 5 --m 5 --output results_5_5.pkl

  # Run with custom sample sizes
  python run_coarse_screening.py --n 4 --m 6 --n_obs_seq 20 --n_utt_seq 30 --output results_4_6.pkl

  # Run quietly
  python run_coarse_screening.py --n 5 --m 4 --output results_5_4.pkl --verbose 0
        """
    )
    
    # Required arguments
    parser.add_argument("--n", type=int, required=True,
                        help="Number of experiments per observation")
    parser.add_argument("--m", type=int, required=True,
                        help="Number of Bernoulli trials per experiment")
    parser.add_argument("--output", type=str, required=True,
                        help="Output pickle file path")
    
    # Optional arguments
    parser.add_argument("--n_obs_seq", type=int, default=DEFAULT_N_OBS_SEQ,
                        help=f"Number of observation sequences per theta (default: {DEFAULT_N_OBS_SEQ})")
    parser.add_argument("--n_utt_seq", type=int, default=DEFAULT_N_UTT_SEQ,
                        help=f"Number of utterance sequences per (obs_seq, speaker) (default: {DEFAULT_N_UTT_SEQ})")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED,
                        help=f"Random seed (default: {DEFAULT_SEED})")
    parser.add_argument("--n_jobs", type=int, default=-1,
                        help="Number of parallel workers (-1 for all cores)")
    parser.add_argument("--verbose", type=int, default=1,
                        help="Verbosity level (0=silent, 1=progress, 2+=detailed)")
    
    args = parser.parse_args()
    
    # Run the pipeline
    obs_data = run_coarse_screening(
        n=args.n,
        m=args.m,
        n_obs_seq=args.n_obs_seq,
        n_utt_seq=args.n_utt_seq,
        seed=args.seed,
        n_jobs=args.n_jobs,
        verbose=args.verbose
    )
    
    # Save results
    output_path = args.output
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
    
    with open(output_path, "wb") as f:
        pickle.dump(obs_data, f)
    
    if args.verbose >= 1:
        file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        print(f"\nSaved results to: {output_path} ({file_size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
