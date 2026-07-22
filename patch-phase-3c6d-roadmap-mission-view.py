#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path.cwd()
ACADEMY_JS = ROOT / "public" / "js" / "academy.js"
ACADEMY_HTML = ROOT / "public" / "academy.html"

STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUPS: list[tuple[Path, Path]] = []


def fail(message: str) -> None:
    print(f"\nERROR: {message}", file=sys.stderr)
    rollback()
    raise SystemExit(1)


def backup(path: Path) -> None:
    backup_path = path.with_name(f"{path.name}.backup-phase-3c6d-{STAMP}")
    shutil.copy2(path, backup_path)
    BACKUPS.append((path, backup_path))
    print(f"Backup: {backup_path}")


def rollback() -> None:
    if not BACKUPS:
        return
    print("\nRestoring backups...")
    for original, backup_path in reversed(BACKUPS):
        if backup_path.exists():
            shutil.copy2(backup_path, original)
            print(f"Restored: {original}")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected exactly 1 match, found {count}.")
    return text.replace(old, new, 1)


for required in (ACADEMY_JS, ACADEMY_HTML):
    if not required.exists():
        fail(f"Missing required file: {required}")

backup(ACADEMY_JS)
backup(ACADEMY_HTML)

js = ACADEMY_JS.read_text(encoding="utf-8")
html = ACADEMY_HTML.read_text(encoding="utf-8")

old_mission_source = """    const missions = Array.isArray(homeData?.missions) ? homeData.missions : [];
"""
new_mission_source = """    const missions =
        Array.isArray(homeData?.missions) && homeData.missions.length
            ? homeData.missions
            : Array.isArray(homeData?.todayMissions) && homeData.todayMissions.length
                ? homeData.todayMissions
                : Array.isArray(homeData?.roadmapSteps) && homeData.roadmapSteps.length
                    ? homeData.roadmapSteps.slice(0, 5)
                    : Array.isArray(homeData?.allMissions)
                        ? homeData.allMissions.slice(0, 5)
                        : [];
"""
js = replace_once(
    js,
    old_mission_source,
    new_mission_source,
    "Roadmap mission source normalization"
)

old_saved_tab_function = """function academyGetSavedRoadmapInnerTab() {
    try {
        const saved = sessionStorage.getItem('yh_academy_roadmap_inner_tab_v1') || '';
        if (['overview', 'today', 'sprint', 'progress', 'coach'].includes(saved)) return saved;
    } catch (_) {}

    return 'overview';
}
"""
new_saved_tab_function = """function academyGetSavedRoadmapInnerTab(defaultTab = 'overview') {
    const cleanDefault = ['overview', 'today', 'sprint', 'progress', 'coach'].includes(
        String(defaultTab || '').trim().toLowerCase()
    )
        ? String(defaultTab || '').trim().toLowerCase()
        : 'overview';

    try {
        const saved = sessionStorage.getItem('yh_academy_roadmap_inner_tab_v2') || '';
        if (['overview', 'today', 'sprint', 'progress', 'coach'].includes(saved)) return saved;
    } catch (_) {}

    return cleanDefault;
}
"""
js = replace_once(
    js,
    old_saved_tab_function,
    new_saved_tab_function,
    "Roadmap saved-tab default"
)

old_set_key = """        sessionStorage.setItem('yh_academy_roadmap_inner_tab_v1', cleanTab);
"""
new_set_key = """        sessionStorage.setItem('yh_academy_roadmap_inner_tab_v2', cleanTab);
"""
js = replace_once(
    js,
    old_set_key,
    new_set_key,
    "Roadmap saved-tab storage key"
)

old_initial_tab = """    academySetRoadmapInnerTab(academyGetSavedRoadmapInnerTab());
}
"""
new_initial_tab = """    const todaySlotHasMissionCards = Boolean(
        chatWelcomeBox.querySelector(
            '[data-roadmap-slot="today"] .academy-home-missions > div, ' +
            '[data-roadmap-slot="today"] [data-academy-action]'
        )
    );

    academySetRoadmapInnerTab(
        academyGetSavedRoadmapInnerTab(
            todaySlotHasMissionCards ? 'today' : 'overview'
        )
    );
}
"""
js = replace_once(
    js,
    old_initial_tab,
    new_initial_tab,
    "Roadmap initial inner tab"
)

old_start_today = """    document.getElementById('academy-home-open-checkin')?.addEventListener('click', () => {
        academyOpenCheckin();
    });
"""
new_start_today = """    document.getElementById('academy-home-open-checkin')?.addEventListener('click', () => {
        academySetRoadmapInnerTab('today');

        window.requestAnimationFrame(() => {
            const todayPanel = document.querySelector(
                '[data-academy-roadmap-inner-panel="today"]'
            );

            if (todayPanel) {
                todayPanel.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
"""
js = replace_once(
    js,
    old_start_today,
    new_start_today,
    "Start Today's Work action"
)

old_cache = '<script src="/js/academy.js?v=20260722-phase3c6c-embed-bridge-v1"></script>'
new_cache = '<script src="/js/academy.js?v=20260722-phase3c6d-roadmap-mission-view-v1"></script>'
html = replace_once(
    html,
    old_cache,
    new_cache,
    "Academy JavaScript cache key"
)

ACADEMY_JS.write_text(js, encoding="utf-8", newline="")
ACADEMY_HTML.write_text(html, encoding="utf-8", newline="")

syntax = subprocess.run(
    ["node", "--check", str(ACADEMY_JS)],
    cwd=ROOT,
    capture_output=True,
    text=True
)

if syntax.returncode != 0:
    print(syntax.stdout)
    print(syntax.stderr, file=sys.stderr)
    fail("academy.js syntax check failed.")

print("\nPhase 3C.6D Roadmap mission view repair patched successfully.")
print("Updated: public/js/academy.js")
print("Updated: public/academy.html")
print("Syntax checks: passed")
print("\nNo backend, Dashboard, CSS, routes, Squad, or progression files were changed.")
