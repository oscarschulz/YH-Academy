from datetime import datetime
from pathlib import Path


TARGET = Path("academyControllers.js")
PATCH_MARKER = "/* PATCH: Automatic Squad Mission action hooks v1 */"


def fail(message: str) -> None:
    raise RuntimeError(message)


def get_segment(
    source: str,
    start_marker: str,
    end_marker: str,
    label: str,
) -> tuple[int, int, str]:
    start = source.find(start_marker)

    if start < 0:
        fail(f"{label}: start marker not found: {start_marker}")

    end = source.find(end_marker, start)

    if end < 0:
        fail(f"{label}: end marker not found: {end_marker}")

    return start, end, source[start:end]


def replace_segment(
    source: str,
    start_marker: str,
    end_marker: str,
    replacement: str,
    label: str,
) -> str:
    start, end, _ = get_segment(
        source,
        start_marker,
        end_marker,
        label,
    )

    return source[:start] + replacement + source[end:]


def replace_once(
    source: str,
    old: str,
    new: str,
    label: str,
) -> str:
    count = source.count(old)

    if count != 1:
        fail(
            f"{label}: expected exactly 1 match, found {count}"
        )

    return source.replace(old, new, 1)


def patch_function_segment(
    source: str,
    start_marker: str,
    end_marker: str,
    replacements: list[tuple[str, str, str]],
    label: str,
) -> str:
    start, end, segment = get_segment(
        source,
        start_marker,
        end_marker,
        label,
    )

    for old, new, replacement_label in replacements:
        segment = replace_once(
            segment,
            old,
            new,
            f"{label} / {replacement_label}",
        )

    return source[:start] + segment + source[end:]


if not TARGET.exists():
    fail(f"Target file not found: {TARGET}")

text = TARGET.read_text(encoding="utf-8")

if PATCH_MARKER in text:
    raise SystemExit(
        "Phase 3C.2A-2 is already installed. No changes made."
    )

backup_path = TARGET.with_name(
    f"{TARGET.name}.backup-phase-3c2a2-"
    f"{datetime.now().strftime('%Y%m%d-%H%M%S')}"
)

backup_path.write_text(
    text,
    encoding="utf-8",
)


# ============================================================
# 1. Squad Mission safe helper + automatic Squad XP progress
# ============================================================

new_squad_helper_block = r"""/* PATCH: Automatic Squad Mission action hooks v1 */

async function advanceAcademySquadMissionV1(
    uid = '',
    input = {}
) {
    try {
        return await academyFirestoreRepo
            .recordAcademySquadMissionContributionV1(
                uid,
                input
            );
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
            completedMissions: []
        };
    }
}

async function awardAcademySquadXpV1(
    uid = '',
    input = {}
) {
    try {
        const result =
            await academyFirestoreRepo
                .recordAcademySquadXpContributionV1(
                    uid,
                    input
                );

        const awardedXp =
            Math.max(
                0,
                Math.floor(
                    Number(
                        result?.awarded || 0
                    )
                )
            );

        const originalEventType =
            sanitize(
                input?.eventType ||
                'squad_xp'
            );

        const originalSourceId =
            sanitize(
                input?.sourceId || ''
            );

        /*
         * Only a newly created Squad XP ledger entry may
         * advance a Squad XP mission.
         */
        const squadMissionProgress =
            result?.created === true &&
            awardedXp > 0 &&
            originalSourceId
                ? await advanceAcademySquadMissionV1(
                    uid,
                    {
                        missionType:
                            'squad_xp',

                        eventType:
                            'academy_squad_xp_earned',

                        sourceId:
                            `${originalEventType}:${originalSourceId}`,

                        sourceType:
                            'academySquadXpContribution',

                        amount:
                            awardedXp,

                        label:
                            'Squad XP earned',

                        eventAt:
                            input?.eventAt ||
                            new Date()
                                .toISOString(),

                        metadata: {
                            ...(
                                input?.metadata &&
                                typeof input.metadata ===
                                    'object'
                                    ? input.metadata
                                    : {}
                            ),

                            originalEventType,
                            originalSourceId,
                            awardedXp
                        }
                    }
                )
                : null;

        return {
            ...result,
            squadMissionProgress
        };
    } catch (error) {
        /*
         * Squad progression must never make the verified
         * Academy action fail.
         */
        console.warn(
            'Academy Squad XP skipped:',
            error?.message || error
        );

        return {
            created: false,
            awarded: 0,
            reason:
                'squad_xp_failed',
            squadMissionProgress: null
        };
    }
}

/* END PATCH: Automatic Squad Mission action hooks v1 */

"""

text = replace_segment(
    text,
    "async function awardAcademySquadXpV1(",
    "async function awardAcademyMissionXpV1(",
    new_squad_helper_block,
    "Squad helper replacement",
)


# ============================================================
# 2. Academy mission completion → academy_missions +1
# ============================================================

mission_return_anchor = """        return {
            xpAwarded:
                result?.created === true
                    ? 50
"""

mission_return_replacement = """        const squadMissionProgress =
            result?.created === true
                ? await advanceAcademySquadMissionV1(
                    uid,
                    {
                        missionType:
                            'academy_missions',

                        eventType:
                            'academy_mission_completed',

                        sourceId:
                            missionId,

                        sourceType:
                            'academyMission',

                        amount:
                            1,

                        label:
                            'Academy mission completed',

                        eventAt:
                            mission.completedAt ||
                            mission.updatedAt ||
                            new Date()
                                .toISOString(),

                        metadata: {
                            title:
                                sanitize(
                                    mission.title || ''
                                ),

                            roadmapId:
                                sanitize(
                                    mission.roadmapId || ''
                                ),

                            difficultyLevel:
                                sanitize(
                                    mission.difficultyLevel ||
                                    ''
                                )
                        }
                    }
                )
                : null;

        return {
            xpAwarded:
                result?.created === true
                    ? 50
"""

text = patch_function_segment(
    text,
    "async function awardAcademyMissionXpV1(",
    "async function awardAcademyCheckinXpV1(",
    [
        (
            mission_return_anchor,
            mission_return_replacement,
            "insert Academy mission contribution",
        ),
        (
            """            squadXp
        };""",
            """            squadXp,
            squadMissionProgress
        };""",
            "return Academy mission contribution",
        ),
    ],
    "awardAcademyMissionXpV1",
)


# ============================================================
# 3. Daily check-in → daily_checkins +1
# ============================================================

checkin_return_anchor = """        return {
            xpAwarded:
                result?.created === true
                    ? 20
"""

checkin_return_replacement = """        const squadMissionProgress =
            result?.created === true
                ? await advanceAcademySquadMissionV1(
                    uid,
                    {
                        missionType:
                            'daily_checkins',

                        eventType:
                            'academy_daily_checkin',

                        sourceId:
                            checkinIdentity,

                        sourceType:
                            'academyCheckin',

                        amount:
                            1,

                        label:
                            'Daily check-in completed',

                        eventAt:
                            checkin.checkinDate ||
                            checkin.createdAt ||
                            checkin.updatedAt ||
                            new Date()
                                .toISOString(),

                        metadata: {
                            roadmapId:
                                sanitize(
                                    checkin.roadmapId || ''
                                ),

                            energyScore:
                                toInt(
                                    checkin.energyScore,
                                    0
                                ),

                            moodScore:
                                toInt(
                                    checkin.moodScore,
                                    0
                                )
                        }
                    }
                )
                : null;

        return {
            xpAwarded:
                result?.created === true
                    ? 20
"""

text = patch_function_segment(
    text,
    "async function awardAcademyCheckinXpV1(",
    "async function awardAcademyPlaybookCompletionXpV1(",
    [
        (
            checkin_return_anchor,
            checkin_return_replacement,
            "insert check-in contribution",
        ),
        (
            """            squadXp
        };""",
            """            squadXp,
            squadMissionProgress
        };""",
            "return check-in contribution",
        ),
    ],
    "awardAcademyCheckinXpV1",
)


# ============================================================
# 4. Playbook completion → mission_playbooks +1
# ============================================================

playbook_return_anchor = """        return {
            completed:
                eventResult?.created === true,
"""

playbook_return_replacement = """        const squadMissionProgress =
            eventResult?.created === true
                ? await advanceAcademySquadMissionV1(
                    uid,
                    {
                        missionType:
                            'mission_playbooks',

                        eventType:
                            'academy_mission_playbook_completed',

                        sourceId:
                            playbookKey,

                        sourceType:
                            'academyMissionPlaybook',

                        amount:
                            1,

                        label:
                            'Mission playbook completed',

                        eventAt:
                            lead.createdAt ||
                            lead.updatedAt ||
                            new Date()
                                .toISOString(),

                        metadata: {
                            playbookKey,

                            missionTitle:
                                sanitize(
                                    lead.sourceMissionTitle ||
                                    leadData.sourceMissionTitle ||
                                    ''
                                ),

                            leadId:
                                sanitize(
                                    lead.id ||
                                    leadData.id ||
                                    ''
                                )
                        }
                    }
                )
                : null;

        return {
            completed:
                eventResult?.created === true,
"""

text = patch_function_segment(
    text,
    "async function awardAcademyPlaybookCompletionXpV1(",
    "/* END PATCH: Immediate Academy progression sync after verified action v1 */",
    [
        (
            playbook_return_anchor,
            playbook_return_replacement,
            "insert playbook contribution",
        ),
        (
            """            playbookKey,
            squadXp
        };""",
            """            playbookKey,
            squadXp,
            squadMissionProgress
        };""",
            "return playbook contribution",
        ),
    ],
    "awardAcademyPlaybookCompletionXpV1",
)


# ============================================================
# 5. Newly created lead → verified_leads +1
# ============================================================

lead_action_anchor = """        const playbookCompletion =
            await awardAcademyPlaybookCompletionXpV1(
                uid,
                lead
            );

        const progression =
"""

lead_action_replacement = """        const playbookCompletion =
            await awardAcademyPlaybookCompletionXpV1(
                uid,
                lead
            );

        /*
         * This runs only inside the POST/create endpoint.
         * Editing or deleting an existing lead cannot add
         * another verified-lead contribution.
         */
        const verifiedLeadMissionProgress =
            await advanceAcademySquadMissionV1(
                uid,
                {
                    missionType:
                        'verified_leads',

                    eventType:
                        'academy_verified_lead_created',

                    sourceId:
                        sanitize(
                            lead.id ||
                            lead?.data?.id ||
                            ''
                        ),

                    sourceType:
                        'academyLeadMission',

                    amount:
                        1,

                    label:
                        'Verified lead created',

                    eventAt:
                        lead.createdAt ||
                        lead.updatedAt ||
                        new Date()
                            .toISOString(),

                    metadata: {
                        companyName:
                            sanitize(
                                lead.companyName ||
                                lead?.data?.companyName ||
                                ''
                            ),

                        contactName:
                            sanitize(
                                lead.contactName ||
                                lead?.data?.contactName ||
                                ''
                            ),

                        contactRole:
                            sanitize(
                                lead.contactRole ||
                                lead?.data?.contactRole ||
                                ''
                            ),

                        playbookKey:
                            sanitize(
                                lead.missionPlaybookKey ||
                                lead?.data?.missionPlaybookKey ||
                                ''
                            )
                    }
                }
            );

        const progression =
"""

lead_response_anchor = """            squadXp:
                playbookCompletion.squadXp ||
                {
                    created: false,
                    awarded: 0
                },

            progression
"""

lead_response_replacement = """            squadXp:
                playbookCompletion.squadXp ||
                {
                    created: false,
                    awarded: 0
                },

            squadMissionProgress: {
                verifiedLead:
                    verifiedLeadMissionProgress ||
                    null,

                missionPlaybook:
                    playbookCompletion
                        .squadMissionProgress ||
                    null,

                squadXp:
                    playbookCompletion
                        .squadXp
                        ?.squadMissionProgress ||
                    null
            },

            progression
"""

text = patch_function_segment(
    text,
    "exports.createLeadMissionLead = async",
    "exports.getMyLeadMissionLeadById = async",
    [
        (
            lead_action_anchor,
            lead_action_replacement,
            "insert verified lead contribution",
        ),
        (
            lead_response_anchor,
            lead_response_replacement,
            "expose lead Squad Mission progress",
        ),
    ],
    "createLeadMissionLead",
)


# ============================================================
# 6. Expose mission progress in both completion endpoints
# ============================================================

# ------------------------------------------------------------
# 6A. completeMission response
# Current block already contains squadXp.
# ------------------------------------------------------------

complete_mission_response_anchor = """    squadXp:
        missionXpResult.squadXp ||
        {
            created: false,
            awarded: 0
        },

    progression
"""

complete_mission_response_replacement = """    squadXp:
        missionXpResult.squadXp ||
        {
            created: false,
            awarded: 0
        },

    squadMissionProgress: {
        action:
            missionXpResult
                .squadMissionProgress ||
            null,

        squadXp:
            missionXpResult
                .squadXp
                ?.squadMissionProgress ||
            null
    },

    progression
"""

text = replace_once(
    text,
    complete_mission_response_anchor,
    complete_mission_response_replacement,
    "completeMission Squad Mission response",
)


# ------------------------------------------------------------
# 6B. updateMissionStatus completion response
# Current block does not yet contain squadXp.
# ------------------------------------------------------------

update_status_response_anchor = """    xp: {
        awarded: missionXpResult.xpAwarded,
        eventCreated: missionXpResult.created,
        eventType: 'mission_completed'
    },

    progression
"""

update_status_response_replacement = """    xp: {
        awarded:
            missionXpResult.xpAwarded,

        eventCreated:
            missionXpResult.created,

        eventType:
            'mission_completed'
    },

    squadXp:
        missionXpResult.squadXp ||
        {
            created: false,
            awarded: 0
        },

    squadMissionProgress: {
        action:
            missionXpResult
                .squadMissionProgress ||
            null,

        squadXp:
            missionXpResult
                .squadXp
                ?.squadMissionProgress ||
            null
    },

    progression
"""

text = replace_once(
    text,
    update_status_response_anchor,
    update_status_response_replacement,
    "updateMissionStatus Squad Mission response",
)


# ============================================================
# 7. Expose check-in action progress
# ============================================================

checkin_response_anchor = """    squadXp:
        checkinXpResult.squadXp ||
        {
            created: false,
            awarded: 0
        },

    progression
"""

checkin_response_replacement = """    squadXp:
        checkinXpResult.squadXp ||
        {
            created: false,
            awarded: 0
        },

    squadMissionProgress: {
        action:
            checkinXpResult
                .squadMissionProgress ||
            null,

        squadXp:
            checkinXpResult
                .squadXp
                ?.squadMissionProgress ||
            null
    },

    progression
"""

text = replace_once(
    text,
    checkin_response_anchor,
    checkin_response_replacement,
    "Check-in response",
)


TARGET.write_text(
    text,
    encoding="utf-8",
)

print("Phase 3C.2A-2 patched successfully.")
print(f"Target: {TARGET}")
print(f"Backup: {backup_path}")