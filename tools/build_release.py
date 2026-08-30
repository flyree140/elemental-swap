#!/usr/bin/env python3
"""Build a GitHub-ready ZIP and a true standalone HTML for Elemental Swap V5.

The standalone version embeds:
- styles.css
- config.js / network.js / game.js
- every local PNG under assets/

PeerJS remains an optional CDN script so 2P can work online. The single-player game
continues to run even if that CDN is unavailable.
"""
from __future__ import annotations

import base64
import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT.parent
STANDALONE_NAME = "Elemental_Swap_V5_Standalone.html"
ZIP_NAME = "Elemental_Swap_V5_GitHub_Ready.zip"


def data_uri(path: Path) -> str:
    mime = "image/png" if path.suffix.lower() == ".png" else "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def build_standalone() -> Path:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    scripts = {
        src: (ROOT / src).read_text(encoding="utf-8")
        for src in ("js/config.js", "js/network.js", "js/game.js", "js/v5_enhancements.js")
    }

    embedded: dict[str, str] = {}
    for path in sorted((ROOT / "assets").rglob("*")):
        if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            embedded[path.relative_to(ROOT).as_posix()] = data_uri(path)

    html = re.sub(
        r'\s*<link\s+rel="stylesheet"\s+href="styles\.css"\s*/?>',
        "\n<style>\n" + css + "\n</style>",
        html,
        count=1,
    )

    for src in scripts:
        html = re.sub(
            r'\s*<script\s+src="' + re.escape(src) + r'"\s*></script>',
            "",
            html,
            count=1,
        )

    payload = (
        "\n<script>\n"
        "// Embedded local asset table. game.js checks this before requesting a file path.\n"
        "window.ES4_EMBEDDED_ASSETS = "
        + json.dumps(embedded, ensure_ascii=False, separators=(",", ":"))
        + ";\n</script>\n"
        + "\n".join(f"<script>\n{scripts[src]}\n</script>" for src in scripts)
        + "\n"
    )
    html = html.replace("</body>", payload + "</body>")

    # Explain why the CDN is optional. Do not remove it: online 2P needs PeerJS.
    html = html.replace(
        '<script src="https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js"></script>',
        '<!-- Optional: only the 2P room buttons need this CDN; single-player works without it. -->\n'
        '<script src="https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js"></script>',
    )

    out = OUT_ROOT / STANDALONE_NAME
    out.write_text(html, encoding="utf-8")
    (ROOT / STANDALONE_NAME).write_text(html, encoding="utf-8")
    (ROOT / "START_HERE_LOCAL.html").write_text(html, encoding="utf-8")
    return out


def make_manifest(standalone: Path) -> Path:
    files = [p for p in sorted(ROOT.rglob("*")) if p.is_file() and "__pycache__" not in p.parts]
    lines = [
        "Elemental Swap V5 release manifest",
        "==================================",
        "",
        "GitHub entry: index.html (requires its sibling folders/files)",
        f"Local single-file entry: {STANDALONE_NAME}",
        "",
    ]
    for path in files:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        lines.append(f"{digest}  {path.relative_to(ROOT).as_posix()}")
    digest = hashlib.sha256(standalone.read_bytes()).hexdigest()
    lines.append(f"{digest}  ../{standalone.name}")
    out = ROOT / "RELEASE_MANIFEST.txt"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out


def make_zip() -> Path:
    out = OUT_ROOT / ZIP_NAME
    if out.exists():
        out.unlink()
    ignored = {"__pycache__", ".DS_Store"}
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in sorted(ROOT.rglob("*")):
            if not path.is_file() or any(part in ignored for part in path.parts):
                continue
            # ZIP root directly contains index.html. This is easiest for GitHub Pages.
            zf.write(path, path.relative_to(ROOT).as_posix())
    return out


def main() -> None:
    standalone = build_standalone()
    make_manifest(standalone)
    archive = make_zip()
    print(f"Standalone: {standalone} ({standalone.stat().st_size:,} bytes)")
    print(f"ZIP:        {archive} ({archive.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
