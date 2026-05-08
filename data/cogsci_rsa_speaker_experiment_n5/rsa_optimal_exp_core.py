"""
rsa_optimal_exp_core.py

Core RSA classes and numerical helper functions.
"""

# =============================================================================
# Dependencies and Packages
# =============================================================================

import math
import warnings
import itertools
from typing import List, Dict, Union, Optional, Tuple, TypeVar, Iterator, Callable, Any, Literal
import numpy as np
import pandas as pd
import xarray as xr
from scipy.special import gammaln, logsumexp

USE_PRECISE_LOGSPACE = False

np.seterr(divide='ignore', under='ignore')

# =============================================================================
# HELPER FUNCTIONS (log-space numerics)
# =============================================================================

## Helper functions

def log_M_product(LA, LB, precise=False, margin=None):
    """
    Compute the matrix product of two matrices A and B in log-space
    The inputs LA, LB are log-transformed values of non-negative matrix A and B.
    The output LC is the product of A and B in log-space.

    In the log-space, the dot product is computed as:
        LC[i,j] = log( sum_{s=1}^k exp(LA[i,s] + LB[s,j]) )
                = m +  log( sum_{s=1}^k exp(LA[i,s] + LB[s,j] - m) )

    Uses a more spacious shift that still prevents overflow but more robust to underflow:
          m = max_s (LA[i,s]+LB[s,j]) + log(n) - log(M_max) + margin
    where margin defaults to -log(eps) for float64.

    Input Validations:
      - Both LA and LB must be numpy ndarrays.
      - Both LA and LB must be 2-dimensional.
      - The number of columns in LA must equal the number of rows in LB.
      - Both LA and LB must have a floating-point data type (to represent log values).
      - Neither LA nor LB should contain positive infinity.

    Parameters:
      LA : np.ndarray
          2D numpy array of shape (m, k) representing the log-transformed values of matrix A
          (i.e., LA[i,s] = log(a[i,s]), with a[i,s] >= 0 and log(0) = -np.inf).
      LB : np.ndarray
          2D numpy array of shape (k, n) representing the log-transformed values of matrix B
          (i.e., LB[s,j] = log(b[s,j]), with b[s,j] >= 0 and log(0) = -np.inf).

    Returns:
      LC : np.ndarray
          2D numpy array of shape (m, n) representing the log-space dot product:
          LC[i,j] = log(sum_{s=1}^k exp(LA[i,s] + LB[s,j])).

    Raises:
      TypeError: If LA or LB is not a numpy ndarray, or if the arrays are not of a floating-point type.
      ValueError: If LA or LB is not 2-dimensional, if their inner dimensions are incompatible,
                  or if either input contains positive infinity.
    """

    # --- Input Validations ---
    if not (isinstance(LA, np.ndarray) and isinstance(LB, np.ndarray)):
        raise TypeError("Both LA and LB must be numpy ndarrays.")
    if LA.ndim != 2 or LB.ndim != 2:
        raise ValueError("Both LA and LB must be 2-dimensional.")
    if LA.shape[1] != LB.shape[0]:
        raise ValueError("The number of columns in LA must equal the number of rows in LB for multiplication.")
    if not (np.issubdtype(LA.dtype, np.floating) and np.issubdtype(LB.dtype, np.floating)):
        raise TypeError("Both LA and LB must have a floating-point data type representing log values.")
    if np.any(LA == np.inf) or np.any(LB == np.inf):
        raise ValueError("Input matrices must not contain positive infinity.")
    LA = np.asarray(LA, dtype=np.float64)
    LB = np.asarray(LB, dtype=np.float64)

    # --- Compute all pairwise products in log-space: shape (m, k, n) ---
    log_products = LA[:, :, None] + LB[None, :, :]

    if not precise:
        LC = logsumexp(log_products, axis=1)

    else:
        # --- Prepare constants ---
        if margin is None:
            margin = -np.log(np.finfo(LA.dtype).eps)   # ≈ 36 for float64
        M_max = np.finfo(LA.dtype).max
        k = LA.shape[1]

        # --- Spacious Log-Sum-Exp trick ---
        max_lp = np.max(log_products, axis=1)   # shape (m,n)
        all_neginf = (max_lp == -np.inf) # mask for all -inf slices
        shift = max_lp + np.log(k) - np.log(M_max) + margin # the shift parameter
        shift = np.where(all_neginf, 0.0, shift)   # avoiding shifting all -inf slices by -inf

        shifted_lp = log_products - shift[:, None, :]

        exp_shifted_lp = np.exp(shifted_lp)

        sum_exp_shifted_lp = np.apply_along_axis(math.fsum, 1, exp_shifted_lp)  # shape (m,n)

        LC = shift + np.log(np.clip(sum_exp_shifted_lp, np.finfo(float).tiny, None))
        LC = np.where(sum_exp_shifted_lp == 0.0, -np.inf, LC)

    return LC



def log_column_normalize(LX, precise=False):
    """
    Normalize a matrix of log-values so that each column values sum to one.

    In the log-space, the normalization by columns is computed as:
        NLX[i,j] = log( X[i,j] / sum_{s=1}^n X[s,j] )
                 = log( X[i,j] ) - log( sum_{s=1}^n X[s,j] )
                 = LX[i,j] - log( sum_{s=1}^n exp(LX[s,j]) )
                 = LX[i,j] - [ m[j] + log( sum_{s=1}^n exp(LX[s,j] - m[j]) ) ]
                 = ( LX[i,j] -  m[j] ) - log( sum_{s=1}^n exp(LX[s,j] - m[j]) )

    Uses a more spacious shift that still prevents overflow but more robust to underflow:
          m[j] = max_s {LX[s,j]} + log(n) - log(M_max) + margin
    where margin defaults to -log(eps) for float64.

    Input Validations:
      - LX must be numpy ndarrays.
      - LX must be 2-dimensional.
      - LX must have a floating-point data type (to represent log values).
      - LX must NOT contain positive infinity.

    Parameters:
    LX (np.array): A 2d-array containing the log(x_i) values.
    precise (bool): If True, uses a highly precise custom implementation
                   with enhanced numerical stability. If False, uses scipy.special.logsumexp
                   for faster computation with standard numerical stability.

    Returns:
    np.array: A 2d-array containing the log of normalized values.

    Raises:
      TypeError: If LX is not a numpy ndarray, or if the arrays are not of a floating-point type.
      ValueError: If LX is not 2-dimensional, or if input contains positive infinity.
    """

    # --- Input Validations ---
    if not isinstance(LX, np.ndarray):
        raise TypeError("LX must be numpy ndarrays.")
    if LX.ndim != 2:
        raise ValueError("LX must be 2-dimensional.")
    if not np.issubdtype(LX.dtype, np.floating):
        raise TypeError("LX must have a floating-point data type representing log values.")
    if np.any(LX == np.inf):
        raise ValueError("Input matrices must not contain positive infinity.")
    if np.any(np.isnan(LX)):
        raise ValueError("Input contains NaN")
        
    if not precise:
        # Compute log column sums using scipy's optimized implementation
        log_column_sums = logsumexp(LX, axis=0)

        # Handle all -inf columns (same as original)
        all_neg_inf_cols = np.all(LX == -np.inf, axis=0)
        if np.any(all_neg_inf_cols):
            warnings.warn("Input has column of all -inf", UserWarning)
            log_column_sums = np.where(all_neg_inf_cols, 0, log_column_sums)

        return LX - log_column_sums

    else:
        # --- Perform the precise log-space normalization ---
        M_LX = np.max(LX, axis=0) # shape: (n,)
        if np.any(M_LX == -np.inf):
            warnings.warn("Input has column of all -inf", UserWarning)

        n = LX.shape[0]
        margin = -np.log(np.finfo(LX.dtype).eps)
        shift = M_LX + np.log(n) - np.log(np.finfo(LX.dtype).max) + margin

        # all -inf slice will have max of -inf and thus no need to shift
        zeros_shift = shift == -np.inf
        shift = np.where(zeros_shift, 0, shift)

        LX_shifted = LX - shift  # shape: (m, n) - (1, n) = (m, n)

        # Exponentials of the normalized values.
        exp_LX_shifted = np.exp(LX_shifted)

        # Sum along the axis s.
        sum_exp_LX_shifted = np.apply_along_axis(math.fsum, axis=0, arr=exp_LX_shifted)
        log_sum_exp_LX_shifted = np.log(np.clip(sum_exp_LX_shifted, np.finfo(float).tiny, None))
        log_sum_exp_LX_shifted[zeros_shift] = 0

        return LX_shifted - log_sum_exp_LX_shifted



def log_column_softmax(X, alpha, precise=False):
    """
    Take in a score matrix X of shape (m, n), compute either
      - the log‑softmax (alpha is float) or
      - the log‑argmax (alpha == "determ") down each column,
    and return a (m, n) array of log‑probabilities.

    In log‑space, for each column j, log-softmax is calculated as:
        m_j = max_k X[k,j] + log(m) - log(M_max) + margin
        log_prob[i,j] = alpha * (X[i,j] − m_j)
                         − log( sum_{l=1}^m exp( alpha * (X[l,j] − m_j) ) )

    For alpha=="determ", ties at the max split equally:
        log_prob[i,j] = -log(count_max_j)  if X[i,j] == max_k X[k,j]
                      = -inf               otherwise

    Input Validations:
      - X must be a numpy.ndarray of floats, 2-dimensional, with no NaN/inf
      - alpha must be a positive float or the string "determ"

    Returns:
      log_prob : np.ndarray of shape (m, n), the log-probabilities
    """

    # Validate X
    if not isinstance(X, np.ndarray):
        raise TypeError("X must be a numpy.ndarray")
    if X.ndim != 2:
        raise ValueError(f"X must be 2-dimensional (got ndim={X.ndim})")
    if not np.issubdtype(X.dtype, np.floating):
        raise TypeError("X must have a floating-point dtype")
    if np.isnan(X).any():
        raise ValueError("X must not contain NaN values")
    if np.any(X == np.inf):
        raise ValueError("X must not contain positive infinity.")

    # Validate alpha
    if not (isinstance(alpha, float) or (isinstance(alpha, str) and alpha == "determ")):
        raise TypeError("alpha must be a float or the string 'determ'")
    if isinstance(alpha, float) and alpha <= 0:
        raise ValueError("alpha must be positive when using softmax")

    # Branch on alpha
    if alpha == "determ":
        # Hard argmax with equal splitting of ties
        col_max = np.max(X, axis=0)
        if np.any(col_max == -np.inf):  # Reject columns that are all -inf
            raise ValueError("Cannot compute softmax: some columns are all -inf")
        mask = X == col_max
        counts = mask.sum(axis=0)
        log_prob = np.where(mask, -np.log(counts)[np.newaxis, :], -np.inf)

    else:

        if not precise:
            # Softmax branch - simplified with scipy.special.logsumexp
            if np.any(np.max(X, axis=0) == -np.inf):  # Reject columns that are all -inf
                raise ValueError("Cannot compute softmax: some columns are all -inf")
            scaled = alpha * X
            log_prob = scaled - logsumexp(scaled, axis=0)

        else:
            # Softmax branch
            m, n = X.shape
            # Compute spacious shift
            scaled = alpha * X
            col_max = np.max(scaled, axis=0)
            if np.any(col_max == -np.inf):  # Reject columns that are all -inf
                raise ValueError("Cannot compute softmax: some columns are all -inf")
            margin = -np.log(np.finfo(X.dtype).eps)
            M_max = np.finfo(X.dtype).max
            shift = col_max + np.log(m) - np.log(M_max) + margin
            # Scale, shift, exponentiate, and sum
            scaled_shifted = scaled - shift
            exp_scaled_shifted = np.exp(scaled_shifted)
            sum_exp_scaled_shifted = np.apply_along_axis(math.fsum, 0, exp_scaled_shifted)

            # Compute log-sum-exp and normalize
            log_sum_exp_scaled_shifted = np.log(sum_exp_scaled_shifted)
            log_prob = scaled_shifted - log_sum_exp_scaled_shifted

    return log_prob



# =============================================================================
# WORLD CLASS
# =============================================================================

## World Model

class World:
    """
    A class representing the world state in the pragmatic communication game.

    This class encapsulates the complete state space of possible observations,
    their likelihoods under different theta values, and semantic truth values of utterances.
    """

    # Class constants
    SEMANTIC_OPERATORS = {
        "all": lambda x, N: int(x == N),
        "most": lambda x, N: int(x > N / 2),
        "some": lambda x, N: int(x >= 1),
        "no": lambda x, N: int(x == 0)
    }
    QUANTIFIERS = ["all", "most", "some", "no"]
    PREDICATES = ["successful", "unsuccessful"]
    DEFAULT_THETA_VALUES: np.ndarray = np.round(np.linspace(0, 1, 11), 1)

    def __init__(
        self,
        n: int,
        m: int,
        theta_values: Optional[np.ndarray] = None
    ) -> None:
        """Initialize the world with given parameters and compute all necessary tables."""
        # Validate n and m parameters
        if not isinstance(n, int) or not isinstance(m, int):
            raise ValueError("n and m must be integers")
        if n < 1 or m < 1:
            raise ValueError("n and m must be positive")

        self.n = n
        self.m = m
        self.complex = n > 1

        # Validate and process theta values
        self.theta_values = self._validate_theta_values(theta_values)

        try:
            # Generate possible outcomes
            self.possible_outcomes = self._generate_possible_outcomes(self.n, self.m)

            # Compute success likelihoods
            self.suc_log_likelihood_theta = self._compute_successes_log_likelihoods(
                self.n, self.m, self.theta_values
            )

            # Compute observation likelihoods
            self.obs_log_likelihood_theta = self._compute_observation_log_likelihoods(
                self.n, self.m, self.theta_values, self.possible_outcomes
            )

            # Compute utterance truth values
            self.utterance_truth = self._compute_utterance_truth_values(
                self.n, self.m, self.possible_outcomes,
                self.QUANTIFIERS, self.PREDICATES, self.SEMANTIC_OPERATORS
            )
        except Exception as e:
            raise RuntimeError(f"Failed to initialize world state: {str(e)}")

    def _validate_theta_values(
        self,
        theta_values: Optional[np.ndarray]
    ) -> np.ndarray:
        """
        Validate and process theta values.

        Parameters
        ----------
        theta_values : Optional[np.ndarray]
            Array of possible theta values between 0 and 1. If None, uses DEFAULT_THETA_VALUES.

        Returns
        -------
        np.ndarray
            Validated array of theta values.
        """
        if theta_values is None:
            return self.DEFAULT_THETA_VALUES

        if not isinstance(theta_values, np.ndarray):
            raise ValueError("theta_values must be a numpy array")
        if not np.all((theta_values >= 0) & (theta_values <= 1)):
            raise ValueError("All theta values must be between 0 and 1")
        if not np.array_equal(theta_values, np.unique(theta_values)):
            raise ValueError("theta values must be arranged and not duplicating")
        if not np.array_equal(theta_values, np.round(theta_values, decimals=10)):
            warnings.warn("theta values above precision is rounded to 10 decimals",
                         UserWarning)
            if not np.array_equal(np.round(theta_values, decimals=10),
                                 np.unique(np.round(theta_values, decimals=10))):
                warnings.warn("Rounded theta values are duplicating, they will be collapsed",
                             UserWarning)

        return np.unique(np.round(theta_values, decimals=10))

    def _generate_possible_outcomes(self, n: int, m: int) -> List[Tuple[int, ...]]:
        """
        Generate all possible outcomes as frequency tuples.

        Parameters
        ----------
        n : int
            Number of independent Binomial experiments.
        m : int
            Number of Bernoulli trials per experiment.

        Returns
        -------
        List[Tuple[int, ...]]
            List of all possible frequency tuples.
        """
        try:
            # Convert the generator to a list and return
            return list(self._generate_outcome_tuples(n, m))
        except Exception as e:
            raise RuntimeError(f"Failed to generate possible outcomes: {str(e)}")

    def _generate_outcome_tuples(self, n: int, m: int) -> Iterator[Tuple[int, ...]]:
        """
        Generate all tuples (n_0, n_1, ..., n_m) of nonnegative integers
        such that sum(n_i) = n.
        Uses the stars and bars method.

        Parameters
        ----------
        n : int
            Number of independent Binomial experiments.
        m : int
            Number of Bernoulli trials per experiment.

        Yields
        ------
        Tuple[int, ...]
            Each possible outcome frequency tuple.
        """
        for dividers in itertools.combinations(range(n + m), m):
            counts = []
            prev = -1
            for d in dividers:
                counts.append(d - prev - 1)
                prev = d
            counts.append(n + m - prev - 1)
            yield tuple(counts)

    def _compute_successes_log_likelihoods(
        self,
        n: int,
        m: int,
        theta_values: np.ndarray
    ) -> pd.DataFrame:
        """
        Compute log P(S=s | theta) for S ~ Binomial(N, theta), where N = n*m.

        Parameters
        ----------
        n : int
            Number of independent Binomial experiments.
        m : int
            Number of Bernoulli trials per experiment.
        theta_values : np.ndarray
            Array of possible theta values.

        Returns
        -------
        pd.DataFrame
            DataFrame with rows indexed by s (total successes),
            columns by theta values, and values are log-probabilities.
        """
        try:
            N = n * m
            thetas = theta_values

            # Precompute log binomial coefficient ln[ C(N, s) ] for s=0..N
            s = np.arange(N+1)
            log_binom = (gammaln(N+1) - gammaln(s+1) - gammaln(N-s+1))

            # Prepare an array of shape (N+1, len(thetas))
            log_probs = np.empty((N+1, thetas.size))

            # Handle interior thetas (0 < theta < 1)
            mask = (thetas > 0) & (thetas < 1)
            theta_int = thetas[mask]
            if mask.any():
                log_theta = np.log(theta_int)[None, :]   # shape (1, k)
                log_one_minus = np.log(1 - theta_int)[None, :]
                # broadcast: log_binom[:,None] + s[:,None]*log_theta + (N-s)[:,None]*log_one_minus
                log_probs[:, mask] = (log_binom[:, None] + s[:, None] * log_theta +
                                      (N - s)[:, None] * log_one_minus)

            # theta = 0: only s=0 has log‐prob 0, others −inf
            mask_zero = thetas == 0
            log_probs[:, mask_zero] = -np.inf
            log_probs[0, mask_zero] = 0.0

            # theta = 1: only s=N has log‐prob 0, others −inf
            mask_one = thetas == 1
            log_probs[:, mask_one] = -np.inf
            log_probs[N, mask_one] = 0.0

            # Build DataFrame: rows indexed by s, columns by theta
            df = pd.DataFrame(log_probs,
                             index=range(N+1),
                             columns=thetas)
            return df
        except Exception as e:
            raise RuntimeError(f"Failed to compute success likelihoods: {str(e)}")

    def _compute_observation_log_likelihoods(
        self,
        n: int,
        m: int,
        theta_values: np.ndarray,
        possible_outcomes: List[Tuple[int, ...]]
    ) -> pd.DataFrame:
        """
        Compute a table of log-probabilities for each frequency tuple under each theta value.

        Parameters
        ----------
        n : int
            Number of independent Binomial experiments.
        m : int
            Number of Bernoulli trials per experiment.
        theta_values : np.ndarray
            Array of possible theta values.
        possible_outcomes : List[Tuple[int, ...]]
            List of all possible frequency tuples.

        Returns
        -------
        pd.DataFrame
            DataFrame with rows as frequency tuples and columns as theta values,
            containing log-probabilities.
        """
        try:
            mask_interior = (theta_values > 0) & (theta_values < 1)
            theta_interior = theta_values[mask_interior]

            j_vals = np.arange(m + 1)  # 0, 1, ..., m
            log_binom = gammaln(m + 1) - gammaln(j_vals + 1) - gammaln(m - j_vals + 1)
            base_const = gammaln(n + 1)

            results = []      # list to hold log-probability vectors (one per frequency tuple)
            index_labels = [] # frequency tuples

            for counts in possible_outcomes:
                counts_arr = np.array(counts)
                full_log_prob = np.empty(theta_values.size, dtype=float)

                # For theta = 0 and theta = 1, assign manually:
                for idx, theta in enumerate(theta_values):
                    if theta == 0:
                        full_log_prob[idx] = 0.0 if counts[0] == n else -np.inf
                    elif theta == 1:
                        full_log_prob[idx] = 0.0 if counts[m] == n else -np.inf

                if np.any(mask_interior):
                    interior_log_theta = np.log(theta_interior)
                    interior_log_one_minus_theta = np.log(1 - theta_interior)
                    base = base_const - np.sum(gammaln(counts_arr + 1))
                    terms = (log_binom[:, None] +
                            j_vals[:, None] * interior_log_theta +
                            (m - j_vals)[:, None] * interior_log_one_minus_theta)
                    log_term = np.sum(counts_arr[:, None] * terms, axis=0)
                    interior_result = base + log_term
                    full_log_prob[mask_interior] = interior_result

                results.append(full_log_prob)
                index_labels.append(counts)

            results_array = np.array(results)
            df = pd.DataFrame(results_array, index=index_labels, columns=theta_values)
            return df
        except Exception as e:
            raise RuntimeError(f"Failed to compute observation likelihoods: {str(e)}")

    def _compute_utterance_truth_values(
        self,
        n: int,
        m: int,
        counts_list: List[Tuple[int, ...]],
        quantifiers: List[str],
        predicates: List[str],
        semantic_operators: Dict[str, Callable]
    ) -> pd.DataFrame:
        """
        Generate a truth table where each row is a possible utterance (as a string)
        and each column is a possible frequency tuple (as a tuple of ints).

        Parameters
        ----------
        n : int
            Number of independent Binomial experiments.
        m : int
            Number of Bernoulli trials per experiment.
        counts_list : List[Tuple[int, ...]]
            List of all possible frequency tuples.
        quantifiers : List[str]
            List of quantifiers ("all", "most", "some", "no").
        predicates : List[str]
            List of predicates ("successful", "unsuccessful").
        semantic_operators : Dict[str, Callable]
            Dictionary mapping quantifiers to their semantic functions.

        Returns
        -------
        pd.DataFrame
            DataFrame with rows as utterance strings, columns as frequency tuples,
            and values as truth values (1 or 0).
        """
        try:
            # Inner helper to list all utterances
            def _generate_utterance(n: int, quantifiers: List[str], predicates: List[str]) -> List[Tuple[str, ...]]:
                if n > 1:
                    return list(itertools.product(quantifiers, quantifiers, predicates))
                else:
                    return list(itertools.product(quantifiers, predicates))

            utterances = _generate_utterance(n, quantifiers, predicates)
            counts_array = np.array(counts_list)             # shape (num_outcomes, n)
            truth_dict = {}

            if n == 1:
                # Single experiment: utterance = (quantifier, predicate)
                for utter in utterances:
                    q, p = utter
                    if p == "successful":
                        vec = np.array([semantic_operators[q](j, m)
                                      for j in range(m + 1)])
                    else:  # p == "unsuccessful"
                        vec = np.array([semantic_operators[q](m - j, m)
                                      for j in range(m + 1)])
                    truth_vals = counts_array.dot(vec)
                    utter_str = ",".join(utter)
                    truth_dict[utter_str] = truth_vals
            else:
                # Multiple experiments: utterance = (quantifier1, quantifier2, predicate)
                for utter in utterances:
                    q1, q2, p = utter
                    if p == "successful":
                        vec = np.array([semantic_operators[q2](j, m)
                                      for j in range(m + 1)])
                    else:  # p == "unsuccessful"
                        vec = np.array([semantic_operators[q2](m - j, m)
                                      for j in range(m + 1)])
                    inner_sum = counts_array.dot(vec)
                    truth_func = np.vectorize(lambda x: semantic_operators[q1](x, n))
                    truth_vals = truth_func(inner_sum)
                    utter_str = ",".join(utter)
                    truth_dict[utter_str] = truth_vals

            # Keep the actual tuples as column labels
            freq_labels = counts_list
            df = pd.DataFrame(
                data = np.array(list(truth_dict.values())).T,
                index = freq_labels,
                columns = list(truth_dict.keys())
            )
            # Transpose so rows are utterances, columns are outcome‑tuples
            df = df.T

            uncovered = [obs for obs in df.columns if df[obs].sum() == 0]
            if uncovered:
                raise ValueError(
                    f"No utterance covers the following observations: {uncovered}"
                )

            return df

        except Exception as e:
            raise RuntimeError(f"Failed to compute utterance truth values: {str(e)}")


    def sample(
        self, 
        theta: float, 
        seed: Optional[int] = None, 
        reuse: bool = False
    ) -> Tuple[int, ...]:
        """
        Sample an observation set according to its probability under given theta.
    
        Parameters
        ----------
        theta : float
            The theta value to use for sampling (must be one of the predefined values).
        seed : Optional[int], default=None
            Random seed for reproducible sampling.
        reuse : bool, default=False
            Whether to reuse cached RNG if seed matches. If False, always creates new RNG.
            If True, reuses cached RNG when seed matches the previously used seed.
    
        Returns
        -------
        Tuple[int, ...]
            The sampled observation tuple.
        """
        if not 0 <= theta <= 1:
            raise ValueError("theta must be between 0 and 1")
    
        closest_theta = self.theta_values[np.abs(self.theta_values - theta).argmin()]
        if not np.isclose(theta, closest_theta, rtol=1e-10, atol=1e-10):
            raise ValueError(
                f"theta {theta} not found in theta_values. "
                f"Closest available value is {closest_theta}. "
                f"Available values are {self.theta_values}"
            )
    
        probabilities = np.exp(self.obs_log_likelihood_theta[closest_theta])
        
        # Manage cached RNG based on reuse parameter
        if reuse:
            # Try to reuse cached RNG if seed matches
            if (hasattr(self, '_cached_rng') and 
                hasattr(self, '_cached_seed') and 
                self._cached_seed == seed):
                rng = self._cached_rng
            else:
                # Create new RNG and cache it, with appropriate warning
                if not hasattr(self, '_cached_rng'):
                    warnings.warn(
                        f"reuse=True but no cached RNG exists. Creating new RNG with seed={seed}",
                        UserWarning
                    )
                else:
                    warnings.warn(
                        f"reuse=True but seed mismatch (cached: {self._cached_seed}, requested: {seed}). "
                        f"Creating new RNG with seed={seed}",
                        UserWarning
                    )
                rng = np.random.default_rng(seed)
                self._cached_rng = rng
                self._cached_seed = seed
        else:
            # Always create new RNG (original behavior)
            rng = np.random.default_rng(seed)
        
        sampled_observation = rng.choice(
            a=probabilities.index,
            p=probabilities.values
        )
        return sampled_observation
    

    def sample_run(
        self, 
        theta: float, 
        n_round: int, 
        run_seed: int) -> pd.DataFrame:
        """
        Sample multiple observations for a single simulation run.
        
        Parameters
        ----------
        theta : float
            The theta value to sample from (will find closest available theta)
        n_round : int
            Number of observations to sample in this run
        run_seed : int
            Random seed for reproducible sampling
            
        Returns
        -------
        pd.DataFrame
            DataFrame with columns: ['observation', 'theta', 'run_seed', 'round_index']
            Each row represents one sampled observation with its position in the sequence.
        """
        # Validate inputs
        if not isinstance(n_round, int) or n_round < 1:
            raise ValueError("n_round must be a positive integer") 
        
        if not 0 <= theta <= 1:
            raise ValueError("theta must be between 0 and 1")
        
        # Find closest theta
        closest_theta = self.theta_values[np.abs(self.theta_values - theta).argmin()]
        if not np.isclose(theta, closest_theta, rtol=1e-10, atol=1e-10):
            warnings.warn(
                f"theta {theta} not exactly in theta_values. Using closest: {closest_theta}",
                UserWarning
            )
        
        # Get probabilities for this theta (computed once)
        log_probs = self.obs_log_likelihood_theta[closest_theta]
        probabilities = np.exp(log_probs)
        observations_list = list(probabilities.index)
        prob_values = probabilities.values
        
        # Validation checks
        if not np.isclose(np.sum(prob_values), 1.0, rtol=1e-10):
            raise ValueError(f"Probabilities don't sum to 1: {np.sum(prob_values)}")
        if np.any(prob_values < 0):
            raise ValueError("Found negative probabilities")
        
        # Sample using seeded RNG for reproducibility
        rng = np.random.default_rng(run_seed)
        sampled_indices = rng.choice(
            len(observations_list), 
            size=n_round, 
            p=prob_values
        )
        
        # Convert indices to actual observations
        sampled_observations = [observations_list[idx] for idx in sampled_indices]
        
        return pd.DataFrame({
            "observation": sampled_observations,
            "theta": closest_theta,
            "run_seed": run_seed,
            "round_index": range(n_round)
        })
    
    def sample_multiple_runs(
        self, 
        theta: float, 
        n_run: int, 
        n_round: int, 
        base_seed: int = None
    ) -> pd.DataFrame:
        """
        Sample observations reproducibly for multiple simulation runs.
        
        Parameters
        ----------
        theta : float  
            The theta value to sample from (will find closest available theta)
        n_run : int
            Number of independent simulation runs
        n_round : int
            Number of observations to sample per run
        base_seed : int, default=None
            Base random seed for reproducibility. Each run gets base_seed + run_id
            
        Returns
        -------
        pd.DataFrame
            DataFrame with columns: ['theta', 'run_id', 'round_index', 'observation', 'run_seed']
            Each row represents one sampled observation, with round_index indicating 
            the sequence position (0 to n_round-1) within each run.
        """
        # Validate inputs
        if not isinstance(n_run, int) or n_run < 1:
            raise ValueError("n_run must be a positive integer")
        
        # Collect results from each run
        run_dataframes = []
        for run_id in range(n_run):
            run_seed = None if base_seed is None else base_seed + run_id
            
            # Use existing sample_run method
            run_df = self.sample_run(theta=theta, n_round=n_round, run_seed=run_seed)
            
            # Add run_id to distinguish between runs
            run_df['run_id'] = run_id
            
            run_dataframes.append(run_df)
        
        # Combine all runs into single DataFrame
        combined_df = pd.concat(run_dataframes, ignore_index=True)
        
        # Reorder columns for consistency with the original specification
        return combined_df[['theta', 'run_id', 'round_index', 'observation', 'run_seed']]
    
    
    @property
    def utterances(self) -> List[str]:
        """Get list of all possible utterances (as strings)."""
        return list(self.utterance_truth.index)

    @property
    def observations(self) -> List[Tuple[int, ...]]:
        """Get list of all possible observations (frequency tuples)."""
        return list(self.obs_log_likelihood_theta.index)

    @property
    def suc_likelihood_theta(self) -> pd.DataFrame:
        """
        Return the success likelihood table (actual probabilities)
        by exponentiating the log-likelihood table.
        """
        return np.exp(self.suc_log_likelihood_theta)

    @property
    def obs_likelihood_theta(self) -> pd.DataFrame:
        """
        Return the observation likelihood table (actual probabilities)
        by exponentiating the log-likelihood table.
        """
        return np.exp(self.obs_log_likelihood_theta)



# =============================================================================
# SPEAKER AND LISTENER CLASSES
# =============================================================================

## Literal Speaker

class LiteralSpeaker:
    """
    A literal speaker in the RSA communication game.

    This speaker observes outcomes from the `World` at each round, updates
    its beliefs over theta using Bayes' rule on the total number of successes,
    and selects an utterance uniformly at random among those that are
    semantically (literally) true of the observed data.

    Attributes
    ----------
    world : World
        The shared World model containing likelihoods and truth tables.
    un_current_log_belief : np.ndarray
        Unnormalized log-probabilities over theta values reflecting the speaker's prior/posterior.
    utterance_log_prob_obs : pd.DataFrame
        Log-probabilities of each utterance given each observation (frequency tuple).
        Rows are utterance strings, columns are observations.
    """

    def __init__(
        self,
        world: 'World',
        initial_beliefs_theta: Optional[np.ndarray] = None
    ) -> None:
        """
        Initialize the literal speaker.

        Parameters
        ----------
        world : World
            Instance of the World class, containing theta grid and likelihood tables.
        initial_beliefs_theta : np.ndarray, optional
            1D array of prior probabilities over theta values (must sum to 1).
            If None, a uniform prior is assumed.
        """
        self.world = world

        # Process or initialize the log-prior over theta
        self.un_current_log_belief = self._process_initial_beliefs(
            initial_beliefs_theta, self.world
        )

        # Precompute log P(u | O) for all utterance-observation pairs
        self.utterance_log_prob_obs = self._compute_utterance_log_prob_obs(
            self.world.utterance_truth
        )

    def _process_initial_beliefs(
        self,
        initial_beliefs_theta: Optional[np.ndarray],
        world: 'World'
    ) -> np.ndarray:
        """
        Validate and convert initial belief vector to log-space.

        Parameters
        ----------
        initial_beliefs_theta : Optional[np.ndarray]
            Initial beliefs over theta values, or None for uniform prior.
        world : World
            The World object containing theta_values.

        Returns
        -------
        np.ndarray
            Array of log-probabilities over theta_values.
        """
        n_theta = len(world.theta_values)

        # Uniform prior if none provided
        if initial_beliefs_theta is None:
            return np.full(n_theta, -np.log(n_theta), dtype=float)

        # Validate shape and range
        if not isinstance(initial_beliefs_theta, np.ndarray):
            raise ValueError("initial_beliefs_theta must be a numpy array")
        if initial_beliefs_theta.shape != (n_theta,):
            raise ValueError(
                f"initial_beliefs_theta length {initial_beliefs_theta.size} must match "
                f"number of theta values {n_theta}."
            )
        if not np.all((0 <= initial_beliefs_theta) & (initial_beliefs_theta <= 1)):
            raise ValueError("All probabilities must be between 0 and 1.")
        if not np.isclose(initial_beliefs_theta.sum(), 1.0):
            raise ValueError("Probabilities must sum to 1.")

        return np.log(initial_beliefs_theta)

    def _compute_utterance_log_prob_obs(
        self,
        utterance_truth: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Compute the log-probabilities P(u | O) for every utterance and observation.

        For each observation O, the literal speaker chooses uniformly among all u
        such that Truth(u; O) = 1.

        Parameters
        ----------
        utterance_truth : pd.DataFrame
            Truth values for utterance-observation pairs.

        Returns
        -------
        pd.DataFrame
            DataFrame with rows = utterances, columns = observations,
            and values = log P(u | O).
        """
        truth = utterance_truth.astype(bool)

        # Count how many utterances are true for each observation
        true_counts = truth.sum(axis=0)

        # Log-prob for each (u, O) is -log(num_true_utterances(O)) if true, else -inf
        base_logp = -np.log(true_counts.values)
        logp_matrix = np.tile(base_logp, (truth.shape[0], 1))

        df = pd.DataFrame(
            data=logp_matrix,
            index=truth.index,
            columns=truth.columns
        )

        # Mask out false utterance-observation pairs
        return df.where(truth, -np.inf)

    def update_and_speak(self, observation: Tuple[int, ...]) -> str:
        """
        Given a new frequency-tuple observation, update beliefs and sample an utterance.

        Parameters
        ----------
        observation : tuple of int
            A frequency tuple (n_0, n_1, ..., n_m) observed this round.

        Returns
        -------
        str
            The chosen utterance (as a comma-separated string).

        Raises
        ------
        ValueError
            If the observation is not in the world's possible outcomes.
        RuntimeError
            If belief update or utterance sampling fails.
        """
        # 1) Validate observation
        if observation not in self.world.observations:
            raise ValueError(f"Observation {observation} not supported by the world.")

        # 2) Compute total successes S = sum_j (j * n_j)
        counts = np.array(observation)
        successes = int(counts.dot(np.arange(self.world.m + 1)))

        # 3) Belief update in log-space: log P_new(theta) ∝ log P_old(theta) + log P(S | theta)
        try:
            log_lik = self.world.suc_log_likelihood_theta.loc[successes].values
            self.un_current_log_belief = self.un_current_log_belief + log_lik
        except Exception as e:
            raise RuntimeError(f"Belief update failed: {e}")

        # 4) Sample utterance: P(u|O) stored in utterance_log_prob_obs[observation]
        try:
            uttrs = self.world.utterance_truth.loc[:, [observation]]
            uttrs_true = uttrs.index[uttrs.iloc[:, 0] == 1].tolist()
            if not uttrs_true:
                raise RuntimeError(f"No valid utterances for observation {observation}")
            return np.random.choice(uttrs_true)
        except Exception as e:
            raise RuntimeError(f"Utterance sampling failed: {e}")

    @property
    def current_belief_theta(self) -> np.ndarray:
        """
        Return the current beliefs normalized so they form a valid distribution.

        Exponentiating and summing to 1.
        """
        return np.exp(log_column_normalize(self.un_current_log_belief[:, None],
                                           precise= USE_PRECISE_LOGSPACE).ravel())



## Literal Listener

class LiteralListener:
    """
    A literal listener in the RSA communication game.

    The listener hears an utterance from a literal speaker S_0 and updates
    its beliefs over the hidden parameter theta using Bayes' rule.
    The update uses the speaker model P_S0(u | theta) which is computed
    by marginalizing over possible observations.

    Attributes
    ----------
    world : World
        The shared World model containing likelihoods and truth tables.
    un_current_log_belief : np.ndarray
        The listener's current unnormalized log-probabilities over theta values (log P(theta)).
    literal_speaker : LiteralSpeaker
        A helper speaker instance used to access P_S0(u | O) tables.
    utterance_log_likelihood_theta : pd.DataFrame
        Log-likelihoods log P_S0(u | theta) for all utterances u and theta values.
        Rows are utterance strings, columns are theta values.
    theta_log_post_utterance : pd.DataFrame
        Unnormalized log-posteriors for each utterance and theta.
        Rows are theta values, columns are utterances.
    """

    def __init__(
        self,
        world: 'World',
        initial_beliefs_theta: Optional[np.ndarray] = None
    ) -> None:
        """
        Initialize the literal listener.

        Parameters
        ----------
        world : World
            Instance of the World class that provides theta grid, likelihoods,
            and truth tables.
        initial_beliefs_theta : np.ndarray, optional
            1D array of prior probabilities over theta values (must sum to 1).
            If None, a uniform prior is assumed.
        """
        self.world = world

        try:
            # Set up the initial log-prior over theta
            self.un_current_log_belief = self._process_initial_beliefs(
                initial_beliefs_theta, self.world
            )

            # Instantiate a literal speaker to access P(u|O) = utterance_log_prob_obs
            self.literal_speaker = LiteralSpeaker(self.world, initial_beliefs_theta)

            # Precompute P(u|theta) = sum_O P(u|O) P(O|theta) in log-space
            self.utterance_log_likelihood_theta = self._compute_utterance_log_likelihood_theta(
                self.literal_speaker.utterance_log_prob_obs,
                self.world.obs_log_likelihood_theta
                )

            # Combine with prior to get unnormalized log-posteriors for each utterance
            self.theta_log_post_utterance = self._compute_theta_log_post_utterance(
                self.utterance_log_likelihood_theta,
                self.un_current_log_belief
                )

        except Exception as e:
            raise RuntimeError(f"Failed to initialize listener: {str(e)}")

    def _process_initial_beliefs(
        self,
        initial_beliefs_theta: Optional[np.ndarray],
        world: 'World'
    ) -> np.ndarray:
        """
        Validate and convert the initial belief vector into log-space.

        Parameters
        ----------
        initial_beliefs_theta : Optional[np.ndarray]
            Initial beliefs over theta values, or None for uniform prior.
        world : World
            The World object containing theta_values.

        Returns
        -------
        np.ndarray
            Array of log-probabilities over theta_values.
        """
        n_theta = len(world.theta_values)

        # Use a uniform prior if none provided: log(1 / n_theta)
        if initial_beliefs_theta is None:
            return np.full(n_theta, -np.log(n_theta), dtype=float)

        # Validate that the supplied prior is a proper probability distribution
        if not isinstance(initial_beliefs_theta, np.ndarray):
            raise ValueError("initial_beliefs_theta must be a numpy array")
        if initial_beliefs_theta.shape != (n_theta,):
            raise ValueError(
                f"initial_beliefs_theta length {initial_beliefs_theta.size} must match "
                f"number of theta values {n_theta}."
            )
        if not np.all((0 <= initial_beliefs_theta) & (initial_beliefs_theta <= 1)):
            raise ValueError("All probabilities must be between 0 and 1.")
        if not np.isclose(initial_beliefs_theta.sum(), 1.0):
            raise ValueError("Probabilities must sum to 1.")

        # Convert to log-space for numerical stability
        return np.log(initial_beliefs_theta)

    def _compute_utterance_log_likelihood_theta(
        self,
        utterance_log_prob_obs: pd.DataFrame,
        obs_log_likelihood_theta: pd.DataFrame) -> pd.DataFrame:
        """
        Compute the log-likelihood P(u | theta) for each utterance and theta.

        This uses the precomputed P(u | O) from the literal speaker and the
        observation likelihood P(O | theta) from the world, performing a
        log-space matrix product to marginalize over observations.

        Parameters
        ----------
        utterance_log_prob_obs: pd.DataFrame
            Log-probabilities of each utterance given each observation
            (frequency tuple) from self.literal_speaker.
            Rows are utterance strings, columns are observations.
        obs_log_likelihood_theta: pd.DataFrame
            Log-probabilities of each observation (frequency tuple) given each
            theta from self.world.
            Rows are frequency tuples, columns are thetas.

        Returns
        -------
        pd.DataFrame
            Rows are utterance strings, columns are theta values,
            entries are log P(u | theta).
        """

        try:
            # log_M_product performs a numerically stable log-sum-exp matrix multiply
            return pd.DataFrame(
                log_M_product(
                    utterance_log_prob_obs.values,
                    obs_log_likelihood_theta.values,
                    precise= USE_PRECISE_LOGSPACE
                ),
                index=utterance_log_prob_obs.index,
                columns=obs_log_likelihood_theta.columns
            )

        except Exception as e:
            raise RuntimeError(f"Failed to compute utterance likelihoods: {str(e)}")

    def _compute_theta_log_post_utterance(
        self,
        utterance_log_likelihood_theta: pd.DataFrame,
        un_current_log_belief: np.ndarray) -> pd.DataFrame:
        """
        Compute unnormalized log-posteriors for every utterance.

        Combines the listener's current log-prior with the
        log-likelihood log P(u | theta) to produce
        log P(theta, u) = log P(theta) + log P(u | theta).

        Parameters
        ----------
        utterance_log_likelihood_theta: pd.DataFrame
            Rows are utterance strings, columns are theta values,
            entries are log P(u | theta).
        un_current_log_belief: np.ndarray
            Array of unnormalized log-belief/probabilities over theta_values.

        Returns
        -------
        pd.DataFrame
            Rows are theta values, columns are utterances.
            entries are unnormalized log P(theta | u).
        """
        try:
            # Broadcasting adds the log-prior vector to each column of P(u|theta)
             return (utterance_log_likelihood_theta + un_current_log_belief).T
             # transpose so rows=theta, cols=utterance

        except Exception as e:
            raise RuntimeError(f"Failed to update posterior distributions: {str(e)}")

    def listen_and_update(self, utterance: str) -> None:
        """
        Incorporate a received utterance and update the listener's beliefs.

        Parameters
        ----------
        utterance : str
            The utterance string produced by the speaker in this round.

        Updates
        -------
        un_current_log_belief : np.ndarray
            Replaces with log P(theta | utterance) (unnormalized).
        theta_log_post_utterance : pd.DataFrame
            Recomputed table for the next round's potential updates.

        Raises
        ------
        ValueError
            If the utterance is not recognized.
        RuntimeError
            If the belief update fails.
        """
        # Ensure the utterance is valid in this world
        if utterance not in self.world.utterances:
            raise ValueError(
                f"Utterance '{utterance}' not found in possible utterances.\n"
                f"Valid utterances: {self.world.utterances}"
            )

        try:
            # 1) Fetch the log-posteriors for this utterance
            self.un_current_log_belief = self.theta_log_post_utterance[utterance].values

            # 2) Recompute posteriors for next round
            self.theta_log_post_utterance = self._compute_theta_log_post_utterance(
                self.utterance_log_likelihood_theta,
                self.un_current_log_belief
                )

        except Exception as e:
            raise RuntimeError(f"Failed to update beliefs: {str(e)}")

    @property
    def current_belief_theta(self) -> np.ndarray:
        """
        Return the listener's normalized belief over theta as probabilities.

        Exponentiates and normalizes the current log-belief to sum to 1.
        """
        # Use stable log-column normalize and exponentiate
        return np.exp(log_column_normalize(self.un_current_log_belief[:, None],
                                           precise= USE_PRECISE_LOGSPACE).ravel())



## Pragmatic Speaker

class PragmaticSpeaker_obs:

    """
    A pragmatic speaker (S1) in an RSA-style communication game.

    This speaker balances literal truth, informativeness, and persuasiveness
    when choosing an utterance.  It relies on:
      - a LiteralSpeaker to provide P_S0(u | O)
      - a LiteralListener to track P_L0(theta) and related posteriors

    Attributes
    ----------
    world : World
        The shared World model with likelihoods and truth tables.
    omega : str
        Type of world:
        "coop" for cooperative world where speakers are all informative,
        "strat" for stratigic world where speakers can be also persuasive,
    psi : str
        Speaker goal: "inf" for purely informative,
        "pers+" to persuade the listener up,
        "pers-" to persuade the listener down.
    alpha : float or "determ"
        Softmax temperature (or "determ" for deterministic tie-split).
    beta : float
        Weight on informativeness (beta=1 for pure info, 0 for pure persuasion).
    update_internal : bool
        If True, update the literal listener's internal state after speaking.
    literal_speaker : LiteralSpeaker
        Helper to access P_S0(u | O).
    literal_listener : LiteralListener
        Helper to track listener beliefs P_L0(theta) and P_L0(O).
    utility : pd.DataFrame
        (U × O) matrix of log-utilities V(u; O).
    utterance_log_prob_obs : pd.DataFrame
        (U × O) matrix of log P_S1(u | O).
    """

    VALID_OMEGA_TYPES = {"coop", "strat"}
    VALID_PSI_TYPES = {"inf", "pers+", "pers-"}

    def __init__(
        self,
        world: 'World',
        omega: str,
        psi: str,
        update_internal: bool,
        alpha: Union[float, str],
        beta: float = 0.0,
        initial_beliefs_theta: Optional[np.ndarray] = None
    ) -> None:
        """Initialize the pragmatic speaker."""
        if omega not in self.VALID_OMEGA_TYPES:
            raise ValueError(
                f"omega must be one of {self.VALID_OMEGA_TYPES}, got '{omega}'"
            )
        if psi not in self.VALID_PSI_TYPES:
            raise ValueError(
                f"psi must be one of {self.VALID_PSI_TYPES}, got '{psi}'"
            )

        self.world = world
        self.omega = omega

        if self.omega == "coop" and psi != "inf":
            warnings.warn("when omega == coop, psi is forced to inf",
                            UserWarning)
            self.psi = "inf"
        else:
            self.psi = psi

        self.alpha = alpha
        self.beta = beta
        self.update_internal = update_internal

        try:
            # Initialize literal speaker keeping optimal Bayeisan belief in theta
            self.literal_speaker = LiteralSpeaker(world, initial_beliefs_theta)
            # Initialize literal listener as internal listner model
            self.literal_listener = LiteralListener(world, initial_beliefs_theta)

            # Compute utterance probabilities (this will cascade through all calculations)
            self.utterance_log_prob_obs = self._compute_utterance_log_prob_obs(self.alpha)

        except Exception as e:
            raise RuntimeError(f"Failed to initialize pragmatic speaker: {str(e)}")

    def _compute_log_informativeness(
        self,
        obs_log_likelihood_theta_values: np.ndarray,
        un_current_log_belief: np.ndarray,
        utterance_log_prob_obs: pd.DataFrame
    ) -> Tuple[np.ndarray, pd.DataFrame]:
        """
        Compute log-Inf(u; O) = log-P_L0(O|u).

        Parameters
        ----------
        obs_log_likelihood_theta_values : np.ndarray
            Observation log-likelihoods for each theta.
        un_current_log_belief : np.ndarray
            Unnormalized log-beliefs over theta values.
        utterance_log_prob_obs : pd.DataFrame
            Log P(u|O) for all utterances and observations.

        Returns
        -------
        Tuple[np.ndarray, pd.DataFrame]
            First: unnormalized_log_prob_O - Unnormalized log probability for each observation
            Second: log_informativeness - DataFrame with log-informativeness for each utterance and observation
        """
        # Compute unnormalized log-P(O)
        unnormalized_log_prob_O = log_M_product(
            obs_log_likelihood_theta_values,
            un_current_log_belief[:, np.newaxis],
            precise= USE_PRECISE_LOGSPACE
        ).flatten()

        # Compute log-P_L0(O|u)
        unnormalized_obs_log_post_utterance = (
            utterance_log_prob_obs +
            unnormalized_log_prob_O[np.newaxis, :]
        ).T

        obs_log_post_utterance = pd.DataFrame(
            log_column_normalize(unnormalized_obs_log_post_utterance.values,
                                 precise= USE_PRECISE_LOGSPACE),
            index=unnormalized_obs_log_post_utterance.index,
            columns=unnormalized_obs_log_post_utterance.columns
        )

        # Return unnormalized_log_prob_O and log-informativeness
        return unnormalized_log_prob_O, obs_log_post_utterance.T

    def _compute_log_persuasiveness(
        self,
        psi: str,
        theta_values: np.ndarray,
        theta_log_post_utterance_values: np.ndarray
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Compute log-PersStr(u; psi) based on speaker type.

        Parameters
        ----------
        psi : str
            Speaker goal: "inf", "pers+", or "pers-".
        theta_values : np.ndarray
            Array of possible theta values.
        theta_log_post_utterance_values : np.ndarray
            Unnormalized log-posteriors for each theta and utterance.

        Returns
        -------
        Tuple[pd.DataFrame, pd.DataFrame]
            First: theta_log_expectation_utterance - DataFrame with expectation of theta for each utterance
            Second: log_persuasiveness - DataFrame with log-persuasiveness for each utterance and observation
        """
        # Compute expectation log-E[theta|u]
        theta_values_zero = theta_values == 0
        log_theta_values = np.log(np.clip(theta_values, np.finfo(float).tiny, None))
        log_theta_values[theta_values_zero] = -np.inf

        theta_log_expectation_utterance = pd.DataFrame(
            log_M_product(
                log_theta_values[np.newaxis, :],
                log_column_normalize(theta_log_post_utterance_values,
                                     precise= USE_PRECISE_LOGSPACE),
                precise= USE_PRECISE_LOGSPACE
            ),
            columns=self.world.utterances
        )

        # Compute persuasiveness based on psi (speaker) type
        n_cols = len(self.world.possible_outcomes)

        # Persuade-up utility
        if psi == "pers+":
            values = theta_log_expectation_utterance.values.flatten()

        # Persuade-down utility: log(1 - E(theta)) = log(E(1 -theta))
        elif psi == "pers-":
            theta_values_one = theta_values == 1
            log_one_minus_theta_values = np.log(
                np.clip(1 - theta_values, np.finfo(float).tiny, None)
            )
            log_one_minus_theta_values[theta_values_one] = -np.inf

            values = log_M_product(
                log_one_minus_theta_values[np.newaxis, :],
                log_column_normalize(theta_log_post_utterance_values,
                                     precise= USE_PRECISE_LOGSPACE),
                precise= USE_PRECISE_LOGSPACE
            ).flatten()

        # Purely informative
        else:  # psi == "inf"
            values = np.zeros(len(self.world.utterances))

        # Create persuasiveness DataFrame
        log_persuasiveness = pd.DataFrame(
            np.tile(values, (n_cols, 1)).T,
            index=self.world.utterances,
            columns=self.world.possible_outcomes
        )

        return theta_log_expectation_utterance, log_persuasiveness

    def _compute_utility(self, psi: str, beta: float) -> pd.DataFrame:
        """
        Compute utility V(u; O, psi) combining truth, informativeness, and persuasiveness.
        V(u; O, psi) = log-Truth(u; O) * [ beta * log-Inf(u; O) + (1 - beta) * log-PersStr(u; psi) ]

        Parameters
        ----------
        psi : str
            Speaker goal: "inf", "pers+", or "pers-".
        beta : float
            Weight on informativeness (beta=1 for pure info, 0 for pure persuasion).

        Returns
        -------
        pd.DataFrame
            DataFrame with rows as utterances, columns as observations, values as utility.
        """
        try:
            # Compute informativeness
            self.unnormalized_log_prob_O, self.log_informativeness = self._compute_log_informativeness(
                self.world.obs_log_likelihood_theta.values,
                self.literal_listener.un_current_log_belief,
                self.literal_listener.literal_speaker.utterance_log_prob_obs
            )

            # Compute persuasiveness
            self.theta_log_expectation_utterance, self.log_persuasiveness = self._compute_log_persuasiveness(
                psi,
                self.world.theta_values,
                self.literal_listener.theta_log_post_utterance.values
            )

            # mask of literally false (Truth=0)
            uttr_false = (self.world.utterance_truth == 0)

            if psi == "inf":
                # Purely informative
                util = self.log_informativeness.copy()
            elif beta == 0:
                # Purely persuasive
                util = self.log_persuasiveness.copy()
            else:
                # Mixed informative & persuasive
                # Mask out any utterance that was impossible in either term
                impossible = (
                    (self.log_informativeness == -np.inf) |
                    (self.log_persuasiveness == -np.inf)
                )
                # Weighted sum in log-space
                inf_term = self.log_informativeness.copy().clip(lower=-np.finfo(float).max)
                pers_term = self.log_persuasiveness.copy().clip(lower=-np.finfo(float).max)
                util = beta * inf_term + (1 - beta) * pers_term
                util[impossible] = -np.inf

            # Finally enforce literal truth
            util[uttr_false] = -np.inf

            # Store utility for reference
            #self.utility = util
            return util

        except Exception as e:
            raise RuntimeError(f"Failed to compute utility: {str(e)}")

    def _compute_utterance_log_prob_obs(self, alpha: Union[float, str]) -> pd.DataFrame:
        """
        Compute log probabilities of utterances given observations.
        This is the main computation pipeline that calls all other computations.

        Parameters
        ----------
        alpha : float or "determ"
            Softmax temperature parameter.

        Returns
        -------
        pd.DataFrame
            DataFrame with rows as utterances, columns as observations,
            values as log P(u|O).
        """
        try:
            # First compute utility (this will cascade to compute informativeness and persuasiveness)
            self.utility = self._compute_utility(self.psi, self.beta)

            # Then apply softmax to get utterance probabilities
            return pd.DataFrame(
                log_column_softmax(
                    self.utility.values,
                    alpha,
                    precise= USE_PRECISE_LOGSPACE),
                index=self.utility.index,
                columns=self.utility.columns
            )

        except Exception as e:
            raise RuntimeError(f"Failed to compute utterance probability table: {str(e)}")

    def update_and_speak(self, observation: Tuple[int, ...]) -> str:
        """Given an observation, update beliefs and sample an utterance."""
        try:
            # Bayesian optimal update using observation
            # i.e. update literal speaker's beliefs
            self.literal_speaker.update_and_speak(observation)

            # Sample utterance according to P(u|O)
            utterance_log_probs = self.utterance_log_prob_obs.loc[:, [observation]]
            selected_utterance = np.random.choice(
                utterance_log_probs.index,
                p=np.exp(utterance_log_probs.values.flatten())
            )

            # Only update internal state if update_internal is True
            if self.update_internal:
                self.literal_listener.listen_and_update(selected_utterance)

                # Recompute utterance probabilities (this will cascade through all calculations)
                self.utterance_log_prob_obs = self._compute_utterance_log_prob_obs(self.alpha)

            return selected_utterance

        except Exception as e:
            raise RuntimeError(f"Failed to update and select utterance: {str(e)}")

    @property
    def current_belief_theta(self) -> np.ndarray:
        """
        Return the speaker's current normalized belief over theta
        (in linear space, summing to 1).
        """
        # Grab the unnormalized log-belief from the embedded LiteralSpeaker
        log_bel = self.literal_speaker.un_current_log_belief
        # Normalize each theta-column in log-space and exponentiate
        normalized = np.exp(
            log_column_normalize(log_bel[:, None],
                                 precise= USE_PRECISE_LOGSPACE)  # shape: (theta,1)
        ).ravel()  # back to shape (theta,)
        return normalized


## Pragmatic Listener

class PragmaticListener_obs_n:
    """
    A level-n pragmatic listener (L_n) in an RSA-style communication game.

    The listener assume utterances are from a level-n pragmatic speaker (S_n) and
    performs Bayesian inference jointly over:
      - theta: the world parameter (e.g., coin bias)
      - psi: the speaker's goal type ('pers-', 'inf', or 'pers+')
      - alpha: the speaker's rationality/temperature parameter
    """

    VALID_OMEGA_TYPES = {"coop", "strat"}
    PSI_TYPES = ["pers-", "inf", "pers+"]

    def __init__(
        self,
        world: 'World',
        level: int,
        omega: str,
        update_internal: bool,
        alpha: Union[float, str],
        beta: float = 0.0,
        initial_beliefs_theta: Optional[np.ndarray] = None,
        initial_beliefs_psi: Optional[np.ndarray] = None,
        alpha_vals: Optional[List[Union[float, str]]] = None,
        initial_beliefs_alpha: Optional[np.ndarray] = None,
    ) -> None:
        """Initialize the pragmatic listener."""
        # Validate level
        if not isinstance(level, int) or level < 1:
            raise ValueError(f"level must be an integer ≥ 1, got {level}")
        # Validate omega
        if omega not in self.VALID_OMEGA_TYPES:
            raise ValueError(f"omega must be one of {self.VALID_OMEGA_TYPES}")

        self.world = world
        self.level = level
        self.omega = omega
        self.update_internal = update_internal
        self.alpha = alpha
        self.beta = beta

        # Setup grids for psi and alpha
        self.psi_vals = self.PSI_TYPES.copy() if omega == "strat" else ["inf"]
        self.alpha_vals = alpha_vals if alpha_vals is not None else [alpha]

        try:
            # Build the unnormalized joint prior over (theta, psi, alpha)
            self.un_current_log_belief_theta_psi_alpha_joint = self._process_initial_beliefs(
                initial_beliefs_theta,
                initial_beliefs_psi,
                initial_beliefs_alpha,
                self.world.theta_values,
                self.psi_vals,
                self.alpha_vals
            )

            # Instantiate a pragmatic speaker for each (psi, alpha)
            if level == 1:
                self.pragmatic_speakers = {
                    (psi, a): PragmaticSpeaker_obs(
                        world=self.world,
                        omega = self.omega,
                        psi=psi,
                        update_internal=self.update_internal,
                        alpha=a,
                        beta=self.beta,
                        initial_beliefs_theta=initial_beliefs_theta
                    )
                    for psi in self.psi_vals
                    for a in self.alpha_vals
                }
            else:
                self.pragmatic_speakers = {
                    (psi, a): PragmaticSpeaker_obs_2plus(
                        world=self.world,
                        level = self.level,
                        omega = self.omega,
                        psi=psi,
                        update_internal=self.update_internal,
                        alpha=a,
                        beta=self.beta,
                        initial_beliefs_theta=initial_beliefs_theta,
                        initial_beliefs_psi = initial_beliefs_psi,
                        alpha_vals = alpha_vals,
                        initial_beliefs_alpha = initial_beliefs_alpha,
                    )
                    for psi in self.psi_vals
                    for a in self.alpha_vals
                }

            # Precompute log-likelihoods P_S1(u | theta, psi, alpha)
            self.utterance_log_likelihood_theta_psi_alpha = self._compute_utterance_log_likelihood_theta_psi_alpha(
                self.pragmatic_speakers,
                self.psi_vals,
                self.alpha_vals,
                self.world.utterances,
                self.world.theta_values,
                self.world.obs_log_likelihood_theta.values
            )

            # Combine with prior to get unnormalized posteriors
            self.theta_psi_alpha_log_post_utterance = self._compute_theta_psi_alpha_log_post_utterance(
                self.utterance_log_likelihood_theta_psi_alpha,
                self.un_current_log_belief_theta_psi_alpha_joint
            )

        except Exception as e:
            raise RuntimeError(f"Failed to initialize pragmatic listener: {e}")

    def _process_initial_beliefs(
        self,
        initial_beliefs_theta: Optional[np.ndarray],
        initial_beliefs_psi: Optional[np.ndarray],
        initial_beliefs_alpha: Optional[np.ndarray],
        theta_vals: np.ndarray,
        psi_vals: List[str],
        alpha_vals: List[Union[float, str]]
    ) -> xr.DataArray:
        """
        Construct the unnormalized log prior P(theta, psi, alpha).

        Parameters
        ----------
        initial_beliefs_theta : Optional[np.ndarray]
            Prior over theta values, or None for uniform prior.
        theta_vals : np.ndarray
            Array of possible theta values.
        psi_vals : List[str]
            List of speaker goal types.
        alpha_vals : List[Union[float, str]]
            List of softmax temperature values.

        Returns
        -------
        xr.DataArray
            Joint prior over (theta, psi, alpha).
        """
        n_theta = len(theta_vals)
        n_psi = len(psi_vals)
        n_alpha = len(alpha_vals)

        # 1) theta prior
        if initial_beliefs_theta is None:
            log_belief_theta = np.full(n_theta, -np.log(n_theta), dtype=float)
        else:
            # Validate and log-transform
            if not isinstance(initial_beliefs_theta, np.ndarray):
                raise ValueError("initial_beliefs_theta must be a numpy array")
            if initial_beliefs_theta.shape != (n_theta,):
                raise ValueError(
                    f"initial_beliefs_theta length {initial_beliefs_theta.size} must match number of theta values {n_theta}."
                )
            if not np.all((0 <= initial_beliefs_theta) & (initial_beliefs_theta <= 1)):
                raise ValueError("All probabilities in initial_beliefs_theta must be between 0 and 1.")
            if not np.isclose(initial_beliefs_theta.sum(), 1.0):
                raise ValueError("Probabilities in initial_beliefs_theta must sum to 1.")
            log_belief_theta = np.log(initial_beliefs_theta)

        # 2) psi prior
        if initial_beliefs_psi is None:
            log_belief_psi = np.full(n_psi, -np.log(n_psi), dtype=float)
        else:
            # Validate and log-transform
            if not isinstance(initial_beliefs_psi, np.ndarray):
                raise ValueError("initial_beliefs_psi must be a numpy array")
            if initial_beliefs_psi.shape != (n_psi,):
                raise ValueError(
                    f"initial_beliefs_psi length {initial_beliefs_psi.size} must match number of psi values {n_psi}."
                )
            if not np.all((0 <= initial_beliefs_psi) & (initial_beliefs_psi <= 1)):
                raise ValueError("All probabilities in initial_beliefs_psi must be between 0 and 1.")
            if not np.isclose(initial_beliefs_psi.sum(), 1.0):
                raise ValueError("Probabilities in initial_beliefs_psi must sum to 1.")
            log_belief_psi = np.log(initial_beliefs_psi)

        # 3) alpha prior: uniform
        if initial_beliefs_alpha is None:
            log_belief_alpha = np.full(n_alpha, -np.log(n_alpha), dtype=float)
        else:
            # Validate and log-transform
            if not isinstance(initial_beliefs_alpha, np.ndarray):
                raise ValueError("initial_beliefs_alpha must be a numpy array")
            if initial_beliefs_alpha.shape != (n_alpha,):
                raise ValueError(
                    f"initial_beliefs_alpha length {initial_beliefs_alpha.size} must match number of alpha values {n_alpha}."
                )
            if not np.all((0 <= initial_beliefs_alpha) & (initial_beliefs_alpha <= 1)):
                raise ValueError("All probabilities in log_belief_alpha must be between 0 and 1.")
            if not np.isclose(initial_beliefs_alpha.sum(), 1.0):
                raise ValueError("Probabilities in log_belief_alpha must sum to 1.")
            log_belief_alpha = np.log(initial_beliefs_alpha)

        # 4) Broadcast-sum to get joint log prior
        joint_log = (
            log_belief_theta[:, None, None]
            + log_belief_psi[None, :, None]
            + log_belief_alpha[None, None, :]
        )

        # Return as xarray for convenient indexing
        return xr.DataArray(
            data=joint_log,
            coords={
                "theta": theta_vals,
                "psi": psi_vals,
                "alpha": alpha_vals,
            },
            dims=("theta", "psi", "alpha"),
            name="log P(theta,psi,alpha)"
        )

    def _compute_utterance_log_likelihood_theta_psi_alpha(
        self,
        pragmatic_speakers: Dict[Tuple[str, Union[float, str]], 'PragmaticSpeaker_obs'],
        psi_vals: List[str],
        alpha_vals: List[Union[float, str]],
        utterances: List[str],
        theta_vals: np.ndarray,
        log_P_O_given_theta: np.ndarray
    ) -> xr.DataArray:
        """
        Compute log P_S1(u | theta, psi, alpha) by marginalizing over latent observations O.

        Parameters
        ----------
        pragmatic_speakers : Dict[Tuple[str, Union[float, str]], 'PragmaticSpeaker_obs']
            Dictionary mapping (psi, alpha) to corresponding speaker instance.
        psi_vals : List[str]
            List of speaker goal types.
        alpha_vals : List[Union[float, str]]
            List of softmax temperature values.
        utterances : List[str]
            List of all possible utterances.
        theta_vals : np.ndarray
            Array of possible theta values.
        log_P_O_given_theta : np.ndarray
            Log-probability of observations given theta.

        Returns
        -------
        xr.DataArray
            Log-likelihoods log P_S1(u | theta, psi, alpha) for all utterances, theta, psi, alpha.
        """
        n_psi = len(psi_vals)
        n_alpha = len(alpha_vals)
        n_u = len(utterances)
        n_theta = len(theta_vals)

        try:
            # Allocate buffer: (psi, alpha, u, theta)
            buf = np.empty((n_psi, n_alpha, n_u, n_theta), dtype=float)

            # Loop over each speaker configuration
            for i, psi in enumerate(psi_vals):
                for j, a in enumerate(alpha_vals):
                    ps = pragmatic_speakers[(psi, a)]
                    # log P_S1(u | O) matrix
                    log_P_u_given_O_psi_alpha = ps.utterance_log_prob_obs.values
                    # Marginalize out O in log-space
                    log_P_u_given_theta_psi_alpha = log_M_product(
                        log_P_u_given_O_psi_alpha,
                        log_P_O_given_theta,
                        precise= precision
                    )
                    buf[i, j, :, :] = log_P_u_given_theta_psi_alpha

            # Return as xarray.DataArray
            return xr.DataArray(
                data=buf,
                dims=("psi", "alpha", "utterance", "theta"),
                coords={
                    "psi": psi_vals,
                    "alpha": alpha_vals,
                    "utterance": utterances,
                    "theta": theta_vals,
                },
                name="log P_S1(u | theta, psi, alpha)"
            ).transpose("utterance", "theta", "psi", "alpha")

        except Exception as e:
            raise RuntimeError(f"Failed to compute utterance log likelihoods: {e}")

    def _compute_theta_psi_alpha_log_post_utterance(
        self,
        utterance_log_likelihood_theta_psi_alpha: xr.DataArray,
        un_current_log_belief_theta_psi_alpha_joint: xr.DataArray
    ) -> xr.DataArray:
        """
        Combine joint prior and speaker likelihood to form unnormalized joint log P(theta, psi, alpha, u).

        Parameters
        ----------
        utterance_log_likelihood_theta_psi_alpha : xr.DataArray
            Log-likelihoods log P_S1(u | theta, psi, alpha).
        un_current_log_belief_theta_psi_alpha_joint : xr.DataArray
            Joint prior over (theta, psi, alpha).

        Returns
        -------
        xr.DataArray
            Unnormalized log-posteriors indexed by utterance.
        """
        try:
            # Add prior + likelihood
            unnorm = (
                utterance_log_likelihood_theta_psi_alpha
                + un_current_log_belief_theta_psi_alpha_joint
            )
            # Reorder dims: put 'utterance' first
            return unnorm
        except Exception as e:
            raise RuntimeError(
                f"Failed to compute unnormalized posterior over "
                f"(theta,psi,alpha | u): {e}"
            )

    def listen_and_update(self, utterance: str) -> None:
        """
        Incorporate a received utterance and update the listener's beliefs.

        Parameters
        ----------
        utterance : str
            The utterance string produced by the speaker in this round.
        """
        # Validate utterance
        if utterance not in self.world.utterances:
            raise ValueError(
                f"Utterance '{utterance}' not in known utterances:\n"
                f"{self.world.utterances}"
            )

        try:
            # 1) Pull out the column for this utterance
            new_joint = self.theta_psi_alpha_log_post_utterance.sel(
                utterance=utterance
            )
            # 2) Update the joint prior
            self.un_current_log_belief_theta_psi_alpha_joint = new_joint

            # 3) If we assume the speaker learns, update internal models
            if self.update_internal:
                for speaker in self.pragmatic_speakers.values():
                    if self.level == 1:
                        speaker.literal_listener.listen_and_update(utterance)
                    else:
                        speaker.pragmatic_listener.listen_and_update(utterance)
                    speaker.utterance_log_prob_obs = speaker._compute_utterance_log_prob_obs(speaker.alpha)

                # Recompute speaker likelihood tables under new models
                self.utterance_log_likelihood_theta_psi_alpha = self._compute_utterance_log_likelihood_theta_psi_alpha(
                    self.pragmatic_speakers,
                    self.psi_vals,
                    self.alpha_vals,
                    self.world.utterances,
                    self.world.theta_values,
                    self.world.obs_log_likelihood_theta.values
                )

            # 4) Rebuild Ln's unnormalized posterior table for next round
            self.theta_psi_alpha_log_post_utterance = self._compute_theta_psi_alpha_log_post_utterance(
                self.utterance_log_likelihood_theta_psi_alpha,
                self.un_current_log_belief_theta_psi_alpha_joint
            )

        except Exception as e:
            raise RuntimeError(f"Failed to update Ln beliefs on '{utterance}': {e}")

    @property
    def current_belief_theta(self) -> np.ndarray:
        """
        Returns P(theta) \propto exp( sum_{psi, alpha} log_joint(theta,psi,alpha) ).
        """
        L = self.un_current_log_belief_theta_psi_alpha_joint.values
        # 1) global log-Z
        logZ = logsumexp(L.ravel())
        # 2) log-marginal over psi,alpha
        log_m_theta = logsumexp(L, axis=(1,2))
        # 3) normalize & exponentiate
        return np.exp(log_m_theta - logZ)

    @property
    def current_belief_psi(self) -> np.ndarray:
        """
        Returns P(psi) \propto exp( sum_{theta, alpha} log_joint(theta,psi,alpha) ).
        """
        L = self.un_current_log_belief_theta_psi_alpha_joint.values
        logZ = logsumexp(L.ravel())
        log_m_psi = logsumexp(L, axis=(0,2))
        return np.exp(log_m_psi - logZ)

    @property
    def current_belief_alpha(self) -> np.ndarray:
        """
        Returns P(alpha) \propto exp( sum_{theta, psi} log_joint(theta,psi,alpha)).
        """
        L = self.un_current_log_belief_theta_psi_alpha_joint.values
        logZ = logsumexp(L.ravel())
        log_m_alpha = logsumexp(L, axis=(0,1))
        return np.exp(log_m_alpha - logZ)

    @property
    def current_belief_theta_psi(self) -> np.ndarray:
        """
        Returns the marginal P(theta, psi) in linear space,
        i.e. P(theta,psi) = sum_alpha P(theta,psi,alpha).
        """
        # 1) Grab the raw unnormalized log-joint: shape (theta,psi,alpha)
        L = self.un_current_log_belief_theta_psi_alpha_joint.values
        # 2) Compute the global log-normalizer (log evidence)
        logZ = logsumexp(L.ravel())
        # 3) Marginalize out alpha in log-space: sum over axis=2
        log_m = logsumexp(L, axis=2)
        # 4) Normalize and exponentiate
        return np.exp(log_m - logZ)

    @property
    def current_belief_theta_psi_alpha_joint(self) -> np.ndarray:
        """
        Returns the full joint P(theta, psi, alpha) in linear space,
        normalized so that sum_{theta,psi,alpha} P = 1.
        """
        L = self.un_current_log_belief_theta_psi_alpha_joint.values
        # Global normalizer
        logZ = logsumexp(L.ravel())
        # Normalize the entire 3D array and exponentiate
        return np.exp(L - logZ)