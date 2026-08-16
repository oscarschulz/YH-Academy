const crypto = require('crypto');

const COOKIE_NAME =
    'yh_ai_nurture_session';

const DEFAULT_SESSION_MS =
    8 * 60 * 60 * 1000;

function sanitize(
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

function safeEqual(a, b) {
    const aBuf =
        Buffer.from(
            String(a || ''),
            'utf8'
        );

    const bBuf =
        Buffer.from(
            String(b || ''),
            'utf8'
        );

    if (
        aBuf.length !==
        bBuf.length
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        aBuf,
        bBuf
    );
}

function isGateEnabled() {
    return (
        String(
            process.env
                .AI_NURTURE_GATE_ENABLED ||
            'true'
        )
            .trim()
            .toLowerCase() !==
        'false'
    );
}

function getExpectedGate() {
    return sanitize(
        process.env
            .AI_NURTURE_GATE_TOKEN
    );
}

function getSessionDurationMs() {
    const configured =
        Number(
            process.env
                .AI_NURTURE_SESSION_MS
        );

    if (
        Number.isFinite(configured) &&
        configured >= 60000 &&
        configured <=
            24 * 60 * 60 * 1000
    ) {
        return Math.trunc(
            configured
        );
    }

    return DEFAULT_SESSION_MS;
}

function parseCookies(req = {}) {
    const raw =
        String(
            req.headers?.cookie ||
            ''
        );

    const cookies = {};

    raw.split(';').forEach(
        (part) => {
            const idx =
                part.indexOf('=');

            if (idx === -1) {
                return;
            }

            const key =
                part
                    .slice(0, idx)
                    .trim();

            const value =
                part
                    .slice(idx + 1)
                    .trim();

            if (!key) {
                return;
            }

            try {
                cookies[key] =
                    decodeURIComponent(
                        value
                    );
            } catch (_) {
                cookies[key] =
                    value;
            }
        }
    );

    return cookies;
}

function getSigningSecret() {
    const gate =
        getExpectedGate();

    if (!gate) {
        return '';
    }

    return crypto
        .createHash('sha256')
        .update(
            [
                'yh-ai-nurture-session-v1',
                gate,
                sanitize(
                    process.env.JWT_SECRET
                )
            ].join('|')
        )
        .digest('hex');
}

function signPayload(
    payload = ''
) {
    const secret =
        getSigningSecret();

    if (!secret) {
        return '';
    }

    return crypto
        .createHmac(
            'sha256',
            secret
        )
        .update(
            String(payload || '')
        )
        .digest('base64url');
}

function createSessionToken() {
    const now =
        Date.now();

    const expiresAt =
        now +
        getSessionDurationMs();

    const nonce =
        crypto
            .randomBytes(16)
            .toString('base64url');

    const payloadObject = {
        v: 1,
        iat: now,
        exp: expiresAt,
        nonce
    };

    const payload =
        Buffer
            .from(
                JSON.stringify(
                    payloadObject
                ),
                'utf8'
            )
            .toString(
                'base64url'
            );

    const signature =
        signPayload(payload);

    return `${payload}.${signature}`;
}

function verifySessionToken(
    token = ''
) {
    const clean =
        sanitize(token);

    const parts =
        clean.split('.');

    if (parts.length !== 2) {
        return false;
    }

    const [
        payload,
        suppliedSignature
    ] = parts;

    const expectedSignature =
        signPayload(payload);

    if (
        !expectedSignature ||
        !safeEqual(
            suppliedSignature,
            expectedSignature
        )
    ) {
        return false;
    }

    let decoded;

    try {
        decoded =
            JSON.parse(
                Buffer
                    .from(
                        payload,
                        'base64url'
                    )
                    .toString(
                        'utf8'
                    )
            );
    } catch (_) {
        return false;
    }

    if (
        Number(decoded?.v) !== 1
    ) {
        return false;
    }

    const issuedAt =
        Number(decoded?.iat);

    const expiresAt =
        Number(decoded?.exp);

    if (
        !Number.isFinite(
            issuedAt
        ) ||
        !Number.isFinite(
            expiresAt
        )
    ) {
        return false;
    }

    if (
        issuedAt >
        Date.now() + 60000
    ) {
        return false;
    }

    if (
        expiresAt <=
        Date.now()
    ) {
        return false;
    }

    if (
        expiresAt - issuedAt >
        24 * 60 * 60 * 1000
    ) {
        return false;
    }

    return true;
}

function verifyProvidedGate(
    provided = ''
) {
    const expected =
        getExpectedGate();

    const cleanProvided =
        sanitize(provided);

    return Boolean(
        isGateEnabled() &&
        expected &&
        cleanProvided &&
        safeEqual(
            cleanProvided,
            expected
        )
    );
}

function hasValidSession(req = {}) {
    if (!isGateEnabled()) {
        return false;
    }

    const cookies =
        parseCookies(req);

    return verifySessionToken(
        cookies[COOKIE_NAME] ||
        ''
    );
}

function getCookieOptions() {
    return {
        httpOnly: true,

        secure:
            process.env.NODE_ENV ===
            'production',

        sameSite:
            'strict',

        path:
            '/',

        maxAge:
            getSessionDurationMs()
    };
}

function setSessionCookie(res) {
    const token =
        createSessionToken();

    if (!token) {
        return false;
    }

    res.cookie(
        COOKIE_NAME,
        token,
        getCookieOptions()
    );

    return true;
}

function clearSessionCookie(res) {
    res.clearCookie(
        COOKIE_NAME,
        {
            httpOnly: true,

            secure:
                process.env.NODE_ENV ===
                'production',

            sameSite:
                'strict',

            path:
                '/'
        }
    );
}

function aiNurtureGate(
    req,
    res,
    next
) {
    if (
        !isGateEnabled()
    ) {
        return res
            .status(404)
            .send('Not Found');
    }

    if (
        !hasValidSession(req)
    ) {
        return res
            .status(404)
            .send('Not Found');
    }

    req.aiNurtureAuthorized =
        true;

    next();
}

aiNurtureGate.COOKIE_NAME =
    COOKIE_NAME;

aiNurtureGate.isGateEnabled =
    isGateEnabled;

aiNurtureGate.verifyProvidedGate =
    verifyProvidedGate;

aiNurtureGate.hasValidSession =
    hasValidSession;

aiNurtureGate.setSessionCookie =
    setSessionCookie;

aiNurtureGate.clearSessionCookie =
    clearSessionCookie;

module.exports =
    aiNurtureGate;