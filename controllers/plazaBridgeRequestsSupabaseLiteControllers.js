const bridgeRequestsRepo = require('../backend/repositories/plazaBridgeRequestsSupabaseRepo');

function sanitizeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function clampText(value, limit = 1000, fallback = '') {
    const clean = sanitizeText(value, fallback);
    return clean.slice(0, Math.max(1, Number(limit || 1000)));
}

function safeArray(value = []) {
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeText(item)).filter(Boolean);
    }

    return String(value || '')
        .split(',')
        .map((item) => sanitizeText(item))
        .filter(Boolean);
}

function getViewerFromRequest(req = {}) {
    const user = req.user || {};

    return {
        id: sanitizeText(user.id || user.firebaseUid || user.uid),
        firebaseUid: sanitizeText(user.firebaseUid || user.id || user.uid),
        email: sanitizeText(user.email).toLowerCase(),
        username: sanitizeText(user.username),
        name: sanitizeText(
            user.name ||
            user.fullName ||
            user.displayName ||
            user.username ||
            user.email ||
            'YH Member'
        )
    };
}

function buildBridgePayloadFromRequest(req = {}, viewer = {}) {
    const body = req.body || {};
    const now = new Date().toISOString();

    const title = clampText(
        body.title ||
        body.name ||
        body.label ||
        'Plaza bridge',
        160
    );

    return {
        ...body,
        id: sanitizeText(body.id || body.slug || ''),
        title,
        name: clampText(body.name || title, 160),
        slug: clampText(
            body.slug ||
            title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
            180
        ),
        description: clampText(body.description || body.summary || body.body || body.text, 1600),
        summary: clampText(body.summary || body.description || body.body || body.text, 600),
        origin: clampText(body.origin || body.from || body.source, 120),
        destination: clampText(body.destination || body.to || body.target, 120),
        region: clampText(body.region || 'Global', 120, 'Global') || 'Global',
        category: clampText(body.category || body.type || 'bridge', 120, 'bridge'),
        tags: safeArray(body.tags),
        authorId: sanitizeText(body.authorId || viewer.id),
        authorEmail: sanitizeText(body.authorEmail || viewer.email).toLowerCase(),
        authorName: sanitizeText(body.authorName || viewer.name),
        status: sanitizeText(body.status || 'active'),
        reviewStatus: sanitizeText(body.reviewStatus || body.status || 'active'),
        createdAt: body.createdAt || now,
        updatedAt: now
    };
}

function buildRequestPayloadFromRequest(req = {}, viewer = {}) {
    const body = req.body || {};
    const now = new Date().toISOString();

    const title = clampText(
        body.title ||
        body.subject ||
        body.name ||
        'Plaza request',
        160
    );

    return {
        ...body,
        id: sanitizeText(body.id || ''),
        title,
        subject: clampText(body.subject || title, 160),
        description: clampText(
            body.description ||
            body.summary ||
            body.body ||
            body.text ||
            body.message,
            1800
        ),
        summary: clampText(
            body.summary ||
            body.description ||
            body.body ||
            body.text ||
            body.message,
            600
        ),
        requestType: clampText(body.requestType || body.type || 'general', 120, 'general'),
        priority: clampText(body.priority || 'normal', 80, 'normal'),
        region: clampText(body.region || 'Global', 120, 'Global') || 'Global',
        category: clampText(body.category || body.requestType || body.type || 'request', 120, 'request'),
        tags: safeArray(body.tags),
        authorId: sanitizeText(body.authorId || viewer.id),
        authorFirebaseUid: sanitizeText(body.authorFirebaseUid || viewer.firebaseUid || viewer.id),
        authorEmail: sanitizeText(body.authorEmail || viewer.email).toLowerCase(),
        authorName: sanitizeText(body.authorName || viewer.name),
        assignedTo: sanitizeText(body.assignedTo || body.assigneeId || ''),
        targetUserId: sanitizeText(body.targetUserId || body.recipientId || ''),
        status: sanitizeText(body.status || 'open'),
        reviewStatus: sanitizeText(body.reviewStatus || 'active'),
        createdAt: body.createdAt || now,
        updatedAt: now
    };
}

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
            Math.max(parseInt(req.query.limit, 10) || 80, 1),
            160
        );

        const bridge = await bridgeRequestsRepo.listBridge(limit);

        return res.json({
            success: true,
            source: 'supabase',
            bridge,
            paths: bridge,
            bridgePaths: bridge,
            bridgeCount: bridge.length
        });
    } catch (error) {
        console.error('plazaBridgeRequestsSupabaseLite.getBridge error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to load Plaza bridge.'
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

        const payload = buildBridgePayloadFromRequest(req, viewer);

        if (!payload.title) {
            return res.status(400).json({
                success: false,
                message: 'Bridge title is required.'
            });
        }

        const bridge = await bridgeRequestsRepo.createBridge(payload);

        return res.status(201).json({
            success: true,
            source: 'supabase',
            bridge
        });
    } catch (error) {
        console.error('plazaBridgeRequestsSupabaseLite.createBridge error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Plaza bridge.'
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

        const requests = await bridgeRequestsRepo.listRequests(limit);

        return res.json({
            success: true,
            source: 'supabase',
            requests,
            requestCount: requests.length
        });
    } catch (error) {
        console.error('plazaBridgeRequestsSupabaseLite.getRequests error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to load Plaza requests.'
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

        const payload = buildRequestPayloadFromRequest(req, viewer);

        if (!payload.title) {
            return res.status(400).json({
                success: false,
                message: 'Request title is required.'
            });
        }

        const request = await bridgeRequestsRepo.createRequest(payload);

        return res.status(201).json({
            success: true,
            source: 'supabase',
            request
        });
    } catch (error) {
        console.error('plazaBridgeRequestsSupabaseLite.createRequest error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Plaza request.'
        });
    }
};

exports.updateRequest = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const requestId = sanitizeText(req.params?.id);

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: 'Request id is required.'
            });
        }

        const patch = {
            ...(req.body || {}),
            updatedBy: viewer.id,
            updatedByName: viewer.name
        };

        const request = await bridgeRequestsRepo.updateRequest(requestId, patch);

        return res.json({
            success: true,
            source: 'supabase',
            request
        });
    } catch (error) {
        console.error('plazaBridgeRequestsSupabaseLite.updateRequest error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to update Plaza request.'
        });
    }
};

exports.advanceRequestStatus = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const requestId = sanitizeText(req.params?.id);
        const status = sanitizeText(
            req.body?.status ||
            req.body?.nextStatus ||
            req.body?.requestStatus ||
            'open'
        );

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: 'Request id is required.'
            });
        }

        const request = await bridgeRequestsRepo.updateRequest(requestId, {
            status,
            updatedBy: viewer.id,
            updatedByName: viewer.name
        });

        return res.json({
            success: true,
            source: 'supabase',
            request
        });
    } catch (error) {
        console.error('plazaBridgeRequestsSupabaseLite.advanceRequestStatus error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to advance Plaza request status.'
        });
    }
};

exports.deleteRequest = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const requestId = sanitizeText(req.params?.id);

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: 'Request id is required.'
            });
        }

        await bridgeRequestsRepo.deleteRecord('request', requestId);

        return res.json({
            success: true,
            source: 'supabase',
            deletedId: requestId
        });
    } catch (error) {
        console.error('plazaBridgeRequestsSupabaseLite.deleteRequest error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to delete Plaza request.'
        });
    }
};
