#!/usr/bin/env python3
"""Renders site/og-image.png (1200x630) — the card shown when a link to
SkillAtlas is pasted into WhatsApp, X, Reddit, LinkedIn, Slack, Discord.

Run:  python scripts/make_og.py
Output: site/og-image.png (inside the folder GitHub Pages publishes).
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
CREAM = (251, 250, 248)
CARD = (255, 255, 255)
BORDER = (229, 226, 218)
INDIGO = (79, 70, 229)
INDIGO_SOFT = (238, 240, 255)
INDIGO_PALE = (165, 162, 245)
INK = (28, 27, 24)
MUTED = (138, 134, 124)
BAR = (223, 219, 210)

ROOT = Path(__file__).resolve().parent.parent
BOLD = "C:/Windows/Fonts/segoeuib.ttf"
SEMI = "C:/Windows/Fonts/seguisb.ttf"
REG = "C:/Windows/Fonts/segoeui.ttf"


def f(path, size):
    return ImageFont.truetype(path, size)


def add_glow(base, center, radius, color, alpha=26):
    mask = Image.new("L", (W // 4, H // 4), 0)
    d = ImageDraw.Draw(mask)
    cx, cy, r = center[0] // 4, center[1] // 4, radius // 4
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(45)).resize((W, H), Image.BICUBIC)
    mask = mask.point(lambda v: int(v * alpha / 255))
    base.paste(Image.new("RGB", (W, H), color), (0, 0), mask)


def compass(d, cx, cy, r):
    """Compass mark: ring + two-tone needle."""
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=INDIGO, width=4)
    d.polygon([(cx, cy - r + 8), (cx + 11, cy), (cx - 11, cy)], fill=INDIGO)
    d.polygon([(cx, cy + r - 8), (cx + 11, cy), (cx - 11, cy)], fill=INDIGO_PALE)
    d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=INDIGO)


def pill(d, x, y, text, font):
    tw = d.textlength(text, font=font)
    h, pad = 46, 24
    d.rounded_rectangle([x, y, x + tw + pad * 2, y + h], radius=h // 2,
                        outline=INDIGO, width=2)
    d.text((x + pad, y + h / 2), text, font=font, fill=INDIGO, anchor="lm")
    return x + tw + pad * 2 + 14


def skill_tile(d, x, y, widths):
    w, h = 200, 124
    d.rounded_rectangle([x, y, x + w, y + h], radius=14, fill=CARD, outline=BORDER, width=2)
    d.ellipse([x + 22, y + 24, x + 34, y + 36], fill=INDIGO)
    for i, bw in enumerate(widths):
        by = y + 46 + i * 16
        d.rounded_rectangle([x + 22, by, x + 22 + bw, by + 8], radius=4, fill=BAR)
    d.rounded_rectangle([x + 22, y + 90, x + 88, y + 106], radius=8, fill=INDIGO_SOFT)


def main():
    img = Image.new("RGB", (W, H), CREAM)
    add_glow(img, (1080, 120), 460, (222, 224, 255), alpha=90)
    add_glow(img, (200, 560), 380, (238, 240, 255), alpha=70)
    d = ImageDraw.Draw(img)

    # brand mark
    d.rounded_rectangle([80, 88, 156, 164], radius=22, fill=INDIGO_SOFT)
    compass(d, 118, 126, 24)

    # wordmark
    x = 80
    f_word = f(BOLD, 94)
    d.text((x, 196), "Skill", font=f_word, fill=INDIGO)
    d.text((x + d.textlength("Skill", font=f_word), 196), "Atlas", font=f_word, fill=INK)

    # rule
    d.rounded_rectangle([80, 340, 186, 344], radius=2, fill=INDIGO)

    # tagline
    f_sub = f(REG, 28)
    d.text((80, 372), "Every Claude & AI-agent skill on GitHub.",
           font=f_sub, fill=INK, anchor="lm")
    d.text((80, 414), "Sorted by category and the job you're doing.",
           font=f_sub, fill=MUTED, anchor="lm")

    # pills
    f_pill = f(SEMI, 21)
    px = 80
    for label in ("16,000+ skills", "Twice-daily refresh", "Free"):
        px = pill(d, px, 500, label, f_pill)

    # skill tiles
    for row, widths in enumerate(((112, 90), (100, 110), (124, 78))):
        for col in range(2):
            skill_tile(d, 716 + col * 216, 104 + row * 142, widths)

    img.save(ROOT / "site" / "og-image.png", optimize=True)
    print("wrote site/og-image.png (1200x630)")


if __name__ == "__main__":
    main()
