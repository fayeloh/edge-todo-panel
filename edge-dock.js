// 边缘吸附引擎 v5.2：左下角热区触发 + 光标到哪块屏左下角面板就迁移到哪块屏
const { screen } = require('electron');

class EdgeDock {
  constructor(win, opts = {}) {
    this.win = win;
    this.pos = opts.position || 'bottom-left';
    this.peek = opts.peek ?? 8;
    this.hotzone = opts.hotzone ?? 14;         // 贴左缘判定宽度
    this.cornerH = opts.cornerHeight ?? 240;   // 左下角热区高度（只有这个角落能唤出）
    this.pw = opts.panelWidth ?? 380;
    this.ph = opts.panelHeight ?? 680;
    this.margin = opts.margin ?? 6;
    this.minW = opts.minWidth ?? 300;
    this.minH = opts.minHeight ?? 360;

    this.curW = this.pw;
    this.curH = this.ph;

    this.expanded = false;
    this.animating = false;
    this.timer = null;
    this.currentDisplayId = null;   // 面板（而非光标）当前所在屏
    this.resizeTimer = null;
  }

  cursorDisplay() {
    try {
      return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    } catch {
      return screen.getPrimaryDisplay();
    }
  }

  // 面板所在屏（bounds 一律基于它，保证面板不会因光标跑别的屏而漂移）
  targetDisplay() {
    const all = screen.getAllDisplays();
    return all.find(d => d.id === this.currentDisplayId) || this.cursorDisplay();
  }

  workArea() { return this.targetDisplay().workArea; }

  // 光标是否位于某屏左下角热区（贴左缘 + 底部 cornerH 范围）
  inCorner(pos, wa) {
    const left = this.pos.endsWith('left');
    const bottom = this.pos.startsWith('bottom');
    if (!left || !bottom) return false;   // 当前仅支持 bottom-left
    return pos.x <= wa.x + this.hotzone && pos.y >= wa.y + wa.height - this.cornerH;
  }

  bindResize() {
    this.win.on('resize', () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        if (this.win.isDestroyed()) return;
        const [w, h] = this.win.getSize();
        this.curW = Math.max(this.minW, w);
        this.curH = Math.max(this.minH, h);
        if (this.expanded) this.reanchor();
      }, 150);
    });
  }

  reanchor() {
    const wa = this.workArea();
    const w = Math.min(this.curW, wa.width - 2 * this.margin);
    const h = Math.min(this.curH, wa.height - 2 * this.margin);
    const y = wa.y + wa.height - h - this.margin;
    this.win.setBounds({ x: wa.x, y, width: w, height: h }, false);
  }

  collapsedBounds() {
    const wa = this.workArea();
    const h = Math.min(this.curH, wa.height - 2 * this.margin);
    const y = Math.max(wa.y, wa.y + wa.height - h - this.margin);
    return { x: wa.x - 2, y, width: this.peek + 2, height: h };
  }

  expandedBounds() {
    const wa = this.workArea();
    const w = Math.min(this.curW, wa.width - 2 * this.margin);
    const h = Math.min(this.curH, wa.height - 2 * this.margin);
    const y = Math.max(wa.y, wa.y + wa.height - h - this.margin);
    return { x: wa.x, y, width: w, height: h };
  }

  collapse() {
    if (!this.expanded || this.animating) return;
    this.animating = true;
    this.expanded = false;
    this.win.setBounds(this.collapsedBounds(), false);
    this.win.setIgnoreMouseEvents(false);
    setTimeout(() => { this.animating = false; }, 220);
  }

  expand() {
    if (this.expanded || this.animating) return;
    this.animating = true;
    this.expanded = true;
    this.expandedAt = Date.now();   // 冷却起点：展开后 600ms 内不判定收起
    this.win.setBounds(this.expandedBounds(), false);
    if (process.env.DOCK_DEBUG) {
      const b = this.win.getBounds();
      require('fs').appendFileSync('/tmp/dock_debug.log', `>>> EXPAND setBounds 后实际窗口: ${JSON.stringify(b)}\n`);
    }
    this.win.focus();
    setTimeout(() => { this.animating = false; }, 220);
  }

  start() {
    this.currentDisplayId = this.cursorDisplay().id;
    this.curW = Math.min(this.pw, this.workArea().width - 2 * this.margin);
    this.curH = Math.min(this.ph, this.workArea().height - 2 * this.margin);
    this.win.setBounds(this.collapsedBounds(), false);
    this.bindResize();
    this.timer = setInterval(() => this.poll(), 60);
  }

  poll() {
    if (this.animating) return;
    const pos = screen.getCursorScreenPoint();
    const disp = this.cursorDisplay();
    if (process.env.DOCK_DEBUG) require('fs').appendFileSync('/tmp/dock_debug.log', `t=${Date.now()%100000} pos=${pos.x},${pos.y} expanded=${this.expanded} inCorner=${this.inCorner(pos, disp.workArea)} disp=${disp.id} cur=${this.currentDisplayId}\n`);

    if (!this.expanded) {
      // 只有光标到达某块屏的左下角热区才动作
      if (this.inCorner(pos, disp.workArea)) {
        if (disp.id !== this.currentDisplayId) {
          this.currentDisplayId = disp.id;   // 光标到了另一块屏的左下角 → 面板迁移过去
        }
        this.expand();
      }
      // 光标只在别的屏瞎晃、没去左下角 → 面板原地不动（什么都不做）
    } else {
      if (Date.now() - (this.expandedAt || 0) < 600) return;   // 冷却期内不收起
      const b = this.win.getBounds();   // 用户可能拖动/缩放过，以实际 bounds 为准
      const out = pos.x < b.x - 20 || pos.x > b.x + b.width + 20 || pos.y < b.y - 20 || pos.y > b.y + b.height + 20;
      if (out) this.collapse();
    }
  }

  stop() { clearInterval(this.timer); }
}

module.exports = { EdgeDock };
