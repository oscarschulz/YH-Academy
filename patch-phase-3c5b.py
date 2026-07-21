#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import shutil
import subprocess
import sys

ROOT = Path.cwd()
paths = {
    'academyControllers.js': ROOT / 'academyControllers.js',
    'academySupabaseRepo.js': ROOT / 'backend' / 'repositories' / 'academySupabaseRepo.js',
    'realtimeSupabaseRepo.js': ROOT / 'backend' / 'repositories' / 'realtimeSupabaseRepo.js',
}

missing = [str(path) for path in paths.values() if not path.exists()]
if missing:
    raise FileNotFoundError(
        'Missing required Phase 3C.5B file(s):\n- ' +
        '\n- '.join(missing)
    )

outputs = {}
active_newline = '\n'

def read_source(path):
    raw = path.read_bytes()
    newline = '\r\n' if b'\r\n' in raw else '\n'
    return raw.decode('utf-8'), newline

def replace_between(text, start, end, new, label):
    a = text.find(start)
    if a < 0:
        raise RuntimeError(f'{label}: start block not found')

    b = text.find(end, a)
    if b < 0:
        raise RuntimeError(f'{label}: end block not found')

    replacement = new.rstrip().replace('\n', active_newline)
    return (
        text[:a] +
        replacement +
        active_newline +
        active_newline +
        text[b:]
    )

# ---------- academySupabaseRepo.js ----------
p = paths['academySupabaseRepo.js']
text, active_newline = read_source(p)

new_upsert = r'''async function upsertRecord(recordType, uid, docId, payload = {}, extra = {}) {
    const cleanUid = String(uid);
    const cleanDocId = String(docId);
    const now = nowIso();
    const insertOnly = extra?.insertOnly === true;

    const data = normalizeForJson({
        ...payload,
        id: payload.id || cleanDocId,
        updatedAt: payload.updatedAt || now,
        createdAt: payload.createdAt || now
    });

    const row = {
        firebase_app: 'supabase',
        source_collection_path: collectionPathFor(recordType, cleanUid),
        source_collection_name: collectionPathFor(recordType, cleanUid)
            .split('/')
            .filter(Boolean)
            .pop() || 'academy',
        source_collection_root: 'users',
        source_document_id: cleanDocId,
        source_document_path: sourcePathFor(recordType, cleanUid, cleanDocId),
        record_type: recordType,
        user_id: cleanUid,
        data,
        created_at_source: toIso(data.createdAt) || now,
        updated_at_source: toIso(data.updatedAt) || now,
        updated_at: now
    };

    const query = yhuSupabaseAdmin
        .from(TABLE)
        .upsert(row, {
            onConflict: 'source_document_path',
            ignoreDuplicates: insertOnly
        })
        .select('*');

    const { data: saved, error } = insertOnly
        ? await query.maybeSingle()
        : await query.single();

    if (error) {
        throw new Error(
            `Academy Supabase upsert failed (${recordType}/${cleanDocId}): ${error.message}`
        );
    }

    if (!saved && !insertOnly) {
        throw new Error(
            `Academy Supabase upsert returned no record (${recordType}/${cleanDocId}).`
        );
    }

    return saved || null;
}

async function updateRecordDataWithVersionV1(
    recordType,
    uid,
    docId,
    currentRow,
    payload = {}
) {
    if (!currentRow || typeof currentRow !== 'object') {
        return null;
    }

    const cleanUid = sanitizeString(uid);
    const cleanDocId = sanitizeString(docId);
    const currentData = rowData(currentRow);
    const currentVersion = toIso(currentRow.updated_at);
    const currentVersionMs = new Date(currentVersion || 0).getTime();
    const nextVersion = new Date(
        Math.max(
            Date.now(),
            Number.isFinite(currentVersionMs)
                ? currentVersionMs + 1
                : 0
        )
    ).toISOString();

    const data = normalizeForJson({
        ...currentData,
        ...(payload && typeof payload === 'object' ? payload : {}),
        id: payload.id || currentData.id || cleanDocId,
        createdAt:
            payload.createdAt ||
            currentData.createdAt ||
            currentRow.created_at_source ||
            nextVersion,
        updatedAt: nextVersion
    });

    let query = yhuSupabaseAdmin
        .from(TABLE)
        .update({
            data,
            updated_at_source: nextVersion,
            updated_at: nextVersion
        });

    if (currentRow.id) {
        query = query.eq('id', currentRow.id);
    } else {
        query = query
            .eq('record_type', recordType)
            .eq('user_id', cleanUid)
            .eq('source_document_id', cleanDocId);
    }

    query = currentVersion
        ? query.eq('updated_at', currentVersion)
        : query.is('updated_at', null);

    const { data: saved, error } = await query
        .select('*')
        .maybeSingle();

    if (error) {
        throw new Error(
            `Academy Supabase versioned update failed (${recordType}/${cleanDocId}): ${error.message}`
        );
    }

    return saved || null;
}'''
text = replace_between(text, 'async function upsertRecord(', 'function normalizeForJson', new_upsert, 'academy upsert')

new_membership = r'''async function getAcademySquadMembershipV1(
    uid = ''
) {
    const cleanUid =
        sanitizeString(uid);

    if (!cleanUid) {
        return null;
    }

    const row =
        await getOne(
            ACADEMY_SQUAD_MEMBERSHIP_RECORD_TYPE,
            cleanUid,
            ACADEMY_SQUAD_MEMBERSHIP_DOC_ID
        );

    if (!row) {
        return null;
    }

    const data =
        rowData(row);

    const squadId =
        sanitizeString(
            data.squadId
        );

    const status =
        sanitizeString(
            data.status ||
            'active'
        ).toLowerCase();

    if (
        !squadId ||
        status !== 'active'
    ) {
        return null;
    }

    return {
        ...data,
        squadId,
        status,
        userId: cleanUid
    };
}'''
text = replace_between(text, 'async function getAcademySquadMembershipV1(', 'async function getAcademySquadByIdV1(', new_membership, 'membership')

new_current = r'''async function getCurrentAcademySquadV1(
    uid = ''
) {
    const membership =
        await getAcademySquadMembershipV1(
            uid
        );

    if (!membership?.squadId) {
        return null;
    }

    const squad =
        await getAcademySquadByIdV1(
            membership.squadId
        );

    if (
        !squad ||
        squad.status !== 'active'
    ) {
        return null;
    }

    const member =
        squad.members.find(
            (entry) =>
                entry.userId ===
                sanitizeString(uid)
        ) || null;

    if (!member) {
        return null;
    }

    return {
        squad,
        membership: {
            ...membership,
            role:
                member.role ||
                membership.role ||
                'member'
        }
    };
}'''
text = replace_between(text, 'async function getCurrentAcademySquadV1(', 'async function createAcademySquadV1(', new_current, 'current squad')

new_recompute = r'''async function recomputeAcademySquadXpV1(
    squad = {}
) {
    const squadId =
        sanitizeString(squad.id);

    const ownerUserId =
        sanitizeString(
            squad.ownerUserId
        );

    if (!squadId || !ownerUserId) {
        throw new Error(
            'Cannot recompute Squad XP without a valid Squad.'
        );
    }

    for (
        let attempt = 0;
        attempt < 6;
        attempt += 1
    ) {
        const currentRow =
            await getOne(
                ACADEMY_SQUAD_RECORD_TYPE,
                ownerUserId,
                squadId
            );

        if (!currentRow) {
            const error =
                new Error(
                    'Squad not found while recomputing XP.'
                );

            error.statusCode = 404;
            throw error;
        }

        const currentSquad =
            academySquadNormalizeRecordV1(
                rowData(currentRow)
            );

        if (currentSquad.status !== 'active') {
            return currentSquad;
        }

        const events =
            await listAcademySquadXpEventsV1(
                currentSquad,
                500
            );

        const weekStart =
            academySquadXpWeekStartV1();

        const totalXp =
            events.reduce(
                (sum, event) => {
                    return (
                        sum +
                        Math.max(
                            0,
                            toNumber(
                                event.xp,
                                0
                            )
                        )
                    );
                },
                0
            );

        const weeklyXp =
            events.reduce(
                (sum, event) => {
                    const eventAt =
                        toIso(
                            event.eventAt ||
                            event.createdAt
                        );

                    if (
                        !eventAt ||
                        !weekStart ||
                        eventAt < weekStart
                    ) {
                        return sum;
                    }

                    return (
                        sum +
                        Math.max(
                            0,
                            toNumber(
                                event.xp,
                                0
                            )
                        )
                    );
                },
                0
            );

        const levelMeta =
            academySquadLevelFromXpV1(
                totalXp
            );

        const recentContributions =
            events
                .slice()
                .sort((a, b) => {
                    return (
                        new Date(
                            b.eventAt ||
                            b.createdAt ||
                            0
                        ).getTime() -
                        new Date(
                            a.eventAt ||
                            a.createdAt ||
                            0
                        ).getTime()
                    );
                })
                .slice(0, 20)
                .map((event) => ({
                    id:
                        sanitizeString(
                            event.id
                        ),
                    contributorUserId:
                        sanitizeString(
                            event.contributorUserId
                        ),
                    contributorName:
                        sanitizeString(
                            event.contributorName ||
                            'YH Member'
                        ),
                    eventType:
                        sanitizeString(
                            event.eventType
                        ),
                    label:
                        sanitizeString(
                            event.label ||
                            'Squad contribution'
                        ),
                    xp:
                        Math.max(
                            0,
                            toNumber(
                                event.xp,
                                0
                            )
                        ),
                    eventAt:
                        toIso(
                            event.eventAt ||
                            event.createdAt
                        )
                }));

        const nextSquad =
            academySquadNormalizeRecordV1({
                ...currentSquad,
                totalXp,
                weeklyXp,
                level:
                    levelMeta.level,
                nextLevelXp:
                    levelMeta.nextLevelXp,
                recentContributions
            });

        const saved =
            await updateRecordDataWithVersionV1(
                ACADEMY_SQUAD_RECORD_TYPE,
                ownerUserId,
                squadId,
                currentRow,
                nextSquad
            );

        if (saved) {
            return academySquadNormalizeRecordV1(
                rowData(saved)
            );
        }
    }

    const error =
        new Error(
            'Squad XP changed concurrently. Please retry.'
        );

    error.statusCode = 409;
    throw error;
}'''
text = replace_between(text, 'async function recomputeAcademySquadXpV1(', 'async function recordAcademySquadXpContributionV1(', new_recompute, 'recompute xp')

new_record_xp = r'''async function recordAcademySquadXpContributionV1(
    uid = '',
    input = {}
) {
    const cleanUid =
        sanitizeString(uid);

    const eventType =
        sanitizeString(
            input.eventType
        ).toLowerCase();

    const sourceId =
        sanitizeString(
            input.sourceId
        );

    const xp =
        Math.max(
            0,
            toNumber(
                input.xp,
                0
            )
        );

    if (
        !cleanUid ||
        !eventType ||
        !sourceId ||
        xp <= 0
    ) {
        return {
            created: false,
            awarded: 0,
            reason:
                'invalid_squad_xp_event'
        };
    }

    const current =
        await getCurrentAcademySquadV1(
            cleanUid
        );

    const squad =
        current?.squad;

    if (
        !squad ||
        squad.status !== 'active'
    ) {
        return {
            created: false,
            awarded: 0,
            reason:
                'no_active_squad'
        };
    }

    const member =
        squad.members.find(
            (entry) =>
                entry.userId ===
                cleanUid
        );

    if (!member) {
        return {
            created: false,
            awarded: 0,
            reason:
                'inactive_squad_member'
        };
    }

    const dedupeScope =
        sanitizeString(
            input.dedupeScope
        ).toLowerCase() === 'squad'
            ? 'squad'
            : 'member';

    const eventId =
        academySquadXpEventIdV1({
            squadId: squad.id,
            contributorUserId:
                cleanUid,
            eventType,
            sourceId,
            dedupeScope
        });

    const existing =
        await getOne(
            ACADEMY_SQUAD_XP_EVENT_RECORD_TYPE,
            squad.ownerUserId,
            eventId
        );

    if (existing) {
        return {
            created: false,
            awarded: 0,
            duplicate: true,
            event:
                rowData(existing),
            squad
        };
    }

    const now =
        nowIso();

    const event = {
        id: eventId,
        squadId:
            squad.id,
        contributorUserId:
            cleanUid,
        contributorName:
            sanitizeString(
                member.displayName ||
                member.username ||
                'YH Member'
            ),
        contributorRole:
            sanitizeString(
                member.role ||
                'member'
            ),
        eventType,
        sourceId,
        dedupeScope,
        sourceType:
            sanitizeString(
                input.sourceType
            ),
        label:
            sanitizeString(
                input.label ||
                'Squad contribution'
            ),
        xp,
        eventAt:
            toIso(
                input.eventAt
            ) || now,
        metadata:
            input.metadata &&
            typeof input.metadata === 'object'
                ? input.metadata
                : {},
        createdAt: now,
        updatedAt: now
    };

    const savedEventRow =
        await upsertRecord(
            ACADEMY_SQUAD_XP_EVENT_RECORD_TYPE,
            squad.ownerUserId,
            eventId,
            event,
            {
                status: 'active',
                insertOnly: true
            }
        );

    if (!savedEventRow) {
        const concurrentExisting =
            await getOne(
                ACADEMY_SQUAD_XP_EVENT_RECORD_TYPE,
                squad.ownerUserId,
                eventId
            );

        return {
            created: false,
            awarded: 0,
            duplicate: true,
            event:
                concurrentExisting
                    ? rowData(concurrentExisting)
                    : event,
            squad
        };
    }

    const updatedSquad =
        await recomputeAcademySquadXpV1(
            squad
        );

    return {
        created: true,
        awarded: xp,
        event:
            rowData(savedEventRow),
        squad:
            updatedSquad
    };
}'''
text = replace_between(text, 'async function recordAcademySquadXpContributionV1(', '/* END PATCH: Academy Squad XP ledger v1 */', new_record_xp, 'record xp')

# Replace contribution function and prepend reconciliation helper
new_contribution = r'''async function reconcileAcademySquadMissionProgressV1(
    squad = {},
    missionId = ''
) {
    const cleanMissionId =
        sanitizeString(missionId);

    const ownerUserId =
        sanitizeString(
            squad.ownerUserId
        );

    if (
        !cleanMissionId ||
        !ownerUserId ||
        !sanitizeString(squad.id)
    ) {
        const error =
            new Error(
                'Invalid Squad mission reconciliation context.'
            );

        error.statusCode = 400;
        throw error;
    }

    for (
        let attempt = 0;
        attempt < 6;
        attempt += 1
    ) {
        const missionRow =
            await getOne(
                ACADEMY_SQUAD_MISSION_RECORD_TYPE,
                ownerUserId,
                cleanMissionId
            );

        if (!missionRow) {
            const error =
                new Error(
                    'Squad mission not found.'
                );

            error.statusCode = 404;
            throw error;
        }

        const currentMission =
            normalizeAcademySquadMissionV1(
                rowData(missionRow)
            );

        if (
            currentMission.squadId !==
            sanitizeString(squad.id)
        ) {
            const error =
                new Error(
                    'Squad mission not found.'
                );

            error.statusCode = 404;
            throw error;
        }

        if (currentMission.status === 'cancelled') {
            return {
                mission: currentMission,
                completedNow: false
            };
        }

        const contributions =
            await listAcademySquadMissionContributionsV1(
                squad,
                cleanMissionId,
                500
            );

        const computedProgress =
            contributions.reduce(
                (sum, entry) => {
                    return (
                        sum +
                        Math.max(
                            0,
                            Math.floor(
                                toNumber(
                                    entry.amount,
                                    0
                                )
                            )
                        )
                    );
                },
                0
            );

        const nextProgress =
            Math.max(
                currentMission.progress,
                Math.min(
                    currentMission.target,
                    computedProgress
                )
            );

        const wasCompleted =
            currentMission.status ===
            'completed';

        const completed =
            wasCompleted ||
            nextProgress >=
                currentMission.target;

        const nextStatus =
            completed
                ? 'completed'
                : 'active';

        if (
            currentMission.progress === nextProgress &&
            currentMission.status === nextStatus
        ) {
            return {
                mission: currentMission,
                completedNow: false
            };
        }

        const now =
            nowIso();

        const updatedMission =
            normalizeAcademySquadMissionV1({
                ...currentMission,
                progress:
                    nextProgress,
                status:
                    nextStatus,
                completedAt:
                    completed
                        ? (
                            currentMission.completedAt ||
                            now
                        )
                        : '',
                updatedAt:
                    now
            });

        const saved =
            await updateRecordDataWithVersionV1(
                ACADEMY_SQUAD_MISSION_RECORD_TYPE,
                ownerUserId,
                cleanMissionId,
                missionRow,
                updatedMission
            );

        if (saved) {
            return {
                mission:
                    normalizeAcademySquadMissionV1(
                        rowData(saved)
                    ),
                completedNow:
                    !wasCompleted &&
                    completed
            };
        }
    }

    const error =
        new Error(
            'Squad mission progress changed concurrently. Please retry.'
        );

    error.statusCode = 409;
    throw error;
}

async function recordAcademySquadMissionContributionV1(
    uid = '',
    input = {}
) {
    const cleanUid =
        sanitizeString(
            uid
        );

    const missionType =
        normalizeAcademySquadMissionTypeV1(
            input.missionType
        );

    const sourceId =
        sanitizeString(
            input.sourceId
        );

    const eventType =
        sanitizeString(
            input.eventType ||
            missionType
        ).toLowerCase();

    const amount =
        Math.max(
            1,
            Math.floor(
                toNumber(
                    input.amount,
                    1
                )
            )
        );

    if (
        !cleanUid ||
        !sourceId ||
        !eventType ||
        missionType === 'custom'
    ) {
        return {
            created: false,
            reason:
                'invalid_squad_mission_contribution',
            missionType,
            sourceId,
            missions: []
        };
    }

    const context =
        await requireAcademySquadMemberV1(
            cleanUid
        );

    const squad =
        context.squad;

    if (
        !squad ||
        squad.status !== 'active'
    ) {
        return {
            created: false,
            reason:
                'no_active_squad',
            missionType,
            sourceId,
            missions: []
        };
    }

    const missionRows =
        await getRows(
            ACADEMY_SQUAD_MISSION_RECORD_TYPE,
            squad.ownerUserId,
            {
                limit: 500
            }
        );

    const now =
        nowIso();

    const nowMs =
        new Date(now)
            .getTime();

    const activeMissions =
        missionRows
            .map((row) =>
                normalizeAcademySquadMissionV1(
                    rowData(row)
                )
            )
            .filter((mission) => {
                if (
                    mission.squadId !==
                        squad.id ||
                    mission.status !==
                        'active' ||
                    mission.missionType !==
                        missionType
                ) {
                    return false;
                }

                const deadlineMs =
                    mission.deadline
                        ? new Date(
                            mission.deadline
                        ).getTime()
                        : NaN;

                return !(
                    Number.isFinite(
                        deadlineMs
                    ) &&
                    deadlineMs <
                        nowMs
                );
            })
            .sort((a, b) => {
                return (
                    new Date(
                        a.createdAt || 0
                    ).getTime() -
                    new Date(
                        b.createdAt || 0
                    ).getTime()
                );
            })
            .slice(0, 1);

    if (!activeMissions.length) {
        return {
            created: false,
            reason:
                'no_matching_active_squad_mission',
            missionType,
            sourceId,
            missions: []
        };
    }

    const missionResults = [];

    for (
        const mission of activeMissions
    ) {
        const contributionId =
            academySquadMissionContributionIdV1({
                squadId:
                    squad.id,
                missionId:
                    mission.id,
                contributorUserId:
                    cleanUid,
                eventType,
                sourceId
            });

        const existing =
            await getOne(
                ACADEMY_SQUAD_MISSION_CONTRIBUTION_RECORD_TYPE,
                squad.ownerUserId,
                contributionId
            );

        if (existing) {
            const currentMission =
                await getAcademySquadMissionByIdV1(
                    squad,
                    mission.id
                ) || mission;

            missionResults.push({
                missionId:
                    currentMission.id,
                missionTitle:
                    currentMission.title,
                created: false,
                duplicate: true,
                progress:
                    currentMission.progress,
                target:
                    currentMission.target,
                completed: false,
                status:
                    currentMission.status,
                reward: {
                    created: false,
                    awarded: 0
                }
            });

            continue;
        }

        const contribution = {
            id:
                contributionId,
            squadId:
                squad.id,
            missionId:
                mission.id,
            missionTitle:
                mission.title,
            missionType,
            contributorUserId:
                cleanUid,
            contributorName:
                sanitizeString(
                    context.member.displayName ||
                    context.member.username ||
                    'YH Member'
                ),
            contributorRole:
                sanitizeString(
                    context.membership.role ||
                    context.member.role ||
                    'member'
                ),
            eventType,
            sourceId,
            sourceType:
                sanitizeString(
                    input.sourceType
                ),
            amount,
            label:
                sanitizeString(
                    input.label ||
                    mission.title ||
                    'Squad mission contribution'
                ),
            eventAt:
                toIso(
                    input.eventAt
                ) || now,
            metadata:
                input.metadata &&
                typeof input.metadata === 'object'
                    ? input.metadata
                    : {},
            createdAt:
                now,
            updatedAt:
                now
        };

        const savedContribution =
            await upsertRecord(
                ACADEMY_SQUAD_MISSION_CONTRIBUTION_RECORD_TYPE,
                squad.ownerUserId,
                contributionId,
                contribution,
                {
                    status: 'active',
                    insertOnly: true
                }
            );

        if (!savedContribution) {
            const currentMission =
                await getAcademySquadMissionByIdV1(
                    squad,
                    mission.id
                ) || mission;

            missionResults.push({
                missionId:
                    currentMission.id,
                missionTitle:
                    currentMission.title,
                created: false,
                duplicate: true,
                progress:
                    currentMission.progress,
                target:
                    currentMission.target,
                completed: false,
                status:
                    currentMission.status,
                reward: {
                    created: false,
                    awarded: 0
                }
            });

            continue;
        }

        const reconciliation =
            await reconcileAcademySquadMissionProgressV1(
                squad,
                mission.id
            );

        const updatedMission =
            reconciliation.mission;

        const completedNow =
            reconciliation.completedNow === true;

        let reward = {
            created: false,
            awarded: 0
        };

        if (
            completedNow &&
            updatedMission.rewardXp > 0
        ) {
            reward =
                await recordAcademySquadXpContributionV1(
                    cleanUid,
                    {
                        eventType:
                            'squad_mission_reward',
                        sourceId:
                            updatedMission.id,
                        sourceType:
                            'academySquadMission',
                        xp:
                            updatedMission.rewardXp,
                        label:
                            'Squad mission completed',
                        eventAt:
                            now,
                        dedupeScope:
                            'squad',
                        metadata: {
                            missionId:
                                updatedMission.id,
                            missionTitle:
                                updatedMission.title,
                            missionType:
                                updatedMission.missionType,
                            completedByUserId:
                                cleanUid
                        }
                    }
                );
        }

        missionResults.push({
            missionId:
                updatedMission.id,
            missionTitle:
                updatedMission.title,
            created: true,
            duplicate: false,
            amount,
            progress:
                updatedMission.progress,
            target:
                updatedMission.target,
            completed:
                completedNow,
            status:
                updatedMission.status,
            reward
        });
    }

    return {
        created:
            missionResults.some(
                (entry) =>
                    entry.created === true
            ),
        missionType,
        sourceId,
        missions:
            missionResults,
        completedMissions:
            missionResults.filter(
                (entry) =>
                    entry.completed === true
            )
    };
}'''
text = replace_between(text, 'async function recordAcademySquadMissionContributionV1(', '/* PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */', new_contribution, 'mission contribution')

new_achievement = r'''async function recordAcademySquadMissionAchievementV1(
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
            achievement,
            {
                insertOnly: true
            }
        );

    if (!saved) {
        const concurrentExisting =
            await getOne(
                ACADEMY_SQUAD_MISSION_ACHIEVEMENT_RECORD_TYPE,
                ownerUserId,
                achievementId
            );

        return {
            created: false,
            duplicate: true,
            achievement:
                concurrentExisting
                    ? rowData(concurrentExisting)
                    : achievement,
            squad:
                context.squad,
            mission,
            members
        };
    }

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
}'''
text = replace_between(text, 'async function recordAcademySquadMissionAchievementV1(', '/* END PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */', new_achievement, 'achievement')

outputs[p] = text.encode('utf-8')

# ---------- realtimeSupabaseRepo.js ----------
p = paths['realtimeSupabaseRepo.js']
text, active_newline = read_source(p)
new_rt_upsert = r'''async function upsertRecord({
    recordType,
    docId,
    data = {},
    ownerUserId = '',
    roomId = '',
    targetUserId = '',
    firebaseApp = 'supabase',
    insertOnly = false
}) {
    const cleanDocId = sanitizeText(docId || makeRecordId(recordType));
    const cleanRoomId = sanitizeText(roomId);
    const collectionPath = collectionPathFor(recordType, cleanRoomId);
    const documentPath = sourcePathFor(recordType, cleanDocId, cleanRoomId);
    const existing = insertOnly
        ? null
        : await getRecordByTypeAndId(recordType, cleanDocId).catch(() => null);
    const existingData = rowData(existing);
    const now = nowIso();

    const nextData = {
        ...existingData,
        ...(data && typeof data === 'object' ? data : {}),
        updated_at: data.updated_at || data.updatedAt || now
    };

    if (!nextData.created_at && !nextData.createdAt) {
        nextData.created_at = existingData.created_at || existingData.createdAt || existing?.created_at_source || now;
    }

    const row = {
        firebase_app: firebaseApp,
        source_collection_path: collectionPath,
        source_collection_root: collectionPath.split('/')[0],
        source_collection_leaf: leafFor(recordType),
        source_document_id: cleanDocId,
        source_document_path: documentPath,
        record_type: recordType,
        owner_user_id: sanitizeText(ownerUserId) || existing?.owner_user_id || '',
        room_id: cleanRoomId || existing?.room_id || '',
        target_user_id: sanitizeText(targetUserId) || existing?.target_user_id || '',
        data: nextData,
        created_at_source: mapTimestamp(nextData.created_at || nextData.createdAt) || existing?.created_at_source || now,
        updated_at_source: mapTimestamp(nextData.updated_at || nextData.updatedAt) || now,
        updated_at: now
    };

    const query = yhuSupabaseAdmin
        .from(TABLE)
        .upsert(row, {
            onConflict: 'source_document_path',
            ignoreDuplicates: insertOnly === true
        })
        .select('*');

    const { data: saved, error } = insertOnly
        ? await query.maybeSingle()
        : await query.single();

    if (error) {
        throw new Error(
            'Realtime Supabase upsert failed: ' +
            error.message
        );
    }

    if (!saved && !insertOnly) {
        throw new Error(
            'Realtime Supabase upsert returned no record.'
        );
    }

    return saved || null;
}'''
text = replace_between(text, 'async function upsertRecord({', 'async function deleteRecord(', new_rt_upsert, 'realtime upsert')

# createNotification: modify call and post-call. easiest replace whole function
new_create_notification = r'''async function createNotification(input = {}) {
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

    const validateExisting = (existing) => {
        if (!existing) return null;

        const existingOwner =
            sanitizeText(
                existing.owner_user_id ||
                rowData(existing).user_id ||
                rowData(existing).userId
            );

        if (existingOwner !== userId) {
            throw new Error(
                'Notification ID is already in use.'
            );
        }

        return {
            created: false,
            duplicate: true,
            notification:
                mapNotificationRow(existing)
        };
    };

    const existing =
        await getRecordByTypeAndId(
            'notification',
            notificationId
        ).catch(() => null);

    if (existing) {
        return validateExisting(existing);
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
            insertOnly: true,
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
                    typeof input.metadata === 'object' &&
                    !Array.isArray(input.metadata)
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

    if (!row) {
        const concurrentExisting =
            await getRecordByTypeAndId(
                'notification',
                notificationId
            );

        return validateExisting(
            concurrentExisting
        );
    }

    return {
        created: true,
        duplicate: false,
        notification:
            mapNotificationRow(row)
    };
}'''
text = replace_between(text, 'async function createNotification(input = {})', '/* END PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */', new_create_notification, 'notification')
outputs[p] = text.encode('utf-8')

# ---------- academyControllers.js ----------
p = paths['academyControllers.js']
text, active_newline = read_source(p)
new_finalize = r'''async function finalizeAcademySquadMissionCompletionsV1(
    uid = '',
    missionProgressResult = {}
) {
    const completionMap =
        new Map();

    const rawCompletedMissions =
        Array.isArray(
            missionProgressResult
                ?.completedMissions
        )
            ? missionProgressResult
                .completedMissions
            : [];

    for (
        const entry of
        rawCompletedMissions
    ) {
        const missionId =
            sanitize(
                entry?.missionId
            );

        if (
            entry?.completed !== true ||
            !missionId ||
            completionMap.has(missionId)
        ) {
            continue;
        }

        completionMap.set(
            missionId,
            entry
        );
    }

    const completedMissions =
        Array.from(
            completionMap.values()
        );

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

            const currentMembers =
                Array.isArray(
                    achievementResult
                        ?.members
                )
                    ? achievementResult
                        .members
                        .filter(
                            (member) =>
                                sanitize(
                                    member?.userId
                                )
                        )
                    : [];

            const currentMemberMap =
                new Map(
                    currentMembers.map(
                        (member) => [
                            sanitize(
                                member.userId
                            ),
                            member
                        ]
                    )
                );

            const completionMemberIds =
                Array.isArray(
                    achievement.memberUserIds
                )
                    ? Array.from(
                        new Set(
                            achievement
                                .memberUserIds
                                .map(
                                    (memberUserId) =>
                                        sanitize(
                                            memberUserId
                                        )
                                )
                                .filter(Boolean)
                        )
                    )
                    : [];

            const members =
                completionMemberIds.length
                    ? completionMemberIds
                        .map(
                            (memberUserId) =>
                                currentMemberMap.get(
                                    memberUserId
                                ) || null
                        )
                        .filter(Boolean)
                    : currentMembers;

            const rewardXp =
                Math.max(
                    0,
                    Math.floor(
                        Number(
                            mission.rewardXp ??
                            achievement.rewardXp ??
                            completion
                                ?.reward
                                ?.awarded ??
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
                    members.map((member) => {
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
                                            ? ` and earned ${rewardXp} Squad XP.`
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
                eligibleMemberCount:
                    members.length,
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
}'''
text = replace_between(text, 'async function finalizeAcademySquadMissionCompletionsV1(', '/* END PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */', new_finalize, 'finalizer')
outputs[p] = text.encode('utf-8')


# Do not write partial patches. All replacements above must succeed first.
stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
backups = {}

try:
    for path, content in outputs.items():
        backup = path.with_name(
            path.name + f'.backup-phase-3c5b-{stamp}'
        )
        shutil.copy2(path, backup)
        backups[path] = backup
        path.write_bytes(content)

    checks = [
        paths['academyControllers.js'],
        paths['academySupabaseRepo.js'],
        paths['realtimeSupabaseRepo.js'],
    ]

    for path in checks:
        result = subprocess.run(
            ['node', '--check', str(path)],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            raise RuntimeError(
                f'Node syntax check failed for {path}:\n' +
                (result.stderr or result.stdout or 'Unknown syntax error.')
            )

except Exception:
    for path, backup in backups.items():
        if backup.exists():
            shutil.copy2(backup, path)
    raise

print('Phase 3C.5B backend integrity hardening patched successfully.')
for path in outputs:
    print(f'Updated: {path.relative_to(ROOT)}')
for path, backup in backups.items():
    print(f'Backup: {backup.relative_to(ROOT)}')
print('Syntax checks: passed')
