"""
Stimuli Generator for RSA Human Experiment (N=5, M=1 Version)
Generates a single row of 5 face icons: happy face (effective) and sick face (ineffective)
Output folder: stimuli_emoji_n5m1/

This version draws faces programmatically - no external downloads needed.
"""
from PIL import Image, ImageDraw
from pathlib import Path
from typing import Dict

# Configuration
N_PATIENTS = 5


def draw_happy_face(size: int = 72) -> Image.Image:
    """Draw a happy/smiling face (for effective treatment)."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Yellow circle background
    margin = 2
    draw.ellipse([margin, margin, size-margin, size-margin], fill='#FFCC00', outline='#E6B800', width=2)
    
    # Eyes (happy curved eyes)
    eye_y = size * 0.38
    left_eye_x = size * 0.3
    right_eye_x = size * 0.7
    eye_size = size * 0.08
    
    # Draw arc eyes (happy squint)
    draw.arc([left_eye_x - eye_size*1.5, eye_y - eye_size, 
              left_eye_x + eye_size*1.5, eye_y + eye_size*1.5], 
             start=200, end=340, fill='#664400', width=3)
    draw.arc([right_eye_x - eye_size*1.5, eye_y - eye_size, 
              right_eye_x + eye_size*1.5, eye_y + eye_size*1.5], 
             start=200, end=340, fill='#664400', width=3)
    
    # Big smile
    smile_y = size * 0.55
    smile_width = size * 0.35
    smile_height = size * 0.25
    draw.arc([size/2 - smile_width, smile_y - smile_height/2,
              size/2 + smile_width, smile_y + smile_height],
             start=10, end=170, fill='#664400', width=3)
    
    return img


def draw_sick_face(size: int = 72) -> Image.Image:
    """Draw a sick face with thermometer (for ineffective treatment)."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Pale yellow/greenish circle background
    margin = 2
    draw.ellipse([margin, margin, size-margin, size-margin], fill='#E8E4A0', outline='#C9C48A', width=2)
    
    # Sad/worried eyes (simple dots)
    eye_y = size * 0.4
    left_eye_x = size * 0.32
    right_eye_x = size * 0.68
    eye_radius = size * 0.06
    
    draw.ellipse([left_eye_x - eye_radius, eye_y - eye_radius,
                  left_eye_x + eye_radius, eye_y + eye_radius], fill='#664400')
    draw.ellipse([right_eye_x - eye_radius, eye_y - eye_radius,
                  right_eye_x + eye_radius, eye_y + eye_radius], fill='#664400')
    
    # Worried eyebrows
    brow_y = eye_y - size * 0.12
    draw.line([left_eye_x - eye_radius*2, brow_y + 3, 
               left_eye_x + eye_radius*2, brow_y - 2], fill='#664400', width=2)
    draw.line([right_eye_x - eye_radius*2, brow_y - 2, 
               right_eye_x + eye_radius*2, brow_y + 3], fill='#664400', width=2)
    
    # Thermometer (diagonal line from mouth)
    therm_start_x = size * 0.45
    therm_start_y = size * 0.6
    therm_end_x = size * 0.75
    therm_end_y = size * 0.85
    
    # Thermometer body (white with red tip)
    draw.line([therm_start_x, therm_start_y, therm_end_x, therm_end_y], 
              fill='#FFFFFF', width=6)
    draw.line([therm_start_x, therm_start_y, therm_end_x, therm_end_y], 
              fill='#CCCCCC', width=4)
    # Red bulb at end
    draw.ellipse([therm_end_x - 5, therm_end_y - 5, therm_end_x + 5, therm_end_y + 5], 
                 fill='#FF4444')
    
    # Small frown
    frown_y = size * 0.65
    frown_width = size * 0.15
    draw.arc([size/2 - frown_width - size*0.1, frown_y,
              size/2 + frown_width - size*0.1, frown_y + size*0.15],
             start=220, end=320, fill='#664400', width=2)
    
    return img


def create_emoji_images(size: int = 72) -> Dict[str, Image.Image]:
    """Create all emoji images programmatically."""
    print("Creating emoji images...")
    emojis = {}
    
    print("  😃 (effective)...", end=" ")
    emojis["effective"] = draw_happy_face(size)
    print("✓")
    
    print("  🤒 (ineffective)...", end=" ")
    emojis["ineffective"] = draw_sick_face(size)
    print("✓")
    
    return emojis


def create_stimuli_image(
    num_effective: int,
    emoji_images: Dict[str, Image.Image],
    emoji_size: int = 72,
    padding: int = 10,
    output_path: str = None
) -> Image.Image:
    """
    Create a single row of 5 emojis.
    
    Parameters
    ----------
    num_effective : int
        Number of effective (😃) emojis (0-5)
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
    
    # Place emojis (effective on left, ineffective on right)
    for i in range(N_PATIENTS):
        emoji_key = "effective" if i < num_effective else "ineffective"
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


def generate_all_stimuli(output_dir: str = "stimuli_emoji_n5m1", emoji_size: int = 72) -> None:
    """Generate stimuli images for all possible outcomes (0-5 effective)."""
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    emoji_images = create_emoji_images(size=emoji_size)
    
    print(f"\nGenerating 6 stimuli images in '{output_dir}/'...")
    print("-" * 50)
    
    for num_effective in range(N_PATIENTS + 1):
        filename = output_path / f"effective_{num_effective}.png"
        
        create_stimuli_image(
            num_effective=num_effective,
            emoji_images=emoji_images,
            emoji_size=emoji_size,
            output_path=str(filename)
        )
        
        visual = "😃" * num_effective + "🤒" * (N_PATIENTS - num_effective)
        print(f"  {num_effective}/5 effective: {visual} → {filename.name}")
    
    print("-" * 50)
    print(f"✓ Done! Generated 6 images.")


def main():
    """Main entry point."""
    print("=" * 60)
    print("  RSA Experiment Stimuli Generator")
    print(f"  Configuration: {N_PATIENTS} patients, 1 session")
    print("=" * 60)
    
    print(f"\n  Face icons:")
    print(f"    Effective:   😃 (happy yellow face)")
    print(f"    Ineffective: 🤒 (pale face with thermometer)")
    
    generate_all_stimuli(output_dir="stimuli_emoji_n5m1")
    
    print("\n" + "=" * 60)
    print("  Done! Images created programmatically.")
    print("=" * 60)


if __name__ == "__main__":
    main()
