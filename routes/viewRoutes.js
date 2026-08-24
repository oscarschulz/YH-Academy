const express = require('express');
const path = require('path');
const router = express.Router();
const aiNurtureGate = require('../backend/middlewares/aiNurtureGate');

// I-serve ang Apply/Login Page (Ang pinaka-homepage)
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/apply.html'));
});

function renderAiNurtureAccessPage(
    res
) {
    return res
        .status(200)
        .type('html')
        .send(`<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta
        name="viewport"
        content="width=device-width,initial-scale=1"
    >
    <meta
        name="robots"
        content="noindex,nofollow,noarchive"
    >
    <title>AI Nurture Internal Access</title>

    <style>
        :root {
            color-scheme: dark;
            font-family:
                Inter,
                system-ui,
                sans-serif;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #090b0f;
            color: #f5f7fa;
        }

        .card {
            width: min(420px, calc(100vw - 32px));
            padding: 28px;
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 18px;
            background: #11151b;
        }

        h1 {
            margin: 0 0 8px;
            font-size: 22px;
        }

        p {
            margin: 0 0 20px;
            color: #aeb7c4;
            line-height: 1.5;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-size: 13px;
            font-weight: 700;
        }

        input {
            width: 100%;
            min-height: 46px;
            padding: 0 12px;
            border: 1px solid rgba(255,255,255,.14);
            border-radius: 10px;
            background: #090b0f;
            color: #fff;
        }

        button {
            width: 100%;
            min-height: 46px;
            margin-top: 14px;
            border: 0;
            border-radius: 10px;
            font-weight: 800;
            cursor: pointer;
        }
    </style>
</head>

<body>
    <main class="card">
        <h1>AI Nurture</h1>

        <p>
            Enter the internal access token.
            The token is submitted securely and
            is not stored in the page URL.
        </p>

        <form
            method="post"
            action="/internal/ai-nurture/session"
            autocomplete="off"
        >
            <label for="gate">
                Internal access token
            </label>

            <input
                id="gate"
                name="gate"
                type="password"
                required
                autocomplete="current-password"
            >

            <button type="submit">
                Continue
            </button>
        </form>
    </main>
</body>
</html>`);
}

/*
 * Clean internal console URL.
 */
router.get(
    '/internal/ai-nurture',
    (req, res) => {
        if (
            !aiNurtureGate
                .isGateEnabled()
        ) {
            return res
                .status(404)
                .send('Not Found');
        }

        if (
            !aiNurtureGate
                .hasValidSession(req)
        ) {
            return renderAiNurtureAccessPage(
                res
            );
        }

        return res.sendFile(
            path.join(
                __dirname,
                '../public/internal/ai-nurture.html'
            )
        );
    }
);

/*
 * Exchange the secret from a POST body for
 * an HttpOnly short-lived session cookie.
 */
router.post(
    '/internal/ai-nurture/session',

    express.urlencoded({
        extended: false,
        limit: '4kb'
    }),

    (req, res) => {
        if (
            !aiNurtureGate
                .isGateEnabled()
        ) {
            return res
                .status(404)
                .send('Not Found');
        }

        if (
            !aiNurtureGate
                .verifyProvidedGate(
                    req.body?.gate
                )
        ) {
            return res
                .status(401)
                .type('html')
                .send(
                    '<!doctype html><title>Access denied</title><p>Access denied.</p><p><a href="/internal/ai-nurture">Try again</a></p>'
                );
        }

        if (
            !aiNurtureGate
                .setSessionCookie(res)
        ) {
            return res
                .status(500)
                .send(
                    'Unable to create internal session.'
                );
        }

        return res.redirect(
            303,
            '/internal/ai-nurture'
        );
    }
);

router.post(
    '/internal/ai-nurture/logout',
    (req, res) => {
        aiNurtureGate
            .clearSessionCookie(res);

        return res.redirect(
            303,
            '/internal/ai-nurture'
        );
    }
);

module.exports = router;