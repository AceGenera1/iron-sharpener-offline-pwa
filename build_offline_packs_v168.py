#!/usr/bin/env python3
"""Build moderate, gzip-compressed static resource packs for Iron Sharpener v168.

Run from the Iron Sharpener repository root:
    python build_offline_packs_v168.py

It creates:
    offline-packs/manifest.json
    offline-packs/pack-0001.json
    offline-packs/pack-0001.json.gz
    ...

The browser stores the unpacked files back into the existing IndexedDB record format,
so runtime resource lookup remains unchanged.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import mimetypes
import os
import shutil
from pathlib import Path
from typing import Iterable

PACK_FORMAT = "rdm-resource-pack-v1"
DEFAULT_TARGET_RAW_BYTES = 512 * 1024
LAUNCH_FILES = {
    "index.html",
    "personal-study.html",
    "manifest.json",
    "assets/iron-sharpener-logo.png",
    "assets/disciple-journal-logo.png",
}


def posix(path: Path) -> str:
    return path.as_posix().lstrip("./")


def is_bible_chapter(path: str) -> bool:
    normalized = path.replace("\\", "/")
    return normalized.startswith("bible/web/") and normalized.lower().endswith(".json")


def content_type(path: str) -> str:
    guessed, _ = mimetypes.guess_type(path)
    if path.lower().endswith(".json"):
        return "application/json; charset=utf-8"
    return guessed or "application/octet-stream"


def canonical_path(value: str) -> str:
    raw = str(value or "").strip().replace("\\", "/")
    while raw.startswith("./"):
        raw = raw[2:]
    raw = raw.split("#", 1)[0].split("?", 1)[0].lstrip("/")
    return raw


def read_json(path: Path):
    if not path.exists() or not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def normalize_resource_file(prefix: str, value: str) -> str:
    item = canonical_path(value)
    if not item:
        return ""
    if item.lower().startswith("bible/resources/"):
        return item if item.lower().endswith(".json") else item + ".json"
    for head in ("topics/", "doctrine/", "backgrounds/"):
        if item.lower().startswith(head):
            item = item[len(head):]
            break
    if not item.lower().endswith(".json"):
        item += ".json"
    return canonical_path(f"{prefix}/{item}")


def indexed_files(prefix: str, data) -> set[str]:
    found: set[str] = set()

    def add(value):
        if not isinstance(value, str):
            return
        path = normalize_resource_file(prefix, value)
        if path:
            found.add(path)

    def walk(value):
        if not value:
            return
        if isinstance(value, str):
            add(value)
            return
        if isinstance(value, list):
            for item in value:
                walk(item)
            return
        if isinstance(value, dict):
            for key in ("file", "path", "slug", "id"):
                if isinstance(value.get(key), str):
                    add(value[key])
                    break
            for key in ("files", "topics", "entries", "items", "resources"):
                walk(value.get(key))

    walk(data)
    return found


def read_offline_manifest(root: Path) -> list[str]:
    data = read_json(root / "offline-manifest.json")
    if isinstance(data, list):
        values = data
    elif isinstance(data, dict) and isinstance(data.get("files"), list):
        values = data["files"]
    else:
        values = []
    return [canonical_path(v) for v in values if isinstance(v, str)]


def discover_book_names(root: Path) -> list[str]:
    bible_root = root / "bible" / "web"
    if not bible_root.exists():
        raise SystemExit(f"Could not find {bible_root}.")
    books = sorted(p.name for p in bible_root.iterdir() if p.is_dir())
    if len(books) != 66:
        raise SystemExit(f"Expected 66 Bible book folders under {bible_root}, found {len(books)}.")
    return books


def discover_candidates(root: Path) -> list[str]:
    """Mirror v166/v167 buildLists() instead of recursively sweeping bible/resources."""
    found: set[str] = set()
    books = discover_book_names(root)

    for book in books:
        found.add(f"bible/resources/internal-cross-references/{book}.json")
        found.add(f"bible/resources/book-overviews/{book}.json")
        found.add(f"bible/resources/commentaries/jfb/{book}.json")
        found.add(f"bible/resources/commentaries/matthew-henry/{book}.json")
        found.add(f"bible/resources/backgrounds/by-reference/{book}.json")

    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        found.add(f"bible/resources/eastons/{letter}.json")
        found.add(f"bible/resources/smiths/{letter}.json")

    topics_index = "bible/resources/topics/index.json"
    found.add(topics_index)
    found.update(indexed_files("bible/resources/topics", read_json(root / topics_index)))

    doctrine_registry = "bible/resources/doctrine/doctrine-registry.json"
    found.add(doctrine_registry)
    found.update(indexed_files("bible/resources/doctrine", read_json(root / doctrine_registry)))

    doctrine_indexes = [
        "index.json", "index-2a-additions.json", "index-2b-2c-3-additions.json",
        "index-4-5-6-additions.json", "index-7-8-additions.json",
        "index-9-10-additions.json", "index-11-12-additions.json",
    ]
    for name in doctrine_indexes:
        path = f"bible/resources/doctrine/{name}"
        data = read_json(root / path)
        if data is not None:
            found.add(path)
            found.update(indexed_files("bible/resources/doctrine", data))

    backgrounds_index = "bible/resources/backgrounds/index.json"
    found.add(backgrounds_index)
    found.update(indexed_files("bible/resources/backgrounds/topics", read_json(root / backgrounds_index)))

    for item in read_offline_manifest(root):
        if not item or item in LAUNCH_FILES:
            continue
        if is_bible_chapter(item):
            continue
        found.add(item)

    # v166 excludes launch shell and Bible chapters from the study-resource store.
    found.difference_update(LAUNCH_FILES)
    found = {p for p in found if p and not is_bible_chapter(p)}

    # Fail early if the curated runtime list points at a file that is absent.
    missing = sorted(p for p in found if not (root / p).is_file())
    if missing:
        preview = "\n".join(f"  - {p}" for p in missing[:25])
        more = "" if len(missing) <= 25 else f"\n  ... and {len(missing) - 25} more"
        raise SystemExit(
            f"The curated Offline Ready list references {len(missing)} missing files:\n{preview}{more}"
        )

    return sorted(found)

def group_paths(root: Path, paths: Iterable[str], target_bytes: int) -> list[list[str]]:
    packs: list[list[str]] = []
    current: list[str] = []
    current_bytes = 0

    for path in paths:
        size = (root / path).stat().st_size
        if current and current_bytes + size > target_bytes:
            packs.append(current)
            current = []
            current_bytes = 0
        current.append(path)
        current_bytes += size

    if current:
        packs.append(current)
    return packs


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Iron Sharpener v168 resource packs")
    parser.add_argument("--root", default=".", help="Iron Sharpener repository root")
    parser.add_argument("--target-kib", type=int, default=512, help="Approximate raw bytes per pack in KiB (default: 512)")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    target_bytes = max(128, args.target_kib) * 1024
    resources_root = root / "bible" / "resources"
    if not resources_root.exists():
        raise SystemExit(f"Could not find {resources_root}. Run this from the Iron Sharpener repository root.")

    candidates = discover_candidates(root)
    if not candidates:
        raise SystemExit("No study resource files were found.")

    out_dir = root / "offline-packs"
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    build_hasher = hashlib.sha256()
    for path in candidates:
        raw = (root / path).read_bytes()
        build_hasher.update(path.encode("utf-8"))
        build_hasher.update(b"\0")
        build_hasher.update(hashlib.sha256(raw).digest())
    build_id = build_hasher.hexdigest()[:20]

    groups = group_paths(root, candidates, target_bytes)
    manifest_packs = []
    total_raw = 0
    total_plain = 0
    total_gzip = 0

    for index, group in enumerate(groups, start=1):
        entries = []
        pack_raw = 0
        for path in group:
            raw = (root / path).read_bytes()
            pack_raw += len(raw)
            entries.append({
                "path": path,
                "contentType": content_type(path),
                "bodyB64": base64.b64encode(raw).decode("ascii"),
            })

        payload = {
            "format": PACK_FORMAT,
            "buildId": build_id,
            "id": index,
            "entries": entries,
        }
        plain_bytes = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        gzip_bytes = gzip.compress(plain_bytes, compresslevel=9, mtime=0)

        file_name = f"pack-{index:04d}.json"
        gzip_name = f"{file_name}.gz"
        (out_dir / file_name).write_bytes(plain_bytes)
        (out_dir / gzip_name).write_bytes(gzip_bytes)

        manifest_packs.append({
            "id": index,
            "file": f"offline-packs/{file_name}",
            "gzipFile": f"offline-packs/{gzip_name}",
            "count": len(group),
            "entries": group,
            "rawResourceBytes": pack_raw,
            "plainPackBytes": len(plain_bytes),
            "gzipPackBytes": len(gzip_bytes),
        })
        total_raw += pack_raw
        total_plain += len(plain_bytes)
        total_gzip += len(gzip_bytes)

    manifest = {
        "format": PACK_FORMAT,
        "version": "v168",
        "buildId": build_id,
        "targetRawBytesPerPack": target_bytes,
        "resourceCount": len(candidates),
        "packCount": len(manifest_packs),
        "rawResourceBytes": total_raw,
        "plainPackBytes": total_plain,
        "gzipPackBytes": total_gzip,
        "packs": manifest_packs,
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"v168 resource packs built: {len(candidates):,} files in {len(groups):,} packs")
    print(f"Build ID: {build_id}")
    print(f"Raw resource bytes: {total_raw / 1024 / 1024:.2f} MiB")
    print(f"Plain pack bytes:   {total_plain / 1024 / 1024:.2f} MiB")
    print(f"Gzip pack bytes:    {total_gzip / 1024 / 1024:.2f} MiB")
    print(f"Output: {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
