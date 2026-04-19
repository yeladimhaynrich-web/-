const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- הגדרות ---
const API_TOKEN = "WU1BUElL.apik_JM0WlaGzqkD4CKL8hQmVaw.Drs8_LFoJ_PkF81B7sVLNvljnGkFIFjjzQBYtC85Bu4";
const DB_FILE = path.join(__dirname, 'state.json');
const MY_COOKIES = "_ga=GA1.1.1834539250.1773528574; _ga_YRWNRD8D9L=GS2.1.s1773528573$o1$g0$t1773528577$j56$l0$h0; _clck=hjg9sz%5E2%5Eg52%5E0%5E2268; _ga_FZYJJJ8ZLV=GS2.1.s1775747498$o6$g1$t1775747790$j60$l0$h0; channel_session=MTc3NjU2MjMyMnxOd3dBTkVWTVVGZzBUMWhHUzFWSlMwcFJTMU0yUkVVMVZVOVVXRXROTkVWS1JFNVFTRnBRVTFNMlIwOHpRelpYUjFneVJFRkpVa0U9fCj9GElL2i1FgdbjJ7rO__FQXU2nxfaUlDDjLKx8jKDL; cf_clearance=_vQTG236D_0BNCsCN_gsliL2A.5HPinflbZzKh5VyNg-1776562323-1.2.1.1-KUniLX8veELDrDMJVIShQX0Z8b3zIqKKGrLzUH.1guwBnxAaTjQB.EbG2gH_LufCSImJQYcTgYj.LM4yhjkz5kLuuvgWGb4Io3qa73.E7moN0uGc176OZM7Q2RPdwaxtvwUYrsrDFlEByjv.1NV0YpQ24ZSXOKVvktnIHwjdlv1L_Y4rKJOh3KUHwECjuKGX_bRXZO1sLXGBfTPxUb.KJsMsrXjubpBMsJ8K8bdeNCTxYBWNjzQE5PmgbWwQneUogwSH.tMytqixLmBTLd9EHiGF6xnysm0CqgJWCGrKpCfhwfF33DEDUiGWC4oZIx._sNYHLv.160Vxd5rZzQDJvQ";

// --- פונקציית ניקוי מתקדמת ---
function cleanTextMaster(text, isYeshiva = false) {
    if (!text) return "";
    let clean = String(text);

    // 1. הסרת בלוק החתימה של ישיב'ע זוכע'ר (לפני ניקוי קישורים כללי)
    const footerPattern = /'ישיב'ע זוכע'ר' - סקופים בלעדיים[\s\S]*?wa\.me\/972543033643/g;
    clean = clean.replace(footerPattern, ".");

    // 2. הסרת כוכביות
    clean = clean.replace(/\*/g, " ");

    // 3. הסרת תבניות של קבצים ותמונות
    clean = clean.replace(/\b[\w\-]+\.(jpg|jpeg|png|gif|mp4|pdf|heic)\b/gi, "");
    clean = clean.replace(/\[?(image|video|poll|file|תמונה|סרטון)\]?/gi, "");

    // 4. הסרת קישורים
    clean = clean.replace(/https?:\/\/[^\s]+/gi, "");

    // 5. ניקוי הפתיח הישן של ישיב'ע אם קיים (כדי שלא יופיע פעמיים)
    if (isYeshiva) {
        clean = clean.replace(/ישיב’ע זוכע’ר:/g, "");
    }

    // 6. ניקוי רווחים כפולים
    clean = clean.replace(/\s+/g, ' ').trim();
    
    return clean;
}

// חילוץ שעה בפורמט HH:mm
function extractTime(m) {
    let rawTime = m.time || m.timestamp || m.createdAt || "";
    let textContent = m.text || m.content || m.description || "";
    
    // חיפוש שעה בתוך הטקסט קודם כל
    let textMatch = String(textContent).match(/(\d{2}:\d{2})/);
    if (textMatch) return textMatch[1];
    
    // אם אין בטקסט, חילוץ מהתאריך של ההודעה
    let dateObj = new Date(rawTime);
    if (isNaN(dateObj.getTime())) return "00:00";
    
    // הוספת 3 שעות לזמן ישראל (אם השרת ב-UTC)
    dateObj.setHours(dateObj.getHours() + 3);
    return dateObj.getHours().toString().padStart(2, '0') + ":" + dateObj.getMinutes().toString().padStart(2, '0');
}

async function uploadToYemot(path, contents) {
    try {
        await axios.post("https://www.call2all.co.il/ym/api/UploadTextFile", new URLSearchParams({
            token: API_TOKEN,
            what: "ivr2:" + path,
            contents: contents
        }).toString(), { timeout: 10000 });
        console.log(`✅ הועלה: ${path}`);
    } catch (e) { console.log(`❌ שגיאה: ${e.message}`); }
}

function loadState() {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return { auth: { lastId: "0", count: 0 }, giz: { lastId: "0", count: 0 }, yesh: { lastId: "0", count: 0 } };
}

async function run() {
    let state = loadState();
    const sources = [
        { name: "הגיזרה", url: "https://hagizra.news/api/v2/messages?limit=10", folder: "2", key: "giz", useCookie: false },
        { name: "אותנטי", url: "https://authenti.newsupdates.click/api/get_messages_optimized.php?source=ALL_CHANNELS&last_id=0&limit=50", folder: "3", key: "auth", useCookie: false },
        { name: "ישיב'ע", url: "https://yeshiva-zucher.chatfree.app/api/messages?limit=10", folder: "4", key: "yesh", useCookie: true }
    ];

    for (const src of sources) {
        try {
            console.log(`--- בודק ${src.name} ---`);
            const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
            if (src.useCookie) headers['Cookie'] = MY_COOKIES;

            const res = await axios.get(src.url, { headers, timeout: 15000 });
            let msgs = Array.isArray(res.data) ? res.data : (res.data.messages || res.data.data || []);
            
            msgs = msgs.slice().reverse();

            for (const m of msgs) {
                const id = String(m.id || m._id || "");
                if (!id || id <= state[src.key].lastId) continue;

                const time = extractTime(m);
                const isYeshiva = (src.key === "yesh");
                const cleanTxt = cleanTextMaster(m.text || m.content || m.description || "", isYeshiva);

                if (cleanTxt.length > 3) {
                    let finalString = "";
                    
                    if (isYeshiva) {
                        // פורמט שלוחה 4: [שעה]:בעדכוני יְשִׁיבְע זּוּכֶער: [מבזק]
                        finalString = `${time}:בעדכוני יְשִׁיבְע זּוּכֶער: ${cleanTxt}`;
                    } else if (src.key === "giz") {
                        // פורמט שלוחה 2: הגיזרה בשעה: [שעה], [מבזק]
                        finalString = `הגיזרה בשעה: ${time}, ${cleanTxt}`;
                    } else {
                        // פורמט שלוחה 3: [מקור] בשעה: [שעה], [מבזק]
                        let sourceLabel = m.source || src.name;
                        finalString = `${sourceLabel} בשעה: ${time}, ${cleanTxt}`;
                    }

                    const fileName = `${src.folder}/${String(state[src.key].count).padStart(3, '0')}.tts`;
                    await uploadToYemot(fileName, finalString);
                    
                    state[src.key].count = (state[src.key].count + 1) % 1000;
                    state[src.key].lastId = id;
                }
            }
        } catch (e) { console.log(`⚠️ שגיאה ב-${src.name}: ${e.message}`); }
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

run();
