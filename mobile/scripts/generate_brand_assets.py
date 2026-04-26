"""Regenerate brand-aware icon + splash source PNGs for the mobile app.

Background:
- The committed `mobile/assets/images/adaptive-icon.png` was the Expo
  template placeholder (a grey target grid), so Android launcher icons
  showed a blank/generic tile.
- The splash source (`splash-light.png` / `splash-dark.png`) has the
  "PoultryManager.io" wordmark baked in. Android 12+ masks the splash
  icon to a circle, clipping the wordmark — hence the "cut off"
  complaints. iOS has no such mask.

This script produces:
- `assets/images/adaptive-icon.png`        — logo scaled to ~66% of a
                                              transparent 1024 canvas
                                              so it fits Android's
                                              adaptive-icon safe zone.
- `assets/images/splash-android-light.png` — logo-only, sized for the
                                              Android 12 splash circle
                                              (~55% of canvas).
- `assets/images/splash-android-dark.png`  — white-logo variant for the
                                              dark-mode splash.

Run from repo root:
  python3 mobile/scripts/generate_brand_assets.py

The wordmarked `splash-light.png` / `splash-dark.png` stay untouched —
iOS keeps using them via the storyboard (no circular mask there).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
MOBILE = REPO / "mobile"
SRC_LOGO_GREEN = REPO / "frontend/public/media/logo/PM Logo_notext_nobg_square.png"
SRC_LOGO_WHITE = REPO / "frontend/public/media/logo/pm_logo_notext_square_white_max.png"
OUT_DIR = MOBILE / "assets/images"

CANVAS = 1024
ADAPTIVE_SCALE = 0.66  # Android adaptive-icon safe zone is 72/108 ≈ 66.7%.
SPLASH_SCALE = 0.60    # Android 12 splash-icon circle ≈ 55-60% of canvas.

# Brand off-white — matches `adaptiveIcon.backgroundColor` and the
# `iconBackground` / `splashscreen_background` colors in the generated
# Android resources. Baking it into the adaptive-icon source means OEM
# launchers that ignore the separate adaptive background still render a
# solid tile instead of showing transparency over the wallpaper.
BRAND_BG = "#f5f8f5"


def _hex_to_rgba(color: str) -> tuple[int, int, int, int]:
    color = color.lstrip("#")
    if len(color) != 6:
        raise ValueError(f"Expected #RRGGBB, got {color!r}")
    return (int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16), 255)


def _place_centered(
    src_path: Path,
    scale: float,
    out_path: Path,
    bg_color: str | None = None,
) -> None:
    if not src_path.exists():
        raise FileNotFoundError(f"Missing source logo: {src_path}")

    src = Image.open(src_path).convert("RGBA")

    # The source logos have asymmetric transparent padding, so naively
    # resizing+centering preserves the offset. Crop to the alpha bounding
    # box first, then pad to a square, then scale+center.
    bbox = src.getbbox()
    if bbox is None:
        raise ValueError(f"Source image is fully transparent: {src_path}")
    cropped = src.crop(bbox)
    side = max(cropped.size)
    squared = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    squared.paste(
        cropped,
        ((side - cropped.size[0]) // 2, (side - cropped.size[1]) // 2),
        cropped,
    )

    target = int(CANVAS * scale)
    resized = squared.resize((target, target), Image.LANCZOS)

    fill = _hex_to_rgba(bg_color) if bg_color else (0, 0, 0, 0)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), fill)
    offset = (CANVAS - target) // 2
    canvas.paste(resized, (offset, offset), resized)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path, "PNG", optimize=True)
    bg_desc = bg_color if bg_color else "transparent"
    print(
        f"wrote {out_path.relative_to(REPO)}  "
        f"({target}x{target} logo in {CANVAS}x{CANVAS} canvas, bg={bg_desc})"
    )


def main() -> None:
    # Adaptive-icon foreground: bake the brand bg so the icon renders as
    # a solid tile on every Android launcher, even ones that ignore the
    # separate `<background>` layer in ic_launcher.xml.
    _place_centered(SRC_LOGO_GREEN, ADAPTIVE_SCALE, OUT_DIR / "adaptive-icon.png", BRAND_BG)
    # Splash images stay transparent — expo-splash-screen composites
    # them over `backgroundColor` via the Android 12 splash API, and
    # keeping transparency lets dark/light themes each use their own bg.
    _place_centered(SRC_LOGO_GREEN, SPLASH_SCALE, OUT_DIR / "splash-android-light.png")
    _place_centered(SRC_LOGO_WHITE, SPLASH_SCALE, OUT_DIR / "splash-android-dark.png")


if __name__ == "__main__":
    main()
