from __future__ import annotations

from datetime import datetime
from pathlib import Path

JS_PATH = Path('public/js/yhu-game-dashboard.js')
CSS_PATH = Path('public/css/yhu-game-system.css')
HTML_PATH = Path('public/dashboard.html')

JS_MARKER = '/* PATCH: Squad Mission completion celebration v1 */'
CSS_MARKER = '/* Squad Mission completion celebration v1 */'
CACHE_VERSION = '20260720-squad-celebration-v1'


def fail(message: str) -> None:
    raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


def backup(path: Path) -> Path:
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    target = path.with_name(f'{path.name}.backup-phase-3c4a-{stamp}')
    target.write_bytes(path.read_bytes())
    return target


for required in (JS_PATH, CSS_PATH, HTML_PATH):
    if not required.exists():
        fail(f'Missing required file: {required}')

js = JS_PATH.read_text(encoding='utf-8')
css = CSS_PATH.read_text(encoding='utf-8')
html = HTML_PATH.read_text(encoding='utf-8')

if JS_MARKER in js or CSS_MARKER in css:
    raise SystemExit('Phase 3C.4A is already installed. No changes made.')

backups = [backup(JS_PATH), backup(CSS_PATH), backup(HTML_PATH)]

# ------------------------------------------------------------------
# JS 1: celebration state
# ------------------------------------------------------------------
js = replace_once(
    js,
    """    const academySquadMissionHistoryPromisesV1 =
        new Map();
    /* END PATCH: Shared Squad Missions UI state v1 */""",
    """    const academySquadMissionHistoryPromisesV1 =
        new Map();

    const ACADEMY_SQUAD_MISSION_CELEBRATION_KEY_V1 =
        'yh_academy_squad_mission_celebrations_seen_v1';

    const academySquadMissionCelebrationQueueV1 =
        [];

    let academySquadMissionCelebrationActiveV1 =
        false;

    let academySquadMissionCelebrationCurrentIdV1 =
        '';
    /* END PATCH: Shared Squad Missions UI state v1 */""",
    'Dashboard celebration state',
)

# ------------------------------------------------------------------
# JS 2: celebration engine
# ------------------------------------------------------------------
celebration_engine = r'''        document.body.setAttribute('data-yh-game-foundation', 'ready');

        return true;
    }

    /* PATCH: Squad Mission completion celebration v1 */

    function readSeenSquadMissionCelebrationsV1() {
        try {
            const parsed =
                JSON.parse(
                    sessionStorage.getItem(
                        ACADEMY_SQUAD_MISSION_CELEBRATION_KEY_V1
                    ) || '[]'
                );

            return new Set(
                Array.isArray(parsed)
                    ? parsed
                        .map((value) =>
                            String(value || '').trim()
                        )
                        .filter(Boolean)
                    : []
            );
        } catch (_) {
            return new Set();
        }
    }

    function markSquadMissionCelebrationSeenV1(
        missionId = ''
    ) {
        const cleanMissionId =
            String(missionId || '').trim();

        if (!cleanMissionId) {
            return;
        }

        try {
            const seen =
                readSeenSquadMissionCelebrationsV1();

            seen.add(cleanMissionId);

            sessionStorage.setItem(
                ACADEMY_SQUAD_MISSION_CELEBRATION_KEY_V1,
                JSON.stringify(
                    Array.from(seen).slice(-50)
                )
            );
        } catch (_) {}
    }

    function collectCompletedSquadMissionsV1(
        detail = {}
    ) {
        const completedById =
            new Map();

        const visited =
            new Set();

        const roots = [
            detail?.squadMissionProgress,
            detail?.squadXp
                ?.squadMissionProgress
        ];

        const visit = (
            value,
            depth = 0
        ) => {
            if (
                value === null ||
                value === undefined ||
                depth > 7
            ) {
                return;
            }

            if (Array.isArray(value)) {
                value.forEach((entry) => {
                    visit(entry, depth + 1);
                });

                return;
            }

            if (
                typeof value !== 'object' ||
                visited.has(value)
            ) {
                return;
            }

            visited.add(value);

            const missionId =
                String(
                    value.missionId ||
                    ''
                ).trim();

            const status =
                String(
                    value.status ||
                    ''
                )
                    .trim()
                    .toLowerCase();

            const completed =
                value.completed === true ||
                status === 'completed';

            if (
                missionId &&
                completed
            ) {
                const localMission =
                    academySquadMissionsStateV1
                        .missions
                        .find((mission) => {
                            return (
                                String(
                                    mission.id ||
                                    ''
                                ).trim() ===
                                missionId
                            );
                        }) ||
                    {};

                const rewardXp =
                    Math.max(
                        0,
                        Number(
                            value.reward
                                ?.awarded ??
                            localMission
                                .rewardXp ??
                            value.rewardXp ??
                            0
                        ) || 0
                    );

                completedById.set(
                    missionId,
                    {
                        missionId,

                        missionTitle:
                            String(
                                value.missionTitle ||
                                localMission.title ||
                                'Squad Mission'
                            ).trim(),

                        missionType:
                            String(
                                localMission.missionType ||
                                value.missionType ||
                                ''
                            ).trim(),

                        progress:
                            Math.max(
                                0,
                                Number(
                                    value.progress ??
                                    localMission.progress ??
                                    0
                                ) || 0
                            ),

                        target:
                            Math.max(
                                1,
                                Number(
                                    value.target ??
                                    localMission.target ??
                                    1
                                ) || 1
                            ),

                        rewardXp,

                        completedAt:
                            String(
                                localMission.completedAt ||
                                detail.occurredAt ||
                                new Date()
                                    .toISOString()
                            ).trim()
                    }
                );
            }

            Object.values(value)
                .forEach((entry) => {
                    visit(entry, depth + 1);
                });
        };

        roots.forEach((root) => {
            visit(root, 0);
        });

        return Array.from(
            completedById.values()
        );
    }

    function ensureSquadMissionCelebrationV1() {
        let overlay =
            document.getElementById(
                'yh-game-squad-celebration'
            );

        if (overlay) {
            return overlay;
        }

        overlay =
            document.createElement('div');

        overlay.id =
            'yh-game-squad-celebration';

        overlay.className =
            'yh-game-squad-celebration hidden-step';

        overlay.setAttribute(
            'role',
            'dialog'
        );

        overlay.setAttribute(
            'aria-modal',
            'true'
        );

        overlay.setAttribute(
            'aria-hidden',
            'true'
        );

        overlay.innerHTML = `
            <div class="yh-game-squad-celebration-card">
                <button
                    type="button"
                    class="yh-game-squad-celebration-close"
                    data-yh-squad-celebration-close
                    aria-label="Close celebration"
                >
                    ×
                </button>

                <div
                    id="yh-game-squad-celebration-content"
                ></div>
            </div>
        `;

        document.body.appendChild(
            overlay
        );

        overlay.addEventListener(
            'click',
            (event) => {
                const closeButton =
                    event.target
                        ?.closest?.(
                            '[data-yh-squad-celebration-close]'
                        );

                if (closeButton) {
                    closeSquadMissionCelebrationV1();
                    return;
                }

                const historyButton =
                    event.target
                        ?.closest?.(
                            '[data-yh-squad-celebration-history]'
                        );

                if (historyButton) {
                    const missionId =
                        String(
                            historyButton.getAttribute(
                                'data-yh-squad-celebration-history'
                            ) || ''
                        ).trim();

                    closeSquadMissionCelebrationV1({
                        advanceQueue: false
                    });

                    if (missionId) {
                        void openSquadMissionHistoryV1(
                            missionId,
                            {
                                force: true
                            }
                        );
                    }

                    return;
                }

                if (event.target === overlay) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        );

        return overlay;
    }

    function closeSquadMissionCelebrationV1({
        advanceQueue = true
    } = {}) {
        const overlay =
            document.getElementById(
                'yh-game-squad-celebration'
            );

        overlay?.classList.add(
            'hidden-step'
        );

        overlay?.setAttribute(
            'aria-hidden',
            'true'
        );

        document.body.classList.remove(
            'yh-game-squad-celebration-open'
        );

        academySquadMissionCelebrationActiveV1 =
            false;

        academySquadMissionCelebrationCurrentIdV1 =
            '';

        if (!advanceQueue) {
            academySquadMissionCelebrationQueueV1
                .splice(0);
            return;
        }

        window.setTimeout(() => {
            void showNextSquadMissionCelebrationV1();
        }, 140);
    }

    function buildSquadCelebrationContributorsV1(
        contributors = []
    ) {
        const list =
            Array.isArray(contributors)
                ? contributors.slice(0, 3)
                : [];

        if (!list.length) {
            return `
                <span class="yh-game-squad-celebration-contributor-empty">
                    Contributor summary will appear in Mission History.
                </span>
            `;
        }

        return list
            .map((contributor) => {
                return `
                    <span class="yh-game-squad-celebration-contributor">
                        <b>
                            ${escapeHtml(
                                contributor.displayName ||
                                'YH Member'
                            )}
                        </b>

                        <small>
                            +${Number(
                                contributor.amount ||
                                0
                            ).toLocaleString()}
                        </small>
                    </span>
                `;
            })
            .join('');
    }

    async function showNextSquadMissionCelebrationV1() {
        if (
            academySquadMissionCelebrationActiveV1 ||
            !academySquadMissionCelebrationQueueV1.length
        ) {
            return;
        }

        const seen =
            readSeenSquadMissionCelebrationsV1();

        let celebration = null;

        while (
            academySquadMissionCelebrationQueueV1.length &&
            !celebration
        ) {
            const candidate =
                academySquadMissionCelebrationQueueV1.shift();

            if (
                candidate?.missionId &&
                !seen.has(candidate.missionId)
            ) {
                celebration =
                    candidate;
            }
        }

        if (!celebration) {
            return;
        }

        const overlay =
            ensureSquadMissionCelebrationV1();

        const content =
            overlay.querySelector(
                '#yh-game-squad-celebration-content'
            );

        const squad =
            window.YHUGameCore
                ?.getAcademySquadSnapshotV1?.() ||
            {};

        academySquadMissionCelebrationActiveV1 =
            true;

        academySquadMissionCelebrationCurrentIdV1 =
            celebration.missionId;

        markSquadMissionCelebrationSeenV1(
            celebration.missionId
        );

        if (content) {
            content.innerHTML = `
                <div
                    class="yh-game-squad-celebration-particles"
                    aria-hidden="true"
                >
                    <i></i><i></i><i></i><i></i>
                    <i></i><i></i><i></i><i></i>
                </div>

                <div class="yh-game-squad-celebration-emblem">
                    <span>${escapeHtml(
                        squad.emblem || '⚡'
                    )}</span>
                </div>

                <div class="yh-game-squad-celebration-kicker">
                    Squad Mission Complete
                </div>

                <h2>
                    ${escapeHtml(
                        celebration.missionTitle ||
                        'Squad Mission'
                    )}
                </h2>

                <p class="yh-game-squad-celebration-copy">
                    ${escapeHtml(
                        squad.name ||
                        'Your Squad'
                    )}
                    reached the shared target through verified member activity.
                </p>

                <div class="yh-game-squad-celebration-reward">
                    <small>Squad Reward</small>

                    <strong>
                        ${
                            celebration.rewardXp > 0
                                ? `+${Number(
                                    celebration.rewardXp
                                ).toLocaleString()}`
                                : 'Complete'
                        }
                    </strong>

                    <span>
                        ${
                            celebration.rewardXp > 0
                                ? 'Squad XP'
                                : 'Mission cleared'
                        }
                    </span>
                </div>

                <div class="yh-game-squad-celebration-stats">
                    <div>
                        <small>Final Progress</small>
                        <strong>
                            ${Number(
                                celebration.progress ||
                                celebration.target ||
                                0
                            ).toLocaleString()}
                            /
                            ${Number(
                                celebration.target ||
                                1
                            ).toLocaleString()}
                        </strong>
                    </div>

                    <div>
                        <small>Completed</small>
                        <strong>
                            ${escapeHtml(
                                formatSquadContributionTimeV1(
                                    celebration.completedAt
                                )
                            )}
                        </strong>
                    </div>
                </div>

                <div class="yh-game-squad-celebration-team">
                    <small>Top Contributors</small>

                    <div
                        class="yh-game-squad-celebration-contributors"
                        data-yh-squad-celebration-contributors
                    >
                        <span class="yh-game-squad-celebration-contributor-empty">
                            Loading contributor summary...
                        </span>
                    </div>
                </div>

                <div class="yh-game-squad-celebration-actions">
                    <button
                        type="button"
                        class="yh-game-squad-celebration-secondary"
                        data-yh-squad-celebration-history="${escapeHtml(
                            celebration.missionId
                        )}"
                    >
                        View Mission History
                    </button>

                    <button
                        type="button"
                        class="yh-game-squad-celebration-primary"
                        data-yh-squad-celebration-close
                    >
                        Continue
                    </button>
                </div>
            `;
        }

        overlay.classList.remove(
            'hidden-step'
        );

        overlay.setAttribute(
            'aria-hidden',
            'false'
        );

        document.body.classList.add(
            'yh-game-squad-celebration-open'
        );

        overlay
            .querySelector(
                '.yh-game-squad-celebration-primary'
            )
            ?.focus();

        try {
            const history =
                await loadSquadMissionHistoryV1(
                    celebration.missionId,
                    {
                        force: true
                    }
                );

            if (
                academySquadMissionCelebrationCurrentIdV1 !==
                celebration.missionId
            ) {
                return;
            }

            const contributorContainer =
                overlay.querySelector(
                    '[data-yh-squad-celebration-contributors]'
                );

            if (contributorContainer) {
                contributorContainer.innerHTML =
                    buildSquadCelebrationContributorsV1(
                        history?.contributors ||
                        []
                    );
            }
        } catch (_) {
            const contributorContainer =
                overlay.querySelector(
                    '[data-yh-squad-celebration-contributors]'
                );

            if (contributorContainer) {
                contributorContainer.innerHTML =
                    buildSquadCelebrationContributorsV1(
                        []
                    );
            }
        }
    }

    function queueSquadMissionCelebrationsV1(
        detail = {}
    ) {
        const seen =
            readSeenSquadMissionCelebrationsV1();

        const completions =
            collectCompletedSquadMissionsV1(
                detail
            );

        completions.forEach((completion) => {
            const alreadyQueued =
                academySquadMissionCelebrationQueueV1
                    .some((entry) => {
                        return (
                            entry.missionId ===
                            completion.missionId
                        );
                    });

            if (
                !completion.missionId ||
                seen.has(completion.missionId) ||
                alreadyQueued ||
                academySquadMissionCelebrationCurrentIdV1 ===
                    completion.missionId
            ) {
                return;
            }

            academySquadMissionCelebrationQueueV1
                .push(completion);
        });

        void showNextSquadMissionCelebrationV1();

        return completions;
    }

    /* END PATCH: Squad Mission completion celebration v1 */

    /* PATCH: Academy Squad live synchronization v1 */'''

js = replace_once(
    js,
    """        document.body.setAttribute('data-yh-game-foundation', 'ready');

        return true;
    }
    /* PATCH: Academy Squad live synchronization v1 */""",
    celebration_engine,
    'Dashboard celebration engine insertion',
)

# ------------------------------------------------------------------
# JS 3: trigger celebration after the guaranteed live refresh
# ------------------------------------------------------------------
js = replace_once(
    js,
    """        if (
            data.type ===
            'yhu:academy-squad-action-completed'
        ) {
            void refreshAcademySquadLiveStateV1(
                data
            );
        }""",
    """        if (
            data.type ===
            'yhu:academy-squad-action-completed'
        ) {
            void refreshAcademySquadLiveStateV1(
                data
            )
                .catch(() => false)
                .then(() => {
                    queueSquadMissionCelebrationsV1(
                        data
                    );
                });
        }""",
    'Dashboard live completion trigger',
)

# ------------------------------------------------------------------
# CSS: celebration overlay
# ------------------------------------------------------------------
celebration_css = r'''

/* =========================================================
   Squad Mission completion celebration v1
   ========================================================= */

body.yh-game-squad-celebration-open {
    overflow: hidden;
}

.yh-game-squad-celebration {
    position: fixed;
    inset: 0;
    z-index: 3400;
    display: grid;
    place-items: center;
    padding: 20px;
    background:
        radial-gradient(
            circle at 50% 34%,
            rgba(34, 211, 238, 0.14),
            transparent 34%
        ),
        rgba(1, 5, 17, 0.82);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}

.yh-game-squad-celebration.hidden-step {
    display: none;
}

.yh-game-squad-celebration-card {
    position: relative;
    width: min(100%, 640px);
    max-height: min(92vh, 820px);
    max-height: min(92dvh, 820px);
    overflow-x: hidden;
    overflow-y: auto;
    padding: clamp(26px, 4vw, 42px);
    border: 1px solid rgba(103, 232, 249, 0.42);
    border-radius: 22px;
    background:
        radial-gradient(
            circle at 50% 0,
            rgba(56, 189, 248, 0.22),
            transparent 40%
        ),
        radial-gradient(
            circle at 100% 100%,
            rgba(99, 102, 241, 0.18),
            transparent 42%
        ),
        linear-gradient(
            155deg,
            rgba(8, 23, 48, 0.99),
            rgba(2, 8, 23, 0.99)
        );
    color: #f8fbff;
    text-align: center;
    box-shadow:
        0 36px 100px rgba(0, 0, 0, 0.66),
        0 0 50px rgba(34, 211, 238, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
    animation:
        yhGameSquadCelebrationEnterV1
        420ms
        cubic-bezier(0.16, 1, 0.3, 1)
        both;
    scrollbar-width: thin;
    scrollbar-color:
        #38bdf8
        rgba(2, 8, 23, 0.72);
}

.yh-game-squad-celebration-card::-webkit-scrollbar {
    width: 8px;
}

.yh-game-squad-celebration-card::-webkit-scrollbar-track {
    border-radius: 999px;
    background: rgba(2, 8, 23, 0.72);
}

.yh-game-squad-celebration-card::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background:
        linear-gradient(
            180deg,
            #67e8f9,
            #38bdf8,
            #2563eb
        );
}

.yh-game-squad-celebration-close {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 4;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(148, 163, 184, 0.24);
    border-radius: 10px;
    background: rgba(15, 23, 42, 0.72);
    color: #cbd5e1;
    font: inherit;
    font-size: 1.15rem;
    cursor: pointer;
}

.yh-game-squad-celebration-emblem {
    position: relative;
    width: 94px;
    height: 94px;
    display: grid;
    place-items: center;
    margin: 0 auto 18px;
    border: 1px solid rgba(103, 232, 249, 0.5);
    border-radius: 28px;
    background:
        radial-gradient(
            circle,
            rgba(103, 232, 249, 0.24),
            rgba(14, 116, 144, 0.14)
        );
    box-shadow:
        0 0 0 10px rgba(56, 189, 248, 0.05),
        0 0 42px rgba(56, 189, 248, 0.3);
    animation:
        yhGameSquadCelebrationPulseV1
        1.8s
        ease-in-out
        infinite;
}

.yh-game-squad-celebration-emblem span {
    font-size: 2.55rem;
    filter: drop-shadow(
        0 0 12px
        rgba(103, 232, 249, 0.5)
    );
}

.yh-game-squad-celebration-kicker {
    color: #67e8f9;
    font-family: "Orbitron", sans-serif;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

.yh-game-squad-celebration-card h2 {
    margin: 8px 0 6px;
    color: #ffffff;
    font-family: "Rajdhani", "Poppins", sans-serif;
    font-size: clamp(2rem, 5vw, 3rem);
    line-height: 1;
}

.yh-game-squad-celebration-copy {
    max-width: 520px;
    margin: 0 auto 20px;
    color: #aebbd1;
    font-size: 0.9rem;
    line-height: 1.58;
}

.yh-game-squad-celebration-reward {
    display: grid;
    place-items: center;
    gap: 2px;
    width: min(100%, 280px);
    margin: 0 auto 18px;
    padding: 17px 20px;
    border: 1px solid rgba(250, 204, 21, 0.28);
    border-radius: 16px;
    background:
        linear-gradient(
            135deg,
            rgba(161, 98, 7, 0.18),
            rgba(30, 41, 59, 0.35)
        );
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 0 28px rgba(250, 204, 21, 0.08);
}

.yh-game-squad-celebration-reward small {
    color: #fde68a;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.yh-game-squad-celebration-reward strong {
    color: #fef3c7;
    font-family: "Orbitron", sans-serif;
    font-size: 2rem;
    line-height: 1.15;
}

.yh-game-squad-celebration-reward span {
    color: #facc15;
    font-size: 0.78rem;
    font-weight: 700;
}

.yh-game-squad-celebration-stats {
    display: grid;
    grid-template-columns:
        repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 16px;
}

.yh-game-squad-celebration-stats > div,
.yh-game-squad-celebration-team {
    display: grid;
    gap: 5px;
    padding: 13px;
    border: 1px solid rgba(148, 163, 184, 0.16);
    border-radius: 11px;
    background: rgba(2, 8, 23, 0.42);
    text-align: left;
}

.yh-game-squad-celebration-stats small,
.yh-game-squad-celebration-team > small {
    color: #94a3b8;
    font-size: 0.67rem;
    text-transform: uppercase;
}

.yh-game-squad-celebration-stats strong {
    color: #e0f2fe;
    font-size: 0.82rem;
}

.yh-game-squad-celebration-team {
    margin-bottom: 18px;
}

.yh-game-squad-celebration-contributors {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
}

.yh-game-squad-celebration-contributor {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 9px;
    border: 1px solid rgba(103, 232, 249, 0.18);
    border-radius: 999px;
    background: rgba(14, 116, 144, 0.1);
}

.yh-game-squad-celebration-contributor b {
    max-width: 180px;
    overflow: hidden;
    color: #dbeafe;
    font-size: 0.72rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.yh-game-squad-celebration-contributor small {
    color: #67e8f9;
    font-size: 0.68rem;
    font-weight: 800;
}

.yh-game-squad-celebration-contributor-empty {
    color: #64748b;
    font-size: 0.72rem;
}

.yh-game-squad-celebration-actions {
    display: grid;
    grid-template-columns:
        repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.yh-game-squad-celebration-primary,
.yh-game-squad-celebration-secondary {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    border-radius: 10px;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
    transition:
        transform 150ms ease,
        border-color 150ms ease,
        background 150ms ease;
}

.yh-game-squad-celebration-primary {
    border: 1px solid rgba(103, 232, 249, 0.58);
    background:
        linear-gradient(
            180deg,
            rgba(14, 116, 144, 0.95),
            rgba(8, 47, 73, 0.98)
        );
    color: #ecfeff;
}

.yh-game-squad-celebration-secondary {
    border: 1px solid rgba(148, 163, 184, 0.28);
    background: rgba(15, 23, 42, 0.72);
    color: #dbeafe;
}

.yh-game-squad-celebration-primary:hover,
.yh-game-squad-celebration-secondary:hover {
    transform: translateY(-1px);
    border-color: rgba(103, 232, 249, 0.75);
}

.yh-game-squad-celebration-particles {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
}

.yh-game-squad-celebration-particles i {
    position: absolute;
    top: 16%;
    left: 50%;
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: #67e8f9;
    opacity: 0;
    animation:
        yhGameSquadCelebrationParticleV1
        1.6s
        ease-out
        infinite;
}

.yh-game-squad-celebration-particles i:nth-child(2) {
    --x: 185px;
    --y: 88px;
    background: #facc15;
    animation-delay: 100ms;
}

.yh-game-squad-celebration-particles i:nth-child(3) {
    --x: -195px;
    --y: 115px;
    background: #818cf8;
    animation-delay: 180ms;
}

.yh-game-squad-celebration-particles i:nth-child(4) {
    --x: 145px;
    --y: 190px;
    background: #86efac;
    animation-delay: 260ms;
}

.yh-game-squad-celebration-particles i:nth-child(5) {
    --x: -150px;
    --y: 205px;
    background: #f472b6;
    animation-delay: 340ms;
}

.yh-game-squad-celebration-particles i:nth-child(6) {
    --x: 220px;
    --y: 250px;
    background: #38bdf8;
    animation-delay: 420ms;
}

.yh-game-squad-celebration-particles i:nth-child(7) {
    --x: -225px;
    --y: 270px;
    background: #fde68a;
    animation-delay: 500ms;
}

.yh-game-squad-celebration-particles i:nth-child(8) {
    --x: 45px;
    --y: 290px;
    background: #c4b5fd;
    animation-delay: 580ms;
}

.yh-game-squad-celebration-particles i:nth-child(1) {
    --x: -45px;
    --y: 75px;
}

@keyframes yhGameSquadCelebrationEnterV1 {
    from {
        opacity: 0;
        transform:
            translateY(18px)
            scale(0.94);
    }

    to {
        opacity: 1;
        transform:
            translateY(0)
            scale(1);
    }
}

@keyframes yhGameSquadCelebrationPulseV1 {
    0%,
    100% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.045);
    }
}

@keyframes yhGameSquadCelebrationParticleV1 {
    0% {
        opacity: 0;
        transform:
            translate(-50%, 0)
            rotate(0deg)
            scale(0.5);
    }

    18% {
        opacity: 1;
    }

    100% {
        opacity: 0;
        transform:
            translate(
                calc(-50% + var(--x, 80px)),
                var(--y, 140px)
            )
            rotate(240deg)
            scale(1);
    }
}

@media (max-width: 640px) {
    .yh-game-squad-celebration {
        padding: 10px;
    }

    .yh-game-squad-celebration-card {
        max-height: 94vh;
        max-height: 94dvh;
        padding: 28px 17px 20px;
        border-radius: 17px;
    }

    .yh-game-squad-celebration-emblem {
        width: 78px;
        height: 78px;
        border-radius: 23px;
    }

    .yh-game-squad-celebration-emblem span {
        font-size: 2rem;
    }

    .yh-game-squad-celebration-stats,
    .yh-game-squad-celebration-actions {
        grid-template-columns: 1fr;
    }
}

@media (prefers-reduced-motion: reduce) {
    .yh-game-squad-celebration-card,
    .yh-game-squad-celebration-emblem,
    .yh-game-squad-celebration-particles i {
        animation: none;
    }
}

/* END Squad Mission completion celebration v1 */
'''

css = css.rstrip() + celebration_css + '\n'

# ------------------------------------------------------------------
# HTML cache busting
# ------------------------------------------------------------------
html = replace_once(
    html,
    '<link rel="stylesheet" href="/css/yhu-game-system.css?v=20260720-squad-history-ui-v1">',
    f'<link rel="stylesheet" href="/css/yhu-game-system.css?v={CACHE_VERSION}">',
    'Game CSS cache tag',
)

html = replace_once(
    html,
    '<script src="/js/yhu-game-dashboard.js?v=20260720-squad-history-ui-v1"></script>',
    f'<script src="/js/yhu-game-dashboard.js?v={CACHE_VERSION}"></script>',
    'Game Dashboard JS cache tag',
)

JS_PATH.write_text(js, encoding='utf-8')
CSS_PATH.write_text(css, encoding='utf-8')
HTML_PATH.write_text(html, encoding='utf-8')

print('Phase 3C.4A patched successfully.')
for path in (JS_PATH, CSS_PATH, HTML_PATH):
    print(f'Updated: {path}')
for path in backups:
    print(f'Backup: {path}')
