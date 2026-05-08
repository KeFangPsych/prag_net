"""
Stimuli Generator for RSA Human Experiment (Twemoji Version)

Generates visual representations of observation tuples for World(n=5, m=4).
Uses Twemoji PNG images: 🤒 (patient), ✅ (success), ❌ (failure)

This version downloads emoji images from Twemoji CDN - works on ALL platforms!
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
from typing import Tuple, List, Optional, Dict
import itertools
import os
import urllib.request
import io


# Emoji Unicode code points for Twemoji URLs
EMOJI_CONFIG = {
    "patient": {
        "char": "🤒",
        "codepoint": "1f912",  # Face with thermometer
    },
    "success": {
        "char": "✅",
        "codepoint": "2705",   # White heavy check mark
    },
    "failure": {
        "char": "❌",
        "codepoint": "274c",   # Cross mark
    }
}

# Twemoji CDN URL template (72x72 PNG)
TWEMOJI_URL = "https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/{codepoint}.png"


def get_cache_dir() -> Path:
    """Get or create the emoji cache directory."""
    cache_dir = Path.home() / ".cache" / "rsa_stimuli" / "emoji"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def download_emoji(codepoint: str, cache_dir: Path) -> Path:
    """
    Download an emoji PNG from Twemoji CDN.
    
    Parameters
    ----------
    codepoint : str
        Unicode codepoint (e.g., "1f912" for 🤒)
    cache_dir : Path
        Directory to cache downloaded emojis
        
    Returns
    -------
    Path
        Path to the downloaded PNG file
    """
    cache_path = cache_dir / f"{codepoint}.png"
    
    if cache_path.exists():
        return cache_path
    
    url = TWEMOJI_URL.format(codepoint=codepoint)
    
    try:
        urllib.request.urlretrieve(url, cache_path)
        return cache_path
    except Exception as e:
        raise RuntimeError(f"Failed to download emoji {codepoint}: {e}\nURL: {url}")


def load_emoji_images(size: int = 60) -> Dict[str, Image.Image]:
    """
    Download and load all required emoji images.
    
    Parameters
    ----------
    size : int
        Size to resize emojis to (square)
        
    Returns
    -------
    Dict[str, Image.Image]
        Dictionary mapping emoji names to PIL Images
    """
    cache_dir = get_cache_dir()
    emojis = {}
    
    print("Loading emoji images...")
    for name, config in EMOJI_CONFIG.items():
        print(f"  {config['char']} ({name})...", end=" ")
        
        # Download if needed
        png_path = download_emoji(config["codepoint"], cache_dir)
        
        # Load and resize
        img = Image.open(png_path).convert("RGBA")
        img = img.resize((size, size), Image.Resampling.LANCZOS)
        
        emojis[name] = img
        print("✓")
    
    return emojis


def tuple_to_patient_successes(obs_tuple: Tuple[int, ...], m: int = 4) -> List[int]:
    """
    Convert a frequency tuple to a list of individual patient success counts.
    
    Parameters
    ----------
    obs_tuple : Tuple[int, ...]
        Frequency tuple (n_0, n_1, ..., n_m) where n_j = count of patients with j successes
    m : int
        Number of trials per patient
    
    Returns
    -------
    List[int]
        List of success counts for each patient, sorted descending (most successful first)
    
    Example
    -------
    >>> tuple_to_patient_successes((1, 2, 1, 1, 0), m=4)
    [3, 2, 1, 1, 0]
    """
    patient_successes = []
    for j, count in enumerate(obs_tuple):
        patient_successes.extend([j] * count)
    return sorted(patient_successes, reverse=True)


def create_stimuli_image(
    obs_tuple: Tuple[int, ...],
    n: int = 5,
    m: int = 4,
    cell_size: int = 80,
    output_path: Optional[str] = None,
    show_title: bool = False,
    emoji_images: Optional[Dict[str, Image.Image]] = None
) -> Image.Image:
    """
    Create a stimuli image with emojis for a given observation tuple.
    
    Parameters
    ----------
    obs_tuple : Tuple[int, ...]
        Frequency tuple (n_0, n_1, ..., n_m)
    n : int
        Number of patients (columns)
    m : int
        Number of trials (rows)
    cell_size : int
        Size of each cell in pixels
    output_path : Optional[str]
        If provided, save the image to this path
    show_title : bool
        Whether to show the tuple as title
    emoji_images : Optional[Dict[str, Image.Image]]
        Pre-loaded emoji images (for efficiency when generating many images)
    
    Returns
    -------
    Image.Image
        The PIL Image object
    """
    # Convert tuple to patient success counts
    patient_successes = tuple_to_patient_successes(obs_tuple, m)
    
    # Validate
    assert len(patient_successes) == n, f"Expected {n} patients, got {len(patient_successes)}"
    
    # Load emoji images if not provided
    emoji_size = int(cell_size * 0.7)
    if emoji_images is None:
        emoji_images = load_emoji_images(size=emoji_size)
    
    # Calculate dimensions
    padding = 15
    title_height = 35 if show_title else 0
    width = n * cell_size + 2 * padding
    height = (m + 1) * cell_size + 2 * padding + title_height
    
    # Create image with white background
    img = Image.new('RGBA', (width, height), color='#FFFFFF')
    draw = ImageDraw.Draw(img)
    
    # Colors
    grid_color = '#CCCCCC'
    header_bg = '#F5F5F5'
    cell_bg = '#FFFFFF'
    
    # Try to load a title font
    title_font = None
    title_font_paths = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSText.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for font_path in title_font_paths:
        if os.path.exists(font_path):
            try:
                title_font = ImageFont.truetype(font_path, 14)
                break
            except:
                continue
    if title_font is None:
        title_font = ImageFont.load_default()
    
    # Draw title if requested
    if show_title:
        title_text = f"Observation: {obs_tuple}"
        draw.text((padding, 8), title_text, fill='#333333', font=title_font)
    
    # Starting position for grid
    start_y = padding + title_height
    
    # Draw cells and paste emojis
    for row in range(m + 1):  # 0 = header, 1-m = trials
        for col in range(n):
            # Cell coordinates
            x1 = padding + col * cell_size
            y1 = start_y + row * cell_size
            x2 = x1 + cell_size
            y2 = y1 + cell_size
            
            # Background color
            bg = header_bg if row == 0 else cell_bg
            
            # Draw cell background (no outline)
            draw.rectangle([x1, y1, x2, y2], fill=bg, outline=None)
            
            # Draw vertical lines (left edge of each cell, plus right edge of last column)
            draw.line([(x1, start_y), (x1, start_y + (m + 1) * cell_size)], fill=grid_color, width=2)
            if col == n - 1:
                draw.line([(x2, start_y), (x2, start_y + (m + 1) * cell_size)], fill=grid_color, width=2)
    
    # Draw horizontal lines: top, below header, and bottom only
    grid_top = start_y
    grid_bottom = start_y + (m + 1) * cell_size
    header_bottom = start_y + cell_size
    grid_left = padding
    grid_right = padding + n * cell_size
    
    draw.line([(grid_left, grid_top), (grid_right, grid_top)], fill=grid_color, width=2)           # Top
    draw.line([(grid_left, header_bottom), (grid_right, header_bottom)], fill=grid_color, width=2) # Below header
    draw.line([(grid_left, grid_bottom), (grid_right, grid_bottom)], fill=grid_color, width=2)     # Bottom
    
    # Now paste emojis (second pass to ensure they're on top)
    for row in range(m + 1):
        for col in range(n):
            x1 = padding + col * cell_size
            y1 = start_y + row * cell_size
            
            # Determine which emoji to use
            if row == 0:
                emoji_key = "patient"
            else:
                trial_idx = row
                num_successes = patient_successes[col]
                emoji_key = "success" if trial_idx <= num_successes else "failure"
            
            # Get emoji image
            emoji_img = emoji_images[emoji_key]
            
            # Center emoji in cell
            emoji_w, emoji_h = emoji_img.size
            paste_x = x1 + (cell_size - emoji_w) // 2
            paste_y = y1 + (cell_size - emoji_h) // 2
            
            # Paste emoji (with alpha channel for transparency)
            img.paste(emoji_img, (paste_x, paste_y), emoji_img)
    
    # Convert to RGB for saving as PNG (removes alpha complexity)
    img_rgb = Image.new('RGB', img.size, '#FFFFFF')
    img_rgb.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
    
    # Save if path provided
    if output_path:
        img_rgb.save(output_path, quality=95)
    
    return img_rgb


def generate_all_outcomes(n: int = 5, m: int = 4) -> List[Tuple[int, ...]]:
    """
    Generate all possible observation tuples for World(n, m).
    """
    outcomes = []
    for dividers in itertools.combinations(range(n + m), m):
        counts = []
        prev = -1
        for d in dividers:
            counts.append(d - prev - 1)
            prev = d
        counts.append(n + m - prev - 1)
        outcomes.append(tuple(counts))
    return outcomes


def generate_all_stimuli(
    output_dir: str = "stimuli_emoji",
    n: int = 5,
    m: int = 4,
    cell_size: int = 80
) -> None:
    """
    Generate stimuli images for all possible observations.
    """
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    # Pre-load emoji images for efficiency
    emoji_size = int(cell_size * 0.7)
    emoji_images = load_emoji_images(size=emoji_size)
    
    outcomes = generate_all_outcomes(n, m)
    print(f"\nGenerating {len(outcomes)} stimuli images in '{output_dir}/'...")
    print("-" * 50)
    
    for i, obs_tuple in enumerate(outcomes):
        tuple_str = "_".join(map(str, obs_tuple))
        filename = output_path / f"obs_{tuple_str}.png"
        
        create_stimuli_image(
            obs_tuple,
            n=n, m=m,
            cell_size=cell_size,
            output_path=str(filename),
            show_title=False,
            emoji_images=emoji_images
        )
        
        # Progress indicator
        progress = (i + 1) / len(outcomes)
        bar_width = 40
        filled = int(bar_width * progress)
        bar = "█" * filled + "░" * (bar_width - filled)
        print(f"\r  [{bar}] {i+1}/{len(outcomes)}", end="", flush=True)
    
    print()  # New line after progress bar
    print("-" * 50)
    print(f"✓ Done! Generated {len(outcomes)} images.")


def main():
    """Main entry point."""
    print("=" * 60)
    print("  RSA Experiment Stimuli Generator (Twemoji Version)")
    print("=" * 60)
    print(f"\n  Emojis used (from Twitter's Twemoji):")
    for name, config in EMOJI_CONFIG.items():
        print(f"    {name.capitalize():8}: {config['char']}")
    
    # Example tuple
    example_tuple = (1, 2, 1, 1, 0)
    print(f"\n  Example observation: {example_tuple}")
    print(f"  Patient successes (L→R): {tuple_to_patient_successes(example_tuple)}")
    
    # Create example with title
    print("\n" + "-" * 60)
    img = create_stimuli_image(
        example_tuple,
        output_path="example_emoji.png",
        show_title=True
    )
    print(f"✓ Saved: example_emoji.png")
    
    # Generate all stimuli
    print("\n" + "=" * 60)
    generate_all_stimuli(output_dir="stimuli_emoji", cell_size=80)
    
    print("\n" + "=" * 60)
    print("  All files ready for your experiment!")
    print("  Cache location: " + str(get_cache_dir()))
    print("=" * 60)


if __name__ == "__main__":
    main()
