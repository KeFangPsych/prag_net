import matplotlib.pyplot as plt
import numpy as np


def create_bar_plots(dist, observations, n_utt):
    fig, axes = plt.subplots(4, 5, figsize=(20, 16))
    axes = axes.flatten()

    for i, obs in enumerate(observations):
        ax = axes[i]
        probs = dist[i, :]  # Get P(u|O) for this observation
        
        ax.bar(range(n_utt), probs, color='teal', alpha=0.7)
        ax.set_title(f'O = {obs}', fontsize=10, fontweight='bold')
        ax.set_xlabel('Utterance', fontsize=8)
        ax.set_ylabel('P(u|O)', fontsize=8)
        ax.set_ylim(0, 1)
        ax.grid(True, alpha=0.3, axis='y')

    plt.tight_layout()
    plt.show()


def create_heat_map(dist, observations, utterances):
    fig, ax = plt.subplots(figsize=(20, 12))
    im = ax.imshow(dist, aspect='auto', cmap='YlOrRd')
    n_obs = len(observations)
    n_utt = len(utterances)

    ax.set_xlabel('Utterance', fontsize=12)
    ax.set_ylabel('Observation', fontsize=12)

    ax.set_yticks(range(n_obs))
    ax.set_yticklabels([str(o) for o in observations], fontsize=8)

    ax.set_xticks(range(n_utt))
    ax.set_xticklabels(utterances, fontsize=7, rotation=30)

    plt.colorbar(im, label='P(u|O)')
    plt.tight_layout()
    plt.show()

def create_bar_l(dist, theta_values, utterances):

    n_utt = len(utterances)
    n_theta = len(theta_values)
    n_plots = min(20, n_utt)
    fig, axes = plt.subplots(4, 5, figsize=(20, 16))
    axes = axes.flatten()

    for i in range(n_plots):
        ax = axes[i]
        ax.bar(range(n_theta), dist[i, :], color='coral', alpha=0.7)
        ax.set_title(f'u = {utterances[i]}', fontsize=9, fontweight='bold')
        ax.set_xlabel('θ index', fontsize=8)
        ax.set_ylabel('P(θ|u)', fontsize=8)
        ax.set_xticks(range(n_theta))
        ax.set_xticklabels([f'{t:.1f}' for t in theta_values], fontsize=6, rotation=45)
        ax.set_ylim(0, 1)
        ax.grid(True, alpha=0.3, axis='y')

    plt.suptitle('P(θ|u) for Utterances', fontsize=14, fontweight='bold')
    plt.tight_layout()
    plt.show()


def create_heat_l(dist, theta_values, utterances):
    n_utt = len(utterances)
    n_theta = len(theta_values)
    fig, ax = plt.subplots(figsize=(14, 16))
    im = ax.imshow(dist, aspect='auto', cmap='YlGnBu')
    ax.set_xlabel('θ', fontsize=12)
    ax.set_ylabel('Utterance', fontsize=12)
    ax.set_xticks(range(n_theta))
    ax.set_xticklabels([f'{t:.1f}' for t in theta_values], fontsize=9)
    ax.set_yticks(range(n_utt))
    ax.set_yticklabels(utterances, fontsize=8)
    plt.colorbar(im, label='P(θ|u)')
    plt.tight_layout()
    plt.show()


def compare_two_matrix(base, test):
    diff_matrix = base - test
    tolerance = 1e-10  
    non_zero_diff = np.abs(diff_matrix) > tolerance
    num_different = np.sum(non_zero_diff)
    total_entries = diff_matrix.size
    percent_different = (num_different / total_entries) * 100

    print("=" * 60)
    print(f"Total num of entries: {total_entries}")
    print(f"Entry with differences: {num_different},  {percent_different:.2f}%")

# 3. 差异的大小统计
    non_zero_diffs = diff_matrix[non_zero_diff]
    if len(non_zero_diffs) > 0:
        print("Statistics of differences:")
        print(f"  biggest difference: {np.max(np.abs(diff_matrix)):.6e}")
        print(f"  smallest non-zero difference: {np.min(np.abs(non_zero_diffs)):.6e}")
        print(f"  average differences (non-zero ones): {np.mean(np.abs(non_zero_diffs)):.6e}")
    else:
        print("Exactly the same!")
    print()

    # 4. 找出差异最大的位置
    max_diff_idx = np.unravel_index(np.argmax(np.abs(diff_matrix)), diff_matrix.shape)
    print(f"BIGGEST DIFFERENCE at: observation {max_diff_idx[0]}, utterance {max_diff_idx[1]}")
    print(f"  The difference number: {diff_matrix[max_diff_idx]:.6e}")
    print(f"  base version: {base[max_diff_idx]:.6f}")
    print(f"  memo version: {test[max_diff_idx]:.6f}")
    print()