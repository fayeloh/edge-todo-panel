// 预加载桥：渲染层唯一 IPC 通道
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('P', {
  collapse: () => ipcRenderer.send('panel:collapse'),
  onQ4Changed: (cb) => ipcRenderer.on('q4-changed', cb),

  // ---- 今日待办（Q4.md 双向同步）----
  getTodos: () => ipcRenderer.invoke('todos:get'),
  toggleTodo: (lineIdx, checked) => ipcRenderer.invoke('todos:toggle', { lineIdx, checked }),

  // ---- 愿望箱 ----
  getWishes: () => ipcRenderer.invoke('wishes:get'),
  addWish: (text) => ipcRenderer.invoke('wishes:add', { text }),
  delWish: (id) => ipcRenderer.invoke('wishes:del', { id }),
  achieveWish: (id) => ipcRenderer.invoke('wishes:achieve', { id }),
  editWish: (id, text) => ipcRenderer.invoke('wishes:edit', { id, text }),
  moveWish: (id, dir) => ipcRenderer.invoke('wishes:move', { id, dir }),
  getDoneToday: () => ipcRenderer.invoke('wishes:doneToday'),

  // ---- 速记 ----
  getNotes: () => ipcRenderer.invoke('notes:get'),
  saveNotes: (text) => ipcRenderer.invoke('notes:save', { text }),

  // ---- 定时器 ----
  getTimers: () => ipcRenderer.invoke('timers:get'),
  addTimer: (label, minutes) => ipcRenderer.invoke('timers:add', { label, minutes }),
  delTimer: (id) => ipcRenderer.invoke('timers:del', { id }),

  // ---- 计划进度（8 条主线 ROADMAP 快照 + 点击展开明细）----
  getRoadmap: () => ipcRenderer.invoke('roadmap:get'),
  getPlanDetail: (entry) => ipcRenderer.invoke('plan:detail', { entry }),

  // ---- 翻译（谷歌翻译，主进程代理）----
  getLangs: () => ipcRenderer.invoke('translate:langs'),
  doTranslate: (text, sl, tl) => ipcRenderer.invoke('translate:do', { text, sl, tl }),

  quit: () => ipcRenderer.invoke('app:quit'),
});

// 截图驱动桥：页面 load 完通知主进程（shot 流程切换 tab 时逐张截图）
window.addEventListener('load', () => {
  try { ipcRenderer.send('shot-ready'); } catch {}
});
