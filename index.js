const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- הגדרות ליבה ---
const API_TOKEN = "WU1BUElL.apik_JM0WlaGzqkD4CKL8hQmVaw.Drs8_LFoJ_PkF81B7sVLNvljnGkFIFjjzQBYtC85Bu4";
const DB_FILE = path.join(__dirname, 'state.json');

// הקוקי החדש שסיפקת - תקף מעכשיו
const MY_COOKIES = `_ga=GA1.1.1834539250.1773528574; _ga_YRWNRD8D9L=GS2.1.s1773528573$o1$g0$t1773528577$j56$l0$h0; _clck=hjg9sz%5E2%5Eg52%5E0%5E2268; _ga_FZYJJJ8ZLV=GS2.1.s1775747498$o6$g1$t1775747790$j60$l0$h0; cf_clearance=_vQTG236D_0BNCsCN_gsliL2A.5HPinflbZzKh5VyNg-1776562323-1.2.1.1-KUniLX8veELDrDMJVIShQX0Z8b3zIqKKGrLzUH.1guwBnxAaTjQB.EbG2gH_LufCSImJQYcTgYj.LM4yhjkz5kLuuvgWGb4Io3qa73.E7moN0uGc176OZM7Q2RPdwaxtvwUYrsrDFlEByjv.1NV0YpQ24ZSXOKVvktnIHwjdlv1L_Y4rKJOh3KUHwECjuKGX_bRXZO1sLXGBfTPxUb.KJsMsrXjubpBMsJ8K8bdeNCTxYBWNjzQE5PmgbWwQneUogwSH.tMytqixLmBTLd9EHiGF6xnysm0CqgJWCGrKpCfhwfF33DEDUiGWC4oZIx._sNYHLv.160Vxd5rZzQDJvQ; channel_session=MTc3NjU2ODcyOHxOd3dBTkVWTVVGZzBUMWhHUzFWSlMwcFJTMU0yUkVVMVZVOVVXRXROTkVWS1JFNVFTRnBRVTFNMlIwOHpRelpYUjFneVJFRkpVa0U9fDm-C7j7zJXGA3mryBahOWt_wwrI_x9WqALSuSXVqma0`;

const FORCE_REUPLOAD = true; // שנה ל-false אחרי ריצה אחת מוצלחת

function cleanTextMaster(text, isYeshiva = false) {
    if (!text) return "";
    let clean = String(text);
    const footerPattern = /'ישיב'ע זוכע'ר' - סקופים בלעדיים[\s\S]*?wa\.me\/972543033643/g;
    clean = clean.replace(footerPattern, ".");
    clean = clean.replace(/\*/g, " ");
    clean = clean.replace(/\b[\w\-]+\.(jpg|jpeg|png|gif|mp4|pdf|heic)\b/gi, "");
    clean = clean.replace(/\[?(image|video|poll|file|תמונה|סרטון)\]?/gi, "");
    clean = clean.replace(/https?:\/\/[^\s]+/gi, "");
    if (isYeshiva) clean = clean.replace(/ישיב’ע זוכע’ר:/g, "");
    return clean.replace(/\s+/g, ' ').trim();
}

function extractTimePro(m, sourceKey) {
    let textContent = String(m.text || m.content || "");
    let textMatch = textContent.match(/(\d{2}:\d{2})/);
    if (textMatch) return textMatch[1];

    let rawDate = m.message_date || m.created_at || m.time || m.timestamp || "";
    if (rawDate) {
        let d = new Date(rawDate);
        if (isNaN(d.getTime()) && /^\d+$/.test(rawDate)) {
            d = new Date(Number(rawDate) * (rawDate.length > 11 ? 1 : 1000));
        }
        if (!isNaN(d.getTime())) {
            // באותנטי הזמן כבר מקומי, בשאר המרה לזמן ישראל
            if (sourceKey === 'auth') {
                return d.getUTCHours().toString().padStart(2, '0') + ":" + d.getUTCMinutes().toString().padStart(2, '0');
            }
            return new Intl.DateTimeFormat('he-IL', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem', hour12: false
            }).format(d);
        }
    }
    return new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem', hour12: false }).format(new Date());
}

async function uploadToYemot(path, contents) {
    try {
        await axios.post("https://www.call2all.co.il/ym/api/UploadTextFile", new URLSearchParams({
            token: API_TOKEN, what: "ivr2:" + path, contents: contents
        }).toString(), { timeout: 12000 });
        console.log(`✅ הועלה: ${path}`);
    } catch (e) { console.log(`❌ שגיאה: ${e.message}`); }
}

function loadState() {
    try { if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
    return { auth: { lastId: "0", count: 0 }, giz: { lastId: "0", count: 0 }, yesh: { lastId: "0", count: 0 } };
}

async function run() {
    let state = loadState();
    const sources = [
        { name: "הגיזרה", url: "https://hagizra.news/api/v2/messages?limit=15", folder: "2", key: "giz", cook: false },
        { name: "אותנטי", url: "https://authenti.newsupdates.click/api/get_messages_optimized.php?source=ALL_CHANNELS&limit=30", folder: "3", key: "auth", cook: false },
        { name: "ישיב'ע", url: "https://yeshiva-zucher.chatfree.app/api/messages?offset=0&limit=20&direction=desc", folder: "4", key: "yesh", cook: true }
    ];

    for (const src of sources) {
        try {
            console.log(`--- בודק: ${src.name} ---`);
            const headers = { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://yeshiva-zucher.chatfree.app/'
            };
            if (src.cook) headers['Cookie'] = MY_COOKIES;

            const res = await axios.get(src.url, { headers, timeout: 15000 });
            let msgs = Array.isArray(res.data) ? res.data : (res.data.messages || res.data.data || []);
            
            // סידור מהישן לחדש
            msgs.sort((a, b) => (Number(a.id || a._id) || 0) - (Number(b.id || b._id) || 0));

            for (const m of msgs) {
                const id = String(m.id || m._id || "");
                if (!FORCE_REUPLOAD && (!id || Number(id) <= Number(state[src.key].lastId))) continue;

                const time = extractTimePro(m, src.key);
                const cleanTxt = cleanTextMaster(m.text || m.content || m.description || "", src.key === 'yesh');

                if (cleanTxt.length > 5) {
                    let finalStr = "";
                    if (src.key === 'yesh') {
                        finalStr = `${time}:בעדכוני יְשִׁיבְע זּוּכֶער: ${cleanTxt}`;
                    } else if (src.key === 'giz') {
                        finalStr = `הגיזרה בשעה: ${time}, ${cleanTxt}`;
                    } else {
                        let label = m.source_name || m.source || src.name;
                        finalStr = `${label} בשעה: ${time}, ${cleanTxt}`;
                    }

                    const fileName = `${src.folder}/${String(state[src.key].count).padStart(3, '0')}.tts`;
                    await uploadToYemot(fileName, finalStr);
                    
                    state[src.key].count = (state[src.key].count + 1) % 1000;
                    state[src.key].lastId = id;
                }
            }
        } catch (e) { 
            console.log(`⚠️ שגיאה ב-${src.name}: ${e.response ? e.response.status : e.message}`); 
        }
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

run();
