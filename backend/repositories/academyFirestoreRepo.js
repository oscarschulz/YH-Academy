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

const mapMissionDoc = (doc) => {
    const data = doc.data() || {};
    return {
        id: doc.id,
        roadmapId: sanitizeString(data.roadmapId),
        pillar: sanitizeString(data.pillar),
        title: sanitizeString(data.title),
        description: sanitizeString(data.description),
        whyItMatters: sanitizeString(data.whyItMatters),
        status: sanitizeString(data.status || 'pending'),
        frequency: sanitizeString(data.frequency),
        dueDate: sanitizeString(data.dueDate),
        estimatedMinutes: toNumber(data.estimatedMinutes, 0),
        completionNote: sanitizeString(data.completionNote),
        source: sanitizeString(data.source || 'rule'),
        sortOrder: toNumber(data.sortOrder, 0),
        completedAt: data.completedAt || null,
        createdAt: data.createdAt || null
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
        createdByModel: sanitizeString(data.createdByModel || 'academy-rule-engine-v1'),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        archivedAt: data.archivedAt || null
    };
};

async function getCurrentProfile(uid) {
    const snapshot = await academyMetaDoc(uid, 'profile').get();
    if (!snapshot.exists) return null;
    return snapshot.data() || null;
}

async function setCurrentProfile(uid, payload) {
    const ref = academyMetaDoc(uid, 'profile');
    const ts = nowTs();

    await ref.set(
        {
            ...payload,
            updatedAt: ts,
            createdAt: ts,
            version: 1
        },
        { merge: true }
    );

    const snapshot = await ref.get();
    return snapshot.data() || null;
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
        createdByModel: sanitizeString(createdByModel || 'academy-rule-engine-v1'),
        profileSnapshot: profile && typeof profile === 'object' ? profile : {},
        createdAt: ts,
        updatedAt: ts,
        archivedAt: null
    });

    const missionSource = String(createdByModel || '').includes('openai') ? 'ai' : 'rule';

    for (const mission of Array.isArray(plan.missions) ? plan.missions : []) {
        const missionRef = academyMissionsCol(uid).doc();
        batch.set(missionRef, {
            roadmapId: roadmapRef.id,
            pillar: sanitizeString(mission.pillar),
            title: sanitizeString(mission.title),
            description: sanitizeString(mission.description),
            whyItMatters: sanitizeString(mission.whyItMatters),
            frequency: sanitizeString(mission.frequency),
            dueDate: sanitizeString(mission.dueDate),
            estimatedMinutes: toNumber(mission.estimatedMinutes, 0),
            status: 'pending',
            source: missionSource,
            completionNote: '',
            sortOrder: toNumber(mission.sortOrder, 0),
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

async function buildAcademyHomePayload(uid, roadmapId = null) {
    const roadmap = roadmapId
        ? await getRoadmapById(uid, roadmapId)
        : await getActiveRoadmap(uid);

    if (!roadmap) return null;

    const missions = await listRecentMissions(uid, roadmap.id, 5);
    const allMissions = await listAllMissionsByRoadmap(uid, roadmap.id);
    const streakDays = await getRecentCheckinStreakDays(uid);

    const completedCount = allMissions.filter((item) => item.status === 'completed').length;
    const totalCount = allMissions.length;

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
            streakDays
        },
        missions,
        createdByModel: roadmap.createdByModel || 'academy-rule-engine-v1'
    };
}

module.exports = {
    getCurrentProfile,
    setCurrentProfile,
    getAccessState,
    setAccessUnlocked,
    getActiveRoadmap,
    getRoadmapById,
    getMissionById,
    updateMissionCompletion,
    updateMissionStatus,
    getMissionProgress,
    listRecentMissions,
    listAllMissionsByRoadmap,
    listRecentCheckins,
    createCheckin,
    getRecentCheckinStreakDays,
    persistRoadmapBundle,
    buildAcademyHomePayload,
    academyCoachMessagesCol
};