const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_TOKEN = "WU1BUElL.apik_JM0WlaGzqkD4CKL8hQmVaw.Drs8_LFoJ_PkF81B7sVLNvljnGkFIFjjzQBYtC85Bu4";
const DB_FILE = path.join(__dirname, 'state.json');
const MY_COOKIES = "_ga=GA1.1.1834539250.1773528574; _ga_YRWNRD8D9L=GS2.1.s1773528573$o1$g0$t1773528577$j56$l0$h0; _clck=hjg9sz%5E2%5Eg52%5E0%5E2268; _ga_FZYJJJ8ZLV=GS2.1.s1775747498$o6$g1$t1775747790$j60$l0$h0; channel_session=MTc3NjU2MjMyMnxOd3dBTkVWTVVGZzBUMWhHUzFWSlMwcFJTMU0yUkVVMVZVOVVXRXROTkVWS1JFNVFTRnBRVTFNMlIwOHpRelpYUjFneVJFRkpVa0U9fCj9GElL2i1FgdbjJ7rO__FQXU2nxfaUlDDjLKx8jKDL; cf_clearance=_vQTG236D_0BNCsCN_gsliL2A.5HPinflbZzKh5VyNg-1776562323-1.2.1.1-KUniLX8veELDrDMJVIShQX0Z8b3zIqKKGrLzUH.1guwBnxAaTjQB.EbG2gH_LufCSImJQYcTgYj.LM4yhjkz5kLuuvgWGb4Io3qa73.E7moN0uGc176OZM7Q2RPdwaxtvwUYrsrDFlEByjv.1NV0YpQ24ZSXOKVvktnIHwjdlv1L_Y4rKJOh3KUHwECjuKGX_bRXZO1sLXGBfTPxUb.KJsMsrXjubpBMsJ8K8bdeNCTxYBWNjzQE5PmgbWwQneUogwSH.tMytqixLmBTLd9EHiGF6xnysm0CqgJWCGrKpCfhwfF33DEDUiGWC4oZIx._sNYHLv.160Vxd5rZzQDJvQ";

function cleanTextMaster(text) {
    if (!text) return "";
    let clean = String(text);
    const sigs = [/'ישיב'ע זוכע'ר'/g, /chat\.whatsapp\.com\/[^\s]+/g, /ישיב׳ע זוכע’ר בצ׳אט/g, /https:\/\/yeshiva-zucher\.chatfree\.app/g, /wa\.me\/[^\s]+/g];
    sigs.forEach(s => clean = clean.replace(s, ""));
    clean = clean.replace(/\b[\w\-]+\.(jpg|jpeg|png|gif|mp4|pdf|heic)\b/gi, "");
    clean = clean.replace(/\[?(image|video|poll|file|תמונה|סרטון)\]?/gi, "");
    clean = clean.replace(/https?:\/\/[^\s]+/gi, "");
    return clean.replace(/\s+/g, ' ').trim() + ".";
}

async function uploadToYemot(p, contents) {
    try {
        await axios.post("https://www.call2all.co.il/ym/api/UploadTextFile", new URLSearchParams({ token: API_TOKEN, what: "ivr2:" + p, contents }).toString());
        console.log(`✅ הועלה בהצלחה: ${p}`);
    } catch (e) { console.log(`❌ שגיאה בימות: ${e.message}`); }
}

function loadState() {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { return { auth: { lastId: "0", count: 0 }, giz: { lastId: "0", count: 0 }, yesh: { lastId: "0", count: 0 } }; }
}

async function run() {
    let state = loadState();
    const sources = [
        { name: "הגיזרה", url: "https://hagizra.news/api/v2/messages?limit=10", folder: "2", key: "giz", cook: false },
        { name: "אותנטי", url: "https://authenti.newsupdates.click/api/get_messages_optimized.php?source=ALL_CHANNELS&last_id=0&limit=50", folder: "3", key: "auth", cook: false },
        { name: "ישיב'ע", url: "https://yeshiva-zucher.chatfree.app/api/messages?limit=10", folder: "4", key: "yesh", cook: true }
    ];

    for (const src of sources) {
        console.log(`--- בודק מקור: ${src.name} ---`);
        try {
            const res = await axios.get(src.url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Cookie': src.cook ? MY_COOKIES : ''
                },
                timeout: 15000
            });

            // חילוץ הודעות - הגרסה החדשה והבטוחה
            let rawData = res.data;
            let msgs = [];
            if (Array.isArray(rawData)) msgs = rawData;
            else if (rawData && rawData.messages) msgs = rawData.messages;
            else if (rawData && rawData.data) msgs = rawData.data;

            if (msgs.length === 0) {
                console.log(`ℹ️ לא נמצאו הודעות חדשות ב-${src.name}`);
                continue;
            }

            const final = [...msgs].reverse();

            for (const m of final) {
                const id = String(m.id || m._id || "");
                if (!id || id <= state[src.key].lastId) continue;

                const txt = cleanTextMaster(m.text || m.content || m.description || "");
                if (txt.length > 5) {
                    const f = `${src.folder}/${String(state[src.key].count).padStart(3, '0')}.tts`;
                    await uploadToYemot(f, `${src.name}: ${txt}`);
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
