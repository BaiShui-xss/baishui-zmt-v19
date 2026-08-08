#!/usr/bin/env python3
# 生成 PWA 安装图标（纯标准库，无第三方依赖）
# 设计：深灰圆角方块 + 白色面板描边 + 天蓝状态点
import zlib, struct, os

def png_chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

def write_png(path, size, rgba):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        raw.extend(rgba[y*size*4:(y+1)*size*4])
    idat = zlib.compress(bytes(raw), 9)
    png = b"\x89PNG\r\n\x1a\n"
    png += png_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += png_chunk(b"IDAT", idat)
    png += png_chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)

def rr_test(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    if x < x0+r and y < y0+r: return (x-x0-r)**2 + (y-y0-r)**2 <= r*r
    if x > x1-r and y < y0+r: return (x-(x1-r))**2 + (y-y0-r)**2 <= r*r
    if x < x0+r and y > y1-r: return (x-x0-r)**2 + (y-(y1-r))**2 <= r*r
    if x > x1-r and y > y1-r: return (x-(x1-r))**2 + (y-(y1-r))**2 <= r*r
    return True

def rr_stroke(x, y, x0, y0, w, h, r, sw):
    if not rr_test(x, y, x0, y0, x0+w, y0+h, r):
        return False
    if rr_test(x, y, x0+sw, y0+sw, x0+w-sw, y0+h-sw, max(0, r-sw)):
        return False
    return True

def build(size):
    rgba = bytearray(size*size*4)
    R = int(size*0.22)
    ins = size*0.20
    ir = size*0.16
    sw = max(2, int(size*0.045))
    cx = cy = size/2
    dot_r = size*0.075
    for y in range(size):
        for x in range(size):
            i = (y*size + x)*4
            if not rr_test(x, y, 0, 0, size, size, R):
                rgba[i:i+4] = b"\x00\x00\x00\x00"
                continue
            t = (x+y)/(2*size)
            r = min(255, 18 + int(20*t))
            g = min(255, 18 + int(20*t))
            b = min(255, 20 + int(24*t))
            if rr_stroke(x, y, ins, ins, size-2*ins, size-2*ins, ir, sw):
                r, g, b = 235, 235, 235
            dx = x - cx
            dy = y - (cy + size*0.04)
            if dx*dx + dy*dy <= dot_r*dot_r:
                r, g, b = 56, 189, 248
            rgba[i] = r; rgba[i+1] = g; rgba[i+2] = b; rgba[i+3] = 255
    return bytes(rgba)

out = os.path.join(os.path.dirname(__file__), "assets", "icons")
os.makedirs(out, exist_ok=True)
write_png(os.path.join(out, "icon-192.png"), 192, build(192))
write_png(os.path.join(out, "icon-512.png"), 512, build(512))
print("icons generated:", os.path.join(out, "icon-192.png"), os.path.join(out, "icon-512.png"))
