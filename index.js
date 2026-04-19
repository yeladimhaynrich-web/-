const axios = require('axios');
const express = require('express');
const app = express();

// --- הגדרות ליבה ---
const API_TOKEN = "WU1BUElL.apik_JM0WlaGzqkD4CKL8hQmVaw.Drs8_LFoJ_PkF81B7sVLNvljnGkFIFjjzQBYtC85Bu4";
const MY_COOKIES = `_ga=GA1.1.1834539250.1773528574; _ga_YRWNRD8D9L=GS2.1.s1773528573$o1$g0$t1773528577$j56$l0$h0; _clck=hjg9sz%5E2%5Eg52%5E0%5E2268; _ga_FZYJJJ8ZLV=GS2.1.s1775747498$o6$g1$t1775747790$j60$l0$h0; cf_clearance=_vQTG236D_0BNCsCN_gsliL2A.5HPinflbZzKh5VyNg-1776562323-1.2.1.1-KUniLX8veELDrDMJVIShQX0Z8b3zIqKKGrLzUH.1guwBnxAaTjQB.EbG2gH_LufCSImJQYcTgYj.LM4yhjkz5kLuuvgWGb4Io3qa73.E7moN0uGc176OZM7Q2RPdwaxtvwUYrsrDFlEByjv.1NV0YpQ24ZSXOKVvktnIHwjdlv1L_Y4rKJOh3KUHwECjuKGX_bRXZO1sLXGBfTPxUb.KJsMsrXjubpBMsJ8K8bdeNCTxYBWNjzQE5PmgbWwQneUogwSH.tMytqixLmBTLd9EHiGF6xnysm0CqgJWCGrKpCfhwfF33DEDUiGWC4oZIx._sNYHLv.160Vxd5rZzQDJvQ; channel_session=MTc3NjU2ODcyOHxOd3dBTkVWTVVGZzBUMWhHUzFWSlMwcFJTMU0yUkVVMVZVOVVXRXROTkVWS1JFNVFTRnBRVTFNMlIwOHpRelpYUjFneVJFRkpVa0U9fDm-C7j7zJXGA3mryBahOWt_wwrI_x9WqALSuSXVqma0`;

// זיכרון זמני בתוך השרת
let state = { auth: { lastId: "0", count: 0 }, giz: { lastId: "0", count: 0 }, yesh: { lastId: "0", count: 0 } };

function timeToHebrewWords(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return "";
    let [hour, min] = timeStr.split(':').map(Number);
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    const hoursWords = ["", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע", "עשר", "אחת עשרה", "שתים עשרה"];
    const units = ["", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע"];
    const teens = ["עשר", "אחת עשרה", "שתים עשרה", "שלוש עשרה", "ארבע עשרה", "חמש עשרה", "שש עשרה", "שבע עשרה", "שמונה עשרה", "תשע עשרה"];
    const tens = ["", "עשר", "עשרים", "שלושים", "ארבעים", "חמישים"];
    let hPart = hoursWords[hour], mPart = "";
    if (min === 0) mPart = "בדיוק";
    else if (min === 30) mPart = "וחצי";
    else if (min === 15) mPart = "ורבע";
    else if (min === 1) mPart = "ודקה";
    else if (min === 2) mPart = "ושתי דקות";
    else if (min < 10) mPart = "ו" + units[min] + " דקות";
    else if (min < 20) mPart = "ו" + teens[min - 10];
    else { let t = Math.floor(min / 10), u = min % 10; mPart = "ו" + tens[t] + (u > 0 ? " ו" + units[u] : ""); }
    return `${hPart} ${mPart}`.trim();
}

async function uploadToYemot(path, contents) {
    try {
        await axios.post("https://www.call2all.co.il/ym/api/UploadTextFile", new URLSearchParams({
            token: API_TOKEN, what: "ivr2:" + path, contents: contents
        }).toString(), { timeout: 12000 });
        console.log(`✅ הועלה: ${path}`);
    } catch (e) { console.log(`❌ שגיאה: ${e.message}`); }
}

async function runBot() {
    const sources = [
        { name: "הגיזרה", url: "https://hagizra.news/api/v2/messages?limit=10", folder: "2", key: "giz", cook: false },
        { name: "אותנטי", url: "https://authenti.newsupdates.click/api/get_messages_optimized.php?source=ALL_CHANNELS&limit=20", folder: "3", key: "auth", cook: false },
        { name: "ישיב'ע", url: "https://yeshiva-zucher.chatfree.app/api/messages?offset=0&limit=15&direction=desc", folder: "4", key: "yesh", cook: true }
    ];

    for (const src of sources) {
        try {
            const res = await axios.get(src.url, { 
                headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': src.cook ? MY_COOKIES : '' }, 
                timeout: 10000 
            });
            let msgs = Array.isArray(res.data) ? res.data : (res.data.messages || res.data.data || []);
            msgs.sort((a, b) => (Number(a.id || a._id) || 0) - (Number(b.id || b._id) || 0));

            for (const m of msgs) {
                const id = String(m.id || m._id || "");
                if (!id || (state[src.key].lastId !== "0" && Number(id) <= Number(state[src.key].lastId))) continue;

                let timeStr = new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit', timeZone:'Asia/Jerusalem', hour12:false});
                let timeWords = timeToHebrewWords(timeStr);
                
                let text = (m.text || m.content || "").replace(/https?:\/\/[^\s]+/gi, "").trim();
                if (text.length > 5) {
                    let finalStr = `${src.name} בשעה ${timeWords}: ${text}`;
                    const fileName = `${src.folder}/${String(state[src.key].count).padStart(3, '0')}.tts`;
                    await uploadToYemot(fileName, finalStr);
                    state[src.key].count = (state[src.key].count + 1) % 1000;
                    state[src.key].lastId = id;
                }
            }
        } catch (e) { console.log(`Error in ${src.name}: ${e.message}`); }
    }
}

app.get('/', async (req, res) => {
    await runBot();
    res.send('Checked for updates!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
