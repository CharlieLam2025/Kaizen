"""Generate Chrome toolbar icons for Kaizen.

Families: folio (default mark), paper bricks (legacy), seal 开, subtitle lines.
Default icons/icon{16,48,128}.png use the existing mark.
Run from repo root: python scripts/make-icons.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
VAR = OUT / "variants"

PAPER = (246, 241, 232, 255)
INK = (28, 24, 18, 255)
BRICK = (196, 71, 45, 255)
BRICK_DEEP = (143, 47, 28, 255)
CREAM = (255, 247, 236, 255)
LINE = (58, 50, 40, 255)

SIZES = (16, 48, 128)
KAI = Path(r"C:\Windows\Fonts\simkai.ttf")
HEI = Path(r"C:\Windows\Fonts\simhei.ttf")


def new_canvas(size: int, fill: tuple[int, int, int, int]) -> Image.Image:
    return Image.new("RGBA", (size, size), fill)


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def rounded_tile(size: int, fill: tuple[int, int, int, int], radius: float | None = None) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * (0.18 if radius is None else radius))
    if size <= 16:
        d.rectangle((0, 0, size - 1, size - 1), fill=fill)
    else:
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=fill)
    return img


def brick_stack(d: ImageDraw.ImageDraw, size: int, fill: tuple[int, int, int, int], pulled: tuple[int, int, int, int]) -> None:
    if size <= 16:
        left, width, height, gap, pull = 2, 9, 3, 2, 3
        top = 2
    else:
        left = int(size * 0.20)
        width = int(size * 0.50)
        height = max(3, int(size * 0.145))
        gap = max(2, int(size * 0.055))
        pull = max(2, int(size * 0.10))
        total = height * 3 + gap * 2
        top = (size - total) // 2
    for i in range(3):
        y = top + i * (height + gap)
        x = left + (pull if i == 1 else 0)
        color = pulled if i == 1 else fill
        radius = 0 if size <= 16 else max(1, size // 28)
        box = (x, y, x + width, y + height)
        if radius:
            d.rounded_rectangle(box, radius=radius, fill=color)
        else:
            d.rectangle(box, fill=color)


def family_folio(size: int) -> Image.Image:
    """Open spread: vermillion field, cream page, a thin gutter."""
    img = rounded_tile(size, BRICK)
    d = ImageDraw.Draw(img)
    pad = max(2, int(size * 0.18))
    page = (pad, pad, size - pad - 1, size - pad - 1)
    radius = 0 if size <= 16 else max(1, size // 16)
    if radius:
        d.rounded_rectangle(page, radius=radius, fill=CREAM)
    else:
        d.rectangle(page, fill=CREAM)
    mid = size // 2
    width = max(1, size // 28)
    d.line((mid, pad + 1, mid, size - pad - 2), fill=BRICK, width=width)
    return img


def family_a_pulled(size: int) -> Image.Image:
    """Legacy brick stack."""
    img = rounded_tile(size, BRICK)
    brick_stack(ImageDraw.Draw(img), size, CREAM, PAPER)
    return img


def family_b_paper(size: int) -> Image.Image:
    """Warm paper field, terracotta bricks. Matches the side panel."""
    img = rounded_tile(size, PAPER)
    brick_stack(ImageDraw.Draw(img), size, BRICK_DEEP, BRICK)
    return img


def family_c_seal(size: int) -> Image.Image:
    """Vermillion seal with 开. 16px falls back to a carved cut."""
    img = rounded_tile(size, BRICK, radius=0.12)
    d = ImageDraw.Draw(img)
    if size <= 16:
        d.rectangle((4, 5, 11, 6), fill=CREAM)
        d.rectangle((7, 5, 8, 12), fill=CREAM)
        d.rectangle((5, 9, 10, 10), fill=CREAM)
        return img
    font_path = KAI if KAI.exists() else HEI
    font = ImageFont.truetype(str(font_path), int(size * 0.62))
    text = "开"
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1] - size * 0.02
    d.text((x, y), text, font=font, fill=CREAM)
    return img


def family_d_lines(size: int) -> Image.Image:
    """Subtitle lines; one bar becomes a pulled brick."""
    img = rounded_tile(size, PAPER)
    d = ImageDraw.Draw(img)
    if size <= 16:
        bars = [(3, 3, 12, 4), (3, 7, 10, 8), (4, 11, 13, 13)]
        fills = [LINE, LINE, BRICK]
        for box, color in zip(bars, fills):
            d.rectangle(box, fill=color)
        return img
    pad = int(size * 0.20)
    inner = size - pad * 2
    h_thin = max(3, int(size * 0.07))
    h_brick = max(6, int(size * 0.14))
    gap = int((inner - h_thin * 2 - h_brick) / 2)
    y = pad
    d.rounded_rectangle((pad, y, pad + int(inner * 0.88), y + h_thin), radius=h_thin // 2, fill=LINE)
    y += h_thin + gap
    d.rounded_rectangle((pad, y, pad + int(inner * 0.72), y + h_thin), radius=h_thin // 2, fill=LINE)
    y += h_thin + gap
    pull = int(size * 0.08)
    d.rounded_rectangle(
        (pad + pull, y, pad + pull + int(inner * 0.78), y + h_brick),
        radius=max(2, size // 32),
        fill=BRICK,
    )
    return img


FAMILIES = {
    "folio": family_folio,
    "a-pulled": family_a_pulled,
    "b-paper": family_b_paper,
    "c-seal": family_c_seal,
    "d-lines": family_d_lines,
}


def main() -> None:
    for key, fn in FAMILIES.items():
        for size in SIZES:
            save(fn(size), VAR / key / f"icon{size}.png")
    for size in SIZES:
        save(family_folio(size), OUT / f"icon{size}.png")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
