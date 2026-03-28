const crypto = require('crypto');

function sanitize(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
}

function safeEqual(a, b) {
    const aBuf = Buffer.from(String(a || ''), 'utf8');
    const bBuf = Buffer.from(String(b || ''), 'utf8');

    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

module.exports = function aiNurtureGate(req, res, next) {
    const gateEnabled = String(process.env.AI_NURTURE_GATE_ENABLED || 'true').trim().toLowerCase() !== 'false';
    const expected = sanitize(process.env.AI_NURTURE_GATE_TOKEN);
    const provided = sanitize(req.params?.gate);

    if (!gateEnabled) {
        return res.status(404).send('Not Found');
    }

    if (!expected || !provided || !safeEqual(provided, expected)) {
        return res.status(404).send('Not Found');
    }

    next();
};