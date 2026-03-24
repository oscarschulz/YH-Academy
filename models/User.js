const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Dito papasok yung scrambled/hashed password
    role: { type: String, default: 'Hustler' }, // 'Hustler', 'HQ', o 'Dev'
    isVerified: { type: Boolean, default: false }, // False muna hangga't walang OTP
    otpCode: { type: String }, // Yung 6-digit code na isesend sa email
    otpExpires: { type: Date } // Oras kung kailan ma-e-expire ang OTP
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);