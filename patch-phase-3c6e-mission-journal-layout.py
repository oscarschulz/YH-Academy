#!/usr/bin/env python3
from __future__ import annotations

import shutil
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path.cwd()
STYLE_CSS = ROOT / "public" / "css" / "style.css"
ACADEMY_HTML = ROOT / "public" / "academy.html"

STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUPS: list[tuple[Path, Path]] = []


def rollback() -> None:
    if not BACKUPS:
        return

    print("\nRestoring backups...")

    for original, backup in reversed(BACKUPS):
        if backup.exists():
            shutil.copy2(backup, original)
            print(f"Restored: {original}")


def fail(message: str) -> None:
    print(f"\nERROR: {message}", file=sys.stderr)
    rollback()
    raise SystemExit(1)


def backup(path: Path) -> None:
    backup_path = path.with_name(
        f"{path.name}.backup-phase-3c6e-layout-{STAMP}"
    )
    shutil.copy2(path, backup_path)
    BACKUPS.append((path, backup_path))
    print(f"Backup: {backup_path}")


def read_normalized(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    newline = "\r\n" if b"\r\n" in raw else "\n"

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as error:
        fail(f"Unable to decode {path}: {error}")

    return text.replace("\r\n", "\n"), newline


def write_preserving_newlines(
    path: Path,
    text: str,
    newline: str
) -> None:
    rendered = text if newline == "\n" else text.replace("\n", "\r\n")
    path.write_bytes(rendered.encode("utf-8"))


def replace_once(
    text: str,
    old: str,
    new: str,
    label: str
) -> str:
    count = text.count(old)

    if count != 1:
        fail(
            f"{label}: expected exactly 1 match, found {count}. "
            "Use the latest post-3C.6E files."
        )

    return text.replace(old, new, 1)


for required in (STYLE_CSS, ACADEMY_HTML):
    if not required.exists():
        fail(f"Missing required file: {required}")

backup(STYLE_CSS)
backup(ACADEMY_HTML)

css, css_newline = read_normalized(STYLE_CSS)
html, html_newline = read_normalized(ACADEMY_HTML)

css = replace_once(
    css,
    """.academy-mission-journal-card {
    width: min(960px, calc(100vw - 28px));
    max-height: min(90dvh, 920px);
    display: grid;
""",
    """.academy-mission-journal-card {
    width: min(960px, calc(100% - 28px));
    max-width: 960px;
    min-width: 0;
    height: min(90dvh, 920px);
    max-height: min(90dvh, 920px);
    display: grid;
""",
    "Mission Journal card dimensions"
)

css = replace_once(
    css,
    """.academy-mission-journal-header {
    align-items: flex-start;
    gap: 18px;
    padding: 20px 22px;
    border-bottom: 1px solid rgba(103, 232, 249, 0.16);
}

.academy-mission-journal-header h3 {
""",
    """.academy-mission-journal-header {
    align-items: flex-start;
    gap: 18px;
    padding: 20px 22px;
    border-bottom: 1px solid rgba(103, 232, 249, 0.16);
}

.academy-mission-journal-header > div {
    min-width: 0;
}

.academy-mission-journal-header h3 {
""",
    "Mission Journal header sizing"
)

css = replace_once(
    css,
    """    font-size: clamp(1.35rem, 2.2vw, 1.9rem);
    line-height: 1.05;
}

.academy-mission-journal-kicker {
""",
    """    font-size: clamp(1.35rem, 2.2vw, 1.9rem);
    line-height: 1.05;
    overflow-wrap: anywhere;
}

.academy-mission-journal-kicker {
""",
    "Mission Journal title wrapping"
)

css = replace_once(
    css,
    """.academy-mission-journal-body {
    min-height: 0;
    overflow-y: auto;
    display: grid;
    gap: 14px;
    padding: 18px 22px 22px;
}
""",
    """.academy-mission-journal-body {
    min-width: 0;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    display: grid;
    gap: 14px;
    padding: 18px 22px 22px;
}
""",
    "Mission Journal body scrolling"
)

css = replace_once(
    css,
    """.academy-mission-journal-footer {
    display: grid;
    grid-template-columns:
        minmax(110px, 0.55fr)
        minmax(140px, 0.8fr)
        minmax(190px, 1.3fr);
    gap: 10px;
""",
    """.academy-mission-journal-footer {
    min-width: 0;
    display: grid;
    grid-template-columns:
        minmax(0, 0.55fr)
        minmax(0, 0.8fr)
        minmax(0, 1.3fr);
    gap: 10px;
""",
    "Mission Journal footer columns"
)

css = replace_once(
    css,
    """.academy-mission-journal-footer .btn-primary,
.academy-mission-journal-footer .btn-secondary {
    width: 100%;
    min-height: 46px;
    border-radius: 0;
}
""",
    """.academy-mission-journal-footer .btn-primary,
.academy-mission-journal-footer .btn-secondary {
    width: 100%;
    min-width: 0;
    min-height: 46px;
    padding-left: 14px;
    padding-right: 14px;
    border-radius: 0;
    white-space: normal;
    line-height: 1.15;
}
""",
    "Mission Journal footer buttons"
)

css = replace_once(
    css,
    """@media (max-width: 720px) {
    .academy-mission-journal-card {
        width: calc(100vw - 18px);
        max-height: 92dvh;
    }
""",
    """@media (max-width: 720px) {
    .academy-mission-journal-card {
        width: calc(100% - 18px);
        height: 92dvh;
        max-height: 92dvh;
    }
""",
    "Mission Journal mobile dimensions"
)

html = replace_once(
    html,
    '<link rel="stylesheet" href="/css/style.css?v=20260722-phase3c6e-mission-journal-v1">',
    '<link rel="stylesheet" href="/css/style.css?v=20260722-phase3c6e-mission-journal-layout-v2">',
    "Academy stylesheet cache key"
)

write_preserving_newlines(STYLE_CSS, css, css_newline)
write_preserving_newlines(ACADEMY_HTML, html, html_newline)

# Static integrity checks for the exact repaired layout.
saved_css, _ = read_normalized(STYLE_CSS)
saved_html, _ = read_normalized(ACADEMY_HTML)

required_css_fragments = [
    "max-width: 960px;",
    "height: min(90dvh, 920px);",
    "grid-template-columns:\n        minmax(0, 0.55fr)",
    "overflow-x: hidden;",
    "scrollbar-gutter: stable;",
    "white-space: normal;"
]

for fragment in required_css_fragments:
    if fragment not in saved_css:
        fail(f"CSS integrity check failed: missing {fragment!r}")

if (
    "/css/style.css?v=20260722-phase3c6e-mission-journal-layout-v2"
    not in saved_html
):
    fail("Academy HTML cache-key integrity check failed.")

print(
    "\nPhase 3C.6E Mission Journal layout repair "
    "patched successfully."
)
print("Updated: public/css/style.css")
print("Updated: public/academy.html")
print("Static integrity checks: passed")
print(
    "\nNo JavaScript, backend, routes, Roadmap logic, "
    "AI verification, XP, Squad, Dashboard, Plazas, "
    "or Federation files were changed."
)
