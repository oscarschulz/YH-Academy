const meetupsRepo = require('../backend/repositories/plazaMeetupsSupabaseRepo');

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

function buildMeetupPayloadFromRequest(req = {}, viewer = {}) {
    const body = req.body || {};
    const now = new Date().toISOString();

    const title = clampText(
        body.title ||
        body.name ||
        body.subject ||
        'Plaza meetup',
        160
    );

    return {
        ...body,
        id: sanitizeText(body.id || ''),
        title,
        name: clampText(body.name || title, 160),
        description: clampText(body.description || body.summary || body.body || body.text, 1800),
        summary: clampText(body.summary || body.description || body.body || body.text, 600),

        meetupType: clampText(body.meetupType || body.type || 'community', 120, 'community'),
        format: clampText(body.format || body.meetingFormat || 'online', 80, 'online'),
        location: clampText(body.location || body.venue || '', 220),
        meetingUrl: clampText(body.meetingUrl || body.url || body.link || '', 1000),
        region: clampText(body.region || 'Global', 120, 'Global') || 'Global',

        startAt: body.startAt || body.startsAt || body.date || body.scheduledAt || '',
        endAt: body.endAt || body.endsAt || '',

        hostId: sanitizeText(body.hostId || body.authorId || viewer.id),
        hostFirebaseUid: sanitizeText(body.hostFirebaseUid || body.firebaseUid || viewer.firebaseUid || viewer.id),
        hostEmail: sanitizeText(body.hostEmail || body.authorEmail || viewer.email).toLowerCase(),
        hostName: sanitizeText(body.hostName || body.authorName || viewer.name),

        attendees: safeArray(body.attendees),
        attendeeCount: Number.isFinite(Number(body.attendeeCount))
            ? Number(body.attendeeCount)
            : safeArray(body.attendees).length,

        patronStatus: sanitizeText(body.patronStatus || body.patronReviewStatus || 'none'),
        status: sanitizeText(body.status || 'active'),
        reviewStatus: sanitizeText(body.reviewStatus || body.status || 'active'),
        tags: safeArray(body.tags),

        createdAt: body.createdAt || now,
        updatedAt: now
    };
}

exports.getMeetups = async (req, res) => {
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

        const meetups = await meetupsRepo.listMeetups(limit);

        return res.json({
            success: true,
            source: 'supabase',
            meetups,
            meetupCount: meetups.length
        });
    } catch (error) {
        console.error('plazaMeetupsSupabaseLite.getMeetups error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to load Plaza meetups.'
        });
    }
};

exports.createMeetup = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const payload = buildMeetupPayloadFromRequest(req, viewer);

        if (!payload.title) {
            return res.status(400).json({
                success: false,
                message: 'Meetup title is required.'
            });
        }

        const meetup = await meetupsRepo.createMeetup(payload);

        return res.status(201).json({
            success: true,
            source: 'supabase',
            meetup
        });
    } catch (error) {
        console.error('plazaMeetupsSupabaseLite.createMeetup error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to create Plaza meetup.'
        });
    }
};

exports.updatePatronMeetupStatus = async (req, res) => {
    try {
        const viewer = getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message: 'Missing authenticated user.'
            });
        }

        const meetupId = sanitizeText(req.params?.id);
        const patronStatus = sanitizeText(
            req.body?.patronStatus ||
            req.body?.status ||
            req.body?.reviewStatus ||
            'none'
        );

        if (!meetupId) {
            return res.status(400).json({
                success: false,
                message: 'Meetup id is required.'
            });
        }

        const meetup = await meetupsRepo.updatePatronMeetupStatus(meetupId, patronStatus, {
            patronReviewedBy: viewer.id,
            patronReviewedByName: viewer.name,
            patronReviewedAt: new Date().toISOString()
        });

        return res.json({
            success: true,
            source: 'supabase',
            meetup
        });
    } catch (error) {
        console.error('plazaMeetupsSupabaseLite.updatePatronMeetupStatus error:', error);

        return res.status(500).json({
            success: false,
            source: 'supabase',
            message: error?.message || 'Failed to update Plaza meetup patron status.'
        });
    }
};
