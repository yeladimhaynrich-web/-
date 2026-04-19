const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_TOKEN = "WU1BUElL.apik_JM0WlaGzqkD4CKL8hQmVaw.Drs8_LFoJ_PkF81B7sVLNvljnGkFIFjjzQBYtC85Bu4";
const DB_FILE = path.join(__dirname, 'state.json');

function cleanTextMaster(text) {
    if (!text) return "";
    return text.replace(/<[^>]*>?/gm, "").replace(/https?:\/\/[^\s]+/gi, "").trim() + ".";
}

async function uploadToYemot(path, contents) {
    try {
        await axios.post("https://www.call2all.co.il/ym/api/UploadTextFile", new URLSearchParams({
            token: API_TOKEN,
            what: "ivr2:" + path,
            contents: contents
        }).toString());
        console.log(`✅ הועלה בהצלחה: ${path}`);
    } catch (e) { console.log(`❌ שגיאה בהעלאה: ${e.message}`); }
}

function loadState() {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return { auth: { lastId: "0", count: 0 }, giz: { lastId: "0", count: 0 }, yesh: { lastId: "0", count: 0 } };
}

async function run() {
    let state = loadState();
    const sources = [
        { name: "הגיזרה", url: "https://hagizra.news/api/v2/messages?limit=10", folder: "2", key: "giz" },
        { name: "אותנטי", url: "https://authenti.newsupdates.click/api/get_messages_optimized.php?limit=10", folder: "3", key: "auth" },
        { name: "ישיב'ע", url: "https://yeshiva-zucher.chatfree.app/api/messages?limit=10", folder: "4", key: "yesh" }
    ];

    for (const src of sources) {
        try {
            const res = await axios.get(src.url);
            const msgs = (res.data.messages || res.data || []).reverse();
            for (const m of msgs) {
                const id = String(m.id || m._id);
                if (id > state[src.key].lastId) {
                    const txt = cleanTextMaster(m.text || m.content || m.description);
                    if (txt.length > 5) {
                        const file = `${src.folder}/${String(state[src.key].count).padStart(3, '0')}.tts`;
                        await uploadToYemot(file, `${src.name}: ${txt}`);
                        state[src.key].count = (state[src.key].count + 1) % 1000;
                        state[src.key].lastId = id;
                    }
                }
            }
        } catch (e) { console.log(`שגיאה ב-${src.name}: ${e.message}`); }
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state));
}
run();
