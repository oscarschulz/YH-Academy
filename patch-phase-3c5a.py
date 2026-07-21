from pathlib import Path
from datetime import datetime
import shutil
import sys

ROOT = Path.cwd()
STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')

FILES = {
    'dashboard_js': ROOT / 'public/js/dashboard.js',
    'academy_js': ROOT / 'public/js/academy.js',
    'game_dashboard_js': ROOT / 'public/js/yhu-game-dashboard.js',
    'shared_runtime_js': ROOT / 'public/js/yh-shared-runtime.js',
    'dashboard_html': ROOT / 'public/dashboard.html',
    'academy_html': ROOT / 'public/academy.html',
}


def fail(message: str) -> None:
    print(f'ERROR: {message}', file=sys.stderr)
    raise SystemExit(1)


def backup(path: Path) -> None:
    target = path.with_name(f'{path.name}.bak-{STAMP}-phase3c5a')
    shutil.copy2(path, target)


def read_preserving_newlines(path: Path):
    raw = path.read_bytes()
    newline = '\r\n' if b'\r\n' in raw else '\n'
    text = raw.decode('utf-8').replace('\r\n', '\n')
    return text, newline


def write_preserving_newlines(path: Path, text: str, newline: str) -> None:
    normalized = text.replace('\r\n', '\n')
    if newline == '\r\n':
        normalized = normalized.replace('\n', '\r\n')
    path.write_bytes(normalized.encode('utf-8'))


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f'{label}: expected exactly 1 match, found {count}.')
    return text.replace(old, new, 1)


for label, path in FILES.items():
    if not path.exists():
        fail(f'Missing required file for {label}: {path}')

# -----------------------------------------------------------------------------
# 1) Shared tab-loader lifecycle hardening
# -----------------------------------------------------------------------------
path = FILES['shared_runtime_js']
text, newline = read_preserving_newlines(path)

old = """        const token = Number(options?.token || 0);\n        const hasToken = Number.isFinite(token) && token > 0;\n        const overlayCycle = Number(overlay.dataset.loaderCycle || 0);\n\n        if (hasToken && overlayCycle && overlayCycle !== token && force !== true) {\n            return;\n        }\n"""
new = """        const token = Number(options?.token || 0);\n        const hasToken = Number.isFinite(token) && token > 0;\n        const overlayCycle = Number(overlay.dataset.loaderCycle || 0);\n\n        /*\n         * A delayed force-hide from an older navigation cycle must\n         * never hide a newer loader. Token ownership stays strict\n         * even when the caller requested a forced release.\n         */\n        if (hasToken && overlayCycle && overlayCycle !== token) {\n            return;\n        }\n\n        if (force) {\n            window.clearTimeout(\n                window.__yhBalancedDashboardTabLoaderHideDelayV2\n            );\n\n            window.__yhBalancedDashboardTabLoaderHideDelayV2 =\n                null;\n        }\n"""
text = replace_once(text, old, new, 'shared runtime strict loader token')

old = """    function forceHideAcademyTabLoader(options = {}) {\n        yhTabLoaderDepth = 0;\n        hideAcademyTabLoader({ ...(options || {}), force: true });\n    }\n\n    const YH_DASHBOARD_STATE_DIVISIONS = new Set([\n"""
new = """    function forceHideAcademyTabLoader(options = {}) {\n        yhTabLoaderDepth = 0;\n        hideAcademyTabLoader({ ...(options || {}), force: true });\n    }\n\n    /* PATCH: Shared tab-loader page lifecycle cleanup v4 */\n    if (!window.__yhSharedTabLoaderLifecycleV4Bound) {\n        window.__yhSharedTabLoaderLifecycleV4Bound = true;\n\n        window.addEventListener('pagehide', () => {\n            window.clearTimeout(yhTabLoaderHideTimer);\n            window.clearTimeout(yhTabLoaderForceHideTimer);\n            window.clearTimeout(yhTabLoaderNestedHideTimer);\n            window.clearTimeout(\n                window.__yhBalancedDashboardTabLoaderHideDelayV2\n            );\n\n            yhTabLoaderHideTimer = null;\n            yhTabLoaderForceHideTimer = null;\n            yhTabLoaderNestedHideTimer = null;\n            yhTabLoaderDepth = 0;\n\n            const overlay =\n                document.getElementById('yh-tab-loader');\n\n            if (overlay) {\n                overlay.classList.remove('is-active');\n                overlay.classList.add('hidden-step');\n                overlay.setAttribute('aria-hidden', 'true');\n                overlay.style.pointerEvents = 'none';\n            }\n        });\n    }\n    /* END PATCH: Shared tab-loader page lifecycle cleanup v4 */\n\n    const YH_DASHBOARD_STATE_DIVISIONS = new Set([\n"""
text = replace_once(text, old, new, 'shared runtime pagehide cleanup')

backup(path)
write_preserving_newlines(path, text, newline)

# -----------------------------------------------------------------------------
# 2) Dashboard iframe readiness and duplicate-navigation cleanup
# -----------------------------------------------------------------------------
path = FILES['dashboard_js']
text, newline = read_preserving_newlines(path)

old = """    const navigationToken = String(\n        options.navigationToken ||\n        frame.dataset.yhDashboardNavigationToken ||\n        ''\n    ).trim();\n\n    const requestedTimeoutMs = Number(options.timeoutMs || 4200);\n"""
new = """    const navigationToken = String(\n        options.navigationToken ||\n        frame.dataset.yhDashboardNavigationToken ||\n        ''\n    ).trim();\n\n    const alreadyReady = Boolean(\n        frame.dataset.yhDashboardNavigationState === 'ready' &&\n        frame.dataset.yhDashboardChildWorkspaceReady === 'true' &&\n        frame.dataset.yhDashboardRevealState === 'ready' &&\n        isDashboardInlineFrameNavigationCurrent(\n            frame,\n            navigationToken,\n            workspaceKey,\n            { verifyLoadedUrl: true }\n        )\n    );\n\n    if (alreadyReady) {\n        hideDashboardUnifiedChildWorkspaceLoader(\n            reason + '-already-ready',\n            navigationToken\n        );\n\n        return;\n    }\n\n    const requestedTimeoutMs = Number(options.timeoutMs || 4200);\n"""
text = replace_once(text, old, new, 'dashboard readiness already-ready guard')

old = """        if (\n            !isDashboardInlineFrameNavigationCurrent(\n                frame,\n                navigationToken,\n                workspaceKey,\n                { verifyLoadedUrl: false }\n            )\n        ) {\n            return;\n        }\n\n        const hasCurrentLoadedDocument = isDashboardInlineFrameNavigationCurrent(\n"""
new = """        if (\n            !isDashboardInlineFrameNavigationCurrent(\n                frame,\n                navigationToken,\n                workspaceKey,\n                { verifyLoadedUrl: false }\n            )\n        ) {\n            return;\n        }\n\n        /*\n         * Do not keep running readiness DOM sweeps while the page is\n         * backgrounded. Resume the same navigation token when visible.\n         */\n        if (document.hidden) {\n            window.__yhDashboardChildWorkspaceReadyPollTimer =\n                window.setTimeout(tick, 500);\n\n            return;\n        }\n\n        const hasCurrentLoadedDocument = isDashboardInlineFrameNavigationCurrent(\n"""
text = replace_once(text, old, new, 'dashboard hidden readiness pause')

old = """            const sameNavigationAlreadyActive =\n                existingNavigationKey === cleanKey &&\n                existingExpectedUrl === normalizedInlineUrl &&\n                [\n                    'loading',\n                    'loaded',\n                    'waiting-roadmap-content',\n                    'ready'\n                ].includes(existingNavigationState);\n\n            bindDashboardInlineFrameEmbedMode(frame);\n\n            if (sameNavigationAlreadyActive) {\n                return;\n            }\n"""
new = """            const existingNavigationToken = String(\n                frame.dataset.yhDashboardNavigationToken || ''\n            ).trim();\n\n            const sameNavigationAlreadyActive = Boolean(\n                existingNavigationKey === cleanKey &&\n                existingExpectedUrl === normalizedInlineUrl &&\n                existingNavigationToken &&\n                existingNavigationState &&\n                existingNavigationState !== 'invalid' &&\n                currentInlineUrl === normalizedInlineUrl\n            );\n\n            bindDashboardInlineFrameEmbedMode(frame);\n\n            if (sameNavigationAlreadyActive) {\n                if (\n                    existingNavigationState === 'ready' &&\n                    frame.dataset.yhDashboardRevealState === 'ready'\n                ) {\n                    hideDashboardUnifiedChildWorkspaceLoader(\n                        'same-navigation-ready',\n                        existingNavigationToken\n                    );\n                } else {\n                    waitForDashboardInlineWorkspaceReady(\n                        frame,\n                        'same-navigation-resume',\n                        {\n                            navigationToken:\n                                existingNavigationToken,\n                            workspaceKey: cleanKey,\n                            timeoutMs:\n                                cleanKey === 'academy-roadmap'\n                                    ? 1600\n                                    : cleanKey.startsWith('plazas-')\n                                        ? 1400\n                                        : 4200,\n                            pollMs:\n                                cleanKey === 'academy-roadmap' ||\n                                cleanKey.startsWith('plazas-')\n                                    ? 70\n                                    : 90\n                        }\n                    );\n                }\n\n                return;\n            }\n"""
text = replace_once(text, old, new, 'dashboard same navigation coalescing')

old = """                frame.setAttribute(\n                    'src',\n                    inlineUrl || 'about:blank'\n                );\n\n                waitForDashboardInlineWorkspaceReady(\n                    frame,\n                    'iframe-src-child-ready',\n                    {\n                        navigationToken,\n                        workspaceKey: cleanKey,\n                        timeoutMs:\n                            cleanKey.startsWith(\n                                'plazas-'\n                            )\n                                ? 1400\n                                : 5500,\n                        pollMs:\n                            cleanKey.startsWith(\n                                'plazas-'\n                            )\n                                ? 70\n                                : 90\n                    }\n                );\n"""
new = """                frame.setAttribute(\n                    'src',\n                    inlineUrl || 'about:blank'\n                );\n\n                /*\n                 * The bound iframe load handler owns readiness polling\n                 * for a newly assigned document. Starting another poll\n                 * here only duplicates DOM sweeps before load completes.\n                 */\n"""
text = replace_once(text, old, new, 'dashboard remove pre-load duplicate poll')

old = """if (!window.__yhDashboardChildWorkspaceReadyMessageBoundV11) {\n    window.__yhDashboardChildWorkspaceReadyMessageBoundV11 = true;\n\n    window.addEventListener('message', (event) => {\n"""
new = """if (!window.__yhDashboardChildWorkspaceReadyMessageBoundV11) {\n    window.__yhDashboardChildWorkspaceReadyMessageBoundV11 = true;\n\n    window.addEventListener('message', (event) => {\n"""
# Marker intentionally retained; lifecycle block is inserted after the message block.
if old not in text:
    fail('dashboard child-ready message marker missing')

marker = """    });\n}\n\nfunction removeDashboardFederationUniverseBackButtons(doc = document) {\n"""
insert = """    });\n}\n\n/* PATCH: Dashboard child-workspace lifecycle pause/resume v1 */\nif (!window.__yhDashboardChildWorkspaceLifecycleV1Bound) {\n    window.__yhDashboardChildWorkspaceLifecycleV1Bound = true;\n\n    window.addEventListener('pagehide', () => {\n        window.clearTimeout(\n            window.__yhDashboardChildWorkspaceReadyPollTimer\n        );\n    });\n\n    document.addEventListener('visibilitychange', () => {\n        const frame = document.getElementById(\n            'yh-universe-workspace-inline-frame'\n        );\n\n        if (!frame) return;\n\n        if (document.hidden) {\n            window.clearTimeout(\n                window.__yhDashboardChildWorkspaceReadyPollTimer\n            );\n\n            return;\n        }\n\n        const navigationToken = String(\n            frame.dataset.yhDashboardNavigationToken || ''\n        ).trim();\n\n        const workspaceKey =\n            getDashboardInlineWorkspaceKeyFromFrame(frame);\n\n        if (\n            !navigationToken ||\n            !workspaceKey ||\n            frame.dataset.yhDashboardNavigationState === 'invalid' ||\n            frame.dataset.yhDashboardNavigationState === 'ready'\n        ) {\n            return;\n        }\n\n        waitForDashboardInlineWorkspaceReady(\n            frame,\n            'visibility-resume',\n            {\n                navigationToken,\n                workspaceKey,\n                timeoutMs:\n                    workspaceKey.startsWith('plazas-')\n                        ? 1400\n                        : 4200,\n                pollMs:\n                    workspaceKey.startsWith('plazas-')\n                        ? 70\n                        : 90\n            }\n        );\n    });\n}\n/* END PATCH: Dashboard child-workspace lifecycle pause/resume v1 */\n\nfunction removeDashboardFederationUniverseBackButtons(doc = document) {\n"""
text = replace_once(text, marker, insert, 'dashboard child workspace lifecycle insertion')

backup(path)
write_preserving_newlines(path, text, newline)

# -----------------------------------------------------------------------------
# 3) Academy embed deterministic owner: one active settle loop only
# -----------------------------------------------------------------------------
path = FILES['academy_js']
text, newline = read_preserving_newlines(path)

old = """(function installAcademyDashboardEmbedDeterministicSectionOwnerV20() {\n    if (window.__academyDashboardEmbedSectionOwnerV20Installed) return;\n    window.__academyDashboardEmbedSectionOwnerV20Installed = true;\n\n    function getDashboardSection() {\n"""
new = """(function installAcademyDashboardEmbedDeterministicSectionOwnerV20() {\n    if (window.__academyDashboardEmbedSectionOwnerV20Installed) return;\n    window.__academyDashboardEmbedSectionOwnerV20Installed = true;\n\n    let academyDashboardEmbedSettleTimerV21 = null;\n    let academyDashboardEmbedBootGenerationV21 = 0;\n\n    function getDashboardSection() {\n"""
text = replace_once(text, old, new, 'academy embed lifecycle variables')

start = text.find("    function boot(reason = 'boot') {")
end_marker = """\n    if (document.readyState === 'loading') {\n"""
end = text.find(end_marker, start)
if start < 0 or end < 0:
    fail('academy deterministic boot block not found')
old_block = text[start:end]
new_block = """    function boot(reason = 'boot') {\n        if (!isAcademyDashboardEmbedContext()) return;\n\n        const generation =\n            ++academyDashboardEmbedBootGenerationV21;\n\n        window.clearTimeout(\n            academyDashboardEmbedSettleTimerV21\n        );\n\n        const target = getDashboardTarget(\n            getDashboardSection()\n        );\n\n        const startedAt = Date.now();\n\n        document.body?.setAttribute(\n            'data-yh-dashboard-embed',\n            'true'\n        );\n\n        document.body?.setAttribute(\n            'data-yh-dashboard-inline-requested-target',\n            target\n        );\n\n        document.body?.removeAttribute(\n            'data-yh-dashboard-inline-active-target'\n        );\n\n        document.body?.setAttribute(\n            'data-yh-dashboard-child-ready',\n            'false'\n        );\n\n        document.body?.setAttribute(\n            'data-yh-dashboard-active-section',\n            getDashboardSection()\n        );\n\n        hideLocalLoaders(reason + '-before-open');\n\n        let stablePasses = 0;\n        let readyQueued = false;\n\n        const scheduleSettle = (delay = 60) => {\n            window.clearTimeout(\n                academyDashboardEmbedSettleTimerV21\n            );\n\n            academyDashboardEmbedSettleTimerV21 =\n                window.setTimeout(settle, delay);\n        };\n\n        const settle = () => {\n            if (\n                generation !==\n                academyDashboardEmbedBootGenerationV21\n            ) {\n                return;\n            }\n\n            if (document.hidden) {\n                scheduleSettle(240);\n                return;\n            }\n\n            hideLocalLoaders(reason + '-settle');\n\n            if (isTargetActive(target)) {\n                stablePasses += 1;\n            } else {\n                stablePasses = 0;\n            }\n\n            if (\n                stablePasses >= 2 &&\n                readyQueued === false\n            ) {\n                readyQueued = true;\n\n                window.requestAnimationFrame(() => {\n                    window.requestAnimationFrame(() => {\n                        if (\n                            generation !==\n                            academyDashboardEmbedBootGenerationV21\n                        ) {\n                            return;\n                        }\n\n                        if (isTargetActive(target)) {\n                            window.clearTimeout(\n                                academyDashboardEmbedSettleTimerV21\n                            );\n\n                            notifyReady(\n                                target,\n                                reason + '-stable-active'\n                            );\n\n                            return;\n                        }\n\n                        readyQueued = false;\n                        stablePasses = 0;\n\n                        if (Date.now() - startedAt < 2200) {\n                            scheduleSettle(60);\n                        }\n                    });\n                });\n\n                return;\n            }\n\n            if (Date.now() - startedAt < 2200) {\n                scheduleSettle(60);\n            }\n        };\n\n        /*\n         * Do not reopen an already-correct child view. This prevents\n         * duplicate render and request work during cached iframe starts.\n         */\n        if (!isTargetActive(target)) {\n            openEmbeddedSection(target);\n        }\n\n        window.requestAnimationFrame(() => {\n            if (\n                generation ===\n                academyDashboardEmbedBootGenerationV21\n            ) {\n                settle();\n            }\n        });\n    }\n"""
text = text[:start] + new_block + text[end:]

old = """    } else {\n        boot('already-ready');\n    }\n})();\n/* END PATCH: Academy dashboard embed deterministic section owner v20 */\n"""
new = """    } else {\n        boot('already-ready');\n    }\n\n    window.addEventListener('pagehide', () => {\n        academyDashboardEmbedBootGenerationV21 += 1;\n\n        window.clearTimeout(\n            academyDashboardEmbedSettleTimerV21\n        );\n\n        academyDashboardEmbedSettleTimerV21 = null;\n    });\n})();\n/* END PATCH: Academy dashboard embed deterministic section owner v20 */\n"""
text = replace_once(text, old, new, 'academy embed pagehide cleanup')

backup(path)
write_preserving_newlines(path, text, newline)

# -----------------------------------------------------------------------------
# 4) Game dashboard boot/pageshow request coalescing
# -----------------------------------------------------------------------------
path = FILES['game_dashboard_js']
text, newline = read_preserving_newlines(path)

old = """    let academySquadRankingLoadPromise = null;\n    let academySquadLiveSyncPromise = null;\n\n    /* PATCH: Shared Squad Missions UI state v1 */\n"""
new = """    let academySquadRankingLoadPromise = null;\n    let academySquadLiveSyncPromise = null;\n\n    let academyGameBootPromiseV1 = null;\n    let academyGameLastRefreshAtV1 = 0;\n\n    const academyGameRenderRetryTimersV1 =\n        new Set();\n\n    /* PATCH: Shared Squad Missions UI state v1 */\n"""
text = replace_once(text, old, new, 'game dashboard lifecycle variables')

old = """                renderDashboardGameFoundation();\n\n                if (openHistoryMissionId) {\n"""
new = """                academyGameLastRefreshAtV1 =\n                    Date.now();\n\n                renderDashboardGameFoundation();\n\n                if (openHistoryMissionId) {\n"""
text = replace_once(text, old, new, 'game dashboard live sync timestamp')

start = text.find("    function boot() {")
end = text.find("\n    window.YHURenderDashboardGameFoundation =", start)
if start < 0 or end < 0:
    fail('game dashboard boot block not found')
old_block = text[start:end]
new_block = """    function clearAcademyGameRenderRetryTimersV1() {\n        academyGameRenderRetryTimersV1\n            .forEach((timer) => {\n                window.clearTimeout(timer);\n            });\n\n        academyGameRenderRetryTimersV1.clear();\n    }\n\n    function scheduleAcademyGameRenderRetriesV1() {\n        if (academyGameRenderRetryTimersV1.size) {\n            return;\n        }\n\n        [80, 240, 600, 1200].forEach((delay) => {\n            const timer = window.setTimeout(() => {\n                academyGameRenderRetryTimersV1\n                    .delete(timer);\n\n                const rendered =\n                    renderDashboardGameFoundation();\n\n                if (rendered) {\n                    clearAcademyGameRenderRetryTimersV1();\n                }\n            }, delay);\n\n            academyGameRenderRetryTimersV1.add(timer);\n        });\n    }\n\n    function boot() {\n        const rendered =\n            renderDashboardGameFoundation();\n\n        if (rendered) {\n            clearAcademyGameRenderRetryTimersV1();\n        } else {\n            scheduleAcademyGameRenderRetriesV1();\n        }\n\n        if (academyGameBootPromiseV1) {\n            return academyGameBootPromiseV1;\n        }\n\n        academyGameBootPromiseV1 =\n            Promise.allSettled([\n                loadAcademyProgressionOnce(),\n                loadAcademySquadV1(),\n                loadAcademySquadMissionsV1()\n            ])\n                .then(() => {\n                    academyGameLastRefreshAtV1 =\n                        Date.now();\n\n                    renderDashboardGameFoundation();\n                    return true;\n                })\n                .finally(() => {\n                    academyGameBootPromiseV1 = null;\n                });\n\n        return academyGameBootPromiseV1;\n    }\n"""
text = text[:start] + new_block + text[end:]

old = """    window.addEventListener(\n        'pageshow',\n        () => {\n            window.setTimeout(\n                () => {\n                    renderDashboardGameFoundation();\n                    loadAcademyProgressionOnce();\n\n                    loadAcademySquadV1({\n                        force: true\n                    });\n\n                    loadAcademySquadMissionsV1({\n                        force: true\n                    })\n                        .then(() => {\n                            renderDashboardGameFoundation();\n                        })\n                        .catch(() => {});\n                },\n                120\n            );\n        }\n    );\n"""
new = """    window.addEventListener(\n        'pageshow',\n        (event) => {\n            renderDashboardGameFoundation();\n\n            if (academyGameBootPromiseV1) {\n                academyGameBootPromiseV1\n                    .then(() => {\n                        renderDashboardGameFoundation();\n                    })\n                    .catch(() => {});\n\n                return;\n            }\n\n            const stale = Boolean(\n                academyGameLastRefreshAtV1 === 0 ||\n                Date.now() - academyGameLastRefreshAtV1 >\n                    30000\n            );\n\n            if (event.persisted !== true && !stale) {\n                return;\n            }\n\n            window.setTimeout(() => {\n                if (document.hidden) return;\n\n                Promise.allSettled([\n                    loadAcademyProgressionOnce({\n                        force: true\n                    }),\n                    loadAcademySquadV1({\n                        force: true\n                    }),\n                    loadAcademySquadMissionsV1({\n                        force: true\n                    })\n                ]).then(() => {\n                    academyGameLastRefreshAtV1 =\n                        Date.now();\n\n                    renderDashboardGameFoundation();\n                });\n            }, 120);\n        }\n    );\n\n    document.addEventListener(\n        'visibilitychange',\n        () => {\n            if (\n                document.hidden ||\n                academyGameBootPromiseV1 ||\n                academySquadLiveSyncPromise ||\n                !academyGameLastRefreshAtV1 ||\n                Date.now() - academyGameLastRefreshAtV1 <\n                    60000\n            ) {\n                return;\n            }\n\n            Promise.allSettled([\n                loadAcademyProgressionOnce({ force: true }),\n                loadAcademySquadV1({ force: true }),\n                loadAcademySquadMissionsV1({ force: true })\n            ]).then(() => {\n                academyGameLastRefreshAtV1 = Date.now();\n                renderDashboardGameFoundation();\n            });\n        }\n    );\n"""
text = replace_once(text, old, new, 'game dashboard pageshow coalescing')

old = """    if (document.readyState === 'loading') {\n        document.addEventListener('DOMContentLoaded', boot, {\n            once: true\n        });\n    } else {\n        boot();\n    }\n})();"""
new = """    window.addEventListener('pagehide', () => {\n        clearAcademyGameRenderRetryTimersV1();\n    });\n\n    if (document.readyState === 'loading') {\n        document.addEventListener('DOMContentLoaded', boot, {\n            once: true\n        });\n    } else {\n        boot();\n    }\n})();"""
text = replace_once(text, old, new, 'game dashboard pagehide cleanup')

backup(path)
write_preserving_newlines(path, text, newline)

# -----------------------------------------------------------------------------
# 5) Cache versions only
# -----------------------------------------------------------------------------
path = FILES['dashboard_html']
text, newline = read_preserving_newlines(path)
text = replace_once(
    text,
    '<script src="/js/yh-shared-runtime.js?v=20260711-dashboard-view-state-v2"></script>',
    '<script src="/js/yh-shared-runtime.js?v=20260721-phase3c5a-lifecycle-v1"></script>',
    'dashboard html shared runtime cache'
)
text = replace_once(
    text,
    '<script src="/js/dashboard.js?v=20260721-academy-strict-reveal-v1"></script>',
    '<script src="/js/dashboard.js?v=20260721-phase3c5a-lifecycle-v1"></script>',
    'dashboard html dashboard js cache'
)
text = replace_once(
    text,
    '<script src="/js/yhu-game-dashboard.js?v=20260720-squad-achievement-notifications-v1"></script>',
    '<script src="/js/yhu-game-dashboard.js?v=20260721-phase3c5a-lifecycle-v1"></script>',
    'dashboard html game dashboard cache'
)
backup(path)
write_preserving_newlines(path, text, newline)

path = FILES['academy_html']
text, newline = read_preserving_newlines(path)
text = replace_once(
    text,
    '<script src="/js/yh-shared-runtime.js?v=20260711-dashboard-view-state-v2"></script>',
    '<script src="/js/yh-shared-runtime.js?v=20260721-phase3c5a-lifecycle-v1"></script>',
    'academy html shared runtime cache'
)
text = replace_once(
    text,
    '<script src="/js/academy.js?v=20260721-academy-strict-reveal-v1"></script>',
    '<script src="/js/academy.js?v=20260721-phase3c5a-lifecycle-v1"></script>',
    'academy html academy js cache'
)
backup(path)
write_preserving_newlines(path, text, newline)

print('Phase 3C.5A frontend lifecycle hardening patched successfully.')
for path in FILES.values():
    print(f'Updated: {path.relative_to(ROOT)}')
