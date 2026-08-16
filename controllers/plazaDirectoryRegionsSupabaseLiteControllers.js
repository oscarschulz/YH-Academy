const directoryRegionsRepo = require('../backend/repositories/plazaDirectoryRegionsSupabaseRepo');

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
        id: sanitizeText(
            user.id ||
            user.firebaseUid ||
            user.uid
        ),
        firebaseUid: sanitizeText(
            user.firebaseUid ||
            user.id ||
            user.uid
        ),
        email: sanitizeText(
            user.email
        ).toLowerCase(),
        username: sanitizeText(
            user.username
        ),
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
            Array.isArray(
                user.adminRoles
            )
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

function buildDirectoryPayloadFromRequest(
    req = {},
    viewer = {}
) {
    const body = req.body || {};
    const now =
        new Date().toISOString();

    const isPrivileged =
        isPrivilegedPlazaViewer(
            viewer
        );

    const requestedDivision =
        sanitizeText(
            body.division
        ).toLowerCase();

    const requestedTrust =
        sanitizeText(
            body.trust
        ).toLowerCase();

    return {
        id: viewer.id,
        userId: viewer.id,
        firebaseUid:
            viewer.firebaseUid ||
            viewer.id,
        email: viewer.email,
        username: viewer.username,

        name: clampText(
            body.name ||
            body.fullName ||
            body.displayName ||
            viewer.name,
            120,
            viewer.name ||
            'YH Member'
        ),

        headline: clampText(
            body.headline ||
            body.title ||
            body.role ||
            body.specialty ||
            'Plaza Member',
            180
        ),

        bio: clampText(
            body.bio ||
            body.about ||
            body.description ||
            body.summary ||
            body.focus,
            1500
        ),

        focus: clampText(
            body.focus ||
            body.bio ||
            body.about ||
            body.description,
            1500
        ),

        region: clampText(
            body.region ||
            body.location ||
            'Global',
            120,
            'Global'
        ) || 'Global',

        avatarUrl: clampText(
            body.avatarUrl ||
            body.photoURL ||
            body.profilePhotoUrl,
            1000
        ),

        role: clampText(
            body.role ||
            body.memberRole ||
            'member',
            80,
            'member'
        ),

        division:
            isPrivileged &&
            [
                'academy',
                'federation',
                'both'
            ].includes(
                requestedDivision
            )
                ? requestedDivision
                : '',

        source: 'plaza',

        trust:
            isPrivileged &&
            [
                'verified',
                'connector',
                'leader'
            ].includes(
                requestedTrust
            )
                ? requestedTrust
                : '',

        canManageDirectoryAuthority:
            isPrivileged,

        availability: clampText(
            body.availability,
            80
        ),

        workMode: clampText(
            body.workMode,
            80
        ),

        marketplaceMode: clampText(
            body.marketplaceMode ||
            'no',
            20,
            'no'
        ),

        lookingFor:
            safeArray(
                body.lookingFor
            ),

        canOffer:
            safeArray(
                body.canOffer
            ),

        skills:
            safeArray(
                body.skills
            ),

        services:
            safeArray(
                body.services
            ),

        tags:
            safeArray(
                body.tags
            ),

        status: 'active',
        reviewStatus: 'active',
        createdAt: now,
        updatedAt: now
    };
}

function buildRegionPayloadFromRequest(
    req = {},
    viewer = {}
) {
    const body = req.body || {};
    const now =
        new Date().toISOString();

    const name = clampText(
        body.name ||
        body.title ||
        body.region ||
        body.label,
        140
    );

    const slug = clampText(
        body.slug ||
        name
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                '-'
            )
            .replace(
                /^-+|-+$/g,
                ''
            ),
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
        name,
        slug,

        title: clampText(
            body.title ||
            body.label ||
            name,
            140
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

        country: clampText(
            body.country,
            120
        ),

        city: clampText(
            body.city,
            120
        ),

        region: clampText(
            body.region ||
            name ||
            'Global',
            140,
            'Global'
        ) || 'Global',

        memberCount: 0,

        tags:
            safeArray(
                body.tags
            ),

        authorId:
            viewer.id,

        authorFirebaseUid:
            viewer.firebaseUid ||
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
            await directoryRegionsRepo
                .listDirectory({
                    limit,
                    cursor
                });

        const publicItems =
            page.items.map(
                (profile) =>
                    directoryRegionsRepo
                        .toPublicDirectoryProfile(
                            profile
                        )
            );

        return res.json({
            success: true,
            source: 'supabase',

            directory:
                publicItems,

            profiles:
                publicItems,

            members:
                publicItems,

            directoryCount:
                publicItems.length,

            hasMore:
                page.hasMore === true,

            nextCursor:
                page.nextCursor ||
                '',

            fetchedAt:
                new Date()
                    .toISOString()
        });
    } catch (error) {
        console.error(
            'plazaDirectoryRegionsSupabaseLite.getDirectory error:',
            error
        );

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to load Plaza directory.'
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

        const expectedUpdatedAt =
            sanitizeText(
                req.body?.expectedUpdatedAt
            );

        const payload =
            buildDirectoryPayloadFromRequest(
                req,
                viewer
            );

        const profile =
            await directoryRegionsRepo
                .upsertDirectoryProfile(
                    payload,
                    {
                        expectedUpdatedAt
                    }
                );

        return res.status(200).json({
            success: true,
            source: 'supabase',
            profile,
            directoryProfile: profile
        });
    } catch (error) {
        console.error('plazaDirectoryRegionsSupabaseLite.upsertDirectoryProfile error:', error);

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to save Plaza directory profile.'
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
            await directoryRegionsRepo
                .listRegions({
                    limit,
                    cursor
                });

        return res.json({
            success: true,
            source: 'supabase',
            regions:
                page.items,
            regionCount:
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
            'plazaDirectoryRegionsSupabaseLite.getRegions error:',
            error
        );

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message:
                error?.message ||
                'Failed to load Plaza regions.'
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

        const payload =
            buildRegionPayloadFromRequest(
                req,
                viewer
            );

        if (!payload.clientCreateId) {
            return res.status(400).json({
                success: false,
                message: 'Client create id is required.'
            });
        }

        if (!payload.name) {
            return res.status(400).json({
                success: false,
                message: 'Region name is required.'
            });
        }

        const result =
            await directoryRegionsRepo
                .createRegion(
                    payload
                );

        const region = result.region;

        const published =
            [
                'active',
                'approved',
                'published',
                'verified'
            ].includes(
                sanitizeText(
                    region?.status
                ).toLowerCase()
            ) &&
            [
                'active',
                'approved',
                'published',
                'verified'
            ].includes(
                sanitizeText(
                    region?.reviewStatus
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
            region
        });
    } catch (error) {
        console.error('plazaDirectoryRegionsSupabaseLite.createRegion error:', error);

        return res.status(
            Number(error?.status) || 500
        ).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Plaza region.'
        });
    }
};
