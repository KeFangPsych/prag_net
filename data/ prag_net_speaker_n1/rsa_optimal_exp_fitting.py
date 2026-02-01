"""
rsa_optimal_exp_fitting.py

Fitting functions for the RSA optimal experiment model.
"""

import warnings
import itertools
import numpy as np
from typing import List, Dict, Union, Optional, Tuple, TypeVar, Iterator, Callable, Any, Literal
from joblib import Parallel, delayed, cpu_count
from scipy.special import logsumexp
from scipy.optimize import minimize_scalar

from rsa_optimal_exp_core import (
    World, LiteralSpeaker, PragmaticSpeaker_obs, USE_PRECISE_LOGSPACE
)

np.seterr(divide='ignore', under='ignore')

# =============================================================
# Helper functions
# ==============================================================

def log_likelihood_utt_seq(
    world: World,
    obs_seq: List[Tuple[int, ...]],
    utt_seq: List[str],
    speaker_config: Dict[str, Any]
) -> float:
    """
    Compute log p(utt_seq | obs_seq, speaker_config).

    Parameters
    ----------
    world : World
        The World object defining the communication game.
    obs_seq : List[Tuple[int, ...]]
        Sequence of observations O_1, ..., O_T.
    utt_seq : List[str]
        Sequence of utterances u_1, ..., u_T.
    speaker_config : Dict[str, Any]
        Speaker configuration with keys:
        - speaker_type : str
            "literal" or "pragmatic" (required)
        - omega : str
            "coop" or "strat" (pragmatic only, required)
        - psi : str
            "inf", "pers+", or "pers-" (pragmatic only, required)
        - alpha : float or str
            Softmax temperature or "determ" (pragmatic only, required)
        - update_internal : bool
            Whether to update internal listener (pragmatic only, required)
        - beta : float or None
            Weight on informativeness vs persuasiveness (pragmatic only, default 0.0)
            beta=0: pure persuasion, beta=1: pure informativeness
            Only used when psi is "pers+" or "pers-"
        - initial_beliefs_theta : np.ndarray or None
            Initial prior over theta (default None = uniform)

    Returns
    -------
    float
        Log-likelihood of the utterance sequence under the speaker model.
    """
    if len(obs_seq) == 0:
        raise ValueError("obs_seq is empty.")
        
    if len(obs_seq) != len(utt_seq):
        raise ValueError("obs_seq and utt_seq must have the same length.")

    # Extract config
    speaker_type = speaker_config["speaker_type"]
    initial_beliefs = speaker_config.get("initial_beliefs_theta")  # default None

    # Initialize speaker based on type
    if speaker_type == "literal":
        speaker = LiteralSpeaker(world, initial_beliefs)
        update_internal = False  # Literal speaker P(u|O) is static
        
    elif speaker_type == "pragmatic":
        # Required parameters (no defaults in original class)
        omega = speaker_config["omega"]
        psi = speaker_config["psi"]
        alpha = speaker_config["alpha"]
        update_internal_cfg = speaker_config["update_internal"]
        
        # Optional parameter (has default in original class)
        beta = speaker_config.get("beta")
        
        speaker = PragmaticSpeaker_obs(
            world=world,
            omega=omega,
            psi=psi,
            update_internal=update_internal_cfg,
            alpha=alpha,
            beta=beta if beta is not None else 0.0,
            initial_beliefs_theta=initial_beliefs
        )
        update_internal = speaker.update_internal
    else:
        raise ValueError(f"speaker_type must be 'literal' or 'pragmatic', got '{speaker_type}'")

    # Compute log-likelihood
    log_lik = 0.0
    
    for obs, utt in zip(obs_seq, utt_seq):
        obs_key = tuple(obs) if not isinstance(obs, tuple) else obs
        
        # Validate
        if obs_key not in world.observations:
            raise ValueError(f"Observation {obs_key} not supported by the world.")
        if utt not in world.utterances:
            raise ValueError(f"Utterance '{utt}' not in world.utterances")

        # Get log P(u | O)
        log_p = speaker.utterance_log_prob_obs.at[utt, obs_key]
        
        if not np.isfinite(log_p):
            return -np.inf
        
        log_lik += float(log_p)

        # Update state for pragmatic speaker if configured
        if speaker_type == "pragmatic" and update_internal:
            speaker.literal_listener.listen_and_update(utt)
            speaker.utterance_log_prob_obs = speaker._compute_utterance_log_prob_obs(speaker.alpha)

    return log_lik



def log_likelihood_alpha_opt_utt_seq(
    world: 'World',
    obs_seq: List[Tuple[int, ...]],
    utt_seq: List[str],
    speaker_config: Dict[str, Any],
    alpha_bounds: Tuple[float, float] = (0.001, 50.0),
    method: str = "bounded",
    include_determ: bool = True,
    grid_search: bool = False,
    grid_points: int = 100,
    grid_spacing: str = "log"  
) -> Dict[str, Any]:
    """
    Find the optimal alpha that maximizes log-likelihood of an utterance sequence.
    
    This function optimizes over the softmax parameter alpha to find
    the value that makes the observed utterance sequence most probable under the
    specified speaker model. 
    
    Parameters
    ----------
    world : World
        The World object defining the communication game.
    obs_seq : List[Tuple[int, ...]]
        Sequence of observations O_1, ..., O_T.
    utt_seq : List[str]
        Sequence of utterances u_1, ..., u_T.
    speaker_config : Dict[str, Any]
        Speaker configuration. Must include:
        - speaker_type : str ("literal" or "pragmatic")
        For pragmatic speakers, must also include:
        - omega : str ("coop" or "strat")
        - psi : str ("inf", "pers+", or "pers-")
        - update_internal : bool
        Optional:
        - beta : float (default 0.0)
        - initial_beliefs_theta : np.ndarray or None (default None)
        Note: 'alpha' in speaker_config is ignored; it will be optimized.
    alpha_bounds : Tuple[float, float], default (0.001, 50.0)
        Lower and upper bounds for continuous alpha optimization.
        Lower bound should be > 0 to avoid numerical issues.
    method : str, default "bounded"
        Optimization method passed to scipy.optimize.minimize_scalar.
        "bounded" is recommended for bounded optimization.
    include_determ : bool, default True
        Whether to also evaluate alpha="determ" (hard argmax) and compare
        against the continuous optimum.
    grid_search : bool, default False
        If True, use grid search instead of scipy optimization.
        Grid search is more robust but slower for fine-grained search.
    grid_points : int, default 100
        Number of alpha values to evaluate when grid_search=True.
    grid_spacing : str, default "log"
        Spacing method for grid search. Options:
        - "log": Logarithmic spacing (recommended). Places more points at lower
          alpha values where the likelihood function typically changes more rapidly.
        - "linear": Linear spacing. Evenly spaced points across the range.
        
        Logarithmic spacing is generally preferred because the softmax function's
        behavior changes roughly logarithmically with alpha.
    
    Returns
    -------
    Dict[str, Any]
        Dictionary containing:
        - optimal_alpha : float or str or None
            The overall best alpha (could be float or "determ").
            None for literal speakers.
        - max_log_likelihood : float
            Log-likelihood at the optimal alpha.
        - continuous_optimal_alpha : float or None
            Best alpha from continuous optimization only.
        - continuous_max_log_likelihood : float or None
            Log-likelihood at the continuous optimum.
        - determ_log_likelihood : float or None
            Log-likelihood when alpha="determ" (if include_determ=True).
        - optimization_result : scipy.optimize.OptimizeResult or None
            Full scipy result object (if grid_search=False).
        - grid_results : Dict or None
            Grid search details (if grid_search=True), containing:
            - alphas: array of tested alpha values
            - log_likelihoods: array of corresponding log-likelihoods
            - best_idx: index of best alpha
            - grid_spacing: spacing method used
        - message : str (only for literal speakers)
            Explanation that alpha is not applicable.
    
    Raises
    ------
    ValueError
        If obs_seq is empty, lengths don't match, speaker_type is invalid,
        or required pragmatic speaker keys are missing.
    RuntimeError
        If optimization fails unexpectedly.
    """
    
    # --- Validation (add new parameter validation) ---
    if grid_spacing not in {"log", "linear"}:
        raise ValueError(
            f"grid_spacing must be 'log' or 'linear', got '{grid_spacing}'"
        )
    
    # --- [Previous validation code unchanged] ---
    if len(obs_seq) == 0:
        raise ValueError("obs_seq is empty.")
    if len(obs_seq) != len(utt_seq):
        raise ValueError("obs_seq and utt_seq must have the same length.")
    
    speaker_type = speaker_config.get("speaker_type")
    
    # --- Handle literal speaker ---
    if speaker_type == "literal":
        ll = log_likelihood_utt_seq(world, obs_seq, utt_seq, speaker_config)
        return {
            "optimal_alpha": None,
            "max_log_likelihood": ll,
            "continuous_optimal_alpha": None,
            "continuous_max_log_likelihood": None,
            "determ_log_likelihood": None,
            "optimization_result": None,
            "grid_results": None,
            "message": "Literal speaker does not use alpha parameter"
        }
    elif speaker_type != "pragmatic":
        raise ValueError(
            f"speaker_type must be 'literal' or 'pragmatic', got '{speaker_type}'"
        )
    
    # --- Validate pragmatic speaker config ---
    required_keys = ["omega", "psi", "update_internal"]
    missing_keys = [k for k in required_keys if k not in speaker_config]
    if missing_keys:
        raise ValueError(
            f"Missing required keys for pragmatic speaker: {missing_keys}"
        )
    
    # --- Create base config ---
    base_config = {
        "speaker_type": "pragmatic",
        "omega": speaker_config["omega"],
        "psi": speaker_config["psi"],
        "update_internal": speaker_config["update_internal"],
        "beta": speaker_config.get("beta", 0.0),
        "initial_beliefs_theta": speaker_config.get("initial_beliefs_theta", None)
    }
    
    # --- Define objective function ---
    def neg_log_likelihood(alpha: float) -> float:
        config = {**base_config, "alpha": float(alpha)}
        try:
            ll = log_likelihood_utt_seq(world, obs_seq, utt_seq, config)
        except Exception as e:
            warnings.warn(f"Error at alpha={alpha}: {e}")
            return np.inf
        if ll == -np.inf:
            return np.inf
        return -ll
    
    # --- Run optimization ---
    if grid_search:
        # IMPROVED: Create alpha grid with specified spacing
        a_min, a_max = alpha_bounds
        
        if grid_spacing == "log":
            # Logarithmic spacing: more points at lower alpha values
            alphas = list(np.exp(np.linspace(np.log(a_min), np.log(a_max), grid_points)))
        else:  # linear
            # Linear spacing: evenly distributed points
            alphas = list(np.linspace(a_min, a_max, grid_points))
        
        # Evaluate log-likelihood at each alpha
        log_likelihoods = []
        for alpha in alphas:
            ll = -neg_log_likelihood(alpha)
            log_likelihoods.append(ll)
        
        log_likelihoods = np.array(log_likelihoods)
        best_idx = np.argmax(log_likelihoods)
        optimal_alpha_continuous = alphas[best_idx]
        max_ll_continuous = log_likelihoods[best_idx]
        
        grid_results = {
            "alphas": np.array(alphas),
            "log_likelihoods": log_likelihoods,
            "best_idx": best_idx,
            "grid_spacing": grid_spacing  # Include spacing method in results
        }
        optimization_result = None
        
    else:
        # Scipy optimization approach 
        try:
            result = minimize_scalar(
                neg_log_likelihood,
                bounds=alpha_bounds,
                method=method
            )
            if not result.success:
                warnings.warn(
                    f"Optimization may not have converged: {result.message}"
                )
            optimal_alpha_continuous = result.x
            max_ll_continuous = -result.fun if np.isfinite(result.fun) else -np.inf
            optimization_result = result
        except Exception as e:
            raise RuntimeError(f"Optimization failed: {e}")
        
        grid_results = None
    
    # --- Evaluate deterministic alpha ---
    determ_ll = None
    if include_determ:
        config_determ = {**base_config, "alpha": "determ"}
        try:
            determ_ll = log_likelihood_utt_seq(world, obs_seq, utt_seq, config_determ)
        except Exception as e:
            warnings.warn(f"Failed to evaluate alpha='determ': {e}")
            determ_ll = -np.inf
    
    # --- Determine overall best alpha ---
    if include_determ and determ_ll is not None and determ_ll > max_ll_continuous:
        optimal_alpha = "determ"
        max_ll = determ_ll
    else:
        optimal_alpha = optimal_alpha_continuous
        max_ll = max_ll_continuous
    
    return {
        "optimal_alpha": optimal_alpha,
        "max_log_likelihood": max_ll,
        "continuous_optimal_alpha": optimal_alpha_continuous,
        "continuous_max_log_likelihood": max_ll_continuous,
        "determ_log_likelihood": determ_ll,
        "optimization_result": optimization_result,
        "grid_results": grid_results
    }



# ==============================================================
# Fitting literal speaker
# ==============================================================

def compute_literal_log_likelihood_multiT(
    obs_data: Dict[str, Any],
    target_speaker_keys: Optional[List[str]] = None,
    target_alpha_keys: Optional[List[Any]] = None,
    initial_beliefs_theta: Optional[np.ndarray] = None,
    verbose: int = 0
) -> None:
    """
    Vectorized computation of log P(utt_seq | obs_seq, literal_speaker) for utterances.
    
    Evaluates how likely existing utterance sequences (generated by various speakers)
    are under a literal speaker model. 
    
    The computation is fully vectorized across ALL thetas, observation sequences,
    generating speaker configurations, and utterance sequences in a single pass.
    
    Mutates obs_data by filling in log_lik_all_speaker["literal_fitted"] for each
    utterance record.
    
    Parameters
    ----------
    obs_data : Dict[str, Any]
        Output from sample_observation_sequences_multiT with utterances generated.
        Must have utterances populated via generate_utterances_for_observations_multiT.
    target_speaker_keys : Optional[List[str]], default None
        Which generating speakers' utterances to evaluate.
        E.g., ["inf_T", "persp_T"] to evaluate only informative and persuasive speakers.
        If None, evaluate all speaker keys with existing utterances.
        Valid keys: "literal", "inf_T", "inf_F", "persp_T", "persp_F", "persm_T", "persm_F"
    target_alpha_keys : Optional[List[Any]], default None
        Which generating alphas' utterances to evaluate.
        E.g., [5.0, 10.0] to evaluate only utterances generated with those alphas.
        If None, evaluate all alpha keys with existing utterances.
    Note: Not all (speaker_key, alpha_key) combinations exist.
        - "literal" only has alpha_key 0.0
        - Pragmatic speakers have their generated alpha values    
        When both target_speaker_keys and target_alpha_keys are specified,
        only combinations that exist in the data are processed.
    initial_beliefs_theta : Optional[np.ndarray], default None
        Initial beliefs over theta for the literal speaker.
        Note: Does not affect literal speaker's P(u|O) table (which depends
        only on truth values), but accepted for API consistency.
    verbose : int, default 0
        Verbosity level. If > 0, print summary of what's being processed.
    
    Returns
    -------
    None
        Mutates obs_data in place.
    
    Notes
    -----
    Storage structure (per utterance record):
        utt_record["log_lik_all_speaker"]["literal_fitted"] = {
            "max_log_lik": {T: float for T in Ts},
            "optimal_alpha": {T: 0.0 for T in Ts}  # Always 0.0 for literal
        }

    Raises
    ------
    ValueError
        If any observation or utterance sequence has incorrect length (!= max_T).
        If any T in Ts is outside the valid range [1, max_T].
    
    Examples
    --------
    >>> # Evaluate ALL utterances under literal speaker
    >>> compute_literal_log_likelihood_multiT(obs_data, verbose=1)
    Processing 30000 utterance sequences (300 unique obs positions) across all configurations
    
    >>> # Check results
    >>> utt_rec = obs_data["observations"][0.5][0]["utterances"]["inf_T"][5.0][0]
    >>> utt_rec["log_lik_all_speaker"]["literal_fitted"]
    {'max_log_lik': {5: -4.23, 10: -8.91, 15: -13.45, 20: -18.02},
     'optimal_alpha': {5: 0.0, 10: 0.0, 15: 0.0, 20: 0.0}}
    """
    
    # EXTRACT CONFIGURATION
    
    world = obs_data["world"]
    Ts = obs_data["config"]["Ts"]
    max_T = obs_data["config"]["max_T"]
    thetas = obs_data["config"]["thetas"]
    
    # VALIDATE Ts
    
    invalid_Ts = [T for T in Ts if T < 1 or T > max_T]
    if invalid_Ts:
        raise ValueError(
            f"All T in Ts must satisfy 1 <= T <= max_T ({max_T}). "
            f"Invalid values: {invalid_Ts}"
        )
    
    # CREATE LITERAL SPEAKER AND EXTRACT PROBABILITY TABLE
    
    speaker = LiteralSpeaker(world, initial_beliefs_theta)
    prob_table = speaker.utterance_log_prob_obs.values  # shape: (n_utterances, n_observations)
    
    # Use existing pandas Index objects
    obs_index = speaker.utterance_log_prob_obs.columns
    utt_index = speaker.utterance_log_prob_obs.index
    
    # FLATTEN ALL UTTERANCE SEQUENCES WITH LOCATION TRACKING AND VALIDATION
    # Also collect observation sequences by position    
    flat_data = []
    skipped_combinations = set()
    

    unique_obs_positions = []  # List of obs_seq (one per unique position)
    obs_pos_to_unique_idx = {}  # (theta, obs_list_pos) -> index in unique_obs_positions
    
    for theta in thetas:
        for obs_list_pos, obs_info in enumerate(obs_data["observations"][theta]):
            obs_seq = obs_info["obs_seq"]
            obs_idx = obs_info["obs_idx"]
            
            if len(obs_seq) != max_T:
                raise ValueError(
                    f"Observation sequence length mismatch: "
                    f"expected {max_T}, got {len(obs_seq)} "
                    f"at theta={theta}, obs_idx={obs_idx}"
                )
            
            if obs_info["utterances"] is None:
                continue
            
            # Register this observation position if not already seen
            obs_pos_key = (theta, obs_list_pos)
            if obs_pos_key not in obs_pos_to_unique_idx:
                obs_pos_to_unique_idx[obs_pos_key] = len(unique_obs_positions)
                unique_obs_positions.append(obs_seq)
            
            for speaker_key, alpha_dict in obs_info["utterances"].items():
                if target_speaker_keys is not None and speaker_key not in target_speaker_keys:
                    skipped_combinations.add(f"speaker_key={speaker_key}")
                    continue
                
                for alpha_key, utt_records in alpha_dict.items():
                    if target_alpha_keys is not None and alpha_key not in target_alpha_keys:
                        skipped_combinations.add(f"alpha_key={alpha_key}")
                        continue
                    
                    for utt_list_idx, utt_rec in enumerate(utt_records):
                        utt_seq = utt_rec["utt_seq"]
                        
                        if len(utt_seq) != max_T:
                            raise ValueError(
                                f"Utterance sequence length mismatch: "
                                f"expected {max_T}, got {len(utt_seq)} "
                                f"at theta={theta}, obs_idx={obs_idx}, "
                                f"speaker_key={speaker_key}, alpha_key={alpha_key}, "
                                f"utt_idx={utt_list_idx}"
                            )
                        
                        flat_data.append({
                            "utt_seq": utt_seq,
                            "obs_unique_idx": obs_pos_to_unique_idx[obs_pos_key],
                            "location": (theta, obs_list_pos, speaker_key, alpha_key, utt_list_idx)
                        })
    
    # VERBOSE OUTPUT
    
    n_unique_obs = len(unique_obs_positions)
    n_total = len(flat_data)
    
    if verbose > 0:
        filter_desc = []
        if target_speaker_keys is not None:
            filter_desc.append(f"speakers: {target_speaker_keys}")
        if target_alpha_keys is not None:
            filter_desc.append(f"alphas: {target_alpha_keys}")
        
        if filter_desc:
            print(f"Processing {n_total} utterance sequences ({n_unique_obs} unique obs positions) "
                  f"for {', '.join(filter_desc)}")
        else:
            print(f"Processing {n_total} utterance sequences ({n_unique_obs} unique obs positions) "
                  f"across all configurations")
        
        if skipped_combinations and verbose > 1:
            print(f"  Skipped: {skipped_combinations}")
    
    # EARLY EXIT IF NOTHING TO PROCESS
    
    if n_total == 0:
        if verbose > 0:
            print("No utterance sequences to process (check filters or ensure utterances exist)")
        return
    
    # Defensive assertion
    # at least one observation position
    assert n_unique_obs > 0, "Internal error: n_total > 0 but no unique obs positions registered"
    
    # BUILD OBSERVATION INDEX ARRAY
    
    # Flatten unique observations only
    obs_flat_unique = list(itertools.chain.from_iterable(
        (tuple(obs) if not isinstance(obs, tuple) else obs for obs in obs_seq)
        for obs_seq in unique_obs_positions
    ))
    
    # Batch lookup for unique observations only
    obs_indices_flat_unique = obs_index.get_indexer(obs_flat_unique)
    
    # Validate
    if (obs_indices_flat_unique < 0).any():
        bad_idx = np.where(obs_indices_flat_unique < 0)[0][0]
        raise ValueError(f"Unknown observation encountered: {obs_flat_unique[bad_idx]}")
    
    # Reshape to (n_unique_obs, max_T)
    obs_indices_unique = obs_indices_flat_unique.reshape(n_unique_obs, max_T)
    
    # Build expansion array: which unique obs position each flat_data item uses
    unique_obs_idx_per_item = np.array(
        [item["obs_unique_idx"] for item in flat_data],
        dtype=np.int32
    )
    
    # Expand to full (n_total, max_T) via fancy indexing
    obs_indices = obs_indices_unique[unique_obs_idx_per_item]
    
    # BUILD UTTERANCE INDEX ARRAY
    
    # Flatten utterances directly from flat_data
    utt_flat = list(itertools.chain.from_iterable(item["utt_seq"] for item in flat_data))
    
    # Batch lookup
    utt_indices_flat = utt_index.get_indexer(utt_flat)
    
    # Validate
    if (utt_indices_flat < 0).any():
        bad_idx = np.where(utt_indices_flat < 0)[0][0]
        raise ValueError(f"Unknown utterance encountered: {utt_flat[bad_idx]}")
    
    # Reshape to (n_total, max_T)
    utt_indices = utt_indices_flat.reshape(n_total, max_T)
    
    # VECTORIZED LIKELIHOOD COMPUTATION
    
    # Single numpy advanced indexing: shape (n_total, max_T)
    log_probs = prob_table[utt_indices, obs_indices]
    
    # Cumulative sum across time dimension
    cumsum_log_probs = np.cumsum(log_probs, axis=1)
    
    # Extract all Ts at once (Optimization D)
    T_indices = np.array(Ts, dtype=np.int32) - 1  # Convert to 0-indexed
    log_liks_all_T = cumsum_log_probs[:, T_indices]  # shape: (n_total, len(Ts))
    
    # DISTRIBUTE RESULTS BACK TO NESTED STRUCTURE
    
    for i, item in enumerate(flat_data):
        theta, obs_list_pos, speaker_key, alpha_key, utt_list_idx = item["location"]
        
        utt_rec = obs_data["observations"][theta][obs_list_pos]["utterances"][speaker_key][alpha_key][utt_list_idx]
        
        if utt_rec["log_lik_all_speaker"] is None:
            utt_rec["log_lik_all_speaker"] = {}
        
        # Build result dicts
        utt_rec["log_lik_all_speaker"]["literal_fitted"] = {
            "max_log_lik": {T: float(ll) for T, ll in zip(Ts, log_liks_all_T[i])},
            "optimal_alpha": {T: 0.0 for T in Ts}
        }
    
    if verbose > 0:
        print(f"Completed: stored results in log_lik_all_speaker['literal_fitted']")



# ==============================================================
# Fitting pragmatic speakers with update_internal = False
# ==============================================================

def compute_pragmatic_static_log_likelihood_multiT(
    obs_data: Dict[str, Any],
    fitting_psi: Literal["inf", "pers+", "pers-"],
    target_speaker_keys: Optional[List[str]] = None,
    target_alpha_keys: Optional[List[Any]] = None,
    method: Literal["grid", "scipy"] = "grid",
    alpha_bounds: Tuple[float, float] = (0.1, 50.0),
    grid_spacing: Literal["log", "linear"] = "log",
    n_grid: int = 100,
    include_determ: bool = True,
    n_jobs: int = 1,
    backend: str = "loky",
    verbose: int = 0
) -> None:
    """
    Find optimal alpha and max log-likelihood under a pragmatic speaker 
    with update_internal=False.
    
    Mutates obs_data by filling in log_lik_all_speaker["{psi}_F_fitted"] 
    for each utterance record.
    
    Parameters
    ----------
    obs_data : Dict[str, Any]
        Output from sample_observation_sequences_multiT with utterances generated.
    fitting_psi : {"inf", "pers+", "pers-"}
        The psi parameter for the fitting speaker.
    target_speaker_keys : Optional[List[str]], default None
        Which generating speakers' utterances to evaluate. If None, all.
    target_alpha_keys : Optional[List[Any]], default None
        Which generating alphas' utterances to evaluate. If None, all.
    method : {"grid", "scipy"}, default "grid"
        Optimization method.
    alpha_bounds : Tuple[float, float], default (0.1, 50.0)
        Search range for alpha.
    grid_spacing : {"log", "linear"}, default "log"
        Grid spacing (only for method="grid").
    n_grid : int, default 100
        Number of grid points (only for method="grid").
    include_determ : bool, default True
        Whether to also evaluate alpha="determ".
    n_jobs : int, default 1
        Number of parallel jobs (only for method="scipy").
    backend : str, default "loky"
        Joblib backend (only for method="scipy").
    verbose : int, default 0
        Verbosity level.
    
    Returns
    -------
    None
        Mutates obs_data in place.
    
    Notes
    -----
    Storage key: "{psi}_F_fitted" (e.g., "inf_F_fitted", "persp_F_fitted")
    
    Storage structure:
        utt_record["log_lik_all_speaker"]["{psi}_F_fitted"] = {
            "max_log_lik": {T: float for T in Ts},
            "optimal_alpha": {T: float or "determ" for T in Ts}
        }
    """
    
    # Input validation
    if fitting_psi not in ["inf", "pers+", "pers-"]:
        raise ValueError(f"fitting_psi must be 'inf', 'pers+', or 'pers-', got '{fitting_psi}'")
    
    if method not in ["grid", "scipy"]:
        raise ValueError(f"method must be 'grid' or 'scipy', got '{method}'")
    
    if method == "grid" and grid_spacing not in ["log", "linear"]:
        raise ValueError(f"grid_spacing must be 'log' or 'linear', got '{grid_spacing}'")
    
    if backend not in ["loky", "multiprocessing", "threading"]:
        raise ValueError(f"backend must be 'loky', 'multiprocessing', or 'threading'")
    
    # Determine storage key
    psi_prefix = {"inf": "inf", "pers+": "persp", "pers-": "persm"}[fitting_psi]
    fitted_key = f"{psi_prefix}_F_fitted"
    
    # Extract configuration
    world = obs_data["world"]
    Ts = obs_data["config"]["Ts"]
    max_T = obs_data["config"]["max_T"]
    thetas = obs_data["config"]["thetas"]
    
    # Validate Ts
    invalid_Ts = [T for T in Ts if T < 1 or T > max_T]
    if invalid_Ts:
        raise ValueError(f"All T must satisfy 1 <= T <= {max_T}. Invalid: {invalid_Ts}")
    
    # Flatten all utterance sequences with location tracking
    flat_data = []
    skipped_combinations = set()
    
    unique_obs_positions = []
    obs_pos_to_unique_idx = {}
    
    for theta in thetas:
        for obs_list_pos, obs_info in enumerate(obs_data["observations"][theta]):
            obs_seq = obs_info["obs_seq"]
            obs_idx = obs_info["obs_idx"]
            
            if len(obs_seq) != max_T:
                raise ValueError(
                    f"Observation sequence length mismatch at theta={theta}, obs_idx={obs_idx}"
                )
            
            if obs_info["utterances"] is None:
                continue
            
            # Register unique observation position
            obs_pos_key = (theta, obs_list_pos)
            if obs_pos_key not in obs_pos_to_unique_idx:
                obs_pos_to_unique_idx[obs_pos_key] = len(unique_obs_positions)
                unique_obs_positions.append(obs_seq)
            
            for speaker_key, alpha_dict in obs_info["utterances"].items():
                if target_speaker_keys is not None and speaker_key not in target_speaker_keys:
                    skipped_combinations.add(f"speaker_key={speaker_key}")
                    continue
                
                for alpha_key, utt_records in alpha_dict.items():
                    if target_alpha_keys is not None and alpha_key not in target_alpha_keys:
                        skipped_combinations.add(f"alpha_key={alpha_key}")
                        continue
                    
                    for utt_list_idx, utt_rec in enumerate(utt_records):
                        utt_seq = utt_rec["utt_seq"]
                        
                        if len(utt_seq) != max_T:
                            raise ValueError(
                                f"Utterance sequence length mismatch at theta={theta}, "
                                f"obs_idx={obs_idx}, speaker_key={speaker_key}"
                            )
                        
                        flat_data.append({
                            "utt_seq": utt_seq,
                            "obs_unique_idx": obs_pos_to_unique_idx[obs_pos_key],
                            "location": (theta, obs_list_pos, speaker_key, alpha_key, utt_list_idx)
                        })
    
    # Verbose output
    n_unique_obs = len(unique_obs_positions)
    n_total = len(flat_data)
    
    if verbose > 0:
        filter_desc = []
        if target_speaker_keys is not None:
            filter_desc.append(f"speakers: {target_speaker_keys}")
        if target_alpha_keys is not None:
            filter_desc.append(f"alphas: {target_alpha_keys}")
        
        print(f"Static pragmatic speaker fitting (psi={fitting_psi}, method={method}):")
        print(f"  Storage key: '{fitted_key}'")
        if filter_desc:
            print(f"  Processing {n_total} utterance sequences ({n_unique_obs} unique obs) "
                  f"for {', '.join(filter_desc)}")
        else:
            print(f"  Processing {n_total} utterance sequences ({n_unique_obs} unique obs)")
        print(f"  Ts: {Ts}")
        
        if method == "grid":
            n_alphas = n_grid + (1 if include_determ else 0)
            print(f"  Grid: {n_grid} points, spacing={grid_spacing}, bounds={alpha_bounds}")
        else:
            print(f"  Scipy: {n_total * len(Ts)} optimizations")
    
    # Early exit
    if n_total == 0:
        if verbose > 0:
            print("No utterance sequences to process")
        return
    
    # Method-specific computation
    if method == "grid":
        results = _static_grid_search_multiT(
            flat_data=flat_data,
            unique_obs_positions=unique_obs_positions,
            world=world,
            psi=fitting_psi,
            Ts=Ts,
            max_T=max_T,
            alpha_bounds=alpha_bounds,
            grid_spacing=grid_spacing,
            n_grid=n_grid,
            include_determ=include_determ,
            verbose=verbose
        )
    else:
        results = _static_scipy_optimization_multiT(
            flat_data=flat_data,
            unique_obs_positions=unique_obs_positions,
            world=world,
            psi=fitting_psi,
            Ts=Ts,
            alpha_bounds=alpha_bounds,
            include_determ=include_determ,
            n_jobs=n_jobs,
            backend=backend,
            verbose=verbose
        )
    
    # Distribute results
    for i, item in enumerate(flat_data):
        theta, obs_list_pos, speaker_key, alpha_key, utt_list_idx = item["location"]
        
        utt_rec = obs_data["observations"][theta][obs_list_pos]["utterances"][speaker_key][alpha_key][utt_list_idx]
        
        if utt_rec["log_lik_all_speaker"] is None:
            utt_rec["log_lik_all_speaker"] = {}
        
        utt_rec["log_lik_all_speaker"][fitted_key] = {
            "max_log_lik": results["max_log_lik"][i],
            "optimal_alpha": results["optimal_alpha"][i]
        }
    
    if verbose > 0:
        print(f"Completed: stored results in log_lik_all_speaker['{fitted_key}']")



def _static_grid_search_multiT(
    flat_data: List[Dict[str, Any]],
    unique_obs_positions: List[List[Tuple[int, ...]]],
    world: 'World',
    psi: str,
    Ts: List[int],
    max_T: int,
    alpha_bounds: Tuple[float, float],
    grid_spacing: str,
    n_grid: int,
    include_determ: bool,
    verbose: int
) -> Dict[str, List[Dict[int, Any]]]:
    """
    Grid search for optimal alpha with static speaker.
    
    Optimization: Utilities are computed once (alpha-independent).
    Memory-efficient: Loops over alphas instead of 4D vectorization.
    
    Returns
    -------
    Dict with "max_log_lik" and "optimal_alpha" lists.
    """
    
    n_total = len(flat_data)
    n_unique_obs = len(unique_obs_positions)
    n_Ts = len(Ts)
    T_indices = np.array(Ts, dtype=np.int32) - 1
    
    # =========================================================================
    # PHASE 1: Create ONE speaker and extract utility table
    # =========================================================================
    
    ref_speaker = PragmaticSpeaker_obs(
        world=world,
        omega="strat",
        psi=psi,
        update_internal=False,
        alpha=1.0,
        beta=0.0,
        initial_beliefs_theta=None
    )
    
    # Utility table: shape (n_utterances, n_observations)
    utility_table = ref_speaker.utility.values
    n_utterances, n_obs_total = utility_table.shape
    
    # Index mappings
    obs_index = ref_speaker.utility.columns
    utt_index = ref_speaker.utility.index
    utterances = list(utt_index)
    utt_to_idx = {u: i for i, u in enumerate(utterances)}
    
    if verbose > 1:
        print(f"  utility_table: {utility_table.shape}, {utility_table.nbytes/1024/1024:.1f} MB")
    
    # =========================================================================
    # PHASE 2: Build observation index arrays
    # =========================================================================
    
    obs_flat_unique = list(itertools.chain.from_iterable(
        (tuple(obs) if not isinstance(obs, tuple) else obs for obs in obs_seq)
        for obs_seq in unique_obs_positions
    ))
    
    obs_indices_flat_unique = obs_index.get_indexer(obs_flat_unique)
    if (obs_indices_flat_unique < 0).any():
        bad_idx = np.where(obs_indices_flat_unique < 0)[0][0]
        raise ValueError(f"Unknown observation: {obs_flat_unique[bad_idx]}")
    
    obs_indices_unique = obs_indices_flat_unique.reshape(n_unique_obs, max_T)
    
    unique_obs_idx_per_item = np.array(
        [item["obs_unique_idx"] for item in flat_data], dtype=np.int32
    )
    obs_indices = obs_indices_unique[unique_obs_idx_per_item]  # (n_total, max_T)
    
    # =========================================================================
    # PHASE 3: Build utterance index array
    # =========================================================================
    
    utt_flat = list(itertools.chain.from_iterable(item["utt_seq"] for item in flat_data))
    utt_indices_flat = np.array([utt_to_idx[u] for u in utt_flat], dtype=np.int32)
    utt_indices = utt_indices_flat.reshape(n_total, max_T)  # (n_total, max_T)
    
    # =========================================================================
    # PHASE 4: Extract utilities for all (item, time_step) pairs
    # =========================================================================
    
    # Utilities for observed (utterance, observation) pairs: (n_total, max_T)
    observed_utilities = utility_table[utt_indices, obs_indices]
    
    # Utilities for ALL utterances at each position: (n_total, max_T, n_utterances)
    # Computed once, reused for all alphas
    all_utilities_per_step = utility_table[:, obs_indices].transpose(1, 2, 0)
    
    if verbose > 1:
        print(f"  all_utilities_per_step: {all_utilities_per_step.shape}, "
              f"{all_utilities_per_step.nbytes/1024/1024:.1f} MB")
    
    # =========================================================================
    # PHASE 5: Create alpha grid
    # =========================================================================
    
    a_min, a_max = alpha_bounds
    if grid_spacing == "log":
        alphas = list(np.exp(np.linspace(np.log(a_min), np.log(a_max), n_grid)))
    else:
        alphas = list(np.linspace(a_min, a_max, n_grid))
    
    if include_determ:
        alphas.append("determ")
    
    n_alphas = len(alphas)
    
    # =========================================================================
    # PHASE 6: Compute log P(u|O,α) for each alpha (loop for memory efficiency)
    # =========================================================================
    
    # Output array: (n_alphas, n_total, n_Ts)
    all_lls = np.zeros((n_alphas, n_total, n_Ts))
    
    for alpha_idx, alpha in enumerate(alphas):
        if verbose > 1 and alpha_idx % 20 == 0:
            print(f"  Processing alpha {alpha_idx+1}/{n_alphas}")
        
        if alpha == "determ":
            # Deterministic: uniform over max-utility utterances
            max_utilities = np.max(all_utilities_per_step, axis=2)  # (n_total, max_T)
            is_max = np.isclose(observed_utilities, max_utilities)
            is_max_all = np.isclose(all_utilities_per_step, max_utilities[:, :, np.newaxis])
            n_ties = np.sum(is_max_all, axis=2)
            log_probs = np.where(is_max, -np.log(n_ties), -np.inf)
        else:
            # Softmax: P(u|O,α) = exp(α·U(u)) / Σ exp(α·U(u'))
            scaled_observed = alpha * observed_utilities  # (n_total, max_T)
            scaled_all = alpha * all_utilities_per_step   # (n_total, max_T, n_utterances)
            log_normalizers = logsumexp(scaled_all, axis=2)  # (n_total, max_T)
            log_probs = scaled_observed - log_normalizers
        
        # Cumulative sum and extract for Ts
        cumsum_log_probs = np.cumsum(log_probs, axis=1)  # (n_total, max_T)
        log_liks = cumsum_log_probs[:, T_indices]  # (n_total, n_Ts)
        
        # Handle -inf propagation
        has_neginf = np.isneginf(log_probs)
        for t_idx, T in enumerate(Ts):
            has_neginf_up_to_T = np.any(has_neginf[:, :T], axis=1)
            log_liks[has_neginf_up_to_T, t_idx] = -np.inf
        
        all_lls[alpha_idx] = log_liks
    
    # =========================================================================
    # PHASE 7: Find optimal alpha for each (sequence, T)
    # =========================================================================
    
    best_alpha_indices = np.argmax(all_lls, axis=0)  # (n_total, n_Ts)
    
    row_indices = np.arange(n_total)[:, np.newaxis]
    T_col_indices = np.arange(n_Ts)[np.newaxis, :]
    max_lls = all_lls[best_alpha_indices, row_indices, T_col_indices]
    
    # =========================================================================
    # PHASE 8: Convert to list of dicts
    # =========================================================================
    
    alphas_array = np.array(alphas, dtype=object)
    
    max_log_lik_list = []
    optimal_alpha_list = []
    
    for i in range(n_total):
        max_log_lik_list.append({
            T: float(max_lls[i, t_idx]) for t_idx, T in enumerate(Ts)
        })
        optimal_alpha_list.append({
            T: alphas_array[best_alpha_indices[i, t_idx]] for t_idx, T in enumerate(Ts)
        })
    
    return {
        "max_log_lik": max_log_lik_list,
        "optimal_alpha": optimal_alpha_list
    }



def _static_scipy_optimization_multiT(
    flat_data: List[Dict[str, Any]],
    unique_obs_positions: List[List[Tuple[int, ...]]],
    world: 'World',
    psi: str,
    Ts: List[int],
    alpha_bounds: Tuple[float, float],
    include_determ: bool,
    n_jobs: int,
    backend: str,
    verbose: int
) -> Dict[str, List[Dict[int, Any]]]:
    """
    Scipy optimization for optimal alpha with static speaker.
    
    Returns
    -------
    Dict with "max_log_lik" and "optimal_alpha" lists.
    """
    
    n_total = len(flat_data)
    
    # Reconstruct obs_seq for each item
    obs_seqs = [unique_obs_positions[item["obs_unique_idx"]] for item in flat_data]
    
    # Build tasks: one per (sequence, T)
    tasks = []
    for item_idx, item in enumerate(flat_data):
        obs_seq = obs_seqs[item_idx]
        for T in Ts:
            tasks.append({
                "item_idx": item_idx,
                "T": T,
                "obs_seq": obs_seq[:T],
                "utt_seq": item["utt_seq"][:T]
            })
    
    if verbose > 0:
        print(f"  Running {len(tasks)} scipy optimizations...")
    
    # Worker function
    def optimize_single(task):
        base_config = {
            "speaker_type": "pragmatic",
            "omega": "strat",
            "psi": psi,
            "update_internal": False,
            "beta": 0.0,
            "initial_beliefs_theta": None
        }
        
        result = log_likelihood_alpha_opt_utt_seq(
            world=world,
            obs_seq=task["obs_seq"],
            utt_seq=task["utt_seq"],
            speaker_config=base_config,
            alpha_bounds=alpha_bounds,
            grid_search=False,
            include_determ=include_determ
        )
        
        return {
            "item_idx": task["item_idx"],
            "T": task["T"],
            "optimal_alpha": result["optimal_alpha"],
            "max_log_lik": result["max_log_likelihood"]
        }
    
    # Execute
    if n_jobs == 1:
        results = [optimize_single(task) for task in tasks]
    else:
        results = Parallel(n_jobs=n_jobs, backend=backend, verbose=verbose)(
            delayed(optimize_single)(task) for task in tasks
        )
    
    # Reorganize by item_idx
    max_log_lik_list = [{} for _ in range(n_total)]
    optimal_alpha_list = [{} for _ in range(n_total)]
    
    for res in results:
        item_idx = res["item_idx"]
        T = res["T"]
        max_log_lik_list[item_idx][T] = res["max_log_lik"]
        optimal_alpha_list[item_idx][T] = res["optimal_alpha"]
    
    return {
        "max_log_lik": max_log_lik_list,
        "optimal_alpha": optimal_alpha_list
    }



# ==============================================================
# Fitting pragmatic speakers with update_internal = True
# ==============================================================

def compute_pragmatic_dynamic_log_likelihood_multiT(
    obs_data: Dict[str, Any],
    fitting_psi: Literal["inf", "pers+", "pers-"],
    fitting_Ts: Optional[List[int]] = None,
    target_speaker_keys: Optional[List[str]] = None,
    target_alpha_keys: Optional[List[Any]] = None,
    method: Literal["grid", "scipy"] = "grid",
    alpha_bounds: Tuple[float, float] = (0.1, 50.0),
    grid_spacing: Literal["log", "linear"] = "log",
    n_grid: int = 100,
    include_determ: bool = True,
    n_jobs: int = 1,
    backend: str = "loky",
    verbose: int = 0
) -> None:
    """
    Find optimal alpha and max log-likelihood under a pragmatic speaker 
    with update_internal=True.
    
    Mutates obs_data by filling in log_lik_all_speaker["{psi}_T_fitted"] 
    for each utterance record.
    
    Parameters
    ----------
    obs_data : Dict[str, Any]
        Output from sample_observation_sequences_multiT with utterances generated.
    fitting_psi : {"inf", "pers+", "pers-"}
        The psi parameter for the fitting speaker.
    fitting_Ts : Optional[List[int]], default None
        Subset of Ts to compute likelihoods for. If None, use all Ts.
    target_speaker_keys : Optional[List[str]], default None
        Which generating speakers' utterances to evaluate. If None, all.
    target_alpha_keys : Optional[List[Any]], default None
        Which generating alphas' utterances to evaluate. If None, all.
    method : {"grid", "scipy"}, default "grid"
        Optimization method.
    alpha_bounds : Tuple[float, float], default (0.1, 50.0)
        Search range for alpha.
    grid_spacing : {"log", "linear"}, default "log"
        Grid spacing (only for method="grid").
    n_grid : int, default 100
        Number of grid points (only for method="grid").
    include_determ : bool, default True
        Whether to also evaluate alpha="determ".
    n_jobs : int, default 1
        Number of parallel jobs.
    backend : str, default "loky"
        Joblib backend.
    verbose : int, default 0
        Verbosity level.
    
    Returns
    -------
    None
        Mutates obs_data in place.
    
    Notes
    -----
    Storage key: "{psi}_T_fitted" (e.g., "inf_T_fitted", "persp_T_fitted")
    
    Storage structure:
        utt_record["log_lik_all_speaker"]["{psi}_T_fitted"] = {
            "max_log_lik": {T: float for T in fitting_Ts},
            "optimal_alpha": {T: float or "determ" for T in fitting_Ts}
        }
    """
    
    # =========================================================================
    # INPUT VALIDATION
    # =========================================================================
    
    if fitting_psi not in ["inf", "pers+", "pers-"]:
        raise ValueError(f"fitting_psi must be 'inf', 'pers+', or 'pers-', got '{fitting_psi}'")
    
    if method not in ["grid", "scipy"]:
        raise ValueError(f"method must be 'grid' or 'scipy', got '{method}'")
    
    if method == "grid" and grid_spacing not in ["log", "linear"]:
        raise ValueError(f"grid_spacing must be 'log' or 'linear', got '{grid_spacing}'")
    
    if backend not in ["loky", "multiprocessing", "threading"]:
        raise ValueError(f"backend must be 'loky', 'multiprocessing', or 'threading'")
    
    # =========================================================================
    # DETERMINE STORAGE KEY
    # =========================================================================
    
    psi_prefix = {"inf": "inf", "pers+": "persp", "pers-": "persm"}[fitting_psi]
    fitted_key = f"{psi_prefix}_T_fitted"
    
    # =========================================================================
    # EXTRACT CONFIGURATION
    # =========================================================================
    
    world = obs_data["world"]
    config_Ts = obs_data["config"]["Ts"]
    max_T = obs_data["config"]["max_T"]
    thetas = obs_data["config"]["thetas"]
    
    # =========================================================================
    # VALIDATE AND PROCESS fitting_Ts
    # =========================================================================
    
    if fitting_Ts is None:
        Ts = config_Ts
    else:
        if not isinstance(fitting_Ts, (list, np.ndarray)):
            raise TypeError("fitting_Ts must be a list of integers or None")
        
        fitting_Ts = list(fitting_Ts)
        
        if len(fitting_Ts) == 0:
            raise ValueError("fitting_Ts cannot be empty")
        
        for T in fitting_Ts:
            if not isinstance(T, (int, np.integer)):
                raise ValueError(f"All values in fitting_Ts must be integers")
        
        fitting_Ts = sorted(set(int(T) for T in fitting_Ts))
        
        invalid_Ts = [T for T in fitting_Ts if T not in config_Ts]
        if invalid_Ts:
            raise ValueError(
                f"fitting_Ts contains values not in config Ts. "
                f"Invalid: {invalid_Ts}. Available: {config_Ts}"
            )
        
        Ts = fitting_Ts
    
    invalid_Ts = [T for T in Ts if T < 1 or T > max_T]
    if invalid_Ts:
        raise ValueError(f"All T must satisfy 1 <= T <= {max_T}. Invalid: {invalid_Ts}")
    
    # =========================================================================
    # FLATTEN ALL UTTERANCE SEQUENCES WITH LOCATION TRACKING
    # =========================================================================
    
    flat_data = []
    skipped_combinations = set()
    
    for theta in thetas:
        for obs_list_pos, obs_info in enumerate(obs_data["observations"][theta]):
            obs_seq = obs_info["obs_seq"]
            obs_idx = obs_info["obs_idx"]
            
            if len(obs_seq) != max_T:
                raise ValueError(
                    f"Observation sequence length mismatch at theta={theta}, obs_idx={obs_idx}"
                )
            
            if obs_info["utterances"] is None:
                continue
            
            for speaker_key, alpha_dict in obs_info["utterances"].items():
                if target_speaker_keys is not None and speaker_key not in target_speaker_keys:
                    skipped_combinations.add(f"speaker_key={speaker_key}")
                    continue
                
                for alpha_key, utt_records in alpha_dict.items():
                    if target_alpha_keys is not None and alpha_key not in target_alpha_keys:
                        skipped_combinations.add(f"alpha_key={alpha_key}")
                        continue
                    
                    for utt_list_idx, utt_rec in enumerate(utt_records):
                        utt_seq = utt_rec["utt_seq"]
                        
                        if len(utt_seq) != max_T:
                            raise ValueError(
                                f"Utterance sequence length mismatch at theta={theta}, "
                                f"obs_idx={obs_idx}, speaker_key={speaker_key}"
                            )
                        
                        flat_data.append({
                            "obs_seq": obs_seq,
                            "utt_seq": utt_seq,
                            "location": (theta, obs_list_pos, speaker_key, alpha_key, utt_list_idx)
                        })
    
    # =========================================================================
    # VERBOSE OUTPUT
    # =========================================================================
    
    n_total = len(flat_data)
    
    if verbose > 0:
        print(f"Dynamic pragmatic speaker fitting (psi={fitting_psi}, method={method}):")
        print(f"  Storage key: '{fitted_key}'")
        print(f"  Processing {n_total} utterance sequences")
        print(f"  Ts: {Ts}")
        
        if method == "grid":
            n_alphas = n_grid + (1 if include_determ else 0)
            print(f"  Grid: {n_grid} points, spacing={grid_spacing}, bounds={alpha_bounds}")
        else:
            print(f"  Scipy: {n_total * len(Ts)} optimizations")
        
        if n_jobs != 1:

            n_workers = (cpu_count() if n_jobs == -1 
                        else max(1, cpu_count() + 1 + n_jobs) if n_jobs < 0 
                        else max(1, n_jobs))
            print(f"  Parallel: {n_workers} workers")
    
    # =========================================================================
    # EARLY EXIT
    # =========================================================================
    
    if n_total == 0:
        if verbose > 0:
            print("No utterance sequences to process")
        return
    
    # =========================================================================
    # METHOD-SPECIFIC COMPUTATION
    # =========================================================================
    
    if method == "grid":
        results = _dynamic_grid_search_multiT(
            flat_data=flat_data,
            world=world,
            psi=fitting_psi,
            Ts=Ts,
            alpha_bounds=alpha_bounds,
            grid_spacing=grid_spacing,
            n_grid=n_grid,
            include_determ=include_determ,
            n_jobs=n_jobs,
            backend=backend,
            verbose=verbose
        )
    else:
        results = _dynamic_scipy_optimization_multiT(
            flat_data=flat_data,
            world=world,
            psi=fitting_psi,
            Ts=Ts,
            alpha_bounds=alpha_bounds,
            include_determ=include_determ,
            n_jobs=n_jobs,
            backend=backend,
            verbose=verbose
        )
    
    # =========================================================================
    # DISTRIBUTE RESULTS BACK TO NESTED STRUCTURE
    # =========================================================================
    
    for i, item in enumerate(flat_data):
        theta, obs_list_pos, speaker_key, alpha_key, utt_list_idx = item["location"]
        
        utt_rec = obs_data["observations"][theta][obs_list_pos]["utterances"][speaker_key][alpha_key][utt_list_idx]
        
        if utt_rec["log_lik_all_speaker"] is None:
            utt_rec["log_lik_all_speaker"] = {}
        
        if fitted_key in utt_rec["log_lik_all_speaker"]:
            existing = utt_rec["log_lik_all_speaker"][fitted_key]
            existing["max_log_lik"].update(results["max_log_lik"][i])
            existing["optimal_alpha"].update(results["optimal_alpha"][i])
        else:
            utt_rec["log_lik_all_speaker"][fitted_key] = {
                "max_log_lik": results["max_log_lik"][i],
                "optimal_alpha": results["optimal_alpha"][i]
            }
    
    if verbose > 0:
        print(f"Completed: stored results in log_lik_all_speaker['{fitted_key}']")



def _dynamic_evaluate_sequence_all_alphas(
    obs_seq: List[Tuple[int, ...]],
    utt_seq: List[str],
    world: 'World',
    psi: str,
    alphas: List[Any],
    Ts: List[int]
) -> np.ndarray:
    """
    Evaluate log-likelihoods for one sequence across all alphas and Ts.
    
    For update_internal=True, the listener's beliefs evolve based on observed
    utterances. This evolution is alpha-independent, so we:
    1. Walk through the sequence collecting utilities at each step
    2. Apply softmax for all alphas at once
    
    Parameters
    ----------
    obs_seq : List[Tuple[int, ...]]
        Observation sequence.
    utt_seq : List[str]
        Utterance sequence.
    world : World
        The World object.
    psi : str
        Speaker goal: "inf", "pers+", or "pers-".
    alphas : List[Any]
        List of alpha values (floats and/or "determ").
    Ts : List[int]
        Sequence lengths to compute likelihoods for.
    
    Returns
    -------
    np.ndarray
        Shape (n_alphas, n_Ts) log-likelihoods.
    """
    
    steps_needed = max(Ts)
    n_alphas = len(alphas)
    n_Ts = len(Ts)
    T_indices = np.array(Ts) - 1
    
    # =========================================================================
    # SEPARATE NUMERIC ALPHAS FROM "determ"
    # =========================================================================
    
    numeric_indices = []
    numeric_alphas = []
    determ_idx = None
    
    for i, alpha in enumerate(alphas):
        if alpha == "determ":
            determ_idx = i
        else:
            numeric_indices.append(i)
            numeric_alphas.append(float(alpha))
    
    has_numeric = len(numeric_alphas) > 0
    has_determ = determ_idx is not None
    
    # =========================================================================
    # CREATE SPEAKER (alpha value doesn't matter for utility extraction)
    # =========================================================================
    
    speaker = PragmaticSpeaker_obs(
        world=world,
        omega="strat",
        psi=psi,
        update_internal=True,
        alpha=1.0,
        beta=0.0,
        initial_beliefs_theta=None
    )
    
    utterances = list(speaker.utility.index)
    utt_to_idx = {u: i for i, u in enumerate(utterances)}
    
    # =========================================================================
    # COLLECT UTILITIES AT EACH TIME STEP
    # =========================================================================
    # Loop is unavoidable: listener state at t depends on utterances u_0...u_{t-1}
    
    utilities_list = []
    
    for t in range(steps_needed):
        obs = obs_seq[t]
        obs_key = tuple(obs) if not isinstance(obs, tuple) else obs
        
        # Extract utilities directly from speaker.utility DataFrame
        utilities = speaker.utility[obs_key].values.copy()
        utilities_list.append(utilities)
        
        # Update listener with observed utterance
        utt = utt_seq[t]
        speaker.literal_listener.listen_and_update(utt)
        
        # Recompute utility table for new listener state
        speaker.utterance_log_prob_obs = speaker._compute_utterance_log_prob_obs(speaker.alpha)
    
    # Stack: shape (steps_needed, n_utterances)
    utilities_matrix = np.stack(utilities_list)
    
    # Observed utterance indices: shape (steps_needed,)
    utt_indices = np.array([utt_to_idx[utt_seq[t]] for t in range(steps_needed)])
    
    # =========================================================================
    # COMPUTE LOG PROBABILITIES FOR ALL ALPHAS AND TIME STEPS
    # =========================================================================
    
    all_log_probs = np.zeros((n_alphas, steps_needed))
    
    if has_numeric:
        alphas_arr = np.array(numeric_alphas)
        
        # Scale utilities: α * U(u, O)
        # Shape: (n_numeric, steps_needed, n_utterances)
        scaled_utilities = (alphas_arr[:, np.newaxis, np.newaxis] * 
                          utilities_matrix[np.newaxis, :, :])
        
        # Log normalizers: logsumexp over utterances
        # Shape: (n_numeric, steps_needed)
        log_normalizers = logsumexp(scaled_utilities, axis=2)
        
        # Scaled utilities for observed utterances
        # Shape: (n_numeric, steps_needed)
        observed_scaled = scaled_utilities[:, np.arange(steps_needed), utt_indices]
        
        # Log P(u|O, α) = α*U(u) - logsumexp(α*U)
        log_probs_numeric = observed_scaled - log_normalizers
        
        all_log_probs[np.array(numeric_indices), :] = log_probs_numeric
    
    # =========================================================================
    # HANDLE DETERMINISTIC ALPHA
    # =========================================================================
    
    if has_determ:
        # Max utility at each step
        max_utilities = np.max(utilities_matrix, axis=1)
        
        # Utility of observed utterance at each step
        observed_utilities = utilities_matrix[np.arange(steps_needed), utt_indices]
        
        # Check if observed is among maxima
        is_max = np.isclose(observed_utilities, max_utilities)
        
        # Count ties
        is_max_all = np.isclose(utilities_matrix, max_utilities[:, np.newaxis])
        n_ties = np.sum(is_max_all, axis=1)
        
        # Log prob: -log(n_ties) if max, -inf otherwise
        determ_log_probs = np.where(is_max, -np.log(n_ties), -np.inf)
        all_log_probs[determ_idx, :] = determ_log_probs
    
    # =========================================================================
    # CUMULATIVE SUM AND EXTRACT FOR EACH T
    # =========================================================================
    
    cumsum_log_probs = np.cumsum(all_log_probs, axis=1)
    all_lls = cumsum_log_probs[:, T_indices]
    
    # Handle -inf propagation
    has_neginf = np.isneginf(all_log_probs)
    for t_idx, T in enumerate(Ts):
        has_neginf_up_to_T = np.any(has_neginf[:, :T], axis=1)
        all_lls[has_neginf_up_to_T, t_idx] = -np.inf
    
    return all_lls



def _dynamic_grid_search_multiT(
    flat_data: List[Dict[str, Any]],
    world: 'World',
    psi: str,
    Ts: List[int],
    alpha_bounds: Tuple[float, float],
    grid_spacing: str,
    n_grid: int,
    include_determ: bool,
    n_jobs: int,
    backend: str,
    verbose: int
) -> Dict[str, List[Dict[int, Any]]]:
    """
    Grid search for optimal alpha with dynamic speaker.
    
    Parallelizes over sequences.
    
    Returns
    -------
    Dict with "max_log_lik" and "optimal_alpha" lists.
    """
    
    n_total = len(flat_data)
    n_Ts = len(Ts)
    
    # Create alpha grid
    a_min, a_max = alpha_bounds
    if grid_spacing == "log":
        alphas = list(np.exp(np.linspace(np.log(a_min), np.log(a_max), n_grid)))
    else:
        alphas = list(np.linspace(a_min, a_max, n_grid))
    
    if include_determ:
        alphas.append("determ")
    
    alphas_array = np.array(alphas, dtype=object)
    
    # Worker function
    def evaluate_single(item):
        return _dynamic_evaluate_sequence_all_alphas(
            obs_seq=item["obs_seq"],
            utt_seq=item["utt_seq"],
            world=world,
            psi=psi,
            alphas=alphas,
            Ts=Ts
        )
    
    # Execute
    if n_jobs == 1:
        all_results = [evaluate_single(item) for item in flat_data]
    else:
        all_results = Parallel(n_jobs=n_jobs, backend=backend, verbose=verbose)(
            delayed(evaluate_single)(item) for item in flat_data
        )
    
    # Stack: shape (n_total, n_alphas, n_Ts)
    all_lls = np.array(all_results)
    
    # Find optimal alpha for each (sequence, T)
    # Transpose to (n_alphas, n_total, n_Ts) for argmax
    all_lls_T = all_lls.transpose(1, 0, 2)
    best_alpha_indices = np.argmax(all_lls_T, axis=0)
    
    # Extract max log-likelihoods
    row_idx = np.arange(n_total)[:, np.newaxis]
    T_idx = np.arange(n_Ts)[np.newaxis, :]
    max_lls = all_lls_T[best_alpha_indices, row_idx, T_idx]
    
    # Convert to list of dicts
    max_log_lik_list = []
    optimal_alpha_list = []
    
    for i in range(n_total):
        max_log_lik_list.append({
            T: float(max_lls[i, t_idx]) for t_idx, T in enumerate(Ts)
        })
        optimal_alpha_list.append({
            T: alphas_array[best_alpha_indices[i, t_idx]] for t_idx, T in enumerate(Ts)
        })
    
    return {
        "max_log_lik": max_log_lik_list,
        "optimal_alpha": optimal_alpha_list
    }



def _dynamic_scipy_optimization_multiT(
    flat_data: List[Dict[str, Any]],
    world: 'World',
    psi: str,
    Ts: List[int],
    alpha_bounds: Tuple[float, float],
    include_determ: bool,
    n_jobs: int,
    backend: str,
    verbose: int
) -> Dict[str, List[Dict[int, Any]]]:
    """
    Scipy optimization for optimal alpha with dynamic speaker.
    
    Runs separate optimization for each (sequence, T) pair.
    
    Returns
    -------
    Dict with "max_log_lik" and "optimal_alpha" lists.
    """
    
    n_total = len(flat_data)
    
    # Build tasks: one per (sequence, T)
    tasks = []
    for item_idx, item in enumerate(flat_data):
        for T in Ts:
            tasks.append({
                "item_idx": item_idx,
                "T": T,
                "obs_seq": item["obs_seq"][:T],
                "utt_seq": item["utt_seq"][:T]
            })
    
    if verbose > 0:
        print(f"  Running {len(tasks)} scipy optimizations...")
    
    # Worker function
    def optimize_single(task):
        base_config = {
            "speaker_type": "pragmatic",
            "omega": "strat",
            "psi": psi,
            "update_internal": True,
            "beta": 0.0,
            "initial_beliefs_theta": None
        }
        
        result = log_likelihood_alpha_opt_utt_seq(
            world=world,
            obs_seq=task["obs_seq"],
            utt_seq=task["utt_seq"],
            speaker_config=base_config,
            alpha_bounds=alpha_bounds,
            grid_search=False,
            include_determ=include_determ
        )
        
        return {
            "item_idx": task["item_idx"],
            "T": task["T"],
            "optimal_alpha": result["optimal_alpha"],
            "max_log_lik": result["max_log_likelihood"]
        }
    
    # Execute
    if n_jobs == 1:
        results = [optimize_single(task) for task in tasks]
    else:
        results = Parallel(n_jobs=n_jobs, backend=backend, verbose=verbose)(
            delayed(optimize_single)(task) for task in tasks
        )
    
    # Reorganize by item_idx
    max_log_lik_list = [{} for _ in range(n_total)]
    optimal_alpha_list = [{} for _ in range(n_total)]
    
    for res in results:
        item_idx = res["item_idx"]
        T = res["T"]
        max_log_lik_list[item_idx][T] = res["max_log_lik"]
        optimal_alpha_list[item_idx][T] = res["optimal_alpha"]
    
    return {
        "max_log_lik": max_log_lik_list,
        "optimal_alpha": optimal_alpha_list
    }


