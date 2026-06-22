const crypto = require('crypto');
const { firestore } = require('../../config/firebaseAdmin');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

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

    if (options.roadmapId) {
        query = query.eq('roadmap_id', String(options.roadmapId));
    }

    if (options.status) {
        query = query.eq('status', String(options.status));
    }

    query = query.order('updated_at_source', { ascending: false, nullsFirst: false });

    const { data, error } = await query;

    if (error) {
        throw new Error(`Academy Supabase list failed (${recordType}): ${error.message}`);
    }

    return Array.isArray(data) ? data : [];
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
    const data = normalizeForJson({
        ...payload,
        id: payload.id || cleanDocId,
        updatedAt: payload.updatedAt || now,
        createdAt: payload.createdAt || now
    });

    const row = {
        firebase_app: 'supabase',
        source_collection_path: collectionPathFor(recordType, cleanUid),
        source_collection_root: 'users',
        source_document_id: cleanDocId,
        source_document_path: sourcePathFor(recordType, cleanUid, cleanDocId),
        record_type: recordType,

        user_id: cleanUid,
        roadmap_id: sanitizeString(extra.roadmapId || data.roadmapId || ''),
        status: sanitizeString(extra.status || data.status || ''),

        data,

        created_at_source: toIso(data.createdAt) || now,
        updated_at_source: toIso(data.updatedAt) || now,
        updated_at: now
    };

    const { data: saved, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .upsert(row, { onConflict: 'source_document_path' })
        .select('*')
        .single();

    if (error) {
        throw new Error(`Academy Supabase upsert failed (${recordType}/${cleanDocId}): ${error.message}`);
    }

    return saved;
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

    const completedCount = allMissions.filter((item) => item.status === 'completed').length;
    const totalCount = allMissions.length;
    const plazaReadiness = buildAcademyPlazaReadinessPayload(profileDoc || {}, roadmap || {}, allMissions);

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
        missions,
        allMissions,
        progress: {
            total: totalCount,
            completed: completedCount,
            pending: allMissions.filter((item) => item.status === 'pending').length,
            skipped: allMissions.filter((item) => item.status === 'skipped').length,
            stuck: allMissions.filter((item) => item.status === 'stuck').length,
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

    const missions = Array.isArray(plan.missions) ? plan.missions : [];
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

module.exports = {
    getCurrentProfile,
    setCurrentProfile,
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
    updateMissionOutcomeMetrics,
    getMissionProgress,
    listRecentMissions,
    listAllMissionsByRoadmap,
    listRecentCheckins,
    createCheckin,
    getRecentCheckinStreakDays,
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
    buildAcademyHomePayload,
    listCoachMessages,
    createCoachMessage,
    createLeadMissionLead,
    listLeadMissionLeads,
    getLeadMissionLeadById,
    updateLeadMissionLead,
    listLeadMissionFollowUps,
    listLeadMissionPayouts,
    listLeadMissionDeals,
    getLeadMissionScripts
};
