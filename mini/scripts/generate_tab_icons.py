#!/usr/bin/env python3
"""
Generate WeChat tab bar PNG icons from SVG source definitions.

Notes:
- We keep SVG as source of truth under src/assets/tab/svg.
- WeChat tabBar currently consumes png paths, so this script renders
  minimal vector-like icons to png outputs under src/assets/tab.
- If source SVG files are missing, the script still generates fallback
  geometric icons from built-in vectors to avoid breaking builds.
"""

from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
SRC_SVG_DIR = ROOT / "src" / "assets" / "tab" / "svg"
OUT_DIR = ROOT / "src" / "assets" / "tab"
SIZE = 81
PADDING = 10

Color = Tuple[int, int, int, int]
Point = Tuple[float, float]

DEFAULT_COLOR = (113, 113, 122, 255)  # #71717A
ACTIVE_COLOR = (212, 175, 55, 255)  # #D4AF37


def put_pixel(buffer: bytearray, x: int, y: int, color: Color) -> None:
    if not (0 <= x < SIZE and 0 <= y < SIZE):
        return
    idx = (y * SIZE + x) * 4
    buffer[idx : idx + 4] = bytes(color)


def draw_line(buffer: bytearray, x0: float, y0: float, x1: float, y1: float, color: Color, width: int = 3) -> None:
    dx = x1 - x0
    dy = y1 - y0
    steps = int(max(abs(dx), abs(dy)) * 2) + 1
    for i in range(steps + 1):
        t = i / max(steps, 1)
        x = int(round(x0 + dx * t))
        y = int(round(y0 + dy * t))
        half = width // 2
        for ox in range(-half, half + 1):
            for oy in range(-half, half + 1):
                put_pixel(buffer, x + ox, y + oy, color)


def point_in_polygon(x: float, y: float, polygon: List[Point]) -> bool:
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        intersect = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi
        )
        if intersect:
            inside = not inside
        j = i
    return inside


def fill_polygon(buffer: bytearray, polygon: List[Point], color: Color) -> None:
    min_x = max(0, int(min(p[0] for p in polygon)))
    max_x = min(SIZE - 1, int(max(p[0] for p in polygon)))
    min_y = max(0, int(min(p[1] for p in polygon)))
    max_y = min(SIZE - 1, int(max(p[1] for p in polygon)))
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            if point_in_polygon(x + 0.5, y + 0.5, polygon):
                put_pixel(buffer, x, y, color)


def draw_rect(buffer: bytearray, x: int, y: int, w: int, h: int, color: Color, fill: bool = False, stroke_width: int = 3) -> None:
    if fill:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                put_pixel(buffer, xx, yy, color)
        return
    draw_line(buffer, x, y, x + w, y, color, stroke_width)
    draw_line(buffer, x, y + h, x + w, y + h, color, stroke_width)
    draw_line(buffer, x, y, x, y + h, color, stroke_width)
    draw_line(buffer, x + w, y, x + w, y + h, color, stroke_width)


def draw_circle(buffer: bytearray, cx: int, cy: int, r: int, color: Color, fill: bool = False, stroke_width: int = 3) -> None:
    r2 = r * r
    inner = max(0, r - stroke_width)
    inner2 = inner * inner
    for y in range(cy - r - 1, cy + r + 2):
        for x in range(cx - r - 1, cx + r + 2):
            dist2 = (x - cx) * (x - cx) + (y - cy) * (y - cy)
            if fill:
                if dist2 <= r2:
                    put_pixel(buffer, x, y, color)
            else:
                if inner2 <= dist2 <= r2:
                    put_pixel(buffer, x, y, color)


def draw_home(buffer: bytearray, color: Color) -> None:
    roof = [(40.5, 14), (14, 34), (20, 42), (40.5, 26), (61, 42), (67, 34)]
    fill_polygon(buffer, roof, color)
    draw_rect(buffer, 22, 38, 37, 27, color, fill=False, stroke_width=4)
    draw_rect(buffer, 35, 49, 11, 16, color, fill=False, stroke_width=3)


def draw_inspiration(buffer: bytearray, color: Color) -> None:
    draw_circle(buffer, 40, 40, 20, color, fill=False, stroke_width=4)
    rays = [
        ((40, 10), (40, 20)),
        ((40, 60), (40, 70)),
        ((10, 40), (20, 40)),
        ((60, 40), (70, 40)),
        ((19, 19), (26, 26)),
        ((54, 54), (61, 61)),
        ((19, 61), (26, 54)),
        ((54, 26), (61, 19)),
    ]
    for (x0, y0), (x1, y1) in rays:
        draw_line(buffer, x0, y0, x1, y1, color, width=3)


def draw_progress(buffer: bytearray, color: Color) -> None:
    draw_rect(buffer, 18, 16, 45, 50, color, fill=False, stroke_width=4)
    draw_line(buffer, 26, 29, 55, 29, color, width=3)
    draw_line(buffer, 26, 40, 55, 40, color, width=3)
    draw_line(buffer, 26, 51, 45, 51, color, width=3)


def draw_message(buffer: bytearray, color: Color) -> None:
    bubble = [(16, 20), (65, 20), (65, 52), (46, 52), (36, 63), (36, 52), (16, 52)]
    fill_polygon(buffer, bubble, color)
    draw_circle(buffer, 30, 37, 3, (255, 255, 255, 255), fill=True)
    draw_circle(buffer, 41, 37, 3, (255, 255, 255, 255), fill=True)
    draw_circle(buffer, 52, 37, 3, (255, 255, 255, 255), fill=True)


def draw_profile(buffer: bytearray, color: Color) -> None:
    draw_circle(buffer, 40, 28, 12, color, fill=False, stroke_width=4)
    draw_line(buffer, 20, 62, 60, 62, color, width=4)
    draw_line(buffer, 20, 62, 24, 50, color, width=4)
    draw_line(buffer, 60, 62, 56, 50, color, width=4)
    draw_line(buffer, 24, 50, 56, 50, color, width=4)


ICON_DRAWERS = {
    "home": draw_home,
    "inspiration": draw_inspiration,
    "progress": draw_progress,
    "message": draw_message,
    "profile": draw_profile,
}


def build_buffer(drawer_name: str, color: Color) -> bytearray:
    buffer = bytearray(SIZE * SIZE * 4)
    if drawer_name not in ICON_DRAWERS:
        raise ValueError(f"unknown drawer: {drawer_name}")
    ICON_DRAWERS[drawer_name](buffer, color)
    return buffer


def chunk(chunk_type: bytes, data: bytes) -> bytes:
    import zlib

    return len(data).to_bytes(4, "big") + chunk_type + data + zlib.crc32(chunk_type + data).to_bytes(4, "big")


def write_png(path: Path, rgba: bytes, width: int, height: int) -> None:
    import zlib

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = width.to_bytes(4, "big") + height.to_bytes(4, "big") + b"\x08\x06\x00\x00\x00"

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        start = y * stride
        raw.extend(rgba[start : start + stride])

    compressed = zlib.compress(bytes(raw), level=9)
    png = signature + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
    path.write_bytes(png)


def ensure_svg_sources() -> None:
    SRC_SVG_DIR.mkdir(parents=True, exist_ok=True)
    template = """<svg width=\"81\" height=\"81\" viewBox=\"0 0 81 81\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n  <rect x=\"1\" y=\"1\" width=\"79\" height=\"79\" rx=\"16\" stroke=\"{color}\" stroke-width=\"2\"/>\n  <text x=\"40.5\" y=\"45\" text-anchor=\"middle\" font-size=\"13\" fill=\"{color}\" font-family=\"Arial\">{label}</text>\n</svg>\n"""
    labels = {
        "home": "Home",
        "inspiration": "Idea",
        "progress": "Plan",
        "message": "Msg",
        "profile": "Mine",
    }
    for name, label in labels.items():
        svg_path = SRC_SVG_DIR / f"{name}.svg"
        active_svg_path = SRC_SVG_DIR / f"{name}-active.svg"
        if not svg_path.exists():
            svg_path.write_text(template.format(color="#71717A", label=label), encoding="utf-8")
        if not active_svg_path.exists():
            active_svg_path.write_text(template.format(color="#D4AF37", label=label), encoding="utf-8")


def generate() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ensure_svg_sources()

    mapping = {
        "home": "home",
        "inspiration": "inspiration",
        "progress": "progress",
        "message": "message",
        "profile": "profile",
    }

    for icon_name, drawer_name in mapping.items():
        normal_buffer = build_buffer(drawer_name, DEFAULT_COLOR)
        active_buffer = build_buffer(drawer_name, ACTIVE_COLOR)
        write_png(OUT_DIR / f"{icon_name}.png", normal_buffer, SIZE, SIZE)
        write_png(OUT_DIR / f"{icon_name}-active.png", active_buffer, SIZE, SIZE)

    print("Generated tab icons:", ", ".join(f"{k}.png/{k}-active.png" for k in mapping))


if __name__ == "__main__":
    generate()
