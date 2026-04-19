const axios = require('axios');
const fs = require('fs');
const path = require('path');

// הגדרות מערכת
const API_TOKEN = "WU1BUElL.apik_JM0WlaGzqkD4CKL8hQmVaw.Drs8_LFoJ_PkF81B7sVLNvljnGkFIFjjzQBYtC85Bu4";
const DB_FILE = path.join(__dirname, 'state.json');

// פונקציית ניקוי טקסט
function cleanTextMaster(text) {
    if (!text) return "";
    return text.replace(/<[^>]*>?/gm, "") // הסרת HTML
               .replace(/https?:\/\/[^\s]+/gi, "") // הסרת לינקים
               .replace(/\s+/g, ' ') // הסרת רווחים כפולים
               .trim() + ".";
}

// שליחה לימות המשיח
async function uploadToYemot(path, contents) {
    try {
        await axios.post("https://www.call2all.co.il/ym/api/UploadTextFile", new URLSearchParams({
            token: API_TOKEN,
            what: "ivr2:" + path,
            contents: contents
        }).toString(), { timeout: 10000 });
        console.log(`✅ הועלה בהצלחה: ${path}`);
    } catch (e) {
        console.log(`❌ שגיאה בהעלאה ל-${path}: ${e.message}`);
    }
}

// טעינת זיכרון (הודעה אחרונה שנשלחה)
function loadState() {
    if (fs.existsSync(DB_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        } catch (e) { return createEmptyState(); }
    }
    return createEmptyState();
}

function createEmptyState() {
    return { auth: { lastId: "0", count: 0 }, giz: { lastId: "0", count: 0 }, yesh: { lastId: "0", count: 0 } };
}

async function run() {
    let state = loadState();
    const sources = [
        { name: "הגיזרה", url: "https://hagizra.news/api/v2/messages?limit=10", folder: "2", key: "giz" },
        { name: "אותנטי", url: "https://authenti.newsupdates.click/api/get_messages_optimized.php?source=ALL_CHANNELS&limit=10", folder: "3", key: "auth" },
        { name: "ישיב'ע", url: "https://yeshiva-zucher.chatfree.app/api/messages?limit=10", folder: "4", key: "yesh" }
    ];

    for (const src of sources) {
        try {
            console.log(`--- בודק את ${src.name} ---`);
            const res = await axios.get(src.url, { 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebkit/537.36' },
                timeout: 15000 
            });
            
            // חילוץ הודעות בצורה בטוחה
            let msgs = [];
            if (Array.isArray(res.data)) msgs = res.data;
            else if (res.data && res.data.messages) msgs = res.data.messages;
            else if (res.data && res.data.data) msgs = res.data.data;

            // הפיכת סדר (מהישן לחדש) כדי להעלות לפי סדר כרונולוגי
            msgs = Array.isArray(msgs) ? msgs.slice().reverse() : [];

            for (const m of msgs) {
                const id = String(m.id || m._id || "");
                if (!id || id <= state[src.key].lastId) continue;

                const rawTxt = m.text || m.content || m.description || "";
                const cleanTxt = cleanTextMaster(rawTxt);
                
                if (cleanTxt.length > 5) {
                    const fileName = `${src.folder}/${String(state[src.key].count).padStart(3, '0')}.tts`;
                    await uploadToYemot(fileName, `${src.name}: ${cleanTxt}`);
                    
                    state[src.key].count = (state[src.key].count + 1) % 1000;
                    state[src.key].lastId = id;
                }
            }
        } catch (e) { 
            console.log(`⚠️ שגיאה במקור ${src.name}: ${e.response ? e.response.status : e.message}`); 
        }
    }
    // שמירת המצב החדש
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
    console.log("--- סיום ריצה ---");
}

run();
