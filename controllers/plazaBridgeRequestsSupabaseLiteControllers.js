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
        ),
        role: sanitizeText(
            user.role ||
            user.accountRole ||
            user.userRole
        ).toLowerCase(),
        isAdmin:
            user.isAdmin === true ||
            user.admin === true,
        adminRoles:
            Array.isArray(user.adminRoles)
                ? user.adminRoles
                    .map((item) =>
                        sanitizeText(item)
                            .toLowerCase()
                    )
                    .filter(Boolean)
                : []
    };
}

function isPrivilegedPlazaViewer(viewer = {}) {
    return Boolean(
        viewer.isAdmin === true ||
        [
            'admin',
            'superadmin',
            'super_admin',
            'plaza_admin',
            'system_admin'
        ].includes(viewer.role) ||
        viewer.adminRoles.includes('plaza') ||
        viewer.adminRoles.includes('plaza_admin') ||
        viewer.adminRoles.includes('superadmin') ||
        viewer.adminRoles.includes('system_admin')
    );
}

function requestBelongsToViewer(
    request = {},
    viewerId = ''
) {
    const cleanViewerId =
        sanitizeText(viewerId);

    return [
        request.authorId,
        request.authorFirebaseUid
    ]
        .map(sanitizeText)
        .filter(Boolean)
        .includes(cleanViewerId);
}

function viewerCanManageRequest(
    request = {},
    viewer = {}
) {
    if (
        isPrivilegedPlazaViewer(viewer)
    ) {
        return true;
    }

    const viewerId =
        sanitizeText(viewer.id);

    return [
        request.assignedTo,
        request.targetUserId,
        request.patronUserId
    ]
        .map(sanitizeText)
        .filter(Boolean)
        .includes(viewerId);
}

function normalizeRequestStatusLabel(
    value = ''
) {
    const raw = sanitizeText(value)
        .toLowerCase()
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ');

    if (raw === 'draft') return 'Draft';
    if (
        raw === 'submitted' ||
        raw === 'open'
    ) {
        return 'Submitted';
    }

    if (
        raw === 'under review' ||
        raw === 'pending review' ||
        raw === 'review'
    ) {
        return 'Under Review';
    }

    if (raw === 'matched') {
        return 'Matched';
    }

    if (
        raw === 'conversation opened' ||
        raw === 'conversation'
    ) {
        return 'Conversation Opened';
    }

    if (
        raw === 'closed' ||
        raw === 'completed'
    ) {
        return 'Closed';
    }

    return '';
}

function getNextRequestStatusLabel(
    value = ''
) {
    const current =
        normalizeRequestStatusLabel(value);

    if (current === 'Draft') {
        return 'Submitted';
    }

    if (current === 'Submitted') {
        return 'Under Review';
    }

    if (current === 'Under Review') {
        return 'Matched';
    }

    if (current === 'Matched') {
        return 'Conversation Opened';
    }

    if (
        current ===
        'Conversation Opened'
    ) {
        return 'Closed';
    }

    return '';
}

function buildSafeRequestPatch(
    body = {},
    viewer = {}
) {
    const patch = {
        title: clampText(
            body.title ||
            body.subject ||
            body.targetLabel,
            160
        ),
        subject: clampText(
            body.subject ||
            body.title ||
            body.targetLabel,
            160
        ),
        description: clampText(
            body.description ||
            body.summary ||
            body.body ||
            body.text ||
            body.message,
            1800
        ),
        message: clampText(
            body.message ||
            body.description ||
            body.summary ||
            body.body ||
            body.text,
            1800
        ),
        requestType: clampText(
            body.requestType ||
            body.objective ||
            body.type,
            120
        ),
        objective: clampText(
            body.objective,
            120
        ),
        sourceType: clampText(
            body.sourceType,
            120
        ),
        targetId: clampText(
            body.targetId,
            180
        ),
        targetLabel: clampText(
            body.targetLabel,
            180
        ),
        context: clampText(
            body.context,
            800
        ),
        region: clampText(
            body.region,
            120
        ),
        providerId: clampText(
            body.providerId,
            180
        ),
        providerName: clampText(
            body.providerName,
            180
        ),
        serviceCategory: clampText(
            body.serviceCategory,
            120
        ),
        serviceTags: safeArray(
            body.serviceTags
        ),
        serviceProviderType: clampText(
            body.serviceProviderType,
            120
        ),
        servicePriceType: clampText(
            body.servicePriceType,
            120
        ),
        serviceDeliveryTime: clampText(
            body.serviceDeliveryTime,
            120
        ),
        requestIntent: clampText(
            body.requestIntent,
            160
        ),
        requestPriority: clampText(
            body.requestPriority ||
            body.priority,
            80
        ),
        routeKey: clampText(
            body.routeKey,
            160
        ),
        routeLabel: clampText(
            body.routeLabel,
            180
        ),
        headline: clampText(
            body.headline,
            240
        ),
        experience: clampText(
            body.experience,
            1600
        ),
        portfolioLink: clampText(
            body.portfolioLink,
            1000
        ),
        updatedBy:
            viewer.id,
        updatedByName:
            viewer.name
    };

    Object.keys(patch).forEach((key) => {
        const value = patch[key];

        if (
            value === '' ||
            (
                Array.isArray(value) &&
                !value.length
            )
        ) {
            delete patch[key];
        }
    });

    return patch;
}

function buildBridgePayloadFromRequest(
    req = {},
    viewer = {}
) {
    const body = req.body || {};
    const now =
        new Date().toISOString();

    const title = clampText(
        body.title ||
        body.name ||
        body.label ||
        'Plaza bridge',
        160
    );

    const isPrivileged =
        isPrivilegedPlazaViewer(
            viewer
        );

    return {
        id: '',
        clientCreateId: clampText(
            body.clientCreateId,
            180
        ),
        title,

        name: clampText(
            body.name ||
            title,
            160
        ),

        slug: clampText(
            body.slug ||
            title
                .toLowerCase()
                .replace(
                    /[^a-z0-9]+/g,
                    '-'
                )
                .replace(
                    /^-+|-+$/g,
                    ''
                ),
            180
        ),

        description: clampText(
            body.description ||
            body.summary ||
            body.body ||
            body.text,
            1600
        ),

        summary: clampText(
            body.summary ||
            body.description ||
            body.body ||
            body.text,
            600
        ),

        origin: clampText(
            body.origin ||
            body.from ||
            body.source ||
            body.left,
            120
        ),

        destination: clampText(
            body.destination ||
            body.to ||
            body.target ||
            body.right,
            120
        ),

        region: clampText(
            body.region ||
            'Global',
            120,
            'Global'
        ) || 'Global',

        category: clampText(
            body.category ||
            body.type ||
            'bridge',
            120,
            'bridge'
        ),

        stage: clampText(
            body.stage,
            120
        ),

        nextStep: clampText(
            body.nextStep,
            240
        ),

        tags:
            safeArray(
                body.tags
            ),

        authorId:
            viewer.id,

        authorEmail:
            viewer.email,

        authorName:
            viewer.name,

        status:
            isPrivileged
                ? 'active'
                : 'pending_review',

        reviewStatus:
            isPrivileged
                ? 'active'
                : 'pending_review',

        createdAt: now,
        updatedAt: now
    };
}

function buildRequestPayloadFromRequest(req = {}, viewer = {}) {
    const body = req.body || {};
    const now = new Date().toISOString();

    const title = clampText(
        body.title ||
        body.subject ||
        body.targetLabel ||
        body.name ||
        'Plaza request',
        160
    );

    const message = clampText(
        body.message ||
        body.description ||
        body.summary ||
        body.body ||
        body.text,
        1800
    );

    const requestedStatus =
        normalizeRequestStatusLabel(
            body.status
        );

    return {
        id: '',
        clientRequestId: clampText(
            body.clientRequestId,
            180
        ),
        title,
        subject: clampText(
            body.subject ||
            title,
            160
        ),
        description: message,
        message,
        summary: clampText(
            body.summary ||
            message,
            600
        ),

        requestType: clampText(
            body.requestType ||
            body.objective ||
            body.type ||
            'general',
            120,
            'general'
        ),
        objective: clampText(
            body.objective ||
            'Connection request',
            120,
            'Connection request'
        ),
        sourceType: clampText(
            body.sourceType ||
            body.requestType ||
            'general',
            120,
            'general'
        ),
        targetId: clampText(
            body.targetId,
            180
        ),
        targetLabel: clampText(
            body.targetLabel ||
            title,
            180
        ),
        context: clampText(
            body.context,
            800
        ),
        name: viewer.name,

        providerId: clampText(
            body.providerId,
            180
        ),
        providerName: clampText(
            body.providerName,
            180
        ),
        serviceCategory: clampText(
            body.serviceCategory,
            120
        ),
        serviceTags: safeArray(
            body.serviceTags
        ),
        serviceProviderType: clampText(
            body.serviceProviderType,
            120
        ),
        servicePriceType: clampText(
            body.servicePriceType,
            120
        ),
        serviceDeliveryTime: clampText(
            body.serviceDeliveryTime,
            120
        ),
        requestIntent: clampText(
            body.requestIntent,
            160
        ),
        requestPriority: clampText(
            body.requestPriority ||
            body.priority ||
            'normal',
            80,
            'normal'
        ),

        routeKey: clampText(
            body.routeKey ||
            body.sourceType ||
            'general',
            160
        ),
        routeLabel: clampText(
            body.routeLabel ||
            body.targetLabel ||
            title,
            180
        ),
        matchingStatus: clampText(
            body.matchingStatus,
            120
        ),
        matchingPriority: clampText(
            body.matchingPriority,
            80
        ),

        headline: clampText(
            body.headline,
            240
        ),
        experience: clampText(
            body.experience,
            1600
        ),
        portfolioLink: clampText(
            body.portfolioLink,
            1000
        ),
        attachmentMeta: safeArray(
            body.attachmentMeta
        ),

        priority: clampText(
            body.priority ||
            body.requestPriority ||
            'normal',
            80,
            'normal'
        ),
        region: clampText(
            body.region ||
            'Global',
            120,
            'Global'
        ) || 'Global',
        category: clampText(
            body.category ||
            body.requestType ||
            body.objective ||
            'request',
            120,
            'request'
        ),
        tags: safeArray(
            body.tags
        ),

        authorId: viewer.id,
        authorFirebaseUid:
            viewer.firebaseUid ||
            viewer.id,
        authorEmail: viewer.email,
        authorName: viewer.name,

        assignedTo: '',
        targetUserId: sanitizeText(
            body.targetUserId ||
            body.recipientId ||
            body.providerId ||
            ''
        ),

        status:
            requestedStatus === 'Draft'
                ? 'Draft'
                : 'Submitted',
        reviewStatus: 'active',
        createdAt: now,
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
            Math.max(
                parseInt(
                    req.query.limit,
                    10
                ) || 80,
                1
            ),
            160
        );

        const cursor = clampText(
            req.query.cursor,
            1200
        );

        const page =
            await bridgeRequestsRepo
                .listBridge({
                    limit,
                    cursor
                });

        return res.json({
            success: true,
            source: 'supabase',
            bridge:
                page.items,
            paths:
                page.items,
            bridgePaths:
                page.items,
            bridgeCount:
                page.items.length,
            hasMore:
                page.hasMore === true,
            nextCursor:
                page.nextCursor || '',
            fetchedAt:
                new Date().toISOString()
        });
    } catch (error) {
        console.error(
            'plazaBridgeRequestsSupabaseLite.getBridge error:',
            error
        );

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to load Plaza bridge.'
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

        const payload =
            buildBridgePayloadFromRequest(
                req,
                viewer
            );

        if (!payload.clientCreateId) {
            return res.status(400).json({
                success: false,
                message: 'Client create id is required.'
            });
        }

        if (!payload.title) {
            return res.status(400).json({
                success: false,
                message: 'Bridge title is required.'
            });
        }

        const result =
            await bridgeRequestsRepo
                .createBridge(
                    payload
                );

        const bridge = result.bridge;

        const published =
            [
                'active',
                'approved',
                'published',
                'verified'
            ].includes(
                sanitizeText(
                    bridge?.status
                ).toLowerCase()
            ) &&
            [
                'active',
                'approved',
                'published',
                'verified'
            ].includes(
                sanitizeText(
                    bridge?.reviewStatus
                ).toLowerCase()
            );

        return res.status(
            result.created === true
                ? published
                    ? 201
                    : 202
                : 200
        ).json({
            success: true,
            source: 'supabase',
            created:
                result.created === true,
            duplicate:
                result.duplicate === true,
            published,
            pendingReview:
                !published,
            bridge,
            bridgePath:
                bridge
        });
    } catch (error) {
        console.error('plazaBridgeRequestsSupabaseLite.createBridge error:', error);

        return res.status(
            Number(error?.status) || 500
        ).json({
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
            Math.max(
                parseInt(
                    req.query.limit,
                    10
                ) || 100,
                1
            ),
            200
        );

        const cursor = clampText(
            req.query.cursor,
            1200
        );

        const page =
            await bridgeRequestsRepo
                .listRequests({
                    limit,
                    cursor,
                    viewerId:
                        viewer.id
                });

        return res.json({
            success: true,
            source: 'supabase',
            requests:
                page.items,
            requestCount:
                page.items.length,
            hasMore:
                page.hasMore === true,
            nextCursor:
                page.nextCursor || '',
            fetchedAt:
                new Date().toISOString()
        });
    } catch (error) {
        console.error(
            'plazaBridgeRequestsSupabaseLite.getRequests error:',
            error
        );

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to load Plaza requests.'
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

        const payload =
            buildRequestPayloadFromRequest(
                req,
                viewer
            );

        if (!payload.clientRequestId) {
            return res.status(400).json({
                success: false,
                message:
                    'Client request id is required.'
            });
        }

        if (!payload.title) {
            return res.status(400).json({
                success: false,
                message:
                    'Request title is required.'
            });
        }

        const result =
            await bridgeRequestsRepo
                .createRequest(
                    payload
                );

        return res.status(
            result.created === true
                ? 201
                : 200
        ).json({
            success: true,
            source: 'supabase',
            created:
                result.created === true,
            duplicate:
                result.duplicate === true,
            promoted:
                result.promoted === true,
            request:
                result.request
        });
    } catch (error) {
        console.error(
            'plazaBridgeRequestsSupabaseLite.createRequest error:',
            error
        );

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to create Plaza request.'
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

        const requestId =
            sanitizeText(
                req.params?.id
            );

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message:
                    'Request id is required.'
            });
        }
        const expectedUpdatedAt = sanitizeText(
            req.body?.expectedUpdatedAt
        );

        if (!expectedUpdatedAt) {
            return res.status(428).json({
                success: false,
                message:
                    'Request version is required. Reload and retry.'
            });
        }
        const current =
            await bridgeRequestsRepo
                .getRequestById(
                    requestId
                );

        if (!current) {
            return res.status(404).json({
                success: false,
                message:
                    'Plaza request not found.'
            });
        }

        const isOwner =
            requestBelongsToViewer(
                current,
                viewer.id
            );

        const isPrivileged =
            isPrivilegedPlazaViewer(
                viewer
            );

        if (
            !isOwner &&
            !isPrivileged
        ) {
            return res.status(403).json({
                success: false,
                message:
                    'You cannot edit this Plaza request.'
            });
        }

        const patch =
            buildSafeRequestPatch(
                req.body || {},
                viewer
            );

        const requestedStatus =
            normalizeRequestStatusLabel(
                req.body?.status
            );

        if (
            requestedStatus &&
            (
                isPrivileged ||
                (
                    isOwner &&
                    [
                        'Draft',
                        'Submitted',
                        'Closed'
                    ].includes(
                        requestedStatus
                    )
                )
            )
        ) {
            patch.status =
                requestedStatus;
        }

        const request =
            await bridgeRequestsRepo
                .updateRequest(
                    requestId,
                    patch,
                    {
                        expectedUpdatedAt
                    }
                );

        return res.json({
            success: true,
            source: 'supabase',
            request
        });
    } catch (error) {
        console.error(
            'plazaBridgeRequestsSupabaseLite.updateRequest error:',
            error
        );

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to update Plaza request.'
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

        const requestId =
            sanitizeText(
                req.params?.id
            );

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message:
                    'Request id is required.'
            });
        }

        const expectedUpdatedAt = sanitizeText(
            req.body?.expectedUpdatedAt
        );

        if (!expectedUpdatedAt) {
            return res.status(428).json({
                success: false,
                message:
                    'Request version is required. Reload and retry.'
            });
        }

        const current =
            await bridgeRequestsRepo
                .getRequestById(
                    requestId
                );

        if (!current) {
            return res.status(404).json({
                success: false,
                message:
                    'Plaza request not found.'
            });
        }

        const isOwner =
            requestBelongsToViewer(
                current,
                viewer.id
            );

        const canManage =
            viewerCanManageRequest(
                current,
                viewer
            );

        const requestedStatus =
            normalizeRequestStatusLabel(
                req.body?.status ||
                req.body?.nextStatus ||
                req.body?.requestStatus
            );

        const currentStatus =
            normalizeRequestStatusLabel(
                current.status
            ) ||
            'Submitted';

        const nextStatus =
            requestedStatus ||
            getNextRequestStatusLabel(
                currentStatus
            );

        if (
            isOwner &&
            !canManage
        ) {
            if (
                currentStatus !== 'Draft' ||
                nextStatus !== 'Submitted'
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        'Only the assigned Plaza operator or admin can advance this request.'
                });
            }
        } else if (
            !isOwner &&
            !canManage
        ) {
            return res.status(403).json({
                success: false,
                message:
                    'You cannot advance this Plaza request.'
            });
        }

        if (!nextStatus) {
            return res.status(409).json({
                success: false,
                message:
                    'This Plaza request is already at its final status.'
            });
        }

        const allowedTransitions = {
            Draft: [
                'Submitted'
            ],
            Submitted: [
                'Under Review',
                'Closed'
            ],
            'Under Review': [
                'Matched',
                'Closed'
            ],
            Matched: [
                'Conversation Opened',
                'Closed'
            ],
            'Conversation Opened': [
                'Closed'
            ],
            Closed: [
                'Submitted'
            ]
        };

        if (
            !(
                allowedTransitions[
                    currentStatus
                ] || []
            ).includes(
                nextStatus
            )
        ) {
            return res.status(409).json({
                success: false,
                message:
                    `Invalid Plaza request transition: ${currentStatus} → ${nextStatus}.`
            });
        }

        const statusHistory = [
            ...safeArray(
                current.statusHistory
            ),
            {
                from:
                    currentStatus,
                to:
                    nextStatus,
                at:
                    new Date()
                        .toISOString(),
                by:
                    viewer.id,
                byName:
                    viewer.name
            }
        ].slice(-50);

        const request =
            await bridgeRequestsRepo
                .updateRequest(
                    requestId,
                {
                    status:
                        nextStatus,
                    statusHistory,
                    resolvedAt:
                        nextStatus ===
                            'Closed'
                            ? new Date()
                                .toISOString()
                            : '',
                    updatedBy:
                        viewer.id,
                    updatedByName:
                        viewer.name
                },
                {
                    expectedUpdatedAt
                }
            );

        return res.json({
            success: true,
            source: 'supabase',
            request
        });
    } catch (error) {
        console.error(
            'plazaBridgeRequestsSupabaseLite.advanceRequestStatus error:',
            error
        );

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to advance Plaza request status.'
        });
    }
};

exports.deleteRequest = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message:
                    'Missing authenticated user.'
            });
        }

        const requestId = sanitizeText(
            req.params?.id
        );

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message:
                    'Request id is required.'
            });
        }

        const expectedUpdatedAt =
            sanitizeText(
                req.body?.expectedUpdatedAt ||
                req.query?.expectedUpdatedAt
            );

        if (!expectedUpdatedAt) {
            return res.status(428).json({
                success: false,
                message:
                    'Request version is required. Reload and retry.'
            });
        }

        const current =
            await bridgeRequestsRepo
                .getRequestById(
                    requestId
                );

        if (!current) {
            return res.status(404).json({
                success: false,
                message:
                    'Plaza request not found.'
            });
        }

        if (
            !requestBelongsToViewer(
                current,
                viewer.id
            ) &&
            !isPrivilegedPlazaViewer(
                viewer
            )
        ) {
            return res.status(403).json({
                success: false,
                message:
                    'You cannot delete this Plaza request.'
            });
        }

        const request =
            await bridgeRequestsRepo
                .softDeleteRequest(
                    requestId,
                    {
                        expectedUpdatedAt,
                        deletedBy:
                            viewer.id,
                        deletedByName:
                            viewer.name,
                        deleteReason:
                            sanitizeText(
                                req.body?.reason ||
                                'Deleted by request owner.'
                            )
                    }
                );

        return res.json({
            success: true,
            source: 'supabase',
            deletedId:
                requestId,
            request
        });
    } catch (error) {
        console.error(
            'plazaBridgeRequestsSupabaseLite.deleteRequest error:',
            error
        );

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to delete Plaza request.'
        });
    }
};
