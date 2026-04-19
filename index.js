const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- הגדרות ליבה ---
const API_TOKEN = "WU1BUElL.apik_JM0WlaGzqkD4CKL8hQmVaw.Drs8_LFoJ_PkF81B7sVLNvljnGkFIFjjzQBYtC85Bu4";
const DB_FILE = path.join(__dirname, 'state.json');
const MY_COOKIES = "_ga=GA1.1.1834539250.1773528574; _ga_YRWNRD8D9L=GS2.1.s1773528573$o1$g0$t1773528577$j56$l0$h0; _clck=hjg9sz%5E2%5Eg52%5E0%5E2268; _ga_FZYJJJ8ZLV=GS2.1.s1775747498$o6$g1$t1775747790$j60$l0$h0; channel_session=MTc3NjU2MjMyMnxOd3dBTkVWTVVGZzBUMWhHUzFWSlMwcFJTMU0yUkVVMVZVOVVXRXROTkVWS1JFNVFTRnBRVTFNMlIwOHpRelpYUjFneVJFRkpVa0U9fCj9GElL2i1FgdbjJ7rO__FQXU2nxfaUlDDjLKx8jKDL; cf_clearance=_vQTG236D_0BNCsCN_gsliL2A.5HPinflbZzKh5VyNg-1776562323-1.2.1.1-KUniLX8veELDrDMJVIShQX0Z8b3zIqKKGrLzUH.1guwBnxAaTjQB.EbG2gH_LufCSImJQYcTgYj.LM4yhjkz5kLuuvgWGb4Io3qa73.E7moN0uGc176OZM7Q2RPdwaxtvwUYrsrDFlEByjv.1NV0YpQ24ZSXOKVvktnIHwjdlv1L_Y4rKJOh3KUHwECjuKGX_bRXZO1sLXGBfTPxUb.KJsMsrXjubpBMsJ8K8bdeNCTxYBWNjzQE5PmgbWwQneUogwSH.tMytqixLmBTLd9EHiGF6xnysm0CqgJWCGrKpCfhwfF33DEDUiGWC4oZIx._sNYHLv.160Vxd5rZzQDJvQ";

// שים לב: הגדרתי כ-true כדי שתראה מיד את השינוי. אחרי ריצה אחת מוצלחת שנה ל-false.
const FORCE_REUPLOAD = true; 

function cleanTextMaster(text, isYeshiva = false) {
    if (!text) return "";
    let clean = String(text);
    // ניקוי חתימת ישיב'ע
    const footerPattern = /'ישיב'ע זוכע'ר' - סקופים בלעדיים[\s\S]*?wa\.me\/972543033643/g;
    clean = clean.replace(footerPattern, ".");
    // ניקוי כוכביות ורווחים
    clean = clean.replace(/\*/g, " ");
    clean = clean.replace(/\b[\w\-]+\.(jpg|jpeg|png|gif|mp4|pdf|heic)\b/gi, "");
    clean = clean.replace(/\[?(image|video|poll|file|תמונה|סרטון)\]?/gi, "");
    clean = clean.replace(/https?:\/\/[^\s]+/gi, "");
    if (isYeshiva) clean = clean.replace(/ישיב’ע זוכע’ר:/g, "");
    return clean.replace(/\s+/g, ' ').trim();
}

// פונקציית זמן "פרו" - מחפשת בכל מקום אפשרי
function extractTimePro(m) {
    let textContent = String(m.text || m.content || m.description || "");
    
    // 1. ניסיון למצוא שעה בתוך הטקסט (הכי אמין במבזקים)
    let textMatch = textContent.match(/(\d{2}:\d{2})/);
    if (textMatch) return textMatch[1];

    // 2. ניסיון למצוא בשדות זמן שונים של האתרים
    let rawDate = m.created_at || m.message_date || m.time || m.timestamp || m.date || "";
    
    if (rawDate) {
        let d = new Date(rawDate);
        // אם זה Unix Timestamp (מספר ארוך)
        if (isNaN(d.getTime()) && /^\d+$/.test(rawDate)) {
            d = new Date(Number(rawDate) * (rawDate.length > 11 ? 1 : 1000));
        }
        
        if (!isNaN(d.getTime())) {
            // התאמה לזמן ישראל (UTC+3)
            return d.toLocaleTimeString('he-IL', { 
                hour: '2-digit', 
                minute: '2-digit', 
                timeZone: 'Asia/Jerusalem', 
                hour12: false 
            });
        }
    }

    // 3. ברירת מחדל - השעה הנוכחית של הריצה
    return new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem', hour12: false });
}

async function uploadToYemot(path, contents) {
    try {
        await axios.post("https://www.call2all.co.il/ym/api/UploadTextFile", new URLSearchParams({
            token: API_TOKEN,
            what: "ivr2:" + path,
            contents: contents
        }).toString(), { timeout: 12000 });
        console.log(`✅ הועלה: ${path}`);
    } catch (e) { console.log(`❌ שגיאה: ${e.message}`); }
}

function loadState() {
    try {
        if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {}
    return { auth: { lastId: "0", count: 0 }, giz: { lastId: "0", count: 0 }, yesh: { lastId: "0", count: 0 } };
}

async function run() {
    let state = loadState();
    const sources = [
        { name: "הגיזרה", url: "https://hagizra.news/api/v2/messages?limit=15", folder: "2", key: "giz", cook: false },
        // קישור משופר לאותנטי - מבקש מפורשות את החדשים ביותר
        { name: "אותנטי", url: "https://authenti.newsupdates.click/api/get_messages_optimized.php?source=ALL_CHANNELS&limit=30&order=desc", folder: "3", key: "auth", cook: false },
        { name: "ישיב'ע", url: "https://yeshiva-zucher.chatfree.app/api/messages?limit=15", folder: "4", key: "yesh", cook: true }
    ];

    for (const src of sources) {
        try {
            console.log(`--- בודק: ${src.name} ---`);
            const res = await axios.get(src.url, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Cookie': src.cook ? MY_COOKIES : ''
                }, 
                timeout: 15000 
            });

            let msgs = Array.isArray(res.data) ? res.data : (res.data.messages || res.data.data || []);
            
            // במידה ואותנטי מחזיר אובייקט עם שדה 'messages'
            if (src.key === 'auth' && res.data.messages) msgs = res.data.messages;

            // הפיכה כרונולוגית (מהישן לחדש)
            msgs = msgs.slice().reverse();

            for (const m of msgs) {
                const id = String(m.id || m._id || m.message_id || "");
                if (!FORCE_REUPLOAD && (!id || Number(id) <= Number(state[src.key].lastId))) continue;

                const time = extractTimePro(m);
                const isYeshiva = (src.key === "yesh");
                const cleanTxt = cleanTextMaster(m.text || m.content || m.description || "", isYeshiva);

                if (cleanTxt.length > 5) {
                    let finalString = "";
                    if (isYeshiva) {
                        finalString = `${time}:בעדכוני יְשִׁיבְע זּוּכֶער: ${cleanTxt}`;
                    } else if (src.key === "giz") {
                        finalString = `הגיזרה בשעה: ${time}, ${cleanTxt}`;
                    } else {
                        // פורמט שלוחה 3
                        let label = m.source_name || m.source || src.name;
                        finalString = `${label} בשעה: ${time}, ${cleanTxt}`;
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
