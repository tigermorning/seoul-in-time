"""Compose the Namsan equirect panoramas (BACKLOG item 2.4).

Reads the camera solutions in scripts/namsan_cameras.json and the masters in
archive-raw/namsan/, and writes one 2:1 equirect JPEG per era into
public/spots/namsan-hoehyeon/. The centre column faces true north and east is
to the right, matching the viewer (src/lib/panoScene.ts) with
view.heading_deg = 0.

Each photo is reprojected pixel by pixel through its pinhole camera, so it
covers exactly the bearings and elevations it saw. Everything no photo covers
is filled with a plain sky above the horizon and plain ground below it, toned
from the photos themselves.

Needs numpy, opencv-python and Pillow.

Usage:  python scripts/build_namsan_pano.py [--width 4096]
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from namsan_camera import cam_matrix

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "archive-raw" / "namsan"
CAMERAS = ROOT / "scripts" / "namsan_cameras.json"
OUT_DIR = ROOT / "public" / "spots" / "namsan-hoehyeon"
Image.MAX_IMAGE_PIXELS = None

ERAS = {
    # era key in namsan_cameras.json -> output file (historical[].image.file) and options
    "1910": {"file": "1910-postcard.jpg", "feather_deg": 1.2},
    "1925": {"file": "1925-gyeongseong.jpg", "feather_deg": 1.2},
    # Frames 1, 9 and 10 were shot over a boulder a few metres away; blended
    # with the others it shows up as grey ghosts, and the rest cover the same
    # bearings.
    "1974": {"file": "1974-namsan.jpg", "feather_deg": 3.0, "skip_frames": {1, 9, 10}},
}


def load_source(cam: dict, px_per_deg: float):
    """Crop the master and shrink it to about 1.5x the canvas resolution, so the
    bilinear lookup does not alias. Returns the image and the adjusted camera."""
    img = Image.open(RAW / cam["src"]).convert("RGB")
    x0, y0, x1, y1 = cam["crop"]
    img = img.crop((x0, y0, x1, y1))
    s = min(1.0, 1.5 * px_per_deg / (cam["f"] * math.pi / 180))
    if s < 1.0:
        img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    sx, sy = img.width / (x1 - x0), img.height / (y1 - y0)
    return np.asarray(img, dtype=np.float32), {
        "f": cam["f"] * sx, "cx": (cam["cx"] - x0) * sx, "cy": (cam["cy"] - y0) * sy,
        "M": cam_matrix(cam["yaw"], cam["pitch"], cam.get("roll", 0.0)).astype(np.float32),
    }


def sphere_dirs(width: int):
    height = width // 2
    lon = (np.arange(width) + 0.5) / width * 2 * np.pi - np.pi  # bearing; 0 = north, at the centre
    lat = np.pi / 2 - (np.arange(height) + 0.5) / height * np.pi
    lon, lat = np.meshgrid(lon, lat)
    d = np.stack([np.cos(lat) * np.sin(lon), np.cos(lat) * np.cos(lon), np.sin(lat)], -1)
    return d.astype(np.float32), np.degrees(lat)


def reproject(im, cam, dirs, feather_deg):
    """Sample one photo onto the sphere. Returns colour, blend weight and mask."""
    h, w = im.shape[:2]
    c = dirs @ cam["M"]
    z = c[..., 2]
    with np.errstate(divide="ignore", invalid="ignore"):
        u = np.where(z > 1e-3, cam["f"] * c[..., 0] / z + cam["cx"], -1e6).astype(np.float32)
        v = np.where(z > 1e-3, cam["f"] * c[..., 1] / z + cam["cy"], -1e6).astype(np.float32)
    inside = (u >= 0) & (v >= 0) & (u <= w - 1) & (v <= h - 1)
    # Weight falls off toward this photo's own edges, so where photos overlap
    # the one seen nearer its centre wins.
    feather = cam["f"] * math.tan(math.radians(feather_deg))
    wgt = np.clip(np.minimum.reduce([u, v, w - 1 - u, h - 1 - v]) / feather, 0, 1)
    wgt = wgt * wgt * (3 - 2 * wgt)
    sample = cv2.remap(im, u, v, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return sample, np.maximum(wgt, 1e-4 * inside), inside


def gains(images, cams, feather_deg):
    """Frames of one session were printed at different densities. Solve one
    brightness gain per frame from the mean levels where frames overlap (the
    same idea as OpenCV's GainCompensator), on a coarse sphere."""
    dirs, elev = sphere_dirs(1024)
    lum, masks = [], []
    for im, cam in zip(images, cams):
        s, _, m = reproject(im, cam, dirs, feather_deg)
        lum.append(s.mean(axis=2))
        masks.append(m & (elev > -8))  # sky and city; the foliage below differs frame to frame
    n = len(images)
    A = np.zeros((n, n))
    b = np.zeros(n)
    sn, sg = 10.0, 0.1
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            ov = masks[i] & masks[j]
            cnt = ov.sum()
            if cnt < 50:
                continue
            Ii, Ij = lum[i][ov].mean(), lum[j][ov].mean()
            A[i, i] += cnt * (Ii * Ii / sn**2 + 1 / sg**2)
            A[i, j] -= cnt * Ii * Ij / sn**2
            b[i] += cnt / sg**2
    for i in range(n):
        if A[i, i] == 0:
            A[i, i], b[i] = 1, 1
    return np.linalg.solve(A, b)


def compose(era: dict, opts: dict, width: int) -> Image.Image:
    height = width // 2
    px_per_deg = width / 360
    feather_deg = opts["feather_deg"]
    photos = [p for k, p in enumerate(era["photos"], 1) if k not in opts.get("skip_frames", set())]
    loaded = [load_source(p, px_per_deg) for p in photos]
    images, cams = [im for im, _ in loaded], [c for _, c in loaded]
    multi = len(images) > 2
    if multi:
        g = gains(images, cams, feather_deg)
        images = [np.clip(im * gi, 0, 255) for im, gi in zip(images, g)]

    dirs, elev = sphere_dirs(width)
    acc = np.zeros((height, width, 3), np.float32)
    wsum = np.zeros((height, width), np.float32)
    covered = np.zeros((height, width), bool)
    for im, cam in zip(images, cams):
        sample, wgt, inside = reproject(im, cam, dirs, feather_deg)
        if multi:
            # Sharpen toward winner-take-all below the skyline, where overlapping
            # frames disagree about foliage a few metres away; keep the soft
            # blend in the sky.
            wgt = np.where(elev > 0, wgt, wgt**4)
        acc += sample * wgt[..., None]
        wsum += wgt
        covered |= inside
    photo = np.where(covered[..., None], acc / np.maximum(wsum, 1e-9)[..., None], 0)

    # Fade into the fill only at the outer boundary of all photos together, not
    # where one photo hands over to the next (the 1910 card seam).
    dist = cv2.distanceTransform(covered.astype(np.uint8), cv2.DIST_L2, 5)
    alpha = np.clip(dist / (feather_deg * px_per_deg), 0, 1)
    alpha = (alpha * alpha * (3 - 2 * alpha))[..., None]

    # Tone the fill from the photos' own top and bottom rows.
    rows = np.where(covered.any(axis=1))[0]
    band = max(1, len(rows) // 12)
    top, bottom = np.zeros_like(covered), np.zeros_like(covered)
    top[rows[:band]] = True
    bottom[rows[-band:]] = True
    sky = np.percentile(photo[covered & top], 75, axis=0)
    ground = np.median(photo[covered & bottom], axis=0)
    t_up = np.clip(elev / 70, 0, 1)[..., None]
    t_dn = np.clip(-elev / 50, 0, 1)[..., None]
    sky_fill = sky * (1 - 0.18 * t_up)  # sky darkens slightly toward the zenith
    ground_fill = ground * (0.85 - 0.35 * t_dn) + sky * 0.15 * (1 - t_dn)
    # A hazy horizon band instead of a ruled line; centred a little below 0°
    # because from ~150 m up the city meets the sky slightly below level.
    t = np.clip((elev + 4.0) / 6.0, 0, 1)[..., None]
    t = t * t * (3 - 2 * t)
    fill = ground_fill * (1 - t) + sky_fill * t
    out = photo * alpha + fill * (1 - alpha)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--width", type=int, default=4096, help="equirect width; height is half")
    args = ap.parse_args()
    cams = json.loads(CAMERAS.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for key, opts in ERAS.items():
        img = compose(cams["eras"][key], opts, args.width)
        path = OUT_DIR / opts["file"]
        img.save(path, quality=88, optimize=True, progressive=True)
        print(f"{path.relative_to(ROOT)}  {img.width}x{img.height}  {path.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
