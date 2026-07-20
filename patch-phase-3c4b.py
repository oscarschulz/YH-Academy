
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import re
import shutil

PATCH_MARKER = "Phase 3C.4B — persistent Squad achievement and notifications v1"

TARGETS = {
    "realtime_repo": Path("backend/repositories/realtimeSupabaseRepo.js"),
    "academy_repo": Path("backend/repositories/academySupabaseRepo.js"),
    "academy_controller": Path("academyControllers.js"),
    "game_dashboard": Path("public/js/yhu-game-dashboard.js"),
    "dashboard_js": Path("public/js/dashboard.js"),
    "dashboard_html": Path("public/dashboard.html"),
}


def fail(message: str) -> None:
    raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


def insert_before_once(text: str, anchor: str, addition: str, label: str) -> str:
    count = text.count(anchor)
    if count != 1:
        fail(f"{label}: expected exactly 1 anchor, found {count}")
    return text.replace(anchor, addition + anchor, 1)


def replace_segment(
    text: str,
    start_marker: str,
    end_marker: str,
    replacement: str,
    label: str,
) -> str:
    start = text.find(start_marker)
    if start < 0:
        fail(f"{label}: start marker not found")

    end = text.find(end_marker, start)
    if end < 0:
        fail(f"{label}: end marker not found")

    return text[:start] + replacement + text[end:]


def backup(path: Path, stamp: str) -> Path:
    backup_path = path.with_name(f"{path.name}.backup-phase-3c4b-{stamp}")
    shutil.copy2(path, backup_path)
    return backup_path


for label, path in TARGETS.items():
    if not path.exists():
        fail(f"Missing target ({label}): {path}")

texts = {
    key: path.read_text(encoding="utf-8")
    for key, path in TARGETS.items()
}

if any(PATCH_MARKER in text for text in texts.values()):
    raise SystemExit(
        "Phase 3C.4B appears to be installed already. No files changed."
    )

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backups = {
    key: backup(path, stamp)
    for key, path in TARGETS.items()
}


# ============================================================
# 1. Realtime notification repository
# ============================================================

realtime_map_block = r'''function mapNotificationRow(row = {}) {
    const data = rowData(row);

    const readAt =
        mapTimestamp(
            data.read_at ||
            data.readAt
        );

    const isRead =
        data.is_read === true ||
        data.isRead === true ||
        data.read === true ||
        Boolean(readAt);

    const body =
        sanitizeText(
            data.body ||
            data.text ||
            data.message
        );

    const metadata =
        data.metadata &&
        typeof data.metadata === 'object' &&
        !Array.isArray(data.metadata)
            ? data.metadata
            : {};

    return {
        id: row.source_document_id,
        notificationId: row.source_document_id,

        type: sanitizeText(data.type),
        title: sanitizeText(
            data.title ||
            'Notification'
        ),

        body,
        text: body,
        message: body,

        source: sanitizeText(
            data.source ||
            data.notification_source
        ),

        notificationType: sanitizeText(
            data.notificationType ||
            data.notification_type ||
            data.type
        ),

        notification_type: sanitizeText(
            data.notification_type ||
            data.notificationType ||
            data.type
        ),

        color: sanitizeText(
            data.color ||
            'var(--neon-blue)'
        ),

        avatarStr: sanitizeText(
            data.avatarStr ||
            data.avatar_str ||
            data.initial ||
            'N'
        ),

        avatar_str: sanitizeText(
            data.avatar_str ||
            data.avatarStr ||
            data.initial ||
            'N'
        ),

        initial: sanitizeText(
            data.initial ||
            data.avatarStr ||
            data.avatar_str ||
            'N'
        ),

        target: sanitizeText(
            data.target ||
            data.target_type ||
            data.targetType
        ),

        target_type: sanitizeText(
            data.target_type ||
            data.targetType ||
            data.target
        ),

        targetType: sanitizeText(
            data.targetType ||
            data.target_type ||
            data.target
        ),

        target_id: sanitizeText(
            data.target_id ||
            data.targetId ||
            row.target_user_id
        ),

        targetId: sanitizeText(
            data.targetId ||
            data.target_id ||
            row.target_user_id
        ),

        metadata,

        is_read: isRead,
        isRead,
        read: isRead,

        read_at: readAt,
        readAt,

        created_at: mapTimestamp(
            data.created_at ||
            data.createdAt ||
            row.created_at_source
        ),

        createdAt: mapTimestamp(
            data.createdAt ||
            data.created_at ||
            row.created_at_source
        )
    };
}


'''

texts["realtime_repo"] = replace_segment(
    texts["realtime_repo"],
    "function mapNotificationRow(row = {}) {",
    "async function safeBootstrapSection(",
    realtime_map_block,
    "Realtime notification mapper",
)

create_notification_block = r'''/* PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */

async function createNotification(input = {}) {
    const userId =
        normalizeUserId(
            input.userId ||
            input.ownerUserId ||
            input.recipientUserId
        );

    if (!userId) {
        throw new Error(
            'Notification recipient is required.'
        );
    }

    const rawNotificationId =
        sanitizeText(
            input.notificationId ||
            input.id ||
            makeRecordId('notif')
        );

    const notificationId =
        rawNotificationId
            .replace(
                /[^a-zA-Z0-9_-]+/g,
                '_'
            )
            .slice(0, 180);

    if (!notificationId) {
        throw new Error(
            'Notification ID is required.'
        );
    }

    const existing =
        await getRecordByTypeAndId(
            'notification',
            notificationId
        ).catch(() => null);

    if (existing) {
        const existingOwner =
            sanitizeText(
                existing.owner_user_id ||
                rowData(existing).user_id ||
                rowData(existing).userId
            );

        if (existingOwner === userId) {
            return {
                created: false,
                duplicate: true,
                notification:
                    mapNotificationRow(existing)
            };
        }

        throw new Error(
            'Notification ID is already in use.'
        );
    }

    const now = nowIso();

    const createdAt =
        mapTimestamp(
            input.createdAt ||
            input.created_at ||
            now
        ) || now;

    const body =
        sanitizeText(
            input.body ||
            input.text ||
            input.message
        );

    const target =
        sanitizeText(
            input.target ||
            input.targetType ||
            input.target_type
        );

    const targetId =
        sanitizeText(
            input.targetId ||
            input.target_id
        );

    const avatarStr =
        sanitizeText(
            input.avatarStr ||
            input.avatar_str ||
            input.initial ||
            'N'
        );

    const notificationType =
        sanitizeText(
            input.notificationType ||
            input.notification_type ||
            input.type ||
            'notification'
        );

    const row =
        await upsertRecord({
            recordType: 'notification',
            docId: notificationId,
            ownerUserId: userId,

            data: {
                user_id: userId,

                type:
                    sanitizeText(
                        input.type ||
                        notificationType
                    ),

                title:
                    sanitizeText(
                        input.title ||
                        'Notification'
                    ),

                body,
                text: body,
                message: body,

                source:
                    sanitizeText(
                        input.source ||
                        'system'
                    ),

                notification_type:
                    notificationType,

                notificationType,

                color:
                    sanitizeText(
                        input.color ||
                        'var(--neon-blue)'
                    ),

                avatar_str: avatarStr,
                avatarStr,
                initial: avatarStr,

                target,
                target_type: target,
                targetType: target,

                target_id: targetId,
                targetId,

                metadata:
                    input.metadata &&
                    typeof input.metadata ===
                        'object' &&
                    !Array.isArray(
                        input.metadata
                    )
                        ? input.metadata
                        : {},

                is_read: false,
                isRead: false,
                read: false,

                read_at: '',
                readAt: '',

                created_at: createdAt,
                createdAt,

                updated_at: now,
                updatedAt: now
            }
        });

    return {
        created: true,
        duplicate: false,
        notification:
            mapNotificationRow(row)
    };
}

/* END PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */


'''

texts["realtime_repo"] = insert_before_once(
    texts["realtime_repo"],
    "async function getNotifications(userId) {",
    create_notification_block,
    "Insert notification creator",
)

texts["realtime_repo"] = replace_once(
    texts["realtime_repo"],
    '''    getNotifications,
    readAllNotifications,
''',
    '''    createNotification,
    getNotifications,
    readAllNotifications,
''',
    "Export notification creator",
)


# ============================================================
# 2. Persistent Squad mission achievement
# ============================================================

achievement_block = r'''/* PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */

const ACADEMY_SQUAD_MISSION_ACHIEVEMENT_RECORD_TYPE =
    'academy:squadMissionAchievement';

async function recordAcademySquadMissionAchievementV1(
    uid = '',
    missionId = ''
) {
    const cleanUid =
        sanitizeString(uid);

    const cleanMissionId =
        sanitizeString(missionId);

    if (!cleanUid || !cleanMissionId) {
        const error =
            new Error(
                'Squad mission achievement requires a user and mission.'
            );

        error.statusCode = 400;
        throw error;
    }

    const context =
        await requireAcademySquadMemberV1(
            cleanUid
        );

    const mission =
        await getAcademySquadMissionByIdV1(
            context.squad,
            cleanMissionId
        );

    if (!mission) {
        const error =
            new Error(
                'Squad mission not found.'
            );

        error.statusCode = 404;
        throw error;
    }

    const progress =
        Math.max(
            0,
            Math.floor(
                toNumber(
                    mission.progress,
                    0
                )
            )
        );

    const target =
        Math.max(
            1,
            Math.floor(
                toNumber(
                    mission.target,
                    1
                )
            )
        );

    if (
        mission.status !== 'completed' ||
        progress < target
    ) {
        const error =
            new Error(
                'Squad mission is not completed.'
            );

        error.statusCode = 409;
        throw error;
    }

    const achievementId =
        (
            'squad_mission_achievement_' +
            cleanMissionId
        )
            .replace(
                /[^a-zA-Z0-9_-]+/g,
                '_'
            )
            .slice(0, 180);

    const ownerUserId =
        sanitizeString(
            context.squad.ownerUserId
        );

    const members =
        Array.isArray(
            context.squad.members
        )
            ? context.squad.members
                .map((member) => ({
                    userId:
                        sanitizeString(
                            member.userId
                        ),

                    displayName:
                        sanitizeString(
                            member.displayName ||
                            member.username ||
                            'YH Member'
                        ),

                    username:
                        sanitizeString(
                            member.username
                        ),

                    avatar:
                        sanitizeString(
                            member.avatar
                        ),

                    role:
                        sanitizeString(
                            member.role ||
                            'member'
                        ).toLowerCase()
                }))
                .filter(
                    (member) =>
                        member.userId
                )
            : [];

    const existing =
        await getOne(
            ACADEMY_SQUAD_MISSION_ACHIEVEMENT_RECORD_TYPE,
            ownerUserId,
            achievementId
        );

    if (existing) {
        return {
            created: false,
            duplicate: true,
            achievement:
                rowData(existing),
            squad:
                context.squad,
            mission,
            members
        };
    }

    const contributionRows =
        await listAcademySquadMissionContributionsV1(
            context.squad,
            cleanMissionId,
            500
        );

    const contributorMap =
        new Map();

    for (
        const contribution of
        contributionRows.map(
            (row) =>
                rowData(row)
        )
    ) {
        const contributorUserId =
            sanitizeString(
                contribution.contributorUserId
            );

        const contributorName =
            sanitizeString(
                contribution.contributorName ||
                'YH Member'
            );

        const key =
            contributorUserId ||
            contributorName.toLowerCase();

        if (!key) continue;

        const current =
            contributorMap.get(key) ||
            {
                userId:
                    contributorUserId,
                displayName:
                    contributorName,
                amount: 0,
                events: 0
            };

        current.amount +=
            Math.max(
                0,
                Math.floor(
                    toNumber(
                        contribution.amount,
                        0
                    )
                )
            );

        current.events += 1;

        contributorMap.set(
            key,
            current
        );
    }

    const completedAt =
        toIso(
            mission.completedAt ||
            mission.updatedAt
        ) ||
        nowIso();

    const achievement = {
        id:
            achievementId,

        achievementType:
            'squad_mission_completed',

        status:
            'earned',

        squadId:
            context.squad.id,

        squadName:
            sanitizeString(
                context.squad.name ||
                'Academy Squad'
            ),

        squadEmblem:
            sanitizeString(
                context.squad.emblem ||
                '⚡'
            ),

        missionId:
            mission.id,

        missionTitle:
            mission.title,

        missionType:
            mission.missionType,

        progress,
        target,

        rewardXp:
            Math.max(
                0,
                Math.floor(
                    toNumber(
                        mission.rewardXp,
                        0
                    )
                )
            ),

        earnedAt:
            completedAt,

        completedAt,

        completedByUserId:
            cleanUid,

        memberCount:
            members.length,

        memberUserIds:
            members.map(
                (member) =>
                    member.userId
            ),

        contributors:
            Array.from(
                contributorMap.values()
            )
                .sort(
                    (a, b) =>
                        b.amount -
                        a.amount
                ),

        createdAt:
            completedAt,

        updatedAt:
            completedAt,

        metadata: {
            source:
                'academy_squad_mission',
            duplicateSafe:
                true
        }
    };

    const saved =
        await upsertRecord(
            ACADEMY_SQUAD_MISSION_ACHIEVEMENT_RECORD_TYPE,
            ownerUserId,
            achievementId,
            achievement
        );

    return {
        created: true,
        duplicate: false,
        achievement:
            rowData(saved),
        squad:
            context.squad,
        mission,
        members
    };
}

/* END PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */


'''

texts["academy_repo"] = insert_before_once(
    texts["academy_repo"],
    "/* END PATCH: Automatic Shared Squad Mission progress v1 */",
    achievement_block,
    "Insert Squad mission achievement",
)

texts["academy_repo"] = replace_once(
    texts["academy_repo"],
    '''    getAcademySquadMissionContributionsV1,
    recordAcademySquadMissionContributionV1,

    computeBehaviorProfile,
''',
    '''    getAcademySquadMissionContributionsV1,
    recordAcademySquadMissionContributionV1,
    recordAcademySquadMissionAchievementV1,

    computeBehaviorProfile,
''',
    "Export Squad mission achievement",
)


# ============================================================
# 3. Completion delivery in Academy controller
# ============================================================

texts["academy_controller"] = replace_once(
    texts["academy_controller"],
    '''const academyFirestoreRepo = require('./backend/repositories/academyFirestoreRepo');
''',
    '''const academyFirestoreRepo = require('./backend/repositories/academyFirestoreRepo');
const realtimeFirestoreRepo = require('./backend/repositories/realtimeFirestoreRepo');
''',
    "Import realtime repository",
)

controller_helpers = r'''/* PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */

function buildAcademySquadMissionNotificationIdV1(
    missionId = '',
    memberUserId = ''
) {
    return (
        'squad_mission_complete_' +
        sanitize(missionId) +
        '_' +
        sanitize(memberUserId)
    )
        .replace(
            /[^a-zA-Z0-9_-]+/g,
            '_'
        )
        .slice(0, 180);
}

async function finalizeAcademySquadMissionCompletionsV1(
    uid = '',
    missionProgressResult = {}
) {
    const completedMissions =
        Array.isArray(
            missionProgressResult
                ?.completedMissions
        )
            ? missionProgressResult
                .completedMissions
                .filter(
                    (entry) =>
                        entry?.completed === true &&
                        sanitize(
                            entry?.missionId
                        )
                )
            : [];

    if (!completedMissions.length) {
        return {
            created: false,
            achievements: [],
            notificationCount: 0,
            newNotificationCount: 0
        };
    }

    const deliveries = [];

    for (
        const completion of
        completedMissions
    ) {
        const missionId =
            sanitize(
                completion.missionId
            );

        try {
            const achievementResult =
                await academyFirestoreRepo
                    .recordAcademySquadMissionAchievementV1(
                        uid,
                        missionId
                    );

            const squad =
                achievementResult?.squad ||
                {};

            const mission =
                achievementResult?.mission ||
                {};

            const achievement =
                achievementResult
                    ?.achievement ||
                {};

            const members =
                Array.isArray(
                    achievementResult
                        ?.members
                )
                    ? achievementResult
                        .members
                    : [];

            const rewardXp =
                Math.max(
                    0,
                    Math.floor(
                        Number(
                            completion
                                ?.reward
                                ?.awarded ??
                            mission.rewardXp ??
                            achievement.rewardXp ??
                            0
                        ) || 0
                    )
                );

            const completedAt =
                sanitize(
                    mission.completedAt ||
                    achievement.completedAt ||
                    achievement.earnedAt ||
                    new Date()
                        .toISOString()
                );

            const notificationResults =
                await Promise.allSettled(
                    members
                        .filter(
                            (member) =>
                                sanitize(
                                    member.userId
                                )
                        )
                        .map((member) => {
                            const memberUserId =
                                sanitize(
                                    member.userId
                                );

                            return realtimeFirestoreRepo
                                .createNotification({
                                    notificationId:
                                        buildAcademySquadMissionNotificationIdV1(
                                            missionId,
                                            memberUserId
                                        ),

                                    userId:
                                        memberUserId,

                                    type:
                                        'squad_mission_completed',

                                    notificationType:
                                        'squad-mission-completed',

                                    source:
                                        'academy-squad',

                                    title:
                                        'Squad Mission Complete',

                                    body:
                                        `${
                                            sanitize(
                                                squad.name ||
                                                'Your Squad'
                                            )
                                        } completed “${
                                            sanitize(
                                                mission.title ||
                                                completion.missionTitle ||
                                                'Squad Mission'
                                            )
                                        }”${
                                            rewardXp > 0
                                                ? (
                                                    ` and earned ${rewardXp} Squad XP.`
                                                )
                                                : '.'
                                        }`,

                                    target:
                                        'squad-mission-history',

                                    targetId:
                                        missionId,

                                    avatarStr:
                                        sanitize(
                                            squad.emblem ||
                                            '⚡'
                                        ) || '⚡',

                                    color:
                                        'linear-gradient(135deg, #0ea5e9, #2563eb)',

                                    createdAt:
                                        completedAt,

                                    metadata: {
                                        squadId:
                                            sanitize(
                                                squad.id
                                            ),

                                        squadName:
                                            sanitize(
                                                squad.name
                                            ),

                                        missionId,

                                        missionTitle:
                                            sanitize(
                                                mission.title ||
                                                completion.missionTitle
                                            ),

                                        missionType:
                                            sanitize(
                                                mission.missionType
                                            ),

                                        rewardXp,

                                        achievementId:
                                            sanitize(
                                                achievement.id
                                            ),

                                        completedAt
                                    }
                                });
                        })
                );

            const fulfilled =
                notificationResults
                    .filter(
                        (result) =>
                            result.status ===
                            'fulfilled'
                    )
                    .map(
                        (result) =>
                            result.value
                    );

            deliveries.push({
                missionId,

                achievementCreated:
                    achievementResult
                        ?.created === true,

                achievement,

                notificationCount:
                    fulfilled.length,

                newNotificationCount:
                    fulfilled.filter(
                        (result) =>
                            result?.created === true
                    ).length,

                notificationFailures:
                    notificationResults
                        .filter(
                            (result) =>
                                result.status ===
                                'rejected'
                        )
                        .map(
                            (result) =>
                                String(
                                    result.reason
                                        ?.message ||
                                    result.reason ||
                                    'Notification failed.'
                                )
                        )
            });
        } catch (error) {
            console.warn(
                'Squad mission completion delivery skipped:',
                missionId,
                error?.message ||
                error
            );

            deliveries.push({
                missionId,
                error:
                    error?.message ||
                    'Completion delivery failed.',
                notificationCount: 0,
                newNotificationCount: 0
            });
        }
    }

    return {
        created:
            deliveries.some(
                (entry) =>
                    entry
                        .achievementCreated ===
                        true
            ),

        achievements:
            deliveries
                .map(
                    (entry) =>
                        entry.achievement
                )
                .filter(Boolean),

        notificationCount:
            deliveries.reduce(
                (total, entry) =>
                    total +
                    Number(
                        entry.notificationCount ||
                        0
                    ),
                0
            ),

        newNotificationCount:
            deliveries.reduce(
                (total, entry) =>
                    total +
                    Number(
                        entry.newNotificationCount ||
                        0
                    ),
                0
            ),

        deliveries
    };
}

/* END PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */

'''

new_advance = controller_helpers + r'''async function advanceAcademySquadMissionV1(
    uid = '',
    input = {}
) {
    try {
        const result =
            await academyFirestoreRepo
                .recordAcademySquadMissionContributionV1(
                    uid,
                    input
                );

        const completionDelivery =
            await finalizeAcademySquadMissionCompletionsV1(
                uid,
                result
            );

        return {
            ...result,
            completionDelivery
        };
    } catch (error) {
        /*
         * Squad Mission progression must never make the
         * underlying verified Academy action fail.
         */
        console.warn(
            'Academy Squad Mission progress skipped:',
            error?.message || error
        );

        return {
            created: false,
            applied: false,
            reason:
                'squad_mission_progress_failed',
            missions: [],
            completedMissions: [],
            completionDelivery: {
                created: false,
                achievements: [],
                notificationCount: 0,
                newNotificationCount: 0
            }
        };
    }
}

'''

texts["academy_controller"] = replace_segment(
    texts["academy_controller"],
    "async function advanceAcademySquadMissionV1(",
    "async function awardAcademySquadXpV1(",
    new_advance,
    "Replace Squad mission advance helper",
)


# ============================================================
# 4. Expose history opener
# ============================================================

game_history_bridge = r'''/* PATCH: Phase 3C.4B notification mission-history bridge v1 */

window.YHUOpenAcademySquadMissionHistoryV1 =
    function (
        missionId = '',
        options = {}
    ) {
        return openSquadMissionHistoryV1(
            missionId,
            {
                force:
                    options?.force !== false
            }
        );
    };

if (
    window
        .__yhuSquadMissionHistoryNotificationBridgeV1 !==
    true
) {
    window
        .__yhuSquadMissionHistoryNotificationBridgeV1 =
        true;

    window.addEventListener(
        'yhu:open-squad-mission-history',
        (event) => {
            const missionId =
                String(
                    event?.detail
                        ?.missionId ||
                    ''
                ).trim();

            if (!missionId) {
                return;
            }

            void openSquadMissionHistoryV1(
                missionId,
                {
                    force: true
                }
            );
        }
    );
}

/* END PATCH: Phase 3C.4B notification mission-history bridge v1 */


'''

texts["game_dashboard"] = insert_before_once(
    texts["game_dashboard"],
    "function bindSquadMissionHistoryNavigationV1() {",
    game_history_bridge,
    "Expose Squad mission history opener",
)


# ============================================================
# 5. Dashboard notification behavior
# ============================================================

texts["dashboard_js"] = replace_once(
    texts["dashboard_js"],
    '''    const rawType = String(notification?.type || '').trim().toLowerCase();
    const candidate = rawTarget || rawType;

    if (['announcement', 'announcements'].includes(candidate)) {
''',
    '''    const rawType = String(notification?.type || '').trim().toLowerCase();
    const candidate = rawTarget || rawType;

    if ([
        'squad-mission-history',
        'squad_mission_history',
        'squad-mission',
        'squad_mission',
        'squad-mission-completed',
        'squad_mission_completed'
    ].includes(candidate)) {
        return 'squad-mission-history';
    }

    if (['announcement', 'announcements'].includes(candidate)) {
''',
    "Normalize Squad mission target",
)

texts["dashboard_js"] = replace_once(
    texts["dashboard_js"],
    '''const openNotificationTarget = (target = '', targetId = '') => {
    const normalized = String(target || '').trim().toLowerCase();

    if (
        normalized === 'business-chats' ||
''',
    '''const openNotificationTarget = (target = '', targetId = '') => {
    const normalized = String(target || '').trim().toLowerCase();
    const cleanTargetId = String(targetId || '').trim();

    if (
        normalized === 'squad-mission-history' ||
        normalized === 'squad_mission_history' ||
        normalized === 'squad-mission' ||
        normalized === 'squad_mission'
    ) {
        if (!cleanTargetId) return;

        if (
            typeof window
                .YHUOpenAcademySquadMissionHistoryV1 ===
            'function'
        ) {
            window
                .YHUOpenAcademySquadMissionHistoryV1(
                    cleanTargetId,
                    {
                        force: true
                    }
                );

            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                'yhu:open-squad-mission-history',
                {
                    detail: {
                        missionId:
                            cleanTargetId
                    }
                }
            )
        );

        return;
    }

    if (
        normalized === 'business-chats' ||
''',
    "Open Squad mission target",
)

notification_refresh_block = r'''/* PATCH: Phase 3C.4B live Squad notification badge refresh v1 */

function dashboardHasCompletedSquadMissionV1(
    payload = {}
) {
    const stack = [
        payload?.squadMissionProgress,
        payload?.squadXp
            ?.squadMissionProgress
    ].filter(Boolean);

    const seen =
        new Set();

    while (stack.length) {
        const value =
            stack.pop();

        if (
            !value ||
            typeof value !== 'object' ||
            seen.has(value)
        ) {
            continue;
        }

        seen.add(value);

        if (
            Array.isArray(
                value.completedMissions
            ) &&
            value.completedMissions
                .some(
                    (mission) =>
                        mission
                            ?.completed ===
                            true
                )
        ) {
            return true;
        }

        if (
            value.completed === true &&
            value.missionId
        ) {
            return true;
        }

        for (
            const nested of
            Object.values(value)
        ) {
            if (
                nested &&
                typeof nested ===
                    'object'
            ) {
                stack.push(nested);
            }
        }
    }

    return false;
}

if (
    window
        .__yhSquadNotificationLiveRefreshV1 !==
    true
) {
    window
        .__yhSquadNotificationLiveRefreshV1 =
        true;

    window.addEventListener(
        'message',
        (event) => {
            if (
                event.origin !==
                window.location.origin
            ) {
                return;
            }

            const data =
                event.data &&
                typeof event.data ===
                    'object'
                    ? event.data
                    : null;

            if (
                !data ||
                data.type !==
                    'yhu:academy-squad-action-completed' ||
                !dashboardHasCompletedSquadMissionV1(
                    data
                )
            ) {
                return;
            }

            const academyFrame =
                document.getElementById(
                    'yh-universe-workspace-inline-frame'
                );

            if (
                academyFrame?.contentWindow &&
                event.source !==
                    academyFrame.contentWindow
            ) {
                return;
            }

            const state =
                getDashboardState();

            state.realtimeNotifications =
                null;

            window.clearTimeout(
                window
                    .__yhSquadNotificationRefreshTimerV1
            );

            window
                .__yhSquadNotificationRefreshTimerV1 =
                window.setTimeout(
                    () => {
                        loadRealtimeNotifications(
                            true
                        ).catch(
                            (error) => {
                                console.warn(
                                    'Squad completion notification refresh skipped:',
                                    error?.message ||
                                    error
                                );
                            }
                        );
                    },
                    160
                );
        }
    );
}

/* END PATCH: Phase 3C.4B live Squad notification badge refresh v1 */


'''

texts["dashboard_js"] = insert_before_once(
    texts["dashboard_js"],
    "async function markRealtimeNotificationRead(notificationId, rerender = true) {",
    notification_refresh_block,
    "Insert notification live refresh",
)


# ============================================================
# 6. Cache bust
# ============================================================

def replace_script_version(
    html: str,
    filename: str,
    version: str,
) -> str:
    pattern = re.compile(
        rf'(<script\b[^>]*\bsrc=["\']/js/{re.escape(filename)})(?:\?v=[^"\']*)?(["\'][^>]*></script>)',
        re.IGNORECASE,
    )

    matches = list(pattern.finditer(html))

    if len(matches) != 1:
        fail(
            f"dashboard.html {filename}: expected exactly 1 script tag, found {len(matches)}"
        )

    return pattern.sub(
        rf'\1?v={version}\2',
        html,
        count=1,
    )


texts["dashboard_html"] = replace_script_version(
    texts["dashboard_html"],
    "dashboard.js",
    "20260720-squad-achievement-notifications-v1",
)

texts["dashboard_html"] = replace_script_version(
    texts["dashboard_html"],
    "yhu-game-dashboard.js",
    "20260720-squad-achievement-notifications-v1",
)


for key, path in TARGETS.items():
    path.write_text(
        texts[key],
        encoding="utf-8",
    )

print("Phase 3C.4B patched successfully.")

for path in TARGETS.values():
    print(f"Updated: {path}")

for path in backups.values():
    print(f"Backup: {path}")
