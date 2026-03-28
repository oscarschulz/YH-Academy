const express = require('express');
const path = require('path');
const router = express.Router();
const aiNurtureGate = require('../backend/middlewares/aiNurtureGate');

// I-serve ang Apply/Login Page (Ang pinaka-homepage)
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/apply.html'));
});

// I-serve ang Dashboard Page
router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Hidden internal AI nurture console
router.get('/internal/ai-nurture/:gate', aiNurtureGate, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/internal/ai-nurture.html'));
});

module.exports = router;