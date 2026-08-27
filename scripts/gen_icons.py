#!/usr/bin/env python3
"""Generates simple placeholder PWA icons (no external deps: raw PNG encoding).

Draws a dark-navy square with three horizontal white "masked line" bars,
echoing the app's redaction concept. Replace with real brand icons later.
"""
import struct
import zlib
from pathlib import Path

BG = (15, 23, 42)  # #0f172a, matches manifest.theme_color
BAR = (226, 232, 240)  # #e2e8f0


def make_icon(size: int) -> bytes:
    pixels = [[BG for _ in range(size)] for _ in range(size)]

    margin = size // 5
    bar_height = size // 10
    gap = size // 8
    bar_width = size - 2 * margin
    start_y = size // 2 - (bar_height * 3 + gap * 2) // 2

    for i in range(3):
        y0 = start_y + i * (bar_height + gap)
        width = bar_width if i != 1 else int(bar_width * 0.7)
        for y in range(y0, y0 + bar_height):
            for x in range(margin, margin + width):
                if 0 <= y < size and 0 <= x < size:
                    pixels[y][x] = BAR

    raw = bytearray()
    for row in pixels:
        raw.append(0)  # no filter
        for r, g, b in row:
            raw.extend((r, g, b))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def main() -> None:
    out_dir = Path(__file__).resolve().parent.parent / "public" / "icons"
    out_dir.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        path = out_dir / f"icon-{size}.png"
        path.write_bytes(make_icon(size))
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
