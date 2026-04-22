const { firestore } = require('../config/firebaseAdmin');
const { Timestamp } = require('firebase-admin/firestore');

const plazaFeedCol = firestore.collection('plazaFeedPosts');
const plazaOpportunitiesCol = firestore.collection('plazaOpportunities');
const plazaDirectoryCol = firestore.collection('plazaDirectoryProfiles');
const plazaRegionsCol = firestore.collection('plazaRegions');
const plazaBridgeCol = firestore.collection('plazaBridgePaths');
const plazaRequestsCol = firestore.collection('plazaRequests');

function sanitizeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function clampText(value, max = 500, fallback = '') {
    return sanitizeText(value, fallback).slice(0, max);
}

function getViewerFromRequest(req) {
    return {
        id: sanitizeText(req.user?.id || req.user?.firebaseUid || req.user?.uid),
        firebaseUid: sanitizeText(req.user?.firebaseUid || req.user?.id || req.user?.uid),
        email: sanitizeText(req.user?.email).toLowerCase(),
        username: sanitizeText(req.user?.username),
        name: sanitizeText(
            req.user?.name ||
            req.user?.fullName ||
            req.user?.displayName ||
            req.user?.username ||
            'Hustler'
        )
    };
}

function mapTimestamp(value) {
    if (!value) return '';
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return String(value || '');
}

function normalizeFeedType(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'introduction' || raw === 'introductions' || raw === 'intro') return 'introduction';
    if (raw === 'opportunity' || raw === 'opportunities') return 'opportunity';
    if (raw === 'project' || raw === 'projects') return 'project';
    if (raw === 'win' || raw === 'wins') return 'win';

    return 'introduction';
}

function getFeedTypeTag(type = '') {
    const normalized = normalizeFeedType(type);

    if (normalized === 'opportunity') return 'Opportunity';
    if (normalized === 'project') return 'Project';
    if (normalized === 'win') return 'Win';

    return 'Introduction';
}

function mapPlazaFeedDoc(docSnap) {
    const data = docSnap.data() || {};
    const type = normalizeFeedType(data.type);

    return {
        id: docSnap.id,
        type,
        member: sanitizeText(data.member || data.authorName || 'Hustler'),
        source: sanitizeText(data.source || 'plaza'),
        division: sanitizeText(data.division || 'both'),
        region: sanitizeText(data.region || 'Global'),
        title: sanitizeText(data.title || 'Plaza update'),
        text: sanitizeText(data.text || data.body || ''),
        tag: sanitizeText(data.tag || getFeedTypeTag(type)),
        action: sanitizeText(data.action || 'Open'),
        authorId: sanitizeText(data.authorId || data.createdByUserId),
        authorName: sanitizeText(data.authorName || data.member || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase(),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}
function normalizeOpportunityType(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'hiring') return 'Hiring';
    if (raw === 'collaboration') return 'Collaboration';
    if (raw === 'partnership') return 'Partnership';
    if (raw === 'introduction' || raw === 'intro') return 'Introduction';
    if (raw === 'service request' || raw === 'service') return 'Service Request';
    if (raw === 'project' || raw === 'project opening') return 'Project Opening';
    if (raw === 'regional' || raw === 'regional support') return 'Regional Support';

    return 'Opportunity';
}

function mapPlazaOpportunityDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,
        type: normalizeOpportunityType(data.type),
        region: sanitizeText(data.region || 'Global'),
        title: sanitizeText(data.title || 'Plaza opportunity'),
        text: sanitizeText(data.text || data.description || ''),
        action: sanitizeText(data.action || 'Open Opportunity Detail'),
        authorId: sanitizeText(data.authorId || data.createdByUserId),
        authorName: sanitizeText(data.authorName || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase(),
        status: sanitizeText(data.status || 'active'),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}
function normalizeDirectoryDivision(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'academy' || raw === 'yha') return 'academy';
    if (raw === 'federation' || raw === 'yhf') return 'federation';
    if (raw === 'both' || raw === 'cross' || raw === 'plaza') return 'both';

    return 'academy';
}

function normalizeDirectoryTrust(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'connector' || raw === 'trusted connector') return 'connector';
    if (raw === 'leader' || raw === 'local leader') return 'leader';

    return 'verified';
}

function normalizeTags(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeText(item))
            .filter(Boolean)
            .slice(0, 12);
    }

    return sanitizeText(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);
}

function mapPlazaDirectoryDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,
        name: sanitizeText(data.name || data.authorName || 'Hustler'),
        region: sanitizeText(data.region || 'Global'),
        division: normalizeDirectoryDivision(data.division),
        source: sanitizeText(data.source || data.division || 'academy'),
        trust: normalizeDirectoryTrust(data.trust),
        role: sanitizeText(data.role || 'Member'),
        focus: sanitizeText(data.focus || ''),
        tags: normalizeTags(data.tags),
        authorId: sanitizeText(data.authorId || data.userId),
        authorName: sanitizeText(data.authorName || data.name || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase(),
        status: sanitizeText(data.status || 'active'),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}
function mapPlazaRegionDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,
        region: sanitizeText(data.region || data.name || 'Global'),
        count: Number.isFinite(Number(data.count)) ? Number(data.count) : 0,
        label: sanitizeText(data.label || 'Region Hub'),
        text: sanitizeText(data.text || data.description || ''),
        authorId: sanitizeText(data.authorId || data.createdByUserId),
        authorName: sanitizeText(data.authorName || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase(),
        status: sanitizeText(data.status || 'active'),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}
function normalizeBridgeLane(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'academy' || raw === 'yha') return 'academy';
    if (raw === 'federation' || raw === 'yhf') return 'federation';
    if (raw === 'both' || raw === 'cross' || raw === 'plaza') return 'both';

    return 'academy';
}

function mapPlazaBridgeDoc(docSnap) {
    const data = docSnap.data() || {};

    return {
        id: docSnap.id,
        stage: sanitizeText(data.stage || 'Bridge Path'),
        left: normalizeBridgeLane(data.left),
        right: normalizeBridgeLane(data.right || 'federation'),
        region: sanitizeText(data.region || 'Global'),
        title: sanitizeText(data.title || 'Bridge signal'),
        text: sanitizeText(data.text || data.description || ''),
        nextStep: sanitizeText(data.nextStep || 'Review and decide the next structured move.'),
        action: sanitizeText(data.action || 'Open Bridge Detail'),
        authorId: sanitizeText(data.authorId || data.createdByUserId),
        authorName: sanitizeText(data.authorName || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase(),
        status: sanitizeText(data.status || 'active'),
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt)
    };
}
function normalizeRequestStatus(value = '') {
    const raw = sanitizeText(value).toLowerCase();

    if (raw === 'draft') return 'Draft';
    if (raw === 'under review' || raw === 'review') return 'Under Review';
    if (raw === 'matched') return 'Matched';
    if (raw === 'conversation opened' || raw === 'conversation') return 'Conversation Opened';
    if (raw === 'closed') return 'Closed';

    return 'Submitted';
}

function normalizeRequestObjective(value = '') {
    const clean = sanitizeText(value);

    const allowed = new Set([
        'Connection request',
        'Introduction',
        'Collaboration',
        'Partnership',
        'Access',
        'Hiring',
        'Support',
        'Project request',
        'Regional connection',
        'Bridge request'
    ]);

    return allowed.has(clean) ? clean : 'Connection request';
}

function getNextRequestStatus(currentStatus = '') {
    const status = normalizeRequestStatus(currentStatus);

    if (status === 'Submitted') return 'Under Review';
    if (status === 'Under Review') return 'Matched';
    if (status === 'Matched') return 'Conversation Opened';
    if (status === 'Conversation Opened') return 'Closed';

    return status;
}

function normalizeTextArray(value, maxItems = 12) {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => sanitizeText(item))
        .filter(Boolean)
        .slice(0, maxItems);
}

function mapPlazaRequestDoc(docSnap) {
    const data = docSnap.data() || {};
    const status = normalizeRequestStatus(data.status);
    const targetLabel = sanitizeText(data.targetLabel || 'General Plaza request');

    return {
        id: docSnap.id,
        createdAt: mapTimestamp(data.createdAt),
        updatedAt: mapTimestamp(data.updatedAt),
        resolvedAt: mapTimestamp(data.resolvedAt),
        status,
        sourceType: sanitizeText(data.sourceType || 'general'),
        targetId: sanitizeText(data.targetId),
        targetLabel,
        context: sanitizeText(data.context),
        region: sanitizeText(data.region),
        name: sanitizeText(data.name || data.authorName || 'Hustler'),
        objective: normalizeRequestObjective(data.objective),
        message: sanitizeText(data.message),
        routeKey: sanitizeText(data.routeKey || data.sourceType || 'general'),
        routeLabel: sanitizeText(data.routeLabel || targetLabel),
        headline: sanitizeText(data.headline),
        experience: sanitizeText(data.experience),
        portfolioLink: sanitizeText(data.portfolioLink),
        attachmentMeta: Array.isArray(data.attachmentMeta) ? data.attachmentMeta : [],
        matchedEntityLabels: normalizeTextArray(data.matchedEntityLabels),
        decisionSummary: sanitizeText(data.decisionSummary),
        resolutionSummary: sanitizeText(data.resolutionSummary),
        statusHistory: Array.isArray(data.statusHistory) ? data.statusHistory : [],
        authorId: sanitizeText(data.authorId || data.createdByUserId),
        authorName: sanitizeText(data.authorName || data.name || 'Hustler'),
        authorEmail: sanitizeText(data.authorEmail).toLowerCase()
    };
}
exports.getFeed = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 40, 1),
            80
        );

        const snap = await plazaFeedCol
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const feed = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const status = sanitizeText(data.status || 'active').toLowerCase();

            if (status !== 'active') return;

            feed.push(mapPlazaFeedDoc(docSnap));
        });

        return res.json({
            success: true,
            feed
        });
    } catch (error) {
        console.error('plazaControllers.getFeed error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza feed.'
        });
    }
};

exports.createFeedPost = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const type = normalizeFeedType(req.body?.type || req.body?.feedType);
        const text = clampText(
            req.body?.text ||
            req.body?.body ||
            req.body?.content,
            1200
        );

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Feed text is required.'
            });
        }

        const titleInput = clampText(req.body?.title, 120);
        const region = clampText(req.body?.region, 80, 'Global') || 'Global';
        const tag = getFeedTypeTag(type);

        const now = Timestamp.now();

        const payload = {
            type,
            member: viewer.name,
            source: 'plaza',
            division: 'both',
            region,
            title: titleInput || tag,
            text,
            tag,
            action: type === 'opportunity'
                ? 'Open Opportunity Detail'
                : type === 'project'
                    ? 'Open Project Detail'
                    : 'Open',
            authorId: viewer.id,
            authorFirebaseUid: viewer.firebaseUid,
            authorEmail: viewer.email,
            authorName: viewer.name,
            status: 'active',
            createdAt: now,
            updatedAt: now
        };

        const ref = await plazaFeedCol.add(payload);
        const createdSnap = await ref.get();

        return res.status(201).json({
            success: true,
            post: mapPlazaFeedDoc(createdSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createFeedPost error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Plaza feed post.'
        });
    }
};
exports.getOpportunities = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 60, 1),
            100
        );

        const snap = await plazaOpportunitiesCol
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();

        const opportunities = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const status = sanitizeText(data.status || 'active').toLowerCase();

            if (status !== 'active') return;

            opportunities.push(mapPlazaOpportunityDoc(docSnap));
        });

        return res.json({
            success: true,
            opportunities
        });
    } catch (error) {
        console.error('plazaControllers.getOpportunities error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza opportunities.'
        });
    }
};

exports.createOpportunity = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const type = normalizeOpportunityType(req.body?.type);
        const title = clampText(req.body?.title, 140);
        const text = clampText(
            req.body?.text ||
            req.body?.description ||
            req.body?.body,
            1600
        );

        const region = clampText(req.body?.region, 80, 'Global') || 'Global';

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Opportunity title is required.'
            });
        }

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Opportunity details are required.'
            });
        }

        const now = Timestamp.now();

        const payload = {
            type,
            region,
            title,
            text,
            action: 'Open Opportunity Detail',
            authorId: viewer.id,
            authorFirebaseUid: viewer.firebaseUid,
            authorEmail: viewer.email,
            authorName: viewer.name,
            status: 'active',
            createdAt: now,
            updatedAt: now
        };

        const ref = await plazaOpportunitiesCol.add(payload);
        const createdSnap = await ref.get();

        return res.status(201).json({
            success: true,
            opportunity: mapPlazaOpportunityDoc(createdSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createOpportunity error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Plaza opportunity.'
        });
    }
};
exports.getDirectory = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 100, 1),
            200
        );

        const snap = await plazaDirectoryCol
            .orderBy('updatedAt', 'desc')
            .limit(limit)
            .get();

        const directory = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const status = sanitizeText(data.status || 'active').toLowerCase();

            if (status !== 'active') return;

            directory.push(mapPlazaDirectoryDoc(docSnap));
        });

        return res.json({
            success: true,
            directory
        });
    } catch (error) {
        console.error('plazaControllers.getDirectory error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza directory.'
        });
    }
};

exports.upsertDirectoryProfile = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const name = clampText(req.body?.name || viewer.name, 120);
        const region = clampText(req.body?.region, 80, 'Global') || 'Global';
        const division = normalizeDirectoryDivision(req.body?.division);
        const trust = normalizeDirectoryTrust(req.body?.trust);
        const role = clampText(req.body?.role, 120);
        const focus = clampText(req.body?.focus, 500);
        const tags = normalizeTags(req.body?.tags);

        if (!role) {
            return res.status(400).json({
                success: false,
                message: 'Directory role is required.'
            });
        }

        if (!focus) {
            return res.status(400).json({
                success: false,
                message: 'Directory focus is required.'
            });
        }

        const now = Timestamp.now();
        const docId = viewer.id;

        const ref = plazaDirectoryCol.doc(docId);
        const existingSnap = await ref.get();
        const existing = existingSnap.exists ? existingSnap.data() || {} : {};

        const payload = {
            name,
            region,
            division,
            source: division === 'both' ? 'cross' : division,
            trust,
            role,
            focus,
            tags,
            authorId: viewer.id,
            userId: viewer.id,
            authorFirebaseUid: viewer.firebaseUid,
            authorEmail: viewer.email,
            authorName: viewer.name,
            status: 'active',
            createdAt: existing.createdAt || now,
            updatedAt: now
        };

        await ref.set(payload, { merge: true });

        const updatedSnap = await ref.get();

        return res.status(existingSnap.exists ? 200 : 201).json({
            success: true,
            profile: mapPlazaDirectoryDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.upsertDirectoryProfile error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to save Plaza directory profile.'
        });
    }
};
exports.getRegions = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 100, 1),
            200
        );

        const snap = await plazaRegionsCol
            .orderBy('updatedAt', 'desc')
            .limit(limit)
            .get();

        const regions = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const status = sanitizeText(data.status || 'active').toLowerCase();

            if (status !== 'active') return;

            regions.push(mapPlazaRegionDoc(docSnap));
        });

        return res.json({
            success: true,
            regions
        });
    } catch (error) {
        console.error('plazaControllers.getRegions error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza regions.'
        });
    }
};

exports.createRegion = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const region = clampText(req.body?.region || req.body?.name, 100);
        const label = clampText(req.body?.label, 100, 'Region Hub') || 'Region Hub';
        const text = clampText(
            req.body?.text ||
            req.body?.description ||
            req.body?.body,
            900
        );

        if (!region) {
            return res.status(400).json({
                success: false,
                message: 'Region name is required.'
            });
        }

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Region description is required.'
            });
        }

        const now = Timestamp.now();

        const payload = {
            region,
            label,
            text,
            count: 0,
            authorId: viewer.id,
            authorFirebaseUid: viewer.firebaseUid,
            authorEmail: viewer.email,
            authorName: viewer.name,
            status: 'active',
            createdAt: now,
            updatedAt: now
        };

        const ref = await plazaRegionsCol.add(payload);
        const createdSnap = await ref.get();

        return res.status(201).json({
            success: true,
            region: mapPlazaRegionDoc(createdSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createRegion error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Plaza region.'
        });
    }
};
exports.getBridge = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 100, 1),
            200
        );

        const snap = await plazaBridgeCol
            .orderBy('updatedAt', 'desc')
            .limit(limit)
            .get();

        const bridge = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const status = sanitizeText(data.status || 'active').toLowerCase();

            if (status !== 'active') return;

            bridge.push(mapPlazaBridgeDoc(docSnap));
        });

        return res.json({
            success: true,
            bridge
        });
    } catch (error) {
        console.error('plazaControllers.getBridge error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza bridge paths.'
        });
    }
};

exports.createBridge = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const stage = clampText(req.body?.stage, 100, 'Bridge Path') || 'Bridge Path';
        const left = normalizeBridgeLane(req.body?.left || 'academy');
        const right = normalizeBridgeLane(req.body?.right || 'federation');
        const region = clampText(req.body?.region, 100, 'Global') || 'Global';
        const title = clampText(req.body?.title, 140);
        const text = clampText(
            req.body?.text ||
            req.body?.description ||
            req.body?.body,
            1200
        );
        const nextStep = clampText(
            req.body?.nextStep,
            220,
            'Review and decide the next structured move.'
        ) || 'Review and decide the next structured move.';

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Bridge title is required.'
            });
        }

        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'Bridge description is required.'
            });
        }

        const now = Timestamp.now();

        const payload = {
            stage,
            left,
            right,
            region,
            title,
            text,
            nextStep,
            action: 'Open Bridge Detail',
            authorId: viewer.id,
            authorFirebaseUid: viewer.firebaseUid,
            authorEmail: viewer.email,
            authorName: viewer.name,
            status: 'active',
            createdAt: now,
            updatedAt: now
        };

        const ref = await plazaBridgeCol.add(payload);
        const createdSnap = await ref.get();

        return res.status(201).json({
            success: true,
            bridgePath: mapPlazaBridgeDoc(createdSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createBridge error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Plaza bridge path.'
        });
    }
};
exports.getRequests = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 100, 1),
            200
        );

        const snap = await plazaRequestsCol
            .where('authorId', '==', viewer.id)
            .orderBy('updatedAt', 'desc')
            .limit(limit)
            .get();

        const requests = [];

        snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const recordStatus = sanitizeText(data.recordStatus || 'active').toLowerCase();

            if (recordStatus !== 'active') return;

            requests.push(mapPlazaRequestDoc(docSnap));
        });

        return res.json({
            success: true,
            requests
        });
    } catch (error) {
        console.error('plazaControllers.getRequests error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load Plaza requests.'
        });
    }
};

exports.createRequest = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const objective = normalizeRequestObjective(req.body?.objective);
        const message = clampText(req.body?.message, 1400);
        const targetLabel = clampText(req.body?.targetLabel, 160, 'General Plaza request') || 'General Plaza request';
        const sourceType = clampText(req.body?.sourceType, 80, 'general') || 'general';
        const targetId = clampText(req.body?.targetId, 160);
        const context = clampText(req.body?.context, 500);
        const region = clampText(req.body?.region, 100);
        const headline = clampText(req.body?.headline, 160);
        const experience = clampText(req.body?.experience, 500);
        const portfolioLink = clampText(req.body?.portfolioLink, 300);

        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Request message is required.'
            });
        }

        const now = Timestamp.now();

        const payload = {
            sourceType,
            targetId,
            targetLabel,
            context,
            region,
            name: viewer.name,
            objective,
            message,
            status: 'Submitted',
            routeKey: sourceType,
            routeLabel: targetLabel,
            headline,
            experience,
            portfolioLink,
            attachmentMeta: [],
            matchedEntityLabels: [],
            decisionSummary: '',
            resolutionSummary: '',
            statusHistory: [
                {
                    status: 'Submitted',
                    at: new Date().toISOString()
                }
            ],
            authorId: viewer.id,
            authorFirebaseUid: viewer.firebaseUid,
            authorEmail: viewer.email,
            authorName: viewer.name,
            recordStatus: 'active',
            createdAt: now,
            updatedAt: now,
            resolvedAt: ''
        };

        const ref = await plazaRequestsCol.add(payload);
        const createdSnap = await ref.get();

        return res.status(201).json({
            success: true,
            request: mapPlazaRequestDoc(createdSnap)
        });
    } catch (error) {
        console.error('plazaControllers.createRequest error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create Plaza request.'
        });
    }
};

exports.advanceRequestStatus = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const requestId = sanitizeText(req.params.id);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: 'Request ID is required.'
            });
        }

        const ref = plazaRequestsCol.doc(requestId);
        const snap = await ref.get();

        if (!snap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Request not found.'
            });
        }

        const current = snap.data() || {};

        if (sanitizeText(current.authorId) !== viewer.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own Plaza requests.'
            });
        }

        const currentStatus = normalizeRequestStatus(current.status);
        const nextStatus = normalizeRequestStatus(req.body?.status || getNextRequestStatus(currentStatus));
        const now = Timestamp.now();

        const statusHistory = Array.isArray(current.statusHistory)
            ? [...current.statusHistory]
            : [];

        if (nextStatus !== currentStatus) {
            statusHistory.push({
                status: nextStatus,
                at: new Date().toISOString()
            });
        }

        await ref.set({
            status: nextStatus,
            statusHistory,
            resolvedAt: nextStatus === 'Closed' ? now : '',
            updatedAt: now
        }, { merge: true });

        const updatedSnap = await ref.get();

        return res.json({
            success: true,
            request: mapPlazaRequestDoc(updatedSnap)
        });
    } catch (error) {
        console.error('plazaControllers.advanceRequestStatus error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update Plaza request.'
        });
    }
};

exports.deleteRequest = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);
        const requestId = sanitizeText(req.params.id);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: 'Request ID is required.'
            });
        }

        const ref = plazaRequestsCol.doc(requestId);
        const snap = await ref.get();

        if (!snap.exists) {
            return res.status(404).json({
                success: false,
                message: 'Request not found.'
            });
        }

        const current = snap.data() || {};

        if (sanitizeText(current.authorId) !== viewer.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own Plaza requests.'
            });
        }

        await ref.set({
            recordStatus: 'deleted',
            updatedAt: Timestamp.now()
        }, { merge: true });

        return res.json({
            success: true
        });
    } catch (error) {
        console.error('plazaControllers.deleteRequest error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete Plaza request.'
        });
    }
};