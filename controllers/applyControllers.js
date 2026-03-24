const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken'); // 🔥 DINAGDAG PARA SA GOLDEN TICKET

// --- SETUP GEMINI AI ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- SETUP GOOGLE SHEETS ---
const auth = new google.auth.GoogleAuth({
    keyFile: 'google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = '1f20Wy7jTu0aXl_AI3XoFsJ2aMWTBOeJ7S66s_hyIdKs';

// Helper Function: Anti-XSS Sanitization
const sanitize = (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
};

exports.processApplication = async (req, res) => {
    try {
        const rawData = req.body;

        const requiredFields = ['fullName', 'email', 'age', 'country', 'currentJob', 'reasonJoin', 'goals6mo', 'hearAbout', 'seriousness', 'hoursCommit'];
        
        for (let field of requiredFields) {
            if (!rawData[field] || rawData[field].toString().trim() === "") {
                return res.status(400).json({ success: false, message: `Application Blocked: Missing required field (${field}).` });
            }
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(rawData.email)) {
            return res.status(400).json({ success: false, message: "Application Blocked: Invalid email format." });
        }

        const blockedDomains = [
            'mailinator.com', '10minutemail.com', 'guerrillamail.com', 
            'temp-mail.org', 'yopmail.com', 'dropmail.me', 'throwawaymail.com',
            'tempmail.com', 'fakemail.net', 'tempmail.net', 'trashmail.com',
            'sharklasers.com', 'getnada.com', 'temp-mail.io'
        ];
        const emailDomain = rawData.email.split('@')[1].toLowerCase();
        if (blockedDomains.includes(emailDomain)) {
            return res.status(400).json({ success: false, message: "Application Blocked: Disposable or temporary email providers are not allowed." });
        }

        if (isNaN(rawData.age) || Number(rawData.age) < 13 || Number(rawData.age) > 100) {
            return res.status(400).json({ success: false, message: "Application Blocked: Invalid age." });
        }

        const fullName = sanitize(rawData.fullName);
        const email = sanitize(rawData.email).toLowerCase();
        const age = Number(rawData.age);
        const country = sanitize(rawData.country);
        const igUsername = rawData.igUsername ? sanitize(rawData.igUsername) : "N/A";
        const currentJob = sanitize(rawData.currentJob);
        const reasonJoin = sanitize(rawData.reasonJoin);
        const goals6mo = sanitize(rawData.goals6mo);
        const hearAbout = sanitize(rawData.hearAbout);
        const referrer = rawData.referrer ? sanitize(rawData.referrer) : "N/A";
        const seriousness = sanitize(rawData.seriousness);
        const hoursCommit = sanitize(rawData.hoursCommit);

        console.log("\n=============================================");
        console.log("🧠 SENDING SECURED DATA TO GEMINI AI FOR REVIEW...");
        console.log("Name:", fullName);
        console.log("Email:", email);
        console.log("=============================================\n");

        const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];

        let aiDecision = null;
        let lastError = null;

        const prompt = `
        You are a strict AI Admissions Officer for 'The Academy', an exclusive network for driven individuals.
        Evaluate this applicant.
        
        Applicant Details:
        - Age: ${age}
        - Country: ${country}
        - Current Job: ${currentJob}
        - Reason to Join: ${reasonJoin}
        - 6-Month Goals: ${goals6mo}
        - Seriousness Level: ${seriousness}
        - Hours Commitment: ${hoursCommit} per week
        
        Scoring Criteria:
        - Intent (0-20)
        - Specificity (0-20)
        - Commitment (0-20)
        - Fit for YHA (0-20)
        - Effort shown (0-20)

        Rules: 80-100 = Approved, 50-79 = Manual Review, 0-49 = Rejected.
        
        Return ONLY a valid JSON.
        {
          "score": 85,
          "status": "Approved",
          "feedback": "A short 1-sentence reason for your decision."
        }
        `;

        for (const modelName of modelsToTry) {
            try {
                console.log(`▶ Trying AI Model: ${modelName}...`);
                const model = genAI.getGenerativeModel({ model: modelName });
                
                const result = await model.generateContent(prompt);
                let responseText = result.response.text();
                
                responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
                aiDecision = JSON.parse(responseText);

                console.log(`✅ SUCCESS! Model ${modelName} worked.`);
                break; 

            } catch (e) {
                lastError = e;
                console.log(`❌ Model ${modelName} failed. ERROR: ${e.message.split('\n')[0]}`);
            }
        }

        if (!aiDecision) {
            console.error("\n❌ ALL AI MODELS FAILED:", lastError.message);
            aiDecision = {
                score: 75,
                status: "Manual Review",
                feedback: "AI System offline. Forwarded to HQ for manual review."
            };
        }

        console.log("📊 Saving data to Google Sheets...");
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:A', 
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    new Date().toLocaleString(),
                    fullName, email, age, country, igUsername, currentJob, 
                    reasonJoin, goals6mo, hearAbout, referrer, seriousness, 
                    hoursCommit, aiDecision.score, aiDecision.status
                ]],
            },
        });
        console.log("✅ Successfully saved to Google Sheets!");

        // 🔥 GUMAWA NG GOLDEN TICKET KUNG APPROVED
        let approvalToken = null;
        if (aiDecision.status === "Approved") {
            approvalToken = jwt.sign(
                { approvedEmail: email }, 
                process.env.JWT_SECRET, 
                { expiresIn: '30m' } // Valid lang ng 30 mins para mag-register
            );
        }

        res.json({ 
            success: true, 
            score: aiDecision.score,
            status: aiDecision.status, 
            message: aiDecision.feedback,
            approvalToken: approvalToken // Ipinapasa sa frontend
        });

    } catch (error) {
        console.error("❌ Backend Error in processApplication:", error);
        res.status(500).json({ success: false, message: "Server encountered an error processing your application." });
    }
};