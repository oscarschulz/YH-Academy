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

function buildDirectoryPayloadFromRequest(req = {}, viewer = {}) {
    const body = req.body || {};
    const now = new Date().toISOString();

    return {
        ...body,
        id: sanitizeText(body.id || body.userId || body.firebaseUid || viewer.id),
        userId: sanitizeText(body.userId || body.firebaseUid || viewer.id),
        firebaseUid: sanitizeText(body.firebaseUid || viewer.firebaseUid || viewer.id),
        email: sanitizeText(body.email || viewer.email).toLowerCase(),
        username: sanitizeText(body.username || viewer.username),
        name: clampText(
            body.name ||
            body.fullName ||
            body.displayName ||
            viewer.name,
            120,
            viewer.name || 'YH Member'
        ),
        headline: clampText(
            body.headline ||
            body.title ||
            body.role ||
            body.specialty ||
            'Plaza Member',
            180
        ),
        bio: clampText(body.bio || body.about || body.description || body.summary, 1500),
        region: clampText(body.region || body.location || 'Global', 120, 'Global') || 'Global',
        avatarUrl: clampText(body.avatarUrl || body.photoURL || body.profilePhotoUrl, 1000),
        role: clampText(body.role || body.memberRole || 'member', 80, 'member'),
        skills: safeArray(body.skills),
        services: safeArray(body.services),
        tags: safeArray(body.tags),
        status: sanitizeText(body.status || 'active'),
        reviewStatus: sanitizeText(body.reviewStatus || body.status || 'active'),
        createdAt: body.createdAt || now,
        updatedAt: now
    };
}

function buildRegionPayloadFromRequest(req = {}) {
    const body = req.body || {};
    const now = new Date().toISOString();

    const name = clampText(
        body.name ||
        body.title ||
        body.region ||
        body.label,
        140
    );

    const slug = clampText(
        body.slug ||
        name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        160
    );

    return {
        ...body,
        id: sanitizeText(body.id || slug),
        name,
        slug,
        title: clampText(body.title || name, 140),
        description: clampText(body.description || body.summary || body.body, 1600),
        summary: clampText(body.summary || body.description || body.body, 600),
        country: clampText(body.country, 120),
        city: clampText(body.city, 120),
        region: clampText(body.region || name || 'Global', 140, 'Global') || 'Global',
        memberCount: Number.isFinite(Number(body.memberCount)) ? Number(body.memberCount) : 0,
        tags: safeArray(body.tags),
        status: sanitizeText(body.status || 'active'),
        reviewStatus: sanitizeText(body.reviewStatus || body.status || 'active'),
        createdAt: body.createdAt || now,
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
            Math.max(parseInt(req.query.limit, 10) || 80, 1),
            160
        );

        const directory = await directoryRegionsRepo.listDirectory(limit);

        return res.json({
            success: true,
            source: 'supabase',
            directory,
            profiles: directory,
            members: directory,
            directoryCount: directory.length
        });
    } catch (error) {
        console.error('plazaDirectoryRegionsSupabaseLite.getDirectory error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to load Plaza directory.'
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

        const payload = buildDirectoryPayloadFromRequest(req, viewer);
        const profile = await directoryRegionsRepo.upsertDirectoryProfile(payload);

        return res.status(200).json({
            success: true,
            source: 'supabase',
            profile,
            directoryProfile: profile
        });
    } catch (error) {
        console.error('plazaDirectoryRegionsSupabaseLite.upsertDirectoryProfile error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to save Plaza directory profile.'
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

        const regions = await directoryRegionsRepo.listRegions(limit);

        return res.json({
            success: true,
            source: 'supabase',
            regions,
            regionCount: regions.length
        });
    } catch (error) {
        console.error('plazaDirectoryRegionsSupabaseLite.getRegions error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to load Plaza regions.'
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

        const payload = buildRegionPayloadFromRequest(req);

        if (!payload.name) {
            return res.status(400).json({
                success: false,
                message: 'Region name is required.'
            });
        }

        const region = await directoryRegionsRepo.createRegion(payload);

        return res.status(201).json({
            success: true,
            source: 'supabase',
            region
        });
    } catch (error) {
        console.error('plazaDirectoryRegionsSupabaseLite.createRegion error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Plaza region.'
        });
    }
};
