"""Recover where each Namsan source photo was pointing (BACKLOG item 2.3).

Writes scripts/namsan_cameras.json, which build_namsan_pano.py turns into
equirect panoramas. Needs numpy, scipy, opencv-python (SIFT) and Pillow.
Inputs are the masters fetched by fetch_namsan_sources.py into archive-raw/namsan/.

Camera model: pinhole, no lens distortion, principal point at the centre of
each print. Bearings are degrees clockwise from true north; pitch is up (+).
World frame is local ENU around the viewpoint, with earth curvature and
standard refraction applied to far landmarks.

How each era is solved:
  1925  One photo. Resection for viewpoint (lat, lon, height), yaw, pitch and
        focal length from five landmarks: the 인왕산, 북악산 and 비봉 peaks,
        the Government-General dome and the 조선은행 main building.
  1974  Eleven frames from one session. SIFT matches between frames give
        their relative rotations (pure rotation about one centre, focal length
        per frame because the prints were enlarged at two scales). Landmarks
        (안산, 인왕산, 어린이회관) fix the absolute bearing and the viewpoint.
  1910  Two postcards cut from one continuous panorama (其四 left, 其三 right).
        There are too few identifiable near landmarks to solve the viewpoint,
        so it is fixed at the mean of the 1925 and 1974 solutions, which agree
        within about 180 m. Each card's yaw, the shared pitch and the focal
        length come from 인왕산, 북악산 and the 명동성당 spire, plus the
        constraint that the right edge of 其四 continues into the left edge
        of 其三.

Landmark pixel positions were read by hand off gridded enlargements. The
residuals printed at the end are the check.

Usage:  python scripts/solve_namsan_cameras.py
"""
from __future__ import annotations

import itertools
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.optimize import least_squares

from namsan_camera import backproject, cam_matrix, project

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "archive-raw" / "namsan"
OUT = ROOT / "scripts" / "namsan_cameras.json"
Image.MAX_IMAGE_PIXELS = None

# lat, lon from OpenStreetMap Nominatim (2026-09-11). Height is metres above sea
# level of the point actually sighted (summit, dome top, spire tip), approximate.
LANDMARKS = {
    "안산": (37.57693, 126.94578, 296),
    "인왕산": (37.58492, 126.95781, 338),
    "북악산": (37.59303, 126.97376, 342),
    "비봉": (37.62561, 126.95625, 560),
    "총독부 돔": (37.57695, 126.97690, 80),  # stood where 흥례문 is now
    "조선은행": (37.56205, 126.98037, 45),  # 한국은행 화폐박물관
    "명동성당 첨탑": (37.56316, 126.98716, 75),
    "어린이회관": (37.55451, 126.98118, 140),  # now 교육연구정보원; tower top
}
EARTH_R = 6371000.0


def enu(view, name):
    """Unit vector from the viewpoint (lat, lon, height) to a landmark."""
    lat0, lon0, h0 = view
    lat, lon, h = LANDMARKS[name]
    dn = math.radians(lat - lat0) * EARTH_R
    de = math.radians(lon - lon0) * EARTH_R * math.cos(math.radians(lat0))
    d = math.hypot(de, dn)
    du = h - h0 - d * d / (2 * EARTH_R) * 0.87  # curvature minus standard refraction
    v = np.array([de, dn, du])
    return v / np.linalg.norm(v)


def rms(a):
    return float(np.sqrt(np.mean(np.square(a))))


# ---------------------------------------------------------------- 1925 ----
def solve_1925():
    crop = [28, 0, 3110, 2345]  # scan margin outside the print
    cx, cy = (crop[0] + crop[2]) / 2, (crop[1] + crop[3]) / 2
    obs = {  # full-resolution pixels
        "인왕산": (160, 290),
        "북악산": (2715, 278),
        "비봉": (2120, 240),
        "총독부 돔": (2270, 850),
        "조선은행": (860, 1400),
    }

    def resid(p):
        lat, lon, h, yaw, pitch, f = p
        M = cam_matrix(yaw, pitch)
        return np.concatenate(
            [project(enu((lat, lon, h), n), M, f, cx, cy)[0] - xy for n, xy in obs.items()]
        )

    best = None
    for lat0 in np.arange(37.551, 37.560, 0.0015):
        for lon0 in np.arange(126.976, 126.991, 0.003):
            r = least_squares(
                resid, [lat0, lon0, 140, 337, -5, 6000],
                bounds=([37.545, 126.970, 40, 300, -20, 2000], [37.565, 126.995, 260, 370, 10, 12000]),
                x_scale=[0.001, 0.001, 30, 5, 2, 500],
            )
            if best is None or rms(r.fun) < rms(best.fun):
                best = r
    lat, lon, h, yaw, pitch, f = best.x
    return {
        "viewpoint": {"lat": lat, "lon": lon, "h_m": h},
        "rms_px": rms(best.fun),
        "residual_px": dict(zip(obs, best.fun.reshape(-1, 2).round(1).tolist())),
        "photos": [{
            "src": "seoul-museum/1925-75528.jpg",
            "crop": crop,
            "yaw": yaw % 360, "pitch": pitch, "roll": 0.0, "f": f, "cx": cx, "cy": cy,
        }],
    }


# ---------------------------------------------------------------- 1974 ----
LOBS_1974 = [  # (frame number, landmark, pixel)
    (11, "안산", (105, 228)), (11, "인왕산", (385, 231)),
    (1, "안산", (85, 190)), (1, "인왕산", (355, 179)),
    (4, "어린이회관", (240, 208)), (4, "안산", (570, 226)),
    (6, "인왕산", (285, 197)),
    (2, "어린이회관", (435, 200)), (5, "어린이회관", (435, 173)), (9, "어린이회관", (457, 180)),
]


def match_1974(gray):
    # Only the upper 62 % of each frame: city and skyline are far enough for a
    # rotation-only model; the foliage and rock below are within metres.
    sift = cv2.SIFT_create(nfeatures=4000)
    feats = []
    for g in gray:
        mask = np.zeros_like(g)
        mask[: int(g.shape[0] * 0.62), :] = 255
        feats.append(sift.detectAndCompute(g, mask))
    matcher = cv2.BFMatcher()
    rng = np.random.default_rng(0)
    pairs = []
    for i, j in itertools.combinations(range(len(gray)), 2):
        (ka, da), (kb, db) = feats[i], feats[j]
        good = [a for a, b in matcher.knnMatch(da, db, k=2) if a.distance < 0.7 * b.distance]
        if len(good) < 12:
            continue
        pa = np.float64([ka[g.queryIdx].pt for g in good])
        pb = np.float64([kb[g.trainIdx].pt for g in good])
        Hm, inl = cv2.findHomography(pa, pb, cv2.RANSAC, 3.0)
        if Hm is None or inl.sum() < 20:
            continue
        keep = inl.ravel().astype(bool)
        pa, pb = pa[keep], pb[keep]
        if len(pa) > 80:
            s = rng.choice(len(pa), 80, replace=False)
            pa, pb = pa[s], pb[s]
        pairs.append((i, j, pa, pb, Hm))
    return pairs


def solve_1974():
    n = 11
    names = [f"1974-item3933/3933-{i:02d}.jpg" for i in range(1, n + 1)]
    gray = [cv2.imread(str(RAW / name), cv2.IMREAD_GRAYSCALE) for name in names]
    centre = [(g.shape[1] / 2, g.shape[0] / 2) for g in gray]
    pairs = match_1974(gray)

    def unpack(p):
        return p[0], p[1], p[2], p[3:3 + n], p[3 + n:].reshape(n, 3)

    def resid(p):
        lat, lon, h, F, A = unpack(p)
        Ms = [cam_matrix(*a) for a in A]
        out = []
        for i, j, pa, pb, _ in pairs:
            out.append((project(backproject(pa, Ms[i], F[i], *centre[i]), Ms[j], F[j], *centre[j]) - pb).ravel())
            out.append((project(backproject(pb, Ms[j], F[j], *centre[j]), Ms[i], F[i], *centre[i]) - pa).ravel())
        for frame, name, xy in LOBS_1974:
            k = frame - 1
            q = project(enu((lat, lon, h), name), Ms[k], F[k], *centre[k])[0]
            out.append((q - xy) * 2.0)  # one landmark outweighs one feature match
        return np.concatenate(out)

    # Initial yaw/pitch: chain homography translations out from frame 11.
    f0 = 850.0
    yaw, pit = {10: 320.0}, {10: -3.0}
    for _ in range(n):
        for i, j, _, _, Hm in pairs:
            if i in yaw and j not in yaw:
                yaw[j] = yaw[i] - math.degrees(math.atan(Hm[0, 2] / f0))
                pit[j] = pit[i] + math.degrees(math.atan(Hm[1, 2] / f0))
            elif j in yaw and i not in yaw:
                yaw[i] = yaw[j] + math.degrees(math.atan(Hm[0, 2] / f0))
                pit[i] = pit[j] - math.degrees(math.atan(Hm[1, 2] / f0))
    missing = sorted(k + 1 for k in range(n) if k not in yaw)
    if missing:
        raise RuntimeError(f"1974 frames {missing} share no feature matches with the rest; drop them or relax the match thresholds")
    lb = np.array([37.545, 126.975, 50] + [400] * n + [-720, -30, -15] * n)
    ub = np.array([37.562, 126.995, 320] + [1800] * n + [720, 15, 15] * n)
    best = None
    for lat0 in (37.552, 37.5545, 37.557):
        for lon0 in (126.982, 126.9855, 126.989):
            x0 = [lat0, lon0, 150] + [f0] * n + sum([[yaw[k], pit[k], 0.0] for k in range(n)], [])
            r = least_squares(
                resid, np.clip(x0, lb + 1e-6, ub - 1e-6),
                bounds=(lb, ub),
                x_scale=[0.001, 0.001, 30] + [40] * n + [2, 1, 1] * n,
                loss="soft_l1", f_scale=3.0,
            )
            if best is None or r.cost < best.cost:
                best = r
    lat, lon, h, F, A = unpack(best.x)
    full = resid(best.x)
    n_lm = len(LOBS_1974)
    match, lm = full[: -2 * n_lm], (full[-2 * n_lm:] / 2.0).reshape(-1, 2)
    return {
        "viewpoint": {"lat": lat, "lon": lon, "h_m": h},
        "match_median_px": float(np.median(np.abs(match))),
        "residual_px": {f"#{fr:02d} {name}": lm[k].round(1).tolist() for k, (fr, name, _) in enumerate(LOBS_1974)},
        "photos": [
            {"src": names[k], "crop": [0, 0, int(centre[k][0] * 2), int(centre[k][1] * 2)],
             "yaw": A[k][0] % 360, "pitch": A[k][1], "roll": A[k][2], "f": F[k],
             "cx": centre[k][0], "cy": centre[k][1]}
            for k in range(n)
        ],
    }


# ---------------------------------------------------------------- 1910 ----
def solve_1910(view):
    path = RAW / "seoul-museum" / "1910-103288.jpg"
    W, H = Image.open(path).size
    seam = 1235  # where 其四 meets 其三; a faint vertical join line in the scan
    caption_top = 712  # printed caption strip below this row
    cards = {"四": (0, seam), "三": (seam, W - seam)}
    obs = {"인왕산": (130, 85, "四"), "북악산": (1258, 95, "三"), "명동성당 첨탑": (2318, 330, "三")}
    cy = H / 2

    def resid(p):
        t4, t3, pitch, f = p
        out = []
        for name, (x, y, card) in obs.items():
            x0, w = cards[card]
            M = cam_matrix(t4 if card == "四" else t3, pitch)
            out.append(project(enu(view, name), M, f, x0 + w / 2, cy)[0] - (x, y))
        e4 = t4 + math.degrees(math.atan(cards["四"][1] / 2 / f))
        e3 = t3 - math.degrees(math.atan(cards["三"][1] / 2 / f))
        out.append([(e4 - e3) * f * math.pi / 180])
        return np.concatenate(out)

    r = least_squares(resid, [-25, 0, -3, 2700], x_scale=[5, 5, 2, 200])
    t4, t3, pitch, f = r.x
    return {
        "viewpoint": {"lat": view[0], "lon": view[1], "h_m": view[2], "fixed": True},
        "rms_px": rms(r.fun),
        "residual_px": dict(zip(obs, r.fun[:-1].reshape(-1, 2).round(1).tolist())),
        "photos": [
            {"src": "seoul-museum/1910-103288.jpg", "card": "其四", "crop": [0, 0, seam, caption_top],
             "yaw": t4 % 360, "pitch": pitch, "roll": 0.0, "f": f, "cx": seam / 2, "cy": cy},
            {"src": "seoul-museum/1910-103288.jpg", "card": "其三", "crop": [seam, 0, W, caption_top],
             "yaw": t3 % 360, "pitch": pitch, "roll": 0.0, "f": f, "cx": seam + (W - seam) / 2, "cy": cy},
        ],
    }


def hfov(p):
    return 2 * math.degrees(math.atan((p["crop"][2] - p["crop"][0]) / 2 / p["f"]))


def main():
    e1925 = solve_1925()
    e1974 = solve_1974()
    view = tuple((e1925["viewpoint"][k] + e1974["viewpoint"][k]) / 2 for k in ("lat", "lon", "h_m"))
    e1910 = solve_1910(view)
    out = {
        "note": "Generated by scripts/solve_namsan_cameras.py. Bearings clockwise from true north.",
        "consensus_viewpoint": dict(zip(("lat", "lon", "h_m"), view)),
        "eras": {"1910": e1910, "1925": e1925, "1974": e1974},
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    for era, e in out["eras"].items():
        vp = e["viewpoint"]
        fit = f"rms {e['rms_px']:.1f}px" if "rms_px" in e else f"match median {e['match_median_px']:.2f}px"
        print(f"{era}: viewpoint {vp['lat']:.5f},{vp['lon']:.5f} h {vp['h_m']:.0f}m  {fit}")
        for p in e["photos"]:
            print(f"    {p['src']:<32} {p.get('card', ''):<3} yaw {p['yaw']:6.1f}  pitch {p['pitch']:5.1f}  hfov {hfov(p):5.1f}")
        print("    landmark residuals (px):", e["residual_px"])


if __name__ == "__main__":
    main()
