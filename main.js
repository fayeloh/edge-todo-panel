// 主进程：窗口 + EdgeDock + IPC + fs.watch（重建版 v5.2）
const { app, ipcMain, BrowserWindow, screen, Tray, globalShortcut, Menu, nativeImage } = require('electron');
const fs = require('fs');
const { EdgeDock } = require('./edge-dock');
const { Q4_PATH, parseTodayTodos, toggleTodoByLine, todayHeader } = require('./q4-sync');
const { parseRoadmap, parsePlanDetail } = require('./roadmap-sync');
const { translate, LANGS } = require('./translate');
const store = require('./panel-store');

const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 680;
const PEEK_SIZE = 8;

// demo 模式：DEMO_PANEL=1 启动时全部展示虚拟数据（用于截图/试用，不碰真实文件）
const DEMO = process.env.DEMO_PANEL === '1';
const DEMO_TODOS = [
  { lineIdx: 0, checked: false, lvl: 1, text: '🔴 大事：完成《个人季度规划》v1 初稿（时间盒 14:00-16:00）' },
  { lineIdx: 1, checked: false, lvl: 3, text: '🟡 中事：评审新同事的测试方案文档，给 3 条具体反馈' },
  { lineIdx: 2, checked: true, lvl: 3, text: '🟡 中事：整理压测口径设计笔记归档' },
  { lineIdx: 3, checked: false, lvl: 5, text: '🟢 小事：预约年度体检（5 分钟）' },
  { lineIdx: 4, checked: true, lvl: 5, text: '🟢 小事：给家人打电话报平安' },
  { lineIdx: 5, checked: false, lvl: 5, text: '🟢 小事：下班前清空收件箱三分法' },
];
const DEMO_ROADMAP = [
  { no: '①', name: '技能精进三级跳', status: '🟨 进行中', goal: '从执行者到方案owner', next: 'L2-1 混合负载建模（本周五前）', entry: '[技能精进路线图](./技能精进路线图.md)' },
  { no: '②', name: '读书20本计划', status: '🟨 进行中', goal: '每季度 5 本', next: '第 14 本《掌控习惯》读到第 6 章', entry: '' },
  { no: '③', name: '健身年卡回本', status: '⬜ 启动中', goal: '每周 2 次', next: '本周四晚 力量训练 A 组', entry: '' },
];
const DEMO_PLAN_DETAIL = {
  ok: true, doc: '技能精进路线图.md', total: 8, done: 3, doing: 1,
  nodes: [
    { id: 'L1-1', title: '基础语法与脚本编写', status: 'done' },
    { id: 'L1-2', title: '口径设计（边学边实践）', status: 'doing' },
    { id: 'L1-3', title: '第一次完整实战', status: 'todo' },
    { id: 'L1-4', title: 'CI 化与定时回归', status: 'todo' },
    { id: 'L2-1', title: '混合负载建模', status: 'todo' },
    { id: 'L2-2', title: '瓶颈定位三件套', status: 'todo' },
    { id: 'L2-3', title: '特殊场景演练', status: 'todo' },
    { id: 'L2-4', title: '结果解读进阶', status: 'todo' },
  ],
};
const DEMO_WISHES = [
  { id: 1, text: '学会吉他弹唱《海阔天空》', done: false },
  { id: 2, text: '去川西看一次星空', done: false },
  { id: 3, text: '跑完一次半程马拉松', done: true },
];
const DEMO_NOTES = '灵感：把周报的"本周进展"改成"拦住了什么"叙事\n\n读书摘录：《掌控习惯》P156——你不需要变强，你需要变清晰。\n\n待查：番茄工作法的官方 app 到底哪个是正版？';
const DEMO_TIMERS = [
  { id: 1, label: '🍅 深度工作：规划文档', minutes: 25, remaining: 25 * 60 },
  { id: 2, label: '☕ 休息', minutes: 5, remaining: 5 * 60 },
];

let win = null;
let dock = null;
let watcher = null;
let tray = null;

function createWindow() {
  win = new BrowserWindow({
    width: DEMO ? 420 : PANEL_WIDTH,
    height: DEMO ? 720 : PANEL_HEIGHT,
    x: DEMO ? 120 : 0,
    y: DEMO ? 120 : 0,
    transparent: true,
    frame: false,
    hasShadow: false,
    // ⚠️ minWidth 只约束用户拖拽：收起态 setBounds 会绕过它，但保险起见用最小值 1
    minWidth: 1,
    minHeight: 1,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: `${__dirname}/preload.js`,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(`${__dirname}/renderer/index.html`);
  // macOS：alwaysOnTop 默认不会盖住全屏应用，开启后满屏时也能唤出面板
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.once('ready-to-show', () => {
    if (DEMO) {
      win.show();   // demo：直接居中显示，不吸附
      console.log('DEMO 模式：虚拟数据展示');
      return;
    }
    dock = new EdgeDock(win, {
      panelWidth: PANEL_WIDTH, panelHeight: PANEL_HEIGHT,
      peek: PEEK_SIZE, hotzone: 14, cornerHeight: 240,
      position: 'bottom-left',
    });
    dock.start();
    win.show();
    console.log('窗口吸附 bounds:', JSON.stringify(win.getBounds()));
  });

  ipcMain.on('panel:collapse', () => dock && dock.collapse());

  let wt = null;
  try {
    watcher = fs.watch(Q4_PATH, () => {
      clearTimeout(wt);
      wt = setTimeout(() => {
        if (win && !win.isDestroyed()) win.webContents.send('q4-changed');
      }, 400);
    });
  } catch (e) {
    console.error('watch failed:', e.message);
  }
}

ipcMain.handle('todos:get', () => {
  if (DEMO) return { ok: true, date: '2026-10-22', todos: DEMO_TODOS };
  try { return { ok: true, date: todayHeader(), todos: parseTodayTodos() }; }
  catch (e) { return { ok: false, error: e.message, todos: [] }; }
});
ipcMain.handle('todos:toggle', (_e, { lineIdx, checked }) => {
  if (DEMO) { const t = DEMO_TODOS.find(t => t.lineIdx === lineIdx); if (t) t.checked = checked; return { ok: true }; }
  return toggleTodoByLine(lineIdx, checked);
});
ipcMain.handle('wishes:get', () => DEMO ? DEMO_WISHES : store.getWishes());
ipcMain.handle('wishes:add', (_e, { text }) => { if (!DEMO) return store.addWish(text); DEMO_WISHES.unshift({ id: Date.now(), text, done: false }); return DEMO_WISHES; });
ipcMain.handle('wishes:del', (_e, { id }) => { if (!DEMO) return store.delWish(id); const i = DEMO_WISHES.findIndex(w => w.id === Number(id)); if (i >= 0) DEMO_WISHES.splice(i, 1); return DEMO_WISHES; });
ipcMain.handle('wishes:achieve', (_e, { id }) => {
  if (!DEMO) return store.achieveWishV2(id);  // v0.8：完成即转当日记录
  const w = DEMO_WISHES.find(w => w.id === Number(id));
  if (w) { w.done = true; }
  return DEMO_WISHES;
});
ipcMain.handle('wishes:edit', (_e, { id, text }) => {
  if (!DEMO) { store.editWish(id, text); return store.getWishes(); }
  const w = DEMO_WISHES.find(w => w.id === Number(id));
  if (w) w.text = text.trim();
  return DEMO_WISHES;
});
ipcMain.handle('wishes:move', (_e, { id, dir }) => {
  if (!DEMO) return store.moveWish(id, dir);
  const i = DEMO_WISHES.findIndex(w => w.id === Number(id));
  const j = i + dir;
  if (i >= 0 && j >= 0 && j < DEMO_WISHES.length) [DEMO_WISHES[i], DEMO_WISHES[j]] = [DEMO_WISHES[j], DEMO_WISHES[i]];
  return DEMO_WISHES;
});
ipcMain.handle('wishes:doneToday', () => DEMO ? [] : store.getDoneToday());
ipcMain.handle('notes:get', () => DEMO ? DEMO_NOTES : store.getNotes());
ipcMain.handle('notes:save', (_e, { text }) => { if (!DEMO) return store.saveNotes(text); return { ok: true }; });
ipcMain.handle('timers:get', () => DEMO ? DEMO_TIMERS : store.getTimers());
ipcMain.handle('timers:add', (_e, { label, minutes }) => { if (!DEMO) return store.addTimer(label, minutes); DEMO_TIMERS.unshift({ id: Date.now(), label, minutes, remaining: minutes * 60 }); return DEMO_TIMERS; });
ipcMain.handle('timers:del', (_e, { id }) => { if (!DEMO) return store.delTimer(id); const i = DEMO_TIMERS.findIndex(t => t.id === Number(id)); if (i >= 0) DEMO_TIMERS.splice(i, 1); return DEMO_TIMERS; });
ipcMain.handle('roadmap:get', () => { try { return DEMO ? DEMO_ROADMAP : parseRoadmap(); } catch { return []; } });
ipcMain.handle('plan:detail', (_e, { entry }) => {
  if (DEMO) return entry && entry.includes('技能精进') ? DEMO_PLAN_DETAIL : { ok: false, nodes: [], total: 0, done: 0 };
  try { return parsePlanDetail(entry); } catch (e) { return { ok: false, nodes: [], total: 0, done: 0, error: e.message }; }
});
ipcMain.handle('translate:langs', () => LANGS);
ipcMain.handle('translate:do', async (_e, { text, sl, tl }) => {
  if (DEMO) return { ok: true, translated: `【demo】${text}（翻译功能演示，正式模式走真实接口）`, detected: 'zh-CN', tl };
  try { return await translate({ text, sl, tl }); }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('app:quit', () => app.quit());

// 截图驱动模式：页面加载完成即通知 shot 流程
ipcMain.on('shot-ready', () => {});

// 托盘：菜单栏右侧图标，点开即展开面板（第二入口）
function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  );
  tray = new Tray(icon);
  tray.setToolTip('⚡ 效能边缘面板（点按展开）');
  const menu = Menu.buildFromTemplate([
    { label: '展开面板', click: () => dock ? dock.expand() : win?.show() },
    { label: '收起', click: () => dock && dock.collapse() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => dock ? dock.expand() : win?.show());
}

// 全局快捷键：已按用户要求移除（2026-10-22 17:28，与 VSCode 等工具冲突）
// 唤出面板入口：左下角热区 + 托盘 ⚡ 图标

app.whenReady().then(() => {
  createWindow();
  createTray();
  app.dock.hide();
});

app.on('will-quit', () => {
  if (watcher) watcher.close();
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => app.quit());
