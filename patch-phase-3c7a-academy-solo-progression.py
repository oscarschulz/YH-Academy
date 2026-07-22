#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path.cwd()
CONTROLLER = ROOT / "academyControllers.js"
REPO = ROOT / "backend" / "repositories" / "academySupabaseRepo.js"

STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUPS: list[tuple[Path, Path]] = []


def rollback() -> None:
    if not BACKUPS:
        return

    print("\nRestoring backups...")

    for original, backup_path in reversed(BACKUPS):
        if backup_path.exists():
            shutil.copy2(backup_path, original)
            print(f"Restored: {original}")


def fail(message: str) -> None:
    print(f"\nERROR: {message}", file=sys.stderr)
    rollback()
    raise SystemExit(1)


def backup(path: Path) -> None:
    backup_path = path.with_name(
        f"{path.name}.backup-phase-3c7a-{STAMP}"
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


for required in (CONTROLLER, REPO):
    if not required.exists():
        fail(f"Missing required file: {required}")

backup(CONTROLLER)
backup(REPO)

controller, controller_newline = read_normalized(CONTROLLER)
repo, repo_newline = read_normalized(REPO)

repo = replace_once(
    repo,
    """    if (recordType === 'academyXpEvents') {
        return `${userRoot}/academyXpEvents`;
    }

    return `${userRoot}/academy`;
}
""",
    """    if (recordType === 'academyXpEvents') {
        return `${userRoot}/academyXpEvents`;
    }

    if (recordType === 'academySoloEvents') {
        return `${userRoot}/academySoloEvents`;
    }

    return `${userRoot}/academy`;
}
""",
    "Academy Solo event collection path"
)

repo = replace_once(
    repo,
    """const ACADEMY_PROGRESSION_RECORD_TYPE = 'academy:progression';
const ACADEMY_XP_EVENT_RECORD_TYPE = 'academyXpEvents';
const ACADEMY_PROGRESSION_DOC_ID = 'progression';

function academyProgressionRankFromXpV1(xp = 0) {
""",
    """const ACADEMY_PROGRESSION_RECORD_TYPE = 'academy:progression';
const ACADEMY_XP_EVENT_RECORD_TYPE = 'academyXpEvents';
const ACADEMY_SOLO_EVENT_RECORD_TYPE = 'academySoloEvents';
const ACADEMY_PROGRESSION_DOC_ID = 'progression';

const ACADEMY_SOLO_ATTRIBUTE_KEYS_V1 = Object.freeze([
    'discipline',
    'health',
    'wealth',
    'mindset',
    'communication',
    'knowledge',
    'politics',
    'philosophy'
]);

const ACADEMY_SOLO_ATTRIBUTE_LABELS_V1 = Object.freeze({
    discipline: 'Discipline',
    health: 'Health',
    wealth: 'Wealth',
    mindset: 'Mindset',
    communication: 'Communication',
    knowledge: 'Knowledge',
    politics: 'Politics',
    philosophy: 'Philosophy'
});

function academySoloEmptyAttributesV1() {
    return ACADEMY_SOLO_ATTRIBUTE_KEYS_V1.reduce(
        (out, key) => {
            out[key] = 0;
            return out;
        },
        {}
    );
}

function academySoloMissionTextV1(mission = {}) {
    return [
        mission.pillar,
        ...(Array.isArray(mission.lifeAreaImpact)
            ? mission.lifeAreaImpact
            : []),
        mission.title,
        mission.description,
        mission.doneLooksLike,
        mission.whyItMatters,
        mission.missionObjective,
        ...(Array.isArray(mission.microActions)
            ? mission.microActions
            : []),
        mission.proofOfCompletion,
        mission.reflectionPrompt
    ]
        .map((value) => sanitizeString(value).toLowerCase())
        .filter(Boolean)
        .join(' ');
}

function academySoloMissionAttributesV1(mission = {}) {
    const scores = academySoloEmptyAttributesV1();
    const text = academySoloMissionTextV1(mission);
    const pillar = sanitizeString(mission.pillar).toLowerCase();

    const add = (key, amount) => {
        if (!ACADEMY_SOLO_ATTRIBUTE_KEYS_V1.includes(key)) {
            return;
        }

        scores[key] += Math.max(0, toNumber(amount, 0));
    };

    const pillarRules = [
        {
            test: /self[\\s_-]*mastery/,
            values: {
                discipline: 8,
                mindset: 5
            }
        },
        {
            test: /discipline|execution|consistency/,
            values: {
                discipline: 10
            }
        },
        {
            test: /health|fitness|body|energy|recovery/,
            values: {
                health: 10,
                discipline: 2
            }
        },
        {
            test: /wealth|money|business|income|sales/,
            values: {
                wealth: 10,
                communication: 2
            }
        },
        {
            test: /mindset|psychology|mental|emotional/,
            values: {
                mindset: 10,
                discipline: 2
            }
        },
        {
            test: /communication|networking|relationship/,
            values: {
                communication: 10
            }
        },
        {
            test: /knowledge|learning|education|study/,
            values: {
                knowledge: 10
            }
        },
        {
            test: /politic|governance|policy|geopolit/,
            values: {
                politics: 10,
                knowledge: 3
            }
        },
        {
            test: /philosoph|ethics|logic|meaning|truth/,
            values: {
                philosophy: 10,
                mindset: 3
            }
        }
    ];

    for (const rule of pillarRules) {
        if (!rule.test.test(pillar)) continue;

        for (const [key, value] of Object.entries(rule.values)) {
            add(key, value);
        }
    }

    const keywordRules = {
        discipline: [
            'discipline',
            'consistent',
            'consistency',
            'habit',
            'routine',
            'focus',
            'self-control',
            'self control',
            'standard',
            'execution',
            'procrast',
            'distraction',
            'saying no',
            'weak pattern',
            'self mastery'
        ],
        health: [
            'health',
            'fitness',
            'sleep',
            'energy',
            'body',
            'workout',
            'exercise',
            'smoking',
            'recovery',
            'nutrition',
            'walk'
        ],
        wealth: [
            'wealth',
            'money',
            'income',
            'business',
            'client',
            'lead',
            'sales',
            'offer',
            'revenue',
            'finance',
            'entrepreneur'
        ],
        mindset: [
            'mindset',
            'psychology',
            'mental',
            'emotional',
            'confidence',
            'fear',
            'belief',
            'resilience',
            'self-awareness',
            'self awareness',
            'reflection'
        ],
        communication: [
            'communication',
            'networking',
            'outreach',
            'conversation',
            'speaking',
            'writing',
            'relationship',
            'connect',
            'message',
            'explain'
        ],
        knowledge: [
            'knowledge',
            'learn',
            'study',
            'research',
            'reading',
            'analysis',
            'skill',
            'understand',
            'framework'
        ],
        politics: [
            'politics',
            'political',
            'policy',
            'governance',
            'geopolit',
            'election',
            'institution',
            'agenda 2030'
        ],
        philosophy: [
            'philosophy',
            'philosophical',
            'ethics',
            'meaning',
            'purpose',
            'logic',
            'truth',
            'argument',
            'worldview'
        ]
    };

    for (const [key, keywords] of Object.entries(keywordRules)) {
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                add(key, 1);
            }
        }
    }

    let ranked = Object.entries(scores)
        .filter(([, score]) => score > 0)
        .sort((a, b) => (
            b[1] - a[1] ||
            ACADEMY_SOLO_ATTRIBUTE_KEYS_V1.indexOf(a[0]) -
            ACADEMY_SOLO_ATTRIBUTE_KEYS_V1.indexOf(b[0])
        ));

    if (!ranked.length) {
        ranked = [
            ['discipline', 1],
            ['mindset', 1]
        ];
    }

    const attributes = academySoloEmptyAttributesV1();
    const primaryAttribute = ranked[0][0];
    const secondaryAttribute = ranked[1]?.[0] || '';

    if (secondaryAttribute) {
        attributes[primaryAttribute] = 3;
        attributes[secondaryAttribute] = 2;
    } else {
        attributes[primaryAttribute] = 5;
    }

    return {
        attributes,
        primaryAttribute,
        secondaryAttribute,
        growthPoints: 5
    };
}

async function recordAcademySoloMissionCompletionV1(
    uid = '',
    mission = {}
) {
    const cleanUid = sanitizeString(uid);
    const missionId = sanitizeString(mission.id);
    const status = sanitizeString(mission.status).toLowerCase();
    const verificationDecision = sanitizeString(
        mission.verificationDecision ||
        mission.verificationStatus
    ).toLowerCase();

    if (!cleanUid || !missionId) {
        return {
            ok: false,
            created: false,
            skipped: true,
            reason: 'missing_event_identity'
        };
    }

    if (
        status !== 'completed' ||
        verificationDecision !== 'approved'
    ) {
        return {
            ok: true,
            created: false,
            skipped: true,
            reason: 'mission_not_ai_verified'
        };
    }

    const eventType = 'roadmap_mission_completed';
    const eventId = academyProgressionSafeEventIdV1(
        `${eventType}:${missionId}`
    );

    const existingRow = await getOne(
        ACADEMY_SOLO_EVENT_RECORD_TYPE,
        cleanUid,
        eventId
    ).catch(() => null);

    if (existingRow) {
        return {
            ok: true,
            created: false,
            skipped: false,
            event: rowData(existingRow)
        };
    }

    const growth = academySoloMissionAttributesV1(mission);
    const timestamp = (
        toIso(
            mission.verificationCompletedAt ||
            mission.completedAt ||
            mission.updatedAt
        ) ||
        nowIso()
    );

    const payload = {
        id: eventId,
        eventId,
        userId: cleanUid,
        division: 'academy',
        mode: 'solo',
        eventType,
        sourceId: missionId,
        sourceType: 'academyMission',
        roadmapId: sanitizeString(mission.roadmapId),
        growthPoints: growth.growthPoints,
        attributes: growth.attributes,
        primaryAttribute: growth.primaryAttribute,
        secondaryAttribute: growth.secondaryAttribute,
        eventAt: timestamp,
        metadata: {
            title: sanitizeString(mission.title),
            pillar: sanitizeString(mission.pillar),
            difficultyLevel: sanitizeString(
                mission.difficultyLevel ||
                'standard'
            ),
            verificationConfidence: Math.max(
                0,
                Math.min(
                    1,
                    toNumber(
                        mission.verificationConfidence,
                        0
                    )
                )
            ),
            verificationProvider: sanitizeString(
                mission.verificationProvider
            ),
            verificationModel: sanitizeString(
                mission.verificationModel
            )
        },
        createdAt: timestamp,
        updatedAt: timestamp
    };

    const saved = await upsertRecord(
        ACADEMY_SOLO_EVENT_RECORD_TYPE,
        cleanUid,
        eventId,
        payload,
        {
            insertOnly: true
        }
    );

    if (!saved) {
        const concurrentRow = await getOne(
            ACADEMY_SOLO_EVENT_RECORD_TYPE,
            cleanUid,
            eventId
        ).catch(() => null);

        return {
            ok: true,
            created: false,
            skipped: false,
            event: rowData(concurrentRow)
        };
    }

    return {
        ok: true,
        created: true,
        skipped: false,
        event: rowData(saved)
    };
}

async function listAcademySoloEventsV1(
    uid = '',
    limit = 500
) {
    const rows = await getRows(
        ACADEMY_SOLO_EVENT_RECORD_TYPE,
        uid,
        {
            limit: Math.max(
                1,
                Math.min(
                    500,
                    Number(limit) || 500
                )
            )
        }
    );

    return rows.map((row) => ({
        ...rowData(row),
        id:
            rowData(row).id ||
            row.source_document_id ||
            ''
    }));
}

function buildAcademySoloModeSummaryV1({
    activeRoadmap = null,
    missions = [],
    events = []
} = {}) {
    const attributes = academySoloEmptyAttributesV1();
    const currentMissionIds = new Set(
        (Array.isArray(missions) ? missions : [])
            .map((mission) => sanitizeString(mission?.id))
            .filter(Boolean)
    );

    const verifiedMissionIds = new Set();
    const currentCampaignMissionIds = new Set();
    let totalGrowthPoints = 0;

    for (const event of Array.isArray(events) ? events : []) {
        if (
            sanitizeString(event?.eventType) !==
            'roadmap_mission_completed'
        ) {
            continue;
        }

        const sourceId = sanitizeString(event?.sourceId);

        if (sourceId) {
            verifiedMissionIds.add(sourceId);

            if (currentMissionIds.has(sourceId)) {
                currentCampaignMissionIds.add(sourceId);
            }
        }

        const eventAttributes =
            event?.attributes &&
            typeof event.attributes === 'object'
                ? event.attributes
                : {};

        for (const key of ACADEMY_SOLO_ATTRIBUTE_KEYS_V1) {
            attributes[key] += Math.max(
                0,
                Math.round(
                    toNumber(
                        eventAttributes[key],
                        0
                    )
                )
            );
        }

        totalGrowthPoints += Math.max(
            0,
            Math.round(
                toNumber(
                    event?.growthPoints,
                    Object.values(eventAttributes)
                        .reduce(
                            (sum, value) =>
                                sum +
                                Math.max(
                                    0,
                                    toNumber(value, 0)
                                ),
                            0
                        )
                )
            )
        );
    }

    const total = currentMissionIds.size;
    const completed = currentCampaignMissionIds.size;
    const percentage =
        total > 0
            ? Math.max(
                0,
                Math.min(
                    100,
                    Math.round(
                        (completed / total) * 100
                    )
                )
            )
            : 0;

    const strongestEntry = Object.entries(attributes)
        .sort((a, b) => (
            b[1] - a[1] ||
            ACADEMY_SOLO_ATTRIBUTE_KEYS_V1.indexOf(a[0]) -
            ACADEMY_SOLO_ATTRIBUTE_KEYS_V1.indexOf(b[0])
        ))[0] || ['', 0];

    const strongestGrowthArea =
        strongestEntry[1] > 0
            ? {
                key: strongestEntry[0],
                label:
                    ACADEMY_SOLO_ATTRIBUTE_LABELS_V1[
                        strongestEntry[0]
                    ] ||
                    strongestEntry[0],
                points: strongestEntry[1]
            }
            : null;

    return {
        version: 'academy-solo-mode-v1',
        mode: 'solo',
        campaign: {
            roadmapId: sanitizeString(activeRoadmap?.id),
            goal: sanitizeString(
                activeRoadmap?.roadmap?.goal ||
                activeRoadmap?.goal
            ),
            completed,
            total,
            percentage
        },
        attributes,
        strongestGrowthArea,
        totalGrowthPoints,
        verifiedMissionCount: verifiedMissionIds.size,
        eventCount: Array.isArray(events)
            ? events.length
            : 0,
        updatedAt: nowIso()
    };
}

function academyProgressionRankFromXpV1(xp = 0) {
""",
    "Academy Solo Mode event foundation"
)

repo = replace_once(
    repo,
    """    const completedMissions = missions.filter((mission) => {
        return sanitizeString(mission.status).toLowerCase() === 'completed';
    });

    for (const mission of completedMissions) {
""",
    """    const completedMissions = missions.filter((mission) => {
        return sanitizeString(mission.status).toLowerCase() === 'completed';
    });

    const verifiedCompletedMissions = completedMissions.filter(
        (mission) => {
            return sanitizeString(
                mission.verificationDecision ||
                mission.verificationStatus
            ).toLowerCase() === 'approved';
        }
    );

    for (const mission of verifiedCompletedMissions) {
        await recordAcademySoloMissionCompletionV1(
            cleanUid,
            mission
        ).catch((error) => {
            console.warn(
                'Academy Solo mission reconciliation skipped:',
                error?.message || error
            );
        });
    }

    for (const mission of completedMissions) {
""",
    "Academy Solo verified mission reconciliation"
)

repo = replace_once(
    repo,
    """    const rank = academyProgressionRankFromXpV1(totalXp);
    const level = academyProgressionLevelFromXpV1(totalXp);

    const rankSpan = Math.max(
""",
    """    const rank = academyProgressionRankFromXpV1(totalXp);
    const level = academyProgressionLevelFromXpV1(totalXp);

    const soloEvents = await listAcademySoloEventsV1(
        cleanUid,
        500
    ).catch(() => []);

    const soloMode = buildAcademySoloModeSummaryV1({
        activeRoadmap,
        missions,
        events: soloEvents
    });

    const rankSpan = Math.max(
""",
    "Academy Solo progression projection"
)

repo = replace_once(
    repo,
    """        completedMissions: completedMissionCount,
        totalMissions,
        completionRate,
        checkinCount: checkins.length,
        streakDays,

        eventCount: events.length,
""",
    """        completedMissions: completedMissionCount,
        totalMissions,
        completionRate,
        checkinCount: checkins.length,
        streakDays,

        soloMode,

        eventCount: events.length,
""",
    "Academy Solo progression response"
)

repo = replace_once(
    repo,
    """    listAcademyXpEventsV1,
    upsertAcademyXpEventV1,

    getAcademySquadMembershipV1,
""",
    """    listAcademyXpEventsV1,
    upsertAcademyXpEventV1,

    listAcademySoloEventsV1,
    recordAcademySoloMissionCompletionV1,
    buildAcademySoloModeSummaryV1,

    getAcademySquadMembershipV1,
""",
    "Academy Solo repository exports"
)

controller = replace_once(
    controller,
    """        const missionXpResult =
            completionTransitioned
                ? await awardAcademyMissionXpV1(
                    uid,
                    completedMission || mission
                )
                : {
""",
    """        let soloModeEvent = {
            created: false,
            skipped: true,
            reason: 'mission_not_transitioned'
        };

        if (completionTransitioned) {
            try {
                soloModeEvent =
                    await academyFirestoreRepo
                        .recordAcademySoloMissionCompletionV1(
                            uid,
                            completedMission || mission
                        );
            } catch (soloModeError) {
                /*
                 * Solo Mode projection must never make a verified
                 * Roadmap mission fail after AI approval.
                 */
                console.warn(
                    'Academy Solo Mode event skipped:',
                    soloModeError?.message || soloModeError
                );

                soloModeEvent = {
                    created: false,
                    skipped: true,
                    reason: 'solo_mode_event_failed'
                };
            }
        }

        const missionXpResult =
            completionTransitioned
                ? await awardAcademyMissionXpV1(
                    uid,
                    completedMission || mission
                )
                : {
""",
    "Academy Solo completion event hook"
)

controller = replace_once(
    controller,
    """            squadMissionProgress: {
                action:
                    missionXpResult.squadMissionProgress ||
                    null,
                squadXp:
                    missionXpResult.squadXp?.squadMissionProgress ||
                    null
            },
            progression
""",
    """            squadMissionProgress: {
                action:
                    missionXpResult.squadMissionProgress ||
                    null,
                squadXp:
                    missionXpResult.squadXp?.squadMissionProgress ||
                    null
            },
            soloModeEvent,
            progression
""",
    "Academy Solo completion response"
)

write_preserving_newlines(CONTROLLER, controller, controller_newline)
write_preserving_newlines(REPO, repo, repo_newline)

for path in (CONTROLLER, REPO):
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

saved_controller, _ = read_normalized(CONTROLLER)
saved_repo, _ = read_normalized(REPO)

integrity_checks = [
    (
        "recordAcademySoloMissionCompletionV1" in saved_controller,
        "Controller Solo Mode hook"
    ),
    (
        "soloModeEvent," in saved_controller,
        "Controller Solo Mode response"
    ),
    (
        "const ACADEMY_SOLO_EVENT_RECORD_TYPE = 'academySoloEvents';"
        in saved_repo,
        "Solo event record type"
    ),
    (
        "version: 'academy-solo-mode-v1'" in saved_repo,
        "Solo Mode summary version"
    ),
    (
        "soloMode," in saved_repo,
        "Progression Solo Mode projection"
    ),
    (
        "recordAcademySoloMissionCompletionV1,"
        in saved_repo,
        "Solo Mode export"
    )
]

for passed, label in integrity_checks:
    if not passed:
        fail(f"Integrity check failed: {label}")

print(
    "\nPhase 3C.7A Academy Solo Mode progression "
    "foundation patched successfully."
)
print("Updated: academyControllers.js")
print("Updated: backend/repositories/academySupabaseRepo.js")
print("Syntax checks: passed")
print("Integrity checks: passed")
print(
    "\nNot changed: academyFirestoreRepo.js, frontend, routes, "
    "Roadmap generation, AI verification, XP values, Squad "
    "permissions, Dashboard, Plazas, Federation, or auth."
)
