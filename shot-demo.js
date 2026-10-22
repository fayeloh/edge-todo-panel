// 自动截图：DEMO 数据 → 逐 tab 截图（含计划展开态）
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');

// ---- 复用 main.js 的 demo IPC（简化版，直接在本进程注册）----
process.env.DEMO_PANEL = '1';
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

ipcMain.handle('todos:get', () => ({ ok: true, date: '2026-10-22', todos: DEMO_TODOS }));
ipcMain.handle('todos:toggle', () => ({ ok: true }));
ipcMain.handle('wishes:get', () => DEMO_WISHES);
ipcMain.handle('wishes:add', () => DEMO_WISHES);
ipcMain.handle('wishes:del', () => DEMO_WISHES);
ipcMain.handle('wishes:achieve', () => DEMO_WISHES);
ipcMain.handle('notes:get', () => DEMO_NOTES);
ipcMain.handle('notes:save', () => ({ ok: true }));
ipcMain.handle('timers:get', () => DEMO_TIMERS);
ipcMain.handle('timers:add', () => DEMO_TIMERS);
ipcMain.handle('timers:del', () => DEMO_TIMERS);
ipcMain.handle('roadmap:get', () => DEMO_ROADMAP);
ipcMain.handle('plan:detail', (_e, { entry }) => entry && entry.includes('技能精进') ? DEMO_PLAN_DETAIL : { ok: false, nodes: [], total: 0, done: 0 });
ipcMain.handle('app:quit', () => app.quit());

let win;
const OUT = process.argv[2] || '/tmp';
const steps = [
  ['todos', null, 'demo_todos.png'],
  ['plans', null, 'demo_plans.png'],
  ['plans', `(() => { document.querySelectorAll('.plan')[0].onclick(); return true; })()`, 'demo_plans_expanded.png'],
  ['wishes', null, 'demo_wishes.png'],
  ['notes', null, 'demo_notes.png'],
  ['timers', null, 'demo_timers.png'],
];

app.whenReady().then(async () => {
  win = new BrowserWindow({
    width: 420, height: 720, x: 200, y: 150,
    show: true, backgroundColor: '#111116',
    webPreferences: { preload: `${__dirname}/preload.js`, contextIsolation: true },
  });
  win.webContents.on('console-message', (_e, _lvl, msg) => console.log('[renderer]', msg));
  await win.loadFile(`${__dirname}/renderer/index.html`);
  await new Promise(r => setTimeout(r, 800));
  for (const [tab, extraJs, file] of steps) {
    try { await win.webContents.executeJavaScript(`document.querySelector('nav button[data-tab="${tab}"]').click(); true`); } catch(e) { console.error('tab click fail', e.message); }
    await new Promise(r => setTimeout(r, 600));
    if (extraJs) { try { await win.webContents.executeJavaScript(extraJs); } catch(e) { console.error('extra fail', e.message); } await new Promise(r => setTimeout(r, 700)); }
    const img = await win.webContents.capturePage();
    fs.writeFileSync(`${OUT}/${file}`, img.toPNG());
    console.log('saved', file);
  }
  app.exit(0);
});
