// 愿望箱/速记/定时器 本地存储（userData/panel-store.json）
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const STORE_PATH = path.join(app.getPath('userData'), 'panel-store.json');

function load() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')); }
  catch { return { wishes: [], notes: '', timers: [] }; }
}
function save(db) { fs.writeFileSync(STORE_PATH, JSON.stringify(db, null, 2)); }

const store = {
  getWishes: () => load().wishes,
  addWish(text) {
    const db = load();
    db.wishes.unshift({ id: Date.now(), text, createdAt: new Date().toISOString(), done: false });
    save(db);
    return db.wishes;
  },
  delWish(id) {
    const db = load();
    db.wishes = db.wishes.filter(w => w.id !== Number(id));
    save(db);
    return db.wishes;
  },
  achieveWish(id) {
    const db = load();
    const w = db.wishes.find(w => w.id === Number(id));
    if (w) { w.done = true; w.doneAt = new Date().toISOString(); }
    save(db);
    return db.wishes;
  },
  getNotes: () => load().notes || '',
  saveNotes(text) {
    const db = load();
    db.notes = text;
    save(db);
    return { ok: true };
  },
  getTimers: () => (load().timers || []).map(t => ({ ...t, remaining: t.minutes })),  // 简化：重启后恢复为初始值
  addTimer(label, minutes) {
    const db = load();
    db.timers = db.timers || [];
    db.timers.unshift({ id: Date.now(), label, minutes: Number(minutes) });
    save(db);
    return db.timers.map(t => ({ ...t, remaining: t.minutes }));
  },
  delTimer(id) {
    const db = load();
    db.timers = (db.timers || []).filter(t => t.id !== Number(id));
    save(db);
    return db.timers.map(t => ({ ...t, remaining: t.minutes }));
  },
};

module.exports = store;
