"""
rsa_optimal_exp_sampling_fun.py

Two-stage simulation API for RSA experiments with parallel execution support.

Architecture
------------
Stage 1: sample_observation_sequences_multiT()
Stage 2: generate_utterances_for_observations_multiT()
"""

import numpy as np
import pandas as pd
import warnings
from typing import List, Tuple, Dict, Optional, Any, Union
from joblib import Parallel, delayed, cpu_count

from rsa_optimal_exp_core import (
    World, LiteralSpeaker, PragmaticSpeaker_obs, USE_PRECISE_LOGSPACE
)

np.seterr(divide='ignore', under='ignore')



# =============================================================================
# STAGE 1: OBSERVATION SAMPLING
# =============================================================================

def sample_observation_sequences_multiT(
    n: int,
    m: int,
    thetas: Union[List[float], np.ndarray],
    Ts: Union[List[int], np.ndarray],
    n_obs_seq: int,
    random_seed: Optional[int] = None,
    theta_values: Optional[np.ndarray] = None,
    compute_obs_likelihood: str = "none"
) -> Dict[str, Any]:
    """
    Sample observation sequences and compute likelihoods for multiple sequence lengths.

    Parameters
    ----------
    n : int
        Number of independent experiments in the World.
    m : int
        Number of Bernoulli trials per experiment.
    thetas : List[float] or np.ndarray
        List of theta values to simulate. Each must be in the World's theta_values.
    Ts : List[int] or np.ndarray
        List of sequence lengths to compute likelihoods for.
        Observations are sampled with length max(Ts).
        Likelihoods are computed for each T using obs_seq[:T].
    n_obs_seq : int
        Number of observation sequences per theta.
    random_seed : Optional[int], default None
        Base random seed for reproducibility.
        The same seed is used for all thetas (sequences differ due to different
        theta parameters, not different seeds).
    theta_values : Optional[np.ndarray], default None
        Custom theta grid for the World. If None, uses World's default [0, 0.1, ..., 1].
    compute_obs_likelihood : str, default "none"
        Whether to compute observation sequence log-likelihoods:
        - "none": Don't compute likelihoods
        - "true": Compute log P(obs_seq[:T] | true_theta) for each T
                  (optimized: only loads single column from likelihood table)
        - "all": Compute log P(obs_seq[:T] | theta) for all thetas and each T,
                 plus MLE theta for each T
    
    Returns
    -------
    Dict[str, Any]
        Dictionary containing:
        
        - "world": World
            The World object (reusable for utterance generation)
        
        - "config": Dict
            Configuration parameters used:
            {
                "n": int,
                "m": int,
                "thetas": List[float],
                "Ts": List[int],
                "max_T": int,
                "n_obs_seq": int,
                "random_seed": Optional[int],
                "compute_obs_likelihood": str
            }
        
        - "observations": Dict[float, List[Dict]]
            Mapping from theta -> list of observation data.
            Each observation data dict contains:
            {
                "obs_idx": int,
                "obs_seq": List[Tuple[int, ...]],   # Full sequence (length max_T)
                "obs_run_seed": int, # run_seed output from world.sample_multiple_runs()
                "theta": float,
                "log_lik_true_theta": Optional[Dict[int, float]],
                    # {T: log P(obs_seq[:T] | true_theta)} for each T in Ts
                    # None if compute_obs_likelihood == "none"
                "log_lik_all_theta": Optional[Dict[int, np.ndarray]],
                    # {T: array of log P(obs_seq[:T] | theta) for all thetas}
                    # None if compute_obs_likelihood != "all"
                "mle_theta": Optional[Dict[int, float]],
                    # {T: argmax_theta P(obs_seq[:T] | theta)} for each T
                    # None if compute_obs_likelihood != "all"
                "utterances": None
                    # Placeholder for utterance generation (to be filled by Stage 2)
            }
    
    Raises
    ------
    ValueError
        If parameters are invalid or theta values not in World's theta_values.
    RuntimeError
        If World creation or observation sampling fails.
    
    Examples
    --------
    >>> # Sample observations and compute likelihoods for T=5, 10, 15, 20
    >>> obs_data = sample_observation_sequences_multiT(
    ...     n=3, m=2,
    ...     thetas=[0.3, 0.5, 0.7],
    ...     Ts=[5, 10, 15, 20],
    ...     n_obs_seq=50,
    ...     random_seed=42,
    ...     compute_obs_likelihood="all"
    ... )
    
    >>> # Access likelihood at T=10 for first observation of theta=0.5
    >>> obs_info = obs_data["observations"][0.5][0]
    >>> log_lik_T10 = obs_info["log_lik_true_theta"][10]
    >>> mle_T10 = obs_info["mle_theta"][10]
    
    >>> # Compare MLE accuracy across different T values
    >>> for T in obs_data["config"]["Ts"]:
    ...     mle_errors = [
    ...         abs(obs["mle_theta"][T] - obs["theta"])
    ...         for obs in obs_data["observations"][0.5]
    ...     ]
    ...     print(f"T={T}: mean MLE error = {np.mean(mle_errors):.3f}")
    """
    
    # =========================================================================
    # INPUT VALIDATION
    # =========================================================================
    
    if not isinstance(n, int) or n < 1:
        raise ValueError("n must be a positive integer")
    if not isinstance(m, int) or m < 1:
        raise ValueError("m must be a positive integer")
    if not isinstance(n_obs_seq, int) or n_obs_seq < 1:
        raise ValueError("n_obs_seq must be a positive integer")
    if compute_obs_likelihood not in ["none", "true", "all"]:
        raise ValueError("compute_obs_likelihood must be 'none', 'true', or 'all'")
    
    # Process thetas to list
    thetas = list(thetas) if isinstance(thetas, np.ndarray) else list(thetas)
    if len(thetas) == 0:
        raise ValueError("thetas cannot be empty")
    
    # Process Ts to sorted list
    Ts = list(Ts) if isinstance(Ts, np.ndarray) else list(Ts)
    if len(Ts) == 0:
        raise ValueError("Ts cannot be empty")
    
    # Validate all Ts are positive integers
    for T in Ts:
        if not isinstance(T, (int, np.integer)) or T < 1:
            raise ValueError(f"All values in Ts must be positive integers, got {T}")
    
    # Sort and deduplicate Ts
    Ts = sorted(set(int(T) for T in Ts))
    max_T = max(Ts)
    
    # =========================================================================
    # CREATE WORLD
    # =========================================================================
    
    try:
        world = World(n=n, m=m, theta_values=theta_values)
    except Exception as e:
        raise RuntimeError(f"Failed to create World: {e}")
    
    # Validate thetas against World's theta_values
    for theta in thetas:
        closest = world.theta_values[np.abs(world.theta_values - theta).argmin()]
        if not np.isclose(theta, closest, rtol=1e-10, atol=1e-10):
            raise ValueError(
                f"theta {theta} not in World's theta_values. "
                f"Closest: {closest}. Available: {list(world.theta_values)}"
            )
    
    # =========================================================================
    # SAMPLE OBSERVATIONS FOR EACH THETA
    # =========================================================================
    
    observations = {}
    n_theta_vals = len(world.theta_values)
    
    for theta in thetas:
        
        # Sample observation sequences of length max_T
        try:
            obs_df = world.sample_multiple_runs(
                theta=theta,
                n_run=n_obs_seq,
                n_round=max_T,
                base_seed=random_seed
            )
        except Exception as e:
            raise RuntimeError(f"Failed to sample observations for theta={theta}: {e}")
        
        # -----------------------------------------------------------------
        # EXTRACT OBSERVATION SEQUENCES (VECTORIZED VIA GROUPBY)
        # -----------------------------------------------------------------
        
        out = (
            obs_df
            .sort_values(["run_id", "round_index"])
            .groupby("run_id", sort=True)
            .agg(
                obs_seq=("observation", list), # Note: source column is "observation"
                obs_run_seed=("run_seed", "first")  # Note: source column is "run_seed"
            )
        )
        
        obs_seqs = out["obs_seq"].tolist()
        obs_run_seeds = out["obs_run_seed"].tolist()
        
        # -----------------------------------------------------------------
        # BUILD OBSERVATION RECORDS
        # -----------------------------------------------------------------
        
        obs_list = [
            {
                "obs_idx": obs_idx,
                "obs_seq": obs_seqs[obs_idx],
                "obs_run_seed": obs_run_seeds[obs_idx],
                "theta": theta,
                "log_lik_true_theta": None,
                "log_lik_all_theta": None,
                "mle_theta": None,
                "utterances": {}
            }
            for obs_idx in range(n_obs_seq)
        ]
        
        # -----------------------------------------------------------------
        # COMPUTE OBSERVATION LIKELIHOODS FOR ALL Ts
        # -----------------------------------------------------------------
        
        if compute_obs_likelihood != "none":
            
            # Flatten all observations for batch lookup
            # obs_seqs is List[List[Tuple]], flatten to List[Tuple]
            # Shape after flatten: (n_obs_seq * max_T,)
            all_obs_flat = [obs for seq in obs_seqs for obs in seq]
            all_obs_keys = [tuple(obs) if not isinstance(obs, tuple) else obs 
                          for obs in all_obs_flat]
            
            # Find column index for true theta (needed for both modes)
            theta_col_idx = np.where(np.isclose(world.theta_values, theta))[0][0]
            true_theta_val = world.theta_values[theta_col_idx]
            
            if compute_obs_likelihood == "true":
                
                # Select ONLY the column for true theta
                # Shape: (n_obs_seq * max_T,)
                log_probs_flat_true = world.obs_log_likelihood_theta.loc[
                    all_obs_keys, true_theta_val
                ].values
                
                # Reshape to (n_obs_seq, max_T)
                log_probs_2d = log_probs_flat_true.reshape(n_obs_seq, max_T)
                
                # Cumulative sum over T dimension (axis=1)
                # cumsum_log_probs[i, t] = log P(O_0, ..., O_t | true_theta)
                # Shape: (n_obs_seq, max_T)
                cumsum_log_probs_true = np.cumsum(log_probs_2d, axis=1)
                
                # Extract likelihoods for each T (vectorized)
                # T is 1-indexed, so T-1 gives 0-based array index
                log_lik_true_all = {
                    T: cumsum_log_probs_true[:, T - 1] for T in Ts
                }
                
                # Distribute results to observation records
                for i in range(n_obs_seq):
                    obs_list[i]["log_lik_true_theta"] = {
                        T: float(log_lik_true_all[T][i]) for T in Ts
                    }
                    # log_lik_all_theta and mle_theta remain None
            
            else:  # compute_obs_likelihood == "all"
                
                # Load full matrix
                # Shape: (n_obs_seq * max_T, n_theta_vals)
                log_probs_flat = world.obs_log_likelihood_theta.loc[all_obs_keys].values
                
                # Reshape to (n_obs_seq, max_T, n_theta_vals)
                log_probs_3d = log_probs_flat.reshape(n_obs_seq, max_T, n_theta_vals)
                
                # Cumulative sum over T dimension (axis=1)
                # cumsum_log_probs[i, t, :] = log P(O_0, ..., O_t | all thetas)
                # Shape: (n_obs_seq, max_T, n_theta_vals)
                cumsum_log_probs = np.cumsum(log_probs_3d, axis=1)
                
                # Storage for vectorized results
                log_lik_true_all = {}   # {T: shape (n_obs_seq,)}
                log_lik_all_all = {}    # {T: shape (n_obs_seq, n_theta_vals)}
                mle_all = {}            # {T: shape (n_obs_seq,)}
                
                for T in Ts:
                    # Extract likelihoods at position T-1 for all obs_seqs
                    # Shape: (n_obs_seq, n_theta_vals)
                    log_liks_at_T = cumsum_log_probs[:, T - 1, :]
                    
                    # True theta likelihood
                    log_lik_true_all[T] = log_liks_at_T[:, theta_col_idx]
                    
                    # Full likelihood array
                    log_lik_all_all[T] = log_liks_at_T
                    
                    # MLE theta: argmax across theta dimension
                    mle_indices = np.argmax(log_liks_at_T, axis=1)
                    mle_all[T] = world.theta_values[mle_indices]
                
                # Distribute results to observation records
                for i in range(n_obs_seq):
                    obs_list[i]["log_lik_true_theta"] = {
                        T: float(log_lik_true_all[T][i]) for T in Ts
                    }
                    obs_list[i]["log_lik_all_theta"] = {
                        T: log_lik_all_all[T][i].copy() for T in Ts
                    }
                    obs_list[i]["mle_theta"] = {
                        T: float(mle_all[T][i]) for T in Ts
                    }
        
        # Store observations for this theta
        observations[theta] = obs_list
    
    # =========================================================================
    # RETURN RESULT
    # =========================================================================
    
    return {
        "world": world,
        "config": {
            "n": n,
            "m": m,
            "thetas": thetas,
            "Ts": Ts,
            "max_T": max_T,
            "n_obs_seq": n_obs_seq,
            "random_seed": random_seed,
            "compute_obs_likelihood": compute_obs_likelihood
        },
        "observations": observations
    }



# =============================================================================
# STAGE 2: UTTERANCE GENERATION
# =============================================================================

def generate_utterances_for_observations_multiT(
    obs_data: Dict[str, Any],
    speaker_config: Dict[str, Any],
    n_utt_seq: int,
    n_jobs: int = 1,
    backend: str = "loky",
    verbose: int = 0
) -> None:
    """
    Generate utterance sequences for pre-sampled observations (in-place).
    
    Mutates obs_data by filling in the 'utterances' field for each observation.
    
    Parameters
    ----------
    obs_data : Dict[str, Any]
        Output from sample_observation_sequences_multiT(). Will be mutated.
    speaker_config : Dict[str, Any]
        Speaker configuration (see _generate_utterances_for_single_obs_seq_multiT).
    n_utt_seq : int
        Number of utterance sequences per observation sequence.
        Must be <= 10000 to avoid seed collisions.
    n_jobs : int, default 1
        Number of parallel jobs (-1 for all cores).
    backend : str, default "loky"
        Joblib backend.
    verbose : int, default 0
        Verbosity level.
    
    Returns
    -------
    None
        Mutates obs_data IN PLACE.
    
    Notes
    -----
    Storage structure:
        obs_data["observations"][theta][obs_idx]["utterances"][speaker_key][alpha_key]
        
    Speaker keys: "literal", "inf_T", "inf_F", "persp_T", "persp_F", "persm_T", "persm_F"
    Alpha keys: 0.0 (literal), float (pragmatic), or "determ"


    Raises
    ------
    ValueError
        If utterances already exist for the given speaker/alpha combination.
    """
    
    # INPUT VALIDATION
    
    if not isinstance(n_utt_seq, int) or n_utt_seq < 1:
        raise ValueError("n_utt_seq must be a positive integer")
    
    # EXTRACT FROM obs_data
    
    world = obs_data["world"]
    config = obs_data["config"]
    Ts = config["Ts"]
    thetas = config["thetas"]
    random_seed = config["random_seed"]
    
    # DETERMINE SPEAKER KEY AND ALPHA KEY
    
    speaker_type = speaker_config["speaker_type"]
    
    if speaker_type == "literal":
        speaker_key = "literal"
        alpha_key = 0.0
    else:
        psi = speaker_config["psi"]
        update_internal = speaker_config["update_internal"]
        alpha = speaker_config["alpha"]
        
        psi_prefix = {"inf": "inf", "pers+": "persp", "pers-": "persm"}[psi]
        speaker_key = f"{psi_prefix}_{'T' if update_internal else 'F'}"
        alpha_key = alpha if alpha == "determ" else float(alpha)

    # CHECK FOR DUPLICATE GENERATION
    
    # Check first observation (all will have same structure)
    first_obs = obs_data["observations"][thetas[0]][0]
    if (first_obs["utterances"] is not None and
        speaker_key in first_obs["utterances"] and
        alpha_key in first_obs["utterances"][speaker_key]):
        
        delete_code = (
            f"for theta in obs_data['observations']:\n"
            f"    for obs in obs_data['observations'][theta]:\n"
            f"        if obs['utterances'] and '{speaker_key}' in obs['utterances']:\n"
            f"            obs['utterances']['{speaker_key}'].pop({alpha_key!r}, None)"
        )
        
        raise ValueError(
            f"Utterances already exist for speaker_key='{speaker_key}', alpha_key={alpha_key!r}.\n"
            f"To regenerate, first delete existing entries:\n\n{delete_code}"
        )
    
    # BUILD TASK LIST
    
    tasks = []
    for theta in thetas:
        for obs_info in obs_data["observations"][theta]:
            tasks.append({
                "theta": theta,
                "obs_idx": obs_info["obs_idx"],
                "obs_seq": obs_info["obs_seq"]
            })
    
    # Assign seeds based on task index
    for task_idx, task in enumerate(tasks):
        task["base_seed"] = (random_seed + task_idx * 10_000 
                            if random_seed is not None else None)
    
    # VERBOSE OUTPUT
    
    if verbose > 0:
        n_workers = (cpu_count() if n_jobs == -1 
                    else max(1, cpu_count() + 1 + n_jobs) if n_jobs < 0 
                    else max(1, n_jobs))
        print(f"Generating utterances: {len(tasks)} obs_seq × {n_utt_seq} utt_seq")
        print(f"  Speaker: {speaker_key}, alpha: {alpha_key}, Ts: {Ts}")
        print(f"  Workers: {n_workers}")
    
    # EXECUTE TASKS
    
    def run_task(task):
        return _generate_utterances_for_single_obs_seq_multiT(
            obs_seq=task["obs_seq"],
            world=world,
            speaker_config=speaker_config,
            n_utt_seq=n_utt_seq,
            Ts=Ts,
            base_seed=task["base_seed"]
        )
    
    if n_jobs == 1:
        results = [run_task(task) for task in tasks]
    else:
        results = Parallel(n_jobs=n_jobs, backend=backend, verbose=verbose)(
            delayed(run_task)(task) for task in tasks
        )
    
    # STORE RESULTS (in-place mutation of obs_data)
    
    for task, utt_records in zip(tasks, results):
        theta = task["theta"]
        obs_idx = task["obs_idx"]
        
        obs_dict = obs_data["observations"][theta][obs_idx]
        
        # Handle explicit None (from sample_observation_sequences_multiT)
        if obs_dict["utterances"] is None:
            obs_dict["utterances"] = {}
        
        obs_dict["utterances"].setdefault(speaker_key, {})[alpha_key] = utt_records



def _generate_utterances_for_single_obs_seq_multiT(
    obs_seq: List[Tuple[int, ...]],
    world: World,
    speaker_config: Dict[str, Any],
    n_utt_seq: int,
    Ts: List[int],
    base_seed: Optional[int]
) -> List[Dict[str, Any]]:
    """
    Generate utterance sequences for a single observation sequence.
    
    This is the core worker function for utterance generation. It creates a 
    fresh speaker for each utterance sequence and computes cumulative 
    log-likelihoods for each T in Ts.
    
    Parameters
    ----------
    obs_seq : List[Tuple[int, ...]]
        The observation sequence (length max_T).
    world : World
        The World object (used to create speaker instances).
    speaker_config : Dict[str, Any]
        Complete speaker configuration containing:
        - speaker_type: "literal" or "pragmatic"
        For pragmatic speakers:
        - omega: "coop" or "strat"
        - psi: "inf", "pers+", or "pers-"
        - alpha: float or "determ"
        - update_internal: bool
        - beta: float (default 0.0)
        - initial_beliefs_theta: Optional[np.ndarray]
    n_utt_seq : int
        Number of utterance sequences to generate.
    Ts : List[int]
        List of sequence lengths to compute log-likelihoods for.
        All values must satisfy 1 <= T <= len(obs_seq).
    base_seed : Optional[int]
        Base seed for reproducibility. Each utterance sequence uses
        seed = base_seed + utt_idx. If None, no seeding.
    
    Returns
    -------
    List[Dict[str, Any]]
        List of n_utt_seq records, each containing:
        - utt_idx: int
            Index of this utterance sequence (0 to n_utt_seq-1)
        - utt_seq: List[str]
            The generated utterance sequence (same length as obs_seq)
        - utt_seed: Optional[int]
            The random seed used (for reproducibility)
        - log_lik_true_speaker: Dict[int, float]
            {T: log P(utt[:T] | obs[:T], speaker)} for each T in Ts
        - log_lik_all_speaker: None
            Placeholder for later analysis
    
    Raises
    ------
    ValueError
        If any T in Ts is outside the valid range [1, len(obs_seq)].
    
    Notes
    -----
    - A fresh speaker is created for each utterance sequence to ensure
      independence (speakers have internal state that evolves).
    
    - For pragmatic speakers with update_internal=True, the probability
      table changes after each utterance. We capture log P(u_t | O_t)
      BEFORE the update to correctly compute the likelihood.
    
    - Log-likelihood computation:
      log P(utt[:T] | obs[:T]) = sum_{t=0}^{T-1} log P(u_t | O_t, state_t)
    
    Examples
    --------
    >>> world = World(n=3, m=2)
    >>> obs_seq = [(1, 1, 1), (0, 2, 1), (0, 0, 3), (1, 2, 0)]
    >>> config = {
    ...     "speaker_type": "pragmatic",
    ...     "omega": "coop",
    ...     "psi": "inf",
    ...     "alpha": 5.0,
    ...     "update_internal": True,
    ...     "beta": 0.0
    ... }
    >>> records = _generate_utterances_for_single_obs_seq_multiT(
    ...     obs_seq=obs_seq,
    ...     world=world,
    ...     speaker_config=config,
    ...     n_utt_seq=3,
    ...     Ts=[2, 4],
    ...     base_seed=42
    ... )
    >>> len(records)
    3
    >>> records[0]["log_lik_true_speaker"]
    {2: -1.85, 4: -3.72}
    """
    
    # VALIDATE Ts AGAINST SEQUENCE LENGTH
    
    max_T = len(obs_seq)
    
    # Check both bounds: T < 1 causes wrong indexing (T-1 = -1 → last element)
    #                    T > max_T causes IndexError
    invalid_Ts = [T for T in Ts if T < 1 or T > max_T]
    if invalid_Ts:
        raise ValueError(
            f"All T in Ts must satisfy 1 <= T <= len(obs_seq) ({max_T}). "
            f"Invalid values: {invalid_Ts}"
        )
    
    # GENERATE UTTERANCES
    
    utt_records = []
    is_literal = speaker_config["speaker_type"] == "literal"
    
    for utt_idx in range(n_utt_seq):
        
        # SEED MANAGEMENT
        utt_seed = (base_seed + utt_idx) if base_seed is not None else None
        
        if utt_seed is not None:
            np.random.seed(utt_seed)
        
        # CREATE FRESH SPEAKER
        if is_literal:
            speaker = LiteralSpeaker(
                world=world,
                initial_beliefs_theta=speaker_config.get("initial_beliefs_theta"),
                
            )
        else:
            speaker = PragmaticSpeaker_obs(
                world=world,
                omega=speaker_config["omega"],
                psi=speaker_config["psi"],
                update_internal=speaker_config["update_internal"],
                alpha=speaker_config["alpha"],
                beta=speaker_config.get("beta", 0.0),
                initial_beliefs_theta=speaker_config.get("initial_beliefs_theta")
            )
        
        # GENERATE UTTERANCES WITH PER-STEP LOG PROBABILITIES
        utt_seq = []
        log_probs_per_step = []
        
        for obs in obs_seq:
            obs_key = tuple(obs) if not isinstance(obs, tuple) else obs
            
            # Capture log probs BEFORE speaking (for update_internal=True)
            log_probs_for_obs = speaker.utterance_log_prob_obs[obs_key].copy()
            
            # Generate utterance
            utt = speaker.update_and_speak(obs)
            utt_seq.append(utt)
            
            # Look up log probability of chosen utterance
            log_p = float(log_probs_for_obs.loc[utt])
            
            # Handle impossible utterances
            if not np.isfinite(log_p):
                log_p = -np.inf
            
            log_probs_per_step.append(log_p)
        
        # COMPUTE CUMULATIVE LOG-LIKELIHOODS FOR EACH T
        log_probs_array = np.array(log_probs_per_step)
        cumsum_log_probs = np.cumsum(log_probs_array)
        
        # Extract for each T (T is 1-indexed, array is 0-indexed)
        # Note: Ts validation above ensures T >= 1, so T-1 >= 0
        log_lik_true_speaker = {
            T: float(cumsum_log_probs[T - 1])
            for T in Ts
        }
        
        # STORE RECORD
        utt_records.append({
            "utt_idx": utt_idx,
            "utt_seq": utt_seq,
            "utt_seed": utt_seed,
            "log_lik_true_speaker": log_lik_true_speaker,
            "log_lik_all_speaker": None
        })
    
    return utt_records


