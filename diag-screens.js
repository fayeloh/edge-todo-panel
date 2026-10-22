// 一次性诊断：打印所有屏的 workArea + 左下角热区判定参数
const { app, screen } = require('electron');
app.whenReady().then(() => {
  const all = screen.getAllDisplays();
  all.forEach(d => {
    const wa = d.workArea;
    const corner = { x: wa.x + 7, y: wa.y + wa.height - 30 };
    console.log(`display=${d.id} workArea=x:${wa.x} y:${wa.y} w:${wa.width} h:${wa.height}`);
    console.log(`  左下角热区: x<=${wa.x + 14} 且 y>=${wa.y + wa.height - 240}`);
  });
  const p = screen.getCursorScreenPoint();
  console.log('当前光标:', p.x, p.y);
  app.quit();
});
