const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Kunin ang token mula sa header ng request
    const token = req.header('Authorization');

    // Kung walang hawak na token, sipain agad!
    if (!token) {
        return res.status(401).json({ success: false, message: "Access Denied. No Gate Pass provided." });
    }

    try {
        // Tanggalin ang salitang "Bearer " kung meron, tapos i-verify gamit ang Secret Key natin
        const verified = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
        
        // I-save ang info ng user (id at pangalan) para magamit ng system
        req.user = verified; 
        
        // Papatuluyin na siya sa loob ng Academy
        next(); 
    } catch (error) {
        res.status(400).json({ success: false, message: "Invalid or Expired Gate Pass." });
    }
};