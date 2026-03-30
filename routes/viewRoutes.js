const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const router = express.Router();
const aiNurtureGate = require('../backend/middlewares/aiNurtureGate');

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

function requireUserSession(req, res, next) {
    const cookies = parseCookies(req);
    const token = String(cookies.yh_auth_token || '').trim();

    if (!token) {
        return res.redirect('/');
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (_) {
        return res.redirect('/');
    }
}

// I-serve ang Apply/Login Page (Ang pinaka-homepage)
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/apply.html'));
});

// I-serve ang Dashboard Page
router.get('/dashboard', requireUserSession, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Hidden internal AI nurture console
router.get('/internal/ai-nurture/:gate', aiNurtureGate, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/internal/ai-nurture.html'));
});

module.exports = router;