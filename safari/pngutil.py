#!/usr/bin/env python3
"""Minimal PNG read/write, just enough to drop an unused alpha channel.

App Store validation rejects an iOS app icon that has an alpha channel at
all — "The large app icon ... can't be transparent or contain an alpha
channel" — regardless of whether any pixel is actually translucent. The
icon safari-web-extension-converter generates from icons/icon128.png is
fully opaque but RGBA, so it trips that check.

Written against the standard library alone: this runs inside a build script
that otherwise needs no dependencies, and pulling in Pillow to delete one
channel is not a trade worth making.
"""
import struct, zlib


def _chunks(data):
    pos = 8  # skip the signature
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        yield data[pos + 4:pos + 8], data[pos + 8:pos + 8 + length]
        pos += 12 + length  # length + type + payload + crc


def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def _unfilter(raw, width, height, bpp):
    """Reverse the per-scanline filters, returning packed samples."""
    stride = width * bpp
    out = bytearray()
    prev = bytearray(stride)
    pos = 0
    for _ in range(height):
        ftype = raw[pos]; pos += 1
        line = bytearray(raw[pos:pos + stride]); pos += stride
        if ftype == 1:
            for x in range(bpp, stride):
                line[x] = (line[x] + line[x - bpp]) & 255
        elif ftype == 2:
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif ftype == 3:
            for x in range(stride):
                left = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((left + prev[x]) >> 1)) & 255
        elif ftype == 4:
            for x in range(stride):
                left = line[x - bpp] if x >= bpp else 0
                upleft = prev[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + _paeth(left, prev[x], upleft)) & 255
        elif ftype != 0:
            raise ValueError(f"unsupported PNG filter type {ftype}")
        out += line
        prev = line
    return out


def _chunk(tag, payload):
    return (struct.pack(">I", len(payload)) + tag + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF))


def strip_alpha(path):
    """Rewrite an 8-bit RGBA PNG in place as 8-bit RGB. No-op if not RGBA.

    Refuses to run if any pixel is actually translucent, since that would
    silently change how the image looks rather than just shrinking it.
    Returns True if the file was rewritten.
    """
    data = open(path, "rb").read()

    width = height = bit_depth = color_type = None
    idat = b""
    for tag, payload in _chunks(data):
        if tag == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", payload[:10])
            interlace = payload[12]
            if interlace:
                raise ValueError(f"{path}: interlaced PNGs are not supported")
        elif tag == b"IDAT":
            idat += payload

    if color_type != 6:          # 6 == truecolour with alpha
        return False
    if bit_depth != 8:
        raise ValueError(f"{path}: expected 8 bits per sample, got {bit_depth}")

    pixels = _unfilter(zlib.decompress(idat), width, height, 4)

    translucent = sum(1 for i in range(3, len(pixels), 4) if pixels[i] != 255)
    if translucent:
        raise ValueError(
            f"{path}: {translucent} pixels are translucent — dropping the alpha "
            f"channel would change the image. Flatten it against a background "
            f"deliberately instead.")

    # Re-filter with type 0 (None) on every scanline. The icon is small and
    # built once per project generation, so the extra bytes cost nothing.
    out = bytearray()
    for y in range(height):
        row = pixels[y * width * 4:(y + 1) * width * 4]
        out.append(0)
        for x in range(0, len(row), 4):
            out += row[x:x + 3]

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n"
           + _chunk(b"IHDR", header)
           + _chunk(b"IDAT", zlib.compress(bytes(out), 9))
           + _chunk(b"IEND", b""))
    open(path, "wb").write(png)
    return True
