const crypto = require('crypto');
const { firestore } = require('../../config/firebaseAdmin');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const academyMemberProfileSupabaseRepo =
    require(
        './academyMemberProfileSupabaseRepo'
    );

const yhuUsersSupabaseRepo =
    require(
        './yhuUsersSupabaseRepo'
    );

const TABLE = 'yhu_academy_core_records';
const usersCollection = firestore.collection('users');

function nowIso() {
    return new Date().toISOString();
}

function sanitizeString(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value) {
    if (value === true) return true;
    const clean = sanitizeString(value).toLowerCase();
    return clean === 'true' || clean === 'yes' || clean === '1';
}

function toIso(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();

    if (typeof value === 'object') {
        if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
        if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();
    }

    return sanitizeString(value);
}

function sanitizeStringArray(values = [], limit = 4) {
    const source = Array.isArray(values)
        ? values
        : String(values || '').split(/\n|•|- |,/g);

    const seen = new Set();
    const out = [];

    for (const value of source) {
        const clean = sanitizeString(value);
        const key = clean.toLowerCase();

        if (!clean || seen.has(key)) continue;

        seen.add(key);
        out.push(clean);

        if (out.length >= limit) break;
    }

    return out;
}

function normalizeProfileTagList(values = []) {
    const source = Array.isArray(values)
        ? values
        : String(values || '').split(',');

    const seen = new Set();
    const out = [];

    for (const value of source) {
        const clean = sanitizeString(value)
            .toLowerCase()
            .replace(/^#/, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9_-]/g, '')
            .slice(0, 32);

        if (!clean || seen.has(clean)) continue;
        seen.add(clean);
        out.push(clean);

        if (out.length >= 8) break;
    }

    return out;
}

function normalizeProfileSignalList(values = []) {
    const source = Array.isArray(values)
        ? values
        : String(values || '').split(',');

    const seen = new Set();
    const out = [];

    for (const value of source) {
        const clean = sanitizeString(value).slice(0, 48);
        const lowered = clean.toLowerCase();

        if (!clean || seen.has(lowered)) continue;
        seen.add(lowered);
        out.push(clean);

        if (out.length >= 8) break;
    }

    return out;
}

function rowData(row = {}) {
    return row && row.data && typeof row.data === 'object' ? row.data : {};
}

function makeId(prefix = 'academy') {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function collectionPathFor(recordType = '', uid = '') {
    const userRoot = `users/${uid}`;

    if (recordType === 'academy:profile' || recordType === 'academy:access' || recordType === 'academy:leadMissionScripts') {
        return `${userRoot}/academy`;
    }

    if (recordType === 'academyRoadmaps') return `${userRoot}/academyRoadmaps`;
    if (recordType === 'academyMissions') return `${userRoot}/academyMissions`;
    if (recordType === 'academyCheckins') return `${userRoot}/academyCheckins`;
    if (recordType === 'academyCoachMessages') return `${userRoot}/academyCoachMessages`;
    if (recordType === 'academyPlannerRuns') return `${userRoot}/academyPlannerRuns`;
    if (recordType === 'academyLeadMissions') return `${userRoot}/academyLeadMissions`;
    if (recordType === 'academyLeadContacts') return `${userRoot}/academyLeadContacts`;
    if (recordType === 'academyLeadPayouts') return `${userRoot}/academyLeadPayouts`;
    if (recordType === 'academyLeadDeals') return `${userRoot}/academyLeadDeals`;

    if (recordType === 'academy:progression') {
        return `${userRoot}/academyProgression`;
    }

    if (recordType === 'academyXpEvents') {
        return `${userRoot}/academyXpEvents`;
    }

    if (recordType === 'academySoloEvents') {
        return `${userRoot}/academySoloEvents`;
    }

    return `${userRoot}/academy`;
}

function sourcePathFor(recordType = '', uid = '', docId = '') {
    return `${collectionPathFor(recordType, uid)}/${docId}`;
}

function primaryRecordTypeForDocId(docId = '') {
    if (docId === 'profile') return 'academy:profile';
    if (docId === 'access') return 'academy:access';
    if (docId === 'leadMissionScripts') return 'academy:leadMissionScripts';
    return 'academy:meta';
}

async function getRows(recordType, uid, options = {}) {
    const limit = Math.max(1, Math.min(500, Number(options.limit) || 100));

    let query = yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', recordType)
        .eq('user_id', String(uid))
        .limit(limit);

    query = query.order('updated_at_source', { ascending: false, nullsFirst: false });

    const { data, error } = await query;

    if (error) {
        throw new Error(`Academy Supabase list failed (${recordType}): ${error.message}`);
    }

    let rows = Array.isArray(data) ? data : [];

    if (options.roadmapId) {
        const cleanRoadmapId = sanitizeString(options.roadmapId);
        rows = rows.filter((row) => {
            const data = rowData(row);
            return sanitizeString(data.roadmapId || data.roadmap_id || row.roadmap_id) === cleanRoadmapId;
        });
    }

    if (options.status) {
        const cleanStatus = sanitizeString(options.status).toLowerCase();
        rows = rows.filter((row) => {
            const data = rowData(row);
            return sanitizeString(data.status || row.status).toLowerCase() === cleanStatus;
        });
    }

    return rows;
}

async function deleteAllCoreRecordsByUserId(uid = '') {
    const cleanUid = sanitizeString(uid);

    if (!cleanUid) {
        return { deleted: 0, skipped: true, reason: 'missing_uid' };
    }

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .delete()
        .eq('user_id', cleanUid)
        .select('id');

    if (error) {
        throw new Error(`Academy Supabase account wipe failed (${cleanUid}): ${error.message}`);
    }

    return {
        deleted: Array.isArray(data) ? data.length : 0
    };
}

async function getOne(recordType, uid, docId) {
    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('record_type', recordType)
        .eq('user_id', String(uid))
        .eq('source_document_id', String(docId))
        .maybeSingle();

    if (error) {
        throw new Error(`Academy Supabase get failed (${recordType}/${docId}): ${error.message}`);
    }

    return data || null;
}

async function upsertRecord(recordType, uid, docId, payload = {}, extra = {}) {
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
}

function normalizeForJson(value) {
    if (Array.isArray(value)) return value.map(normalizeForJson);

    if (value && typeof value === 'object') {
        if (typeof value.toDate === 'function') return value.toDate().toISOString();
        if (value instanceof Date) return value.toISOString();

        const out = {};
        for (const [key, item] of Object.entries(value)) {
            out[key] = normalizeForJson(item);
        }
        return out;
    }

    return value;
}

function mapStoredProfileData(data = {}) {
    return {
        display_name: sanitizeString(data.display_name || data.displayName || data.fullName || data.name),
        username: sanitizeString(data.username).replace(/^@+/, ''),
        avatar: sanitizeString(data.avatar || data.profilePhoto || data.photoURL),
        cover_photo: sanitizeString(data.cover_photo || data.coverPhoto),
        role_label: sanitizeString(data.role_label || data.roleLabel || data.role || 'Academy Member'),
        bio: sanitizeString(data.bio || data.profileBio || data.about || data.description),
        search_tags: normalizeProfileTagList(data.search_tags || data.searchTags || data.tags || data.signals?.tags),
        searchTags: normalizeProfileTagList(data.search_tags || data.searchTags || data.tags || data.signals?.tags),
        tags: normalizeProfileTagList(data.search_tags || data.searchTags || data.tags || data.signals?.tags),

        role_track: sanitizeString(data.role_track || data.roleTrack),
        looking_for: normalizeProfileSignalList(data.looking_for || data.lookingFor),
        can_offer: normalizeProfileSignalList(data.can_offer || data.canOffer),
        availability: sanitizeString(data.availability),
        work_mode: sanitizeString(data.work_mode || data.workMode),
        proof_focus: sanitizeString(data.proof_focus || data.proofFocus),
        marketplace_ready: data.marketplace_ready === true || data.marketplaceReady === true || sanitizeString(data.marketplace_ready || data.marketplaceReady).toLowerCase() === 'yes',

        behaviorProfile: data.behaviorProfile && typeof data.behaviorProfile === 'object' ? data.behaviorProfile : {},
        plannerStats: data.plannerStats && typeof data.plannerStats === 'object' ? data.plannerStats : {},

        version: toNumber(data.version, 1),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
    };
}

function mapRoadmapData(data = {}, id = '') {
    const summary = data.summary && typeof data.summary === 'object' ? data.summary : {};
    const roadmap = data.roadmap && typeof data.roadmap === 'object' ? data.roadmap : {};
    const weeklyOperatingSystem =
        roadmap.weeklyOperatingSystem && typeof roadmap.weeklyOperatingSystem === 'object'
            ? roadmap.weeklyOperatingSystem
            : {};
    const adaptivePlanning = data.adaptivePlanning && typeof data.adaptivePlanning === 'object'
        ? data.adaptivePlanning
        : {};

    return {
        id: sanitizeString(data.id || id),
        version: toNumber(data.version, 1),
        status: sanitizeString(data.status || 'active'),
        readinessScore: toNumber(data.readinessScore, 0),
        focusAreas: Array.isArray(data.focusAreas) ? data.focusAreas : [],
        summary: {
            primaryBottleneck: sanitizeString(summary.primaryBottleneck),
            secondaryBottleneck: sanitizeString(summary.secondaryBottleneck),
            mainOpportunity: sanitizeString(summary.mainOpportunity),
            strengths: Array.isArray(summary.strengths) ? summary.strengths : []
        },
        roadmap: {
            goal: sanitizeString(roadmap.goal),
            coachTone: sanitizeString(roadmap.coachTone || 'balanced'),
            weeklyTheme: sanitizeString(roadmap.weeklyTheme),
            weeklyTargetOutcome: sanitizeString(roadmap.weeklyTargetOutcome),
            coachBrief: sanitizeString(roadmap.coachBrief),
            weeklyOperatingSystem: {
                weekStartsOn: sanitizeString(weeklyOperatingSystem.weekStartsOn),
                weeklyReviewDay: sanitizeString(weeklyOperatingSystem.weeklyReviewDay),
                reviewInstruction: sanitizeString(weeklyOperatingSystem.reviewInstruction),
                delegationRule: sanitizeString(weeklyOperatingSystem.delegationRule)
            },
            recommendedResources: Array.isArray(roadmap.recommendedResources) ? roadmap.recommendedResources : [],
            days30: roadmap.days30 && typeof roadmap.days30 === 'object' ? roadmap.days30 : {}
        },
        plannerRunId: sanitizeString(data.plannerRunId),
        adaptivePlanning,
        nurtureTelemetry: data.nurtureTelemetry && typeof data.nurtureTelemetry === 'object' ? data.nurtureTelemetry : {},
        createdByModel: sanitizeString(data.createdByModel || 'academy-rule-engine-v1'),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        archivedAt: data.archivedAt || null
    };
}

function mapMissionData(data = {}, id = '') {
    const outcomeMetrics = data.outcomeMetrics && typeof data.outcomeMetrics === 'object' ? data.outcomeMetrics : {};
    const qualityScores = data.qualityScores && typeof data.qualityScores === 'object' ? data.qualityScores : {};
    const verificationScores = data.verificationScores && typeof data.verificationScores === 'object' ? data.verificationScores : {};

    return {
        id: sanitizeString(data.id || id),
        roadmapId: sanitizeString(data.roadmapId),
        pillar: sanitizeString(data.pillar),
        title: sanitizeString(data.title),
        description: sanitizeString(data.description),
        doneLooksLike: sanitizeString(data.doneLooksLike),
        whyItMatters: sanitizeString(data.whyItMatters),
        missionObjective: sanitizeString(data.missionObjective),
        microActions: sanitizeStringArray(data.microActions, 4),
        proofOfCompletion: sanitizeString(data.proofOfCompletion),
        reflectionPrompt: sanitizeString(data.reflectionPrompt),
        difficultyLevel: sanitizeString(data.difficultyLevel || 'standard'),
        lifeAreaImpact: sanitizeStringArray(data.lifeAreaImpact, 4),
        status: sanitizeString(data.status || 'pending'),
        frequency: sanitizeString(data.frequency),
        dueDate: sanitizeString(data.dueDate),
        estimatedMinutes: toNumber(data.estimatedMinutes, 0),
        completionNote: sanitizeString(data.completionNote),
        workingNote: sanitizeString(data.workingNote),
        proofNote: sanitizeString(data.proofNote),
        reflectionNote: sanitizeString(data.reflectionNote),
        skipReason: sanitizeString(data.skipReason),
        stuckReason: sanitizeString(data.stuckReason),
        noteUpdatedAt: data.noteUpdatedAt || null,
        verificationStatus: sanitizeString(data.verificationStatus || 'draft'),
        verificationDecision: sanitizeString(data.verificationDecision),
        verificationConfidence: Math.max(0, Math.min(1, toNumber(data.verificationConfidence, 0))),
        verificationScores: {
            relevance: toNumber(verificationScores.relevance, 0),
            specificity: toNumber(verificationScores.specificity, 0),
            requirementCoverage: toNumber(verificationScores.requirementCoverage, 0),
            reflectionQuality: toNumber(verificationScores.reflectionQuality, 0),
            evidenceStrength: toNumber(verificationScores.evidenceStrength, 0)
        },
        verificationFeedback: sanitizeString(data.verificationFeedback),
        verificationMissingItems: sanitizeStringArray(data.verificationMissingItems, 6),
        verificationEvidenceSummary: sanitizeString(data.verificationEvidenceSummary),
        verificationProvider: sanitizeString(data.verificationProvider),
        verificationModel: sanitizeString(data.verificationModel),
        verificationRequestedAt: data.verificationRequestedAt || null,
        verificationCompletedAt: data.verificationCompletedAt || null,
        verificationAttemptCount: toNumber(data.verificationAttemptCount, 0),
        source: sanitizeString(data.source || 'rule'),
        sortOrder: toNumber(data.sortOrder, 0),
        foundationDay: toNumber(data.foundationDay, 0),
        foundationWeek: toNumber(data.foundationWeek, 0),
        foundationMonth: toNumber(data.foundationMonth, 0),
        missionType: sanitizeString(data.missionType || ''),
        activationHydration: data.activationHydration && typeof data.activationHydration === 'object' ? data.activationHydration : {},
        selectionReason: sanitizeString(data.selectionReason),
        primaryBottleneck: sanitizeString(data.primaryBottleneck),
        generatedByProvider: sanitizeString(data.generatedByProvider),
        generatedByModel: sanitizeString(data.generatedByModel),
        promptVersion: sanitizeString(data.promptVersion),
        schemaVersion: sanitizeString(data.schemaVersion),
        generationMode: sanitizeString(data.generationMode),
        energyAdjustmentApplied: data.energyAdjustmentApplied === true,
        timeAdjustmentApplied: data.timeAdjustmentApplied === true,
        qualityScores: {
            specificity: toNumber(qualityScores.specificity, 0),
            measurability: toNumber(qualityScores.measurability, 0),
            realism: toNumber(qualityScores.realism, 0),
            bottleneckFit: toNumber(qualityScores.bottleneckFit, 0)
        },
        outcomeMetrics: {
            skipCount: toNumber(outcomeMetrics.skipCount, 0),
            stuckCount: toNumber(outcomeMetrics.stuckCount, 0),
            rescheduleCount: toNumber(outcomeMetrics.rescheduleCount, 0),
            completionLagHours: toNumber(outcomeMetrics.completionLagHours, 0),
            userDifficultyScore: toNumber(outcomeMetrics.userDifficultyScore, 0),
            userUsefulnessScore: toNumber(outcomeMetrics.userUsefulnessScore, 0),
            lastSkipReasonCategory: sanitizeString(outcomeMetrics.lastSkipReasonCategory)
        },
        completedAt: data.completedAt || null,
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
    };
}

function mapCheckinData(data = {}, id = '') {
    return {
        id: sanitizeString(data.id || id),
        roadmapId: sanitizeString(data.roadmapId),
        energyScore: toNumber(data.energyScore, 0),
        moodScore: toNumber(data.moodScore, 0),
        disciplineScore: toNumber(data.disciplineScore, 0),
        completedToday: data.completedToday === true,
        badHabitAvoided: data.badHabitAvoided === true,
        avoidanceCategory: sanitizeString(data.avoidanceCategory),
        avoidanceNote: sanitizeString(data.avoidanceNote),
        reflectionText: sanitizeString(data.reflectionText),
        correctionForTomorrow: sanitizeString(data.correctionForTomorrow),
        completedSummary: sanitizeString(data.completedSummary),
        blockerText: sanitizeString(data.blockerText),
        tomorrowFocus: sanitizeString(data.tomorrowFocus),
        checkinDate: sanitizeString(data.checkinDate),
        aiFeedback: data.aiFeedback && typeof data.aiFeedback === 'object' ? data.aiFeedback : {},
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
    };
}

function mapCoachMessageData(data = {}, id = '') {
    return {
        id: sanitizeString(data.id || id),
        conversationId: sanitizeString(data.conversationId || 'coach_main'),
        role: sanitizeString(data.role || 'assistant'),
        text: sanitizeString(data.text),
        contextHint: sanitizeString(data.contextHint),
        provider: sanitizeString(data.provider),
        model: sanitizeString(data.model),
        replyFormat: sanitizeString(data.replyFormat),
        coachModeKey: sanitizeString(data.coachModeKey),
        responseStyleVersion: sanitizeString(data.responseStyleVersion),
        grounding: data.grounding && typeof data.grounding === 'object' ? data.grounding : {},
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
    };
}

function mapLeadMissionLeadData(data = {}, id = '') {
    return {
        id: sanitizeString(data.id || id),
        companyName: sanitizeString(data.companyName || data.company_name),
        contactName: sanitizeString(data.contactName || data.contact_name),
        contactRole: sanitizeString(data.contactRole || data.contact_role),
        email: sanitizeString(data.email).toLowerCase(),
        phone: sanitizeString(data.phone),
        website: sanitizeString(data.website),
        country: sanitizeString(data.country),
        city: sanitizeString(data.city),
        industry: sanitizeString(data.industry),
        tier: sanitizeString(data.tier || 'T1'),
        status: sanitizeString(data.status || 'active'),
        taskStatus: sanitizeString(data.taskStatus || data.task_status || 'Waiting'),
        nextAction: sanitizeString(data.nextAction || data.next_action),
        stage: sanitizeString(data.stage || data.pipelineStage || data.pipeline_stage),
        outcome: sanitizeString(data.outcome || data.callOutcome || data.call_outcome),
        followUpDueDate: sanitizeString(data.followUpDueDate || data.follow_up_due_date),
        notes: sanitizeString(data.notes),
        sourceMethod: sanitizeString(data.sourceMethod),
        routedFromAdmin: data.routedFromAdmin === true,
        assignmentStatus: sanitizeString(data.assignmentStatus),
        callType: sanitizeString(data.callType),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        data
    };
}

function mapPayoutData(data = {}, id = '') {
    return {
        id: sanitizeString(data.id || id),
        status: sanitizeString(data.status),
        amount: toNumber(data.amount, 0),
        currency: sanitizeString(data.currency || 'USD').toUpperCase(),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        data
    };
}

function mapDealData(data = {}, id = '') {
    return {
        id: sanitizeString(data.id || id),
        status: sanitizeString(data.status),
        title: sanitizeString(data.title),
        amount: toNumber(data.amount || data.expectedValueAmount, 0),
        currency: sanitizeString(data.currency || 'USD').toUpperCase(),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        data
    };
}

async function getCurrentProfile(uid) {
    const row = await getOne('academy:profile', uid, 'profile');
    if (!row) return null;
    return mapStoredProfileData(rowData(row));
}

async function setCurrentProfile(uid, payload = {}) {
    const existing = await getCurrentProfile(uid).catch(() => null) || {};
    const ts = nowIso();
    const normalized = mapStoredProfileData(payload || {});

    const nextProfile = {
        ...existing,
        ...normalized,
        role_label: normalized.role_label || existing.role_label || 'Academy Member',
        bio: normalized.bio || existing.bio || 'Focused on execution, consistency, and long-term growth inside The Academy.',
        search_tags: normalizeProfileTagList(normalized.search_tags || existing.search_tags || existing.searchTags || existing.tags),
        searchTags: normalizeProfileTagList(normalized.search_tags || existing.search_tags || existing.searchTags || existing.tags),
        tags: normalizeProfileTagList(normalized.search_tags || existing.search_tags || existing.searchTags || existing.tags),
        updatedAt: ts,
        createdAt: existing.createdAt || ts,
        version: Math.max(1, toNumber(existing.version, 0) + 1)
    };

    await upsertRecord('academy:profile', uid, 'profile', nextProfile);

    const nextPublicName = sanitizeString(nextProfile.display_name) || 'Hustler';

    await usersCollection.doc(String(uid)).set({
        displayName: nextPublicName,
        fullName: nextPublicName,
        name: nextPublicName,
        username: nextProfile.username,
        avatar: nextProfile.avatar,
        profilePhoto: nextProfile.avatar,
        photoURL: nextProfile.avatar,
        bio: nextProfile.bio,
        profileBio: nextProfile.bio,
        roleLabel: nextProfile.role_label || 'Academy Member',
        searchTags: nextProfile.search_tags,
        coverPhoto: nextProfile.cover_photo,
        roleTrack: nextProfile.role_track || '',
        lookingFor: Array.isArray(nextProfile.looking_for) ? nextProfile.looking_for : [],
        canOffer: Array.isArray(nextProfile.can_offer) ? nextProfile.can_offer : [],
        availability: nextProfile.availability || '',
        workMode: nextProfile.work_mode || '',
        proofFocus: nextProfile.proof_focus || '',
        marketplaceReady: nextProfile.marketplace_ready === true,
        academyProfileUpdatedAt: ts,
        updatedAt: ts
    }, { merge: true }).catch((error) => {
        console.warn('academy supabase profile user mirror skipped:', error?.message || error);
    });

    return nextProfile;
}

async function deleteCurrentProfile(uid) {
    await upsertRecord('academy:profile', uid, 'profile', {
        deletedAt: nowIso(),
        status: 'deleted'
    }, { status: 'deleted' });

    return true;
}

async function getAccessState(uid) {
    const row = await getOne('academy:access', uid, 'access');
    const data = rowData(row);

    return {
        accessState: sanitizeString(data.accessState || data.status || 'none'),
        unlockedAt: data.unlockedAt || null,
        lastAssessedAt: data.lastAssessedAt || null,
        updatedAt: data.updatedAt || null
    };
}

async function setAccessUnlocked(uid) {
    const ts = nowIso();

    await upsertRecord('academy:access', uid, 'access', {
        accessState: 'unlocked',
        status: 'unlocked',
        unlockedAt: ts,
        lastAssessedAt: ts,
        updatedAt: ts,
        createdAt: ts
    }, { status: 'unlocked' });

    return getAccessState(uid);
}

async function getRoadmapById(uid, roadmapId) {
    const row = await getOne('academyRoadmaps', uid, roadmapId);
    if (!row) return null;
    return mapRoadmapData(rowData(row), row.source_document_id);
}

async function getActiveRoadmap(uid) {
    const rows = await getRows('academyRoadmaps', uid, { limit: 100 });
    const mapped = rows.map((row) => mapRoadmapData(rowData(row), row.source_document_id));

    return mapped.find((item) => sanitizeString(item.status || 'active').toLowerCase() === 'active')
        || mapped[0]
        || null;
}

async function listAllMissionsByRoadmap(uid, roadmapId) {
    const rows = await getRows('academyMissions', uid, { roadmapId, limit: 300 });

    return rows
        .map((row) => mapMissionData(rowData(row), row.source_document_id))
        .sort((a, b) => {
            const sortA = toNumber(a.sortOrder, 0);
            const sortB = toNumber(b.sortOrder, 0);
            if (sortA !== sortB) return sortA - sortB;
            return String(a.id || '').localeCompare(String(b.id || ''));
        });
}

async function listRecentMissions(uid, roadmapId, limit = 8) {
    const missions = await listAllMissionsByRoadmap(uid, roadmapId);

    return missions
        .slice()
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
        .slice(0, Math.max(1, Math.min(100, Number(limit) || 8)));
}

async function getMissionById(uid, missionId) {
    const row = await getOne('academyMissions', uid, missionId);
    if (!row) return null;
    return mapMissionData(rowData(row), row.source_document_id);
}

async function updateMissionCompletion(uid, missionId, completionNote = '') {
    const mission = await getMissionById(uid, missionId);
    if (!mission) return null;

    const now = nowIso();
    const data = {
        ...mission,
        status: 'completed',
        completionNote: sanitizeString(completionNote),
        completedAt: now,
        updatedAt: now
    };

    const saved = await upsertRecord('academyMissions', uid, missionId, data, {
        roadmapId: data.roadmapId,
        status: data.status
    });

    return mapMissionData(rowData(saved), missionId);
}

async function updateMissionStatus(uid, missionId, statusPayload = {}) {
    const mission = await getMissionById(uid, missionId);
    if (!mission) return null;

    const now = nowIso();
    const status = sanitizeString(statusPayload.status || statusPayload.missionStatus || mission.status || 'pending');

    const data = {
        ...mission,
        ...statusPayload,
        status,
        updatedAt: now,
        ...(status === 'completed' ? { completedAt: mission.completedAt || now } : {})
    };

    const saved = await upsertRecord('academyMissions', uid, missionId, data, {
        roadmapId: data.roadmapId,
        status: data.status
    });

    return mapMissionData(rowData(saved), missionId);
}

const updateMission = updateMissionStatus;


async function mutateMissionWithVersionRetryV1(
    uid,
    missionId,
    mutate,
    maxAttempts = 4
) {
    const cleanUid = sanitizeString(uid);
    const cleanMissionId = sanitizeString(missionId);

    if (
        !cleanUid ||
        !cleanMissionId ||
        typeof mutate !== 'function'
    ) {
        return null;
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const currentRow = await getOne(
            'academyMissions',
            cleanUid,
            cleanMissionId
        );

        if (!currentRow) {
            return null;
        }

        const currentData = rowData(currentRow);
        const nextPayload = mutate(
            {
                ...currentData
            },
            attempt
        );

        if (!nextPayload || typeof nextPayload !== 'object') {
            return {
                row: currentRow,
                mission: mapMissionData(
                    currentData,
                    cleanMissionId
                ),
                skipped: true
            };
        }

        const saved = await updateRecordDataWithVersionV1(
            'academyMissions',
            cleanUid,
            cleanMissionId,
            currentRow,
            nextPayload
        );

        if (saved) {
            return {
                row: saved,
                mission: mapMissionData(
                    rowData(saved),
                    cleanMissionId
                ),
                skipped: false
            };
        }
    }

    const error = new Error(
        'Mission changed while saving. Please retry.'
    );

    error.statusCode = 409;
    throw error;
}

async function saveMissionJournalV1(uid, missionId, payload = {}) {
    const ts = nowIso();

    const result = await mutateMissionWithVersionRetryV1(
        uid,
        missionId,
        (currentData) => {
            if (
                sanitizeString(currentData.status).toLowerCase() ===
                'completed'
            ) {
                return null;
            }

            const next = {
                workingNote: sanitizeString(
                    payload.workingNote ??
                    currentData.workingNote
                ),
                proofNote: sanitizeString(
                    payload.proofNote ??
                    currentData.proofNote
                ),
                reflectionNote: sanitizeString(
                    payload.reflectionNote ??
                    currentData.reflectionNote
                ),
                noteUpdatedAt: ts
            };

            [
                'verificationStatus',
                'verificationDecision',
                'verificationFeedback',
                'verificationEvidenceSummary',
                'verificationProvider',
                'verificationModel',
                'verificationRequestedAt',
                'verificationCompletedAt',
                'verificationAttemptCount'
            ].forEach((key) => {
                if (payload[key] !== undefined) {
                    next[key] = payload[key];
                }
            });

            if (payload.verificationConfidence !== undefined) {
                next.verificationConfidence = Math.max(
                    0,
                    Math.min(
                        1,
                        toNumber(
                            payload.verificationConfidence,
                            0
                        )
                    )
                );
            }

            if (
                payload.verificationScores &&
                typeof payload.verificationScores === 'object'
            ) {
                next.verificationScores =
                    payload.verificationScores;
            }

            if (payload.verificationMissingItems !== undefined) {
                next.verificationMissingItems =
                    sanitizeStringArray(
                        payload.verificationMissingItems,
                        6
                    );
            }

            return next;
        }
    );

    return result?.mission || null;
}

async function saveMissionVerificationV1(uid, missionId, payload = {}) {
    return saveMissionJournalV1(
        uid,
        missionId,
        payload
    );
}

async function completeMissionAfterVerificationV1(
    uid,
    missionId,
    payload = {}
) {
    const ts = nowIso();
    let transitioned = false;

    const result = await mutateMissionWithVersionRetryV1(
        uid,
        missionId,
        (currentData) => {
            if (
                sanitizeString(currentData.status).toLowerCase() ===
                'completed'
            ) {
                return null;
            }

            transitioned = true;

            return {
                workingNote: sanitizeString(
                    payload.workingNote ??
                    currentData.workingNote
                ),
                proofNote: sanitizeString(
                    payload.proofNote ??
                    currentData.proofNote
                ),
                reflectionNote: sanitizeString(
                    payload.reflectionNote ??
                    currentData.reflectionNote
                ),
                completionNote: sanitizeString(
                    payload.completionNote ??
                    payload.proofNote ??
                    currentData.completionNote
                ),
                noteUpdatedAt: ts,
                verificationStatus: sanitizeString(
                    payload.verificationStatus ||
                    'approved'
                ),
                verificationDecision: sanitizeString(
                    payload.verificationDecision ||
                    'approved'
                ),
                verificationConfidence: Math.max(
                    0,
                    Math.min(
                        1,
                        toNumber(
                            payload.verificationConfidence,
                            0
                        )
                    )
                ),
                verificationScores:
                    payload.verificationScores &&
                    typeof payload.verificationScores === 'object'
                        ? payload.verificationScores
                        : {},
                verificationFeedback: sanitizeString(
                    payload.verificationFeedback
                ),
                verificationMissingItems: sanitizeStringArray(
                    payload.verificationMissingItems,
                    6
                ),
                verificationEvidenceSummary: sanitizeString(
                    payload.verificationEvidenceSummary
                ),
                verificationProvider: sanitizeString(
                    payload.verificationProvider
                ),
                verificationModel: sanitizeString(
                    payload.verificationModel
                ),
                verificationRequestedAt:
                    payload.verificationRequestedAt ||
                    currentData.verificationRequestedAt ||
                    ts,
                verificationCompletedAt:
                    payload.verificationCompletedAt ||
                    ts,
                verificationAttemptCount: toNumber(
                    payload.verificationAttemptCount ??
                    currentData.verificationAttemptCount,
                    0
                ),
                status: 'completed',
                completedAt: ts,
                updatedAt: ts
            };
        }
    );

    return {
        mission: result?.mission || null,
        transitioned:
            transitioned &&
            result?.skipped !== true
    };
}

/* END PATCH: Phase 3C.6E — Mission Journal persistence and verified completion v1 */

async function updateMissionOutcomeMetrics(uid, missionId, metrics = {}) {
    const mission = await getMissionById(uid, missionId);
    if (!mission) return null;

    const outcomeMetrics = {
        ...(mission.outcomeMetrics && typeof mission.outcomeMetrics === 'object' ? mission.outcomeMetrics : {}),
        ...(metrics && typeof metrics === 'object' ? metrics : {})
    };

    return updateMissionStatus(uid, missionId, {
        outcomeMetrics
    });
}

async function getMissionProgress(uid, roadmapId) {
    const missions = await listAllMissionsByRoadmap(uid, roadmapId);
    const total = missions.length;
    const completed = missions.filter((item) => item.status === 'completed').length;
    const pending = missions.filter((item) => item.status === 'pending').length;
    const skipped = missions.filter((item) => item.status === 'skipped').length;
    const stuck = missions.filter((item) => item.status === 'stuck').length;

    return {
        total,
        completed,
        pending,
        skipped,
        stuck,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
}

async function listRecentCheckins(uid, roadmapId, limit = 5) {
    const rows = await getRows('academyCheckins', uid, { roadmapId, limit: 200 });

    return rows
        .map((row) => mapCheckinData(rowData(row), row.source_document_id))
        .sort((a, b) => String(b.checkinDate || b.createdAt || '').localeCompare(String(a.checkinDate || a.createdAt || '')))
        .slice(0, Math.max(1, Math.min(100, Number(limit) || 5)));
}

async function createCheckin(uid, roadmapId, payload = {}) {
    const now = nowIso();
    const checkinDate = sanitizeString(payload.checkinDate || now.slice(0, 10));
    const id = sanitizeString(payload.id || `checkin_${checkinDate}_${crypto.randomBytes(3).toString('hex')}`);

    const data = {
        ...payload,
        id,
        roadmapId,
        checkinDate,
        createdAt: payload.createdAt || now,
        updatedAt: now
    };

    const saved = await upsertRecord('academyCheckins', uid, id, data, {
        roadmapId
    });

    return mapCheckinData(rowData(saved), id);
}

async function getRecentCheckinStreakDays(uid) {
    const activeRoadmap = await getActiveRoadmap(uid);
    if (!activeRoadmap) return 0;

    const checkins = await listRecentCheckins(uid, activeRoadmap.id, 60);
    const dates = new Set(checkins.map((item) => sanitizeString(item.checkinDate)).filter(Boolean));

    let streak = 0;
    const cursor = new Date();

    for (let i = 0; i < 60; i += 1) {
        const key = cursor.toISOString().slice(0, 10);
        if (!dates.has(key)) break;
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
}

function buildAcademyPlazaReadinessPayload(profileDoc = {}, roadmap = {}, missions = []) {
    const roleTrack = sanitizeString(profileDoc?.role_track || profileDoc?.roleTrack);
    const lookingFor = normalizeProfileSignalList(profileDoc?.looking_for || profileDoc?.lookingFor);
    const canOffer = normalizeProfileSignalList(profileDoc?.can_offer || profileDoc?.canOffer);
    const availability = sanitizeString(profileDoc?.availability);
    const workMode = sanitizeString(profileDoc?.work_mode || profileDoc?.workMode);
    const proofFocus = sanitizeString(profileDoc?.proof_focus || profileDoc?.proofFocus);

    const marketplaceReady =
        profileDoc?.marketplace_ready === true ||
        profileDoc?.marketplaceReady === true ||
        sanitizeString(profileDoc?.marketplace_ready || profileDoc?.marketplaceReady).toLowerCase() === 'yes';

    const safeMissions = Array.isArray(missions) ? missions : [];
    const completedCount = safeMissions.filter((item) => item.status === 'completed').length;
    const totalCount = safeMissions.length;
    const completionRatio = totalCount > 0 ? completedCount / totalCount : 0;

    let profileScore = 0;
    if (roleTrack) profileScore += 12;
    if (lookingFor.length > 0) profileScore += 12;
    if (canOffer.length > 0) profileScore += 16;
    if (availability) profileScore += 8;
    if (workMode) profileScore += 8;
    if (proofFocus) profileScore += 14;

    const missionRatioScore = completionRatio >= 0.8 ? 10 : completionRatio >= 0.45 ? 6 : completionRatio > 0 ? 3 : 0;
    const missionVolumeScore = completedCount >= 8 ? 10 : completedCount >= 5 ? 8 : completedCount >= 3 ? 6 : completedCount > 0 ? 3 : 0;
    const score = Math.max(0, Math.min(100, profileScore + missionRatioScore + missionVolumeScore + (marketplaceReady ? 5 : 0)));

    return {
        score,
        status: score >= 70 ? 'ready' : score >= 40 ? 'building' : 'needs_profile',
        nextStep: !roleTrack
            ? 'Choose your role track first so The Academy knows what economic direction you are building toward.'
            : canOffer.length === 0
                ? 'Clarify what you can offer so Plaza can match you to real opportunities later.'
                : 'Keep completing missions and polishing your public operator signals.',
        profileSignals: {
            roleTrack,
            lookingFor,
            canOffer,
            availability,
            workMode,
            proofFocus,
            marketplaceReady
        },
        completedMissions: completedCount,
        totalMissions: totalCount
    };
}

async function buildAcademyHomePayload(uid, roadmapId = null) {
    const roadmap = roadmapId ? await getRoadmapById(uid, roadmapId) : await getActiveRoadmap(uid);
    if (!roadmap) return null;

    const [profileDoc, missions, allMissions, streakDays, recentCheckins] = await Promise.all([
        getCurrentProfile(uid),
        listRecentMissions(uid, roadmap.id, 5),
        listAllMissionsByRoadmap(uid, roadmap.id),
        getRecentCheckinStreakDays(uid),
        listRecentCheckins(uid, roadmap.id, 60)
    ]);

    const fallbackRoadmapSteps = allMissions.length
        ? []
        : extractRoadmapStepsForPersistence({
            roadmap: roadmap.roadmap || {},
            roadmapSteps: roadmap.roadmapSteps || roadmap.steps || []
        }).map((item, index) => ({
            ...item,
            roadmapId: roadmap.id,
            status: sanitizeString(item.status || 'pending'),
            sortOrder: toNumber(item.sortOrder, index + 1)
        }));

    const effectiveAllMissions = allMissions.length ? allMissions : fallbackRoadmapSteps;
    const effectiveRecentMissions = missions.length ? missions : fallbackRoadmapSteps.slice(0, 5);

    const completedCount = effectiveAllMissions.filter((item) => item.status === 'completed').length;
    const totalCount = effectiveAllMissions.length;
    const plazaReadiness = buildAcademyPlazaReadinessPayload(profileDoc || {}, roadmap || {}, effectiveAllMissions);

    return {
        success: true,
        source: 'supabase',
        roadmap: {
            id: roadmap.id,
            version: roadmap.version,
            readinessScore: roadmap.readinessScore,
            focusAreas: roadmap.focusAreas,
            summary: roadmap.summary,
            goal: roadmap.roadmap?.goal || '',
            coachTone: roadmap.roadmap?.coachTone || 'balanced',
            coachBrief: roadmap.roadmap?.coachBrief || '',
            weeklyOperatingSystem: roadmap.roadmap?.weeklyOperatingSystem || {},
            recommendedResources: Array.isArray(roadmap.roadmap?.recommendedResources) ? roadmap.roadmap.recommendedResources : [],
            days30: roadmap.roadmap?.days30 || {},
            adaptivePlanning: roadmap.adaptivePlanning || {},
            nurtureTelemetry: roadmap.nurtureTelemetry || {}
        },
        roadmapSteps: effectiveAllMissions,
        steps: effectiveAllMissions,
        missions: effectiveRecentMissions,
        allMissions: effectiveAllMissions,
        progress: {
            total: totalCount,
            completed: completedCount,
            pending: effectiveAllMissions.filter((item) => item.status === 'pending').length,
            skipped: effectiveAllMissions.filter((item) => item.status === 'skipped').length,
            stuck: effectiveAllMissions.filter((item) => item.status === 'stuck').length,
            completionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
        },
        streakDays,
        recentCheckins,
        plazaReadiness,
        transformationSystem: {
            currentStreak: streakDays,
            totalMissions: totalCount,
            completedMissions: completedCount,
            currentDay: Math.max(1, Math.min(28, completedCount + 1))
        }
    };
}

async function listCoachMessages(uid, conversationId = 'coach_main', limit = 30) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 30));
    const rows = await getRows('academyCoachMessages', uid, { limit: 300 });

    return rows
        .map((row) => mapCoachMessageData(rowData(row), row.source_document_id))
        .filter((item) => sanitizeString(item.conversationId || 'coach_main') === sanitizeString(conversationId || 'coach_main'))
        .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
        .slice(-safeLimit);
}

async function createCoachMessage(uid, payload = {}) {
    const now = nowIso();
    const id = sanitizeString(payload.id || `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
    const data = {
        ...payload,
        id,
        conversationId: sanitizeString(payload.conversationId || 'coach_main'),
        createdAt: payload.createdAt || now,
        updatedAt: now
    };

    const saved = await upsertRecord('academyCoachMessages', uid, id, data);
    return mapCoachMessageData(rowData(saved), id);
}

async function listLeadMissionLeads(uid) {
    const rows = await getRows('academyLeadMissions', uid, { limit: 500 });

    return rows
        .map((row) => mapLeadMissionLeadData(rowData(row), row.source_document_id))
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function getLeadMissionLeadById(uid, leadId) {
    const row = await getOne('academyLeadMissions', uid, leadId);
    if (!row) return null;
    return mapLeadMissionLeadData(rowData(row), row.source_document_id);
}

async function createLeadMissionLead(uid, payload = {}) {
    const now = nowIso();
    const id = sanitizeString(payload.id || payload.sourceDocumentId || `lead_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);
    const data = {
        ...payload,
        id,
        status: sanitizeString(payload.status || 'active'),
        taskStatus: sanitizeString(payload.taskStatus || 'Waiting'),
        createdAt: payload.createdAt || now,
        updatedAt: now
    };

    const saved = await upsertRecord('academyLeadMissions', uid, id, data, {
        status: data.status
    });

    if (sanitizeString(data.contactName || data.email || data.phone || data.contactRole)) {
        await upsertRecord('academyLeadContacts', uid, id, {
            id,
            leadId: id,
            companyName: sanitizeString(data.companyName),
            contactName: sanitizeString(data.contactName),
            contactRole: sanitizeString(data.contactRole),
            email: sanitizeString(data.email).toLowerCase(),
            phone: sanitizeString(data.phone),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
        }).catch((error) => {
            console.warn('academy lead contact mirror skipped:', error?.message || error);
        });
    }

    return mapLeadMissionLeadData(rowData(saved), id);
}

async function updateLeadMissionLead(uid, leadId, patch = {}) {
    const current = await getLeadMissionLeadById(uid, leadId);
    if (!current) return null;

    const now = nowIso();
    const data = {
        ...(current.data && typeof current.data === 'object' ? current.data : current),
        ...patch,
        id: leadId,
        updatedAt: now
    };

    const saved = await upsertRecord('academyLeadMissions', uid, leadId, data, {
        status: data.status || 'active'
    });

    return mapLeadMissionLeadData(rowData(saved), leadId);
}

async function deleteLeadMissionLead(uid, leadId) {
    const cleanUid = sanitizeString(uid);
    const cleanLeadId = sanitizeString(leadId);

    if (!cleanUid || !cleanLeadId) {
        return false;
    }

    const current =
        await getLeadMissionLeadById(
            cleanUid,
            cleanLeadId
        );

    if (!current) {
        return false;
    }

    const { error: leadError } =
        await yhuSupabaseAdmin
            .from(TABLE)
            .delete()
            .eq(
                'record_type',
                'academyLeadMissions'
            )
            .eq(
                'user_id',
                cleanUid
            )
            .eq(
                'source_document_id',
                cleanLeadId
            );

    if (leadError) {
        throw new Error(
            `Failed to delete Academy lead: ${leadError.message}`
        );
    }

    /*
     * The contact mirror uses the same lead ID.
     * Remove it so deleted leads do not remain in My Contacts.
     */
    const { error: contactError } =
        await yhuSupabaseAdmin
            .from(TABLE)
            .delete()
            .eq(
                'record_type',
                'academyLeadContacts'
            )
            .eq(
                'user_id',
                cleanUid
            )
            .eq(
                'source_document_id',
                cleanLeadId
            );

    if (contactError) {
        console.warn(
            'Academy lead contact mirror delete skipped:',
            contactError.message
        );
    }

    return true;
}

async function listLeadMissionFollowUps(uid) {
    const leads = await listLeadMissionLeads(uid);

    return leads.filter((lead) => {
        const taskStatus = sanitizeString(lead.taskStatus).toLowerCase();
        return taskStatus === 'due' || taskStatus === 'waiting' || sanitizeString(lead.followUpDueDate);
    });
}

async function listLeadMissionPayouts(uid) {
    const rows = await getRows('academyLeadPayouts', uid, { limit: 300 }).catch(() => []);
    return rows.map((row) => mapPayoutData(rowData(row), row.source_document_id));
}

async function listLeadMissionDeals(uid) {
    const rows = await getRows('academyLeadDeals', uid, { limit: 300 }).catch(() => []);
    return rows.map((row) => mapDealData(rowData(row), row.source_document_id));
}

async function getLeadMissionScripts(uid) {
    const row = await getOne('academy:leadMissionScripts', uid, 'leadMissionScripts').catch(() => null);

    if (!row) {
        return {
            openingScript: 'Hi, my name is [Your Name]. I am reaching out to ask a few quick questions about your company and the best contact person for this role.',
            objectionHandling: 'If blocked, stay calm, ask for the right role, and log exactly what happened so your follow-up stays structured.'
        };
    }

    const data = rowData(row);

    return {
        openingScript: sanitizeString(data.openingScript),
        objectionHandling: sanitizeString(data.objectionHandling)
    };
}

async function computeBehaviorProfile(uid) {
    const activeRoadmap = await getActiveRoadmap(uid);
    const recentMissions = activeRoadmap ? await listRecentMissions(uid, activeRoadmap.id, 20) : [];
    const recentCheckins = activeRoadmap ? await listRecentCheckins(uid, activeRoadmap.id, 20) : [];

    const completed = recentMissions.filter((item) => item.status === 'completed').length;
    const skipped = recentMissions.filter((item) => item.status === 'skipped').length;
    const stuck = recentMissions.filter((item) => item.status === 'stuck').length;

    return {
        missionSampleSize: recentMissions.length,
        recentCheckinCount: recentCheckins.length,
        completed,
        skipped,
        stuck,
        consistencySignal: completed >= skipped + stuck ? 'stable' : 'needs_correction',
        updatedAt: nowIso()
    };
}

async function saveBehaviorProfile(uid, behaviorProfile = {}) {
    const current = await getCurrentProfile(uid).catch(() => null) || {};
    return setCurrentProfile(uid, {
        ...current,
        behaviorProfile
    });
}

async function computePlannerStats(uid) {
    const activeRoadmap = await getActiveRoadmap(uid);
    const progress = activeRoadmap ? await getMissionProgress(uid, activeRoadmap.id) : {};

    return {
        activeRoadmapId: activeRoadmap?.id || '',
        progress,
        updatedAt: nowIso()
    };
}

async function savePlannerStats(uid, plannerStats = {}) {
    const current = await getCurrentProfile(uid).catch(() => null) || {};
    return setCurrentProfile(uid, {
        ...current,
        plannerStats
    });
}

async function createPlannerRun(uid, payload = {}) {
    const now = nowIso();
    const id = sanitizeString(payload.id || `planner_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
    const data = {
        ...payload,
        id,
        status: sanitizeString(payload.status || 'started'),
        createdAt: payload.createdAt || now,
        updatedAt: now
    };

    const saved = await upsertRecord('academyPlannerRuns', uid, id, data, {
        status: data.status
    });

    return {
        id,
        ...rowData(saved)
    };
}

async function getPlannerRunById(uid, runId) {
    const row = await getOne('academyPlannerRuns', uid, runId);
    if (!row) return null;
    return {
        id: row.source_document_id,
        ...rowData(row)
    };
}

async function getLatestPlannerRun(uid) {
    const rows = await getRows('academyPlannerRuns', uid, { limit: 1 });
    if (!rows[0]) return null;
    return {
        id: rows[0].source_document_id,
        ...rowData(rows[0])
    };
}

async function buildRoadmapTelemetryInspector(uid) {
    const activeRoadmap = await getActiveRoadmap(uid);
    const progress = activeRoadmap ? await getMissionProgress(uid, activeRoadmap.id) : {};

    return {
        activeRoadmap,
        progress,
        generatedAt: nowIso()
    };
}

async function updatePlannerRunResult(uid, runId, patch = {}) {
    const current = await getPlannerRunById(uid, runId) || {};
    const data = {
        ...current,
        ...patch,
        id: runId,
        status: sanitizeString(patch.status || current.status || 'completed'),
        updatedAt: nowIso()
    };

    const saved = await upsertRecord('academyPlannerRuns', uid, runId, data, {
        status: data.status
    });

    return {
        id: runId,
        ...rowData(saved)
    };
}

function normalizeRoadmapStepForPersistence(step = {}, index = 0) {
    return {
        ...step,
        id: sanitizeString(step.id || step.stepId || step.missionId || `mission_${Date.now()}_${index}`),
        pillar: sanitizeString(step.pillar || step.category || step.type || 'roadmap'),
        title: sanitizeString(step.title || step.name || `Roadmap Step ${index + 1}`),
        description: sanitizeString(step.description || step.summary || step.action || step.task || step.doneLooksLike || step.whyItMatters),
        whyItMatters: sanitizeString(step.whyItMatters || step.reflectionPrompt || step.reason),
        frequency: sanitizeString(step.frequency || step.cadence || 'daily'),
        estimatedMinutes: toNumber(step.estimatedMinutes || step.minutes || step.durationMinutes, 0),
        sortOrder: toNumber(step.sortOrder || step.order, index + 1)
    };
}

function extractRoadmapStepsForPersistence(plan = {}) {
    const roadmap = plan.roadmap && typeof plan.roadmap === 'object' ? plan.roadmap : {};
    const steps = [];

    [
        plan.missions,
        plan.roadmapSteps,
        plan.steps,
        plan.days,
        plan.weeks,
        plan.phases,
        plan.dailyPlan,
        roadmap.missions,
        roadmap.roadmapSteps,
        roadmap.steps,
        roadmap.days,
        roadmap.weeks,
        roadmap.phases,
        roadmap.dailyPlan
    ].forEach((value) => {
        if (Array.isArray(value)) {
            value.forEach((item) => {
                if (item && typeof item === 'object') steps.push(item);
            });
        }
    });

    const days30 = roadmap.days30 && typeof roadmap.days30 === 'object'
        ? roadmap.days30
        : {};

    Object.entries(days30).forEach(([key, value], index) => {
        steps.push({
            id: `roadmap-${key}`,
            pillar: 'roadmap',
            title: `Week ${index + 1}: ${sanitizeString(value || `Roadmap Week ${index + 1}`)}`,
            description: sanitizeString(value || `Complete Week ${index + 1} of your Roadmap.`),
            whyItMatters: 'This keeps your Roadmap moving through a clear weekly execution direction.',
            frequency: 'weekly',
            sortOrder: index + 1
        });
    });

    const seen = new Set();

    return steps
        .map((step, index) => normalizeRoadmapStepForPersistence(step, index))
        .filter((step, index) => {
            const key = sanitizeString(step.id || step.title || `step-${index}`).toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}


/* PATCH: Academy Roadmap bundle integrity repair v1 */

function extractConcreteRoadmapMissionStepsV1(payload = {}) {
    const safePayload =
        payload && typeof payload === 'object'
            ? payload
            : {};

    const roadmap =
        safePayload.roadmap &&
        typeof safePayload.roadmap === 'object'
            ? safePayload.roadmap
            : {};

    const candidates = [];

    [
        safePayload.allMissions,
        safePayload.roadmapSteps,
        safePayload.steps,
        safePayload.generatedMissions,
        safePayload.todayMissions,
        safePayload.missions,

        roadmap.allMissions,
        roadmap.roadmapSteps,
        roadmap.steps,
        roadmap.generatedMissions,
        roadmap.missions
    ].forEach((source) => {
        if (!Array.isArray(source)) return;

        source.forEach((item) => {
            if (
                item &&
                typeof item === 'object'
            ) {
                candidates.push(item);
            }
        });
    });

    const seen = new Set();

    return candidates
        .map((step, index) =>
            normalizeRoadmapStepForPersistence(
                step,
                index
            )
        )
        .filter((step, index) => {
            const identity =
                sanitizeString(
                    step.id ||
                    step.title ||
                    `roadmap-repair-step-${index + 1}`
                )
                    .toLowerCase();

            if (
                !identity ||
                seen.has(identity)
            ) {
                return false;
            }

            seen.add(identity);
            return true;
        });
}

async function migrateLegacyRoadmapShellV1(
    uid = '',
    legacyRoadmap = {},
    options = {}
) {
    const cleanUid =
        sanitizeString(uid);

    const source =
        legacyRoadmap &&
        typeof legacyRoadmap === 'object'
            ? legacyRoadmap
            : {};

    const cleanRoadmapId =
        sanitizeString(
            source.id ||
            source.roadmapId ||
            source.source_document_id ||
            ''
        );

    if (
        !cleanUid ||
        !cleanRoadmapId
    ) {
        return {
            migrated: false,
            roadmap: null,
            reason: 'missing_identity'
        };
    }

    const existing =
        await getRoadmapById(
            cleanUid,
            cleanRoadmapId
        );

    if (existing) {
        return {
            migrated: false,
            roadmap: existing,
            reason: 'already_primary'
        };
    }

    const nestedRoadmap =
        source.roadmap &&
        typeof source.roadmap === 'object'
            ? source.roadmap
            : (
                source.generatedRoadmap &&
                typeof source.generatedRoadmap === 'object'
                    ? source.generatedRoadmap
                    : {}
            );

    const summary =
        source.summary &&
        typeof source.summary === 'object'
            ? source.summary
            : (
                nestedRoadmap.summary &&
                typeof nestedRoadmap.summary === 'object'
                    ? nestedRoadmap.summary
                    : {}
            );

    const focusAreas =
        Array.isArray(source.focusAreas)
            ? source.focusAreas
            : Array.isArray(nestedRoadmap.focusAreas)
                ? nestedRoadmap.focusAreas
                : [];

    const concreteSteps =
        extractConcreteRoadmapMissionStepsV1(
            source
        );

    const now =
        nowIso();

    const saved =
        await upsertRecord(
            'academyRoadmaps',
            cleanUid,
            cleanRoadmapId,
            {
                id:
                    cleanRoadmapId,
                version:
                    Math.max(
                        1,
                        toNumber(
                            source.version,
                            1
                        )
                    ),
                status:
                    sanitizeString(
                        source.status ||
                        'active'
                    ) || 'active',
                readinessScore:
                    toNumber(
                        source.readinessScore ??
                        nestedRoadmap.readinessScore,
                        0
                    ),
                focusAreas,
                summary,
                roadmap: {
                    ...nestedRoadmap,
                    ...(
                        concreteSteps.length
                            ? {
                                roadmapSteps:
                                    concreteSteps
                            }
                            : {}
                    )
                },
                plannerRunId:
                    sanitizeString(
                        source.plannerRunId ||
                        nestedRoadmap.plannerRunId ||
                        ''
                    ),
                adaptivePlanning:
                    source.adaptivePlanning &&
                    typeof source.adaptivePlanning === 'object'
                        ? source.adaptivePlanning
                        : {},
                nurtureTelemetry:
                    source.nurtureTelemetry &&
                    typeof source.nurtureTelemetry === 'object'
                        ? source.nurtureTelemetry
                        : {},
                createdByModel:
                    sanitizeString(
                        source.createdByModel ||
                        source.generatedByModel ||
                        'legacy-roadmap-migration-v1'
                    ),
                createdAt:
                    source.createdAt ||
                    now,
                updatedAt:
                    now,
                migration: {
                    source:
                        'legacy_academy_repository',
                    reason:
                        sanitizeString(
                            options.reason ||
                            'legacy_roadmap_shell_migration'
                        ),
                    migratedAt:
                        now
                }
            },
            {
                roadmapId:
                    cleanRoadmapId,
                status:
                    'active'
            }
        );

    return {
        migrated: true,
        roadmap:
            mapRoadmapData(
                rowData(saved),
                cleanRoadmapId
            ),
        reason:
            'legacy_roadmap_shell_migrated'
    };
}

async function repairRoadmapMissionBundleV1(
    uid = '',
    roadmapId = '',
    payload = {}
) {
    const cleanUid =
        sanitizeString(uid);

    const cleanRoadmapId =
        sanitizeString(roadmapId);

    if (
        !cleanUid ||
        !cleanRoadmapId
    ) {
        return {
            repaired: false,
            roadmapReady: false,
            missionCount: 0,
            reason: 'missing_identity'
        };
    }

    const roadmap =
        await getRoadmapById(
            cleanUid,
            cleanRoadmapId
        );

    if (!roadmap) {
        return {
            repaired: false,
            roadmapReady: false,
            missionCount: 0,
            reason: 'roadmap_not_found'
        };
    }

    const existingMissions =
        await listAllMissionsByRoadmap(
            cleanUid,
            cleanRoadmapId
        );

    if (existingMissions.length > 0) {
        return {
            repaired: false,
            roadmapReady: true,
            missionCount:
                existingMissions.length,
            missions:
                existingMissions,
            reason: 'already_ready'
        };
    }

    const candidates =
        extractConcreteRoadmapMissionStepsV1(
            payload
        );

    if (!candidates.length) {
        return {
            repaired: false,
            roadmapReady: false,
            missionCount: 0,
            reason: 'no_concrete_missions'
        };
    }

    const now =
        nowIso();

    let createdCount = 0;

    for (
        let index = 0;
        index < candidates.length;
        index += 1
    ) {
        const mission =
            candidates[index] || {};

        const sourceMissionId =
            sanitizeString(
                mission.id ||
                `step-${index + 1}`
            );

        const missionId =
            (
                'roadmap_repair_' +
                cleanRoadmapId +
                '_' +
                sourceMissionId
            )
                .replace(
                    /[^a-zA-Z0-9_-]+/g,
                    '_'
                )
                .slice(0, 180);

        const saved =
            await upsertRecord(
                'academyMissions',
                cleanUid,
                missionId,
                {
                    ...mission,
                    id:
                        missionId,
                    sourceMissionId,
                    roadmapId:
                        cleanRoadmapId,
                    status:
                        sanitizeString(
                            mission.status ||
                            'pending'
                        ),
                    sortOrder:
                        toNumber(
                            mission.sortOrder,
                            index + 1
                        ),
                    createdAt:
                        mission.createdAt ||
                        now,
                    updatedAt:
                        now,
                    repairSource:
                        'cached_roadmap_payload_v1'
                },
                {
                    roadmapId:
                        cleanRoadmapId,
                    status:
                        sanitizeString(
                            mission.status ||
                            'pending'
                        ),
                    insertOnly:
                        true
                }
            );

        if (saved) {
            createdCount += 1;
        }
    }

    const repairedMissions =
        await listAllMissionsByRoadmap(
            cleanUid,
            cleanRoadmapId
        );

    return {
        repaired:
            createdCount > 0,
        roadmapReady:
            repairedMissions.length > 0,
        missionCount:
            repairedMissions.length,
        missions:
            repairedMissions,
        createdCount,
        reason:
            repairedMissions.length > 0
                ? 'cached_missions_restored'
                : 'repair_write_empty'
    };
}

/* END PATCH: Academy Roadmap bundle integrity repair v1 */

async function persistRoadmapBundle(uid, profile = {}, plan = {}) {
    const now = nowIso();
    const roadmapId = sanitizeString(plan.id || plan.roadmapId || `roadmap_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`);
    const active = await getActiveRoadmap(uid).catch(() => null);
    const nextVersion = toNumber(active?.version, 0) + 1 || 1;

    const roadmapPayload = {
        id: roadmapId,
        version: nextVersion,
        status: 'active',
        readinessScore: toNumber(plan.readinessScore, 0),
        focusAreas: Array.isArray(plan.focusAreas) ? plan.focusAreas : [],
        summary: plan.summary && typeof plan.summary === 'object' ? plan.summary : {},
        roadmap: plan.roadmap && typeof plan.roadmap === 'object' ? plan.roadmap : {},
        plannerRunId: sanitizeString(plan.plannerRunId),
        adaptivePlanning: plan.adaptivePlanning && typeof plan.adaptivePlanning === 'object' ? plan.adaptivePlanning : {},
        nurtureTelemetry: plan.nurtureTelemetry && typeof plan.nurtureTelemetry === 'object' ? plan.nurtureTelemetry : {},
        createdByModel: sanitizeString(plan.createdByModel || 'academy-rule-engine-v1'),
        createdAt: now,
        updatedAt: now
    };

    await upsertRecord('academyRoadmaps', uid, roadmapId, roadmapPayload, {
        roadmapId,
        status: 'active'
    });

    const missions = extractRoadmapStepsForPersistence(plan);
    for (let index = 0; index < missions.length; index += 1) {
        const mission = missions[index] || {};
        const missionId = sanitizeString(mission.id || `mission_${Date.now()}_${index}_${crypto.randomBytes(2).toString('hex')}`);

        await upsertRecord('academyMissions', uid, missionId, {
            ...mission,
            id: missionId,
            roadmapId,
            status: sanitizeString(mission.status || 'pending'),
            sortOrder: toNumber(mission.sortOrder, index + 1),
            createdAt: now,
            updatedAt: now
        }, {
            roadmapId,
            status: sanitizeString(mission.status || 'pending')
        });
    }

    await setAccessUnlocked(uid);

    return {
        roadmapId,
        version: nextVersion
    };
}

/* PATCH: Persistent Academy progression core v1 */

const ACADEMY_PROGRESSION_RECORD_TYPE = 'academy:progression';
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

const ACADEMY_SOLO_STREAK_MILESTONES_V1 =
    Object.freeze([3, 7, 14, 30]);

const ACADEMY_SOLO_CAMPAIGN_MILESTONES_V1 =
    Object.freeze([25, 50, 75, 100]);

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
            test: /self[\s_-]*mastery/,
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

function academySoloDateKeyV1(value = '') {
    const iso = toIso(value);

    if (!iso) {
        return '';
    }

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toISOString().slice(0, 10);
}

function academySoloUtcDayNumberV1(dateKey = '') {
    const cleanDateKey =
        sanitizeString(dateKey);

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
            cleanDateKey
        )
    ) {
        return null;
    }

    const date = new Date(
        `${cleanDateKey}T00:00:00.000Z`
    );

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return Math.floor(
        date.getTime() /
        86400000
    );
}

function academySoloComputeStreakV1(
    activityDates = []
) {
    const dates =
        Array.from(
            new Set(
                (Array.isArray(activityDates)
                    ? activityDates
                    : [])
                    .map(academySoloDateKeyV1)
                    .filter(Boolean)
            )
        )
            .sort();

    const milestoneReachedAt = {};
    let longest = 0;
    let finalRunLength = 0;
    let runLength = 0;
    let previousDayNumber = null;

    for (const dateKey of dates) {
        const dayNumber =
            academySoloUtcDayNumberV1(
                dateKey
            );

        if (dayNumber === null) {
            continue;
        }

        if (
            previousDayNumber !== null &&
            dayNumber === previousDayNumber + 1
        ) {
            runLength += 1;
        } else {
            runLength = 1;
        }

        previousDayNumber = dayNumber;
        finalRunLength = runLength;
        longest = Math.max(
            longest,
            runLength
        );

        for (
            const threshold of
            ACADEMY_SOLO_STREAK_MILESTONES_V1
        ) {
            if (
                runLength >= threshold &&
                !milestoneReachedAt[threshold]
            ) {
                milestoneReachedAt[threshold] =
                    dateKey;
            }
        }
    }

    const lastActiveDate =
        dates[dates.length - 1] ||
        '';

    const todayKey =
        academySoloDateKeyV1(
            nowIso()
        );

    const todayDayNumber =
        academySoloUtcDayNumberV1(
            todayKey
        );

    const lastDayNumber =
        academySoloUtcDayNumberV1(
            lastActiveDate
        );

    const current =
        lastDayNumber !== null &&
        todayDayNumber !== null &&
        (
            lastDayNumber === todayDayNumber ||
            lastDayNumber === todayDayNumber - 1
        )
            ? finalRunLength
            : 0;

    const reached =
        ACADEMY_SOLO_STREAK_MILESTONES_V1
            .filter(
                (threshold) =>
                    longest >= threshold
            );

    const nextMilestone =
        ACADEMY_SOLO_STREAK_MILESTONES_V1
            .find(
                (threshold) =>
                    longest < threshold
            ) ||
        null;

    return {
        current,
        longest,
        lastActiveDate,
        nextMilestone,
        reached,
        milestoneReachedAt
    };
}

async function recordAcademySoloDerivedEventV1(
    uid = '',
    {
        eventType = '',
        sourceId = '',
        roadmapId = '',
        eventAt = '',
        metadata = {}
    } = {}
) {
    const cleanUid =
        sanitizeString(uid);

    const cleanEventType =
        sanitizeString(eventType);

    const cleanSourceId =
        sanitizeString(sourceId);

    if (
        !cleanUid ||
        !cleanEventType ||
        !cleanSourceId
    ) {
        return {
            ok: false,
            created: false,
            skipped: true,
            reason: 'missing_event_identity'
        };
    }

    const eventId =
        academyProgressionSafeEventIdV1(
            `${cleanEventType}:${cleanSourceId}`
        );

    const existingRow =
        await getOne(
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

    const timestamp =
        toIso(eventAt) ||
        nowIso();

    const payload = {
        id: eventId,
        eventId,
        userId: cleanUid,
        division: 'academy',
        mode: 'solo',
        eventType: cleanEventType,
        sourceId: cleanSourceId,
        sourceType: 'academySoloProgression',
        roadmapId:
            sanitizeString(roadmapId),
        growthPoints: 0,
        attributes:
            academySoloEmptyAttributesV1(),
        eventAt: timestamp,
        metadata:
            metadata &&
            typeof metadata === 'object'
                ? normalizeForJson(
                    metadata
                )
                : {},
        createdAt: timestamp,
        updatedAt: timestamp
    };

    const saved =
        await upsertRecord(
            ACADEMY_SOLO_EVENT_RECORD_TYPE,
            cleanUid,
            eventId,
            payload,
            {
                insertOnly: true
            }
        );

    if (!saved) {
        const concurrentRow =
            await getOne(
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

async function reconcileAcademySoloMilestonesV1(
    uid = '',
    {
        activeRoadmap = null,
        missions = [],
        events = []
    } = {}
) {
    const cleanUid =
        sanitizeString(uid);

    if (!cleanUid) {
        return {
            activityDays: 0,
            streak: academySoloComputeStreakV1([]),
            campaignPercentage: 0
        };
    }

    const missionEvents =
        (Array.isArray(events)
            ? events
            : [])
            .filter(
                (event) =>
                    sanitizeString(
                        event?.eventType
                    ) ===
                    'roadmap_mission_completed'
            );

    for (const event of missionEvents) {
        const dateKey =
            academySoloDateKeyV1(
                event?.eventAt ||
                event?.createdAt ||
                event?.updatedAt
            );

        if (!dateKey) {
            continue;
        }

        await recordAcademySoloDerivedEventV1(
            cleanUid,
            {
                eventType:
                    'solo_activity_day',
                sourceId:
                    dateKey,
                roadmapId:
                    event?.roadmapId ||
                    activeRoadmap?.id ||
                    '',
                eventAt:
                    event?.eventAt ||
                    `${dateKey}T12:00:00.000Z`,
                metadata: {
                    activityDate:
                        dateKey,
                    sourceMissionId:
                        sanitizeString(
                            event?.sourceId
                        )
                }
            }
        );
    }

    const activityDates =
        missionEvents
            .map(
                (event) =>
                    academySoloDateKeyV1(
                        event?.eventAt ||
                        event?.createdAt ||
                        event?.updatedAt
                    )
            )
            .filter(Boolean);

    const streak =
        academySoloComputeStreakV1(
            activityDates
        );

    for (
        const threshold of
        streak.reached
    ) {
        const reachedDate =
            streak.milestoneReachedAt[
                threshold
            ] ||
            streak.lastActiveDate;

        await recordAcademySoloDerivedEventV1(
            cleanUid,
            {
                eventType:
                    'solo_streak_milestone',
                sourceId:
                    `verified:${threshold}`,
                roadmapId:
                    activeRoadmap?.id ||
                    '',
                eventAt:
                    reachedDate
                        ? `${reachedDate}T12:00:00.000Z`
                        : nowIso(),
                metadata: {
                    threshold,
                    label:
                        threshold === 3
                            ? 'Momentum'
                            : threshold === 7
                                ? 'Consistent Operator'
                                : threshold === 14
                                    ? 'Discipline Builder'
                                    : 'Solo Campaign Veteran',
                    activityType:
                        'ai_verified_roadmap_mission'
                }
            }
        );
    }

    const currentMissionIds =
        new Set(
            (Array.isArray(missions)
                ? missions
                : [])
                .map(
                    (mission) =>
                        sanitizeString(
                            mission?.id
                        )
                )
                .filter(Boolean)
        );

    const currentVerifiedMissionIds =
        new Set(
            missionEvents
                .filter(
                    (event) =>
                        currentMissionIds.has(
                            sanitizeString(
                                event?.sourceId
                            )
                        )
                )
                .map(
                    (event) =>
                        sanitizeString(
                            event?.sourceId
                        )
                )
                .filter(Boolean)
        );

    const total =
        currentMissionIds.size;

    const completed =
        currentVerifiedMissionIds.size;

    const campaignPercentage =
        total > 0
            ? Math.max(
                0,
                Math.min(
                    100,
                    Math.round(
                        (
                            completed /
                            total
                        ) *
                        100
                    )
                )
            )
            : 0;

    const roadmapId =
        sanitizeString(
            activeRoadmap?.id
        ) ||
        'no_active_roadmap';

    for (
        const threshold of
        ACADEMY_SOLO_CAMPAIGN_MILESTONES_V1
    ) {
        if (
            campaignPercentage <
            threshold
        ) {
            continue;
        }

        await recordAcademySoloDerivedEventV1(
            cleanUid,
            {
                eventType:
                    'solo_campaign_milestone',
                sourceId:
                    `${roadmapId}:${threshold}`,
                roadmapId:
                    activeRoadmap?.id ||
                    '',
                eventAt:
                    nowIso(),
                metadata: {
                    threshold,
                    campaignPercentage,
                    completed,
                    total
                }
            }
        );
    }

    return {
        activityDays:
            new Set(activityDates).size,
        streak,
        campaignPercentage
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
    const activityDates = new Set();
    const storedCampaignMilestones = new Set();
    let totalGrowthPoints = 0;

    for (const event of Array.isArray(events) ? events : []) {
        const eventType =
            sanitizeString(
                event?.eventType
            );

        if (
            eventType ===
            'solo_activity_day'
        ) {
            const dateKey =
                sanitizeString(
                    event?.metadata
                        ?.activityDate
                ) ||
                academySoloDateKeyV1(
                    event?.eventAt
                );

            if (dateKey) {
                activityDates.add(
                    dateKey
                );
            }

            continue;
        }

        if (
            eventType ===
            'solo_campaign_milestone'
        ) {
            const eventRoadmapId =
                sanitizeString(
                    event?.roadmapId
                );

            const currentRoadmapId =
                sanitizeString(
                    activeRoadmap?.id
                );

            const threshold =
                Math.round(
                    toNumber(
                        event?.metadata
                            ?.threshold,
                        0
                    )
                );

            if (
                currentRoadmapId &&
                eventRoadmapId ===
                    currentRoadmapId &&
                ACADEMY_SOLO_CAMPAIGN_MILESTONES_V1
                    .includes(
                        threshold
                    )
            ) {
                storedCampaignMilestones
                    .add(
                        threshold
                    );
            }

            continue;
        }

        if (
            eventType !==
            'roadmap_mission_completed'
        ) {
            continue;
        }

        const missionDate =
            academySoloDateKeyV1(
                event?.eventAt ||
                event?.createdAt ||
                event?.updatedAt
            );

        if (missionDate) {
            activityDates.add(
                missionDate
            );
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

    const streak =
        academySoloComputeStreakV1(
            Array.from(
                activityDates
            )
        );

    const reachedCampaignMilestones =
        ACADEMY_SOLO_CAMPAIGN_MILESTONES_V1
            .filter(
                (threshold) =>
                    storedCampaignMilestones
                        .has(
                            threshold
                        ) ||
                    percentage >= threshold
            );

    const nextCampaignMilestone =
        ACADEMY_SOLO_CAMPAIGN_MILESTONES_V1
            .find(
                (threshold) =>
                    !reachedCampaignMilestones
                        .includes(
                            threshold
                        )
            ) ||
        null;

    return {
        version: 'academy-solo-mode-v2',
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

        streak: {
            current:
                streak.current,
            longest:
                streak.longest,
            lastActiveDate:
                streak.lastActiveDate,
            nextMilestone:
                streak.nextMilestone,
            reached:
                streak.reached
        },

        campaignMilestones: {
            reached:
                reachedCampaignMilestones,
            latest:
                reachedCampaignMilestones[
                    reachedCampaignMilestones.length - 1
                ] ||
                null,
            next:
                nextCampaignMilestone,
            complete:
                percentage >= 100
        },

        eventCount: Array.isArray(events)
            ? events.length
            : 0,
        updatedAt: nowIso()
    };
}

function academyProgressionRankFromXpV1(xp = 0) {
    const score = Math.max(0, toNumber(xp, 0));

    if (score >= 9000) {
        return {
            key: 'academy_elite',
            label: 'Academy Elite',
            nextLabel: 'Max Rank',
            minXp: 9000,
            nextXp: 9000
        };
    }

    if (score >= 6500) {
        return {
            key: 'vanguard',
            label: 'Vanguard',
            nextLabel: 'Academy Elite',
            minXp: 6500,
            nextXp: 9000
        };
    }

    if (score >= 4500) {
        return {
            key: 'captain',
            label: 'Captain',
            nextLabel: 'Vanguard',
            minXp: 4500,
            nextXp: 6500
        };
    }

    if (score >= 3000) {
        return {
            key: 'strategist',
            label: 'Strategist',
            nextLabel: 'Captain',
            minXp: 3000,
            nextXp: 4500
        };
    }

    if (score >= 1800) {
        return {
            key: 'operator',
            label: 'Operator',
            nextLabel: 'Strategist',
            minXp: 1800,
            nextXp: 3000
        };
    }

    if (score >= 900) {
        return {
            key: 'executor',
            label: 'Executor',
            nextLabel: 'Operator',
            minXp: 900,
            nextXp: 1800
        };
    }

    if (score >= 300) {
        return {
            key: 'builder',
            label: 'Builder',
            nextLabel: 'Executor',
            minXp: 300,
            nextXp: 900
        };
    }

    return {
        key: 'initiate',
        label: 'Initiate',
        nextLabel: 'Builder',
        minXp: 0,
        nextXp: 300
    };
}

function academyProgressionLevelFromXpV1(xp = 0) {
    const score = Math.max(0, toNumber(xp, 0));
    return Math.max(1, Math.floor(score / 350) + 1);
}

function academyProgressionWeekStartIsoV1(value = new Date()) {
    const date = value instanceof Date
        ? new Date(value.getTime())
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return academyProgressionWeekStartIsoV1(new Date());
    }

    const day = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - day);
    date.setUTCHours(0, 0, 0, 0);

    return date.toISOString();
}

function academyProgressionEventDateV1(event = {}) {
    return (
        toIso(
            event.eventAt ||
            event.completedAt ||
            event.checkinDate ||
            event.createdAt ||
            event.updatedAt
        ) || nowIso()
    );
}

function academyProgressionSafeEventIdV1(value = '') {
    const clean = sanitizeString(value)
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 180);

    return clean || makeId('academy_xp');
}

async function upsertAcademyXpEventV1(uid = '', event = {}) {
    const cleanUid = sanitizeString(uid);
    const eventType = sanitizeString(event.eventType || event.type);
    const sourceId = sanitizeString(event.sourceId || event.source_id);

    if (!cleanUid || !eventType || !sourceId) {
        return {
            ok: false,
            skipped: true,
            reason: 'missing_event_identity'
        };
    }

    const eventId = academyProgressionSafeEventIdV1(
        `${eventType}:${sourceId}`
    );

    const existingRow = await getOne(
        ACADEMY_XP_EVENT_RECORD_TYPE,
        cleanUid,
        eventId
    ).catch(() => null);

    const existing = rowData(existingRow);

    const payload = {
        ...existing,
        id: eventId,
        eventId,
        userId: cleanUid,
        division: 'academy',
        eventType,
        sourceId,
        sourceType: sanitizeString(event.sourceType || ''),
        roadmapId: sanitizeString(event.roadmapId || ''),
        xp: Math.max(0, Math.round(toNumber(event.xp, 0))),
        eventAt: academyProgressionEventDateV1(event),
        metadata:
            event.metadata && typeof event.metadata === 'object'
                ? normalizeForJson(event.metadata)
                : {},
        createdAt: existing.createdAt || nowIso(),
        updatedAt: nowIso()
    };

    const saved = await upsertRecord(
        ACADEMY_XP_EVENT_RECORD_TYPE,
        cleanUid,
        eventId,
        payload
    );

    return {
        ok: true,
        created: !existingRow,
        event: rowData(saved)
    };
}

async function listAcademyXpEventsV1(uid = '', limit = 500) {
    const rows = await getRows(
        ACADEMY_XP_EVENT_RECORD_TYPE,
        uid,
        {
            limit: Math.max(1, Math.min(500, Number(limit) || 500))
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

async function getAcademyProgressionV1(uid = '') {
    const row = await getOne(
        ACADEMY_PROGRESSION_RECORD_TYPE,
        uid,
        ACADEMY_PROGRESSION_DOC_ID
    );

    if (!row) return null;

    return {
        ...rowData(row),
        id: ACADEMY_PROGRESSION_DOC_ID
    };
}

async function syncAcademyProgressionFromCurrentStateV1(
    uid = '',
    profile = {}
) {
    const cleanUid = sanitizeString(uid);

    if (!cleanUid) {
        throw new Error('Missing Academy progression user id.');
    }

    const activeRoadmap = await getActiveRoadmap(cleanUid).catch(() => null);

    const missions = activeRoadmap
        ? await listAllMissionsByRoadmap(
            cleanUid,
            activeRoadmap.id
        ).catch(() => [])
        : [];

    const checkins = await getRows(
        'academyCheckins',
        cleanUid,
        { limit: 500 }
    ).then((rows) => (
        rows.map((row) =>
            mapCheckinData(
                rowData(row),
                row.source_document_id
            )
        )
    )).catch(() => []);

    const completedMissions = missions.filter((mission) => {
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
        await upsertAcademyXpEventV1(cleanUid, {
            eventType: 'mission_completed',
            sourceId: mission.id,
            sourceType: 'academyMission',
            roadmapId: mission.roadmapId || activeRoadmap?.id || '',
            xp: 50,
            eventAt:
                mission.completedAt ||
                mission.updatedAt ||
                mission.createdAt,
            metadata: {
                title: mission.title || '',
                missionType: mission.missionType || '',
                difficultyLevel: mission.difficultyLevel || ''
            }
        });
    }

    for (const checkin of checkins) {
        const checkinIdentity =
            sanitizeString(checkin.checkinDate) ||
            sanitizeString(checkin.id);

        if (!checkinIdentity) continue;

        await upsertAcademyXpEventV1(cleanUid, {
            eventType: 'daily_checkin',
            sourceId: checkinIdentity,
            sourceType: 'academyCheckin',
            roadmapId: checkin.roadmapId || activeRoadmap?.id || '',
            xp: 20,
            eventAt:
                checkin.checkinDate ||
                checkin.createdAt ||
                checkin.updatedAt,
            metadata: {
                energyScore: toNumber(checkin.energyScore, 0),
                moodScore: toNumber(checkin.moodScore, 0),
                disciplineScore: toNumber(checkin.disciplineScore, 0)
            }
        });
    }

    const streakDays = await getRecentCheckinStreakDays(
        cleanUid
    ).catch(() => 0);

    if (streakDays >= 3) {
        await upsertAcademyXpEventV1(cleanUid, {
            eventType: 'streak_bonus',
            sourceId: 'three_day',
            sourceType: 'academyStreak',
            xp: 35,
            eventAt: nowIso(),
            metadata: {
                threshold: 3,
                currentStreakDays: streakDays
            }
        });
    }

    if (streakDays >= 7) {
        await upsertAcademyXpEventV1(cleanUid, {
            eventType: 'streak_bonus',
            sourceId: 'seven_day',
            sourceType: 'academyStreak',
            xp: 100,
            eventAt: nowIso(),
            metadata: {
                threshold: 7,
                currentStreakDays: streakDays
            }
        });
    }

    const totalMissions = missions.length;
    const completedMissionCount = completedMissions.length;

    const completionRate =
        totalMissions > 0
            ? Math.round(
                (completedMissionCount / totalMissions) * 100
            )
            : 0;

    let completionBonusXp = 0;
    let completionBonusKey = '';

    if (completionRate >= 100 && totalMissions > 0) {
        completionBonusXp = 250;
        completionBonusKey = 'complete';
    } else if (completionRate >= 70) {
        completionBonusXp = 120;
        completionBonusKey = 'seventy';
    } else if (completionRate >= 40) {
        completionBonusXp = 50;
        completionBonusKey = 'forty';
    }

    if (completionBonusXp > 0) {
        await upsertAcademyXpEventV1(cleanUid, {
            eventType: 'roadmap_completion_bonus',
            sourceId:
                activeRoadmap?.id ||
                ACADEMY_PROGRESSION_DOC_ID,
            sourceType: 'academyRoadmap',
            roadmapId: activeRoadmap?.id || '',
            xp: completionBonusXp,
            eventAt: nowIso(),
            metadata: {
                completionRate,
                bonusKey: completionBonusKey,
                totalMissions,
                completedMissions: completedMissionCount
            }
        });
    }

    const events = await listAcademyXpEventsV1(
        cleanUid,
        500
    );

    const totalXp = events.reduce((sum, event) => {
        return sum + Math.max(0, toNumber(event.xp, 0));
    }, 0);

    const weekStartIso = academyProgressionWeekStartIsoV1(
        new Date()
    );

    const weeklyXp = events.reduce((sum, event) => {
        const eventAt = academyProgressionEventDateV1(event);

        if (eventAt < weekStartIso) return sum;

        return sum + Math.max(0, toNumber(event.xp, 0));
    }, 0);

    const rank = academyProgressionRankFromXpV1(totalXp);
    const level = academyProgressionLevelFromXpV1(totalXp);

    let soloEvents = await listAcademySoloEventsV1(
        cleanUid,
        500
    ).catch(() => []);

    await reconcileAcademySoloMilestonesV1(
        cleanUid,
        {
            activeRoadmap,
            missions,
            events: soloEvents
        }
    ).catch((error) => {
        /*
         * Streak and milestone projection must never block
         * the canonical Academy progression response.
         */
        console.warn(
            'Academy Solo milestone reconciliation skipped:',
            error?.message || error
        );
    });

    soloEvents = await listAcademySoloEventsV1(
        cleanUid,
        500
    ).catch(() => soloEvents);

    const soloMode = buildAcademySoloModeSummaryV1({
        activeRoadmap,
        missions,
        events: soloEvents
    });

    const rankSpan = Math.max(
        1,
        rank.nextXp - rank.minXp
    );

    const rankProgress =
        rank.nextXp === rank.minXp
            ? 100
            : Math.max(
                0,
                Math.min(
                    100,
                    Math.round(
                        (
                            (totalXp - rank.minXp) /
                            rankSpan
                        ) * 100
                    )
                )
            );

    const displayName = sanitizeString(
        profile.display_name ||
        profile.displayName ||
        profile.fullName ||
        profile.full_name ||
        profile.name ||
        'Academy Member'
    );

    const username = sanitizeString(
        profile.username ||
        profile.handle ||
        ''
    );

    const avatar = sanitizeString(
        profile.avatar ||
        profile.profilePhoto ||
        profile.photoURL ||
        ''
    );

    const existing = await getAcademyProgressionV1(
        cleanUid
    ).catch(() => null);

    const summary = {
        ...existing,
        id: ACADEMY_PROGRESSION_DOC_ID,
        userId: cleanUid,
        division: 'academy',

        displayName,
        username,
        avatar,

        totalXp,
        weeklyXp,
        level,

        rank: rank.label,
        rankKey: rank.key,
        nextRank: rank.nextLabel,
        nextXp: rank.nextXp,
        rankMinXp: rank.minXp,
        rankProgress,

        completedMissions: completedMissionCount,
        totalMissions,
        completionRate,
        checkinCount: checkins.length,
        streakDays,

        soloMode,

        eventCount: events.length,
        weekStartAt: weekStartIso,
        source: 'academy_progression_reconciliation_v1',

        createdAt: existing?.createdAt || nowIso(),
        updatedAt: nowIso()
    };

    await upsertRecord(
        ACADEMY_PROGRESSION_RECORD_TYPE,
        cleanUid,
        ACADEMY_PROGRESSION_DOC_ID,
        summary
    );

    return summary;
}
/* PATCH: Academy leaderboard canonical member identity v1 */

function isValidAcademyLeaderboardNameV1(
    value = ''
) {
    const clean =
        sanitizeString(value);

    if (!clean) {
        return false;
    }

    const invalidNames =
        new Set([
            'academy member',
            'yh member',
            'hustler',
            'member',
            'user'
        ]);

    if (
        invalidNames.has(
            clean.toLowerCase()
        )
    ) {
        return false;
    }

    if (
        clean.includes('@')
    ) {
        return false;
    }

    return true;
}

async function resolveAcademyLeaderboardIdentityV1(
    userId = '',
    progression = {}
) {
    const cleanUserId =
        sanitizeString(userId);

    let academyMemberProfile = null;
    let universeUser = null;
    let coreProfile = null;

    if (cleanUserId) {
        try {
            academyMemberProfile =
                await academyMemberProfileSupabaseRepo
                    .getProfileByUid(
                        cleanUserId
                    );
        } catch (_) {
            academyMemberProfile = null;
        }

        try {
            universeUser =
                await yhuUsersSupabaseRepo
                    .getByUid(
                        cleanUserId
                    );
        } catch (_) {
            universeUser = null;
        }

        try {
            coreProfile =
                await getCurrentProfile(
                    cleanUserId
                );
        } catch (_) {
            coreProfile = null;
        }
    }

    const academyMemberData =
        academyMemberProfile?.data &&
        typeof academyMemberProfile.data ===
            'object'
            ? academyMemberProfile.data
            : {};

    const academyMemberPublicMeta =
        academyMemberProfile?.public_meta &&
        typeof academyMemberProfile.public_meta ===
            'object'
            ? academyMemberProfile.public_meta
            : {};

    const universeData =
        universeUser?.data &&
        typeof universeUser.data ===
            'object'
            ? universeUser.data
            : {};

    const universePublicMeta =
        universeUser?.public_meta &&
        typeof universeUser.public_meta ===
            'object'
            ? universeUser.public_meta
            : {};

    const displayNameCandidates = [
        academyMemberProfile?.display_name,
        academyMemberProfile?.full_name,

        academyMemberData.display_name,
        academyMemberData.displayName,
        academyMemberData.full_name,
        academyMemberData.fullName,
        academyMemberData.name,

        academyMemberPublicMeta.display_name,
        academyMemberPublicMeta.displayName,
        academyMemberPublicMeta.full_name,
        academyMemberPublicMeta.fullName,
        academyMemberPublicMeta.name,

        universeUser?.display_name,
        universeUser?.full_name,

        universeData.display_name,
        universeData.displayName,
        universeData.full_name,
        universeData.fullName,
        universeData.name,

        universePublicMeta.display_name,
        universePublicMeta.displayName,
        universePublicMeta.full_name,
        universePublicMeta.fullName,
        universePublicMeta.name,

        coreProfile?.display_name,
        coreProfile?.displayName,
        coreProfile?.full_name,
        coreProfile?.fullName,
        coreProfile?.name,

        progression.displayName,
        progression.display_name
    ];

    const usernameCandidates = [
        academyMemberProfile?.username,
        academyMemberData.username,
        academyMemberPublicMeta.username,

        universeUser?.username,
        universeData.username,
        universePublicMeta.username,

        coreProfile?.username,
        progression.username
    ];

    const username =
        usernameCandidates
            .map((value) =>
                sanitizeString(value)
                    .replace(/^@+/, '')
            )
            .find(
                (value) =>
                    Boolean(value) &&
                    !value.includes('@')
            ) ||
        '';

    const displayName =
        displayNameCandidates
            .map((value) =>
                sanitizeString(value)
            )
            .find(
                isValidAcademyLeaderboardNameV1
            ) ||
        username ||
        'YH Member';

    const avatar =
        sanitizeString(
            academyMemberProfile?.avatar ||
            academyMemberProfile?.profile_photo ||
            academyMemberProfile?.photo_url ||

            academyMemberData.avatar ||
            academyMemberData.avatarUrl ||
            academyMemberData.profilePhoto ||
            academyMemberData.photoURL ||

            academyMemberPublicMeta.avatar ||
            academyMemberPublicMeta.avatarUrl ||
            academyMemberPublicMeta.profilePhoto ||
            academyMemberPublicMeta.photoURL ||

            universeUser?.avatar ||
            universeUser?.profile_photo ||
            universeUser?.photo_url ||

            universeData.avatar ||
            universeData.avatarUrl ||
            universeData.profilePhoto ||
            universeData.photoURL ||

            coreProfile?.avatar ||
            coreProfile?.avatarUrl ||
            coreProfile?.profilePhoto ||
            coreProfile?.photoURL ||

            progression.avatar ||
            ''
        );

    return {
        displayName,
        username,
        avatar
    };
}

/* END PATCH: Academy leaderboard canonical member identity v1 */
async function listAcademyProgressionLeaderboardV1(
    period = 'weekly',
    limit = 50
) {
    const cleanPeriod =
        sanitizeString(period).toLowerCase() ===
        'all_time'
            ? 'all_time'
            : 'weekly';

    const safeLimit =
        Math.max(
            1,
            Math.min(
                100,
                Number(limit) || 50
            )
        );

    const { data, error } =
        await yhuSupabaseAdmin
            .from(TABLE)
            .select('*')
            .eq(
                'record_type',
                ACADEMY_PROGRESSION_RECORD_TYPE
            )
            .limit(500);

    if (error) {
        throw new Error(
            `Academy leaderboard failed: ${error.message}`
        );
    }

    const field =
        cleanPeriod === 'all_time'
            ? 'totalXp'
            : 'weeklyXp';

    const rawEntries =
        (Array.isArray(data) ? data : [])
            .map((row) => {
                const progression =
                    rowData(row);

                return {
                    userId:
                        sanitizeString(
                            progression.userId ||
                            row.user_id ||
                            ''
                        ),

                    displayName:
                        sanitizeString(
                            progression.displayName ||
                            progression.display_name ||
                            ''
                        ),

                    username:
                        sanitizeString(
                            progression.username ||
                            ''
                        ),

                    avatar:
                        sanitizeString(
                            progression.avatar ||
                            ''
                        ),

                    xp:
                        Math.max(
                            0,
                            toNumber(
                                progression[field],
                                0
                            )
                        ),

                    totalXp:
                        Math.max(
                            0,
                            toNumber(
                                progression.totalXp,
                                0
                            )
                        ),

                    weeklyXp:
                        Math.max(
                            0,
                            toNumber(
                                progression.weeklyXp,
                                0
                            )
                        ),

                    level:
                        Math.max(
                            1,
                            toNumber(
                                progression.level,
                                1
                            )
                        ),

                    rank:
                        progression.rank ||
                        'Initiate',

                    rankKey:
                        progression.rankKey ||
                        'initiate',

                    streakDays:
                        Math.max(
                            0,
                            toNumber(
                                progression.streakDays,
                                0
                            )
                        ),

                    completedMissions:
                        Math.max(
                            0,
                            toNumber(
                                progression
                                    .completedMissions,
                                0
                            )
                        ),

                    progression
                };
            });

    const enrichedEntries =
        await Promise.all(
            rawEntries.map(
                async (entry) => {
                    const identity =
                        await resolveAcademyLeaderboardIdentityV1(
                            entry.userId,
                            entry.progression
                        );

                    return {
                        ...entry,
                        displayName:
                            identity.displayName,

                        username:
                            identity.username,

                        avatar:
                            identity.avatar
                    };
                }
            )
        );

    return enrichedEntries
        .map(({ progression, ...entry }) => entry)
        .sort((a, b) => {
            if (b.xp !== a.xp) {
                return b.xp - a.xp;
            }

            if (
                b.totalXp !==
                a.totalXp
            ) {
                return (
                    b.totalXp -
                    a.totalXp
                );
            }

            return String(
                a.displayName
            ).localeCompare(
                String(
                    b.displayName
                )
            );
        })
        .slice(0, safeLimit)
        .map((entry, index) => ({
            ...entry,
            position:
                index + 1,
            period:
                cleanPeriod
        }));
}
/* END PATCH: Persistent Academy progression core v1 */


/* PATCH: Academy Squad Foundation core v1 */

const ACADEMY_SQUAD_RECORD_TYPE =
    'academy:squad';

const ACADEMY_SQUAD_MEMBERSHIP_RECORD_TYPE =
    'academy:squadMembership';

const ACADEMY_SQUAD_MEMBERSHIP_DOC_ID =
    'current-squad';

function academySquadNormalizeInviteCodeV1(
    value = ''
) {
    return sanitizeString(value)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10);
}

function academySquadGenerateInviteCodeV1() {
    return crypto
        .randomBytes(5)
        .toString('hex')
        .toUpperCase()
        .slice(0, 8);
}

function academySquadNormalizeMemberV1(
    member = {}
) {
    return {
        userId:
            sanitizeString(
                member.userId ||
                member.uid ||
                member.id
            ),

        displayName:
            sanitizeString(
                member.displayName ||
                member.fullName ||
                member.name ||
                'YH Member'
            ),

        username:
            sanitizeString(
                member.username ||
                member.handle ||
                ''
            )
                .replace(/^@+/, ''),

        avatar:
            sanitizeString(
                member.avatar ||
                member.avatarUrl ||
                member.avatar_url ||
                ''
            ),

        role:
            ['owner', 'captain'].includes(
                sanitizeString(
                    member.role
                ).toLowerCase()
            )
                ? sanitizeString(
                    member.role
                ).toLowerCase()
                : 'member',

        joinedAt:
            toIso(member.joinedAt) ||
            nowIso()
    };
}

function academySquadNormalizeRecordV1(
    value = {}
) {
    const source =
        value &&
        typeof value === 'object'
            ? value
            : {};

    const members =
        Array.isArray(source.members)
            ? source.members
                .map(
                    academySquadNormalizeMemberV1
                )
                .filter(
                    (member) =>
                        Boolean(member.userId)
                )
                .slice(0, 8)
            : [];

    return {
        id:
            sanitizeString(
                source.id ||
                source.squadId
            ),

        name:
            sanitizeString(
                source.name ||
                'Unnamed Squad'
            ).slice(0, 60),

        description:
            sanitizeString(
                source.description ||
                ''
            ).slice(0, 240),

        emblem:
            sanitizeString(
                source.emblem ||
                '⚡'
            ).slice(0, 12),

        ownerUserId:
            sanitizeString(
                source.ownerUserId ||
                source.ownerUid ||
                ''
            ),

        inviteCode:
            academySquadNormalizeInviteCodeV1(
                source.inviteCode
            ),

        status:
            sanitizeString(
                source.status ||
                'active'
            ).toLowerCase(),

        members,

        memberCount:
            members.length,

        maxMembers: 8,

        totalXp:
            Math.max(
                0,
                toNumber(
                    source.totalXp,
                    0
                )
            ),

        weeklyXp:
            Math.max(
                0,
                toNumber(
                    source.weeklyXp,
                    0
                )
            ),

        rank:
            sanitizeString(
                source.rank ||
                'Unranked'
            ),

        level:
            Math.max(
                1,
                Math.floor(
                    toNumber(
                        source.level,
                        1
                    )
                )
            ),

        nextLevelXp:
            Math.max(
                100,
                toNumber(
                    source.nextLevelXp,
                    100
                )
            ),

        recentContributions:
            Array.isArray(
                source.recentContributions
            )
                ? source.recentContributions
                    .filter(
                        (entry) =>
                            entry &&
                            typeof entry ===
                                'object'
                    )
                    .slice(0, 20)
                : [],

        createdAt:
            toIso(source.createdAt) ||
            nowIso(),

        updatedAt:
            toIso(source.updatedAt) ||
            nowIso()
    };
}

async function getAcademySquadMembershipV1(
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
}

async function getAcademySquadByIdV1(
    squadId = ''
) {
    const cleanSquadId =
        sanitizeString(squadId);

    if (!cleanSquadId) {
        return null;
    }

    const { data, error } =
        await yhuSupabaseAdmin
            .from(TABLE)
            .select('*')
            .eq(
                'record_type',
                ACADEMY_SQUAD_RECORD_TYPE
            )
            .eq(
                'source_document_id',
                cleanSquadId
            )
            .maybeSingle();

    if (error) {
        throw new Error(
            `Academy Squad lookup failed: ${error.message}`
        );
    }

    if (!data) {
        return null;
    }

    return academySquadNormalizeRecordV1(
        rowData(data)
    );
}

async function getAcademySquadByInviteCodeV1(
    inviteCode = ''
) {
    const cleanCode =
        academySquadNormalizeInviteCodeV1(
            inviteCode
        );

    if (!cleanCode) {
        return null;
    }

    const { data, error } =
        await yhuSupabaseAdmin
            .from(TABLE)
            .select('*')
            .eq(
                'record_type',
                ACADEMY_SQUAD_RECORD_TYPE
            )
            .eq(
                'data->>inviteCode',
                cleanCode
            )
            .eq(
                'data->>status',
                'active'
            )
            .limit(1);

    if (error) {
        throw new Error(
            `Academy Squad invite lookup failed: ${error.message}`
        );
    }

    const row =
        Array.isArray(data)
            ? data[0]
            : null;

    return row
        ? academySquadNormalizeRecordV1(
            rowData(row)
        )
        : null;
}

async function getCurrentAcademySquadV1(
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
}

async function createAcademySquadV1(
    uid = '',
    input = {},
    profile = {}
) {
    const cleanUid =
        sanitizeString(uid);

    if (!cleanUid) {
        throw new Error(
            'Squad owner is required.'
        );
    }

    const existing =
        await getCurrentAcademySquadV1(
            cleanUid
        );

    if (existing?.squad) {
        const error =
            new Error(
                'You already belong to a squad.'
            );

        error.statusCode = 409;
        throw error;
    }

    const name =
        sanitizeString(
            input.name
        ).slice(0, 60);

    if (name.length < 3) {
        const error =
            new Error(
                'Squad name must contain at least 3 characters.'
            );

        error.statusCode = 400;
        throw error;
    }

    const squadId =
        makeId('squad');

    let inviteCode = '';

    for (
        let attempt = 0;
        attempt < 5;
        attempt += 1
    ) {
        const candidate =
            academySquadGenerateInviteCodeV1();

        const collision =
            await getAcademySquadByInviteCodeV1(
                candidate
            );

        if (!collision) {
            inviteCode = candidate;
            break;
        }
    }

    if (!inviteCode) {
        const error =
            new Error(
                'Could not generate a unique squad invite code.'
            );

        error.statusCode = 500;
        throw error;
    }

    const now =
        nowIso();

    const owner =
        academySquadNormalizeMemberV1({
            userId: cleanUid,

            displayName:
                profile.displayName ||
                profile.display_name ||
                profile.fullName ||
                profile.full_name ||
                profile.name ||
                'YH Member',

            username:
                profile.username ||
                profile.handle ||
                '',

            avatar:
                profile.avatar ||
                profile.avatarUrl ||
                profile.avatar_url ||
                profile.profilePhoto ||
                '',

            role: 'owner',
            joinedAt: now
        });

    const squad =
        academySquadNormalizeRecordV1({
            id: squadId,
            name,

            description:
                sanitizeString(
                    input.description
                ).slice(0, 240),

            emblem:
                sanitizeString(
                    input.emblem ||
                    '⚡'
                ).slice(0, 12),

            ownerUserId:
                cleanUid,

            inviteCode,
            status: 'active',
            members: [owner],
            totalXp: 0,
            weeklyXp: 0,
            rank: 'Unranked',
            createdAt: now,
            updatedAt: now
        });

    await upsertRecord(
        ACADEMY_SQUAD_RECORD_TYPE,
        cleanUid,
        squadId,
        squad,
        {
            status: 'active'
        }
    );

    await upsertRecord(
        ACADEMY_SQUAD_MEMBERSHIP_RECORD_TYPE,
        cleanUid,
        ACADEMY_SQUAD_MEMBERSHIP_DOC_ID,
        {
            id:
                ACADEMY_SQUAD_MEMBERSHIP_DOC_ID,

            squadId,
            role: 'owner',
            status: 'active',
            joinedAt: now,
            createdAt: now,
            updatedAt: now
        },
        {
            status: 'active'
        }
    );

    return {
        squad,
        membership: {
            squadId,
            userId: cleanUid,
            role: 'owner',
            status: 'active',
            joinedAt: now
        }
    };
}

async function joinAcademySquadByInviteV1(
    uid = '',
    inviteCode = '',
    profile = {}
) {
    const cleanUid =
        sanitizeString(uid);

    if (!cleanUid) {
        throw new Error(
            'Squad member is required.'
        );
    }

    const existing =
        await getCurrentAcademySquadV1(
            cleanUid
        );

    if (existing?.squad) {
        const error =
            new Error(
                'You already belong to a squad.'
            );

        error.statusCode = 409;
        throw error;
    }

    const squad =
        await getAcademySquadByInviteCodeV1(
            inviteCode
        );

    if (!squad) {
        const error =
            new Error(
                'Invalid or expired squad invite code.'
            );

        error.statusCode = 404;
        throw error;
    }

    if (
        squad.status !== 'active'
    ) {
        const error =
            new Error(
                'This squad is no longer active.'
            );

        error.statusCode = 409;
        throw error;
    }

    if (
        squad.members.some(
            (member) =>
                member.userId ===
                cleanUid
        )
    ) {
        const error =
            new Error(
                'You are already a member of this squad.'
            );

        error.statusCode = 409;
        throw error;
    }

    if (
        squad.members.length >=
        squad.maxMembers
    ) {
        const error =
            new Error(
                'This squad has reached its 8-member limit.'
            );

        error.statusCode = 409;
        throw error;
    }

    const now =
        nowIso();

    const member =
        academySquadNormalizeMemberV1({
            userId: cleanUid,

            displayName:
                profile.displayName ||
                profile.display_name ||
                profile.fullName ||
                profile.full_name ||
                profile.name ||
                'YH Member',

            username:
                profile.username ||
                profile.handle ||
                '',

            avatar:
                profile.avatar ||
                profile.avatarUrl ||
                profile.avatar_url ||
                profile.profilePhoto ||
                '',

            role: 'member',
            joinedAt: now
        });

    const updatedSquad =
        academySquadNormalizeRecordV1({
            ...squad,
            members: [
                ...squad.members,
                member
            ],
            updatedAt: now
        });

    await upsertRecord(
        ACADEMY_SQUAD_RECORD_TYPE,
        squad.ownerUserId,
        squad.id,
        updatedSquad,
        {
            status: 'active'
        }
    );

    await upsertRecord(
        ACADEMY_SQUAD_MEMBERSHIP_RECORD_TYPE,
        cleanUid,
        ACADEMY_SQUAD_MEMBERSHIP_DOC_ID,
        {
            id:
                ACADEMY_SQUAD_MEMBERSHIP_DOC_ID,

            squadId: squad.id,
            role: 'member',
            status: 'active',
            joinedAt: now,
            createdAt: now,
            updatedAt: now
        },
        {
            status: 'active'
        }
    );

    return {
        squad: updatedSquad,
        membership: {
            squadId: squad.id,
            userId: cleanUid,
            role: 'member',
            status: 'active',
            joinedAt: now
        }
    };
}

/* END PATCH: Academy Squad Foundation core v1 */


/* PATCH: Academy Squad discovery and management v1 */

async function saveAcademySquadRecordV1(
    squad = {}
) {
    const normalized =
        academySquadNormalizeRecordV1({
            ...squad,
            updatedAt: nowIso()
        });

    if (
        !normalized.id ||
        !normalized.ownerUserId
    ) {
        throw new Error(
            'Invalid squad record.'
        );
    }

    await upsertRecord(
        ACADEMY_SQUAD_RECORD_TYPE,
        normalized.ownerUserId,
        normalized.id,
        normalized,
        {
            status: normalized.status
        }
    );

    return normalized;
}

async function updateAcademySquadMembershipV1(
    uid = '',
    payload = {}
) {
    const cleanUid =
        sanitizeString(uid);

    if (!cleanUid) {
        return null;
    }

    const current =
        await getAcademySquadMembershipV1(
            cleanUid
        );

    const now =
        nowIso();

    const record = {
        id:
            ACADEMY_SQUAD_MEMBERSHIP_DOC_ID,

        squadId:
            sanitizeString(
                payload.squadId ||
                current?.squadId ||
                ''
            ),

        role:
            sanitizeString(
                payload.role ||
                current?.role ||
                'member'
            ).toLowerCase(),

        status:
            sanitizeString(
                payload.status ||
                current?.status ||
                'active'
            ).toLowerCase(),

        joinedAt:
            toIso(
                payload.joinedAt ||
                current?.joinedAt
            ),

        leftAt:
            toIso(payload.leftAt),

        createdAt:
            toIso(
                current?.createdAt ||
                payload.createdAt
            ) || now,

        updatedAt: now
    };

    await upsertRecord(
        ACADEMY_SQUAD_MEMBERSHIP_RECORD_TYPE,
        cleanUid,
        ACADEMY_SQUAD_MEMBERSHIP_DOC_ID,
        record,
        {
            status: record.status
        }
    );

    return record;
}

async function previewAcademySquadByInviteV1(
    uid = '',
    inviteCode = ''
) {
    const cleanUid =
        sanitizeString(uid);

    const cleanCode =
        academySquadNormalizeInviteCodeV1(
            inviteCode
        );

    if (!cleanUid || !cleanCode) {
        const error =
            new Error(
                'Squad invite code is required.'
            );

        error.statusCode = 400;
        throw error;
    }

    const current =
        await getCurrentAcademySquadV1(
            cleanUid
        );

    if (current?.squad) {
        const error =
            new Error(
                'You already belong to a squad.'
            );

        error.statusCode = 409;
        throw error;
    }

    const squad =
        await getAcademySquadByInviteCodeV1(
            cleanCode
        );

    if (!squad) {
        const error =
            new Error(
                'No active squad was found for that invitation code.'
            );

        error.statusCode = 404;
        throw error;
    }

    const availableSlots =
        Math.max(
            0,
            Number(squad.maxMembers || 8) -
            Number(squad.memberCount || 0)
        );

    return {
        id: squad.id,
        name: squad.name,
        description: squad.description,
        emblem: squad.emblem,
        memberCount: squad.memberCount,
        maxMembers: squad.maxMembers,
        availableSlots,
        rank: squad.rank,
        status: squad.status,
        canJoin: availableSlots > 0
    };
}

async function regenerateAcademySquadInviteV1(
    uid = ''
) {
    const current =
        await getCurrentAcademySquadV1(
            uid
        );

    const squad =
        current?.squad;

    if (!squad) {
        const error =
            new Error(
                'You do not belong to a squad.'
            );

        error.statusCode = 404;
        throw error;
    }

    if (
        squad.ownerUserId !==
        sanitizeString(uid)
    ) {
        const error =
            new Error(
                'Only the squad owner can regenerate the invitation code.'
            );

        error.statusCode = 403;
        throw error;
    }

    let inviteCode = '';

    for (
        let attempt = 0;
        attempt < 5;
        attempt += 1
    ) {
        const candidate =
            academySquadGenerateInviteCodeV1();

        const collision =
            await getAcademySquadByInviteCodeV1(
                candidate
            );

        if (!collision) {
            inviteCode = candidate;
            break;
        }
    }

    if (!inviteCode) {
        const error =
            new Error(
                'Could not generate a new invitation code.'
            );

        error.statusCode = 500;
        throw error;
    }

    const updatedSquad =
        await saveAcademySquadRecordV1({
            ...squad,
            inviteCode
        });

    return {
        squad: updatedSquad,
        membership: current.membership
    };
}

async function leaveAcademySquadV1(
    uid = ''
) {
    const cleanUid =
        sanitizeString(uid);

    const current =
        await getCurrentAcademySquadV1(
            cleanUid
        );

    const squad =
        current?.squad;

    if (!squad) {
        const error =
            new Error(
                'You do not belong to a squad.'
            );

        error.statusCode = 404;
        throw error;
    }

    if (
        squad.ownerUserId === cleanUid
    ) {
        const error =
            new Error(
                'The squad owner must disband the squad instead of leaving it.'
            );

        error.statusCode = 409;
        throw error;
    }

    const members =
        squad.members.filter(
            (member) =>
                member.userId !== cleanUid
        );

    const updatedSquad =
        await saveAcademySquadRecordV1({
            ...squad,
            members
        });

    await updateAcademySquadMembershipV1(
        cleanUid,
        {
            squadId: squad.id,
            role:
                current.membership?.role ||
                'member',
            status: 'left',
            leftAt: nowIso()
        }
    );

    return {
        squad: updatedSquad,
        left: true
    };
}

async function manageAcademySquadMemberV1(
    uid = '',
    targetUserId = '',
    action = ''
) {
    const cleanUid =
        sanitizeString(uid);

    const cleanTargetUserId =
        sanitizeString(targetUserId);

    const cleanAction =
        sanitizeString(action)
            .toLowerCase();

    const allowedActions =
        new Set([
            'promote',
            'demote',
            'remove'
        ]);

    if (
        !cleanTargetUserId ||
        !allowedActions.has(cleanAction)
    ) {
        const error =
            new Error(
                'Invalid squad member action.'
            );

        error.statusCode = 400;
        throw error;
    }

    const current =
        await getCurrentAcademySquadV1(
            cleanUid
        );

    const squad =
        current?.squad;

    if (!squad) {
        const error =
            new Error(
                'Squad not found.'
            );

        error.statusCode = 404;
        throw error;
    }

    if (
        squad.ownerUserId !== cleanUid
    ) {
        const error =
            new Error(
                'Only the squad owner can manage members.'
            );

        error.statusCode = 403;
        throw error;
    }

    if (
        cleanTargetUserId === cleanUid
    ) {
        const error =
            new Error(
                'The squad owner role cannot be changed here.'
            );

        error.statusCode = 409;
        throw error;
    }

    const target =
        squad.members.find(
            (member) =>
                member.userId ===
                cleanTargetUserId
        );

    if (!target) {
        const error =
            new Error(
                'Squad member not found.'
            );

        error.statusCode = 404;
        throw error;
    }

    let members =
        squad.members;

    if (
        cleanAction === 'remove'
    ) {
        members =
            members.filter(
                (member) =>
                    member.userId !==
                    cleanTargetUserId
            );

        await updateAcademySquadMembershipV1(
            cleanTargetUserId,
            {
                squadId: squad.id,
                role: target.role,
                status: 'removed',
                leftAt: nowIso()
            }
        );
    } else {
        const nextRole =
            cleanAction === 'promote'
                ? 'captain'
                : 'member';

        members =
            members.map(
                (member) => {
                    if (
                        member.userId !==
                        cleanTargetUserId
                    ) {
                        return member;
                    }

                    return {
                        ...member,
                        role: nextRole
                    };
                }
            );

        await updateAcademySquadMembershipV1(
            cleanTargetUserId,
            {
                squadId: squad.id,
                role: nextRole,
                status: 'active'
            }
        );
    }

    const updatedSquad =
        await saveAcademySquadRecordV1({
            ...squad,
            members
        });

    return {
        squad: updatedSquad,
        membership: current.membership,
        action: cleanAction,
        targetUserId: cleanTargetUserId
    };
}

async function disbandAcademySquadV1(
    uid = ''
) {
    const cleanUid =
        sanitizeString(uid);

    const current =
        await getCurrentAcademySquadV1(
            cleanUid
        );

    const squad =
        current?.squad;

    if (!squad) {
        const error =
            new Error(
                'Squad not found.'
            );

        error.statusCode = 404;
        throw error;
    }

    if (
        squad.ownerUserId !== cleanUid
    ) {
        const error =
            new Error(
                'Only the squad owner can disband the squad.'
            );

        error.statusCode = 403;
        throw error;
    }

    const now =
        nowIso();

    for (
        const member of squad.members
    ) {
        await updateAcademySquadMembershipV1(
            member.userId,
            {
                squadId: squad.id,
                role: member.role,
                status: 'disbanded',
                leftAt: now
            }
        );
    }

    const disbandedSquad =
        await saveAcademySquadRecordV1({
            ...squad,
            status: 'disbanded',
            inviteCode: '',
            disbandedAt: now
        });

    return {
        squad: disbandedSquad,
        disbanded: true
    };
}

async function resolveAcademySquadMemberIdentityV1(
    member = {}
) {
    const userId =
        sanitizeString(
            member.userId
        );

    if (!userId) {
        return member;
    }

    let academyMemberRow = null;
    let universeUserRow = null;
    let academyCoreProfile = null;
    let firestoreUser = {};

    /*
     * Canonical Academy member profile.
     * This table contains display_name and full_name.
     */
    try {
        academyMemberRow =
            await academyMemberProfileSupabaseRepo
                .getProfileByUid(
                    userId
                );
    } catch (error) {
        console.warn(
            'Squad Academy member profile lookup skipped:',
            error?.message ||
            error
        );
    }

    /*
     * Canonical YH Universe user mirror.
     */
    try {
        universeUserRow =
            await yhuUsersSupabaseRepo
                .getByUid(
                    userId
                );
    } catch (error) {
        console.warn(
            'Squad Universe user lookup skipped:',
            error?.message ||
            error
        );
    }

    /*
     * Existing Academy core profile fallback.
     */
    try {
        academyCoreProfile =
            await getCurrentProfile(
                userId
            );
    } catch (_) {
        academyCoreProfile = null;
    }

    /*
     * Legacy Firestore fallback.
     */
    try {
        const snapshot =
            await usersCollection
                .doc(userId)
                .get();

        firestoreUser =
            snapshot.exists
                ? snapshot.data() || {}
                : {};
    } catch (_) {
        firestoreUser = {};
    }

    const academyMemberData =
        academyMemberRow?.data &&
        typeof academyMemberRow.data ===
            'object'
            ? academyMemberRow.data
            : {};

    const academyMemberPublicMeta =
        academyMemberRow?.public_meta &&
        typeof academyMemberRow.public_meta ===
            'object'
            ? academyMemberRow.public_meta
            : {};

    const universeUserData =
        universeUserRow?.data &&
        typeof universeUserRow.data ===
            'object'
            ? universeUserRow.data
            : {};

    const universeUserPublicMeta =
        universeUserRow?.public_meta &&
        typeof universeUserRow.public_meta ===
            'object'
            ? universeUserRow.public_meta
            : {};

    const placeholderNames =
        new Set([
            '',
            'hustler',
            'yh member',
            'academy member',
            'member',
            'user'
        ]);

    function isValidSquadDisplayNameV1(
        value = ''
    ) {
        const clean =
            sanitizeString(value);

        if (!clean) {
            return false;
        }

        const lowered =
            clean.toLowerCase();

        if (
            placeholderNames.has(
                lowered
            )
        ) {
            return false;
        }

        /*
         * Never use an email address as the visible member name.
         */
        if (
            clean.includes('@')
        ) {
            return false;
        }

        return true;
    }

    const displayNameCandidates = [
        academyMemberRow?.display_name,
        academyMemberRow?.full_name,

        academyMemberPublicMeta.displayName,
        academyMemberPublicMeta.display_name,
        academyMemberPublicMeta.fullName,
        academyMemberPublicMeta.full_name,
        academyMemberPublicMeta.name,

        academyMemberData.displayName,
        academyMemberData.display_name,
        academyMemberData.fullName,
        academyMemberData.full_name,
        academyMemberData.name,

        universeUserRow?.display_name,
        universeUserRow?.full_name,

        universeUserPublicMeta.displayName,
        universeUserPublicMeta.display_name,
        universeUserPublicMeta.fullName,
        universeUserPublicMeta.full_name,
        universeUserPublicMeta.name,

        universeUserData.displayName,
        universeUserData.display_name,
        universeUserData.fullName,
        universeUserData.full_name,
        universeUserData.name,

        academyCoreProfile?.display_name,
        academyCoreProfile?.displayName,
        academyCoreProfile?.full_name,
        academyCoreProfile?.fullName,
        academyCoreProfile?.name,

        firestoreUser.displayName,
        firestoreUser.display_name,
        firestoreUser.fullName,
        firestoreUser.full_name,
        firestoreUser.name
    ];

    const usernameCandidates = [
        academyMemberRow?.username,
        academyMemberPublicMeta.username,
        academyMemberData.username,

        universeUserRow?.username,
        universeUserPublicMeta.username,
        universeUserData.username,

        academyCoreProfile?.username,
        firestoreUser.username,

        member.username
    ];

    const resolvedUsername =
        usernameCandidates
            .map((value) =>
                sanitizeString(value)
                    .replace(/^@+/, '')
            )
            .find(Boolean) ||
        '';

    const resolvedName =
        displayNameCandidates
            .map((value) =>
                sanitizeString(value)
            )
            .find(
                isValidSquadDisplayNameV1
            ) ||
        (
            resolvedUsername &&
            !resolvedUsername.includes('@')
                ? resolvedUsername
                : ''
        ) ||
        (
            isValidSquadDisplayNameV1(
                member.displayName
            )
                ? sanitizeString(
                    member.displayName
                )
                : ''
        ) ||
        'YH Member';

    const resolvedAvatar =
        sanitizeString(
            academyMemberRow?.avatar ||
            academyMemberRow?.profile_photo ||
            academyMemberRow?.photo_url ||

            academyMemberPublicMeta.avatar ||
            academyMemberPublicMeta.avatarUrl ||
            academyMemberPublicMeta.profilePhoto ||

            academyMemberData.avatar ||
            academyMemberData.avatarUrl ||
            academyMemberData.profilePhoto ||

            universeUserRow?.avatar ||
            universeUserRow?.profile_photo ||
            universeUserRow?.photo_url ||

            universeUserPublicMeta.avatar ||
            universeUserPublicMeta.avatarUrl ||
            universeUserPublicMeta.profilePhoto ||

            universeUserData.avatar ||
            universeUserData.avatarUrl ||
            universeUserData.profilePhoto ||

            academyCoreProfile?.avatar ||
            academyCoreProfile?.avatarUrl ||
            academyCoreProfile?.avatar_url ||
            academyCoreProfile?.profilePhoto ||

            firestoreUser.avatar ||
            firestoreUser.avatarUrl ||
            firestoreUser.avatar_url ||
            firestoreUser.profilePhoto ||
            firestoreUser.photoURL ||

            member.avatar ||
            ''
        );

    return academySquadNormalizeMemberV1({
        ...member,
        displayName:
            resolvedName,

        username:
            resolvedUsername,

        avatar:
            resolvedAvatar
    });
}

async function refreshAcademySquadMemberProfilesV1(
    uid = ''
) {
    const current =
        await getCurrentAcademySquadV1(
            uid
        );

    if (!current?.squad) {
        return null;
    }

    const squad =
        current.squad;

    const refreshedMembers =
        await Promise.all(
            squad.members.map(
                (member) =>
                    resolveAcademySquadMemberIdentityV1(
                        member
                    )
            )
        );

    const hasChanges =
        refreshedMembers.some(
            (member, index) => {
                const previous =
                    squad.members[index] ||
                    {};

                return (
                    member.displayName !==
                        previous.displayName ||
                    member.username !==
                        previous.username ||
                    member.avatar !==
                        previous.avatar
                );
            }
        );

    const refreshedSquad =
        hasChanges
            ? await saveAcademySquadRecordV1({
                ...squad,
                members:
                    refreshedMembers
            })
            : {
                ...squad,
                members:
                    refreshedMembers,
                memberCount:
                    refreshedMembers.length
            };

    const activeMember =
        refreshedMembers.find(
            (member) =>
                member.userId ===
                sanitizeString(uid)
        ) || null;

    return {
        squad: refreshedSquad,

        membership: {
            ...current.membership,

            role:
                activeMember?.role ||
                current.membership?.role ||
                'member'
        }
    };
}

/* END PATCH: Academy Squad discovery and management v1 */


/* PATCH: Academy Squad XP ledger v1 */

const ACADEMY_SQUAD_XP_EVENT_RECORD_TYPE =
    'academy:squadXpEvent';

function academySquadXpWeekStartV1(
    value = new Date()
) {
    const date =
        value instanceof Date
            ? new Date(value)
            : new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return '';
    }

    const day =
        date.getUTCDay();

    const diff =
        day === 0
            ? 6
            : day - 1;

    date.setUTCDate(
        date.getUTCDate() - diff
    );

    date.setUTCHours(
        0,
        0,
        0,
        0
    );

    return date.toISOString();
}

function academySquadLevelFromXpV1(
    totalXp = 0
) {
    const safeXp =
        Math.max(
            0,
            toNumber(totalXp, 0)
        );

    /*
     * Level 1 starts at 0.
     * Each next Squad level requires another 500 XP.
     */
    const level =
        Math.floor(
            safeXp / 500
        ) + 1;

    return {
        level,
        levelStartXp:
            (level - 1) * 500,
        nextLevelXp:
            level * 500
    };
}

function academySquadXpEventIdV1({
    squadId = '',
    contributorUserId = '',
    eventType = '',
    sourceId = '',
    dedupeScope = 'member'
} = {}) {
    const cleanDedupeScope =
        sanitizeString(
            dedupeScope
        ).toLowerCase() === 'squad'
            ? 'squad'
            : 'member';

    const contributorKey =
        cleanDedupeScope === 'squad'
            ? 'squad'
            : sanitizeString(
                contributorUserId
            );

    const raw = [
        sanitizeString(squadId),
        contributorKey,
        sanitizeString(eventType)
            .toLowerCase(),
        sanitizeString(sourceId)
    ].join('|');

    return crypto
        .createHash('sha256')
        .update(raw)
        .digest('hex');
}

async function listAcademySquadXpEventsV1(
    squad = {},
    limit = 500
) {
    const squadId =
        sanitizeString(squad.id);

    const ownerUserId =
        sanitizeString(
            squad.ownerUserId
        );

    if (
        !squadId ||
        !ownerUserId
    ) {
        return [];
    }

    const rows =
        await getRows(
            ACADEMY_SQUAD_XP_EVENT_RECORD_TYPE,
            ownerUserId,
            {
                limit:
                    Math.max(
                        1,
                        Math.min(
                            500,
                            Number(limit) || 500
                        )
                    )
            }
        );

    return rows
        .map((row) =>
            rowData(row)
        )
        .filter(
            (event) =>
                sanitizeString(
                    event.squadId
                ) === squadId
        );
}

async function recomputeAcademySquadXpV1(
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
}

async function recordAcademySquadXpContributionV1(
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
}

/* END PATCH: Academy Squad XP ledger v1 */


/* PATCH: Academy Squad leaderboard and contributors v1 */

async function listAcademySquadLeaderboardV1(
    period = 'weekly',
    limit = 20,
    currentSquadId = ''
) {
    const cleanPeriod =
        sanitizeString(period)
            .toLowerCase() ===
            'all_time'
            ? 'all_time'
            : 'weekly';

    const safeLimit =
        Math.max(
            1,
            Math.min(
                100,
                Number(limit) || 20
            )
        );

    const { data, error } =
        await yhuSupabaseAdmin
            .from(TABLE)
            .select('*')
            .eq(
                'record_type',
                ACADEMY_SQUAD_RECORD_TYPE
            )
            .limit(500);

    if (error) {
        throw new Error(
            `Academy Squad leaderboard failed: ${error.message}`
        );
    }

    const xpField =
        cleanPeriod === 'all_time'
            ? 'totalXp'
            : 'weeklyXp';

    const entries =
        (Array.isArray(data) ? data : [])
            .map((row) =>
                academySquadNormalizeRecordV1(
                    rowData(row)
                )
            )
            .filter((squad) => {
                return (
                    squad.id &&
                    squad.status === 'active'
                );
            })
            .map((squad) => ({
                squadId:
                    squad.id,

                name:
                    squad.name,

                emblem:
                    squad.emblem,

                memberCount:
                    squad.memberCount,

                maxMembers:
                    squad.maxMembers,

                level:
                    squad.level,

                totalXp:
                    squad.totalXp,

                weeklyXp:
                    squad.weeklyXp,

                xp:
                    Math.max(
                        0,
                        toNumber(
                            squad[xpField],
                            0
                        )
                    ),

                createdAt:
                    squad.createdAt,

                ownerUserId:
                    squad.ownerUserId
            }))
            .sort((a, b) => {
                if (b.xp !== a.xp) {
                    return b.xp - a.xp;
                }

                if (
                    b.totalXp !==
                    a.totalXp
                ) {
                    return (
                        b.totalXp -
                        a.totalXp
                    );
                }

                const aCreated =
                    new Date(
                        a.createdAt || 0
                    ).getTime();

                const bCreated =
                    new Date(
                        b.createdAt || 0
                    ).getTime();

                return (
                    aCreated -
                    bCreated
                );
            })
            .map((entry, index) => ({
                ...entry,

                position:
                    index + 1,

                period:
                    cleanPeriod
            }));

    const cleanCurrentSquadId =
        sanitizeString(
            currentSquadId
        );

    const currentSquadPosition =
        cleanCurrentSquadId
            ? entries.find(
                (entry) =>
                    entry.squadId ===
                    cleanCurrentSquadId
            ) || null
            : null;

    return {
        period:
            cleanPeriod,

        leaderboard:
            entries.slice(
                0,
                safeLimit
            ),

        currentSquadPosition
    };
}

async function listAcademySquadContributorsV1(
    uid = '',
    period = 'weekly',
    limit = 20
) {
    const cleanUid =
        sanitizeString(uid);

    const cleanPeriod =
        sanitizeString(period)
            .toLowerCase() ===
            'all_time'
            ? 'all_time'
            : 'weekly';

    const safeLimit =
        Math.max(
            1,
            Math.min(
                100,
                Number(limit) || 20
            )
        );

    const current =
        await getCurrentAcademySquadV1(
            cleanUid
        );

    const squad =
        current?.squad;

    if (!squad) {
        const error =
            new Error(
                'You do not belong to a squad.'
            );

        error.statusCode = 404;
        throw error;
    }

    const events =
        await listAcademySquadXpEventsV1(
            squad,
            500
        );

    const weekStart =
        academySquadXpWeekStartV1();

    const selectedEvents =
        cleanPeriod === 'weekly'
            ? events.filter((event) => {
                const eventAt =
                    toIso(
                        event.eventAt ||
                        event.createdAt
                    );

                return (
                    Boolean(eventAt) &&
                    Boolean(weekStart) &&
                    eventAt >= weekStart
                );
            })
            : events;

    const contributorsByUser =
        new Map();

    for (
        const event of selectedEvents
    ) {
        const contributorUserId =
            sanitizeString(
                event.contributorUserId
            );

        if (!contributorUserId) {
            continue;
        }

        const member =
            squad.members.find(
                (entry) =>
                    entry.userId ===
                    contributorUserId
            ) || null;

        const existing =
            contributorsByUser.get(
                contributorUserId
            ) || {
                userId:
                    contributorUserId,

                displayName:
                    sanitizeString(
                        member?.displayName ||
                        event.contributorName ||
                        member?.username ||
                        'YH Member'
                    ),

                username:
                    sanitizeString(
                        member?.username ||
                        ''
                    ),

                avatar:
                    sanitizeString(
                        member?.avatar ||
                        ''
                    ),

                role:
                    sanitizeString(
                        member?.role ||
                        event.contributorRole ||
                        'former_member'
                    ),

                xp: 0,
                contributionCount: 0,
                lastContributionAt: ''
            };

        existing.xp +=
            Math.max(
                0,
                toNumber(
                    event.xp,
                    0
                )
            );

        existing.contributionCount +=
            1;

        const eventAt =
            toIso(
                event.eventAt ||
                event.createdAt
            );

        if (
            eventAt &&
            (
                !existing.lastContributionAt ||
                eventAt >
                    existing.lastContributionAt
            )
        ) {
            existing.lastContributionAt =
                eventAt;
        }

        contributorsByUser.set(
            contributorUserId,
            existing
        );
    }

    const contributors =
        Array.from(
            contributorsByUser.values()
        )
            .sort((a, b) => {
                if (b.xp !== a.xp) {
                    return b.xp - a.xp;
                }

                if (
                    b.contributionCount !==
                    a.contributionCount
                ) {
                    return (
                        b.contributionCount -
                        a.contributionCount
                    );
                }

                return String(
                    a.displayName
                ).localeCompare(
                    String(
                        b.displayName
                    )
                );
            })
            .slice(0, safeLimit)
            .map((entry, index) => ({
                ...entry,
                position:
                    index + 1,
                period:
                    cleanPeriod
            }));

    return {
        squadId:
            squad.id,

        period:
            cleanPeriod,

        contributors
    };
}

/* END PATCH: Academy Squad leaderboard and contributors v1 */


/* PATCH: Shared Academy Squad Missions foundation v1 */

const ACADEMY_SQUAD_MISSION_RECORD_TYPE =
    'academy:squadMission';

const ACADEMY_SQUAD_MISSION_TYPES_V1 =
    new Set([
        'academy_missions',
        'verified_leads',
        'daily_checkins',
        'squad_xp',
        'mission_playbooks',
        'custom'
    ]);

const ACADEMY_SQUAD_MISSION_STATUSES_V1 =
    new Set([
        'active',
        'completed',
        'cancelled'
    ]);

function normalizeAcademySquadMissionTypeV1(
    value = ''
) {
    const clean =
        sanitizeString(value)
            .toLowerCase()
            .replace(/[\s-]+/g, '_');

    return ACADEMY_SQUAD_MISSION_TYPES_V1
        .has(clean)
            ? clean
            : 'custom';
}

function normalizeAcademySquadMissionStatusV1(
    value = ''
) {
    const clean =
        sanitizeString(value)
            .toLowerCase();

    return ACADEMY_SQUAD_MISSION_STATUSES_V1
        .has(clean)
            ? clean
            : 'active';
}

function academySquadMissionRewardCapV1(
    missionType = '',
    target = 1
) {
    const cleanMissionType =
        normalizeAcademySquadMissionTypeV1(
            missionType
        );

    const safeTarget =
        Math.max(
            1,
            Math.floor(
                toNumber(
                    target,
                    1
                )
            )
        );

    const rawCap = {
        academy_missions:
            safeTarget * 20,

        verified_leads:
            safeTarget * 25,

        daily_checkins:
            safeTarget * 10,

        squad_xp:
            Math.ceil(
                safeTarget * 0.2
            ),

        mission_playbooks:
            safeTarget * 30,

        custom:
            0
    }[cleanMissionType] || 0;

    return Math.max(
        0,
        Math.min(
            250,
            rawCap
        )
    );
}

function normalizeAcademySquadMissionV1(
    value = {}
) {
    const source =
        value &&
        typeof value === 'object'
            ? value
            : {};

    const missionType =
        normalizeAcademySquadMissionTypeV1(
            source.missionType ||
            source.type
        );

    const target =
        Math.max(
            1,
            Math.floor(
                toNumber(
                    source.target,
                    1
                )
            )
        );

    const progress =
        Math.max(
            0,
            Math.min(
                target,
                Math.floor(
                    toNumber(
                        source.progress,
                        0
                    )
                )
            )
        );

    let status =
        normalizeAcademySquadMissionStatusV1(
            source.status
        );

    if (
        progress >= target &&
        status === 'active'
    ) {
        status = 'completed';
    }

    const rewardCap =
        academySquadMissionRewardCapV1(
            missionType,
            target
        );

    const requestedRewardXp =
        Math.max(
            0,
            Math.floor(
                toNumber(
                    source.rewardXp,
                    rewardCap
                )
            )
        );

    return {
        id:
            sanitizeString(
                source.id ||
                source.missionId
            ),

        squadId:
            sanitizeString(
                source.squadId
            ),

        title:
            sanitizeString(
                source.title ||
                'Squad Mission'
            ).slice(0, 100),

        description:
            sanitizeString(
                source.description ||
                ''
            ).slice(0, 500),

        missionType,

        target,
        progress,

        rewardXp:
            Math.min(
                rewardCap,
                requestedRewardXp
            ),

        rewardCap,

        status,

        createdByUserId:
            sanitizeString(
                source.createdByUserId
            ),

        createdByName:
            sanitizeString(
                source.createdByName ||
                'YH Member'
            ),

        deadline:
            toIso(
                source.deadline
            ),

        completedAt:
            toIso(
                source.completedAt
            ),

        cancelledAt:
            toIso(
                source.cancelledAt
            ),

        metadata:
            source.metadata &&
            typeof source.metadata ===
                'object'
                ? source.metadata
                : {},

        createdAt:
            toIso(
                source.createdAt
            ) || nowIso(),

        updatedAt:
            toIso(
                source.updatedAt
            ) || nowIso()
    };
}

async function requireAcademySquadMemberV1(
    uid = ''
) {
    const cleanUid =
        sanitizeString(uid);

    const current =
        await getCurrentAcademySquadV1(
            cleanUid
        );

    if (!current?.squad) {
        const error =
            new Error(
                'You do not belong to an active squad.'
            );

        error.statusCode = 404;
        throw error;
    }

    const member =
        current.squad.members.find(
            (entry) =>
                entry.userId ===
                cleanUid
        ) || null;

    if (!member) {
        const error =
            new Error(
                'Your Squad membership is not active.'
            );

        error.statusCode = 403;
        throw error;
    }

    return {
        squad:
            current.squad,

        membership: {
            ...current.membership,
            role:
                member.role ||
                current.membership?.role ||
                'member'
        },

        member
    };
}

function requireAcademySquadMissionManagerV1(
    squadContext = {}
) {
    const role =
        sanitizeString(
            squadContext
                ?.membership
                ?.role
        ).toLowerCase();

    if (
        role !== 'owner' &&
        role !== 'captain'
    ) {
        const error =
            new Error(
                'Only the Squad owner or a captain can manage Squad missions.'
            );

        error.statusCode = 403;
        throw error;
    }

    return role;
}

async function getAcademySquadMissionByIdV1(
    squad = {},
    missionId = ''
) {
    const cleanMissionId =
        sanitizeString(
            missionId
        );

    if (
        !squad?.ownerUserId ||
        !cleanMissionId
    ) {
        return null;
    }

    const row =
        await getOne(
            ACADEMY_SQUAD_MISSION_RECORD_TYPE,
            squad.ownerUserId,
            cleanMissionId
        );

    if (!row) {
        return null;
    }

    const mission =
        normalizeAcademySquadMissionV1(
            rowData(row)
        );

    return (
        mission.squadId ===
        squad.id
    )
        ? mission
        : null;
}

async function listAcademySquadMissionsV1(
    uid = '',
    options = {}
) {
    const context =
        await requireAcademySquadMemberV1(
            uid
        );

    const cleanStatus =
        sanitizeString(
            options.status
        ).toLowerCase();

    const limit =
        Math.max(
            1,
            Math.min(
                100,
                Number(
                    options.limit
                ) || 50
            )
        );

    const rows =
        await getRows(
            ACADEMY_SQUAD_MISSION_RECORD_TYPE,
            context.squad.ownerUserId,
            {
                limit: 500
            }
        );

    const missions =
        rows
            .map((row) =>
                normalizeAcademySquadMissionV1(
                    rowData(row)
                )
            )
            .filter(
                (mission) =>
                    mission.squadId ===
                    context.squad.id
            )
            .filter((mission) => {
                if (!cleanStatus) {
                    return true;
                }

                return (
                    mission.status ===
                    cleanStatus
                );
            })
            .sort((a, b) => {
                if (
                    a.status === 'active' &&
                    b.status !== 'active'
                ) {
                    return -1;
                }

                if (
                    b.status === 'active' &&
                    a.status !== 'active'
                ) {
                    return 1;
                }

                const aDeadline =
                    new Date(
                        a.deadline || 0
                    ).getTime();

                const bDeadline =
                    new Date(
                        b.deadline || 0
                    ).getTime();

                if (
                    aDeadline &&
                    bDeadline &&
                    aDeadline !== bDeadline
                ) {
                    return (
                        aDeadline -
                        bDeadline
                    );
                }

                return (
                    new Date(
                        b.createdAt || 0
                    ).getTime() -
                    new Date(
                        a.createdAt || 0
                    ).getTime()
                );
            })
            .slice(0, limit);

    return {
        squadId:
            context.squad.id,

        role:
            context.membership.role,

        canManage:
            ['owner', 'captain']
                .includes(
                    context
                        .membership
                        .role
                ),

        missions
    };
}

async function createAcademySquadMissionV1(
    uid = '',
    input = {},
    profile = {}
) {
    const context =
        await requireAcademySquadMemberV1(
            uid
        );

    requireAcademySquadMissionManagerV1(
        context
    );

    const title =
        sanitizeString(
            input.title
        ).slice(0, 100);

    if (title.length < 3) {
        const error =
            new Error(
                'Squad mission title must contain at least 3 characters.'
            );

        error.statusCode = 400;
        throw error;
    }

    const target =
        Math.max(
            1,
            Math.floor(
                toNumber(
                    input.target,
                    1
                )
            )
        );

    if (target > 10000) {
        const error =
            new Error(
                'Squad mission target is too large.'
            );

        error.statusCode = 400;
        throw error;
    }

    const deadline =
        toIso(
            input.deadline
        );

    if (
        deadline &&
        Number.isNaN(
            new Date(
                deadline
            ).getTime()
        )
    ) {
        const error =
            new Error(
                'Invalid Squad mission deadline.'
            );

        error.statusCode = 400;
        throw error;
    }

    const now =
        nowIso();

    const mission =
        normalizeAcademySquadMissionV1({
            id:
                makeId(
                    'squad_mission'
                ),

            squadId:
                context.squad.id,

            title,

            description:
                sanitizeString(
                    input.description
                ).slice(0, 500),

            missionType:
                input.missionType ||
                input.type ||
                'custom',

            target,
            progress: 0,

            rewardXp:
                input.rewardXp,

            status: 'active',

            createdByUserId:
                sanitizeString(uid),

            createdByName:
                sanitizeString(
                    profile.displayName ||
                    profile.display_name ||
                    profile.fullName ||
                    profile.full_name ||
                    profile.name ||
                    context
                        .member
                        .displayName ||
                    context
                        .member
                        .username ||
                    'YH Member'
                ),

            deadline,

            metadata:
                input.metadata,

            createdAt: now,
            updatedAt: now
        });

    await upsertRecord(
        ACADEMY_SQUAD_MISSION_RECORD_TYPE,
        context.squad.ownerUserId,
        mission.id,
        mission,
        {
            status:
                mission.status
        }
    );

    return {
        squad:
            context.squad,

        membership:
            context.membership,

        mission
    };
}

async function updateAcademySquadMissionV1(
    uid = '',
    missionId = '',
    input = {}
) {
    const context =
        await requireAcademySquadMemberV1(
            uid
        );

    requireAcademySquadMissionManagerV1(
        context
    );

    const existing =
        await getAcademySquadMissionByIdV1(
            context.squad,
            missionId
        );

    if (!existing) {
        const error =
            new Error(
                'Squad mission not found.'
            );

        error.statusCode = 404;
        throw error;
    }

    if (
        existing.status !== 'active'
    ) {
        const error =
            new Error(
                'Only active Squad missions can be edited.'
            );

        error.statusCode = 409;
        throw error;
    }

    const nextTitle =
        input.title !== undefined
            ? sanitizeString(
                input.title
            ).slice(0, 100)
            : existing.title;

    if (nextTitle.length < 3) {
        const error =
            new Error(
                'Squad mission title must contain at least 3 characters.'
            );

        error.statusCode = 400;
        throw error;
    }

    const nextTarget =
        input.target !== undefined
            ? Math.max(
                1,
                Math.floor(
                    toNumber(
                        input.target,
                        existing.target
                    )
                )
            )
            : existing.target;

    const nextMissionType =
        input.missionType !== undefined
            ? normalizeAcademySquadMissionTypeV1(
                input.missionType
            )
            : existing.missionType;

    if (
        existing.progress > 0 &&
        nextMissionType !==
            existing.missionType
    ) {
        const error =
            new Error(
                'Mission type cannot change after Squad progress has started.'
            );

        error.statusCode = 409;
        throw error;
    }

    if (
        existing.progress > 0 &&
        nextTarget <=
            existing.progress
    ) {
        const error =
            new Error(
                'Mission target must stay above the current progress.'
            );

        error.statusCode = 409;
        throw error;
    }

    const nextDeadline =
        input.deadline !== undefined
            ? toIso(
                input.deadline
            )
            : existing.deadline;

    const updated =
        normalizeAcademySquadMissionV1({
            ...existing,

            title:
                nextTitle,

            description:
                input.description !==
                    undefined
                    ? sanitizeString(
                        input.description
                    ).slice(0, 500)
                    : existing.description,

            missionType:
                nextMissionType,

            target:
                nextTarget,

            rewardXp:
                input.rewardXp !==
                    undefined
                    ? input.rewardXp
                    : existing.rewardXp,

            deadline:
                nextDeadline,

            metadata:
                input.metadata &&
                typeof input.metadata ===
                    'object'
                    ? {
                        ...existing.metadata,
                        ...input.metadata
                    }
                    : existing.metadata,

            updatedAt:
                nowIso()
        });

    await upsertRecord(
        ACADEMY_SQUAD_MISSION_RECORD_TYPE,
        context.squad.ownerUserId,
        updated.id,
        updated,
        {
            status:
                updated.status
        }
    );

    return {
        squad:
            context.squad,

        membership:
            context.membership,

        mission:
            updated
    };
}

async function cancelAcademySquadMissionV1(
    uid = '',
    missionId = ''
) {
    const context =
        await requireAcademySquadMemberV1(
            uid
        );

    requireAcademySquadMissionManagerV1(
        context
    );

    const existing =
        await getAcademySquadMissionByIdV1(
            context.squad,
            missionId
        );

    if (!existing) {
        const error =
            new Error(
                'Squad mission not found.'
            );

        error.statusCode = 404;
        throw error;
    }

    if (
        existing.status ===
        'completed'
    ) {
        const error =
            new Error(
                'A completed Squad mission cannot be cancelled.'
            );

        error.statusCode = 409;
        throw error;
    }

    if (
        existing.status ===
        'cancelled'
    ) {
        return {
            squad:
                context.squad,

            membership:
                context.membership,

            mission:
                existing,

            cancelled: true,
            duplicate: true
        };
    }

    const now =
        nowIso();

    const cancelled =
        normalizeAcademySquadMissionV1({
            ...existing,
            status:
                'cancelled',
            cancelledAt:
                now,
            updatedAt:
                now
        });

    await upsertRecord(
        ACADEMY_SQUAD_MISSION_RECORD_TYPE,
        context.squad.ownerUserId,
        cancelled.id,
        cancelled,
        {
            status:
                'cancelled'
        }
    );

    return {
        squad:
            context.squad,

        membership:
            context.membership,

        mission:
            cancelled,

        cancelled: true
    };
}

/* END PATCH: Shared Academy Squad Missions foundation v1 */


/* PATCH: Automatic Shared Squad Mission progress v1 */

const ACADEMY_SQUAD_MISSION_CONTRIBUTION_RECORD_TYPE =
    'academy:squadMissionContribution';

function academySquadMissionContributionIdV1({
    squadId = '',
    missionId = '',
    contributorUserId = '',
    eventType = '',
    sourceId = ''
} = {}) {
    const raw = [
        sanitizeString(
            squadId
        ),
        sanitizeString(
            missionId
        ),
        sanitizeString(
            contributorUserId
        ),
        sanitizeString(
            eventType
        ).toLowerCase(),
        sanitizeString(
            sourceId
        )
    ].join('|');

    return crypto
        .createHash('sha256')
        .update(raw)
        .digest('hex');
}

async function listAcademySquadMissionContributionsV1(
    squad = {},
    missionId = '',
    limit = 500
) {
    const squadId =
        sanitizeString(
            squad.id
        );

    const ownerUserId =
        sanitizeString(
            squad.ownerUserId
        );

    const cleanMissionId =
        sanitizeString(
            missionId
        );

    if (
        !squadId ||
        !ownerUserId ||
        !cleanMissionId
    ) {
        return [];
    }

    const rows =
        await getRows(
            ACADEMY_SQUAD_MISSION_CONTRIBUTION_RECORD_TYPE,
            ownerUserId,
            {
                limit:
                    Math.max(
                        1,
                        Math.min(
                            500,
                            Number(limit) || 500
                        )
                    )
            }
        );

    return rows
        .map((row) =>
            rowData(row)
        )
        .filter((entry) => {
            return (
                sanitizeString(
                    entry.squadId
                ) === squadId &&
                sanitizeString(
                    entry.missionId
                ) === cleanMissionId
            );
        });
}

/*
 * Public member-safe Squad Mission contribution history.
 * Membership and mission ownership are verified server-side.
 */
async function getAcademySquadMissionContributionsV1(
    uid = '',
    missionId = '',
    options = {}
) {
    const context =
        await requireAcademySquadMemberV1(
            uid
        );

    const cleanMissionId =
        sanitizeString(
            missionId
        );

    if (!cleanMissionId) {
        const error =
            new Error(
                'Squad mission ID is required.'
            );

        error.statusCode = 400;
        throw error;
    }

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

    const limit =
        Math.max(
            1,
            Math.min(
                200,
                Number(
                    options.limit
                ) || 100
            )
        );

    const allContributions =
        await listAcademySquadMissionContributionsV1(
            context.squad,
            cleanMissionId,
            500
        );

    const contributions =
        allContributions
            .map((entry) => ({
                id:
                    sanitizeString(
                        entry.id
                    ),

                missionId:
                    sanitizeString(
                        entry.missionId
                    ),

                contributorUserId:
                    sanitizeString(
                        entry.contributorUserId
                    ),

                contributorName:
                    sanitizeString(
                        entry.contributorName ||
                        'YH Member'
                    ),

                contributorRole:
                    sanitizeString(
                        entry.contributorRole ||
                        'member'
                    ),

                eventType:
                    sanitizeString(
                        entry.eventType
                    ),

                sourceId:
                    sanitizeString(
                        entry.sourceId
                    ),

                sourceType:
                    sanitizeString(
                        entry.sourceType
                    ),

                amount:
                    Math.max(
                        0,
                        Math.floor(
                            toNumber(
                                entry.amount,
                                0
                            )
                        )
                    ),

                label:
                    sanitizeString(
                        entry.label ||
                        'Squad mission contribution'
                    ),

                eventAt:
                    toIso(
                        entry.eventAt ||
                        entry.createdAt
                    ),

                metadata:
                    entry.metadata &&
                    typeof entry.metadata ===
                        'object'
                        ? entry.metadata
                        : {},

                createdAt:
                    toIso(
                        entry.createdAt
                    )
            }))
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
            });

    const contributorMap =
        new Map();

    for (
        const contribution of
        contributions
    ) {
        const contributorKey =
            contribution
                .contributorUserId ||
            contribution
                .contributorName
                .toLowerCase();

        const existing =
            contributorMap.get(
                contributorKey
            ) || {
                userId:
                    contribution
                        .contributorUserId,

                displayName:
                    contribution
                        .contributorName ||
                    'YH Member',

                role:
                    contribution
                        .contributorRole ||
                    'member',

                amount: 0,
                events: 0,
                lastContributionAt: ''
            };

        existing.amount +=
            contribution.amount;

        existing.events += 1;

        if (
            !existing
                .lastContributionAt ||
            new Date(
                contribution.eventAt ||
                0
            ).getTime() >
            new Date(
                existing
                    .lastContributionAt ||
                0
            ).getTime()
        ) {
            existing.lastContributionAt =
                contribution.eventAt;
        }

        contributorMap.set(
            contributorKey,
            existing
        );
    }

    const contributors =
        Array.from(
            contributorMap.values()
        )
            .sort((a, b) => {
                if (
                    b.amount !==
                    a.amount
                ) {
                    return (
                        b.amount -
                        a.amount
                    );
                }

                return (
                    new Date(
                        b.lastContributionAt ||
                        0
                    ).getTime() -
                    new Date(
                        a.lastContributionAt ||
                        0
                    ).getTime()
                );
            });

    const totalProgress =
        contributions.reduce(
            (sum, contribution) => {
                return (
                    sum +
                    contribution.amount
                );
            },
            0
        );

    return {
        squadId:
            context.squad.id,

        role:
            context.membership.role,

        canManage:
            ['owner', 'captain']
                .includes(
                    context
                        .membership
                        .role
                ),

        mission,

        contributionCount:
            contributions.length,

        contributorCount:
            contributors.length,

        totalProgress,

        contributors,

        contributions:
            contributions.slice(
                0,
                limit
            )
    };
}

async function reconcileAcademySquadMissionProgressV1(
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
}

/* PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */

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
}

/* END PATCH: Phase 3C.4B — persistent Squad achievement and notifications v1 */


/* END PATCH: Automatic Shared Squad Mission progress v1 */


module.exports = {
    getCurrentProfile,
    setCurrentProfile,
    deleteAllCoreRecordsByUserId,
    deleteCurrentProfile,
    getAccessState,
    setAccessUnlocked,
    getActiveRoadmap,
    getRoadmapById,
    getMissionById,
    updateMissionCompletion,
    updateMissionStatus,
    updateMission,
    completeMission: updateMissionCompletion,
    saveMissionJournalV1,
    saveMissionVerificationV1,
    completeMissionAfterVerificationV1,
    updateMissionOutcomeMetrics,
    getMissionProgress,
    listRecentMissions,
    listAllMissionsByRoadmap,
    listRecentCheckins,
    createCheckin,
    getRecentCheckinStreakDays,

    getAcademyProgressionV1,
    syncAcademyProgressionFromCurrentStateV1,
    listAcademyProgressionLeaderboardV1,
    listAcademyXpEventsV1,
    upsertAcademyXpEventV1,

    listAcademySoloEventsV1,
    recordAcademySoloMissionCompletionV1,
    buildAcademySoloModeSummaryV1,

    getAcademySquadMembershipV1,
    getAcademySquadByIdV1,
    getAcademySquadByInviteCodeV1,
    getCurrentAcademySquadV1,
    createAcademySquadV1,
    joinAcademySquadByInviteV1,

    previewAcademySquadByInviteV1,
    regenerateAcademySquadInviteV1,
    leaveAcademySquadV1,
    manageAcademySquadMemberV1,
    disbandAcademySquadV1,
    refreshAcademySquadMemberProfilesV1,

    listAcademySquadXpEventsV1,
    recomputeAcademySquadXpV1,
    recordAcademySquadXpContributionV1,

    listAcademySquadLeaderboardV1,
    listAcademySquadContributorsV1,

    getAcademySquadMissionByIdV1,
    listAcademySquadMissionsV1,
    createAcademySquadMissionV1,
    updateAcademySquadMissionV1,
    cancelAcademySquadMissionV1,

    listAcademySquadMissionContributionsV1,
    getAcademySquadMissionContributionsV1,
    recordAcademySquadMissionContributionV1,
    recordAcademySquadMissionAchievementV1,

    computeBehaviorProfile,
    saveBehaviorProfile,
    computePlannerStats,
    savePlannerStats,
    createPlannerRun,
    getPlannerRunById,
    getLatestPlannerRun,
    buildRoadmapTelemetryInspector,
    updatePlannerRunResult,
    persistRoadmapBundle,
    migrateLegacyRoadmapShellV1,
    repairRoadmapMissionBundleV1,
    buildAcademyHomePayload,
    listCoachMessages,
    createCoachMessage,
    createLeadMissionLead,
    listLeadMissionLeads,
    getLeadMissionLeadById,
    updateLeadMissionLead,
    deleteLeadMissionLead,
    listLeadMissionFollowUps,
    listLeadMissionPayouts,
    listLeadMissionDeals,
    getLeadMissionScripts
};
