"""Draw the app icons (glowing cross on black) into icons/.

    python3 scripts/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1] / "icons"
LIGHT = (255, 246, 226)


def icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGB", (size, size), (6, 7, 9))
    # soft halo
    halo = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(halo)
    r = size * 0.36
    c = size / 2, size * 0.46
    d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=110)
    halo = halo.filter(ImageFilter.GaussianBlur(size * 0.12))
    img.paste(Image.new("RGB", (size, size), LIGHT), mask=halo)
    # the cross, smaller on maskable icons so the OS crop keeps it whole
    k = 0.78 if maskable else 1.0
    w, cx = size * 0.065 * k, size / 2
    top, bottom = size * (0.5 - 0.31 * k), size * (0.5 + 0.33 * k)
    arm_y, arm = size * (0.5 - 0.13 * k), size * 0.19 * k
    cross = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(cross)
    d.rounded_rectangle([cx - w / 2, top, cx + w / 2, bottom], radius=w / 3, fill=255)
    d.rounded_rectangle([cx - arm, arm_y - w / 2, cx + arm, arm_y + w / 2], radius=w / 3, fill=255)
    glow = cross.filter(ImageFilter.GaussianBlur(size * 0.03))
    img.paste(Image.new("RGB", (size, size), LIGHT), mask=glow)
    img.paste(Image.new("RGB", (size, size), (255, 255, 255)), mask=cross)
    return img


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for s in (180, 192, 512):
        icon(s).save(OUT / f"icon-{s}.png")
    icon(512, maskable=True).save(OUT / "icon-maskable-512.png")
    print("icons written to", OUT)
