#!/usr/bin/env python3
"""Convert SVG logos to PNG format."""

import os
import subprocess
import sys

def convert_svg_to_png(svg_path: str, png_path: str, width: int = 512, height: int = 512) -> bool:
    """Convert SVG to PNG using cairosvg."""
    try:
        import cairosvg
        cairosvg.svg2png(url=svg_path, write_to=png_path, output_width=width, output_height=height)
        print(f"✓ Converted {svg_path} → {png_path}")
        return True
    except ImportError:
        print("Installing cairosvg...")
        subprocess.run([sys.executable, "-m", "pip", "install", "cairosvg", "-q"])
        try:
            import cairosvg
            cairosvg.svg2png(url=svg_path, write_to=png_path, output_width=width, output_height=height)
            print(f"✓ Converted {svg_path} → {png_path}")
            return True
        except Exception as e:
            print(f"✗ Failed to convert {svg_path}: {e}")
            return False
    except Exception as e:
        print(f"✗ Failed to convert {svg_path}: {e}")
        return False

def main():
    """Convert all SVG logos to PNG."""
    base_path = "/Users/raghav/Projects/AI-Book-Writer/frontend/public"
    
    # SVG to PNG conversions
    conversions = [
        ("scribe-house-logo.svg", "scribe-house-logo.png", 256, 256),
        ("scribe-house-logo-horizontal.svg", "scribe-house-logo-horizontal.png", 512, 256),
        ("favicon.svg", "favicon.png", 192, 192),
    ]
    
    success_count = 0
    for svg_name, png_name, width, height in conversions:
        svg_path = os.path.join(base_path, svg_name)
        png_path = os.path.join(base_path, png_name)
        
        if os.path.exists(svg_path):
            if convert_svg_to_png(svg_path, png_path, width, height):
                success_count += 1
        else:
            print(f"✗ SVG file not found: {svg_path}")
    
    print(f"\nSuccessfully converted {success_count}/{len(conversions)} logos to PNG")
    return success_count == len(conversions)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
