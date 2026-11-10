"""Fetch the Jegi-dong course photos from 서울역사아카이브 and write spot JSONs.

Usage: python -I make_jegi.py <repo-root>
"""
import io, json, re, ssl, sys, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(sys.argv[1])
UA = "Mozilla/5.0 (seoul-in-time research fetch)"
ctx = ssl.create_default_context()
ctx.set_ciphers("DEFAULT:@SECLEVEL=1")
B = ("https://museum.seoul.go.kr/archive/archiveNew/NR_archiveView.do"
     "?ctgryId=CTGRY{c}&type=B&upperNodeId=CTGRY{u}&fileSn=300&fileId={id}")
D = ("https://museum.seoul.go.kr/archive/archiveNew/NR_archiveView.do"
     "?ctgryId=CTGRY{c}&type=D&fileSn=300&upperNodeId=CTGRY{c}&fileId={id}")

NOTE = ("HACK:ON 제기동 코스 지도용 대략 좌표(OpenStreetMap). 옛 사진의 촬영 지점과 방향은 "
        "현장 확인 전이라 heading_deg는 자리표시 값.")

# (url, year, precision, date)
P = {
    "75275-852": (D.format(c="852", id="H-TRNS-75275-852"), 1914, "exact", None),
    "97499-770": (B.format(c="766", u="770", id="H-TRNS-97499-770"), 1979, "exact", "1979-02-01"),
    "84233-762": (B.format(c="760", u="762", id="H-TRNS-84233-762"), 1974, "exact", "1974-12-23"),
    "97715-771": (B.format(c="766", u="771", id="H-TRNS-97715-771"), 1979, "exact", "1979-03-02"),
    "81387-732": (B.format(c="731", u="732", id="H-TRNS-81387-732"), 1967, "exact", "1967-04-28"),
}

# id, ko, en, lat, lng, photos (first one is the slider photo)
SPOTS = [
    ("cheongnyangni-station", "청량리역", "Cheongnyangni Station", 37.58060, 127.04826, ["75275-852"]),
    ("cheongnyangni-market", "청량리 시장", "Cheongnyangni Market", 37.5787, 127.0405, ["97499-770"]),
    ("jegi-hanok-alley", "제기동 한옥 골목", "Jegi-dong Hanok Alleys", 37.5835, 127.0398, ["84233-762", "97715-771"]),
    ("jegi-road-korea-univ", "고려대로 가는 길", "The Road to Korea University", 37.5820, 127.0350, ["81387-732"]),
]


def get(url, referer=None):
    h = {"User-Agent": UA}
    if referer:
        h["Referer"] = referer
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=180, context=ctx) as r:
        return r.read()


def photo(sid, pid):
    view, year, prec, date = P[pid]
    aid = "H-TRNS-" + pid
    page = get(view).decode("utf-8")
    m = re.search(r'<div class="img-area">\s*<img[^>]*src="(https://museum\.seoul\.go\.kr:8088/ARCHIVE_DATA/master/[^"]+)"', page)
    if not m:
        raise SystemExit(f"{aid}: image not found")
    box = re.search(r'<div class="opencode_box_con">\s*<p>(.*?)<br', page, flags=re.S).group(1)
    notice = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", box).replace("&nbsp;", " ")).strip()
    if "공공누리 제1유형" not in notice:
        raise SystemExit(f"{aid}: not KOGL type 1: {notice}")
    title = re.search(r"서울역사박물관이 창작한 (.+?) 저작물은", notice).group(1).strip()
    raw = get(m.group(1), referer=view)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    ow, oh = img.size
    img.thumbnail((1600, 1600))
    out_dir = ROOT / "public" / "spots" / sid
    out_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{pid}.jpg"
    img.save(out_dir / fname, "JPEG", quality=85, optimize=True)
    print(sid, aid, title, f"{ow}x{oh} -> {img.size[0]}x{img.size[1]}", (out_dir / fname).stat().st_size // 1024, "KB")
    return {
        "id": pid,
        "title": {"ko": title},
        "year": year,
        "year_precision": prec,
        "date": date,
        "media_type": "photo",
        "image": {"file": fname, "original_ref": view, "original_px": {"w": ow, "h": oh}, "crop": None},
        "source": {"org": "서울역사박물관", "archive_id": aid, "url": view},
        "license": {
            "type": "KOGL-1",
            "evidence": "badge",
            "evidence_url": view,
            "evidence_quote": notice,
            "attribution": f"본 저작물은 서울역사박물관이 공공누리 제1유형으로 개방한 '{title}'({aid})을 이용하였습니다. 원본은 서울역사아카이브에서 볼 수 있습니다. https://museum.seoul.go.kr/archive/",
            "checked_at": "2026-11-11",
        },
        "alignment": {"hints": []},
    }


for sid, ko, en, lat, lng, pids in SPOTS:
    spot = {
        "schema_version": 1,
        "id": sid,
        "status": "draft",
        "name": {"ko": ko, "en": en},
        "viewpoint": {"lat": lat, "lng": lng, "heading_deg": 0, "hfov_deg": 60, "confidence": "rough", "surveyed_at": None, "notes": NOTE},
        "guide": {"instruction": {"ko": f"{ko}에서 옛 사진과 같은 구도로 서 보세요."}, "stand_here_image": None, "landmarks": []},
        "present": None,
        "historical": [photo(sid, p) for p in pids],
    }
    (ROOT / "spots" / f"{sid}.json").write_text(json.dumps(spot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
