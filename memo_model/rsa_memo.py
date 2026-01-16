"""
RSA agents implemented using Memo framework.

"""
## Dependencies and Packages
from memo import memo
import jax.numpy as jnp
import jax
import numpy as np
from jax.scipy.special import logsumexp
from typing import Union
from scipy.special import gammaln, logsumexp, softmax
from enum import IntEnum
from memo.lib import *
from world_jax import WorldJAX

try:
    # NumPy ≥2.0
    from numpy.lib.array_utils import normalize_axis_tuple, normalize_axis_index
except ModuleNotFoundError:
    # NumPy <2.0
    from numpy.core.numeric import normalize_axis_tuple, normalize_axis_index


np.seterr(over='warn', under='warn')
precision = False

## Helper Functions
@jax.jit
def log_matmul(LA: jnp.ndarray, LB: jnp.ndarray) -> jnp.ndarray:
    """
    Log-space matrix multiplication using JAX.
    
    Compute log(A @ B) given log(A) and log(B).
    Uses logsumexp for numerical stability.
    
    Parameters
    ----------
    LA : jnp.ndarray
        Shape (m, k), log-transformed matrix A
    LB : jnp.ndarray
        Shape (k, n), log-transformed matrix B
        
    Returns
    -------
    jnp.ndarray
        Shape (m, n), log of matrix product
    """
    # Compute all pairwise sums: LA[i,s] + LB[s,j]
    # Shape: (m, k, n)
    log_products = LA[:, :, None] + LB[None, :, :]
    
    # Sum over middle dimension using logsumexp for stability
    # Result shape: (m, n)
    return logsumexp(log_products, axis=1)


@jax.jit
def log_normalize_columns(LX: jnp.ndarray) -> jnp.ndarray:
    """
    Normalize columns of a log-space matrix so each column sums to 1.
    
    Parameters
    ----------
    LX : jnp.ndarray
        Shape (m, n), log-transformed values
        
    Returns
    -------
    jnp.ndarray
        Shape (m, n), column-normalized in log-space
    """
    # Compute log of column sums
    log_col_sums = logsumexp(LX, axis=0, keepdims=True)
    
    # Subtract to normalize
    return LX - log_col_sums


@jax.jit
def log_normalize_rows(LX: jnp.ndarray) -> jnp.ndarray:
    """
    Normalize rows of a log-space matrix so each row sums to 1.
    
    Parameters
    ----------
    LX : jnp.ndarray
        Shape (m, n), log-transformed values
        
    Returns
    -------
    jnp.ndarray
        Shape (m, n), row-normalized in log-space
    """
    log_row_sums = logsumexp(LX, axis=1, keepdims=True)
    return LX - log_row_sums


@jax.jit
def log_softmax_columns(X: jnp.ndarray, alpha: float) -> jnp.ndarray:
    """
    Apply softmax down each column with temperature parameter alpha.
    
    Parameters
    ----------
    X : jnp.ndarray
        Shape (m, n), utility/score matrix
    alpha : float
        Temperature parameter (rationality)
        
    Returns
    -------
    jnp.ndarray
        Shape (m, n), log probabilities
    """
    # Scale by temperature
    scaled = alpha * X
    
    # Apply log-softmax
    return scaled - logsumexp(scaled, axis=0, keepdims=True)


@jax.jit
def log_argmax_columns(X: jnp.ndarray) -> jnp.ndarray:
    """
    Deterministic argmax down each column (ties split uniformly).
    
    Parameters
    ----------
    X : jnp.ndarray
        Shape (m, n), utility/score matrix
        
    Returns
    -------
    jnp.ndarray
        Shape (m, n), log probabilities
    """
    # Find max in each column
    col_max = jnp.max(X, axis=0, keepdims=True)
    
    # Create mask for max values (handles ties)
    is_max = (X == col_max)
    
    # Count number of maxes per column
    num_max = jnp.sum(is_max, axis=0, keepdims=True)
    
    # Split probability uniformly among ties
    # log(1/num_max) if is_max, else -inf
    return jnp.where(is_max, -jnp.log(num_max), -jnp.inf)


def log_softmax_or_argmax_columns(X: jnp.ndarray, alpha: Union[float, str]) -> jnp.ndarray:
    """
    Apply either softmax or deterministic argmax based on alpha.
    
    Parameters
    ----------
    X : jnp.ndarray
        Shape (m, n), utility/score matrix
    alpha : float or "determ"
        Temperature parameter or "determ" for deterministic
        
    Returns
    -------
    jnp.ndarray
        Shape (m, n), log probabilities
    """
    if alpha == "determ":
        return log_argmax_columns(X)
    else:
        return log_softmax_columns(X, alpha)


@jax.jit
def bayesian_update_log(log_prior: jnp.ndarray, log_likelihood: jnp.ndarray) -> jnp.ndarray:
    """
    Bayesian update in log-space (unnormalized).
    
    log posterior ∝ log prior + log likelihood
    
    Parameters
    ----------
    log_prior : jnp.ndarray
        Shape (n,), log prior probabilities
    log_likelihood : jnp.ndarray
        Shape (n,), log likelihood values
        
    Returns
    -------
    jnp.ndarray
        Shape (n,), unnormalized log posterior
    """
    return log_prior + log_likelihood


@jax.jit
def expectation_from_log_probs(values: jnp.ndarray, log_probs: jnp.ndarray) -> float:
    """
    Compute expectation E[values] given log probabilities.
    
    E[X] = sum_i x_i * p_i
         = sum_i x_i * exp(log p_i)
         = sum_i exp(log x_i + log p_i)  (if x_i > 0)
    
    Parameters
    ----------
    values : jnp.ndarray
        Shape (n,), values to compute expectation over
    log_probs : jnp.ndarray
        Shape (n,), log probabilities (normalized or unnormalized)
        
    Returns
    -------
    float
        Expected value
    """
    # Normalize log probs first
    normalized_log_probs = log_probs - logsumexp(log_probs)
    
    # Compute expectation
    return jnp.sum(values * jnp.exp(normalized_log_probs))


@jax.jit
def log_expectation_from_log_probs(log_values: jnp.ndarray, log_probs: jnp.ndarray) -> float:
    """
    Compute log of expectation: log(E[exp(log_values)]).
    
    Parameters
    ----------
    log_values : jnp.ndarray
        Shape (n,), log-transformed values
    log_probs : jnp.ndarray
        Shape (n,), log probabilities
        
    Returns
    -------
    float
        log of expectation
    """
    # Normalize log probs
    normalized_log_probs = log_probs - logsumexp(log_probs)
    
    # log E[X] = logsumexp(log X + log P)
    return logsumexp(log_values + normalized_log_probs)


@jax.jit
def literal_semantics_uniform(utterance_truth: jnp.ndarray) -> jnp.ndarray:
    """
    Compute literal speaker probabilities: uniform over true utterances.
    
    P(u|O) = 1/|{u: Truth(u,O)=1}| if Truth(u,O)=1, else 0
    
    Parameters
    ----------
    utterance_truth : jnp.ndarray
        Shape (n_utterances, n_observations), binary truth values
        
    Returns
    -------
    jnp.ndarray
        Shape (n_utterances, n_observations), log P(u|O)
    """
    # Count number of true utterances per observation
    num_true = jnp.sum(utterance_truth, axis=0, keepdims=True)
    
    # Uniform over true utterances, -inf for false
    log_prob = jnp.where(
        utterance_truth == 1,
        -jnp.log(num_true),
        -jnp.inf
    )
    
    return log_prob


# ============ Utility Functions for RSA ============

@jax.jit
def informativeness(log_prob_state_given_utt: jnp.ndarray) -> jnp.ndarray:
    """
    Compute informativeness (negative entropy / surprisal).
    
    Informativeness = -H(theta|u) = sum_theta P(theta|u) * log P(theta|u)
    
    Parameters
    ----------
    log_prob_state_given_utt : jnp.ndarray
        Shape (n_states,), log P(theta|u)
        
    Returns
    -------
    float
        Informativeness value
    """
    # Normalize first
    normalized = log_prob_state_given_utt - logsumexp(log_prob_state_given_utt)
    probs = jnp.exp(normalized)
    
    # Compute negative entropy (clip to avoid log(0))
    return jnp.sum(probs * normalized)

@jax.jit  
def persuasiveness_up(theta_values: jnp.ndarray, log_prob_theta: jnp.ndarray) -> float:
    """
    Compute persuasiveness for "pers+" goal: E[theta|u].
    
    Parameters
    ----------
    theta_values : jnp.ndarray
        Shape (n_theta,), possible theta values
    log_prob_theta : jnp.ndarray
        Shape (n_theta,), log P(theta|u)
        
    Returns
    -------
    float
        Expected theta value
    """
    return expectation_from_log_probs(theta_values, log_prob_theta)


@jax.jit
def persuasiveness_down(theta_values: jnp.ndarray, log_prob_theta: jnp.ndarray) -> float:
    """
    Compute persuasiveness for "pers-" goal: E[1-theta|u].
    
    Parameters
    ----------
    theta_values : jnp.ndarray
        Shape (n_theta,), possible theta values
    log_prob_theta : jnp.ndarray
        Shape (n_theta,), log P(theta|u)
        
    Returns
    -------
    float
        Expected (1-theta) value
    """
    one_minus_theta = 1.0 - theta_values
    return expectation_from_log_probs(one_minus_theta, log_prob_theta)


@jax.jit
def log_persuasiveness_up(theta_values: jnp.ndarray, log_prob_theta: jnp.ndarray) -> float:
    """
    Compute log of persuasiveness for "pers+" goal: log(E[theta|u]).
    
    Parameters
    ----------
    theta_values : jnp.ndarray
        Shape (n_theta,), possible theta values
    log_prob_theta : jnp.ndarray
        Shape (n_theta,), log P(theta|u)
        
    Returns
    -------
    float
        log of expected theta
    """
    # Need to be careful with theta=0
    log_theta = jnp.log(jnp.clip(theta_values, 1e-10, None))
    return log_expectation_from_log_probs(log_theta, log_prob_theta)


@jax.jit
def log_persuasiveness_down(theta_values: jnp.ndarray, log_prob_theta: jnp.ndarray) -> float:
    """
    Compute log of persuasiveness for "pers-" goal: log(E[1-theta|u]).
    
    Parameters
    ----------
    theta_values : jnp.ndarray
        Shape (n_theta,), possible theta values
    log_prob_theta : jnp.ndarray
        Shape (n_theta,), log P(theta|u)
        
    Returns
    -------
    float
        log of expected (1-theta)
    """
    one_minus_theta = 1.0 - theta_values
    log_one_minus_theta = jnp.log(jnp.clip(one_minus_theta, 1e-10, None))
    return log_expectation_from_log_probs(log_one_minus_theta, log_prob_theta)

def validate_log_probs(log_probs: jnp.ndarray, axis: int = -1, tol: float = 1e-6) -> bool:
    """
    Validate that log probabilities sum to 1 (in linear space).
    
    Parameters
    ----------
    log_probs : jnp.ndarray
        Log probability array
    axis : int
        Axis to sum over
    tol : float
        Tolerance for checking sum = 1
        
    Returns
    -------
    bool
        True if valid
    """
    sums = jnp.exp(logsumexp(log_probs, axis=axis))
    return jnp.allclose(sums, 1.0, atol=tol)



## Helper Functions for Memo Agents

def uniform_prior_log(n_theta: int) -> jnp.ndarray:
    """
    Create a uniform prior distribution over theta values in log space.

    Parameters
    ----------
    n_theta : int
        Number of theta values

    Returns
    -------
    jnp.ndarray
        Shape (n_theta,), log probabilities
    """
    return jnp.full(n_theta, -jnp.log(n_theta))

def extract_distributions_from_s0_belief(s0_dist_belief):
    """
    Extract P(theta | obs) and P(u | obs) from S0_belief output using JAX.

    Args:
        s0_dist_belief: tuple of arrays with shapes (20, 32, 11) each
            [0]: belief component
            [1]: utterance component

    Returns:
        theta_belief: P(theta | obs) with shape (20, 11)
        u_prob: P(u | obs) with shape (20, 32)
    """
    belief_raw = s0_dist_belief[0]  # Shape: (20, 32, 11)
    u_raw = s0_dist_belief[1]        # Shape: (20, 32, 11)

    # P(theta | obs): marginalize over u (sum over axis 1)
    # This is more efficient than looping
    theta_belief = jnp.sum(belief_raw, axis=1)  # Shape: (20, 11)

    # Normalize each observation's theta distribution
    theta_belief = theta_belief / jnp.sum(theta_belief, axis=-1, keepdims=True)

    # P(u | obs): Since u_raw[obs, u, :] is constant across theta,
    # we can just take the first theta slice for efficiency
    # This is equivalent to: jnp.sum(u_raw, axis=2) / 11
    # but more efficient:
    u_prob = u_raw[:, :, 0]  # Shape: (20, 32)

    # If values aren't normalized, normalize them
    # (but based on the structure, they should already be proportional)
    u_prob = u_prob / jnp.sum(u_prob, axis=-1, keepdims=True)

    return theta_belief, u_prob


def extract_utterance_probs_from_s1(s1_output):
    """
    Extract and normalize P(u | obs) from S1 speaker output (e.g., S1_inf, S1_pers_up, S1_pers_down).

    Args:
        s1_output: array-like output from S1 speaker
            Shape (n_obs, n_utt, n_theta) - needs to marginalize over theta
            OR shape (n_obs, n_utt) - already marginalized

    Returns:
        u_prob: P(u | obs) with shape (n_obs, n_utt), normalized
    """
    # Convert to jax array
    s1_array = jnp.array(s1_output)

    # If 3D (n_obs, n_utt, n_theta), marginalize over theta dimension
    if s1_array.ndim == 3:
        # Sum over theta axis (axis=2) to get P(u | obs)
        u_prob = jnp.sum(s1_array, axis=2)  # Shape: (n_obs, n_utt)
    else:
        u_prob = s1_array

    # Normalize to ensure valid probability distribution
    u_prob = u_prob / jnp.sum(u_prob, axis=-1, keepdims=True)

    return u_prob

