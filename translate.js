// 翻译引擎：谷歌翻译公开接口（主进程请求，绕开渲染层 CORS）
// GET https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=<目标>&dt=t&q=<文本>
// 返回嵌套数组：[[[译文, 原文, ...], ...], null, <检测到的源语言>, ...]

const { execFile } = require('child_process');

// 常用语言对（面板下拉选项）
const LANGS = [
  { code: 'zh-CN', name: '中文(简)' },
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
  { code: 'es', name: '西语' },
  { code: 'ru', name: '俄语' },
];

function translate({ text, sl = 'auto', tl = 'zh-CN' }) {
  return new Promise((resolve, reject) => {
    if (!text || !text.trim()) { reject(new Error('空文本')); return; }
    // 谷歌对 node TLS 指纹限流（429），系统 curl 走 HTTP/2 可通——用 execFile curl 发请求
    const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text.slice(0, 1500))}`;
    execFile('curl', ['-s', '-m', '8', '-o', '-', '-w', '\n%{http_code}', u], { timeout: 10000 }, (err, stdout) => {
      if (err) { reject(new Error('网络错误: ' + (err.message || err))); return; }
      const idx = stdout.lastIndexOf('\n');
      const code = stdout.slice(idx + 1).trim();
      const body = stdout.slice(0, idx);
      if (code === '429') { reject(new Error('接口限流（429），稍等几秒再试')); return; }
      if (code !== '200') { reject(new Error('HTTP ' + code)); return; }
      try {
        const data = JSON.parse(body);
        const translated = (data[0] || []).map(seg => seg[0]).join('');
        const detected = data[2] || sl;
        resolve({ ok: true, translated, detected, tl });
      } catch (e) { reject(new Error('解析失败（响应非 JSON）')); }
    });
  });
}

module.exports = { translate, LANGS };
