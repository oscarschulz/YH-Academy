const crypto = require('crypto');
const { yhuSupabaseAdmin } = require('../../config/supabaseAdmin');

const TABLE = 'yhu_academy_core_records';

function clean(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function cleanLower(value, fallback = '') {
    return clean(value, fallback).toLowerCase();
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value) {
    return value === true || String(value || '').toLowerCase() === 'true';
}

function arr(value = [], limit = 99) {
    const source = Array.isArray(value) ? value : String(value || '').split(/\n|,|•|- /g);
    const out = [];
    const seen = new Set();

    for (const item of source) {
        const v = clean(item);
        const k = v.toLowerCase();
        if (!v || seen.has(k)) continue;
        seen.add(k);
        out.push(v);
        if (out.length >= limit) break;
    }

    return out;
}

function nowIso() {
    return new Date().toISOString();
}

function buildId(prefix = 'acore') {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
}

function academyDateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return new Date().toISOString().slice(0, 10);
    return date.toISOString().slice(0, 10);
}

function toIso(value, fallback = '') {
    if (!value) return fallback;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (typeof value === 'object') {
        if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000).toISOString();
        if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000).toISOString();
    }
    return clean(value, fallback);
}

function sourceCollectionPath(uid, collectionName) {
    return `users/${clean(uid)}/${clean(collectionName)}`;
}

function sourceDocumentPath(uid, collectionName, docId) {
    return `${sourceCollectionPath(uid, collectionName)}/${clean(docId)}`;
}

function recordTypeFor(collectionName, docId) {
    return collectionName === 'academy'
        ? `academy:${clean(docId)}`
        : clean(collectionName);
}

function normalizeProfileTagList(values = []) {
    return arr(values, 8)
        .map((value) => clean(value).toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 32))
        .filter(Boolean);
}

function normalizeProfileSignalList(values = []) {
    return arr(values, 8).map((value) => clean(value).slice(0, 48)).filter(Boolean);
}

function mapStoredProfileData(data = {}) {
    return {
        ...data,
        display_name: clean(data.display_name || data.displayName || data.fullName || data.name),
        username: clean(data.username).replace(/^@+/, ''),
        avatar: clean(data.avatar || data.profilePhoto || data.photoURL),
        cover_photo: clean(data.cover_photo || data.coverPhoto),
        role_label: clean(data.role_label || data.roleLabel || data.role || 'Academy Member') || 'Academy Member',
        bio: clean(data.bio || data.profileBio || data.about || data.description),
        search_tags: normalizeProfileTagList(data.search_tags || data.searchTags || data.tags || data.signals?.tags),
        searchTags: normalizeProfileTagList(data.search_tags || data.searchTags || data.tags || data.signals?.tags),
        tags: normalizeProfileTagList(data.search_tags || data.searchTags || data.tags || data.signals?.tags),
        role_track: clean(data.role_track || data.roleTrack),
        looking_for: normalizeProfileSignalList(data.looking_for || data.lookingFor),
        can_offer: normalizeProfileSignalList(data.can_offer || data.canOffer),
        availability: clean(data.availability),
        work_mode: clean(data.work_mode || data.workMode),
        proof_focus: clean(data.proof_focus || data.proofFocus),
        marketplace_ready:
            data.marketplace_ready === true ||
            data.marketplaceReady === true ||
            clean(data.marketplace_ready || data.marketplaceReady).toLowerCase() === 'yes',
        version: Math.max(1, toNumber(data.version, 1)),
        createdAt: data.createdAt || data.created_at || null,
        updatedAt: data.updatedAt || data.updated_at || null
    };
}

async function getRecord(uid, collectionName, docId) {
    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('user_id', clean(uid))
        .eq('source_collection_name', clean(collectionName))
        .eq('source_document_id', clean(docId))
        .maybeSingle();

    if (error) throw new Error(`Academy core get failed: ${error.message}`);
    return data || null;
}

async function listRecords(uid, collectionName, limit = 500) {
    const safeLimit = Math.max(1, Math.min(Number(limit || 500), 1000));

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('user_id', clean(uid))
        .eq('source_collection_name', clean(collectionName))
        .order('updated_at_source', { ascending: false, nullsFirst: false })
        .limit(safeLimit);

    if (error) throw new Error(`Academy core list failed: ${error.message}`);
    return Array.isArray(data) ? data : [];
}

async function upsertRecord(uid, collectionName, docId, payload = {}) {
    const cleanUid = clean(uid);
    const cleanCollection = clean(collectionName);
    const cleanDocId = clean(docId);
    const existing = await getRecord(cleanUid, cleanCollection, cleanDocId).catch(() => null);
    const existingData = existing?.data && typeof existing.data === 'object' ? existing.data : {};
    const now = nowIso();

    const nextData = {
        ...existingData,
        ...(payload && typeof payload === 'object' ? payload : {}),
        updatedAt: payload.updatedAt || payload.updated_at || now
    };

    if (!nextData.createdAt) nextData.createdAt = existingData.createdAt || existing?.created_at_source || now;

    const row = {
        firebase_app: existing?.firebase_app || 'supabase',
        user_id: cleanUid,
        source_collection_path: sourceCollectionPath(cleanUid, cleanCollection),
        source_collection_name: cleanCollection,
        source_document_id: cleanDocId,
        source_document_path: sourceDocumentPath(cleanUid, cleanCollection, cleanDocId),
        record_type: recordTypeFor(cleanCollection, cleanDocId),
        data: nextData,
        created_at_source: toIso(nextData.createdAt, existing?.created_at_source || now),
        updated_at_source: toIso(nextData.updatedAt, now),
        updated_at: now
    };

    const { data, error } = await yhuSupabaseAdmin
        .from(TABLE)
        .upsert(row, { onConflict: 'source_document_path' })
        .select('*')
        .single();

    if (error) throw new Error(`Academy core upsert failed: ${error.message}`);
    return data;
}

async function deleteRecord(uid, collectionName, docId) {
    const { error } = await yhuSupabaseAdmin
        .from(TABLE)
        .delete()
        .eq('user_id', clean(uid))
        .eq('source_collection_name', clean(collectionName))
        .eq('source_document_id', clean(docId));

    if (error) throw new Error(`Academy core delete failed: ${error.message}`);
}

function rowData(row) {
    return row?.data && typeof row.data === 'object' ? row.data : {};
}

function mapRoadmapRow(row = {}) {
    const data = rowData(row);
    const summary = data.summary && typeof data.summary === 'object' ? data.summary : {};
    const roadmap = data.roadmap && typeof data.roadmap === 'object' ? data.roadmap : {};
    const adaptivePlanning = data.adaptivePlanning && typeof data.adaptivePlanning === 'object' ? data.adaptivePlanning : {};
    const nurtureTelemetry = data.nurtureTelemetry && typeof data.nurtureTelemetry === 'object' ? data.nurtureTelemetry : {};

    return {
        id: clean(row.source_document_id || data.id),
        version: toNumber(data.version, 1),
        status: clean(data.status || 'active'),
        readinessScore: toNumber(data.readinessScore, 0),
        focusAreas: Array.isArray(data.focusAreas) ? data.focusAreas : [],
        summary,
        roadmap: {
            goal: clean(roadmap.goal),
            coachTone: clean(roadmap.coachTone || 'balanced'),
            weeklyTheme: clean(roadmap.weeklyTheme),
            weeklyTargetOutcome: clean(roadmap.weeklyTargetOutcome),
            coachBrief: clean(roadmap.coachBrief),
            weeklyOperatingSystem: roadmap.weeklyOperatingSystem && typeof roadmap.weeklyOperatingSystem === 'object'
                ? roadmap.weeklyOperatingSystem
                : {},
            recommendedResources: Array.isArray(roadmap.recommendedResources) ? roadmap.recommendedResources : [],
            days30: roadmap.days30 && typeof roadmap.days30 === 'object' ? roadmap.days30 : {}
        },
        plannerRunId: clean(data.plannerRunId),
        adaptivePlanning,
        nurtureTelemetry,
        createdByModel: clean(data.createdByModel || 'academy-rule-engine-v1'),
        createdAt: data.createdAt || row.created_at_source || null,
        updatedAt: data.updatedAt || row.updated_at_source || null,
        archivedAt: data.archivedAt || null
    };
}

function mapMissionRow(row = {}) {
    const data = rowData(row);
    const qualityScores = data.qualityScores && typeof data.qualityScores === 'object' ? data.qualityScores : {};
    const outcomeMetrics = data.outcomeMetrics && typeof data.outcomeMetrics === 'object' ? data.outcomeMetrics : {};

    return {
        id: clean(row.source_document_id || data.id),
        roadmapId: clean(data.roadmapId),
        pillar: clean(data.pillar),
        title: clean(data.title),
        description: clean(data.description),
        doneLooksLike: clean(data.doneLooksLike),
        whyItMatters: clean(data.whyItMatters),
        missionObjective: clean(data.missionObjective),
        microActions: arr(data.microActions, 4),
        proofOfCompletion: clean(data.proofOfCompletion),
        reflectionPrompt: clean(data.reflectionPrompt),
        difficultyLevel: clean(data.difficultyLevel || 'standard'),
        lifeAreaImpact: arr(data.lifeAreaImpact, 4),
        status: clean(data.status || 'pending'),
        frequency: clean(data.frequency),
        dueDate: clean(data.dueDate),
        estimatedMinutes: toNumber(data.estimatedMinutes, 0),
        completionNote: clean(data.completionNote),
        source: clean(data.source || 'rule'),
        sortOrder: toNumber(data.sortOrder, 0),
        foundationDay: toNumber(data.foundationDay, 0),
        foundationWeek: toNumber(data.foundationWeek, 0),
        foundationMonth: toNumber(data.foundationMonth, 0),
        missionType: clean(data.missionType),
        activationHydration: data.activationHydration && typeof data.activationHydration === 'object' ? data.activationHydration : {},
        selectionReason: clean(data.selectionReason),
        primaryBottleneck: clean(data.primaryBottleneck),
        generatedByProvider: clean(data.generatedByProvider),
        generatedByModel: clean(data.generatedByModel),
        promptVersion: clean(data.promptVersion),
        schemaVersion: clean(data.schemaVersion),
        generationMode: clean(data.generationMode),
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
            lastSkipReasonCategory: clean(outcomeMetrics.lastSkipReasonCategory)
        },
        completedAt: data.completedAt || null,
        createdAt: data.createdAt || row.created_at_source || null,
        updatedAt: data.updatedAt || row.updated_at_source || null
    };
}

function mapCheckinRow(row = {}) {
    const data = rowData(row);
    return {
        id: clean(row.source_document_id || data.id),
        roadmapId: clean(data.roadmapId),
        energyScore: toNumber(data.energyScore, 0),
        moodScore: toNumber(data.moodScore, 0),
        disciplineScore: toNumber(data.disciplineScore, 0),
        completedToday: data.completedToday === true,
        badHabitAvoided: data.badHabitAvoided === true,
        avoidanceCategory: clean(data.avoidanceCategory),
        avoidanceNote: clean(data.avoidanceNote),
        reflectionText: clean(data.reflectionText),
        correctionForTomorrow: clean(data.correctionForTomorrow),
        completedSummary: clean(data.completedSummary),
        blockerText: clean(data.blockerText),
        tomorrowFocus: clean(data.tomorrowFocus),
        recoveryDay: data.recoveryDay === true,
        checkinDate: clean(data.checkinDate),
        aiFeedback: data.aiFeedback && typeof data.aiFeedback === 'object' ? data.aiFeedback : {},
        createdAt: data.createdAt || row.created_at_source || null
    };
}

function mapPlannerRunRow(row = {}) {
    const data = rowData(row);
    return {
        id: clean(row.source_document_id || data.id),
        provider: clean(data.provider || 'gemini'),
        model: clean(data.model),
        promptVersion: clean(data.promptVersion || 'planner_v1'),
        schemaVersion: clean(data.schemaVersion || 'academy_plan_v1'),
        mode: clean(data.mode || 'initial'),
        inputSnapshot: data.inputSnapshot && typeof data.inputSnapshot === 'object' ? data.inputSnapshot : {},
        behaviorProfileSnapshot: data.behaviorProfileSnapshot && typeof data.behaviorProfileSnapshot === 'object' ? data.behaviorProfileSnapshot : {},
        decisionTrace: data.decisionTrace && typeof data.decisionTrace === 'object' ? data.decisionTrace : {},
        nurtureTelemetry: data.nurtureTelemetry && typeof data.nurtureTelemetry === 'object' ? data.nurtureTelemetry : {},
        outputSummary: data.outputSummary && typeof data.outputSummary === 'object' ? data.outputSummary : {},
        resultMetrics: data.resultMetrics && typeof data.resultMetrics === 'object' ? data.resultMetrics : {},
        createdAt: data.createdAt || row.created_at_source || null,
        updatedAt: data.updatedAt || row.updated_at_source || null
    };
}

function mapCoachMessageRow(row = {}) {
    const data = rowData(row);
    return {
        id: clean(row.source_document_id || data.id),
        conversationId: clean(data.conversationId || 'coach_main') || 'coach_main',
        role: clean(data.role || 'assistant'),
        text: clean(data.text || data.content || data.message),
        content: clean(data.content || data.text || data.message),
        contextHint: clean(data.contextHint),
        provider: clean(data.provider),
        model: clean(data.model),
        replyFormat: clean(data.replyFormat),
        coachModeKey: clean(data.coachModeKey),
        responseStyleVersion: clean(data.responseStyleVersion),
        grounding: data.grounding && typeof data.grounding === 'object' ? data.grounding : {},
        createdAt: data.createdAt || row.created_at_source || null,
        updatedAt: data.updatedAt || row.updated_at_source || null
    };
}

function mapLeadRow(row = {}) {
    const data = rowData(row);
    return {
        id: clean(row.source_document_id || data.id),
        missionId: clean(data.missionId),
        sourceDivision: clean(data.sourceDivision || data.source_division || 'academy'),
        sourceFeature: clean(data.sourceFeature || data.source_feature || 'lead_missions'),
        companyName: clean(data.companyName || data.company_name),
        contactName: clean(data.contactName || data.contact_name),
        contactRole: clean(data.contactRole || data.contact_role),
        email: cleanLower(data.email),
        phone: clean(data.phone),
        website: clean(data.website),
        city: clean(data.city),
        country: clean(data.country),
        notes: clean(data.notes),
        status: clean(data.status || 'active'),
        taskStatus: clean(data.taskStatus || data.task_status),
        followUpDueDate: clean(data.followUpDueDate || data.follow_up_due_date),
        createdAt: data.createdAt || row.created_at_source || null,
        updatedAt: data.updatedAt || row.updated_at_source || null,
        data
    };
}

function mapPayoutRow(row = {}) {
    const data = rowData(row);
    return {
        id: clean(row.source_document_id || data.id),
        sourceDivision: clean(data.sourceDivision),
        sourceFeature: clean(data.sourceFeature),
        amount: toNumber(data.amount, 0),
        currency: clean(data.currency || 'USD').toUpperCase() || 'USD',
        status: clean(data.status),
        notes: clean(data.notes),
        createdAt: data.createdAt || row.created_at_source || null,
        updatedAt: data.updatedAt || row.updated_at_source || null,
        data
    };
}

function mapDealRow(row = {}) {
    const data = rowData(row);
    return {
        id: clean(row.source_document_id || data.id),
        leadId: clean(data.leadId || data.lead_id),
        title: clean(data.title || data.companyName || data.dealTitle),
        companyName: clean(data.companyName),
        dealTitle: clean(data.dealTitle || data.title),
        status: clean(data.status),
        grossValue: toNumber(data.grossValue || data.expectedValueAmount, 0),
        expectedValueAmount: toNumber(data.expectedValueAmount || data.grossValue, 0),
        currency: clean(data.currency || 'USD').toUpperCase() || 'USD',
        createdAt: data.createdAt || row.created_at_source || null,
        updatedAt: data.updatedAt || row.updated_at_source || null,
        data
    };
}

async function getCurrentProfile(uid) {
    const row = await getRecord(uid, 'academy', 'profile');
    if (!row) return null;
    return mapStoredProfileData(rowData(row));
}

async function setCurrentProfile(uid, payload = {}) {
    const existing = await getCurrentProfile(uid) || {};
    const normalized = mapStoredProfileData(payload || {});
    const now = nowIso();

    const nextProfile = mapStoredProfileData({
        ...existing,
        ...normalized,
        role_label: normalized.role_label || existing.role_label || 'Academy Member',
        bio: normalized.bio || existing.bio || 'Focused on execution, consistency, and long-term growth inside The Academy.',
        search_tags: normalizeProfileTagList(normalized.search_tags.length ? normalized.search_tags : existing.search_tags),
        role_track: normalized.role_track || existing.role_track,
        looking_for: normalized.looking_for.length ? normalized.looking_for : existing.looking_for,
        can_offer: normalized.can_offer.length ? normalized.can_offer : existing.can_offer,
        availability: normalized.availability || existing.availability,
        work_mode: normalized.work_mode || existing.work_mode,
        proof_focus: normalized.proof_focus || existing.proof_focus,
        marketplace_ready: normalized.marketplace_ready === true || existing.marketplace_ready === true,
        createdAt: existing.createdAt || now,
        updatedAt: now,
        version: Math.max(1, toNumber(existing.version, 0) + 1)
    });

    await upsertRecord(uid, 'academy', 'profile', nextProfile);
    return nextProfile;
}

async function deleteCurrentProfile(uid) {
    await deleteRecord(uid, 'academy', 'profile');
    return {
        deleted: true,
        display_name: 'Hustler',
        username: '',
        avatar: '',
        cover_photo: '',
        role_label: 'Academy Member',
        bio: '',
        search_tags: []
    };
}

async function getAccessState(uid) {
    const row = await getRecord(uid, 'academy', 'access');
    return row ? rowData(row) : null;
}

async function setAccessUnlocked(uid) {
    const now = nowIso();
    const data = {
        accessState: 'unlocked',
        unlockedAt: now,
        lastAssessedAt: now,
        updatedAt: now
    };
    await upsertRecord(uid, 'academy', 'access', data);
    return data;
}

async function getActiveRoadmap(uid) {
    const rows = await listRecords(uid, 'academyRoadmaps', 200);
    const roadmaps = rows.map(mapRoadmapRow);
    const active = roadmaps.filter((item) => cleanLower(item.status) === 'active');

    return (active.length ? active : roadmaps)
        .sort((a, b) => {
            const versionDelta = toNumber(b.version, 0) - toNumber(a.version, 0);
            if (versionDelta) return versionDelta;
            return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
        })[0] || null;
}

async function getRoadmapById(uid, roadmapId) {
    const row = await getRecord(uid, 'academyRoadmaps', roadmapId);
    return row ? mapRoadmapRow(row) : null;
}

async function getMissionById(uid, missionId) {
    const row = await getRecord(uid, 'academyMissions', missionId);
    return row ? mapMissionRow(row) : null;
}

async function listAllMissionsByRoadmap(uid, roadmapId) {
    const rows = await listRecords(uid, 'academyMissions', 1000);
    return rows
        .map(mapMissionRow)
        .filter((mission) => !roadmapId || clean(mission.roadmapId) === clean(roadmapId))
        .sort((a, b) => {
            const sortDelta = toNumber(a.sortOrder, 0) - toNumber(b.sortOrder, 0);
            if (sortDelta) return sortDelta;
            return clean(a.id).localeCompare(clean(b.id));
        });
}

async function listRecentMissions(uid, roadmapId = '', limit = 5) {
    const missions = await listAllMissionsByRoadmap(uid, roadmapId);
    return missions
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
        .slice(0, Math.max(1, Math.min(toNumber(limit, 5), 100)));
}

async function updateMissionStatus(uid, missionId, status, note = '') {
    const existing = await getMissionById(uid, missionId);
    if (!existing) return null;

    const now = nowIso();
    const normalizedStatus = cleanLower(status || 'pending') || 'pending';
    const next = {
        ...existing,
        status: normalizedStatus,
        completionNote: clean(note),
        completedAt: normalizedStatus === 'completed' ? now : null,
        updatedAt: now
    };

    const row = await upsertRecord(uid, 'academyMissions', missionId, next);
    return mapMissionRow(row);
}

async function updateMissionCompletion(uid, missionId, completionNote = '') {
    return updateMissionStatus(uid, missionId, 'completed', completionNote);
}

async function updateMissionOutcomeMetrics(uid, missionId, payload = {}) {
    const existing = await getMissionById(uid, missionId);
    if (!existing) return null;

    const metrics = existing.outcomeMetrics || {};
    const nextMetrics = {
        skipCount: toNumber(payload.skipCount, metrics.skipCount || 0),
        stuckCount: toNumber(payload.stuckCount, metrics.stuckCount || 0),
        rescheduleCount: toNumber(payload.rescheduleCount, metrics.rescheduleCount || 0),
        completionLagHours: toNumber(payload.completionLagHours, metrics.completionLagHours || 0),
        userDifficultyScore: toNumber(payload.userDifficultyScore, metrics.userDifficultyScore || 0),
        userUsefulnessScore: toNumber(payload.userUsefulnessScore, metrics.userUsefulnessScore || 0),
        lastSkipReasonCategory: clean(payload.lastSkipReasonCategory, metrics.lastSkipReasonCategory || '')
    };

    const row = await upsertRecord(uid, 'academyMissions', missionId, {
        ...existing,
        outcomeMetrics: nextMetrics,
        updatedAt: nowIso()
    });

    return mapMissionRow(row);
}

async function getMissionProgress(uid, roadmapId) {
    const missions = await listAllMissionsByRoadmap(uid, roadmapId);
    const total = missions.length;
    const completed = missions.filter((mission) => cleanLower(mission.status) === 'completed').length;

    return {
        completed,
        total,
        percent: total ? Math.round((completed / total) * 100) : 0
    };
}

async function listRecentCheckins(uid, roadmapId = null, limit = 5) {
    const rows = await listRecords(uid, 'academyCheckins', 1000);
    return rows
        .map(mapCheckinRow)
        .filter((item) => !roadmapId || clean(item.roadmapId) === clean(roadmapId))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, Math.max(1, Math.min(toNumber(limit, 5), 300)));
}

async function createCheckin(uid, roadmapId, payload = {}) {
    const now = nowIso();
    const checkinId = buildId('checkin');

    const data = {
        roadmapId: clean(roadmapId),
        energyScore: toNumber(payload.energyScore, 0),
        moodScore: toNumber(payload.moodScore, 0),
        disciplineScore: toNumber(payload.disciplineScore, 0),
        completedToday: payload.completedToday === true,
        badHabitAvoided: payload.badHabitAvoided === true,
        avoidanceCategory: clean(payload.avoidanceCategory),
        avoidanceNote: clean(payload.avoidanceNote),
        reflectionText: clean(payload.reflectionText),
        correctionForTomorrow: clean(payload.correctionForTomorrow),
        completedSummary: clean(payload.completedSummary),
        blockerText: clean(payload.blockerText),
        tomorrowFocus: clean(payload.tomorrowFocus),
        recoveryDay: payload.recoveryDay === true,
        checkinDate: clean(payload.checkinDate || academyDateKey(now)),
        aiFeedback: payload.aiFeedback && typeof payload.aiFeedback === 'object' ? payload.aiFeedback : {},
        createdAt: now,
        updatedAt: now
    };

    const row = await upsertRecord(uid, 'academyCheckins', checkinId, data);
    return mapCheckinRow(row);
}

async function getRecentCheckinStreakDays(uid) {
    const checkins = await listRecentCheckins(uid, null, 365);
    const dates = new Set(checkins.map((item) => clean(item.checkinDate) || academyDateKey(item.createdAt)).filter(Boolean));

    let streak = 0;
    for (let offset = 0; offset < 365; offset += 1) {
        const d = new Date();
        d.setDate(d.getDate() - offset);
        if (!dates.has(academyDateKey(d))) break;
        streak += 1;
    }

    return streak;
}

async function computeBehaviorProfile(uid) {
    const activeRoadmap = await getActiveRoadmap(uid);
    const missions = activeRoadmap ? await listAllMissionsByRoadmap(uid, activeRoadmap.id) : [];
    const checkins = activeRoadmap ? await listRecentCheckins(uid, activeRoadmap.id, 10) : [];

    const completed = missions.filter((item) => cleanLower(item.status) === 'completed').length;
    const skipped = missions.filter((item) => cleanLower(item.status) === 'skipped').length;
    const stuck = missions.filter((item) => cleanLower(item.status) === 'stuck').length;
    const avgEnergy = checkins.length
        ? Math.round(checkins.reduce((sum, item) => sum + toNumber(item.energyScore, 0), 0) / checkins.length)
        : 0;

    return {
        missionCompletionRate: missions.length ? Math.round((completed / missions.length) * 100) : 0,
        completedMissions: completed,
        skippedMissions: skipped,
        stuckMissions: stuck,
        recentCheckins: checkins.length,
        averageEnergyScore: avgEnergy,
        updatedAt: nowIso()
    };
}

async function saveBehaviorProfile(uid, behaviorProfile = {}) {
    const existing = await getCurrentProfile(uid) || {};
    const next = {
        ...existing,
        previousBehaviorProfile: existing.behaviorProfile && typeof existing.behaviorProfile === 'object'
            ? existing.behaviorProfile
            : {},
        behaviorProfile,
        updatedAt: nowIso()
    };
    await upsertRecord(uid, 'academy', 'profile', next);
    return next;
}

async function computePlannerStats(uid) {
    const activeRoadmap = await getActiveRoadmap(uid);
    const missions = activeRoadmap ? await listAllMissionsByRoadmap(uid, activeRoadmap.id) : [];
    const completed = missions.filter((item) => cleanLower(item.status) === 'completed').length;

    return {
        totalMissions: missions.length,
        completedMissions: completed,
        completionRate: missions.length ? Math.round((completed / missions.length) * 100) : 0,
        averageDifficultyScore: 0,
        averageUsefulnessScore: 0,
        lastPlannerRunAt: nowIso()
    };
}

async function savePlannerStats(uid, plannerStats = {}) {
    const existing = await getCurrentProfile(uid) || {};
    const next = {
        ...existing,
        plannerStats: {
            totalMissions: toNumber(plannerStats.totalMissions, 0),
            completedMissions: toNumber(plannerStats.completedMissions, 0),
            completionRate: toNumber(plannerStats.completionRate, 0),
            averageDifficultyScore: toNumber(plannerStats.averageDifficultyScore, 0),
            averageUsefulnessScore: toNumber(plannerStats.averageUsefulnessScore, 0),
            lastPlannerRunAt: plannerStats.lastPlannerRunAt || nowIso()
        },
        updatedAt: nowIso()
    };
    await upsertRecord(uid, 'academy', 'profile', next);
    return next;
}

async function createPlannerRun(uid, payload = {}) {
    const id = buildId('planner');
    const now = nowIso();

    const data = {
        provider: clean(payload.provider || 'gemini'),
        model: clean(payload.model),
        promptVersion: clean(payload.promptVersion || 'planner_v1'),
        schemaVersion: clean(payload.schemaVersion || 'academy_plan_v1'),
        mode: clean(payload.mode || 'initial'),
        inputSnapshot: payload.inputSnapshot && typeof payload.inputSnapshot === 'object' ? payload.inputSnapshot : {},
        behaviorProfileSnapshot: payload.behaviorProfileSnapshot && typeof payload.behaviorProfileSnapshot === 'object' ? payload.behaviorProfileSnapshot : {},
        decisionTrace: payload.decisionTrace && typeof payload.decisionTrace === 'object' ? payload.decisionTrace : {},
        nurtureTelemetry: payload.nurtureTelemetry && typeof payload.nurtureTelemetry === 'object' ? payload.nurtureTelemetry : {},
        outputSummary: payload.outputSummary && typeof payload.outputSummary === 'object' ? payload.outputSummary : {},
        resultMetrics: payload.resultMetrics && typeof payload.resultMetrics === 'object' ? payload.resultMetrics : {},
        createdAt: now,
        updatedAt: now
    };

    const row = await upsertRecord(uid, 'academyPlannerRuns', id, data);
    return mapPlannerRunRow(row);
}

async function getPlannerRunById(uid, runId) {
    const row = await getRecord(uid, 'academyPlannerRuns', runId);
    return row ? mapPlannerRunRow(row) : null;
}

async function getLatestPlannerRun(uid) {
    const rows = await listRecords(uid, 'academyPlannerRuns', 100);
    return rows.map(mapPlannerRunRow)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0] || null;
}

async function updatePlannerRunResult(uid, runId, resultMetrics = {}) {
    const existing = await getPlannerRunById(uid, runId);
    if (!existing) return null;

    const row = await upsertRecord(uid, 'academyPlannerRuns', runId, {
        ...existing,
        resultMetrics: {
            completionRateAfter72h: toNumber(resultMetrics.completionRateAfter72h, 0),
            averageDifficultyScore: toNumber(resultMetrics.averageDifficultyScore, 0),
            averageUsefulnessScore: toNumber(resultMetrics.averageUsefulnessScore, 0)
        },
        updatedAt: nowIso()
    });

    return mapPlannerRunRow(row);
}

async function buildRoadmapTelemetryInspector(uid, roadmapId = '') {
    const roadmap = roadmapId ? await getRoadmapById(uid, roadmapId) : await getActiveRoadmap(uid);
    if (!roadmap) return null;

    const plannerRun = roadmap.plannerRunId ? await getPlannerRunById(uid, roadmap.plannerRunId) : await getLatestPlannerRun(uid);
    const missions = await listAllMissionsByRoadmap(uid, roadmap.id);

    return {
        uid: clean(uid),
        roadmap,
        plannerRun,
        missionStats: {
            total: missions.length,
            completed: missions.filter((item) => cleanLower(item.status) === 'completed').length,
            skipped: missions.filter((item) => cleanLower(item.status) === 'skipped').length,
            stuck: missions.filter((item) => cleanLower(item.status) === 'stuck').length
        }
    };
}

async function persistRoadmapBundle(uid, profile = {}, plan = {}, createdByModel = 'academy-rule-engine-v1') {
    const now = nowIso();
    const existingRoadmaps = (await listRecords(uid, 'academyRoadmaps', 200)).map(mapRoadmapRow);
    const nextVersion = existingRoadmaps.length
        ? Math.max(...existingRoadmaps.map((item) => toNumber(item.version, 0))) + 1
        : 1;

    for (const roadmap of existingRoadmaps.filter((item) => cleanLower(item.status) === 'active')) {
        await upsertRecord(uid, 'academyRoadmaps', roadmap.id, {
            ...roadmap,
            status: 'archived',
            archivedAt: now,
            updatedAt: now
        });
    }

    await upsertRecord(uid, 'academy', 'profile', {
        ...(profile && typeof profile === 'object' ? profile : {}),
        updatedAt: now,
        createdAt: profile.createdAt || now,
        version: 1
    });

    const roadmapId = buildId('roadmap');
    const roadmapData = {
        version: nextVersion,
        status: 'active',
        readinessScore: toNumber(plan.readinessScore, 0),
        summary: plan.summary && typeof plan.summary === 'object' ? plan.summary : {},
        focusAreas: Array.isArray(plan.focusAreas) ? plan.focusAreas : [],
        roadmap: plan.roadmap && typeof plan.roadmap === 'object' ? plan.roadmap : {},
        plannerRunId: clean(plan.plannerRunId),
        adaptivePlanning: plan.adaptivePlanning && typeof plan.adaptivePlanning === 'object' ? plan.adaptivePlanning : {},
        nurtureTelemetry: plan.nurtureTelemetry && typeof plan.nurtureTelemetry === 'object' ? plan.nurtureTelemetry : {},
        createdByModel: clean(createdByModel || 'academy-rule-engine-v1'),
        profileSnapshot: profile && typeof profile === 'object' ? profile : {},
        createdAt: now,
        updatedAt: now,
        archivedAt: null
    };

    await upsertRecord(uid, 'academyRoadmaps', roadmapId, roadmapData);

    const missionSource = String(createdByModel || '').includes('academy-rule-engine') ? 'rule' : 'ai';

    for (const mission of Array.isArray(plan.missions) ? plan.missions : []) {
        const missionId = buildId('mission');
        await upsertRecord(uid, 'academyMissions', missionId, {
            roadmapId,
            pillar: clean(mission.pillar),
            title: clean(mission.title),
            description: clean(mission.description),
            doneLooksLike: clean(mission.doneLooksLike),
            whyItMatters: clean(mission.whyItMatters),
            missionObjective: clean(mission.missionObjective),
            microActions: arr(mission.microActions, 4),
            proofOfCompletion: clean(mission.proofOfCompletion),
            reflectionPrompt: clean(mission.reflectionPrompt),
            difficultyLevel: clean(mission.difficultyLevel || 'standard'),
            lifeAreaImpact: arr(mission.lifeAreaImpact, 4),
            frequency: clean(mission.frequency),
            dueDate: clean(mission.dueDate),
            estimatedMinutes: toNumber(mission.estimatedMinutes, 0),
            status: 'pending',
            source: clean(mission.source || missionSource),
            completionNote: '',
            sortOrder: toNumber(mission.sortOrder, 0),
            foundationDay: toNumber(mission.foundationDay, 0),
            foundationWeek: toNumber(mission.foundationWeek, 0),
            foundationMonth: toNumber(mission.foundationMonth, 0),
            missionType: clean(mission.missionType),
            activationHydration: mission.activationHydration && typeof mission.activationHydration === 'object' ? mission.activationHydration : {},
            selectionReason: clean(mission.selectionReason),
            primaryBottleneck: clean(mission.primaryBottleneck),
            generatedByProvider: clean(mission.generatedByProvider),
            generatedByModel: clean(mission.generatedByModel),
            promptVersion: clean(mission.promptVersion),
            schemaVersion: clean(mission.schemaVersion),
            generationMode: clean(mission.generationMode),
            energyAdjustmentApplied: mission.energyAdjustmentApplied === true,
            timeAdjustmentApplied: mission.timeAdjustmentApplied === true,
            qualityScores: mission.qualityScores && typeof mission.qualityScores === 'object' ? mission.qualityScores : {},
            outcomeMetrics: mission.outcomeMetrics && typeof mission.outcomeMetrics === 'object'
                ? mission.outcomeMetrics
                : {
                    skipCount: 0,
                    stuckCount: 0,
                    rescheduleCount: 0,
                    completionLagHours: 0,
                    userDifficultyScore: 0,
                    userUsefulnessScore: 0,
                    lastSkipReasonCategory: ''
                },
            createdAt: now,
            updatedAt: now,
            completedAt: null
        });
    }

    await setAccessUnlocked(uid);

    return {
        roadmapId,
        version: nextVersion
    };
}

function buildTransformationSystem(roadmap = {}, checkins = [], missions = []) {
    const now = new Date();
    const foundationStartDate = new Date(roadmap.createdAt || now);
    const currentDay = Math.max(1, Math.min(28, Math.floor((now.getTime() - foundationStartDate.getTime()) / 86400000) + 1));
    const checkinDates = new Set(checkins.map((item) => clean(item.checkinDate) || academyDateKey(item.createdAt)).filter(Boolean));
    const todayKey = academyDateKey(now);
    const missionByDay = new Map();

    missions.forEach((mission) => {
        const day = toNumber(mission.foundationDay, 0);
        if (day > 0 && day <= 28 && !missionByDay.has(day)) missionByDay.set(day, mission);
    });

    return {
        phase: currentDay <= 28 ? 'foundation_active' : 'year_transformation_active',
        phaseLabel: currentDay <= 28 ? 'Habit Foundation Sprint' : '12-Month Full-Grind Mode',
        roadmapDoctrine: {
            foundationDays: 28,
            yearMonths: 12,
            foundationName: 'Habit Foundation Sprint',
            postFoundationName: '12-Month Full-Grind Mode',
            doctrine: 'Build the habit in 28 days. Change your life in 12 months.'
        },
        foundationUiMode: 'single_sprint',
        foundationDisplayLabel: 'Foundation Sprint',
        sprintDayLabel: currentDay <= 28 ? `Sprint ${String(currentDay).padStart(2, '0')}` : 'Full-Grind Active',
        fullGrindStatus: currentDay <= 28 ? 'locked' : 'active',
        fullGrindUnlockDay: 29,
        fullGrindDaysRemaining: currentDay <= 28 ? Math.max(0, 29 - currentDay) : 0,
        foundationStartDate: academyDateKey(foundationStartDate),
        foundationEndDate: academyDateKey(new Date(foundationStartDate.getTime() + 27 * 86400000)),
        yearEndDate: academyDateKey(new Date(foundationStartDate.getTime() + 365 * 86400000)),
        currentDay,
        totalFoundationDays: 28,
        completedDays: checkinDates.size,
        missedDays: Math.max(0, currentDay - checkinDates.size),
        currentStreak: checkinDates.has(todayKey) ? 1 : 0,
        hasCheckedInToday: checkinDates.has(todayKey),
        recoveryDay: !checkinDates.has(todayKey) && checkinDates.size > 0,
        todayMission: missionByDay.get(currentDay) || missions[0] || null,
        foundationDays: Array.from({ length: 28 }).map((_, index) => {
            const dayNumber = index + 1;
            const date = new Date(foundationStartDate.getTime() + index * 86400000);
            const key = academyDateKey(date);
            const mission = missionByDay.get(dayNumber) || null;

            return {
                dayNumber,
                date: key,
                status: checkinDates.has(key) ? 'completed' : dayNumber === currentDay ? 'current' : dayNumber < currentDay ? 'missed' : 'locked',
                missionId: mission?.id || '',
                missionTitle: mission?.title || '',
                missionDescription: mission?.description || ''
            };
        }),
        yearMap: []
    };
}

function buildPlazaReadiness(profileDoc = {}, roadmap = {}, missions = []) {
    const completedCount = missions.filter((item) => cleanLower(item.status) === 'completed').length;
    const totalCount = missions.length;
    const completionRatio = totalCount > 0 ? completedCount / totalCount : 0;
    const profileSignals = {
        roleTrack: clean(profileDoc.role_track || profileDoc.roleTrack),
        lookingFor: normalizeProfileSignalList(profileDoc.looking_for || profileDoc.lookingFor),
        canOffer: normalizeProfileSignalList(profileDoc.can_offer || profileDoc.canOffer),
        availability: clean(profileDoc.availability),
        workMode: clean(profileDoc.work_mode || profileDoc.workMode),
        proofFocus: clean(profileDoc.proof_focus || profileDoc.proofFocus),
        marketplaceReady: profileDoc.marketplace_ready === true || profileDoc.marketplaceReady === true
    };

    const score = Math.max(0, Math.min(100,
        (profileSignals.roleTrack ? 12 : 0) +
        (profileSignals.lookingFor.length ? 12 : 0) +
        (profileSignals.canOffer.length ? 16 : 0) +
        (profileSignals.availability ? 8 : 0) +
        (profileSignals.workMode ? 8 : 0) +
        (profileSignals.proofFocus ? 14 : 0) +
        (completionRatio >= 0.8 ? 20 : completionRatio >= 0.45 ? 12 : completedCount ? 5 : 0) +
        Math.max(0, Math.min(10, Math.round(toNumber(roadmap.readinessScore, 0) / 10)))
    ));

    return {
        score,
        completedCount,
        totalCount,
        profileSignals,
        nextStep: score >= 70
            ? 'You are getting closer to Plaza-ready execution.'
            : 'Complete your Academy profile and Roadmap missions to build stronger Plaza readiness.'
    };
}

async function buildAcademyHomePayload(uid, roadmapId = null) {
    const roadmap = roadmapId ? await getRoadmapById(uid, roadmapId) : await getActiveRoadmap(uid);
    if (!roadmap) return null;

    const [profileDoc, missions, streakDays, recentCheckins] = await Promise.all([
        getCurrentProfile(uid),
        listAllMissionsByRoadmap(uid, roadmap.id),
        getRecentCheckinStreakDays(uid),
        listRecentCheckins(uid, roadmap.id, 60)
    ]);

    const safeProfileDoc = profileDoc && typeof profileDoc === 'object' ? profileDoc : {};
    const completedCount = missions.filter((item) => cleanLower(item.status) === 'completed').length;
    const totalCount = missions.length;
    const foundationMissions = missions.filter((mission) => clean(mission.missionType) === 'foundation_28_day' || toNumber(mission.foundationDay, 0) > 0);
    const displayMissions = foundationMissions.length ? foundationMissions : missions;
    const plazaReadiness = buildPlazaReadiness(safeProfileDoc, roadmap, missions);

    return {
        success: true,
        roadmap: {
            id: roadmap.id,
            version: roadmap.version,
            readinessScore: roadmap.readinessScore,
            focusAreas: roadmap.focusAreas,
            summary: roadmap.summary,
            goal: roadmap.roadmap.goal || '',
            coachTone: roadmap.roadmap.coachTone || 'balanced',
            coachBrief: roadmap.roadmap.coachBrief || '',
            weeklyOperatingSystem: roadmap.roadmap.weeklyOperatingSystem || {},
            recommendedResources: Array.isArray(roadmap.roadmap.recommendedResources) ? roadmap.roadmap.recommendedResources : []
        },
        weeklyCheckpoint: {
            theme: roadmap.roadmap.weeklyTheme || '',
            targetOutcome: roadmap.roadmap.weeklyTargetOutcome || ''
        },
        today: {
            missionsCompleted: completedCount,
            missionsTotal: totalCount,
            streakDays,
            readinessScore: toNumber(roadmap.readinessScore, 0)
        },
        missions: displayMissions,
        foundationMissions: displayMissions,
        transformationSystem: buildTransformationSystem(roadmap, recentCheckins, displayMissions),
        recentCheckins,
        behaviorProfile: safeProfileDoc.behaviorProfile && typeof safeProfileDoc.behaviorProfile === 'object' ? safeProfileDoc.behaviorProfile : {},
        previousBehaviorProfile: safeProfileDoc.previousBehaviorProfile && typeof safeProfileDoc.previousBehaviorProfile === 'object' ? safeProfileDoc.previousBehaviorProfile : {},
        plannerStats: safeProfileDoc.plannerStats && typeof safeProfileDoc.plannerStats === 'object' ? safeProfileDoc.plannerStats : {},
        adaptivePlanning: roadmap.adaptivePlanning && typeof roadmap.adaptivePlanning === 'object' ? roadmap.adaptivePlanning : {},
        nurtureTelemetry: roadmap.nurtureTelemetry && typeof roadmap.nurtureTelemetry === 'object' ? roadmap.nurtureTelemetry : {},
        plannerRunId: roadmap.plannerRunId || '',
        createdByModel: roadmap.createdByModel || 'academy-rule-engine-v1',
        profileSignals: plazaReadiness.profileSignals,
        plazaReadiness
    };
}

async function listCoachMessages(uid, conversationId = 'coach_main', limit = 30) {
    const rows = await listRecords(uid, 'academyCoachMessages', 500);
    return rows
        .map(mapCoachMessageRow)
        .filter((item) => clean(item.conversationId || 'coach_main') === clean(conversationId || 'coach_main'))
        .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
        .slice(-Math.max(1, Math.min(toNumber(limit, 30), 100)));
}

async function createCoachMessage(uid, payload = {}) {
    const id = buildId('coach');
    const now = nowIso();

    const row = await upsertRecord(uid, 'academyCoachMessages', id, {
        conversationId: clean(payload.conversationId || 'coach_main') || 'coach_main',
        role: clean(payload.role || 'assistant'),
        text: clean(payload.text || payload.content || payload.message),
        content: clean(payload.content || payload.text || payload.message),
        contextHint: clean(payload.contextHint),
        provider: clean(payload.provider),
        model: clean(payload.model),
        replyFormat: clean(payload.replyFormat),
        coachModeKey: clean(payload.coachModeKey),
        responseStyleVersion: clean(payload.responseStyleVersion),
        grounding: payload.grounding && typeof payload.grounding === 'object' ? payload.grounding : {},
        createdAt: now,
        updatedAt: now
    });

    return mapCoachMessageRow(row);
}

async function createLeadMissionLead(uid, payload = {}) {
    const id = buildId('lead');
    const now = nowIso();
    const row = await upsertRecord(uid, 'academyLeadMissions', id, {
        ...payload,
        status: clean(payload.status || 'active'),
        taskStatus: clean(payload.taskStatus || payload.task_status || ''),
        createdAt: now,
        updatedAt: now
    });

    const lead = mapLeadRow(row);

    if (lead.contactName || lead.email || lead.phone || lead.contactRole) {
        await upsertRecord(uid, 'academyLeadContacts', id, {
            leadId: id,
            companyName: lead.companyName,
            contactName: lead.contactName,
            contactRole: lead.contactRole,
            email: lead.email,
            phone: lead.phone,
            website: lead.website,
            city: lead.city,
            country: lead.country,
            createdAt: now,
            updatedAt: now
        });
    }

    return lead;
}

async function listLeadMissionLeads(uid) {
    const rows = await listRecords(uid, 'academyLeadMissions', 1000);
    return rows.map(mapLeadRow)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
}

async function getLeadMissionLeadById(uid, leadId) {
    const row = await getRecord(uid, 'academyLeadMissions', leadId);
    return row ? mapLeadRow(row) : null;
}

async function updateLeadMissionLead(uid, leadId, patch = {}) {
    const existing = await getLeadMissionLeadById(uid, leadId);
    if (!existing) return null;

    const row = await upsertRecord(uid, 'academyLeadMissions', leadId, {
        ...existing.data,
        ...patch,
        updatedAt: nowIso()
    });

    const lead = mapLeadRow(row);

    if (lead.contactName || lead.email || lead.phone || lead.contactRole) {
        await upsertRecord(uid, 'academyLeadContacts', leadId, {
            leadId,
            companyName: lead.companyName,
            contactName: lead.contactName,
            contactRole: lead.contactRole,
            email: lead.email,
            phone: lead.phone,
            website: lead.website,
            city: lead.city,
            country: lead.country,
            updatedAt: nowIso()
        });
    }

    return lead;
}

async function listLeadMissionFollowUps(uid) {
    const leads = await listLeadMissionLeads(uid);
    return leads.filter((lead) => {
        const taskStatus = cleanLower(lead.taskStatus);
        return taskStatus === 'due' || taskStatus === 'waiting' || clean(lead.followUpDueDate);
    });
}

async function listLeadMissionPayouts(uid) {
    const rows = await listRecords(uid, 'academyLeadPayouts', 1000);
    return rows.map(mapPayoutRow)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
}

async function listLeadMissionDeals(uid) {
    const rows = await listRecords(uid, 'academyLeadDeals', 1000);
    return rows.map(mapDealRow)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
}

async function getLeadMissionScripts(uid) {
    const row = await getRecord(uid, 'academy', 'leadMissionScripts');
    if (!row) {
        return {
            openingScript: 'Hi, my name is [Your Name]. I am reaching out to ask a few quick questions about your company and the best contact person for this role.',
            objectionHandling: 'If blocked, stay calm, ask for the right role, and log exactly what happened so your follow-up stays structured.'
        };
    }

    const data = rowData(row);
    return {
        openingScript: clean(data.openingScript),
        objectionHandling: clean(data.objectionHandling)
    };
}

const academyCoachMessagesCol = {
    doc() {
        throw new Error('academyCoachMessagesCol is disabled after Supabase core migration. Use createCoachMessage/listCoachMessages.');
    }
};

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
    completeMission: updateMissionCompletion,
    updateMissionStatus,
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
    academyCoachMessagesCol,
    createLeadMissionLead,
    listLeadMissionLeads,
    getLeadMissionLeadById,
    updateLeadMissionLead,
    listLeadMissionFollowUps,
    listLeadMissionPayouts,
    listLeadMissionDeals,
    getLeadMissionScripts
};
