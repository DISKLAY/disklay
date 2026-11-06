#!/usr/bin/env python3
"""Create practice-only copies with the remaining labels covered, not reconstructed.

Requires Pillow. Coordinates below are fractions of each existing source crop.
Attribution marks are retained; annotated atlas/review assets are unchanged.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    ('assets/histology/03-image.webp', 'm01.webp', [(0.023,0.851,0.13,0.916)]),
    ('assets/histology/p128-image.webp', 'm03.webp', [(0.365,0.692,0.585,0.775)]),
    ('assets/histology/p133-image.webp', 'm04.webp', [
        (0.849,0.000,0.958,0.045), (0.274,0.459,0.385,0.528),
        (0.445,0.453,0.530,0.489), (0.390,0.670,0.610,0.765),
        (0.420,0.842,0.560,0.880), (0.420,0.907,0.560,0.945)]),
    ('assets/histology/p93-image.webp', 'm05.webp', [
        (0.645,0.135,0.700,0.200), (0.645,0.213,0.700,0.275), (0.645,0.610,0.700,0.685)]),
    ('assets/histology/practice/i079.webp', 'm06.webp', [
        (0.645,0.135,0.700,0.200), (0.645,0.213,0.700,0.275), (0.645,0.610,0.700,0.685)]),
]

def main():
    out = ROOT / 'assets/histology/masked'
    out.mkdir(exist_ok=True)
    for source, name, boxes in CASES:
        image = Image.open(ROOT / source).convert('RGB')
        draw = ImageDraw.Draw(image)
        for x1, y1, x2, y2 in boxes:
            box = tuple(round(v*d) for v,d in zip((x1,y1,x2,y2), (image.width,image.height,image.width,image.height)))
            draw.rounded_rectangle(box, radius=3, fill='#e4e6eb')
        image.save(out / name, 'WEBP', quality=95, method=5)
    # The previous tongue image had a large attribution watermark across the
    # tissue. Use a different, unlabelled field on the next source page instead
    # of obscuring/removing that watermark. Both older entries showed the same
    # original photo; retain their IDs so saved practice sessions keep working.
    page = Image.open(ROOT / 'assets/histology/atlas/part3-011.webp').convert('RGB')
    tongue = page.crop((909, 209, 1381, 845))
    for name in ('m02.webp', 'm07.webp'):
        tongue.save(out / name, 'WEBP', quality=95, method=5)

if __name__ == '__main__':
    main()
