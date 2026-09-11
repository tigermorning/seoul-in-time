"""Download the Namsan panorama source photos into archive-raw/namsan/ (gitignored).

Stdlib only for fetching; Pillow (optional) adds pixel sizes to the manifest.
Re-runnable: existing files are kept unless --force is given.

Sources (see PANORAMA_SOURCES.md):
  서울역사아카이브 (KOGL-1, per-item notice)
    H-TRNS-103288-812  남산 쪽에서 담아낸 경성시가지 전경(2매 연속)  c.1910
    H-TRNS-75528-812   경성 전경                                    1925
    H-TRNS-78520-812   서울 전경                                    "1910" (date doubtful)
  서울기록원 (공공기록 · 이용유형 제한없음)
    item/3933          서울시 전경, 1974-06-17, 11 frames

The 서울역사아카이브 download button asks for a usage-purpose form. This script does
not submit it. It saves the full-view image that the detail page itself renders
(`ARCHIVE_DATA/master/...`); its byte size matches the size the archive lists.

Usage:  python scripts/fetch_namsan_sources.py [--force]
"""
from __future__ import annotations

import hashlib
import html
import io
import json
import re
import ssl
import sys
import urllib.parse
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "archive-raw" / "namsan"
UA = "Mozilla/5.0 (seoul-in-time research fetch)"

# museum.seoul.go.kr only offers ciphers that OpenSSL 3's default security level
# rejects (handshake ends in UNEXPECTED_EOF). Lower the level for that host only;
# certificate verification stays on.
LEGACY_TLS_HOSTS = ("museum.seoul.go.kr",)
_legacy_ctx = ssl.create_default_context()
_legacy_ctx.set_ciphers("DEFAULT:@SECLEVEL=1")

MUSEUM_VIEW = (
    "https://museum.seoul.go.kr/archive/archiveNew/NR_archiveView.do"
    "?ctgryId=CTGRY812&type=D&fileSn=300&upperNodeId=CTGRY812&fileId={id}"
)
MUSEUM_ITEMS = [
    {"id": "H-TRNS-103288-812", "file": "seoul-museum/1910-103288.jpg"},
    {"id": "H-TRNS-75528-812", "file": "seoul-museum/1925-75528.jpg"},
    {"id": "H-TRNS-78520-812", "file": "seoul-museum/1910-78520.jpg"},
]
ARCHIVES_ITEMS = [
    {"item": 3933, "dir": "1974-item3933", "prefix": "3933"},
]


def get(url: str, referer: str | None = None) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, **({"Referer": referer} if referer else {})})
    ctx = _legacy_ctx if urllib.parse.urlsplit(url).hostname in LEGACY_TLS_HOSTS else None
    with urllib.request.urlopen(req, timeout=120, context=ctx) as r:
        return r.read()


def text_lines(page: str) -> list[str]:
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", page, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", t))
    return [line.strip() for line in t.split("\n") if line.strip()]


# Detail pages print label and value on consecutive lines. An empty value means the
# next line is already the following label, so treat any known label as "no value".
LABELS = {
    "명칭", "아카이브 번호", "유물번호", "시기", "장소", "자료출처", "내용",
    "생산자", "기술계층", "법적지위", "소장처", "상세정보", "기록유형", "일자", "기술",
    "접근유형", "이용조건", "이용유형", "이용주기", "정리체계", "공통주기",
}


def field(lines: list[str], label: str, start: int = 0) -> str | None:
    for k in range(start, len(lines) - 1):
        if lines[k] == label:
            value = lines[k + 1]
            return None if value in LABELS or value.startswith("서울역사박물관이 창작한") else value
    return None


def describe(path: Path) -> dict:
    data = path.read_bytes()
    info = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    try:
        from PIL import Image

        Image.MAX_IMAGE_PIXELS = None
        with Image.open(io.BytesIO(data)) as im:
            info["px"] = {"w": im.width, "h": im.height}
            info["mode"] = im.mode
    except ImportError:
        pass
    return info


def fetch_museum(item: dict, force: bool) -> dict:
    view = MUSEUM_VIEW.format(id=item["id"])
    page = get(view).decode("utf-8", errors="replace")
    m = re.search(r'<div class="img-area">\s*<img[^>]*src="(https://museum\.seoul\.go\.kr:8088/ARCHIVE_DATA/master/[^"]+)"', page)
    if not m:
        raise RuntimeError(f"{item['id']}: full-view image not found on detail page")
    master = m.group(1)

    dest = OUT / item["file"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    if force or not dest.exists():
        dest.write_bytes(get(master, referer=view))
    dest.with_suffix(".page.html").write_text(page, encoding="utf-8")

    lines = text_lines(page)
    s = lines.index("명칭")
    title = field(lines, "명칭", s)
    notice = next(l for l in lines[s:] if "공공누리 제1유형" in l)
    return {
        "file": item["file"],
        "archive": "서울역사아카이브",
        "archive_id": item["id"],
        "artifact_no": field(lines, "유물번호", s),
        "title": title,
        "period": field(lines, "시기", s),
        "place": field(lines, "장소", s),
        "source_publication": field(lines, "자료출처", s),
        "description": field(lines, "내용", s),
        "page_url": view,
        "master_url": master,
        "license": {
            "type": "KOGL-1",
            "evidence": "per-item notice",
            "evidence_quote": f"서울역사박물관이 창작한 {title} {notice}",
        },
        **describe(dest),
    }


def fetch_archives(item: dict, force: bool) -> list[dict]:
    view = f"https://archives.seoul.go.kr/item/{item['item']}"
    page = get(view).decode("utf-8", errors="replace")
    zip_path = re.search(r"/common/fileDownload/item/[0-9A-F-]+/images", page)
    if not zip_path:
        raise RuntimeError(f"item/{item['item']}: bundle download link not found")
    # Page order = 관리번호 order. Thumbnails are re-encoded; the bundle holds the originals.
    order = list(dict.fromkeys(re.findall(r"thumbnail/2000_(\d+\.JPG)", page)))

    lines = text_lines(page)
    meta = {
        "archive": "서울기록원",
        "archive_id": next(l for l in lines if re.fullmatch(r"RG\d+-SR\d+-IT\d+", l)),
        "title": re.search(r"상세보기 - ([^|<]+?) \|", page).group(1).strip(),
        "producer": field(lines, "생산자"),
        "date": next((l for l in lines if re.fullmatch(r"\d{4}-\d{2}-\d{2}", l)), None),
        "description": field(lines, "기술"),
        "page_url": view,
        "bundle_url": "https://archives.seoul.go.kr" + zip_path.group(0),
        "license": {
            "type": "KOGL-1",
            "evidence": "metadata",
            "evidence_quote": " / ".join(
                f"{label} {field(lines, label)}" for label in ("법적지위", "접근유형", "이용유형", "이용주기") if field(lines, label)
            ),
        },
    }

    dest_dir = OUT / item["dir"]
    dest_dir.mkdir(parents=True, exist_ok=True)
    targets = {name: dest_dir / f"{item['prefix']}-{i:02d}.jpg" for i, name in enumerate(order, 1)}
    if force or not all(p.exists() for p in targets.values()):
        with zipfile.ZipFile(io.BytesIO(get(meta["bundle_url"], referer=view))) as z:
            members = {Path(n).name: n for n in z.namelist() if n.upper().endswith(".JPG")}
            missing = set(order) - set(members)
            if missing:
                raise RuntimeError(f"item/{item['item']}: bundle lacks {sorted(missing)}")
            for name, p in targets.items():
                p.write_bytes(z.read(members[name]))
    (dest_dir / "page.html").write_text(page, encoding="utf-8")

    return [
        {"file": f"{item['dir']}/{p.name}", "frame": i, "original_name": name, **meta, **describe(p)}
        for i, (name, p) in enumerate(targets.items(), 1)
    ]


def main() -> None:
    force = "--force" in sys.argv
    entries = [fetch_museum(it, force) for it in MUSEUM_ITEMS]
    for it in ARCHIVES_ITEMS:
        entries += fetch_archives(it, force)
    manifest = {"fetched_at": date.today().isoformat(), "entries": entries}
    (OUT / "MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    for e in entries:
        px = e.get("px", {})
        print(f"{e['file']:<34} {px.get('w', '?'):>5}x{px.get('h', '?'):<5} {e['bytes']:>9,} B  {e['archive_id']}")


if __name__ == "__main__":
    main()
