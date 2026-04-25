const { firestore } = require('../../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');

const usersCollection = firestore.collection('users');

const nowTs = () => Timestamp.now();
const sevenDaysAgoTs = () => Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

const sanitizeString = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const userRef = (uid) => usersCollection.doc(String(uid));
const academyMetaDoc = (uid, docId) => userRef(uid).collection('academy').doc(docId);
const academyRoadmapsCol = (uid) => userRef(uid).collection('academyRoadmaps');
const academyMissionsCol = (uid) => userRef(uid).collection('academyMissions');
const academyCheckinsCol = (uid) => userRef(uid).collection('academyCheckins');
const academyCoachMessagesCol = (uid) => userRef(uid).collection('academyCoachMessages');
const academyPlannerRunsCol = (uid) => userRef(uid).collection('academyPlannerRuns');
const academyLeadMissionsCol = (uid) => userRef(uid).collection('academyLeadMissions');
const academyLeadContactsCol = (uid) => userRef(uid).collection('academyLeadContacts');
const academyLeadPayoutsCol = (uid) => userRef(uid).collection('academyLeadPayouts');
const academyLeadDealsCol = (uid) => userRef(uid).collection('academyLeadDeals');
const academyLeadScriptsDoc = (uid) => academyMetaDoc(uid, 'leadMissionScripts');

const mapMissionDoc = (doc) => {
    const data = doc.data() || {};
    const outcomeMetrics = data.outcomeMetrics && typeof data.outcomeMetrics === 'object'
        ? data.outcomeMetrics
        : {};
    const qualityScores = data.qualityScores && typeof data.qualityScores === 'object'
        ? data.qualityScores
        : {};

    return {
        id: doc.id,
        roadmapId: sanitizeString(data.roadmapId),
        pillar: sanitizeString(data.pillar),
        title: sanitizeString(data.title),
        description: sanitizeString(data.description),
        doneLooksLike: sanitizeString(data.doneLooksLike),
        whyItMatters: sanitizeString(data.whyItMatters),
        status: sanitizeString(data.status || 'pending'),
        frequency: sanitizeString(data.frequency),
        dueDate: sanitizeString(data.dueDate),
        estimatedMinutes: toNumber(data.estimatedMinutes, 0),
        completionNote: sanitizeString(data.completionNote),
        source: sanitizeString(data.source || 'rule'),
        sortOrder: toNumber(data.sortOrder, 0),
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
};

const mapRoadmapDoc = (doc) => {
    const data = doc.data() || {};
    const summary = data.summary && typeof data.summary === 'object' ? data.summary : {};
    const roadmap = data.roadmap && typeof data.roadmap === 'object' ? data.roadmap : {};
    const weeklyOperatingSystem =
        roadmap.weeklyOperatingSystem && typeof roadmap.weeklyOperatingSystem === 'object'
            ? roadmap.weeklyOperatingSystem
            : {};
    const recommendedResources = Array.isArray(roadmap.recommendedResources)
        ? roadmap.recommendedResources
        : [];
    const adaptivePlanning = data.adaptivePlanning && typeof data.adaptivePlanning === 'object'
        ? data.adaptivePlanning
        : {};
    const nurtureTelemetry = data.nurtureTelemetry && typeof data.nurtureTelemetry === 'object'
        ? data.nurtureTelemetry
        : {};
    return {
        id: doc.id,
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
            recommendedResources,
            days30: roadmap.days30 && typeof roadmap.days30 === 'object' ? roadmap.days30 : {}
        },
        plannerRunId: sanitizeString(data.plannerRunId),
        adaptivePlanning: {
            mode: sanitizeString(adaptivePlanning.mode),
            challengeLevel: sanitizeString(adaptivePlanning.challengeLevel),
            missionCountCap: toNumber(adaptivePlanning.missionCountCap, 0),
            dailyLoadCap: toNumber(adaptivePlanning.dailyLoadCap, 0),
            reason: sanitizeString(adaptivePlanning.reason),
            adjustments: Array.isArray(adaptivePlanning.adjustments) ? adaptivePlanning.adjustments : [],
            trendSummary: adaptivePlanning.trendSummary && typeof adaptivePlanning.trendSummary === 'object'
                ? adaptivePlanning.trendSummary
                : {},
            trigger: sanitizeString(adaptivePlanning.trigger)
        },
        nurtureTelemetry,
        createdByModel: sanitizeString(data.createdByModel || 'academy-rule-engine-v1'),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        archivedAt: data.archivedAt || null
    };
};

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

function mapStoredProfileData(data = {}) {
    return {
        display_name: sanitizeString(
            data.display_name ||
            data.displayName ||
            data.fullName ||
            data.name
        ),
        username: sanitizeString(data.username).replace(/^@+/, ''),
        avatar: sanitizeString(data.avatar || data.profilePhoto || data.photoURL),
        cover_photo: sanitizeString(data.cover_photo || data.coverPhoto),
        role_label: sanitizeString(data.role_label || data.roleLabel || data.role || 'Academy Member'),
        bio: sanitizeString(
            data.bio ||
            data.profileBio ||
            data.about ||
            data.description
        ),
        search_tags: normalizeProfileTagList(data.search_tags || data.searchTags),

        role_track: sanitizeString(data.role_track || data.roleTrack),
        looking_for: normalizeProfileSignalList(data.looking_for || data.lookingFor),
        can_offer: normalizeProfileSignalList(data.can_offer || data.canOffer),
        availability: sanitizeString(data.availability),
        work_mode: sanitizeString(data.work_mode || data.workMode),
        proof_focus: sanitizeString(data.proof_focus || data.proofFocus),
        marketplace_ready:
            data.marketplace_ready === true ||
            data.marketplaceReady === true ||
            sanitizeString(data.marketplace_ready || data.marketplaceReady).toLowerCase() === 'yes',

        version: toNumber(data.version, 1),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
    };
}

async function getCurrentProfile(uid) {
    const snapshot = await academyMetaDoc(uid, 'profile').get();
    if (!snapshot.exists) return null;
    return mapStoredProfileData(snapshot.data() || {});
}

async function setCurrentProfile(uid, payload) {
    const ref = academyMetaDoc(uid, 'profile');
    const userDocRef = userRef(uid);
    const ts = nowTs();

    const existingSnapshot = await ref.get();
    const existing = existingSnapshot.exists ? (existingSnapshot.data() || {}) : {};

    const userExistingSnapshot = await userDocRef.get();
    const userExisting = userExistingSnapshot.exists ? (userExistingSnapshot.data() || {}) : {};

const normalized = mapStoredProfileData(payload || {});
const nextProfile = {
    ...existing,
    ...normalized,
    role_label:
        normalized.role_label ||
        sanitizeString(existing.role_label || existing.roleLabel || 'Academy Member') ||
        'Academy Member',
    bio:
        normalized.bio ||
        sanitizeString(
            existing.bio ||
            existing.profileBio ||
            'Focused on execution, consistency, and long-term growth inside The Academy.'
        ),
    search_tags: normalizeProfileTagList(
        normalized.search_tags ||
        existing.search_tags ||
        existing.searchTags
    ),
    role_track:
        normalized.role_track ||
        sanitizeString(existing.role_track || existing.roleTrack),
    looking_for: normalizeProfileSignalList(
        normalized.looking_for ||
        existing.looking_for ||
        existing.lookingFor
    ),
    can_offer: normalizeProfileSignalList(
        normalized.can_offer ||
        existing.can_offer ||
        existing.canOffer
    ),
    availability:
        normalized.availability ||
        sanitizeString(existing.availability),
    work_mode:
        normalized.work_mode ||
        sanitizeString(existing.work_mode || existing.workMode),
    proof_focus:
        normalized.proof_focus ||
        sanitizeString(existing.proof_focus || existing.proofFocus),
    marketplace_ready:
        normalized.marketplace_ready === true ||
        existing.marketplace_ready === true ||
        sanitizeString(existing.marketplace_ready || existing.marketplaceReady).toLowerCase() === 'yes',
    updatedAt: ts,
    createdAt: existing.createdAt || ts,
    version: Math.max(1, toNumber(existing.version, 0) + 1)
};

    await ref.set(nextProfile, { merge: true });

    const nextPublicName =
        sanitizeString(
            nextProfile.display_name ||
            userExisting.displayName ||
            userExisting.fullName ||
            userExisting.name
        ) || 'Hustler';

    await userDocRef.set(
        {
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
        },
        { merge: true }
    );

    const snapshot = await ref.get();
    return mapStoredProfileData(snapshot.data() || {});
}
async function deleteCurrentProfile(uid) {
    const ref = academyMetaDoc(uid, 'profile');
    const userDocRef = userRef(uid);
    const ts = nowTs();

    const userExistingSnapshot = await userDocRef.get();
    const userExisting = userExistingSnapshot.exists
        ? (userExistingSnapshot.data() || {})
        : {};

    const publicName =
        sanitizeString(
            userExisting.displayName ||
            userExisting.fullName ||
            userExisting.name ||
            userExisting.username
        ) || 'Hustler';

    await ref.delete();

    await userDocRef.set(
        {
            displayName: publicName,
            fullName: publicName,
            name: publicName,
            avatar: '',
            profilePhoto: '',
            photoURL: '',
            bio: '',
            profileBio: '',
            searchTags: [],
            coverPhoto: '',
            academyProfileDeletedAt: ts,
            academyProfileUpdatedAt: ts,
            updatedAt: ts
        },
        { merge: true }
    );

    return {
        deleted: true,
        display_name: publicName,
        username: sanitizeString(userExisting.username),
        avatar: '',
        cover_photo: '',
        role_label: 'Academy Member',
        bio: '',
        search_tags: []
    };
}
async function getAccessState(uid) {
    const snapshot = await academyMetaDoc(uid, 'access').get();
    if (!snapshot.exists) return null;
    return snapshot.data() || null;
}

async function setAccessUnlocked(uid) {
    const ts = nowTs();

    await academyMetaDoc(uid, 'access').set(
        {
            accessState: 'unlocked',
            unlockedAt: ts,
            lastAssessedAt: ts,
            updatedAt: ts
        },
        { merge: true }
    );

    const snapshot = await academyMetaDoc(uid, 'access').get();
    return snapshot.data() || null;
}

async function getActiveRoadmap(uid) {
    const snapshot = await academyRoadmapsCol(uid)
        .where('status', '==', 'active')
        .get();

    if (snapshot.empty) return null;

    const roadmaps = snapshot.docs
        .map(mapRoadmapDoc)
        .sort((a, b) => toNumber(b.version, 0) - toNumber(a.version, 0));

    return roadmaps[0] || null;
}

async function getRoadmapById(uid, roadmapId) {
    const snapshot = await academyRoadmapsCol(uid).doc(String(roadmapId)).get();
    if (!snapshot.exists) return null;
    return mapRoadmapDoc(snapshot);
}

async function listRecentMissions(uid, roadmapId, limit = 8) {
    if (!roadmapId) return [];

    const snapshot = await academyMissionsCol(uid)
        .where('roadmapId', '==', String(roadmapId))
        .get();

    return snapshot.docs
        .map(mapMissionDoc)
        .sort((a, b) => toNumber(a.sortOrder, 0) - toNumber(b.sortOrder, 0))
        .slice(0, Math.max(0, toNumber(limit, 0)));
}

async function listAllMissionsByRoadmap(uid, roadmapId) {
    if (!roadmapId) return [];

    const snapshot = await academyMissionsCol(uid)
        .where('roadmapId', '==', String(roadmapId))
        .get();

    return snapshot.docs
        .map(mapMissionDoc)
        .sort((a, b) => toNumber(a.sortOrder, 0) - toNumber(b.sortOrder, 0));
}

async function getMissionById(uid, missionId) {
    const snapshot = await academyMissionsCol(uid).doc(String(missionId)).get();
    if (!snapshot.exists) return null;
    return mapMissionDoc(snapshot);
}

async function updateMissionCompletion(uid, missionId, completionNote = '') {
    const ref = academyMissionsCol(uid).doc(String(missionId));
    const snapshot = await ref.get();

    if (!snapshot.exists) return null;

    const ts = nowTs();

    await ref.set(
        {
            status: 'completed',
            completionNote: sanitizeString(completionNote),
            completedAt: ts,
            updatedAt: ts
        },
        { merge: true }
    );

    const updatedSnapshot = await ref.get();
    return mapMissionDoc(updatedSnapshot);
}

async function updateMissionStatus(uid, missionId, status, note = '') {
    const ref = academyMissionsCol(uid).doc(String(missionId));
    const snapshot = await ref.get();

    if (!snapshot.exists) return null;

    const normalizedStatus = sanitizeString(status || 'pending').toLowerCase() || 'pending';
    const ts = nowTs();

    await ref.set(
        {
            status: normalizedStatus,
            completionNote: sanitizeString(note),
            completedAt: normalizedStatus === 'completed' ? ts : null,
            updatedAt: ts
        },
        { merge: true }
    );

    const updatedSnapshot = await ref.get();
    return mapMissionDoc(updatedSnapshot);
}

async function getMissionProgress(uid, roadmapId) {
    const missions = await listAllMissionsByRoadmap(uid, roadmapId);
    const total = missions.length;
    const completed = missions.filter(
        (mission) => sanitizeString(mission.status).toLowerCase() === 'completed'
    ).length;

    return {
        completed,
        total,
        percent: total ? Math.round((completed / total) * 100) : 0
    };
}

async function listRecentCheckins(uid, roadmapId = null, limit = 5) {
    let snapshot;

    if (roadmapId) {
        snapshot = await academyCheckinsCol(uid)
            .where('roadmapId', '==', String(roadmapId))
            .get();
    } else {
        snapshot = await academyCheckinsCol(uid).get();
    }

    const checkins = snapshot.docs.map((doc) => {
        const data = doc.data() || {};
        return {
            id: doc.id,
            roadmapId: sanitizeString(data.roadmapId),
            energyScore: toNumber(data.energyScore, 0),
            moodScore: toNumber(data.moodScore, 0),
            completedSummary: sanitizeString(data.completedSummary),
            blockerText: sanitizeString(data.blockerText),
            tomorrowFocus: sanitizeString(data.tomorrowFocus),
            aiFeedback: data.aiFeedback && typeof data.aiFeedback === 'object' ? data.aiFeedback : {},
            createdAt: data.createdAt || null
        };
    });

    const toMillis = (value) => {
        if (!value) return 0;
        if (typeof value.toDate === 'function') return value.toDate().getTime();
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    };

    return checkins
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        .slice(0, Math.max(0, toNumber(limit, 0)));
}

async function createCheckin(uid, roadmapId, payload = {}) {
    const ref = academyCheckinsCol(uid).doc();
    const ts = nowTs();

    const checkin = {
        roadmapId: sanitizeString(roadmapId),
        energyScore: toNumber(payload.energyScore, 0),
        moodScore: toNumber(payload.moodScore, 0),
        completedSummary: sanitizeString(payload.completedSummary),
        blockerText: sanitizeString(payload.blockerText),
        tomorrowFocus: sanitizeString(payload.tomorrowFocus),
        aiFeedback: payload.aiFeedback && typeof payload.aiFeedback === 'object'
            ? payload.aiFeedback
            : {},
        createdAt: ts,
        updatedAt: ts
    };

    await ref.set(checkin);

    return {
        id: ref.id,
        ...checkin
    };
}

async function getRecentCheckinStreakDays(uid) {
    const snapshot = await academyCheckinsCol(uid).get();
    const cutoff = sevenDaysAgoTs().toDate().getTime();

    let count = 0;

    snapshot.docs.forEach((doc) => {
        const data = doc.data() || {};
        const createdAt = data.createdAt;
        const createdMs =
            createdAt && typeof createdAt.toDate === 'function'
                ? createdAt.toDate().getTime()
                : new Date(createdAt || 0).getTime();

        if (Number.isFinite(createdMs) && createdMs >= cutoff) {
            count += 1;
        }
    });

    return count;
}

async function persistRoadmapBundle(uid, profile, plan, createdByModel) {
    const ts = nowTs();

    const latestVersionSnapshot = await academyRoadmapsCol(uid)
        .orderBy('version', 'desc')
        .limit(1)
        .get();

    const nextVersion = latestVersionSnapshot.empty
        ? 1
        : toNumber(latestVersionSnapshot.docs[0].data()?.version, 0) + 1;

    const currentActiveSnapshot = await academyRoadmapsCol(uid)
        .where('status', '==', 'active')
        .get();

    const roadmapRef = academyRoadmapsCol(uid).doc();
    const batch = firestore.batch();

    currentActiveSnapshot.forEach((doc) => {
        batch.set(
            doc.ref,
            {
                status: 'archived',
                archivedAt: ts,
                updatedAt: ts
            },
            { merge: true }
        );
    });

    batch.set(academyMetaDoc(uid, 'profile'), {
        ...profile,
        updatedAt: ts,
        createdAt: ts,
        version: 1
    }, { merge: true });

    batch.set(roadmapRef, {
        version: nextVersion,
        status: 'active',
        readinessScore: toNumber(plan.readinessScore, 0),
        summary: plan.summary && typeof plan.summary === 'object' ? plan.summary : {},
        focusAreas: Array.isArray(plan.focusAreas) ? plan.focusAreas : [],
        roadmap: plan.roadmap && typeof plan.roadmap === 'object' ? plan.roadmap : {},
        plannerRunId: sanitizeString(plan.plannerRunId),
        adaptivePlanning: plan.adaptivePlanning && typeof plan.adaptivePlanning === 'object'
            ? plan.adaptivePlanning
            : {},
            nurtureTelemetry: plan.nurtureTelemetry && typeof plan.nurtureTelemetry === 'object'
            ? plan.nurtureTelemetry
            : {},
        createdByModel: sanitizeString(createdByModel || 'academy-rule-engine-v1'),
        profileSnapshot: profile && typeof profile === 'object' ? profile : {},
        createdAt: ts,
        updatedAt: ts,
        archivedAt: null
    });

    const missionSource = String(createdByModel || '').includes('academy-rule-engine') ? 'rule' : 'ai';

    for (const mission of Array.isArray(plan.missions) ? plan.missions : []) {
        const missionRef = academyMissionsCol(uid).doc();
        batch.set(missionRef, {
            roadmapId: roadmapRef.id,
            pillar: sanitizeString(mission.pillar),
            title: sanitizeString(mission.title),
            description: sanitizeString(mission.description),
            doneLooksLike: sanitizeString(mission.doneLooksLike),
            whyItMatters: sanitizeString(mission.whyItMatters),
            frequency: sanitizeString(mission.frequency),
            dueDate: sanitizeString(mission.dueDate),
            estimatedMinutes: toNumber(mission.estimatedMinutes, 0),
            status: 'pending',
            source: sanitizeString(mission.source || missionSource),
            completionNote: '',
            sortOrder: toNumber(mission.sortOrder, 0),
            selectionReason: sanitizeString(mission.selectionReason),
            primaryBottleneck: sanitizeString(mission.primaryBottleneck),
            generatedByProvider: sanitizeString(mission.generatedByProvider),
            generatedByModel: sanitizeString(mission.generatedByModel),
            promptVersion: sanitizeString(mission.promptVersion),
            schemaVersion: sanitizeString(mission.schemaVersion),
            generationMode: sanitizeString(mission.generationMode),
            energyAdjustmentApplied: mission.energyAdjustmentApplied === true,
            timeAdjustmentApplied: mission.timeAdjustmentApplied === true,
            qualityScores: mission.qualityScores && typeof mission.qualityScores === 'object'
                ? mission.qualityScores
                : {},
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
            createdAt: ts,
            updatedAt: ts,
            completedAt: null
        });
    }

    batch.set(academyMetaDoc(uid, 'access'), {
        accessState: 'unlocked',
        unlockedAt: ts,
        lastAssessedAt: ts,
        updatedAt: ts
    }, { merge: true });

    await batch.commit();

    return {
        roadmapId: roadmapRef.id,
        version: nextVersion
    };
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
    const completedCount = safeMissions.filter((item) => {
        return sanitizeString(item?.status).toLowerCase() === 'completed';
    }).length;

    const totalCount = safeMissions.length;
    const completionRatio = totalCount > 0 ? completedCount / totalCount : 0;

    let profileScore = 0;

    if (roleTrack) profileScore += 12;
    if (lookingFor.length > 0) profileScore += 12;
    if (canOffer.length > 0) profileScore += 16;
    if (availability) profileScore += 8;
    if (workMode) profileScore += 8;
    if (proofFocus) profileScore += 14;

    profileScore = Math.max(0, Math.min(70, profileScore));

    const missionRatioScore =
        completionRatio >= 0.8
            ? 10
            : completionRatio >= 0.45
                ? 6
                : completionRatio > 0
                    ? 3
                    : 0;

    const missionVolumeScore =
        completedCount >= 8
            ? 10
            : completedCount >= 5
                ? 8
                : completedCount >= 3
                    ? 6
                    : completedCount > 0
                        ? 3
                        : 0;

    const missionExecutionScore = Math.max(
        0,
        Math.min(25, missionRatioScore + missionVolumeScore)
    );

    const roadmapReadiness = toNumber(roadmap?.readinessScore, 0);
    const roadmapScore = Math.max(0, Math.min(5, Math.round(roadmapReadiness / 20)));
    const marketplaceScore = marketplaceReady ? 5 : 0;

    const score = Math.max(
        0,
        Math.min(
            100,
            profileScore + missionExecutionScore + roadmapScore + marketplaceScore
        )
    );

    let nextStep = 'Complete your Academy profile and Roadmap missions to build stronger Plaza readiness.';

    if (!roleTrack) {
        nextStep = 'Choose your role track first so The Academy knows what economic direction you are building toward.';
    } else if (canOffer.length === 0) {
        nextStep = 'Clarify what you can offer so Plaza can match you to real opportunities later.';
    } else if (lookingFor.length === 0) {
        nextStep = 'Add what you are looking for so your next move inside Plaza becomes easier to match.';
    } else if (!proofFocus) {
        nextStep = 'Define your proof focus so your Academy work turns into visible commercial signal.';
    } else if (completedCount < 3) {
        nextStep = 'Complete at least 3 Roadmap missions so Plaza can see real execution, not just profile setup.';
    } else if (missionExecutionScore < 22) {
        nextStep = 'Complete more Roadmap missions consistently. Your Plaza signal rises as your execution record grows.';
    } else if (!marketplaceReady) {
        nextStep = 'Your Academy execution signal is getting stronger. Turn on Marketplace Ready once your profile feels complete.';
    } else {
        nextStep = 'Your Academy execution record is strong enough to support Plaza visibility, matching, and opportunity flow.';
    }

    const statusLabel =
        marketplaceReady && score >= 90
            ? 'Priority Plaza Candidate'
            : marketplaceReady && score >= 75
                ? 'Ready for Plaza'
                : score >= 75
                    ? 'Strong Academy Signal'
                    : score >= 60
                        ? 'Eligible for Plaza Review'
                        : score >= 40
                            ? 'Building Momentum'
                            : 'Still Building';

    return {
        score,
        statusLabel,
        nextStep,
        marketplaceReady,
        missionCompletionRatio: Number(completionRatio.toFixed(2)),
        completedCount,
        totalCount,
        scoreBreakdown: {
            profileScore,
            missionExecutionScore,
            missionRatioScore,
            missionVolumeScore,
            roadmapScore,
            marketplaceScore
        },
        signals: {
            roleTrack: Boolean(roleTrack),
            lookingFor: lookingFor.length > 0,
            canOffer: canOffer.length > 0,
            availability: Boolean(availability),
            workMode: Boolean(workMode),
            proofFocus: Boolean(proofFocus),
            roadmapMissionExecution: missionExecutionScore >= 22,
            roadmapMissionVolume: completedCount >= 3
        },
        profileSignals: {
            roleTrack,
            lookingFor,
            canOffer,
            availability,
            workMode,
            proofFocus,
            marketplaceReady
        }
    };
}
async function buildAcademyHomePayload(uid, roadmapId = null) {
    const roadmap = roadmapId
        ? await getRoadmapById(uid, roadmapId)
        : await getActiveRoadmap(uid);

    if (!roadmap) return null;

    const [profileDoc, missions, allMissions, streakDays] = await Promise.all([
        getCurrentProfile(uid),
        listRecentMissions(uid, roadmap.id, 5),
        listAllMissionsByRoadmap(uid, roadmap.id),
        getRecentCheckinStreakDays(uid)
    ]);

    const safeProfileDoc = profileDoc && typeof profileDoc === 'object' ? profileDoc : {};
    const safeAllMissions = Array.isArray(allMissions) ? allMissions : [];
    const completedCount = safeAllMissions.filter((item) => item.status === 'completed').length;
    const totalCount = safeAllMissions.length;

    const plazaReadiness = buildAcademyPlazaReadinessPayload(
        safeProfileDoc,
        roadmap || {},
        safeAllMissions
    );

    const profileSignals =
        plazaReadiness?.profileSignals && typeof plazaReadiness.profileSignals === 'object'
            ? plazaReadiness.profileSignals
            : {};

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
            recommendedResources: Array.isArray(roadmap.roadmap.recommendedResources)
                ? roadmap.roadmap.recommendedResources
                : []
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
        missions,
        behaviorProfile: safeProfileDoc?.behaviorProfile && typeof safeProfileDoc.behaviorProfile === 'object'
            ? safeProfileDoc.behaviorProfile
            : {},
        previousBehaviorProfile: safeProfileDoc?.previousBehaviorProfile && typeof safeProfileDoc.previousBehaviorProfile === 'object'
            ? safeProfileDoc.previousBehaviorProfile
            : {},
        plannerStats: safeProfileDoc?.plannerStats && typeof safeProfileDoc.plannerStats === 'object'
            ? safeProfileDoc.plannerStats
            : {},
        adaptivePlanning: roadmap?.adaptivePlanning && typeof roadmap.adaptivePlanning === 'object'
            ? roadmap.adaptivePlanning
            : {},
        nurtureTelemetry: roadmap?.nurtureTelemetry && typeof roadmap.nurtureTelemetry === 'object'
            ? roadmap.nurtureTelemetry
            : {},
        plannerRunId: roadmap?.plannerRunId || '',
        createdByModel: roadmap.createdByModel || 'academy-rule-engine-v1',
        profileSignals,
        plazaReadiness
    };
}
async function computeBehaviorProfile(uid) {
    const profile = await getCurrentProfile(uid);
    const activeRoadmap = await getActiveRoadmap(uid);

    const recentMissions = activeRoadmap
        ? await listAllMissionsByRoadmap(uid, activeRoadmap.id)
        : [];

    const recentCheckins = activeRoadmap
        ? await listRecentCheckins(uid, activeRoadmap.id, 10)
        : [];

    const totalMissions = recentMissions.length;
    const completedCount = recentMissions.filter((item) => item.status === 'completed').length;
    const skippedCount = recentMissions.filter((item) => item.status === 'skipped').length;
    const stuckCount = recentMissions.filter((item) => item.status === 'stuck').length;

    const executionReliability = totalMissions > 0
        ? Number((completedCount / totalMissions).toFixed(2))
        : 0;

    const frictionSensitivity = totalMissions > 0
        ? Number(((skippedCount + stuckCount) / totalMissions).toFixed(2))
        : 0;

    const estimatedMinutesList = recentMissions
        .map((item) => toNumber(item.estimatedMinutes, 0))
        .filter((value) => value > 0);

    const maxSustainableDailyMinutes = estimatedMinutesList.length
        ? Math.round(
            estimatedMinutesList.reduce((sum, value) => sum + value, 0) / estimatedMinutesList.length
        )
        : Math.max(15, toNumber(profile?.weeklyHours, 0) > 0
            ? Math.round((toNumber(profile.weeklyHours, 0) * 60) / 7)
            : 30);

    const preferredMissionTypes = Array.from(
        new Set(
            recentMissions
                .filter((item) => item.status === 'completed')
                .map((item) => sanitizeString(item.pillar))
                .filter(Boolean)
        )
    ).slice(0, 3);

    const avgEnergy = recentCheckins.length
        ? Number((
            recentCheckins.reduce((sum, item) => sum + toNumber(item.energyScore, 0), 0) /
            recentCheckins.length
        ).toFixed(2))
        : toNumber(profile?.energyScore, 0);

    const behaviorProfile = {
        executionReliability,
        frictionSensitivity,
        maxSustainableDailyMinutes,
        preferredMissionTypes,
        bestExecutionWindow: '',
        pressureResponse: frictionSensitivity >= 0.6 ? 'low' : 'moderate',
        accountabilityNeed: executionReliability <= 0.4 ? 'high' : 'moderate',
        recoveryRisk: avgEnergy <= 4 || frictionSensitivity >= 0.5 ? 'high' : 'normal',
        lastComputedAt: nowTs()
    };

    return behaviorProfile;
}

async function saveBehaviorProfile(uid, behaviorProfile = {}) {
    const ref = academyMetaDoc(uid, 'profile');
    const ts = nowTs();

    const normalizeBehaviorSnapshot = (value = {}, fallbackTs = ts) => ({
        executionReliability: toNumber(value.executionReliability, 0),
        frictionSensitivity: toNumber(value.frictionSensitivity, 0),
        maxSustainableDailyMinutes: toNumber(value.maxSustainableDailyMinutes, 0),
        preferredMissionTypes: Array.isArray(value.preferredMissionTypes)
            ? value.preferredMissionTypes
            : [],
        bestExecutionWindow: sanitizeString(value.bestExecutionWindow),
        pressureResponse: sanitizeString(value.pressureResponse),
        accountabilityNeed: sanitizeString(value.accountabilityNeed),
        recoveryRisk: sanitizeString(value.recoveryRisk),
        lastComputedAt: value.lastComputedAt || fallbackTs
    });

    const currentSnapshot = await ref.get();
    const currentData = currentSnapshot.exists ? (currentSnapshot.data() || {}) : {};

    const currentBehaviorProfile =
        currentData.behaviorProfile && typeof currentData.behaviorProfile === 'object'
            ? currentData.behaviorProfile
            : null;

    const currentPreviousBehaviorProfile =
        currentData.previousBehaviorProfile && typeof currentData.previousBehaviorProfile === 'object'
            ? currentData.previousBehaviorProfile
            : null;

    const nextPreviousBehaviorProfile = currentBehaviorProfile
        ? normalizeBehaviorSnapshot(
            currentBehaviorProfile,
            currentBehaviorProfile.lastComputedAt || ts
        )
        : (
            currentPreviousBehaviorProfile
                ? normalizeBehaviorSnapshot(
                    currentPreviousBehaviorProfile,
                    currentPreviousBehaviorProfile.lastComputedAt || ts
                )
                : {}
        );

    await ref.set(
        {
            previousBehaviorProfile: nextPreviousBehaviorProfile,
            behaviorProfile: normalizeBehaviorSnapshot(
                behaviorProfile,
                behaviorProfile.lastComputedAt || ts
            ),
            updatedAt: ts
        },
        { merge: true }
    );

    const snapshot = await ref.get();
    return snapshot.data() || null;
}

async function computePlannerStats(uid) {
    const roadmap = await getActiveRoadmap(uid);
    const missions = roadmap
        ? await listAllMissionsByRoadmap(uid, roadmap.id)
        : [];

    const totalGeneratedMissions = missions.length;
    const totalCompletedMissions = missions.filter((item) => item.status === 'completed').length;
    const totalSkippedMissions = missions.filter((item) => item.status === 'skipped').length;
    const totalStuckMissions = missions.filter((item) => item.status === 'stuck').length;

    const lagValues = missions
        .map((item) => toNumber(item?.outcomeMetrics?.completionLagHours, 0))
        .filter((value) => value > 0);

    const difficultyValues = missions
        .map((item) => toNumber(item?.outcomeMetrics?.userDifficultyScore, 0))
        .filter((value) => value > 0);

    const usefulnessValues = missions
        .map((item) => toNumber(item?.outcomeMetrics?.userUsefulnessScore, 0))
        .filter((value) => value > 0);

    return {
        totalGeneratedMissions,
        totalCompletedMissions,
        totalSkippedMissions,
        totalStuckMissions,
        averageCompletionLagHours: lagValues.length
            ? Number((lagValues.reduce((sum, value) => sum + value, 0) / lagValues.length).toFixed(2))
            : 0,
        averageDifficultyScore: difficultyValues.length
            ? Number((difficultyValues.reduce((sum, value) => sum + value, 0) / difficultyValues.length).toFixed(2))
            : 0,
        averageUsefulnessScore: usefulnessValues.length
            ? Number((usefulnessValues.reduce((sum, value) => sum + value, 0) / usefulnessValues.length).toFixed(2))
            : 0,
        lastPlannerRunAt: nowTs()
    };
}

async function savePlannerStats(uid, plannerStats = {}) {
    const ts = nowTs();

    await academyMetaDoc(uid, 'profile').set(
        {
            plannerStats: {
                totalGeneratedMissions: toNumber(plannerStats.totalGeneratedMissions, 0),
                totalCompletedMissions: toNumber(plannerStats.totalCompletedMissions, 0),
                totalSkippedMissions: toNumber(plannerStats.totalSkippedMissions, 0),
                totalStuckMissions: toNumber(plannerStats.totalStuckMissions, 0),
                averageCompletionLagHours: toNumber(plannerStats.averageCompletionLagHours, 0),
                averageDifficultyScore: toNumber(plannerStats.averageDifficultyScore, 0),
                averageUsefulnessScore: toNumber(plannerStats.averageUsefulnessScore, 0),
                lastPlannerRunAt: plannerStats.lastPlannerRunAt || ts
            },
            updatedAt: ts
        },
        { merge: true }
    );

    const snapshot = await academyMetaDoc(uid, 'profile').get();
    return snapshot.data() || null;
}

async function createPlannerRun(uid, payload = {}) {
    const ref = academyPlannerRunsCol(uid).doc();
    const ts = nowTs();

    const plannerRun = {
        provider: sanitizeString(payload.provider || 'gemini'),
        model: sanitizeString(payload.model),
        promptVersion: sanitizeString(payload.promptVersion || 'planner_v1'),
        schemaVersion: sanitizeString(payload.schemaVersion || 'academy_plan_v1'),
        mode: sanitizeString(payload.mode || 'initial'),
        inputSnapshot: payload.inputSnapshot && typeof payload.inputSnapshot === 'object'
            ? payload.inputSnapshot
            : {},
        behaviorProfileSnapshot: payload.behaviorProfileSnapshot && typeof payload.behaviorProfileSnapshot === 'object'
            ? payload.behaviorProfileSnapshot
            : {},
        decisionTrace: payload.decisionTrace && typeof payload.decisionTrace === 'object'
            ? payload.decisionTrace
            : {},
        nurtureTelemetry: payload.nurtureTelemetry && typeof payload.nurtureTelemetry === 'object'
            ? payload.nurtureTelemetry
            : {},
        outputSummary: payload.outputSummary && typeof payload.outputSummary === 'object'
            ? payload.outputSummary
            : {},
        resultMetrics: payload.resultMetrics && typeof payload.resultMetrics === 'object'
            ? payload.resultMetrics
            : {},
        createdAt: ts,
        updatedAt: ts
    };

    await ref.set(plannerRun);

    return {
        id: ref.id,
        ...plannerRun
    };
}
function mapPlannerRunDoc(doc) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        provider: sanitizeString(data.provider || 'gemini'),
        model: sanitizeString(data.model),
        promptVersion: sanitizeString(data.promptVersion || 'planner_v1'),
        schemaVersion: sanitizeString(data.schemaVersion || 'academy_plan_v1'),
        mode: sanitizeString(data.mode || 'initial'),
        inputSnapshot: data.inputSnapshot && typeof data.inputSnapshot === 'object'
            ? data.inputSnapshot
            : {},
        behaviorProfileSnapshot: data.behaviorProfileSnapshot && typeof data.behaviorProfileSnapshot === 'object'
            ? data.behaviorProfileSnapshot
            : {},
        decisionTrace: data.decisionTrace && typeof data.decisionTrace === 'object'
            ? data.decisionTrace
            : {},
        nurtureTelemetry: data.nurtureTelemetry && typeof data.nurtureTelemetry === 'object'
            ? data.nurtureTelemetry
            : {},
        outputSummary: data.outputSummary && typeof data.outputSummary === 'object'
            ? data.outputSummary
            : {},
        resultMetrics: data.resultMetrics && typeof data.resultMetrics === 'object'
            ? data.resultMetrics
            : {},
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
    };
}

async function getPlannerRunById(uid, runId) {
    if (!runId) return null;

    const snapshot = await academyPlannerRunsCol(uid).doc(String(runId)).get();
    if (!snapshot.exists) return null;
    return mapPlannerRunDoc(snapshot);
}

async function getLatestPlannerRun(uid) {
    const snapshot = await academyPlannerRunsCol(uid)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

    if (snapshot.empty) return null;
    return mapPlannerRunDoc(snapshot.docs[0]);
}

async function buildRoadmapTelemetryInspector(uid, roadmapId = '') {
    const roadmap = roadmapId
        ? await getRoadmapById(uid, roadmapId)
        : await getActiveRoadmap(uid);

    if (!roadmap) return null;

    const plannerRun = roadmap.plannerRunId
        ? await getPlannerRunById(uid, roadmap.plannerRunId)
        : await getLatestPlannerRun(uid);

    const nurtureTelemetry = plannerRun?.nurtureTelemetry && typeof plannerRun.nurtureTelemetry === 'object'
        ? plannerRun.nurtureTelemetry
        : (roadmap?.nurtureTelemetry && typeof roadmap.nurtureTelemetry === 'object'
            ? roadmap.nurtureTelemetry
            : {});

    const missions = await listAllMissionsByRoadmap(uid, roadmap.id);

    return {
        uid: sanitizeString(uid),
        roadmap: {
            id: roadmap.id,
            version: roadmap.version,
            status: roadmap.status,
            plannerRunId: roadmap.plannerRunId || '',
            createdByModel: roadmap.createdByModel || 'academy-rule-engine-v1',
            createdAt: roadmap.createdAt || null,
            updatedAt: roadmap.updatedAt || null,
            readinessScore: roadmap.readinessScore,
            focusAreas: Array.isArray(roadmap.focusAreas) ? roadmap.focusAreas : [],
            summary: roadmap.summary || {},
            roadmap: roadmap.roadmap || {},
            adaptivePlanning: roadmap.adaptivePlanning && typeof roadmap.adaptivePlanning === 'object'
                ? roadmap.adaptivePlanning
                : {},
            nurtureTelemetry
        },
        plannerRun: plannerRun
            ? {
                id: plannerRun.id,
                provider: plannerRun.provider,
                model: plannerRun.model,
                promptVersion: plannerRun.promptVersion,
                schemaVersion: plannerRun.schemaVersion,
                mode: plannerRun.mode,
                inputSnapshot: plannerRun.inputSnapshot || {},
                behaviorProfileSnapshot: plannerRun.behaviorProfileSnapshot || {},
                decisionTrace: plannerRun.decisionTrace || {},
                nurtureTelemetry: plannerRun.nurtureTelemetry || {},
                outputSummary: plannerRun.outputSummary || {},
                resultMetrics: plannerRun.resultMetrics || {},
                createdAt: plannerRun.createdAt || null,
                updatedAt: plannerRun.updatedAt || null
            }
            : null,
        missionStats: {
            total: missions.length,
            completed: missions.filter((item) => sanitizeString(item.status).toLowerCase() === 'completed').length,
            skipped: missions.filter((item) => sanitizeString(item.status).toLowerCase() === 'skipped').length,
            stuck: missions.filter((item) => sanitizeString(item.status).toLowerCase() === 'stuck').length
        }
    };
}
async function updatePlannerRunResult(uid, runId, resultMetrics = {}) {
    const ref = academyPlannerRunsCol(uid).doc(String(runId));
    const snapshot = await ref.get();

    if (!snapshot.exists) return null;

    await ref.set(
        {
            resultMetrics: {
                completionRateAfter72h: toNumber(resultMetrics.completionRateAfter72h, 0),
                averageDifficultyScore: toNumber(resultMetrics.averageDifficultyScore, 0),
                averageUsefulnessScore: toNumber(resultMetrics.averageUsefulnessScore, 0)
            },
            updatedAt: nowTs()
        },
        { merge: true }
    );

    const updatedSnapshot = await ref.get();
    return {
        id: updatedSnapshot.id,
        ...(updatedSnapshot.data() || {})
    };
}

async function updateMissionOutcomeMetrics(uid, missionId, payload = {}) {
    const ref = academyMissionsCol(uid).doc(String(missionId));
    const snapshot = await ref.get();

    if (!snapshot.exists) return null;

    const data = snapshot.data() || {};
    const existingMetrics = data.outcomeMetrics && typeof data.outcomeMetrics === 'object'
        ? data.outcomeMetrics
        : {};

    const nextMetrics = {
        skipCount: toNumber(
            payload.skipCount,
            existingMetrics.skipCount || 0
        ),
        stuckCount: toNumber(
            payload.stuckCount,
            existingMetrics.stuckCount || 0
        ),
        rescheduleCount: toNumber(
            payload.rescheduleCount,
            existingMetrics.rescheduleCount || 0
        ),
        completionLagHours: toNumber(
            payload.completionLagHours,
            existingMetrics.completionLagHours || 0
        ),
        userDifficultyScore: toNumber(
            payload.userDifficultyScore,
            existingMetrics.userDifficultyScore || 0
        ),
        userUsefulnessScore: toNumber(
            payload.userUsefulnessScore,
            existingMetrics.userUsefulnessScore || 0
        ),
        lastSkipReasonCategory: sanitizeString(
            payload.lastSkipReasonCategory,
            existingMetrics.lastSkipReasonCategory || ''
        )
    };

    await ref.set(
        {
            outcomeMetrics: nextMetrics,
            updatedAt: nowTs()
        },
        { merge: true }
    );

    const updatedSnapshot = await ref.get();
    return mapMissionDoc(updatedSnapshot);
}

const mapTimestamp = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return value || null;
};

const mapCoachMessageDoc = (doc) => {
    const data = doc.data() || {};
    return {
        id: doc.id,
        conversationId: sanitizeString(data.conversationId || 'coach_main'),
        role: sanitizeString(data.role || 'assistant'),
        text: sanitizeString(data.text),
        contextHint: sanitizeString(data.contextHint),
        provider: sanitizeString(data.provider),
        model: sanitizeString(data.model),
        replyFormat: sanitizeString(data.replyFormat || data.reply_format || 'general'),
        coachModeKey: sanitizeString(data.coachModeKey || data.coach_mode_key || ''),
        responseStyleVersion: sanitizeString(data.responseStyleVersion || data.response_style_version || ''),
        grounding: data.grounding && typeof data.grounding === 'object'
            ? data.grounding
            : {},
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
};

async function listCoachMessages(uid, conversationId = 'coach_main', limit = 20) {
    const normalizedConversationId = sanitizeString(conversationId || 'coach_main', 'coach_main');
    const normalizedLimit = Math.max(1, toNumber(limit, 20));

    const snapshot = await academyCoachMessagesCol(uid)
        .where('conversationId', '==', normalizedConversationId)
        .get();

    const messages = snapshot.docs
        .map(mapCoachMessageDoc)
        .sort((a, b) => {
            const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return left - right;
        });

    return messages.slice(-normalizedLimit);
}

async function createCoachMessage(uid, payload = {}) {
    const ref = academyCoachMessagesCol(uid).doc();
    const ts = nowTs();

    const coachMessage = {
        conversationId: sanitizeString(payload.conversationId || 'coach_main', 'coach_main'),
        role: sanitizeString(payload.role || 'assistant'),
        text: sanitizeString(payload.text),
        contextHint: sanitizeString(payload.contextHint),
        provider: sanitizeString(payload.provider),
        model: sanitizeString(payload.model),
        replyFormat: sanitizeString(payload.replyFormat || payload.reply_format || 'general', 'general'),
        coachModeKey: sanitizeString(payload.coachModeKey || payload.coach_mode_key || ''),
        responseStyleVersion: sanitizeString(payload.responseStyleVersion || payload.response_style_version || ''),
        grounding: payload.grounding && typeof payload.grounding === 'object'
            ? payload.grounding
            : {},
        createdAt: ts,
        updatedAt: ts
    };

    await ref.set(coachMessage);

    const snapshot = await ref.get();
    return mapCoachMessageDoc(snapshot);
}

function mapLeadMissionLeadDoc(doc) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        tier: sanitizeString(data.tier),
        companyName: sanitizeString(data.companyName),
        companyWebsite: sanitizeString(data.companyWebsite),
        contactName: sanitizeString(data.contactName),
        contactRole: sanitizeString(data.contactRole),
        contactType: sanitizeString(data.contactType || 'unknown'),
        email: sanitizeString(data.email),
        phone: sanitizeString(data.phone),
        city: sanitizeString(data.city),
        country: sanitizeString(data.country),
        sourceMethod: sanitizeString(data.sourceMethod),
        callOutcome: sanitizeString(data.callOutcome),
        interestLevel: sanitizeString(data.interestLevel),
        rapportLevel: sanitizeString(data.rapportLevel),
        pipelineStage: sanitizeString(data.pipelineStage),
        priority: sanitizeString(data.priority),
        nextAction: sanitizeString(data.nextAction),
        channel: sanitizeString(data.channel),
        taskStatus: sanitizeString(data.taskStatus),
        callType: sanitizeString(data.callType),
        objection: sanitizeString(data.objection),
        notes: sanitizeString(data.notes),
        followUpDueDate: sanitizeString(data.followUpDueDate),
        status: sanitizeString(data.status || 'active'),

        sellerPriceAmount: toNumber(data.sellerPriceAmount, 0),
        currency: sanitizeString(data.currency || 'USD'),
        universeCommissionRate: toNumber(data.universeCommissionRate, 20),
        universeCommissionAmount: toNumber(data.universeCommissionAmount, 0),
        buyerPriceAmount: toNumber(data.buyerPriceAmount, 0),
        saleEnabled: data.saleEnabled === true,
        saleReviewStatus: sanitizeString(data.saleReviewStatus || 'not_listed'),
        saleStatus: sanitizeString(data.saleStatus || 'not_listed'),
        federationReady: data.federationReady === true,
        plazaReady: data.plazaReady === true,
        federationListingStatus: sanitizeString(data.federationListingStatus || 'not_listed'),

        sourceDivision: sanitizeString(data.sourceDivision || 'academy'),
        sourceFeature: sanitizeString(data.sourceFeature || ''),
        sourceRecordId: sanitizeString(data.sourceRecordId || ''),
        sourceRecordPath: sanitizeString(data.sourceRecordPath || ''),
        routedFromAdmin: data.routedFromAdmin === true,
        routedSourceTitle: sanitizeString(data.routedSourceTitle || ''),
        assignedByAdmin: sanitizeString(data.assignedByAdmin || ''),
        assignedAt: mapTimestamp(data.assignedAt),
        assignmentStatus: sanitizeString(data.assignmentStatus || ''),
        missionType: sanitizeString(data.missionType || ''),
        missionBrief: sanitizeString(data.missionBrief || ''),
        academyMissionNeed: sanitizeString(data.academyMissionNeed || ''),
        opportunityOwnerName: sanitizeString(data.opportunityOwnerName || ''),
        opportunityValueAmount: toNumber(data.opportunityValueAmount, 0),
        platformCommissionRate: toNumber(data.platformCommissionRate, 0),
        platformCommissionAmount: toNumber(data.platformCommissionAmount, 0),
        operatorPayoutAmount: toNumber(data.operatorPayoutAmount, 0),
        accessScopes: Array.isArray(data.accessScopes) ? data.accessScopes : ['academy'],
        networkTags: Array.isArray(data.networkTags) ? data.networkTags : [],
        strategicValue: sanitizeString(data.strategicValue || 'standard'),

        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}

function mapLeadMissionPayoutDoc(doc) {
    const data = doc.data() || {};
    const metadata = data.metadata && typeof data.metadata === 'object' ? data.metadata : {};

    return {
        id: doc.id,
        leadId: sanitizeString(data.leadId),
        federationRequestId: sanitizeString(data.federationRequestId),

        title: sanitizeString(data.title || data.payoutTitle || 'Academy mission earning'),
        basisType: sanitizeString(data.basisType || metadata.missionType || data.sourceFeature || 'routed_mission'),

        amount: toNumber(data.amount, 0),
        currency: sanitizeString(data.currency || 'USD'),
        status: sanitizeString(data.status || 'pending_review'),
        adminNote: sanitizeString(data.adminNote),

        sourceDivision: sanitizeString(data.sourceDivision || 'academy'),
        sourceFeature: sanitizeString(data.sourceFeature || ''),
        sourceRecordId: sanitizeString(data.sourceRecordId || ''),
        sourcePaymentId: sanitizeString(data.sourcePaymentId || ''),

        dealGrossValue: toNumber(data.dealGrossValue || metadata.opportunityValueAmount, 0),
        platformCommissionRate: toNumber(data.platformCommissionRate || metadata.platformCommissionRate, 0),
        platformCommissionAmount: toNumber(data.platformCommissionAmount || metadata.platformCommissionAmount, 0),

        paymentStatus: sanitizeString(data.paymentStatus || 'not_started'),
        payoutStatus: sanitizeString(data.payoutStatus || 'not_requested'),
        commissionStatus: sanitizeString(data.commissionStatus || 'not_started'),

        operatorUid: sanitizeString(data.operatorUid),
        operatorName: sanitizeString(data.operatorName),
        approvedBy: sanitizeString(data.approvedBy),
        metadata,

        approvedAt: mapTimestamp(data.approvedAt),
        paidAt: mapTimestamp(data.paidAt),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}

function mapLeadMissionDealDoc(doc) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        leadId: sanitizeString(data.leadId),
        federationRequestId: sanitizeString(data.federationRequestId),
        dealType: sanitizeString(data.dealType),
        dealStatus: sanitizeString(data.dealStatus || 'under_review'),
        grossValue: toNumber(data.grossValue, 0),
        currency: sanitizeString(data.currency || 'USD'),

        platformCommissionRate: toNumber(data.platformCommissionRate, 0),
        platformCommissionAmount: toNumber(data.platformCommissionAmount, 0),
        operatorPayoutAmount: toNumber(data.operatorPayoutAmount, 0),
        paymentStatus: sanitizeString(data.paymentStatus || 'not_started'),
        payoutStatus: sanitizeString(data.payoutStatus || 'not_started'),
        commissionStatus: sanitizeString(data.commissionStatus || 'not_started'),
        sourceDivision: sanitizeString(data.sourceDivision || 'academy'),
        sourceFeature: sanitizeString(data.sourceFeature || ''),

        operatorVisibleNote: sanitizeString(data.operatorVisibleNote),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}

function buildLeadMissionContactSummary(payload = {}, leadId = '') {
    return {
        leadId: sanitizeString(leadId),
        companyName: sanitizeString(payload.companyName),
        contactName: sanitizeString(payload.contactName),
        contactRole: sanitizeString(payload.contactRole),
        email: sanitizeString(payload.email),
        phone: sanitizeString(payload.phone),
        city: sanitizeString(payload.city),
        country: sanitizeString(payload.country),
        updatedAt: nowTs(),
        createdAt: nowTs()
    };
}

async function createLeadMissionLead(uid, payload = {}) {
    const ref = academyLeadMissionsCol(uid).doc();
    const ts = nowTs();

    const sellerPriceAmount = Math.max(0, toNumber(payload.sellerPriceAmount, 0));
    const currency = sanitizeString(payload.currency || 'USD').toUpperCase() || 'USD';
    const universeCommissionRate = Math.max(0, Math.min(100, toNumber(payload.universeCommissionRate, 0)));
    const universeCommissionAmount = sellerPriceAmount > 0
        ? Number(((sellerPriceAmount * universeCommissionRate) / 100).toFixed(2))
        : 0;
    const buyerPriceAmount = Number((sellerPriceAmount + universeCommissionAmount).toFixed(2));
    const saleEnabled = payload.saleEnabled === true || sellerPriceAmount > 0;

    const lead = {
        tier: sanitizeString(payload.tier),
        companyName: sanitizeString(payload.companyName),
        companyWebsite: sanitizeString(payload.companyWebsite),
        contactName: sanitizeString(payload.contactName),
        contactRole: sanitizeString(payload.contactRole),
        contactType: sanitizeString(payload.contactType || 'unknown'),
        email: sanitizeString(payload.email),
        phone: sanitizeString(payload.phone),
        city: sanitizeString(payload.city),
        country: sanitizeString(payload.country),
        sourceMethod: sanitizeString(payload.sourceMethod),
        callOutcome: sanitizeString(payload.callOutcome),
        interestLevel: sanitizeString(payload.interestLevel),
        rapportLevel: sanitizeString(payload.rapportLevel),
        pipelineStage: sanitizeString(payload.pipelineStage),
        priority: sanitizeString(payload.priority),
        nextAction: sanitizeString(payload.nextAction),
        channel: sanitizeString(payload.channel),
        taskStatus: sanitizeString(payload.taskStatus),
        callType: sanitizeString(payload.callType),
        objection: sanitizeString(payload.objection),
        notes: sanitizeString(payload.notes),
        followUpDueDate: sanitizeString(payload.followUpDueDate),

        sellerPriceAmount,
        currency,
        universeCommissionRate,
        universeCommissionAmount,
        buyerPriceAmount,
        saleEnabled,
        saleReviewStatus: saleEnabled ? 'pending_admin_review' : 'not_listed',
        saleStatus: saleEnabled ? 'pending_admin_review' : 'not_listed',

        federationReady: payload.federationReady === true,
        plazaReady: payload.plazaReady === true,
        federationListingStatus: sanitizeString(payload.federationListingStatus || 'not_listed'),

        sourceDivision: sanitizeString(payload.sourceDivision || 'academy'),
        sourceFeature: sanitizeString(payload.sourceFeature || ''),
        sourceRecordId: sanitizeString(payload.sourceRecordId || ''),
        sourceRecordPath: sanitizeString(payload.sourceRecordPath || ''),
        routedFromAdmin: payload.routedFromAdmin === true,
        routedSourceTitle: sanitizeString(payload.routedSourceTitle || ''),
        assignedByAdmin: sanitizeString(payload.assignedByAdmin || ''),
        assignedAt: payload.assignedAt || null,
        assignmentStatus: sanitizeString(payload.assignmentStatus || ''),
        missionType: sanitizeString(payload.missionType || ''),
        missionBrief: sanitizeString(payload.missionBrief || ''),
        academyMissionNeed: sanitizeString(payload.academyMissionNeed || ''),
        opportunityOwnerName: sanitizeString(payload.opportunityOwnerName || ''),
        opportunityValueAmount: toNumber(payload.opportunityValueAmount, 0),
        platformCommissionRate: toNumber(payload.platformCommissionRate, 0),
        platformCommissionAmount: toNumber(payload.platformCommissionAmount, 0),
        operatorPayoutAmount: toNumber(payload.operatorPayoutAmount, 0),
        accessScopes: Array.isArray(payload.accessScopes) ? payload.accessScopes : ['academy'],
        networkTags: Array.isArray(payload.networkTags) ? payload.networkTags : [],
        strategicValue: sanitizeString(payload.strategicValue || 'standard'),

        status: sanitizeString(payload.status || 'active'),
        createdAt: ts,
        updatedAt: ts
    };

    await ref.set(lead);

    const hasContactPayload = lead.contactName || lead.email || lead.phone || lead.contactRole;
    if (hasContactPayload) {
        const contactRef = academyLeadContactsCol(uid).doc(ref.id);
        await contactRef.set(buildLeadMissionContactSummary(lead, ref.id), { merge: true });
    }

    const snapshot = await ref.get();
    return mapLeadMissionLeadDoc(snapshot);
}

async function listLeadMissionLeads(uid) {
    const snapshot = await academyLeadMissionsCol(uid)
        .orderBy('updatedAt', 'desc')
        .get();

    return snapshot.docs.map(mapLeadMissionLeadDoc);
}

async function getLeadMissionLeadById(uid, leadId) {
    if (!leadId) return null;

    const snapshot = await academyLeadMissionsCol(uid).doc(String(leadId)).get();
    if (!snapshot.exists) return null;

    return mapLeadMissionLeadDoc(snapshot);
}

async function updateLeadMissionLead(uid, leadId, patch = {}) {
    if (!leadId) return null;

    const ref = academyLeadMissionsCol(uid).doc(String(leadId));
    const existing = await ref.get();
    if (!existing.exists) return null;

    const nextPatch = {
        ...(Object.prototype.hasOwnProperty.call(patch, 'tier') ? { tier: sanitizeString(patch.tier) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'companyName') ? { companyName: sanitizeString(patch.companyName) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'companyWebsite') ? { companyWebsite: sanitizeString(patch.companyWebsite) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'contactName') ? { contactName: sanitizeString(patch.contactName) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'contactRole') ? { contactRole: sanitizeString(patch.contactRole) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'contactType') ? { contactType: sanitizeString(patch.contactType || 'unknown') } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'email') ? { email: sanitizeString(patch.email) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'phone') ? { phone: sanitizeString(patch.phone) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'city') ? { city: sanitizeString(patch.city) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'country') ? { country: sanitizeString(patch.country) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'sourceMethod') ? { sourceMethod: sanitizeString(patch.sourceMethod) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'callOutcome') ? { callOutcome: sanitizeString(patch.callOutcome) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'interestLevel') ? { interestLevel: sanitizeString(patch.interestLevel) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'rapportLevel') ? { rapportLevel: sanitizeString(patch.rapportLevel) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'pipelineStage') ? { pipelineStage: sanitizeString(patch.pipelineStage) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'priority') ? { priority: sanitizeString(patch.priority) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'nextAction') ? { nextAction: sanitizeString(patch.nextAction) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'channel') ? { channel: sanitizeString(patch.channel) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'taskStatus') ? { taskStatus: sanitizeString(patch.taskStatus) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'callType') ? { callType: sanitizeString(patch.callType) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'objection') ? { objection: sanitizeString(patch.objection) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'notes') ? { notes: sanitizeString(patch.notes) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'followUpDueDate') ? { followUpDueDate: sanitizeString(patch.followUpDueDate) } : {}),
        ...(Object.prototype.hasOwnProperty.call(patch, 'status') ? { status: sanitizeString(patch.status || 'active') } : {}),
        updatedAt: nowTs()
    };

    await ref.set(nextPatch, { merge: true });

    const mergedLead = {
        ...(existing.data() || {}),
        ...nextPatch
    };

    const hasContactPayload =
        sanitizeString(mergedLead.contactName) ||
        sanitizeString(mergedLead.email) ||
        sanitizeString(mergedLead.phone) ||
        sanitizeString(mergedLead.contactRole);

    if (hasContactPayload) {
        const contactRef = academyLeadContactsCol(uid).doc(String(leadId));
        await contactRef.set(buildLeadMissionContactSummary(mergedLead, leadId), { merge: true });
    }

    const updatedSnapshot = await ref.get();
    return mapLeadMissionLeadDoc(updatedSnapshot);
}

async function listLeadMissionFollowUps(uid) {
    const leads = await listLeadMissionLeads(uid);

    return leads.filter((lead) => {
        const taskStatus = sanitizeString(lead.taskStatus).toLowerCase();
        return taskStatus === 'due' || taskStatus === 'waiting' || sanitizeString(lead.followUpDueDate);
    });
}

async function listLeadMissionPayouts(uid) {
    const snapshot = await academyLeadPayoutsCol(uid)
        .orderBy('updatedAt', 'desc')
        .get();

    return snapshot.docs.map(mapLeadMissionPayoutDoc);
}

async function listLeadMissionDeals(uid) {
    const snapshot = await academyLeadDealsCol(uid)
        .orderBy('updatedAt', 'desc')
        .get();

    return snapshot.docs.map(mapLeadMissionDealDoc);
}

async function getLeadMissionScripts(uid) {
    const snapshot = await academyLeadScriptsDoc(uid).get();
    if (!snapshot.exists) {
        return {
            openingScript: 'Hi, my name is [Your Name]. I am reaching out to ask a few quick questions about your company and the best contact person for this role.',
            objectionHandling: 'If blocked, stay calm, ask for the right role, and log exactly what happened so your follow-up stays structured.'
        };
    }

    const data = snapshot.data() || {};
    return {
        openingScript: sanitizeString(data.openingScript),
        objectionHandling: sanitizeString(data.objectionHandling)
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