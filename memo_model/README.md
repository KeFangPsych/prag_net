# RSA Opinion Dynamics

This repository implements Rational Speech Acts (RSA) models for studying opinion dynamics and strategic communication. The codebase includes both a base NumPy implementation and an optimized JAX/Memo framework version for efficient probabilistic reasoning.

Network setup: https://drive.google.com/file/d/1OAKWdOdzMrryXyaGBH4-yOaDpTVkkezs/view?usp=share_link

---

## File Structure Summary

```
RSA_OpinionDynamics/
├── _rsa_agents.py          # ⭐ Base NumPy implementation (reference)
├── rsa_memo.py             # JAX/Memo optimized implementation helper
├── world_jax.py            # JAX-accelerated world model
├── test_utils.py           # Visualization and comparison utilities
│
├── BASE_testbook.ipynb     # Base version validation & figures
├── MEMO_testbook.ipynb     # Memo version validation & performance
├── Expansion.ipynb         # Cognitive hierarchy extensions (TBD)
│
└── README.md               # This file
```
---

## Core Files

### **[_rsa_agents.py](_rsa_agents.py)** - Base Version ⭐
**The foundational implementation of RSA agents using NumPy.**

This is the **base version** of the RSA framework implementing:
- **World model**: Defines observations, utterances, and truth semantics for Binomial(n,m) experiments
- **Literal agents (L0, S0)**: Basic speaker/listener with uniform semantics
- **Pragmatic agents (L1, S1)**: Recursive reasoning agents modeling each other
- **Speaker types**:
  - Informative speakers (maximize listener's knowledge about observations)
  - Persuasive speakers (maximize/minimize listener's expected theta belief)
- **Listener types**:
  - Credulous listeners (assume cooperative/informative speakers)
  - Vigilant listeners (infer speaker's persuasive goals)
- **Helper functions**: Log-space matrix operations for numerical stability

**Key features:**
- Pure NumPy implementation with scipy special functions
- Manual implementation of all Bayesian updates and utility computations
- Includes both cooperative (omega="coop") and strategic (omega="strat") world types
- Supports multi-level reasoning (L0, S1, L1, S2, etc.)

---

### **[rsa_memo.py](rsa_memo.py)** - Optimized Memo Implementation
**Helper functions for JAX-accelerated RSA agents using the Memo probabilistic programming framework.**


- **Memo DSL**: Declarative specification of agent reasoning
- **JAX backend**: JIT-compiled, GPU-accelerated computations
- **Functional design**: Pure functions with automatic differentiation support

---

### **[world_jax.py](world_jax.py)** - JAX-Optimized World Model
**High-performance world model with JAX-accelerated probability computations.**

Provides the environment model for RSA agents:
- **Binomial likelihood computation**: Vectorized `P(observation | theta)` for all theta values
- **Observation generation**: Combinatorial generation of possible outcomes
- **Truth semantics**: Which utterances are true for which observations
- **Sampling utilities**: Generate observation sequences for simulations

**Key optimizations:**
- JIT-compiled binomial likelihood calculations
- Vectorized operations replacing Python loops
- Maintains API compatibility with base version
- Special handling for boundary cases (theta=0, theta=1)

**Note:** Non-performance-critical operations (combinatorics, sampling) still use NumPy for simplicity.

---

### **[test_utils.py](test_utils.py)** - Visualization & Testing Utilities
**Helper functions for plotting and comparing agent outputs.**

Includes:
- `create_bar_plots()`: Bar charts showing P(u|O) for different observations
- `create_heat_map()`: Heatmap visualization of utterance probabilities
- `create_bar_l()`, `create_heat_l()`: Listener posterior P(θ|u) visualizations
- `compare_two_matrix()`: Numerical comparison between base and Memo versions

Used extensively in notebooks to validate that Memo implementation matches base version and to visualize agent behavior.

---

## Notebooks

### **[BASE_testbook.ipynb](BASE_testbook.ipynb)** - Base Version Validation
**Testing and visualization of the base NumPy implementation.**

Serves as reference implementation and ground truth for validating the Memo version, trying to replace some of the requested tasks with Base version

---

### **[MEMO_testbook.ipynb](MEMO_testbook.ipynb)** - Memo Version Testing
**Testing and validation of JAX/Memo implementation with speed comparisons.**

Include all most updated RSA agent implementation. Enables scaling to larger simulations and parameter sweeps. Contents:
- **a) Agent validation**: Verify L1_vig reduces to L1_cred when psi_dist=[1,0,0]
- **b) Bimodal posteriors of 3 Ls for "some,effective"**: Reproduce Figure 3 using Memo agents
- **c) S1 and S2 comparison**: Reproduct Figure 8 on P(u|O)
- **d) 1000x100 simulation on S1L1**: All manuscript figures (Figures 3-7)


---

### **[Expansion.ipynb](Expansion.ipynb)** - Cognitive Hierarchy Extensions
**Exploring higher-level reasoning and heterogeneous agent populations. WAITING FOR NEXT-STEP TESTING**

Contents:
- **Cognitive Hierarchy (CH) with Poisson distribution**:
  - Sample agent levels from Poisson(τ=1.5)
  - Population-level reasoning with heterogeneous sophistication
- **High-level agent generation**: Automatic code generation for levels 3-6
  - L2_cred_obs, S3_inf, L3_cred_obs, S4_inf, etc.
  - Recursive pattern: Sn models L(n-1)_obs
- **Multi-type agents**: Generate persuasive speakers at higher levels

---

## Dependencies

```
numpy
scipy
pandas
xarray
matplotlib
jax
jaxlib
memo-lang  # Memo probabilistic programming framework
```
