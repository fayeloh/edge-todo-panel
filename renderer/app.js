// 渲染层逻辑（重建版）：五 tab + 计划点击展开
const main = document.getElementById('main');
let curTab = 'todos';

// ---------- 工具 ----------
function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

// ---------- Tab 切换 ----------
document.querySelectorAll('nav button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    curTab = btn.dataset.tab;
    render();
  };
});
document.getElementById('btn-collapse').onclick = () => P.collapse();
document.getElementById('btn-quit').onclick = () => P.quit();

// ---------- 今日待办 ----------
async function renderTodos() {
  const r = await P.getTodos();
  if (!r.ok) {
    main.innerHTML = `<div class="empty">读不到 Q4.md<br>${escapeHtml(r.error || '')}</div>`;
    return;
  }
  if (!r.todos.length) {
    main.innerHTML = `<div class="empty">今天还没有带复选框的待办<br>去 Q4.md 补一段？</div><div class="date-line">📅 ${r.date}</div>`;
    return;
  }
  let html = `<div class="date-line">📅 ${r.date} · 勾选直接写回 Q4.md</div>`;
  for (const t of r.todos) {
    html += `<div class="todo lvl-${t.lvl ?? 3} ${t.checked ? 'done' : ''}">
      <input type="checkbox" ${t.checked ? 'checked' : ''} data-line="${t.lineIdx}">
      <div class="txt"><span class="lvl-tag">${t.lvl === 1 ? '大' : t.lvl === 5 ? '小' : '中'}</span>${escapeHtml(t.text)}</div>
    </div>`;
  }
  main.innerHTML = html;
  main.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.onchange = async () => {
      cb.disabled = true;
      await P.toggleTodo(Number(cb.dataset.line), cb.checked);
      render();
    };
  });
  // 复制待办：点文本区右侧 ⧉ 图标或双击文本复制全文
  main.querySelectorAll('.todo').forEach(el => {
    const txt = el.querySelector('.txt');
    const copyText = async () => {
      const raw = txt.textContent.replace(/⧉/, '').trim();
      try { await navigator.clipboard.writeText(raw); } catch {
        const ta = document.createElement('textarea');
        ta.value = raw; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
      }
      const hit = document.createElement('span');
      hit.className = 'copy-hit'; hit.textContent = '已复制';
      txt.appendChild(hit);
      setTimeout(() => hit.remove(), 1200);
    };
    txt.title = '双击复制全文';
    txt.ondblclick = e => { e.preventDefault(); copyText(); };
    txt.onclick = e => { if (e.target === txt && getSelection().toString()) return; };  // 选中文本时正常拖选
  });
}

// ---------- 计划进度（可点击展开节点明细）----------
let planDetailBusy = false;

async function renderPlans(main2) {
  const plans = await P.getRoadmap();
  if (!plans.length) {
    main.innerHTML = '<div class="empty">未解析到 ROADMAP.md 主线数据<br>具体节点请到对应文档查看</div>';
    return;
  }
  let html = '';
  for (const p of plans) {
    html += `<div class="plan" data-entry="${escapeAttr(p.entry || '')}">
      <div class="name">${escapeHtml(p.no)} ${escapeHtml(p.name)} <span class="plan-arrow">▸</span></div>
      ${p.status ? `<div class="status">${escapeHtml(p.status)}</div>` : ''}
      ${p.next ? `<div class="next">→ ${escapeHtml(p.next)}</div>` : ''}
      <div class="detail" style="display:none"></div>
    </div>`;
  }
  main.innerHTML = html + '<div class="empty" style="padding:10px 0">点击主线展开节点进度 · 细节到对应文档查看</div>';

  main.querySelectorAll('.plan').forEach(el => {
    el.onclick = async () => {
      const detail = el.querySelector('.detail');
      const arrow = el.querySelector('.plan-arrow');
      if (detail.style.display === 'block') {
        detail.style.display = 'none';
        arrow.textContent = '▸';
        return;
      }
      if (planDetailBusy) return;
      planDetailBusy = true;
      const entry = el.dataset.entry;
      detail.innerHTML = '<div class="empty" style="padding:8px 0">解析中…</div>';
      detail.style.display = 'block';
      arrow.textContent = '▾';
      let d = { ok: false, nodes: [], total: 0, done: 0 };
      if (entry) { try { d = await P.getPlanDetail(entry); } catch {} }
      let dh = '';
      if (d.ok && d.nodes.length) {
        const pct = d.total ? Math.round(d.done / d.total * 100) : 0;
        dh = `<div class="plan-progress-bar"><span style="width:${pct}%"></span></div>
              <div class="plan-progress-txt">${d.done}/${d.total} 完成（${pct}%）· ${d.doing || 0} 进行中</div>`;
        for (const n of d.nodes.slice(0, 25)) {
          const icon = n.status === 'done' ? '✅' : n.status === 'doing' ? '🟨' : '⬜';
          dh += `<div class="plan-node">${icon} ${n.id ? `<b>${escapeHtml(n.id)}</b> ` : ''}${escapeHtml(n.title)}</div>`;
        }
        if (d.nodes.length > 25) dh += `<div class="plan-node" style="color:#777">… 其余 ${d.nodes.length - 25} 项见文档</div>`;
      } else {
        dh = `<div class="plan-node" style="color:#777">未解析到节点清单（${escapeHtml(entry || '无详情入口')}）——到对应文档查看</div>`;
      }
      detail.innerHTML = dh;
      planDetailBusy = false;
    };
  });
}

// ---------- 愿望箱 ----------
async function renderWishes() {
  const wishes = await P.getWishes();
  let html = `<div class="input-row">
    <input id="wish-input" placeholder="想做的事…（回车添加）">
    <button id="wish-add">+</button>
  </div>`;
  if (!wishes.length) html += '<div class="empty">愿望箱是空的<br>攒点念想？</div>';
  for (const w of wishes) {
    html += `<div class="wish ${w.done ? 'done' : ''}">
      <div class="txt">${w.done ? '🎉' : '⭐'} ${escapeHtml(w.text)}</div>
      ${w.done ? '' : `<button class="ok" data-id="${w.id}" title="达成">✓</button>`}
      <button data-id="${w.id}" data-del="1" title="删除">✕</button>
    </div>`;
  }
  main.innerHTML = html;
  const input = document.getElementById('wish-input');
  const add = async () => {
    const t = input.value.trim();
    if (!t) return;
    await P.addWish(t);
    render();
  };
  input.onkeydown = e => { if (e.key === 'Enter') add(); e.stopPropagation(); };
  document.getElementById('wish-add').onclick = add;
  main.querySelectorAll('.wish button').forEach(btn => {
    btn.onclick = async () => {
      if (btn.dataset.del) await P.delWish(btn.dataset.id);
      else await P.achieveWish(btn.dataset.id);
      render();
    };
  });
}

// ---------- 速记 ----------
let notesTimer = null;
async function renderNotes() {
  const text = await P.getNotes();
  main.innerHTML = `<textarea class="notes" id="notes" placeholder="想到什么记什么…（自动保存）">${escapeHtml(text)}</textarea>`;
  const ta = document.getElementById('notes');
  ta.oninput = () => {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => P.saveNotes(ta.value), 800);
  };
  ta.onkeydown = e => e.stopPropagation();
}

// ---------- 定时器 ----------
const timerStates = new Map();   // id -> { remaining, done, timer }
async function renderTimers() {
  const timers = await P.getTimers();
  let html = `<div class="input-row">
    <input id="t-label" placeholder="计时事项…">
    <input id="t-min" type="number" min="1" max="600" value="25" style="width:64px">
    <button id="t-add">+</button>
  </div>`;
  if (!timers.length) html += '<div class="empty">没有计时器<br>来个番茄钟？</div>';
  for (const t of timers) {
    const st = timerStates.get(t.id) || { remaining: t.minutes * 60, done: false };
    timerStates.set(t.id, st);
    html += `<div class="timer ${st.done ? 'done-t' : ''}" data-id="${t.id}">
      <div class="label">${escapeHtml(t.label)}</div>
      <div class="clock">${st.done ? '✓ 完成' : fmt(st.remaining)}</div>
      <button data-del="${t.id}" title="删除">✕</button>
    </div>`;
  }
  main.innerHTML = html;
  document.getElementById('t-add').onclick = async () => {
    const label = document.getElementById('t-label').value.trim() || '专注';
    const minutes = Number(document.getElementById('t-min').value) || 25;
    const list = await P.addTimer(label, minutes);
    list.forEach(t => { if (!timerStates.has(t.id)) timerStates.set(t.id, { remaining: t.minutes * 60, done: false }); });
    render();
  };
  ['t-label', 't-min'].forEach(id => {
    document.getElementById(id).onkeydown = e => { if (e.key === 'Enter') document.getElementById('t-add').click(); e.stopPropagation(); };
  });
  main.querySelectorAll('.timer button[data-del]').forEach(btn => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.del);
      const st = timerStates.get(id);
      if (st?.interval) clearInterval(st.interval);
      timerStates.delete(id);
      await P.delTimer(id);
      render();
    };
  });
  // 秒级走针（渲染层本地驱动）
  timers.forEach(t => {
    const st = timerStates.get(t.id);
    if (st && !st.done && !st.interval) {
      st.interval = setInterval(() => {
        if (curTab !== 'timers') return;
        st.remaining--;
        const el = main.querySelector(`.timer[data-id="${t.id}"] .clock`);
        if (st.remaining <= 0) {
          st.done = true;
          clearInterval(st.interval);
          if (el) { el.textContent = '✓ 完成'; el.parentElement.classList.add('done-t'); }
          new Notification('计时结束', { body: `${t.label} 时间到！` });
        } else if (el) el.textContent = fmt(st.remaining);
      }, 1000);
    }
  });
}
function fmt(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------- 翻译 ----------
let trLangs = [];
let trBusy = false;

async function renderTranslate() {
  if (!trLangs.length) { try { trLangs = await P.getLangs(); } catch { trLangs = [{ code: 'zh-CN', name: '中文(简)' }, { code: 'en', name: '英语' }]; } }
  const opts = l => trLangs.map(x => `<option value="${x.code}" ${x.code === l ? 'selected' : ''}>${x.name}</option>`).join('');
  main.innerHTML = `<div class="tr-box">
    <div class="tr-bar">
      <select id="tr-sl"><option value="auto">自动检测</option>${opts('zh-CN')}</select>
      <span class="arrow">→</span>
      <select id="tr-tl">${opts('zh-CN')}</select>
      <button id="tr-go">译</button>
    </div>
    <textarea class="tr-input" id="tr-in" placeholder="输入要翻译的文本，Ctrl+Enter 翻译（超过 1500 字符会截断）"></textarea>
    <div class="tr-output" id="tr-out" style="color:#777">译文出现在这里（可选中复制）</div>
    <div class="tr-meta" id="tr-meta"></div>
  </div>`;
  const input = document.getElementById('tr-in');
  const out = document.getElementById('tr-out');
  const meta = document.getElementById('tr-meta');
  const go = document.getElementById('tr-go');

  const doTr = async () => {
    const text = input.value.trim();
    if (!text || trBusy) return;
    trBusy = true; go.disabled = true; go.textContent = '…';
    const sl = document.getElementById('tr-sl').value;
    const tl = document.getElementById('tr-tl').value;
    out.style.color = '#777'; out.textContent = '翻译中…';
    const r = await P.doTranslate(text.slice(0, 1500), sl, tl);
    if (r.ok) {
      out.style.color = '#cde'; out.textContent = r.translated;
      meta.innerHTML = `检测语言: <b>${r.detected}</b> → 目标: <b>${r.tl}</b>${text.length > 1500 ? ' · 已截断' : ''}`;
    } else {
      out.style.color = '#e88'; out.textContent = '翻译失败: ' + (r.error || '未知错误');
      meta.textContent = '（可能是网络不通或接口限流，稍后重试）';
    }
    trBusy = false; go.disabled = false; go.textContent = '译';
  };
  go.onclick = doTr;
  input.onkeydown = e => {
    e.stopPropagation();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doTr(); }
  };
}

// ---------- 总渲染 ----------
function render() {
  ({ todos: renderTodos, plans: () => renderPlans(main), wishes: renderWishes, notes: renderNotes, timers: renderTimers, translate: renderTranslate })[curTab]();
}
P.onQ4Changed(() => { if (curTab === 'todos') render(); });
render();
// 截图驱动：首帧渲染完通知主进程（若在监听）
setTimeout(() => { try { require('electron') && null; } catch {} }, 0);
window.addEventListener('load', () => {
  if (window.__shotBridge) window.__shotBridge();
});
