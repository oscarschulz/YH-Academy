from __future__ import annotations

from pathlib import Path
from datetime import datetime
import shutil
import subprocess
import sys

PHASE = "phase-3c6c"
ROOT = Path.cwd()
ACADEMY_JS = ROOT / "public" / "js" / "academy.js"
ACADEMY_HTML = ROOT / "public" / "academy.html"

OLD_BRIDGE = r'''/* PATCH: Academy Dashboard iframe function bridge v25 */
window.showAcademyRoadmapLoadingShell = (...args) =>
    showAcademyRoadmapLoadingShell(...args);

window.openAcademyRoadmapView = (...args) =>
    openAcademyRoadmapView(...args);

window.readAcademyHomeCache = (...args) =>
    readAcademyHomeCache(...args);

window.renderAcademyHome = (...args) =>
    renderAcademyHome(...args);

window.loadAcademyHome = (...args) =>
    loadAcademyHome(...args);
/* END PATCH: Academy Dashboard iframe function bridge v25 */'''

NEW_BRIDGE = r'''/* PATCH: Academy Dashboard iframe function bridge v26 */
const academyDashboardIframeBridgeV26 = {
    showRoadmapLoadingShell: (...args) =>
        showAcademyRoadmapLoadingShell(...args),

    openRoadmap: (...args) =>
        openAcademyRoadmapView(...args),

    readHomeCache: (...args) =>
        readAcademyHomeCache(...args),

    renderHome: (...args) =>
        renderAcademyHome(...args),

    loadHome: (...args) =>
        loadAcademyHome(...args),

    openCommunity: (forceReload = false) =>
        openAcademyFeedView(forceReload),

    openMessages: (...args) =>
        openAcademyMessagesView(...args),

    openVoice: () => {
        setAcademySidebarActive('nav-voice');

        return openRoom(
            'voice-lobby',
            document.getElementById('nav-voice')
        );
    },

    openMissions: () => {
        academyRememberLastNonProfileLocation(
            'lead-missions',
            {
                missionPanel: 'hub'
            }
        );

        saveAcademyViewState('missions');
        revealAcademyMissionsViewShell();
        setAcademyMissionsPanel('hub');

        return true;
    }
};

window.YHAcademyDashboardIframeBridge =
    academyDashboardIframeBridgeV26;

/* Preserve the existing public hooks used by dashboard.js. */
window.showAcademyRoadmapLoadingShell = (...args) =>
    academyDashboardIframeBridgeV26.showRoadmapLoadingShell(...args);

window.openAcademyRoadmapView = (...args) =>
    academyDashboardIframeBridgeV26.openRoadmap(...args);

window.readAcademyHomeCache = (...args) =>
    academyDashboardIframeBridgeV26.readHomeCache(...args);

window.renderAcademyHome = (...args) =>
    academyDashboardIframeBridgeV26.renderHome(...args);

window.loadAcademyHome = (...args) =>
    academyDashboardIframeBridgeV26.loadHome(...args);

window.openAcademyFeedView = (...args) =>
    academyDashboardIframeBridgeV26.openCommunity(...args);

window.openAcademyMessagesView = (...args) =>
    academyDashboardIframeBridgeV26.openMessages(...args);

window.openAcademyMissionsView = (...args) =>
    openAcademyMissionsView(...args);

window.revealAcademyMissionsViewShell = (...args) =>
    revealAcademyMissionsViewShell(...args);

window.setAcademyMissionsPanel = (...args) =>
    setAcademyMissionsPanel(...args);
/* END PATCH: Academy Dashboard iframe function bridge v26 */'''

OLD_OPEN_SECTION = r'''    function openEmbeddedSection(target = 'roadmap') {
        const clean = String(target || 'roadmap').trim().toLowerCase();

        try {
            if (clean === 'community') {
                openAcademyFeedView(false);
                return true;
            }

            if (clean === 'messages') {
                window.__academyTabSwitchLockedV7 = false;
                openAcademyMessagesView();
                return true;
            }

            if (clean === 'voice') {
                setAcademySidebarActive('nav-voice');

                openRoom(
                    'voice-lobby',
                    document.getElementById('nav-voice')
                );

                return true;
            }

            if (clean === 'missions') {
                academyRememberLastNonProfileLocation(
                    'lead-missions',
                    {
                        missionPanel: 'hub'
                    }
                );

                saveAcademyViewState('missions');
                revealAcademyMissionsViewShell();
                setAcademyMissionsPanel('hub');

                return true;
            }

            showAcademyRoadmapLoadingShell();
            openAcademyRoadmapView(false);

            return true;
        } catch (error) {
            console.error(
                'Academy dashboard embed section open failed:',
                error
            );

            return false;
        }
    }'''

NEW_OPEN_SECTION = r'''    function openEmbeddedSection(target = 'roadmap') {
        const clean = String(target || 'roadmap').trim().toLowerCase();

        try {
            const bridge = window.YHAcademyDashboardIframeBridge;

            if (!bridge || typeof bridge !== 'object') {
                throw new Error(
                    'Academy Dashboard iframe bridge is unavailable.'
                );
            }

            if (clean === 'community') {
                bridge.openCommunity(false);
                return true;
            }

            if (clean === 'messages') {
                window.__academyTabSwitchLockedV7 = false;
                bridge.openMessages();
                return true;
            }

            if (clean === 'voice') {
                bridge.openVoice();
                return true;
            }

            if (clean === 'missions') {
                bridge.openMissions();
                return true;
            }

            bridge.showRoadmapLoadingShell();
            bridge.openRoadmap(false);

            return true;
        } catch (error) {
            console.error(
                'Academy dashboard embed section open failed:',
                error
            );

            return false;
        }
    }'''

OLD_CACHE = "/js/academy.js?v=20260722-phase3c6b-roadmap-migration-v1"
NEW_CACHE = "/js/academy.js?v=20260722-phase3c6c-embed-bridge-v1"


def read_text_preserve(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    newline = "\r\n" if b"\r\n" in raw else "\n"
    text = raw.decode("utf-8")
    return text.replace("\r\n", "\n"), newline


def write_text_preserve(path: Path, text: str, newline: str) -> None:
    normalized = text.replace("\r\n", "\n")
    path.write_bytes(normalized.replace("\n", newline).encode("utf-8"))


def require_file(path: Path) -> None:
    if not path.is_file():
        raise FileNotFoundError(
            f"Required file not found: {path}\n"
            "Run this script from the YH Academy project root."
        )


def replace_exact(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    if new in text:
        return text, False

    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"Expected exactly one current {label} block, found {count}. "
            "No files were changed."
        )

    return text.replace(old, new, 1), True


def main() -> int:
    require_file(ACADEMY_JS)
    require_file(ACADEMY_HTML)

    js_text, js_newline = read_text_preserve(ACADEMY_JS)
    html_text, html_newline = read_text_preserve(ACADEMY_HTML)

    next_js, changed_bridge = replace_exact(
        js_text,
        OLD_BRIDGE,
        NEW_BRIDGE,
        "Academy iframe bridge"
    )

    next_js, changed_owner = replace_exact(
        next_js,
        OLD_OPEN_SECTION,
        NEW_OPEN_SECTION,
        "Academy deterministic section owner"
    )

    changed_html = False
    if NEW_CACHE not in html_text:
        cache_count = html_text.count(OLD_CACHE)
        if cache_count != 1:
            raise RuntimeError(
                f"Expected exactly one Academy JS cache reference, found {cache_count}. "
                "No files were changed."
            )
        next_html = html_text.replace(OLD_CACHE, NEW_CACHE, 1)
        changed_html = True
    else:
        next_html = html_text

    if not (changed_bridge or changed_owner or changed_html):
        print("Phase 3C.6C is already applied. No changes needed.")
        return 0

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backups: list[tuple[Path, Path]] = []

    try:
        for path in (ACADEMY_JS, ACADEMY_HTML):
            backup = path.with_name(
                f"{path.name}.backup-{PHASE}-{stamp}"
            )
            shutil.copy2(path, backup)
            backups.append((path, backup))
            print(f"Backup: {backup.relative_to(ROOT)}")

        write_text_preserve(ACADEMY_JS, next_js, js_newline)
        write_text_preserve(ACADEMY_HTML, next_html, html_newline)

        result = subprocess.run(
            ["node", "--check", str(ACADEMY_JS)],
            cwd=ROOT,
            text=True,
            capture_output=True
        )

        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip()
            raise RuntimeError(
                "JavaScript syntax check failed.\n" + detail
            )

    except Exception:
        for original, backup in backups:
            if backup.exists():
                shutil.copy2(backup, original)
        print("Patch failed. Original files restored.", file=sys.stderr)
        raise

    print("\nPhase 3C.6C Academy embed bridge repair patched successfully.")
    print("Updated: public/js/academy.js")
    print("Updated: public/academy.html")
    print("Syntax checks: passed")
    print("\nNo changes were made to dashboard.js, dashboard.html, backend, CSS, or routes.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
