"""
Stimuli Generator for RSA Human Experiment (N=5, M=1 Version)
UPDATED: Generates ALL possible arrangements for each effectiveness level.
Uses Twemoji images from CDN for consistent, high-quality emoji display.

For 5 patients with k effective:
- k=0: 1 arrangement  (C(5,0) = 1)
- k=1: 5 arrangements (C(5,1) = 5)
- k=2: 10 arrangements (C(5,2) = 10)
- k=3: 10 arrangements (C(5,3) = 10)
- k=4: 5 arrangements (C(5,4) = 5)
- k=5: 1 arrangement  (C(5,5) = 1)
Total: 32 images

Output folder: stimuli_emoji_n5m1/
Naming: effective_{k}_v{variant}.png (e.g., effective_3_v0.png through effective_3_v9.png)
"""
from PIL import Image
from pathlib import Path
from typing import Dict, List, Tuple
from itertools import combinations
import urllib.request

# Configuration
N_PATIENTS = 5

# Emoji Unicode code points for Twemoji URLs
EMOJI_CONFIG = {
    "effective": {
        "char": "😃",
        "codepoint": "1f603",  # Smiling face with open mouth
    },
    "ineffective": {
        "char": "🤒",
        "codepoint": "1f912",  # Face with thermometer
    }
}

TWEMOJI_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/{codepoint}.png"


def get_cache_dir() -> Path:
    """Get or create the emoji cache directory."""
    cache_dir = Path.home() / ".cache" / "rsa_stimuli" / "emoji"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def download_emoji(codepoint: str, cache_dir: Path) -> Path:
    """Download an emoji PNG from Twemoji CDN."""
    cache_path = cache_dir / f"{codepoint}.png"
    
    if cache_path.exists():
        return cache_path
    
    url = TWEMOJI_URL.format(codepoint=codepoint)
    try:
        urllib.request.urlretrieve(url, cache_path)
        return cache_path
    except Exception as e:
        raise RuntimeError(f"Failed to download emoji {codepoint}: {e}\nURL: {url}")


def load_emoji_images(size: int = 72) -> Dict[str, Image.Image]:
    """Download and load all required emoji images."""
    cache_dir = get_cache_dir()
    emojis = {}
    
    print("Loading emoji images from Twemoji CDN...")
    for name, config in EMOJI_CONFIG.items():
        print(f"  {config['char']} ({name})...", end=" ")
        png_path = download_emoji(config["codepoint"], cache_dir)
        img = Image.open(png_path).convert("RGBA")
        img = img.resize((size, size), Image.Resampling.LANCZOS)
        emojis[name] = img
        print("✓")
    
    return emojis


def get_all_arrangements(num_effective: int) -> List[Tuple[int, ...]]:
    """
    Get all possible arrangements of effective/ineffective patients.
    
    Returns a list of tuples, where each tuple contains the positions (0-4)
    of effective patients.
    
    Example for num_effective=2:
    [(0,1), (0,2), (0,3), (0,4), (1,2), (1,3), (1,4), (2,3), (2,4), (3,4)]
    """
    return list(combinations(range(N_PATIENTS), num_effective))


def create_stimuli_image(
    effective_positions: Tuple[int, ...],
    emoji_images: Dict[str, Image.Image],
    emoji_size: int = 72,
    padding: int = 10,
    output_path: str = None
) -> Image.Image:
    """
    Create a row of 5 emojis with specified positions being effective.
    
    Parameters
    ----------
    effective_positions : Tuple[int, ...]
        Tuple of positions (0-4) that should show effective (happy) faces.
        All other positions show ineffective (sick) faces.
    emoji_images : Dict[str, Image.Image]
        Pre-loaded emoji images
    emoji_size : int
        Size of each emoji
    padding : int
        Padding between emojis
    output_path : str
        If provided, save the image to this path
    
    Returns
    -------
    Image.Image
        The PIL Image object
    """
    # Calculate dimensions
    width = N_PATIENTS * emoji_size + (N_PATIENTS + 1) * padding
    height = emoji_size + 2 * padding
    
    # Create image with white background
    img = Image.new('RGBA', (width, height), color='#FFFFFF')
    
    # Place emojis based on effective_positions
    effective_set = set(effective_positions)
    for i in range(N_PATIENTS):
        emoji_key = "effective" if i in effective_set else "ineffective"
        emoji_img = emoji_images[emoji_key]
        
        x = padding + i * (emoji_size + padding)
        y = padding
        
        img.paste(emoji_img, (x, y), emoji_img)
    
    # Convert to RGB
    img_rgb = Image.new('RGB', img.size, '#FFFFFF')
    img_rgb.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
    
    if output_path:
        img_rgb.save(output_path, quality=95)
    
    return img_rgb


def positions_to_visual(effective_positions: Tuple[int, ...]) -> str:
    """Convert positions to emoji visual representation."""
    result = []
    effective_set = set(effective_positions)
    for i in range(N_PATIENTS):
        result.append("😃" if i in effective_set else "🤒")
    return "".join(result)


def generate_all_stimuli(output_dir: str = "stimuli_emoji_n5m1", emoji_size: int = 72) -> None:
    """Generate stimuli images for all possible arrangements."""
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    emoji_images = load_emoji_images(size=emoji_size)
    
    print(f"\nGenerating all arrangement stimuli in '{output_dir}/'...")
    print("-" * 60)
    
    total_images = 0
    arrangement_counts = {}
    
    for num_effective in range(N_PATIENTS + 1):
        arrangements = get_all_arrangements(num_effective)
        arrangement_counts[num_effective] = len(arrangements)
        
        print(f"\n{num_effective}/5 effective: {len(arrangements)} arrangement(s)")
        
        for variant_idx, positions in enumerate(arrangements):
            filename = output_path / f"effective_{num_effective}_v{variant_idx}.png"
            
            create_stimuli_image(
                effective_positions=positions,
                emoji_images=emoji_images,
                emoji_size=emoji_size,
                output_path=str(filename)
            )
            
            visual = positions_to_visual(positions)
            positions_str = ",".join(map(str, positions)) if positions else "none"
            print(f"  v{variant_idx}: {visual} (effective at positions: {positions_str}) → {filename.name}")
            total_images += 1
    
    print("\n" + "-" * 60)
    print(f"✓ Done! Generated {total_images} images.")
    print("\nSummary of arrangements per effectiveness level:")
    for k, count in arrangement_counts.items():
        print(f"  {k} effective: {count} variants")


def generate_arrangement_map() -> Dict[int, List[Tuple[int, ...]]]:
    """
    Generate a mapping from num_effective to all possible arrangements.
    Useful for verification and JavaScript code generation.
    """
    return {k: get_all_arrangements(k) for k in range(N_PATIENTS + 1)}


def print_javascript_config():
    """Print JavaScript configuration for stimuli.js"""
    print("\n" + "=" * 60)
    print("JavaScript configuration for stimuli.js:")
    print("=" * 60)
    print("""
// Arrangement data: maps numEffective to list of variant indices
const ARRANGEMENT_COUNTS = {
    0: 1,   // C(5,0) = 1
    1: 5,   // C(5,1) = 5
    2: 10,  // C(5,2) = 10
    3: 10,  // C(5,3) = 10
    4: 5,   // C(5,4) = 5
    5: 1    // C(5,5) = 1
};

// Total: 32 images
""")
    
    print("\n// Detailed arrangement mappings (positions of effective patients):")
    print("const ARRANGEMENTS = {")
    for k in range(N_PATIENTS + 1):
        arrangements = get_all_arrangements(k)
        arr_str = ", ".join([str(list(a)) for a in arrangements])
        print(f"    {k}: [{arr_str}],")
    print("};")


def main():
    """Main entry point."""
    print("=" * 60)
    print("  RSA Experiment Stimuli Generator (Randomized Arrangements)")
    print(f"  Configuration: {N_PATIENTS} patients, 1 session")
    print("  Using Twemoji images from CDN")
    print("=" * 60)
    
    print(f"\n  Emojis:")
    print(f"    Effective:   😃 (Twemoji: {EMOJI_CONFIG['effective']['codepoint']})")
    print(f"    Ineffective: 🤒 (Twemoji: {EMOJI_CONFIG['ineffective']['codepoint']})")
    
    print(f"\n  For {N_PATIENTS} patients, generating ALL possible arrangements:")
    print(f"    This creates C(5,k) images for each k effective patients")
    
    generate_all_stimuli(output_dir="stimuli_emoji_n5m1")
    
    print_javascript_config()
    
    print("\n" + "=" * 60)
    print("  Cache location: " + str(get_cache_dir()))
    print("  Done! Images created with Twemoji and randomized arrangements.")
    print("=" * 60)


if __name__ == "__main__":
    main()
