const publicLandingEventsRepo = require('../backend/repositories/publicLandingEventsRepo');

exports.getLandingFeed = async (req, res) => {
    try {
        const limit = Number.parseInt(req.query.limit, 10) || 24;
        const payload = await publicLandingEventsRepo.buildPublicLandingSnapshot(limit);

        return res.json({
            success: true,
            ...payload
        });
    } catch (error) {
        console.error('publicLandingController.getLandingFeed error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load public landing feed.'
        });
    }
};