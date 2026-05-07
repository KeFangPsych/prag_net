# =============================================================================
# run_exhaustive_search.py
#
# Exhaustively search all 8^5 = 32,768 utterance sequences to find those that:
# 1. Maximally differentiate literal, credulous, and vigilant listeners
# 2. Are PLAUSIBLE under the speaker model (not degenerate sequences)
#
# Usage:
#   python run_exhaustive_search.py --alpha 4.0 --output results_alpha_4.0.pkl
#   python run_exhaustive_search.py --alpha 2.0 4.0 8.0 --output results_multi.pkl
#
# =============================================================================

import argparse
import pickle
import time
import os
from datetime import datetime
from typing import List, Dict, Tuple, Any
from dataclasses import dataclass, asdict
import itertools

import numpy as np
import pandas as pd
from scipy.special import logsumexp
from joblib import Parallel, delayed
from tqdm import tqdm

# Import RSA module (should be in PYTHONPATH or same directory)
from rsa_optimal_exp_core import (
    World, LiteralListener, LiteralSpeaker, 
    PragmaticSpeaker_obs, PragmaticListener_obs_n,
    log_M_product
)


# =============================================================================
# CONFIGURATION
# =============================================================================

# Experiment setup
N_PATIENTS = 5
M_TRIALS = 1
N_ROUNDS = 5

# The 8 possible utterances in experiment format: (Quantifier, Predicate)
EXPERIMENT_UTTERANCES = [
    ('No', 'Effective'),
    ('Some', 'Effective'),
    ('Most', 'Effective'),
    ('All', 'Effective'),
    ('No', 'Ineffective'),
    ('Some', 'Ineffective'),
    ('Most', 'Ineffective'),
    ('All', 'Ineffective'),
]

# Mapping to RSA format
EXP_TO_RSA = {
    ('No', 'Effective'): 'no,all,successful',
    ('Some', 'Effective'): 'some,all,successful',
    ('Most', 'Effective'): 'most,all,successful',
    ('All', 'Effective'): 'all,all,successful',
    ('No', 'Ineffective'): 'no,all,unsuccessful',
    ('Some', 'Ineffective'): 'some,all,unsuccessful',
    ('Most', 'Ineffective'): 'most,all,unsuccessful',
    ('All', 'Ineffective'): 'all,all,unsuccessful',
}

TOTAL_SEQUENCES = len(EXPERIMENT_UTTERANCES) ** N_ROUNDS  # 8^5 = 32768

# Speaker types to compute likelihood for
SPEAKER_TYPES = ['literal', 'inf', 'pers+', 'pers-']


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def js_divergence(p: np.ndarray, q: np.ndarray, eps: float = 1e-10) -> float:
    """Compute Jensen-Shannon divergence between two distributions."""
    p = np.asarray(p, dtype=np.float64)
    q = np.asarray(q, dtype=np.float64)
    p = np.clip(p, eps, 1.0)
    q = np.clip(q, eps, 1.0)
    p = p / p.sum()
    q = q / q.sum()
    m = 0.5 * (p + q)
    kl_pm = np.sum(p * np.log(p / m))
    kl_qm = np.sum(q * np.log(q / m))
    return 0.5 * (kl_pm + kl_qm)


def create_listeners(world: World, alpha: float, update_internal: bool = False) -> Dict:
    """Create the three listener types: literal, credulous, vigilant."""
    
    # Literal Listener (L0)
    literal = LiteralListener(world, initial_beliefs_theta=None)
    
    # Credulous Listener (L1, believes speaker is informative)
    credulous_psi_prior = np.array([1e-6, 1.0 - 2e-6, 1e-6])
    credulous_psi_prior = credulous_psi_prior / credulous_psi_prior.sum()
    
    credulous = PragmaticListener_obs_n(
        world=world,
        level=1,
        omega="strat",
        update_internal=update_internal,
        alpha=alpha,
        beta=0.0,
        initial_beliefs_theta=None,
        initial_beliefs_psi=credulous_psi_prior,
        alpha_vals=[alpha],
        initial_beliefs_alpha=None
    )
    
    # Vigilant Listener (L1, uniform prior over speaker types)
    vigilant_psi_prior = np.array([1/3, 1/3, 1/3])
    
    vigilant = PragmaticListener_obs_n(
        world=world,
        level=1,
        omega="strat",
        update_internal=update_internal,
        alpha=alpha,
        beta=0.0,
        initial_beliefs_theta=None,
        initial_beliefs_psi=vigilant_psi_prior,
        alpha_vals=[alpha],
        initial_beliefs_alpha=None
    )
    
    return {'literal': literal, 'credulous': credulous, 'vigilant': vigilant}


def compute_utterance_log_likelihood_theta(
    utterance_log_prob_obs: np.ndarray,
    obs_log_likelihood_theta: np.ndarray
) -> np.ndarray:
    """
    Compute log P(u | θ) by marginalizing over observations.
    
    log P(u | θ) = log Σ_obs P(u | obs) × P(obs | θ)
    
    This is a log-space matrix multiplication.
    
    Parameters
    ----------
    utterance_log_prob_obs : np.ndarray
        Shape (n_utterances, n_observations), log P(u | obs)
    obs_log_likelihood_theta : np.ndarray
        Shape (n_observations, n_theta), log P(obs | θ)
    
    Returns
    -------
    np.ndarray
        Shape (n_utterances, n_theta), log P(u | θ)
    """
    # Use the efficient log-space matrix product from RSA module
    return log_M_product(utterance_log_prob_obs, obs_log_likelihood_theta)


def compute_speaker_likelihoods_fast(
    sequence_rsa: Tuple[str, ...],
    world: World,
    alpha: float,
    update_internal: bool = False
) -> Dict[str, float]:
    """
    Compute log likelihoods for all speaker types efficiently.
    
    Computes P(sequence | speaker) marginalized over θ:
        P(seq | speaker) = Σ_θ P(seq | θ, speaker) × P(θ)
    
    where (for update_internal=False):
        P(seq | θ, speaker) = Π_t P(u_t | θ, speaker)
        P(u | θ, speaker) = Σ_obs P(u | obs, speaker) × P(obs | θ)
    
    Parameters
    ----------
    sequence_rsa : tuple of str
        Utterance sequence in RSA format
    world : World
        RSA world object
    alpha : float
        Speaker rationality parameter
    update_internal : bool
        Whether speaker updates internal listener model (must be False for this computation)
    
    Returns
    -------
    dict
        Maps speaker type to log P(sequence | speaker_type)
    """
    if update_internal:
        raise NotImplementedError(
            "Speaker likelihood computation with update_internal=True is not yet supported. "
            "This would require tracking state across utterances."
        )
    
    theta_vals = world.theta_values
    n_theta = len(theta_vals)
    log_theta_prior = np.full(n_theta, -np.log(n_theta))  # Uniform prior in log space
    
    # Get utterance indices
    utterances = world.utterances
    utt_to_idx = {u: i for i, u in enumerate(utterances)}
    sequence_indices = [utt_to_idx[u] for u in sequence_rsa]
    
    # Get observation likelihoods: shape (n_obs, n_theta)
    obs_log_lik_theta = world.obs_log_likelihood_theta.values
    
    results = {}
    
    # =========================================================================
    # LITERAL SPEAKER
    # =========================================================================
    
    literal_speaker = LiteralSpeaker(world, initial_beliefs_theta=None)
    
    # Get log P(u | obs) for literal speaker: shape (n_utt, n_obs)
    literal_log_prob_obs = literal_speaker.utterance_log_prob_obs.values
    
    # Compute log P(u | θ): shape (n_utt, n_theta)
    literal_log_prob_theta = compute_utterance_log_likelihood_theta(
        literal_log_prob_obs, obs_log_lik_theta
    )
    
    # Compute log P(sequence | θ) = Σ_t log P(u_t | θ)
    log_seq_given_theta_literal = np.zeros(n_theta)
    for u_idx in sequence_indices:
        log_seq_given_theta_literal += literal_log_prob_theta[u_idx, :]
    
    # Marginalize over θ: log P(seq) = logsumexp(log P(seq|θ) + log P(θ))
    results['literal'] = logsumexp(log_seq_given_theta_literal + log_theta_prior)
    
    # =========================================================================
    # PRAGMATIC SPEAKERS (inf, pers+, pers-)
    # =========================================================================
    
    for psi in ['inf', 'pers+', 'pers-']:
        try:
            speaker = PragmaticSpeaker_obs(
                world=world,
                omega="strat",
                psi=psi,
                alpha=alpha,
                beta=0.0,
                update_internal=False,  # Must be False for this computation
                initial_beliefs_theta=None
            )
            
            # Get log P(u | obs) for this speaker: shape (n_utt, n_obs)
            speaker_log_prob_obs = speaker.utterance_log_prob_obs.values
            
            # Compute log P(u | θ): shape (n_utt, n_theta)
            speaker_log_prob_theta = compute_utterance_log_likelihood_theta(
                speaker_log_prob_obs, obs_log_lik_theta
            )
            
            # Compute log P(sequence | θ) = Σ_t log P(u_t | θ)
            log_seq_given_theta = np.zeros(n_theta)
            for u_idx in sequence_indices:
                log_seq_given_theta += speaker_log_prob_theta[u_idx, :]
            
            # Marginalize over θ
            results[psi] = logsumexp(log_seq_given_theta + log_theta_prior)
            
        except Exception as e:
            # If speaker creation fails, assign -inf
            results[psi] = -np.inf
    
    return results


def evaluate_single_sequence(args: Tuple) -> Dict:
    """
    Evaluate a single utterance sequence.
    
    Computes:
    1. Listener belief trajectories (literal, credulous, vigilant)
    2. JS divergences between listeners
    3. Speaker likelihoods marginalized over θ (NEW)
    
    Parameters
    ----------
    args : tuple
        (sequence_idx, sequence_exp, alpha, update_internal)
    
    Returns
    -------
    dict with all metrics for this sequence
    """
    sequence_idx, sequence_exp, alpha, update_internal = args
    
    # Convert to RSA format
    sequence_rsa = tuple(EXP_TO_RSA[u] for u in sequence_exp)
    
    # Create fresh listeners and world
    world = World(n=N_PATIENTS, m=M_TRIALS)
    listeners = create_listeners(world, alpha, update_internal)
    theta_vals = world.theta_values
    
    # =========================================================================
    # PART 1: Listener belief updates
    # =========================================================================
    
    literal_traj = [listeners['literal'].current_belief_theta.copy()]
    credulous_traj = [listeners['credulous'].current_belief_theta.copy()]
    vigilant_traj = [listeners['vigilant'].current_belief_theta.copy()]
    vigilant_psi_traj = [listeners['vigilant'].current_belief_psi.copy()]
    
    js_lit_cred = []
    js_lit_vig = []
    js_cred_vig = []
    
    for utt_rsa in sequence_rsa:
        listeners['literal'].listen_and_update(utt_rsa)
        listeners['credulous'].listen_and_update(utt_rsa)
        listeners['vigilant'].listen_and_update(utt_rsa)
        
        lit_belief = listeners['literal'].current_belief_theta.copy()
        cred_belief = listeners['credulous'].current_belief_theta.copy()
        vig_belief = listeners['vigilant'].current_belief_theta.copy()
        vig_psi = listeners['vigilant'].current_belief_psi.copy()
        
        literal_traj.append(lit_belief)
        credulous_traj.append(cred_belief)
        vigilant_traj.append(vig_belief)
        vigilant_psi_traj.append(vig_psi)
        
        js_lit_cred.append(js_divergence(lit_belief, cred_belief))
        js_lit_vig.append(js_divergence(lit_belief, vig_belief))
        js_cred_vig.append(js_divergence(cred_belief, vig_belief))
    
    total_js_final = js_lit_cred[-1] + js_lit_vig[-1] + js_cred_vig[-1]
    total_js_cumulative = sum(js_lit_cred) + sum(js_lit_vig) + sum(js_cred_vig)
    
    mean_lit_final = np.sum(literal_traj[-1] * theta_vals)
    mean_cred_final = np.sum(credulous_traj[-1] * theta_vals)
    mean_vig_final = np.sum(vigilant_traj[-1] * theta_vals)
    
    # =========================================================================
    # PART 2: Speaker likelihoods (marginalized over θ)
    # =========================================================================
    
    speaker_log_liks = compute_speaker_likelihoods_fast(
        sequence_rsa=sequence_rsa,
        world=world,
        alpha=alpha,
        update_internal=update_internal
    )
    
    # Max log likelihood across all speaker types
    max_speaker_log_lik = max(speaker_log_liks.values())
    
    return {
        'sequence_idx': sequence_idx,
        'sequence_exp': sequence_exp,
        'sequence_rsa': sequence_rsa,
        # Listener trajectories
        'literal_theta_trajectory': [arr.tolist() for arr in literal_traj],
        'credulous_theta_trajectory': [arr.tolist() for arr in credulous_traj],
        'vigilant_theta_trajectory': [arr.tolist() for arr in vigilant_traj],
        'vigilant_psi_trajectory': [arr.tolist() for arr in vigilant_psi_traj],
        # JS divergences
        'js_lit_cred_per_round': js_lit_cred,
        'js_lit_vig_per_round': js_lit_vig,
        'js_cred_vig_per_round': js_cred_vig,
        'total_js_final': total_js_final,
        'total_js_cumulative': total_js_cumulative,
        # Listener means
        'mean_theta_literal_final': mean_lit_final,
        'mean_theta_credulous_final': mean_cred_final,
        'mean_theta_vigilant_final': mean_vig_final,
        # Speaker likelihoods (NEW)
        'log_lik_literal': speaker_log_liks['literal'],
        'log_lik_inf': speaker_log_liks['inf'],
        'log_lik_persp': speaker_log_liks['pers+'],
        'log_lik_persm': speaker_log_liks['pers-'],
        'max_log_lik': max_speaker_log_lik,
    }


# =============================================================================
# MAIN SEARCH FUNCTION
# =============================================================================

def run_exhaustive_search(
    alpha: float,
    update_internal: bool = False,
    n_jobs: int = -1,
    verbose: int = 1,
    min_log_lik: float = None,
) -> Dict:
    """
    Exhaustively search all 8^5 utterance sequences for a single alpha.
    
    Parameters
    ----------
    alpha : float
        Speaker rationality parameter.
    update_internal : bool
        Whether pragmatic listeners update internal models.
    n_jobs : int
        Number of parallel workers (-1 for all cores).
    verbose : int
        Verbosity level.
    min_log_lik : float, optional
        Minimum log likelihood threshold. Sequences below this are implausible.
        If None, uses median as threshold.
    
    Returns
    -------
    dict with all results and metadata
    """
    start_time = time.time()
    
    if verbose >= 1:
        print("=" * 70)
        print("EXHAUSTIVE UTTERANCE SEQUENCE SEARCH")
        print("=" * 70)
        print(f"  Alpha: {alpha}")
        print(f"  Update internal: {update_internal}")
        print(f"  N_patients: {N_PATIENTS}, M_trials: {M_TRIALS}, N_rounds: {N_ROUNDS}")
        print(f"  Total sequences: {TOTAL_SEQUENCES:,}")
        print(f"  n_jobs: {n_jobs}")
        print(f"  Min log likelihood filter: {min_log_lik}")
        print("=" * 70)
    
    all_sequences = list(itertools.product(EXPERIMENT_UTTERANCES, repeat=N_ROUNDS))
    work_items = [(idx, seq, alpha, update_internal) for idx, seq in enumerate(all_sequences)]
    
    if verbose >= 1:
        print(f"\nEvaluating {len(work_items):,} sequences...")
    
    if verbose >= 1:
        results = Parallel(n_jobs=n_jobs, verbose=0)(
            delayed(evaluate_single_sequence)(item) 
            for item in tqdm(work_items, desc=f"α={alpha}")
        )
    else:
        results = Parallel(n_jobs=n_jobs, verbose=5)(
            delayed(evaluate_single_sequence)(item) for item in work_items
        )
    
    results.sort(key=lambda r: r['sequence_idx'])
    
    total_time = time.time() - start_time
    
    if verbose >= 1:
        print(f"\nCompleted in {total_time:.1f}s ({total_time/60:.1f} min)")
    
    # Create summary DataFrame
    summary_data = []
    for r in results:
        seq_str = ' → '.join([f"{q},{p}" for q, p in r['sequence_exp']])
        summary_data.append({
            'sequence_idx': r['sequence_idx'],
            'sequence': seq_str,
            'total_js_final': r['total_js_final'],
            'total_js_cumulative': r['total_js_cumulative'],
            'mean_theta_lit': r['mean_theta_literal_final'],
            'mean_theta_cred': r['mean_theta_credulous_final'],
            'mean_theta_vig': r['mean_theta_vigilant_final'],
            'theta_range': max(r['mean_theta_literal_final'], 
                              r['mean_theta_credulous_final'],
                              r['mean_theta_vigilant_final']) - 
                          min(r['mean_theta_literal_final'],
                              r['mean_theta_credulous_final'],
                              r['mean_theta_vigilant_final']),
            'final_vig_psi_persm': r['vigilant_psi_trajectory'][-1][0],
            'final_vig_psi_inf': r['vigilant_psi_trajectory'][-1][1],
            'final_vig_psi_persp': r['vigilant_psi_trajectory'][-1][2],
            # Speaker likelihoods (NEW)
            'log_lik_literal': r['log_lik_literal'],
            'log_lik_inf': r['log_lik_inf'],
            'log_lik_persp': r['log_lik_persp'],
            'log_lik_persm': r['log_lik_persm'],
            'max_log_lik': r['max_log_lik'],
        })
    
    summary_df = pd.DataFrame(summary_data)
    
    # Determine plausibility threshold
    if min_log_lik is None:
        min_log_lik = summary_df['max_log_lik'].median()
    
    summary_df['is_plausible'] = summary_df['max_log_lik'] >= min_log_lik
    n_plausible = summary_df['is_plausible'].sum()
    
    if verbose >= 1:
        print(f"\nPlausibility filter: {n_plausible:,} / {len(summary_df):,} sequences pass")
        print(f"  (threshold: log_lik >= {min_log_lik:.2f})")
    
    # Sort: plausible first, then by JS divergence
    summary_df = summary_df.sort_values(
        ['is_plausible', 'total_js_final'], 
        ascending=[False, False]
    )
    
    if verbose >= 1:
        print("\n" + "=" * 70)
        print("TOP 20 PLAUSIBLE SEQUENCES BY TOTAL JS DIVERGENCE")
        print("=" * 70)
        
        plausible_df = summary_df[summary_df['is_plausible']]
        
        for i, (_, row) in enumerate(plausible_df.head(20).iterrows()):
            print(f"\nRank {i+1}:")
            print(f"  Sequence: {row['sequence']}")
            print(f"  Total JS (final): {row['total_js_final']:.4f}")
            print(f"  θ means - Lit: {row['mean_theta_lit']:.3f}, "
                  f"Cred: {row['mean_theta_cred']:.3f}, "
                  f"Vig: {row['mean_theta_vig']:.3f}")
            print(f"  Log likelihoods - Lit: {row['log_lik_literal']:.2f}, "
                  f"Inf: {row['log_lik_inf']:.2f}, "
                  f"Pers+: {row['log_lik_persp']:.2f}, "
                  f"Pers-: {row['log_lik_persm']:.2f}")
            print(f"  Max log lik: {row['max_log_lik']:.2f}")
    
    output = {
        'results': results,
        'summary_df': summary_df,
        '_metadata': {
            'run_type': 'exhaustive_utterance_search',
            'n_patients': N_PATIENTS,
            'm_trials': M_TRIALS,
            'n_rounds': N_ROUNDS,
            'alpha': alpha,
            'update_internal': update_internal,
            'total_sequences': len(results),
            'n_plausible': int(n_plausible),
            'min_log_lik_threshold': float(min_log_lik),
            'timestamp': datetime.now().isoformat(),
            'total_time_seconds': total_time,
        }
    }
    
    return output


def run_multi_alpha_search(
    alpha_values: List[float],
    aggregation: str = 'min',
    update_internal: bool = False,
    n_jobs: int = -1,
    verbose: int = 1,
    min_log_lik: float = None,
) -> Dict:
    """
    Search across multiple alpha values with aggregation.
    """
    start_time = time.time()
    
    if verbose >= 1:
        print("=" * 70)
        print("MULTI-ALPHA EXHAUSTIVE SEARCH")
        print("=" * 70)
        print(f"  Alpha values: {alpha_values}")
        print(f"  Aggregation: {aggregation}")
        print("=" * 70)
    
    all_results = {}
    for alpha in alpha_values:
        if verbose >= 1:
            print(f"\n{'='*60}")
            print(f"Running search for α = {alpha}")
            print('='*60)
        
        output = run_exhaustive_search(
            alpha=alpha,
            update_internal=update_internal,
            n_jobs=n_jobs,
            verbose=verbose,
            min_log_lik=min_log_lik,
        )
        all_results[alpha] = output
    
    n_sequences = len(all_results[alpha_values[0]]['results'])
    
    aggregated_data = []
    for seq_idx in range(n_sequences):
        seq_results = {a: all_results[a]['results'][seq_idx] for a in alpha_values}
        seq_exp = seq_results[alpha_values[0]]['sequence_exp']
        
        js_finals = [seq_results[a]['total_js_final'] for a in alpha_values]
        max_log_liks = [seq_results[a]['max_log_lik'] for a in alpha_values]
        
        if aggregation == 'min':
            agg_js = min(js_finals)
            worst_alpha = alpha_values[np.argmin(js_finals)]
        elif aggregation == 'mean':
            agg_js = np.mean(js_finals)
            worst_alpha = None
        elif aggregation == 'max':
            agg_js = max(js_finals)
            worst_alpha = alpha_values[np.argmax(js_finals)]
        
        agg_max_log_lik = np.mean(max_log_liks)
        
        seq_str = ' → '.join([f"{q},{p}" for q, p in seq_exp])
        
        row = {
            'sequence_idx': seq_idx,
            'sequence': seq_str,
            'sequence_tuple': seq_exp,
            'agg_js_final': agg_js,
            'worst_alpha': worst_alpha,
            'agg_max_log_lik': agg_max_log_lik,
        }
        for a in alpha_values:
            row[f'js_final_alpha_{a}'] = seq_results[a]['total_js_final']
            row[f'max_log_lik_alpha_{a}'] = seq_results[a]['max_log_lik']
        
        aggregated_data.append(row)
    
    summary_df = pd.DataFrame(aggregated_data)
    
    if min_log_lik is None:
        min_log_lik = summary_df['agg_max_log_lik'].median()
    
    summary_df['is_plausible'] = summary_df['agg_max_log_lik'] >= min_log_lik
    
    summary_df = summary_df.sort_values(
        ['is_plausible', 'agg_js_final'], 
        ascending=[False, False]
    )
    
    total_time = time.time() - start_time
    n_plausible = summary_df['is_plausible'].sum()
    
    if verbose >= 1:
        print("\n" + "=" * 70)
        print(f"TOP 20 PLAUSIBLE SEQUENCES ({aggregation.upper()} across alphas)")
        print("=" * 70)
        
        plausible_df = summary_df[summary_df['is_plausible']]
        
        for i, (_, row) in enumerate(plausible_df.head(20).iterrows()):
            print(f"\nRank {i+1}:")
            print(f"  Sequence: {row['sequence']}")
            print(f"  Aggregated JS: {row['agg_js_final']:.4f}")
            print(f"  Agg max log lik: {row['agg_max_log_lik']:.2f}")
            if aggregation == 'min':
                print(f"  Worst alpha: {row['worst_alpha']}")
            for alpha in alpha_values:
                print(f"    α={alpha}: JS={row[f'js_final_alpha_{alpha}']:.4f}, "
                      f"log_lik={row[f'max_log_lik_alpha_{alpha}']:.2f}")
    
    output = {
        'all_results': all_results,
        'summary_df': summary_df,
        '_metadata': {
            'run_type': 'multi_alpha_exhaustive_search',
            'alpha_values': alpha_values,
            'aggregation': aggregation,
            'update_internal': update_internal,
            'total_sequences': n_sequences,
            'n_plausible': int(n_plausible),
            'min_log_lik_threshold': float(min_log_lik),
            'timestamp': datetime.now().isoformat(),
            'total_time_seconds': total_time,
        }
    }
    
    return output


# =============================================================================
# CLI INTERFACE
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Exhaustively search utterance sequences for listener differentiation.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Single alpha
  python run_exhaustive_search.py --alpha 4.0 --output results_alpha_4.0.pkl
  
  # Multi-alpha with minimax aggregation
  python run_exhaustive_search.py --alpha 2.0 4.0 8.0 --aggregation min --output results_multi.pkl
  
  # With custom likelihood threshold
  python run_exhaustive_search.py --alpha 4.0 --min-log-lik -20 --output results.pkl
        """
    )
    
    parser.add_argument("--alpha", type=float, nargs='+', required=True,
                        help="Alpha value(s) to test")
    parser.add_argument("--output", type=str, required=True,
                        help="Output pickle file path")
    parser.add_argument("--aggregation", type=str, default='min',
                        choices=['min', 'mean', 'max'],
                        help="Aggregation method for multi-alpha (default: min)")
    parser.add_argument("--update-internal", action='store_true',
                        help="Update internal speaker models")
    parser.add_argument("--n_jobs", type=int, default=-1,
                        help="Number of parallel workers (-1 for all cores)")
    parser.add_argument("--verbose", type=int, default=1,
                        help="Verbosity level")
    parser.add_argument("--min-log-lik", type=float, default=None,
                        help="Minimum log likelihood threshold for plausibility "
                             "(default: median across all sequences)")
    
    args = parser.parse_args()
    
    if len(args.alpha) == 1:
        output = run_exhaustive_search(
            alpha=args.alpha[0],
            update_internal=args.update_internal,
            n_jobs=args.n_jobs,
            verbose=args.verbose,
            min_log_lik=args.min_log_lik,
        )
    else:
        output = run_multi_alpha_search(
            alpha_values=args.alpha,
            aggregation=args.aggregation,
            update_internal=args.update_internal,
            n_jobs=args.n_jobs,
            verbose=args.verbose,
            min_log_lik=args.min_log_lik,
        )
    
    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else ".", exist_ok=True)
    
    with open(args.output, "wb") as f:
        pickle.dump(output, f)
    
    csv_path = args.output.replace('.pkl', '_summary.csv')
    output['summary_df'].to_csv(csv_path, index=False)
    
    if args.verbose >= 1:
        file_size_mb = os.path.getsize(args.output) / (1024 * 1024)
        print(f"\nSaved results to: {args.output} ({file_size_mb:.1f} MB)")
        print(f"Saved summary to: {csv_path}")


if __name__ == "__main__":
    main()
