// Q4.md 双向同步引擎（重建版，与此前交付版一致）
const fs = require('fs');
const path = require('path');

const Q4_PATH = path.join(
  process.env.HOME,
  'Documents/Obsidian Vault/MAi/08_知识资料与AI产物/高效能系统/2026-Q4.md'
);

function todayHeader() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 找到今天的日期 section（# YYYY-MM-DD 或 ## YYYY-MM-DD 开头）
function findTodaySection(lines) {
  const target = todayHeader();
  let start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^#{1,3}\s+(\d{4}-\d{2}-\d{2})/);
    if (h) {
      if (h[1] === target) { start = i; }
      else if (start >= 0) { end = i; break; }
    }
  }
  return { start, end };
}

// 解析今日 todos：- [ ] / - [x] 开头的行 + 1-3-5 级别识别
function parseTodayTodos() {
  const raw = fs.readFileSync(Q4_PATH, 'utf-8');
  const lines = raw.split('\n');
  const { start, end } = findTodaySection(lines);
  if (start < 0) return [];
  const todos = [];
  for (let i = start; i < end; i++) {
    const m = lines[i].match(/^(\s*)- \[( |x|X)\] (.+)$/);
    if (m) {
      const text = m[3];
      let lvl = 3;                                  // 默认中事
      if (/🔴|大事|^\*\*大/.test(text)) lvl = 1;
      else if (/🟡|中事/.test(text)) lvl = 3;
      else if (/🟢|小事/.test(text)) lvl = 5;
      todos.push({ lineIdx: i, checked: m[2] !== ' ', text });
    }
  }
  return todos.map(t => ({ ...t, lvl: t.lvl ?? 3 }));
}

// 按行号切换复选框状态（写回文件）
function toggleTodoByLine(lineIdx, checked) {
  const raw = fs.readFileSync(Q4_PATH, 'utf-8');
  const lines = raw.split('\n');
  const m = lines[lineIdx]?.match(/^(\s*)- \[( |x|X)\] (.+)$/);
  if (!m) return { ok: false, error: '行不匹配' };
  lines[lineIdx] = `${m[1]}- [${checked ? 'x' : ' '}] ${m[3]}`;
  fs.writeFileSync(Q4_PATH, lines.join('\n'));
  return { ok: true };
}

module.exports = { Q4_PATH, todayHeader, findTodaySection, parseTodayTodos, toggleTodoByLine };
