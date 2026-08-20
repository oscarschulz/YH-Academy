const meetupsRepo = require('../backend/repositories/plazaMeetupsSupabaseRepo');
const patronRepo = require('../backend/repositories/plazaPatronSupabaseRepo');
const regionsRepo = require('../backend/repositories/plazaDirectoryRegionsSupabaseRepo');

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

async function getApprovedPatronApplication(
    viewer = {}
) {
    const application =
        await patronRepo
            .getApplicationForUser(
                viewer
            );

    const status =
        sanitizeText(
            application?.status ||
            application?.reviewStatus
        )
            .toLowerCase()
            .replace(
                /[-_]+/g,
                ' '
            );

    return status === 'approved'
        ? application
        : null;
}

function viewerOwnsMeetup(
    meetup = {},
    viewer = {}
) {
    const viewerIds =
        new Set(
            [
                viewer.id,
                viewer.firebaseUid
            ]
                .map(sanitizeText)
                .filter(Boolean)
        );

    const ownerIds =
        [
            meetup.hostId,
            meetup.hostFirebaseUid,
            meetup.raw?.hostId,
            meetup.raw?.hostFirebaseUid
        ]
            .map(sanitizeText)
            .filter(Boolean);

    return ownerIds.some(
        (id) =>
            viewerIds.has(id)
    );
}

function toViewerMeetup(
    meetup = {},
    viewer = {}
) {
    return {
        ...meetupsRepo
            .toPublicMeetup(
                meetup
            ),

        canManage:
            viewerOwnsMeetup(
                meetup,
                viewer
            )
    };
}

function buildMeetupPayloadFromRequest(
    req = {},
    viewer = {}
) {
    const body =
        req.body || {};

    const now =
        new Date().toISOString();

    const title =
        clampText(
            body.title ||
            body.name ||
            body.subject ||
            'Plaza meetup',
            160
        );

    /*
     * Meetup ownership and lifecycle metadata
     * are server-owned.
     */
    return {
        id:
            '',

        title,

        name:
            clampText(
                body.name ||
                title,
                160
            ),

        description:
            clampText(
                body.description ||
                body.summary ||
                body.body ||
                body.text,
                1800
            ),

        summary:
            clampText(
                body.summary ||
                body.description ||
                body.body ||
                body.text,
                600
            ),

        meetupType:
            clampText(
                body.meetupType ||
                body.type ||
                'community',
                120,
                'community'
            ),

        format:
            clampText(
                body.format ||
                body.meetingFormat ||
                'online',
                80,
                'online'
            ),

        location:
            clampText(
                body.location ||
                body.venue ||
                '',
                220
            ),

        meetingUrl:
            clampText(
                body.meetingUrl ||
                body.url ||
                body.link ||
                '',
                1000
            ),

        region:
            clampText(
                body.region ||
                'Global',
                120,
                'Global'
            ) || 'Global',

        startAt:
            body.startAt ||
            body.startsAt ||
            body.date ||
            body.scheduledAt ||
            '',

        endAt:
            body.endAt ||
            body.endsAt ||
            '',

        hostId:
            viewer.id,

        hostFirebaseUid:
            viewer.firebaseUid ||
            viewer.id,

        hostEmail:
            viewer.email,

        hostName:
            viewer.name,

        attendees:
            [
                viewer.name
            ].filter(Boolean),

        attendeeCount:
            1,

        patronStatus:
            'none',

        status:
            'planned',

        reviewStatus:
            'active',

        tags:
            safeArray(
                body.tags
            ),

        createdAt:
            now,

        updatedAt:
            now
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

        const meetups =
            await meetupsRepo
                .listMeetups(
                    limit
                );

        const publicMeetups =
            meetups.map(
                (meetup) =>
                    toViewerMeetup(
                        meetup,
                        viewer
                    )
            );

        return res.json({
            success: true,
            source: 'supabase',
            meetups:
                publicMeetups,
            meetupCount:
                publicMeetups.length
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

        const requestedRegionId =
            sanitizeText(
                req.body?.regionId
            );

        if (!requestedRegionId) {
            return res.status(400).json({
                success: false,
                message:
                    'Plaza region is required.'
            });
        }

        const regionRecord =
            await regionsRepo
                .getRegionById(
                    requestedRegionId
                );

        if (!regionRecord) {
            return res.status(404).json({
                success: false,
                message:
                    'Active Plaza region not found.'
            });
        }

        const payload =
            buildMeetupPayloadFromRequest(
                req,
                viewer
            );

        /*
         * Meetup region identity is server-owned.
         * The browser provides only the selected
         * region id.
         */
        payload.regionId =
            sanitizeText(
                regionRecord.id ||
                requestedRegionId
            );

        payload.region =
            sanitizeText(
                regionRecord.region ||
                regionRecord.name ||
                regionRecord.title ||
                'Global'
            ) || 'Global';

        if (!payload.title) {
            return res.status(400).json({
                success: false,
                message: 'Meetup title is required.'
            });
        }

        const meetup = await meetupsRepo.createMeetup(payload);

        return res.status(201).json({
            success: true,
            source:
                'supabase',

            meetup:
                toViewerMeetup(
                    meetup,
                    viewer
                )
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

exports.updateMeetup = async (
    req,
    res
) => {
    try {
        const viewer =
            getViewerFromRequest(req);

        const meetupId =
            sanitizeText(
                req.params?.id
            );

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message:
                    'Missing authenticated user.'
            });
        }

        if (!meetupId) {
            return res.status(400).json({
                success: false,
                message:
                    'Meetup id is required.'
            });
        }

        const currentMeetup =
            await meetupsRepo
                .getMeetupById(
                    meetupId
                );

        if (!currentMeetup) {
            return res.status(404).json({
                success: false,
                message:
                    'Plaza meetup not found.'
            });
        }

        /*
         * Never rely on the frontend's canManage flag.
         * Ownership is independently verified here.
         */
        if (
            !viewerOwnsMeetup(
                currentMeetup,
                viewer
            )
        ) {
            return res.status(403).json({
                success: false,
                message:
                    'Only the meetup creator can edit this meetup.'
            });
        }

        /*
         * Concurrency token is server-owned.
         * The client does not decide which Meetup
         * version may be written.
         */
        const expectedUpdatedAt =
            sanitizeText(
                currentMeetup.version ||
                currentMeetup.updatedAt
            );

        const requestedRegionId =
            sanitizeText(
                req.body?.regionId
            );

        if (!requestedRegionId) {
            return res.status(400).json({
                success: false,
                message:
                    'Plaza region is required.'
            });
        }

        const regionRecord =
            await regionsRepo
                .getRegionById(
                    requestedRegionId
                );

        if (!regionRecord) {
            return res.status(404).json({
                success: false,
                message:
                    'Active Plaza region not found.'
            });
        }

        const title =
            clampText(
                req.body?.title,
                160
            );

        const description =
            clampText(
                req.body?.description,
                1800
            );

        const location =
            clampText(
                req.body?.location,
                220
            );

        const scheduledAt =
            sanitizeText(
                req.body?.scheduledAt ||
                req.body?.startAt
            );

        const requestedFormat =
            sanitizeText(
                req.body?.format ||
                currentMeetup.format ||
                'in-person'
            )
                .toLowerCase();

        const format =
            [
                'in-person',
                'online',
                'hybrid'
            ].includes(
                requestedFormat
            )
                ? requestedFormat
                : 'in-person';

        if (
            !title ||
            !description ||
            !location ||
            !scheduledAt
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Complete the meetup details first.'
            });
        }

        if (
            Number.isNaN(
                new Date(
                    scheduledAt
                ).getTime()
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'Meetup date and time is invalid.'
            });
        }

        /*
         * Only fields the meetup creator is actually
         * allowed to edit are written here.
         *
         * Host identity, attendees, Patron state,
         * lifecycle state and createdAt are preserved.
         */
        const meetup =
            await meetupsRepo
                .updateMeetup(
                    meetupId,
                    {
                        title,

                        name:
                            title,

                        description,

                        summary:
                            description.slice(
                                0,
                                600
                            ),

                        format,

                        location,

                        regionId:
                            sanitizeText(
                                regionRecord.id ||
                                requestedRegionId
                            ),

                        region:
                            sanitizeText(
                                regionRecord.region ||
                                regionRecord.name ||
                                regionRecord.title ||
                                'Global'
                            ) || 'Global',

                        startAt:
                            scheduledAt
                    },
                    {
                        expectedUpdatedAt
                    }
                );

        return res.json({
            success: true,
            source:
                'supabase',

            meetup:
                toViewerMeetup(
                    meetup,
                    viewer
                )
        });
    } catch (error) {
        console.error(
            'plazaMeetupsSupabaseLite.updateMeetup error:',
            error
        );

        return res.status(
            Number(
                error?.statusCode ||
                error?.status
            ) || 500
        ).json({
            success: false,
            source:
                'supabase',
            message:
                error?.message ||
                'Failed to update Plaza meetup.'
        });
    }
};

exports.deleteMeetup = async (
    req,
    res
) => {
    try {
        const viewer =
            getViewerFromRequest(req);

        const meetupId =
            sanitizeText(
                req.params?.id
            );

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message:
                    'Missing authenticated user.'
            });
        }

        if (!meetupId) {
            return res.status(400).json({
                success: false,
                message:
                    'Meetup id is required.'
            });
        }

        const currentMeetup =
            await meetupsRepo
                .getMeetupById(
                    meetupId
                );

        if (!currentMeetup) {
            return res.status(404).json({
                success: false,
                message:
                    'Plaza meetup not found.'
            });
        }

        if (
            !viewerOwnsMeetup(
                currentMeetup,
                viewer
            )
        ) {
            return res.status(403).json({
                success: false,
                message:
                    'Only the meetup creator can delete this meetup.'
            });
        }

        /*
         * Use the version of the Meetup that was
         * loaded and ownership-checked on the server.
         */
        const expectedUpdatedAt =
            sanitizeText(
                currentMeetup.version ||
                currentMeetup.updatedAt
            );

        await meetupsRepo
            .softDeleteMeetup(
                meetupId,
                {
                    deletedBy:
                        viewer.id,

                    deletedByName:
                        viewer.name,

                    deletedAt:
                        new Date()
                            .toISOString()
                },
                {
                    expectedUpdatedAt
                }
            );

        return res.json({
            success: true,
            source:
                'supabase',
            deleted:
                true,
            meetupId
        });
    } catch (error) {
        console.error(
            'plazaMeetupsSupabaseLite.deleteMeetup error:',
            error
        );

        return res.status(
            Number(
                error?.statusCode ||
                error?.status
            ) || 500
        ).json({
            success: false,
            source:
                'supabase',
            message:
                error?.message ||
                'Failed to delete Plaza meetup.'
        });
    }
};

exports.updatePatronMeetupStatus = async (
    req,
    res
) => {
    try {
        const viewer =
            getViewerFromRequest(req);

        if (!viewer.id) {
            return res.status(401).json({
                success: false,
                message:
                    'Missing authenticated user.'
            });
        }

        const meetupId =
            sanitizeText(
                req.params?.id
            );

        if (!meetupId) {
            return res.status(400).json({
                success: false,
                message:
                    'Meetup id is required.'
            });
        }

        const patronApplication =
            await getApprovedPatronApplication(
                viewer
            );

        if (!patronApplication) {
            return res.status(403).json({
                success: false,
                message:
                    'Only approved Plaza Patrons can update Patron meetup status.'
            });
        }

        const currentMeetup =
            await meetupsRepo
                .getMeetupById(
                    meetupId
                );

        if (!currentMeetup) {
            return res.status(404).json({
                success: false,
                message:
                    'Plaza meetup not found.'
            });
        }

        const permittedPatronIds =
            [
                currentMeetup.hostId,
                currentMeetup.raw
                    ?.officialPatronUserId,
                currentMeetup.raw
                    ?.patronUserId
            ]
                .map(sanitizeText)
                .filter(Boolean);

        if (
            !permittedPatronIds.includes(
                viewer.id
            ) &&
            !permittedPatronIds.includes(
                viewer.firebaseUid
            )
        ) {
            return res.status(403).json({
                success: false,
                message:
                    'This meetup is not assigned to you as Plaza Patron.'
            });
        }

        const patronStatus =
            clampText(
                req.body?.patronStatus ||
                req.body?.status ||
                req.body?.reviewStatus ||
                'none',
                80,
                'none'
            );

        const meetup =
            await meetupsRepo
                .updatePatronMeetupStatus(
                    meetupId,
                    patronStatus,
                    {
                        patronReviewedBy:
                            viewer.id,
                        patronReviewedByName:
                            viewer.name,
                        patronReviewedAt:
                            new Date()
                                .toISOString()
                    }
                );

        return res.json({
            success: true,
            source:
                'supabase',
            meetup:
                meetupsRepo
                    .toPublicMeetup(
                        meetup
                    )
        });
    } catch (error) {
        console.error(
            'plazaMeetupsSupabaseLite.updatePatronMeetupStatus error:',
            error
        );

        return res.status(
            Number(
                error?.statusCode ||
                error?.status
            ) || 500
        ).json({
            success: false,
            source:
                'supabase',
            message:
                error?.message ||
                'Failed to update Plaza meetup patron status.'
        });
    }
};
