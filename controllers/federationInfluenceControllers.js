const federationInfluenceRepo = require(
    '../backend/repositories/federationInfluenceSupabaseRepo'
);

function cleanText(
    value,
    fallback = ''
) {
    if (
        value === null ||
        value === undefined
    ) {
        return fallback;
    }

    return String(value).trim();
}

function getViewerFromRequest(req = {}) {
    const user =
        req.user || {};

    return {
        id:
            cleanText(
                user.id ||
                user.firebaseUid ||
                user.uid
            ),

        email:
            cleanText(
                user.email
            ).toLowerCase(),

        username:
            cleanText(
                user.username
            ),

        name:
            cleanText(
                user.name ||
                user.fullName ||
                user.displayName ||
                user.username ||
                'YH Member'
            )
    };
}

exports.getMyInfluenceLedger = async (
    req,
    res
) => {
    try {
        const viewer =
            getViewerFromRequest(
                req
            );

        if (!viewer.id) {
            return res
                .status(401)
                .json({
                    success: false,
                    message:
                        'Missing authenticated user.'
                });
        }

        const limit =
            Math.min(
                Math.max(
                    Number.parseInt(
                        req.query.limit,
                        10
                    ) || 50,
                    1
                ),
                200
            );

        const snapshot =
            await federationInfluenceRepo
                .getUserLedgerSnapshot(
                    viewer.id,
                    {
                        limit
                    }
                );

        return res.json({
            success: true,
            source: 'supabase',
            division: 'federation',

            profile:
                snapshot.profile,

            influence:
                snapshot.profile,

            events:
                snapshot.events,

            eventCount:
                snapshot.eventCount,

            fetchedAt:
                snapshot.fetchedAt
        });
    } catch (error) {
        console.error(
            'federationInfluence.getMyInfluenceLedger error:',
            error
        );

        return res
            .status(
                Number(
                    error?.status ||
                    error?.statusCode
                ) || 500
            )
            .json({
                success: false,
                source: 'supabase',

                message:
                    error?.message ||
                    'Failed to load Federation Influence.'
            });
    }
};