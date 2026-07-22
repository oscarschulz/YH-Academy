#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path.cwd()

ACADEMY_JS = ROOT / "public" / "js" / "academy.js"
GAME_JS = ROOT / "public" / "js" / "yhu-game-dashboard.js"
ACADEMY_HTML = ROOT / "public" / "academy.html"
DASHBOARD_HTML = ROOT / "public" / "dashboard.html"
STYLE_CSS = ROOT / "public" / "css" / "style.css"
GAME_CSS = ROOT / "public" / "css" / "yhu-game-system.css"

TARGETS = (
    ACADEMY_JS,
    GAME_JS,
    ACADEMY_HTML,
    DASHBOARD_HTML,
    STYLE_CSS,
    GAME_CSS,
)

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
        f"{path.name}.backup-phase-3c7b-{STAMP}"
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
            "Use the latest post-3C.7A files."
        )

    return text.replace(old, new, 1)


for required in TARGETS:
    if not required.exists():
        fail(f"Missing required file: {required}")

for target in TARGETS:
    backup(target)

academy_js, academy_js_newline = read_normalized(ACADEMY_JS)
game_js, game_js_newline = read_normalized(GAME_JS)
academy_html, academy_html_newline = read_normalized(ACADEMY_HTML)
dashboard_html, dashboard_html_newline = read_normalized(DASHBOARD_HTML)
style_css, style_css_newline = read_normalized(STYLE_CSS)
game_css, game_css_newline = read_normalized(GAME_CSS)

# ------------------------------------------------------------------
# Academy Roadmap Solo Mode UI
# ------------------------------------------------------------------

academy_js = replace_once(
    academy_js,
    """    if (progression) {
        academyWriteProgressionCacheV1(
            progression
        );
    }
""",
    """    if (progression) {
        academyWriteProgressionCacheV1(
            progression
        );

        academySyncSoloModeUiV1(
            progression
        );
    }
""",
    "Academy progression-to-Solo-UI bridge"
)

academy_js = replace_once(
    academy_js,
    """    if (awarded > 0 && eventCreated) {
        return `${fallbackMessage} • +${awarded} XP`;
    }
""",
    """    if (awarded > 0 && eventCreated) {
        return (
            `${fallbackMessage} • +${awarded} XP` +
            academyBuildSoloGrowthSuffixV1(result)
        );
    }
""",
    "Academy verified completion Solo feedback"
)

academy_solo_helpers = r'''
/* PATCH: Phase 3C.7B — Academy Solo Mode UI v1 */

const ACADEMY_SOLO_ATTRIBUTE_ORDER_V1 = [
    'discipline',
    'health',
    'wealth',
    'mindset',
    'communication',
    'knowledge',
    'politics',
    'philosophy'
];

const ACADEMY_SOLO_ATTRIBUTE_LABELS_V1 = {
    discipline: 'Discipline',
    health: 'Health',
    wealth: 'Wealth',
    mindset: 'Mindset',
    communication: 'Communication',
    knowledge: 'Knowledge',
    politics: 'Politics',
    philosophy: 'Philosophy'
};

let academySoloModeUiStateV1 = null;
let academySoloModeUiLoadPromiseV1 = null;
let academySoloModeUiFetchedV1 = false;

function academyEscapeSoloUiV1(value = '') {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function academyExtractSoloModeV1(payload = {}) {
    const progression =
        payload?.progression &&
        typeof payload.progression === 'object'
            ? payload.progression
            : payload;

    const soloMode =
        progression?.soloMode &&
        typeof progression.soloMode === 'object'
            ? progression.soloMode
            : null;

    return soloMode;
}

function academyReadSoloModeUiCacheV1() {
    try {
        const parsed = JSON.parse(
            sessionStorage.getItem(
                'yh_academy_progression_v1'
            ) || 'null'
        );

        return academyExtractSoloModeV1(
            parsed?.progression || parsed || {}
        );
    } catch (_) {
        return null;
    }
}

function academyNormalizeSoloModeUiV1(
    soloMode = {}
) {
    const campaign =
        soloMode?.campaign &&
        typeof soloMode.campaign === 'object'
            ? soloMode.campaign
            : {};

    const sourceAttributes =
        soloMode?.attributes &&
        typeof soloMode.attributes === 'object'
            ? soloMode.attributes
            : {};

    const attributes = {};

    ACADEMY_SOLO_ATTRIBUTE_ORDER_V1
        .forEach((key) => {
            attributes[key] = Math.max(
                0,
                Math.round(
                    Number(
                        sourceAttributes[key] || 0
                    )
                )
            );
        });

    return {
        version:
            String(
                soloMode?.version ||
                'academy-solo-mode-v1'
            ).trim(),

        campaign: {
            roadmapId:
                String(
                    campaign.roadmapId || ''
                ).trim(),

            goal:
                String(
                    campaign.goal || ''
                ).trim(),

            completed:
                Math.max(
                    0,
                    Math.round(
                        Number(
                            campaign.completed || 0
                        )
                    )
                ),

            total:
                Math.max(
                    0,
                    Math.round(
                        Number(
                            campaign.total || 0
                        )
                    )
                ),

            percentage:
                Math.max(
                    0,
                    Math.min(
                        100,
                        Math.round(
                            Number(
                                campaign.percentage || 0
                            )
                        )
                    )
                )
        },

        attributes,

        strongestGrowthArea:
            soloMode?.strongestGrowthArea &&
            typeof soloMode.strongestGrowthArea ===
                'object'
                ? soloMode.strongestGrowthArea
                : null,

        totalGrowthPoints:
            Math.max(
                0,
                Math.round(
                    Number(
                        soloMode?.totalGrowthPoints ||
                        0
                    )
                )
            ),

        verifiedMissionCount:
            Math.max(
                0,
                Math.round(
                    Number(
                        soloMode?.verifiedMissionCount ||
                        0
                    )
                )
            )
    };
}

function academyRenderSoloModeUiV1(
    soloMode = academySoloModeUiStateV1
) {
    const root = document.getElementById(
        'academy-solo-mode-panel-v1'
    );

    if (!root) {
        return false;
    }

    if (
        !soloMode ||
        typeof soloMode !== 'object'
    ) {
        root.classList.add('is-loading');

        root.innerHTML = `
            <div class="academy-solo-mode-loading-v1">
                <span class="academy-solo-mode-loading-orb-v1"></span>
                <div>
                    <strong>Loading Solo Campaign</strong>
                    <p>Syncing verified Roadmap progress...</p>
                </div>
            </div>
        `;

        return false;
    }

    const normalized =
        academyNormalizeSoloModeUiV1(
            soloMode
        );

    const campaign = normalized.campaign;
    const attributeValues =
        Object.values(
            normalized.attributes
        );

    const attributeScale =
        Math.max(
            5,
            ...attributeValues
        );

    const strongest =
        normalized.strongestGrowthArea;

    const strongestLabel =
        strongest?.label ||
        ACADEMY_SOLO_ATTRIBUTE_LABELS_V1[
            strongest?.key
        ] ||
        'Not established yet';

    const strongestPoints =
        Math.max(
            0,
            Math.round(
                Number(
                    strongest?.points || 0
                )
            )
        );

    const attributesHtml =
        ACADEMY_SOLO_ATTRIBUTE_ORDER_V1
            .map((key) => {
                const points =
                    normalized.attributes[key];

                const percent =
                    points > 0
                        ? Math.max(
                            8,
                            Math.min(
                                100,
                                Math.round(
                                    (points /
                                        attributeScale) *
                                    100
                                )
                            )
                        )
                        : 0;

                return `
                    <div
                        class="academy-solo-attribute-v1"
                        data-academy-solo-attribute="${academyEscapeSoloUiV1(key)}"
                    >
                        <div class="academy-solo-attribute-head-v1">
                            <span>
                                ${academyEscapeSoloUiV1(
                                    ACADEMY_SOLO_ATTRIBUTE_LABELS_V1[key]
                                )}
                            </span>

                            <strong>
                                ${points}
                            </strong>
                        </div>

                        <div
                            class="academy-solo-attribute-track-v1"
                            aria-hidden="true"
                        >
                            <span
                                style="width:${percent}%"
                            ></span>
                        </div>
                    </div>
                `;
            })
            .join('');

    root.classList.remove('is-loading');

    root.innerHTML = `
        <div class="academy-solo-mode-head-v1">
            <div>
                <div class="academy-solo-mode-kicker-v1">
                    Solo Mode · Personal Campaign
                </div>

                <h3>
                    Build yourself through verified action
                </h3>
            </div>

            <span class="academy-solo-mode-percent-v1">
                ${campaign.percentage}%
            </span>
        </div>

        <p class="academy-solo-mode-goal-v1">
            ${
                academyEscapeSoloUiV1(
                    campaign.goal ||
                    'Complete AI-verified Roadmap missions to develop your operator profile.'
                )
            }
        </p>

        <div class="academy-solo-mode-progress-v1">
            <div>
                <span>
                    Campaign Progress
                </span>

                <strong>
                    ${campaign.completed}/${campaign.total}
                </strong>
            </div>

            <div
                class="academy-solo-mode-progress-track-v1"
                aria-hidden="true"
            >
                <span
                    style="width:${campaign.percentage}%"
                ></span>
            </div>
        </div>

        <div class="academy-solo-mode-metrics-v1">
            <div>
                <small>Verified Missions</small>
                <strong>
                    ${normalized.verifiedMissionCount}
                </strong>
            </div>

            <div>
                <small>Total Growth</small>
                <strong>
                    ${normalized.totalGrowthPoints}
                </strong>
            </div>

            <div>
                <small>Strongest Growth</small>
                <strong>
                    ${academyEscapeSoloUiV1(strongestLabel)}
                    ${
                        strongestPoints > 0
                            ? `<span>+${strongestPoints}</span>`
                            : ''
                    }
                </strong>
            </div>
        </div>

        <div class="academy-solo-attributes-v1">
            ${attributesHtml}
        </div>
    `;

    return true;
}

function academySyncSoloModeUiV1(
    payload = {}
) {
    const soloMode =
        academyExtractSoloModeV1(
            payload
        );

    if (!soloMode) {
        return null;
    }

    academySoloModeUiStateV1 =
        academyNormalizeSoloModeUiV1(
            soloMode
        );

    academyRenderSoloModeUiV1(
        academySoloModeUiStateV1
    );

    return academySoloModeUiStateV1;
}

async function academyLoadSoloModeUiV1({
    force = false
} = {}) {
    if (!academySoloModeUiStateV1) {
        academySoloModeUiStateV1 =
            academyReadSoloModeUiCacheV1();
    }

    academyRenderSoloModeUiV1(
        academySoloModeUiStateV1
    );

    if (
        academySoloModeUiStateV1 &&
        academySoloModeUiFetchedV1 &&
        !force
    ) {
        return academySoloModeUiStateV1;
    }

    if (academySoloModeUiLoadPromiseV1) {
        return academySoloModeUiLoadPromiseV1;
    }

    academySoloModeUiLoadPromiseV1 =
        (async () => {
            try {
                const payload =
                    await academyAuthedFetch(
                        '/api/academy/progression'
                    );

                const progression =
                    payload?.progression &&
                    typeof payload.progression ===
                        'object'
                        ? payload.progression
                        : payload;

                if (
                    progression &&
                    typeof progression === 'object'
                ) {
                    academyWriteProgressionCacheV1(
                        progression
                    );
                }

                academySoloModeUiFetchedV1 = true;

                return (
                    academySyncSoloModeUiV1(
                        progression
                    ) ||
                    null
                );
            } catch (error) {
                const root =
                    document.getElementById(
                        'academy-solo-mode-panel-v1'
                    );

                if (
                    root &&
                    !academySoloModeUiStateV1
                ) {
                    root.classList.remove(
                        'is-loading'
                    );

                    root.innerHTML = `
                        <div class="academy-solo-mode-loading-v1 is-unavailable">
                            <div>
                                <strong>Solo Campaign unavailable</strong>
                                <p>
                                    ${
                                        academyEscapeSoloUiV1(
                                            error?.message ||
                                            'Progress will sync on the next verified mission.'
                                        )
                                    }
                                </p>
                            </div>
                        </div>
                    `;
                }

                return academySoloModeUiStateV1;
            } finally {
                academySoloModeUiLoadPromiseV1 =
                    null;
            }
        })();

    return academySoloModeUiLoadPromiseV1;
}

function academyBuildSoloGrowthSuffixV1(
    result = {}
) {
    const soloModeEvent =
        result?.soloModeEvent &&
        typeof result.soloModeEvent ===
            'object'
            ? result.soloModeEvent
            : null;

    if (
        !soloModeEvent ||
        soloModeEvent.created !== true
    ) {
        return '';
    }

    const event =
        soloModeEvent?.event &&
        typeof soloModeEvent.event ===
            'object'
            ? soloModeEvent.event
            : {};

    const growthPoints =
        Math.max(
            0,
            Math.round(
                Number(
                    event.growthPoints || 0
                )
            )
        );

    const attributes =
        event?.attributes &&
        typeof event.attributes === 'object'
            ? event.attributes
            : {};

    const attributeSummary =
        Object.entries(attributes)
            .filter(([, value]) => (
                Number(value || 0) > 0
            ))
            .sort((a, b) => (
                Number(b[1] || 0) -
                Number(a[1] || 0)
            ))
            .slice(0, 2)
            .map(([key, value]) => {
                return (
                    `${
                        ACADEMY_SOLO_ATTRIBUTE_LABELS_V1[key] ||
                        key
                    } +${Math.round(Number(value || 0))}`
                );
            })
            .join(' · ');

    return (
        growthPoints > 0
            ? (
                ` • +${growthPoints} Solo Growth` +
                (
                    attributeSummary
                        ? ` • ${attributeSummary}`
                        : ''
                )
            )
            : ''
    );
}

/* END PATCH: Phase 3C.7B — Academy Solo Mode UI v1 */

'''

academy_js = replace_once(
    academy_js,
    """/* END PATCH: Academy instant progression response bridge v1 */
async function academyRefreshRoadmap() {
""",
    """/* END PATCH: Academy instant progression response bridge v1 */
""" + academy_solo_helpers + """async function academyRefreshRoadmap() {
""",
    "Academy Solo Mode UI helper block"
)

academy_js = replace_once(
    academy_js,
    """                <div class="academy-home-stat-card">
                    <div class="academy-home-stat-label">Daily Load</div>
                    <div class="academy-home-stat-value">${maxSustainableDailyMinutes > 0 ? safeHtml(maxSustainableDailyMinutes) : '—'}<span>${maxSustainableDailyMinutes > 0 ? ' mins' : ''}</span></div>
                </div>
            </section>
        `;
""",
    """                <div class="academy-home-stat-card">
                    <div class="academy-home-stat-label">Daily Load</div>
                    <div class="academy-home-stat-value">${maxSustainableDailyMinutes > 0 ? safeHtml(maxSustainableDailyMinutes) : '—'}<span>${maxSustainableDailyMinutes > 0 ? ' mins' : ''}</span></div>
                </div>
            </section>

            <section
                class="academy-solo-mode-panel-v1 is-loading"
                id="academy-solo-mode-panel-v1"
                aria-live="polite"
            >
                <div class="academy-solo-mode-loading-v1">
                    <span class="academy-solo-mode-loading-orb-v1"></span>
                    <div>
                        <strong>Loading Solo Campaign</strong>
                        <p>Syncing verified Roadmap progress...</p>
                    </div>
                </div>
            </section>
        `;
""",
    "Academy Solo Campaign Roadmap panel"
)

academy_js = replace_once(
    academy_js,
    """    academyInjectRoadmapTransformationSystem(homeData);
    academyInstallRoadmapTransformationActions();
    academyBuildRoadmapTabbedShellFromCurrentDom();

    document.getElementById('academy-home-enter-chat')?.addEventListener('click', () => {
""",
    """    academyInjectRoadmapTransformationSystem(homeData);
    academyInstallRoadmapTransformationActions();
    academyBuildRoadmapTabbedShellFromCurrentDom();

    academyRenderSoloModeUiV1();

    void academyLoadSoloModeUiV1();

    document.getElementById('academy-home-enter-chat')?.addEventListener('click', () => {
""",
    "Academy Solo Campaign render boot"
)

# ------------------------------------------------------------------
# Dashboard Academy Solo Mode preview
# ------------------------------------------------------------------

game_js = replace_once(
    game_js,
    """    let academyProgressionLoadPromise = null;
    let academyProgressionLoaded = false;

    /* PATCH: Live Squad UI state v1 */
""",
    """    let academyProgressionLoadPromise = null;
    let academyProgressionLoaded = false;
    let academySoloModeStateV1 = null;

    /* PATCH: Live Squad UI state v1 */
""",
    "Dashboard Solo Mode state"
)

dashboard_solo_helpers = r'''
    /* PATCH: Phase 3C.7B — Dashboard Solo Mode preview v1 */

    function extractAcademySoloModeV1(
        payload = {}
    ) {
        const progression =
            payload?.progression &&
            typeof payload.progression ===
                'object'
                ? payload.progression
                : payload;

        return (
            progression?.soloMode &&
            typeof progression.soloMode ===
                'object'
                ? progression.soloMode
                : null
        );
    }

    function syncAcademySoloModeStateV1(
        payload = {}
    ) {
        const soloMode =
            extractAcademySoloModeV1(
                payload
            );

        if (!soloMode) {
            return null;
        }

        academySoloModeStateV1 = {
            ...soloMode,

            campaign:
                soloMode?.campaign &&
                typeof soloMode.campaign ===
                    'object'
                    ? {
                        ...soloMode.campaign
                    }
                    : {},

            attributes:
                soloMode?.attributes &&
                typeof soloMode.attributes ===
                    'object'
                    ? {
                        ...soloMode.attributes
                    }
                    : {}
        };

        return academySoloModeStateV1;
    }

    function readAcademySoloModeSessionV1() {
        try {
            const parsed =
                JSON.parse(
                    sessionStorage.getItem(
                        'yh_academy_progression_v1'
                    ) || 'null'
                );

            return extractAcademySoloModeV1(
                parsed?.progression ||
                parsed ||
                {}
            );
        } catch (_) {
            return null;
        }
    }

    function buildAcademySoloModePreviewV1() {
        const soloMode =
            academySoloModeStateV1 ||
            readAcademySoloModeSessionV1();

        if (!soloMode) {
            return `
                <div class="yh-game-solo-preview-v1 is-loading">
                    <small>Solo Campaign</small>

                    <strong>
                        Syncing verified progress...
                    </strong>
                </div>
            `;
        }

        const campaign =
            soloMode?.campaign &&
            typeof soloMode.campaign ===
                'object'
                ? soloMode.campaign
                : {};

        const completed =
            Math.max(
                0,
                Math.round(
                    Number(
                        campaign.completed || 0
                    )
                )
            );

        const total =
            Math.max(
                0,
                Math.round(
                    Number(
                        campaign.total || 0
                    )
                )
            );

        const percentage =
            Math.max(
                0,
                Math.min(
                    100,
                    Math.round(
                        Number(
                            campaign.percentage || 0
                        )
                    )
                )
            );

        const verifiedMissionCount =
            Math.max(
                0,
                Math.round(
                    Number(
                        soloMode
                            ?.verifiedMissionCount ||
                        0
                    )
                )
            );

        const totalGrowthPoints =
            Math.max(
                0,
                Math.round(
                    Number(
                        soloMode
                            ?.totalGrowthPoints ||
                        0
                    )
                )
            );

        const strongest =
            soloMode?.strongestGrowthArea &&
            typeof soloMode
                .strongestGrowthArea ===
                'object'
                ? soloMode
                    .strongestGrowthArea
                : null;

        const strongestLabel =
            String(
                strongest?.label ||
                'Not established'
            ).trim();

        const strongestPoints =
            Math.max(
                0,
                Math.round(
                    Number(
                        strongest?.points || 0
                    )
                )
            );

        return `
            <div class="yh-game-solo-preview-v1">
                <div class="yh-game-solo-preview-head-v1">
                    <div>
                        <small>
                            Solo Campaign
                        </small>

                        <strong>
                            ${
                                escapeHtml(
                                    campaign.goal ||
                                    'Personal Roadmap'
                                )
                            }
                        </strong>
                    </div>

                    <span>
                        ${percentage}%
                    </span>
                </div>

                <div
                    class="yh-game-solo-preview-track-v1"
                    aria-hidden="true"
                >
                    <span
                        style="width:${percentage}%"
                    ></span>
                </div>

                <div class="yh-game-solo-preview-stats-v1">
                    <span>
                        <b>${completed}/${total}</b>
                        Campaign
                    </span>

                    <span>
                        <b>${verifiedMissionCount}</b>
                        Verified
                    </span>

                    <span>
                        <b>${totalGrowthPoints}</b>
                        Growth
                    </span>
                </div>

                <div class="yh-game-solo-preview-strongest-v1">
                    <small>
                        Strongest Growth
                    </small>

                    <strong>
                        ${escapeHtml(strongestLabel)}
                        ${
                            strongestPoints > 0
                                ? `<span>+${strongestPoints}</span>`
                                : ''
                        }
                    </strong>
                </div>
            </div>
        `;
    }

    /* END PATCH: Phase 3C.7B — Dashboard Solo Mode preview v1 */

'''

game_js = replace_once(
    game_js,
    """    async function loadAcademyProgressionOnce({
        force = false
    } = {}) {
""",
    dashboard_solo_helpers + """    async function loadAcademyProgressionOnce({
        force = false
    } = {}) {
""",
    "Dashboard Solo Mode helper block"
)

game_js = replace_once(
    game_js,
    """                const progressionPayload =
                    await fetchAcademyGameJson(
                        '/api/academy/progression'
                    );

                window.YHUGameCore
""",
    """                const progressionPayload =
                    await fetchAcademyGameJson(
                        '/api/academy/progression'
                    );

                syncAcademySoloModeStateV1(
                    progressionPayload
                );

                window.YHUGameCore
""",
    "Dashboard progression Solo state sync"
)

game_js = replace_once(
    game_js,
    """                ${
                    isPersistentAcademy
                        ? `
                            <div class="yh-game-academy-xp-strip">
                                <span>
                                    Level ${Number(snapshot.level || 1)}
                                </span>

                                <strong>
                                    ${Number(snapshot.totalXp || 0).toLocaleString()} XP
                                </strong>

                                <span>
                                    ${Number(snapshot.weeklyXp || 0).toLocaleString()} this week
                                </span>
                            </div>
                        `
                        : ''
                }

                <p class="yh-game-division-status">
""",
    """                ${
                    isPersistentAcademy
                        ? `
                            <div class="yh-game-academy-xp-strip">
                                <span>
                                    Level ${Number(snapshot.level || 1)}
                                </span>

                                <strong>
                                    ${Number(snapshot.totalXp || 0).toLocaleString()} XP
                                </strong>

                                <span>
                                    ${Number(snapshot.weeklyXp || 0).toLocaleString()} this week
                                </span>
                            </div>
                        `
                        : ''
                }

                ${
                    division === 'academy'
                        ? buildAcademySoloModePreviewV1()
                        : ''
                }

                <p class="yh-game-division-status">
""",
    "Dashboard Academy Solo preview placement"
)

game_js = replace_once(
    game_js,
    """        if (progression) {
            window.YHUGameCore
                ?.setAcademyProgressionCache?.(
                    progression
                );
        }
""",
    """        if (progression) {
            syncAcademySoloModeStateV1(
                progression
            );

            window.YHUGameCore
                ?.setAcademyProgressionCache?.(
                    progression
                );
        }
""",
    "Dashboard live Squad progression Solo sync"
)

game_js = replace_once(
    game_js,
    """    window.addEventListener(
        'yhu:academy-progression-updated',
        renderDashboardGameFoundation
    );
""",
    """    window.addEventListener(
        'yhu:academy-progression-updated',
        (event) => {
            syncAcademySoloModeStateV1(
                event?.detail || {}
            );

            renderDashboardGameFoundation();
        }
    );
""",
    "Dashboard same-window Solo progression listener"
)

game_js = replace_once(
    game_js,
    """            if (
                progression &&
                typeof progression ===
                    'object'
            ) {
                window.YHUGameCore
""",
    """            if (
                progression &&
                typeof progression ===
                    'object'
            ) {
                syncAcademySoloModeStateV1(
                    progression
                );

                window.YHUGameCore
""",
    "Dashboard iframe Solo progression listener"
)

# ------------------------------------------------------------------
# Academy Solo Mode styles
# ------------------------------------------------------------------

academy_solo_css = r'''

/* =========================================================
   Phase 3C.7B — Academy Solo Mode UI v1
   ========================================================= */

.academy-solo-mode-panel-v1 {
    position: relative;
    overflow: hidden;
    display: grid;
    gap: 15px;
    margin-top: 14px;
    padding: clamp(18px, 2vw, 24px);
    border: 1px solid rgba(103, 232, 249, 0.22);
    border-radius: 18px;
    background:
        radial-gradient(
            circle at 10% 0,
            rgba(56, 189, 248, 0.18),
            transparent 34%
        ),
        radial-gradient(
            circle at 92% 100%,
            rgba(99, 102, 241, 0.16),
            transparent 36%
        ),
        linear-gradient(
            135deg,
            rgba(7, 20, 46, 0.96),
            rgba(3, 9, 27, 0.94)
        );
    box-shadow:
        0 20px 50px rgba(0, 0, 0, 0.28),
        inset 0 1px 0 rgba(255, 255, 255, 0.055);
}

.academy-solo-mode-panel-v1::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.26;
    background-image:
        linear-gradient(
            rgba(103, 232, 249, 0.05) 1px,
            transparent 1px
        ),
        linear-gradient(
            90deg,
            rgba(103, 232, 249, 0.05) 1px,
            transparent 1px
        );
    background-size: 34px 34px;
    mask-image: linear-gradient(
        90deg,
        rgba(0, 0, 0, 0.78),
        transparent
    );
}

.academy-solo-mode-panel-v1 > * {
    position: relative;
    z-index: 1;
}

.academy-solo-mode-head-v1 {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}

.academy-solo-mode-head-v1 > div {
    min-width: 0;
}

.academy-solo-mode-kicker-v1 {
    color: #67e8f9;
    font-family: "Orbitron", "Rajdhani", sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.13em;
    text-transform: uppercase;
}

.academy-solo-mode-head-v1 h3 {
    margin: 6px 0 0;
    color: #ffffff;
    font-family: "Rajdhani", "Poppins", sans-serif;
    font-size: clamp(1.45rem, 2.1vw, 2rem);
    line-height: 1;
}

.academy-solo-mode-percent-v1 {
    flex: 0 0 auto;
    min-width: 66px;
    min-height: 44px;
    display: grid;
    place-items: center;
    padding: 8px 12px;
    border: 1px solid rgba(103, 232, 249, 0.28);
    background: rgba(56, 189, 248, 0.1);
    color: #dff7ff;
    font-family: "Orbitron", sans-serif;
    font-size: 0.92rem;
    font-weight: 800;
}

.academy-solo-mode-goal-v1 {
    margin: 0;
    color: #aebbd1;
    font-size: 0.92rem;
    line-height: 1.55;
}

.academy-solo-mode-progress-v1 {
    display: grid;
    gap: 8px;
}

.academy-solo-mode-progress-v1 > div:first-child {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    color: #94a3b8;
    font-size: 0.8rem;
}

.academy-solo-mode-progress-v1 strong {
    color: #ffffff;
}

.academy-solo-mode-progress-track-v1,
.academy-solo-attribute-track-v1 {
    position: relative;
    width: 100%;
    overflow: hidden;
    border: 1px solid rgba(103, 232, 249, 0.15);
    background: rgba(255, 255, 255, 0.055);
}

.academy-solo-mode-progress-track-v1 {
    height: 9px;
}

.academy-solo-mode-progress-track-v1 > span,
.academy-solo-attribute-track-v1 > span {
    position: absolute;
    inset: 0 auto 0 0;
    display: block;
    max-width: 100%;
    background:
        linear-gradient(
            90deg,
            #2563eb,
            #38bdf8,
            #67e8f9
        );
    box-shadow:
        0 0 16px rgba(56, 189, 248, 0.45);
    transition: width 0.4s ease;
}

.academy-solo-mode-metrics-v1 {
    display: grid;
    grid-template-columns:
        repeat(3, minmax(0, 1fr));
    gap: 10px;
}

.academy-solo-mode-metrics-v1 > div {
    min-width: 0;
    display: grid;
    gap: 5px;
    padding: 12px 13px;
    border: 1px solid rgba(223, 247, 255, 0.11);
    background: rgba(255, 255, 255, 0.035);
}

.academy-solo-mode-metrics-v1 small,
.academy-solo-attribute-head-v1 span {
    color: #94a3b8;
    font-size: 0.68rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
}

.academy-solo-mode-metrics-v1 strong {
    min-width: 0;
    color: #ffffff;
    font-size: 0.94rem;
    overflow-wrap: anywhere;
}

.academy-solo-mode-metrics-v1 strong span {
    color: #67e8f9;
    white-space: nowrap;
}

.academy-solo-attributes-v1 {
    display: grid;
    grid-template-columns:
        repeat(4, minmax(0, 1fr));
    gap: 9px;
}

.academy-solo-attribute-v1 {
    min-width: 0;
    display: grid;
    gap: 7px;
    padding: 10px;
    border: 1px solid rgba(223, 247, 255, 0.09);
    background: rgba(2, 8, 23, 0.34);
}

.academy-solo-attribute-head-v1 {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.academy-solo-attribute-head-v1 span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.academy-solo-attribute-head-v1 strong {
    color: #dff7ff;
    font-family: "Orbitron", sans-serif;
    font-size: 0.72rem;
}

.academy-solo-attribute-track-v1 {
    height: 6px;
}

.academy-solo-mode-loading-v1 {
    min-height: 92px;
    display: flex;
    align-items: center;
    gap: 14px;
    color: #aebbd1;
}

.academy-solo-mode-loading-v1 strong {
    display: block;
    color: #ffffff;
}

.academy-solo-mode-loading-v1 p {
    margin: 4px 0 0;
    font-size: 0.82rem;
}

.academy-solo-mode-loading-orb-v1 {
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    border: 2px solid rgba(103, 232, 249, 0.16);
    border-top-color: #67e8f9;
    border-radius: 999px;
    animation: academySoloModeSpinV1 0.85s linear infinite;
}

@keyframes academySoloModeSpinV1 {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 820px) {
    .academy-solo-attributes-v1 {
        grid-template-columns:
            repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 620px) {
    .academy-solo-mode-head-v1 {
        align-items: stretch;
    }

    .academy-solo-mode-percent-v1 {
        min-width: 58px;
    }

    .academy-solo-mode-metrics-v1 {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 430px) {
    .academy-solo-mode-head-v1 {
        display: grid;
        grid-template-columns:
            minmax(0, 1fr)
            auto;
    }

    .academy-solo-attributes-v1 {
        grid-template-columns: 1fr;
    }
}

/* END Phase 3C.7B — Academy Solo Mode UI v1 */
'''

style_css = replace_once(
    style_css,
    """.academy-home-stat-value span {
    font-size: 1.03rem;
    color: var(--text-muted);
}

.academy-home-stack {
""",
    """.academy-home-stat-value span {
    font-size: 1.03rem;
    color: var(--text-muted);
}
""" + academy_solo_css + """
.academy-home-stack {
""",
    "Academy Solo Mode styles"
)

# ------------------------------------------------------------------
# Dashboard Solo Mode preview styles
# ------------------------------------------------------------------

dashboard_solo_css = r'''

/* =========================================================
   Phase 3C.7B — Dashboard Solo Mode preview v1
   ========================================================= */

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-v1 {
    display: grid;
    gap: 9px;
    padding: 11px;
    border: 1px solid rgba(103, 232, 249, 0.14);
    background:
        radial-gradient(
            circle at 10% 0,
            rgba(56, 189, 248, 0.12),
            transparent 36%
        ),
        rgba(2, 8, 23, 0.36);
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-head-v1 {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-head-v1 > div {
    min-width: 0;
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-head-v1 small,
body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-strongest-v1 small,
body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-v1.is-loading small {
    display: block;
    color: #67e8f9;
    font-family: "Orbitron", sans-serif;
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-head-v1 strong {
    display: -webkit-box;
    margin-top: 4px;
    overflow: hidden;
    color: #ffffff;
    font-size: 0.78rem;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-head-v1 > span {
    flex: 0 0 auto;
    color: #dff7ff;
    font-family: "Orbitron", sans-serif;
    font-size: 0.72rem;
    font-weight: 800;
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-track-v1 {
    position: relative;
    height: 6px;
    overflow: hidden;
    border: 1px solid rgba(103, 232, 249, 0.13);
    background: rgba(255, 255, 255, 0.05);
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-track-v1 > span {
    position: absolute;
    inset: 0 auto 0 0;
    display: block;
    max-width: 100%;
    background:
        linear-gradient(
            90deg,
            #2563eb,
            #38bdf8,
            #67e8f9
        );
    box-shadow: 0 0 12px rgba(56, 189, 248, 0.42);
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-stats-v1 {
    display: grid;
    grid-template-columns:
        repeat(3, minmax(0, 1fr));
    gap: 6px;
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-stats-v1 span {
    min-width: 0;
    display: grid;
    gap: 2px;
    color: #64748b;
    font-size: 0.58rem;
    line-height: 1.2;
    text-transform: uppercase;
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-stats-v1 b {
    color: #dff7ff;
    font-family: "Orbitron", sans-serif;
    font-size: 0.68rem;
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-strongest-v1 {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(223, 247, 255, 0.08);
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-strongest-v1 strong {
    min-width: 0;
    color: #ffffff;
    font-size: 0.7rem;
    text-align: right;
    overflow-wrap: anywhere;
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-strongest-v1 strong span {
    color: #67e8f9;
    white-space: nowrap;
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-v1.is-loading {
    min-height: 70px;
    align-content: center;
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-solo-preview-v1.is-loading strong {
    color: #94a3b8;
    font-size: 0.72rem;
}

@media (max-width: 420px) {
    body[data-yh-view="hub"][data-yh-page="dashboard"]
    .yh-game-solo-preview-stats-v1 {
        grid-template-columns: 1fr;
    }
}

/* END Phase 3C.7B — Dashboard Solo Mode preview v1 */
'''

game_css = replace_once(
    game_css,
    """body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-academy-xp-strip strong {
    color: #dff7ff;
    font-family: "Orbitron", sans-serif;
    font-size: 0.74rem;
    text-align: center;
}

body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-leaderboard-position {
""",
    """body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-academy-xp-strip strong {
    color: #dff7ff;
    font-family: "Orbitron", sans-serif;
    font-size: 0.74rem;
    text-align: center;
}
""" + dashboard_solo_css + """
body[data-yh-view="hub"][data-yh-page="dashboard"]
.yh-game-leaderboard-position {
""",
    "Dashboard Solo Mode preview styles"
)

# ------------------------------------------------------------------
# Cache keys
# ------------------------------------------------------------------

academy_html = replace_once(
    academy_html,
    '<link rel="stylesheet" href="/css/style.css?v=20260722-phase3c6e-mission-journal-layout-v2">',
    '<link rel="stylesheet" href="/css/style.css?v=20260723-phase3c7b-solo-mode-ui-v1">',
    "Academy style cache key"
)

academy_html = replace_once(
    academy_html,
    '<script src="/js/academy.js?v=20260722-phase3c6e-mission-journal-ai-v1"></script>',
    '<script src="/js/academy.js?v=20260723-phase3c7b-solo-mode-ui-v1"></script>',
    "Academy JavaScript cache key"
)

dashboard_html = replace_once(
    dashboard_html,
    '<link rel="stylesheet" href="/css/yhu-game-system.css?v=20260720-squad-celebration-v1">',
    '<link rel="stylesheet" href="/css/yhu-game-system.css?v=20260723-phase3c7b-solo-mode-ui-v1">',
    "Dashboard game style cache key"
)

dashboard_html = replace_once(
    dashboard_html,
    '<script src="/js/yhu-game-dashboard.js?v=20260721-phase3c5a-lifecycle-v1"></script>',
    '<script src="/js/yhu-game-dashboard.js?v=20260723-phase3c7b-solo-mode-ui-v1"></script>',
    "Dashboard game JavaScript cache key"
)

# ------------------------------------------------------------------
# Write and verify
# ------------------------------------------------------------------

write_preserving_newlines(
    ACADEMY_JS,
    academy_js,
    academy_js_newline
)
write_preserving_newlines(
    GAME_JS,
    game_js,
    game_js_newline
)
write_preserving_newlines(
    ACADEMY_HTML,
    academy_html,
    academy_html_newline
)
write_preserving_newlines(
    DASHBOARD_HTML,
    dashboard_html,
    dashboard_html_newline
)
write_preserving_newlines(
    STYLE_CSS,
    style_css,
    style_css_newline
)
write_preserving_newlines(
    GAME_CSS,
    game_css,
    game_css_newline
)

for path in (ACADEMY_JS, GAME_JS):
    syntax = subprocess.run(
        ["node", "--check", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True
    )

    if syntax.returncode != 0:
        print(syntax.stdout)
        print(syntax.stderr, file=sys.stderr)
        fail(f"Syntax check failed: {path}")

saved_academy_js, _ = read_normalized(ACADEMY_JS)
saved_game_js, _ = read_normalized(GAME_JS)
saved_academy_html, _ = read_normalized(ACADEMY_HTML)
saved_dashboard_html, _ = read_normalized(DASHBOARD_HTML)
saved_style_css, _ = read_normalized(STYLE_CSS)
saved_game_css, _ = read_normalized(GAME_CSS)

integrity_checks = [
    (
        'id="academy-solo-mode-panel-v1"'
        in saved_academy_js,
        "Academy Solo Campaign panel"
    ),
    (
        "academyLoadSoloModeUiV1"
        in saved_academy_js,
        "Academy Solo progression loader"
    ),
    (
        "academyBuildSoloGrowthSuffixV1"
        in saved_academy_js,
        "Academy Solo completion feedback"
    ),
    (
        "buildAcademySoloModePreviewV1"
        in saved_game_js,
        "Dashboard Solo Campaign preview"
    ),
    (
        "syncAcademySoloModeStateV1"
        in saved_game_js,
        "Dashboard Solo live synchronization"
    ),
    (
        ".academy-solo-mode-panel-v1"
        in saved_style_css,
        "Academy Solo Mode styles"
    ),
    (
        ".yh-game-solo-preview-v1"
        in saved_game_css,
        "Dashboard Solo preview styles"
    ),
    (
        "20260723-phase3c7b-solo-mode-ui-v1"
        in saved_academy_html,
        "Academy cache keys"
    ),
    (
        "20260723-phase3c7b-solo-mode-ui-v1"
        in saved_dashboard_html,
        "Dashboard cache keys"
    )
]

for passed, label in integrity_checks:
    if not passed:
        fail(f"Integrity check failed: {label}")

print(
    "\nPhase 3C.7B Academy Solo Mode UI "
    "patched successfully."
)
print("Updated: public/js/academy.js")
print("Updated: public/js/yhu-game-dashboard.js")
print("Updated: public/academy.html")
print("Updated: public/dashboard.html")
print("Updated: public/css/style.css")
print("Updated: public/css/yhu-game-system.css")
print("Syntax checks: passed")
print("Integrity checks: passed")
print(
    "\nNot changed: dashboard.js, backend, routes, "
    "AI verification, Roadmap generation, XP values, "
    "Squad logic, Plazas, Federation, or authentication."
)
