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
  // 2026-10-23：愿望语义升级为"当天急事列表"——完成项自动转当日完成记录并从列表移除
  achieveWishV2(id) {
    const db = load();
    const i = db.wishes.findIndex(w => w.id === Number(id));
    if (i >= 0) {
      const [w] = db.wishes.splice(i, 1);
      db.doneLog = db.doneLog || {};
      const today = new Date().toISOString().slice(0, 10);
      db.doneLog[today] = db.doneLog[today] || [];
      db.doneLog[today].unshift({ text: w.text, doneAt: new Date().toISOString() });
    }
    save(db);
    return { wishes: db.wishes, doneToday: db.doneLog[new Date().toISOString().slice(0, 10)] || [] };
  },
  editWish(id, text) {
    const db = load();
    const w = db.wishes.find(w => w.id === Number(id));
    if (w && text.trim()) { w.text = text.trim(); w.editedAt = new Date().toISOString(); }
    save(db);
    return db.wishes;
  },
  moveWish(id, dir) {  // dir: -1 上移 / +1 下移
    const db = load();
    const i = db.wishes.findIndex(w => w.id === Number(id));
    const j = i + dir;
    if (i >= 0 && j >= 0 && j < db.wishes.length) {
      [db.wishes[i], db.wishes[j]] = [db.wishes[j], db.wishes[i]];
      save(db);
    }
    return db.wishes;
  },
  // 2026-10-23 15:10：拖拽排序——把 id 移到 targetId 之前/之后
  reorderWish(id, targetId, after) {
    const db = load();
    const i = db.wishes.findIndex(w => w.id === Number(id));
    if (i < 0) return db.wishes;
    const [w] = db.wishes.splice(i, 1);
    let t = db.wishes.findIndex(x => x.id === Number(targetId));
    if (t < 0) { db.wishes.unshift(w); }  // 目标没了（比如刚被删）→ 放最前
    else db.wishes.splice(t + (after ? 1 : 0), 0, w);
    save(db);
    return db.wishes;
  },
  getDoneToday() {
    const db = load();
    const today = new Date().toISOString().slice(0, 10);
    return (db.doneLog || {})[today] || [];
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
