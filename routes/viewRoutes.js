const express = require('express');
const path = require('path');
const router = express.Router();

// I-serve ang Apply/Login Page (Ang pinaka-homepage)
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/apply.html'));
});

// I-serve ang Dashboard Page
router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

module.exports = router;