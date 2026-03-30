const jwt = require('jsonwebtoken');

function parseCookies(req) {
    const raw = req.headers.cookie || '';
    const out = {};

    raw.split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return;

        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();

        if (!key) return;
        out[key] = decodeURIComponent(value);
    });

    return out;
}

module.exports = (req, res, next) => {
    const headerToken = req.header('Authorization');
    const cookies = parseCookies(req);
    const cookieToken = cookies.yh_auth_token || '';

    const rawToken = headerToken
        ? headerToken.replace('Bearer ', '').trim()
        : String(cookieToken || '').trim();

    if (!rawToken) {
        return res.status(401).json({
            success: false,
            message: "Access Denied. No Gate Pass provided."
        });
    }

    try {
        const verified = jwt.verify(rawToken, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: "Invalid or Expired Gate Pass."
        });
    }
};