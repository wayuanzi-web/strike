#!/usr/bin/env python3
"""產生 App 圖示（破曉的天色、地平線上的太陽、準星）。python3 src/gen_icons.py；需要 Pillow。"""
import pathlib
from PIL import Image, ImageDraw, ImageFilter
out = pathlib.Path(__file__).resolve().parent.parent

def icon(size, maskable=False):
    S = 512
    im = Image.new('RGB', (S, S)); d = ImageDraw.Draw(im)
    top, mid, hor = (24, 34, 58), (122, 96, 140), (255, 168, 96)
    for y in range(S):
        t = y / S
        if t < 0.62: k = t / 0.62; c = tuple(int(top[i] + (mid[i] - top[i]) * k) for i in range(3))
        else: k = (t - 0.62) / 0.38; c = tuple(int(mid[i] + (hor[i] - mid[i]) * k) for i in range(3))
        d.line([(0, y), (S, y)], fill=c)
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
    g.ellipse([156, 250, 356, 450], fill=(255, 226, 170, 210)); glow = glow.filter(ImageFilter.GaussianBlur(40))
    im.paste(glow, (0, 0), glow); d = ImageDraw.Draw(im)
    d.ellipse([206, 300, 306, 400], fill=(255, 246, 225))
    d.rectangle([0, 372, S, S], fill=(18, 24, 34))          # 地平線下的倉區剪影
    for x0, x1, h in [(20, 110, 330), (120, 170, 350), (330, 420, 320), (430, 492, 345)]:
        d.rectangle([x0, h, x1, 380], fill=(18, 24, 34))
    s = 0.78 if maskable else 1.0
    cx, cy, r = 256, 236, 118 * s
    w = int(14 * s)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 179, 71), width=w)
    for a, b in [((cx, cy - r - 38 * s), (cx, cy - r * 0.42)), ((cx, cy + r * 0.42), (cx, cy + r + 38 * s)),
                 ((cx - r - 38 * s, cy), (cx - r * 0.42, cy)), ((cx + r * 0.42, cy), (cx + r + 38 * s, cy))]:
        d.line([a, b], fill=(255, 179, 71), width=w)
    d.ellipse([cx - 11 * s, cy - 11 * s, cx + 11 * s, cy + 11 * s], fill=(255, 236, 200))
    return im.resize((size, size), Image.LANCZOS)

icon(192).save(out / 'icon-192.png'); icon(512).save(out / 'icon-512.png'); icon(180).save(out / 'apple-touch-icon.png')
icon(512, True).save(out / 'icon-maskable-512.png')
print('icons written to', out)
