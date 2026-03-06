#!/usr/bin/env python3
from __future__ import annotations

import argparse
import binascii
import struct
import zlib
from pathlib import Path
from typing import Iterable

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MASTER_SIZE = 256
PADDING_RATIO = 0.14
LIGHT_SIZES = (16, 32, 48, 180)
DARK_SIZES = (16, 32, 48)


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def read_chunks(payload: bytes) -> list[tuple[bytes, bytes]]:
    chunks: list[tuple[bytes, bytes]] = []
    offset = len(PNG_SIGNATURE)
    while offset < len(payload):
        length = struct.unpack('>I', payload[offset:offset + 4])[0]
        chunk_type = payload[offset + 4:offset + 8]
        data = payload[offset + 8:offset + 8 + length]
        chunks.append((chunk_type, data))
        offset += 12 + length
        if chunk_type == b'IEND':
            break
    return chunks


def paeth_predictor(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def read_png_rgba(path: Path) -> tuple[int, int, bytearray]:
    payload = path.read_bytes()
    if not payload.startswith(PNG_SIGNATURE):
        raise ValueError(f'{path} is not a PNG')

    width = height = bit_depth = color_type = None
    compressed = bytearray()
    for chunk_type, data in read_chunks(payload):
        if chunk_type == b'IHDR':
            width, height, bit_depth, color_type, compression, flt, interlace = struct.unpack('>IIBBBBB', data)
            if bit_depth != 8:
                raise ValueError(f'Unsupported bit depth: {bit_depth}')
            if compression != 0 or flt != 0 or interlace != 0:
                raise ValueError('Unsupported PNG compression/filter/interlace settings')
            if color_type not in (2, 6):
                raise ValueError(f'Unsupported PNG color type: {color_type}')
        elif chunk_type == b'IDAT':
            compressed.extend(data)

    if width is None or height is None or color_type is None:
        raise ValueError(f'{path} missing IHDR')

    bytes_per_pixel = 4 if color_type == 6 else 3
    stride = width * bytes_per_pixel
    raw = zlib.decompress(bytes(compressed))
    result = bytearray(width * height * 4)

    in_offset = 0
    prev = bytearray(stride)
    for y in range(height):
        filter_type = raw[in_offset]
        in_offset += 1
        scanline = bytearray(raw[in_offset:in_offset + stride])
        in_offset += stride
        recon = bytearray(stride)

        for i in range(stride):
            left = recon[i - bytes_per_pixel] if i >= bytes_per_pixel else 0
            up = prev[i]
            up_left = prev[i - bytes_per_pixel] if i >= bytes_per_pixel else 0
            value = scanline[i]
            if filter_type == 0:
                recon[i] = value
            elif filter_type == 1:
                recon[i] = (value + left) & 0xFF
            elif filter_type == 2:
                recon[i] = (value + up) & 0xFF
            elif filter_type == 3:
                recon[i] = (value + ((left + up) >> 1)) & 0xFF
            elif filter_type == 4:
                recon[i] = (value + paeth_predictor(left, up, up_left)) & 0xFF
            else:
                raise ValueError(f'Unsupported filter type: {filter_type}')

        prev = recon
        row_out = y * width * 4
        if color_type == 6:
            result[row_out:row_out + width * 4] = recon
        else:
            for x in range(width):
                src = x * 3
                dst = row_out + x * 4
                result[dst:dst + 3] = recon[src:src + 3]
                result[dst + 3] = 255

    return width, height, result


def write_png_rgba(path: Path, width: int, height: int, rgba: bytes) -> None:
    ensure_parent(path)
    rows = []
    stride = width * 4
    for y in range(height):
        start = y * stride
        rows.append(b'\x00' + rgba[start:start + stride])
    compressed = zlib.compress(b''.join(rows), level=9)

    def chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = binascii.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack('>I', len(data)) + chunk_type + data + struct.pack('>I', crc)

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    payload = bytearray(PNG_SIGNATURE)
    payload.extend(chunk(b'IHDR', ihdr))
    payload.extend(chunk(b'IDAT', compressed))
    payload.extend(chunk(b'IEND', b''))
    path.write_bytes(payload)


def alpha_from_pixel(r: int, g: int, b: int) -> int:
    min_rgb = min(r, g, b)
    whiteness = clamp((min_rgb - 28.0) / 182.0, 0.0, 1.0)
    return int(round((whiteness ** 1.1) * 255))


def average_brand_blue(rgba: bytearray) -> tuple[int, int, int]:
    total_r = total_g = total_b = count = 0
    for offset in range(0, len(rgba), 4):
        r, g, b = rgba[offset], rgba[offset + 1], rgba[offset + 2]
        alpha = alpha_from_pixel(r, g, b)
        if alpha > 8:
            continue
        if b >= g and b > r + 18:
            total_r += r
            total_g += g
            total_b += b
            count += 1
    if count == 0:
        return (33, 122, 233)
    return (round(total_r / count), round(total_g / count), round(total_b / count))


def extract_symbol_mask(width: int, height: int, rgba: bytearray) -> tuple[tuple[int, int, int, int], bytearray]:
    mask = bytearray(width * height)
    min_x = width
    min_y = height
    max_x = -1
    max_y = -1

    for y in range(height):
        for x in range(width):
            offset = (y * width + x) * 4
            alpha = alpha_from_pixel(rgba[offset], rgba[offset + 1], rgba[offset + 2])
            mask[y * width + x] = alpha
            if alpha > 10:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)

    if max_x < min_x or max_y < min_y:
        raise ValueError('Unable to extract symbol mask from source logo')

    return (min_x, min_y, max_x + 1, max_y + 1), mask


def crop_mask(bounds: tuple[int, int, int, int], width: int, mask: bytearray) -> tuple[int, int, bytearray]:
    min_x, min_y, max_x, max_y = bounds
    cropped_width = max_x - min_x
    cropped_height = max_y - min_y
    cropped = bytearray(cropped_width * cropped_height)
    for y in range(cropped_height):
        source_start = (min_y + y) * width + min_x
        target_start = y * cropped_width
        cropped[target_start:target_start + cropped_width] = mask[source_start:source_start + cropped_width]
    return cropped_width, cropped_height, cropped


def resize_rgba_nearest(source: bytes, source_width: int, source_height: int, target_width: int, target_height: int) -> bytearray:
    resized = bytearray(target_width * target_height * 4)
    for y in range(target_height):
        source_y = min(source_height - 1, int((y + 0.5) * source_height / target_height))
        for x in range(target_width):
            source_x = min(source_width - 1, int((x + 0.5) * source_width / target_width))
            src = (source_y * source_width + source_x) * 4
            dst = (y * target_width + x) * 4
            resized[dst:dst + 4] = source[src:src + 4]
    return resized


def render_master(bounds: tuple[int, int, int, int], width: int, mask: bytearray, color: tuple[int, int, int], size: int = MASTER_SIZE) -> bytearray:
    cropped_width, cropped_height, cropped_mask = crop_mask(bounds, width, mask)
    crop_rgba = bytearray(cropped_width * cropped_height * 4)
    for idx, alpha in enumerate(cropped_mask):
        offset = idx * 4
        crop_rgba[offset] = color[0]
        crop_rgba[offset + 1] = color[1]
        crop_rgba[offset + 2] = color[2]
        crop_rgba[offset + 3] = alpha

    max_inner = int(round(size * (1 - 2 * PADDING_RATIO)))
    scale = min(max_inner / cropped_width, max_inner / cropped_height)
    target_width = max(1, int(round(cropped_width * scale)))
    target_height = max(1, int(round(cropped_height * scale)))
    scaled = resize_rgba_nearest(crop_rgba, cropped_width, cropped_height, target_width, target_height)

    canvas = bytearray(size * size * 4)
    x_offset = (size - target_width) // 2
    y_offset = (size - target_height) // 2
    for y in range(target_height):
        for x in range(target_width):
            src = (y * target_width + x) * 4
            dst = ((y + y_offset) * size + (x + x_offset)) * 4
            canvas[dst:dst + 4] = scaled[src:src + 4]
    return canvas


def create_png_ico(path: Path, images: Iterable[tuple[int, bytes]]) -> None:
    entries = list(images)
    ensure_parent(path)
    header = struct.pack('<HHH', 0, 1, len(entries))
    directory = bytearray()
    offset = 6 + 16 * len(entries)
    payload = bytearray()
    for size, data in entries:
        width = 0 if size >= 256 else size
        height = 0 if size >= 256 else size
        directory.extend(struct.pack('<BBBBHHII', width, height, 0, 0, 1, 32, len(data), offset))
        payload.extend(data)
        offset += len(data)
    path.write_bytes(header + directory + payload)


def write_icon_set(base_dir: Path, prefix: str, master: bytes, include_apple: bool) -> None:
    png_blobs: list[tuple[int, bytes]] = []
    for size in LIGHT_SIZES if include_apple else DARK_SIZES:
        resized = resize_rgba_nearest(master, MASTER_SIZE, MASTER_SIZE, size, size)
        file_path = base_dir / f'{prefix}-{size}x{size}.png'
        write_png_rgba(file_path, size, size, resized)
        if size in (16, 32, 48):
            png_blobs.append((size, file_path.read_bytes()))

    if include_apple:
        apple_path = base_dir / 'apple-touch-icon.png'
        apple_blob = resize_rgba_nearest(master, MASTER_SIZE, MASTER_SIZE, 180, 180)
        write_png_rgba(apple_path, 180, 180, apple_blob)
        create_png_ico(base_dir / 'favicon.ico', png_blobs)


def generate(source: Path, admin_public: Path, website_images: Path) -> None:
    width, height, rgba = read_png_rgba(source)
    blue = average_brand_blue(rgba)
    bounds, mask = extract_symbol_mask(width, height, rgba)

    master_light = render_master(bounds, width, mask, blue)
    master_dark = render_master(bounds, width, mask, (255, 255, 255))

    for target in (admin_public, website_images):
        ensure_parent(target / 'placeholder')
        write_icon_set(target, 'favicon-light', master_light, include_apple=True)
        write_icon_set(target, 'favicon-dark', master_dark, include_apple=False)
        write_png_rgba(target / 'favicon.png', 32, 32, resize_rgba_nearest(master_light, MASTER_SIZE, MASTER_SIZE, 32, 32))


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate transparent favicons for web surfaces.')
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--admin-public', required=True, type=Path)
    parser.add_argument('--website-images', required=True, type=Path)
    args = parser.parse_args()
    generate(args.source, args.admin_public, args.website_images)


if __name__ == '__main__':
    main()
