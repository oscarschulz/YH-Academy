from pathlib import Path
from datetime import datetime
import shutil
import sys

ROOT = Path.cwd()
DASHBOARD_JS = ROOT / 'public' / 'js' / 'dashboard.js'
DASHBOARD_HTML = ROOT / 'public' / 'dashboard.html'
STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')

OLD_BLOCK_LF = """    const shouldHoldLoaderUntilTargetReady =
        activeWorkspaceKey === 'academy-roadmap' ||
        activeWorkspaceKey === 'federation-command' ||
        activeWorkspaceKey.startsWith('plazas-');

    const shouldBlockTimedRelease =
        isBalancedTimeout ||
        (
            activeWorkspaceKey.startsWith('plazas-') &&
            reason === 'hard-timeout'
        );

    if (
        shouldHoldLoaderUntilTargetReady &&
        revealState !== 'ready' &&
        shouldBlockTimedRelease
    ) {
        return;
    }
"""

NEW_BLOCK_LF = """    /* PATCH: Keep managed child loader until iframe reveal-ready v1 */
    const isManagedDivisionChildWorkspace =
        activeWorkspaceKey.startsWith('academy-') ||
        activeWorkspaceKey.startsWith('plazas-') ||
        activeWorkspaceKey.startsWith('federation-');

    const shouldHoldLoaderUntilTargetReady =
        isManagedDivisionChildWorkspace;

    const shouldBlockTimedRelease =
        isBalancedTimeout ||
        (
            activeWorkspaceKey.startsWith('plazas-') &&
            reason === 'hard-timeout'
        );

    /*
     * The balanced timeout is only a minimum display budget. It must not
     * uncover the empty frame shell while the selected child document is
     * still hidden and waiting for its stable reveal handshake.
     */
    if (
        shouldHoldLoaderUntilTargetReady &&
        revealState !== 'ready' &&
        shouldBlockTimedRelease
    ) {
        return;
    }
    /* END PATCH: Keep managed child loader until iframe reveal-ready v1 */
"""

OLD_SCRIPT = '/js/dashboard.js?v=20260721-phase3c5a-lifecycle-v1'
NEW_SCRIPT = '/js/dashboard.js?v=20260721-child-loader-ready-gate-v1'


def read_preserving_newline(path: Path):
    raw = path.read_bytes()
    text = raw.decode('utf-8-sig')
    newline = '\r\n' if b'\r\n' in raw else '\n'
    has_bom = raw.startswith(b'\xef\xbb\xbf')
    return text, newline, has_bom


def write_preserving(path: Path, text: str, has_bom: bool):
    payload = text.encode('utf-8')
    if has_bom:
        payload = b'\xef\xbb\xbf' + payload
    path.write_bytes(payload)


def backup(path: Path):
    backup_path = path.with_name(path.name + f'.backup-child-loader-ready-gate-v1-{STAMP}')
    shutil.copy2(path, backup_path)
    return backup_path


def require_file(path: Path):
    if not path.is_file():
        raise FileNotFoundError(f'Missing required file: {path}')


def patch_dashboard_js():
    text, newline, has_bom = read_preserving_newline(DASHBOARD_JS)
    old_block = OLD_BLOCK_LF.replace('\n', newline)
    new_block = NEW_BLOCK_LF.replace('\n', newline)

    if 'PATCH: Keep managed child loader until iframe reveal-ready v1' in text:
        return None, False

    count = text.count(old_block)
    if count != 1:
        raise RuntimeError(
            f'Expected exactly one loader release block in {DASHBOARD_JS}; found {count}.'
        )

    backup_path = backup(DASHBOARD_JS)
    text = text.replace(old_block, new_block, 1)
    write_preserving(DASHBOARD_JS, text, has_bom)
    return backup_path, True


def patch_dashboard_html():
    text, _newline, has_bom = read_preserving_newline(DASHBOARD_HTML)

    if NEW_SCRIPT in text:
        return None, False

    count = text.count(OLD_SCRIPT)
    if count != 1:
        raise RuntimeError(
            f'Expected exactly one current dashboard.js cache URL in {DASHBOARD_HTML}; found {count}.'
        )

    backup_path = backup(DASHBOARD_HTML)
    text = text.replace(OLD_SCRIPT, NEW_SCRIPT, 1)
    write_preserving(DASHBOARD_HTML, text, has_bom)
    return backup_path, True


def main():
    require_file(DASHBOARD_JS)
    require_file(DASHBOARD_HTML)

    backups = []
    updated = []

    js_backup, js_changed = patch_dashboard_js()
    if js_changed:
        backups.append(js_backup)
        updated.append(DASHBOARD_JS)

    html_backup, html_changed = patch_dashboard_html()
    if html_changed:
        backups.append(html_backup)
        updated.append(DASHBOARD_HTML)

    if not updated:
        print('Dashboard child loader ready gate is already applied.')
        return

    print('Dashboard child loader ready gate patched successfully.')
    for path in updated:
        print(f'Updated: {path.relative_to(ROOT)}')
    for path in backups:
        print(f'Backup: {path.relative_to(ROOT)}')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Patch failed: {error}', file=sys.stderr)
        sys.exit(1)
