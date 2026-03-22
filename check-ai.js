require('dotenv').config();

async function checkModels() {
    console.log("🔍 Contacting Google servers to check your API Key...\n");
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        
        if (data.error) {
            console.log("❌ API KEY ERROR:", data.error.message);
            return;
        }

        console.log("✅ AVAILABLE & UNLOCKED MODELS FOR YOUR KEY:");
        data.models.forEach(model => {
            // Sinasala lang natin yung mga pwedeng mag-generate ng text
            if(model.supportedGenerationMethods.includes("generateContent")) {
                // Tinatanggal natin yung word na 'models/' para malinis tingnan
                console.log(`👉 ${model.name.replace('models/', '')}`);
            }
        });
        
    } catch (error) {
        console.log("❌ Failed to connect to Google. Check your internet or API Key.", error);
    }
}

checkModels();