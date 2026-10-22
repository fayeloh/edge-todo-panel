// ROADMAP 快照引擎：主线表格 + 点击展开的节点明细解析
const fs = require('fs');
const path = require('path');

const SYSTEM_DIR = path.join(
  process.env.HOME,
  'Documents/Obsidian Vault/MAi/08_知识资料与AI产物/高效能系统'
);
const ROADMAP_PATH = path.join(SYSTEM_DIR, 'ROADMAP.md');

const DONE = /✅/;
const DOING = /🟨|🔄|🟡/;
const TODO = /⬜|🟢|⏸️|💡/;

function parseRoadmap() {
  if (!fs.existsSync(ROADMAP_PATH)) return [];
  const lines = fs.readFileSync(ROADMAP_PATH, 'utf-8').split('\n');
  const items = [];
  for (const l of lines) {
    const m = l.match(/^\|\s*([①②③④⑤⑥⑦⑧\d]+)\s*\|\s*\*(.+?)\*\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (m) {
      items.push({
        no: m[1].trim(),
        name: m[2].trim().replace(/\*/g, ''),
        status: m[3].trim(),
        goal: m[4].trim().replace(/\*\*/g, ''),
        next: m[5].trim().replace(/\*\*/g, ''),
        entry: m[6].trim(),
      });
    }
  }
  return items;
}

function entryToDocPath(entry) {
  if (!entry) return null;
  const m = entry.match(/\]\(([^)]+\.md)\)/) || entry.match(/(\S+\.md)/);
  if (!m) return null;
  let p = m[1];
  if (p.startsWith('./')) p = path.join(SYSTEM_DIR, p.slice(2));
  else if (p.startsWith('../')) p = path.resolve(SYSTEM_DIR, p);
  else if (!p.startsWith('/')) p = path.join(SYSTEM_DIR, p);
  return fs.existsSync(p) ? p : null;
}

function parsePlanDetail(entry) {
  const docPath = entryToDocPath(entry);
  if (!docPath) return { ok: false, nodes: [], total: 0, done: 0 };
  const lines = fs.readFileSync(docPath, 'utf-8').split('\n');
  const nodes = [];
  const seen = new Set();

  for (const l of lines) {
    if (l.startsWith('|') && !/^\|[\s:|-]+\|?$/.test(l)) {
      const cells = l.split('|').map(c => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === ''));
      if (cells.length >= 3 && cells.some(c => DONE.test(c) || DOING.test(c) || TODO.test(c))) {
        if (/节点|主题|达成标准|状态|时长|进度|里程碑/.test(cells[0] + (cells[1] || ''))) continue;
        const statusCell = cells.find(c => DONE.test(c) || DOING.test(c) || TODO.test(c)) || '';
        const key = cells[0] + '|' + (cells[1] || '');
        if (!key.trim('|') || seen.has(key)) continue;
        seen.add(key);
        nodes.push({
          id: cells[0].replace(/\*/g, '').slice(0, 18),
          title: (cells[1] || cells[0]).replace(/\*\*/g, '').slice(0, 60),
          status: DONE.test(statusCell) ? 'done' : DOING.test(statusCell) ? 'doing' : 'todo',
        });
        continue;
      }
    }
    const t = l.match(/^\s*- \[([ xX])\]\s*(.+)$/);
    if (t && !l.trim().startsWith('<!--')) {
      const key = 'cb|' + t[2].slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      nodes.push({
        id: '',
        title: t[2].replace(/\*\*/g, '').slice(0, 60),
        status: t[1] === ' ' ? 'todo' : 'done',
      });
    }
  }
  const list = nodes.slice(0, 40);
  return {
    ok: true,
    doc: path.basename(docPath),
    nodes: list,
    total: list.length,
    done: list.filter(n => n.status === 'done').length,
    doing: list.filter(n => n.status === 'doing').length,
  };
}

module.exports = { parseRoadmap, parsePlanDetail, entryToDocPath };
