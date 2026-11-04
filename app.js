/* ============ 配得感测试 · 逻辑 ============ */
(function () {
  const $ = id => document.getElementById(id);
  const state = { i: 0, answers: new Array(QUESTIONS.length).fill(null), scores: null, type: null };

  /* ---------- 主题色 ---------- */
  const DEFAULT_THEME = {
    accent: '#B8573F', accent2: '#C97B5E', bg: '#FFFFFF', bgTop: '#FFFFFF',
    soft: '#F1E3D8', card: '#FFFDF9', band: '#F6E7DE', bandInk: '#7A3B2A',
  };

  function applyTheme(key) {
    const th = Object.assign({}, DEFAULT_THEME, (typeof THEMES !== 'undefined' && THEMES[key]) || {});
    const r = document.documentElement.style;
    r.setProperty('--accent', th.accent);
    r.setProperty('--accent-2', th.accent2);
    r.setProperty('--bg', th.bg);
    r.setProperty('--bg-top', th.bgTop);
    r.setProperty('--soft', th.soft);
    r.setProperty('--card', th.card);
    r.setProperty('--band', th.band);
    r.setProperty('--band-ink', th.bandInk);
  }

  /* ---------- 答题过程中的背景渐变 ---------- */
  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgb2hex(a) {
    return '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function mixHex(a, b, t) {
    const A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex(A.map((v, i) => v + (B[i] - v) * t));
  }

  /* --- HSL：混合颜色时保住明度和彩度，避免 RGB 直接平均后发灰 --- */
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    if (s === 0) { const v = l * 255; return [v, v, v]; }
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      hue2rgb(p, q, h + 1 / 3) * 255,
      hue2rgb(p, q, h) * 255,
      hue2rgb(p, q, h - 1 / 3) * 255,
    ];
  }
  function hex2hsl(h) { const c = hex2rgb(h); return rgb2hsl(c[0], c[1], c[2]); }
  function hsl2hex(h, s, l) { return rgb2hex(hsl2rgb(h, s, l)); }

  // 连续色相：按「离满分还差多少」给五个维度加权，再在 HSL 空间里混。
  // 用 HSL 而不是 RGB 平均，是为了保住明度与彩度——否则五种粉彩一混就发灰。
  function currentBlend(scores) {
    let sum = 0;
    const ws = DIMENSIONS.map(function (d) {
      const s = (scores && typeof scores[d.key] === 'number') ? scores[d.key] : 50;
      const w = Math.pow(Math.max(1, 100 - s) / 100, 1.8);
      sum += w;
      return w;
    });

    let x = 0, y = 0, S = 0, L = 0;
    DIMENSIONS.forEach(function (d, i) {
      const th = (typeof THEMES !== 'undefined' && THEMES[d.key]) || DEFAULT_THEME;
      const hsl = hex2hsl(th.bg);
      const k = ws[i] / sum;
      const rad = hsl[0] * Math.PI / 180;
      x += Math.cos(rad) * k;
      y += Math.sin(rad) * k;
      S += hsl[1] * k;
      L += hsl[2] * k;
    });

    const h = Math.atan2(y, x) * 180 / Math.PI;
    return hsl2hex(h, S, L);
  }

  // 最终底色 = 五维混色（主体） + 类型色（拉回一点，保证还认得出是哪一类）
  // 所以同样是「先还账的人」，分数不同，颜色会有细微差别。
  function finalBg(scores, typeKey) {
    const th = Object.assign({}, DEFAULT_THEME, (typeof THEMES !== 'undefined' && THEMES[typeKey]) || {});
    return mixHex(currentBlend(scores || {}), th.bg, 0.15);
  }

  // 当前这页的底色 = 白 → 最终底色（淡入）
  // 最后一页与结果页用同一个函数算，天然同色，不会有跳变。
  function setQuizBg(typeKey, scores, progress) {
    const p0 = Math.max(0, Math.min(1, progress));
    const th = Object.assign({}, DEFAULT_THEME, (typeof THEMES !== 'undefined' && THEMES[typeKey]) || {});

    const target = finalBg(scores, typeKey);
    const p = Math.pow(p0, 0.8);
    const col = mixHex('#FFFFFF', target, p);
    document.body.style.backgroundColor = col;

    // 强调色同步漂移，避免进度条跟底色打架
    const root = document.documentElement.style;
    root.setProperty('--bg', col);
    root.setProperty('--accent', mixHex(DEFAULT_THEME.accent, th.accent, p));
    root.setProperty('--accent-2', mixHex(DEFAULT_THEME.accent2, th.accent2, p));
    root.setProperty('--soft', mixHex(DEFAULT_THEME.soft, th.soft, p));
  }

  /* ---------- 屏幕切换 ---------- */
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    $('topbar').hidden = id !== 'quiz';
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  /* ---------- 答题 ---------- */
  function renderQuestion() {
    const q = QUESTIONS[state.i];
    $('qIndex').textContent = `第 ${state.i + 1} 题`;
    $('qText').textContent = q.text;

    const box = $('opts');
    box.innerHTML = '';
    OPTIONS.forEach(o => {
      const b = document.createElement('button');
      b.className = 'opt' + (state.answers[state.i] === o.value ? ' sel' : '');
      b.innerHTML = `<span class="dot"></span><span>${o.label}</span>`;
      b.onclick = () => {
        state.answers[state.i] = o.value;
        box.querySelectorAll('.opt').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        setTimeout(() => {
          if (state.i < QUESTIONS.length - 1) { state.i++; renderQuestion(); }
          else finish();
        }, 220);
      };
      box.appendChild(b);
    });

    $('btnBack').style.visibility = state.i === 0 ? 'hidden' : 'visible';
    $('barFill').style.width = ((state.i) / QUESTIONS.length * 100) + '%';
    $('barText').textContent = `${state.i + 1} / ${QUESTIONS.length}`;

    // 背景色跟着「已经答过的题」走
    const c = compute();
    setQuizBg(c.type, c.scores, state.i / QUESTIONS.length);
  }

  $('btnStart').onclick = () => { state.i = 0; show('quiz'); renderQuestion(); };
  $('btnBack').onclick = () => { if (state.i > 0) { state.i--; renderQuestion(); } };

  // 进入测试页前先回到纯白
  document.body.style.backgroundColor = '#FFFFFF';

  /* ---------- 计分 ---------- */
  function compute() {
    const sums = {}, counts = {};
    DIMENSIONS.forEach(d => { sums[d.key] = 0; counts[d.key] = 0; });

    QUESTIONS.forEach((q, idx) => {
      const raw = state.answers[idx] || 3;
      const v = q.reverse ? (6 - raw) : raw;   // 反向题翻转
      sums[q.dim] += v; counts[q.dim]++;
    });

    const scores = {};
    DIMENSIONS.forEach(d => {
      const avg = sums[d.key] / counts[d.key];          // 1..5
      scores[d.key] = Math.round((avg - 1) / 4 * 100);  // 0..100
    });

    const overall = Math.round(
      DIMENSIONS.reduce((a, d) => a + scores[d.key], 0) / DIMENSIONS.length
    );

    // 判定卡点：差异足够大 → 取最低维度；差异过小 → 归入「均衡」型
    const vals = DIMENSIONS.map(d => scores[d.key]);
    const spread = Math.max.apply(null, vals) - Math.min.apply(null, vals);
    let type;
    if (spread <= 8) {
      type = overall >= 55 ? 'flatHigh' : 'flatLow';
    } else {
      type = DIMENSIONS[0].key;
      DIMENSIONS.forEach(d => { if (scores[d.key] < scores[type]) type = d.key; });
    }

    return { scores, overall, type, spread };
  }

  function finish() {
    $('barFill').style.width = '100%';
    const r = compute();
    state.scores = r.scores; state.overall = r.overall; state.type = r.type;
    renderResult(r);
    show('result');
  }

  /* ---------- 结果渲染 ---------- */
  function renderResult(r) {
    const t = TYPES[r.type];
    // 与最后一题同一个函数 → 同色收尾；同时因为混了五维分数，每个人的结果色都有细微差别
    document.body.style.backgroundColor = finalBg(r.scores, r.type);
    applyTheme(r.type);

    // 数字滚动
    const el = $('scoreNum');
    let n = 0;
    const step = Math.max(1, Math.round(r.overall / 26));
    const timer = setInterval(() => {
      n = Math.min(r.overall, n + step);
      el.textContent = n;
      if (n >= r.overall) clearInterval(timer);
    }, 26);

    const vlines = Array.isArray(t.verdict) ? t.verdict : [t.verdict];
    $('verdict').innerHTML = vlines.map((l, i) => `<span class="vl${i}">${l}</span>`).join('');
    $('typeName').textContent = '你属于「' + t.name + '」';
    $('typeOrigin').textContent = t.origin;
    $('costBand').textContent = t.cost;

    const sl = $('scenesList');
    sl.innerHTML = '';
    t.scenes.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      sl.appendChild(li);
    });

    // 维度条
    const list = $('dimsList');
    list.innerHTML = '';
    DIMENSIONS.forEach(d => {
      const v = r.scores[d.key];
      const li = document.createElement('li');
      li.innerHTML = `<span class="dn">${d.name}</span>
        <span class="dbar"><i style="width:0%"></i></span>
        <span class="dv">${v}</span>`;
      list.appendChild(li);
      requestAnimationFrame(() => {
        setTimeout(() => { li.querySelector('.dbar i').style.width = v + '%'; }, 60);
      });
    });

    drawRadar(r.scores);

    // 修复路径（完全开放，无需解锁）
    $('typeWhy').textContent = t.rebuild;

    const ol = $('stepsList');
    ol.innerHTML = '';
    t.steps.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      ol.appendChild(li);
    });

    $('typeAction').textContent = t.action;
  }

  /* ---------- 雷达图 ---------- */
  function drawRadar(scores) {
    const svg = $('radar');
    const cx = 150, cy = 142, R = 96;
    const N = DIMENSIONS.length;
    const pt = (i, ratio) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / N;
      return [cx + Math.cos(a) * R * ratio, cy + Math.sin(a) * R * ratio];
    };

    let html = '';
    // 网格
    [0.25, 0.5, 0.75, 1].forEach(r => {
      const pts = DIMENSIONS.map((_, i) => pt(i, r).join(',')).join(' ');
      html += `<polygon points="${pts}" fill="none" stroke="#E8DFD3" stroke-width="1"/>`;
    });
    // 轴线
    DIMENSIONS.forEach((_, i) => {
      const [x, y] = pt(i, 1);
      html += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#EDE4D8" stroke-width="1"/>`;
    });
    // 数据面
    const dpts = DIMENSIONS.map((d, i) => pt(i, Math.max(0.06, scores[d.key] / 100)).join(',')).join(' ');
    html += `<polygon points="${dpts}" fill="rgba(184,87,63,.18)" stroke="#B8573F" stroke-width="2" stroke-linejoin="round"/>`;
    // 顶点
    DIMENSIONS.forEach((d, i) => {
      const [x, y] = pt(i, Math.max(0.06, scores[d.key] / 100));
      html += `<circle cx="${x}" cy="${y}" r="3.5" fill="#B8573F"/>`;
    });
    // 标签
    DIMENSIONS.forEach((d, i) => {
      const [x, y] = pt(i, 1.24);
      const anchor = Math.abs(x - cx) < 6 ? 'middle' : (x > cx ? 'start' : 'end');
      html += `<text x="${x}" y="${y + 4}" font-size="11.5" fill="#8A7F74" text-anchor="${anchor}">${d.name}</text>`;
    });

    svg.innerHTML = html;
  }

  /* ---------- 分享图 ---------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrap(ctx, text, x, y, maxW, lh) {
    let line = '', yy = y;
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW && line) {
        ctx.fillText(line, x, yy); line = ch; yy += lh;
      } else line += ch;
    }
    if (line) { ctx.fillText(line, x, yy); yy += lh; }
    return yy;
  }

  function hexA(h, a) {
    const c = hex2rgb(h);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  // 分享图上的五维雷达
  function drawShareRadar(ctx, cx, cy, R, scores, th) {
    const N = DIMENSIONS.length;
    const pt = (i, ratio) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / N;
      return [cx + Math.cos(a) * R * ratio, cy + Math.sin(a) * R * ratio];
    };

    // 网格
    [0.25, 0.5, 0.75, 1].forEach(r => {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const p = pt(i, r);
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(60,45,30,.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 轴线
    ctx.strokeStyle = 'rgba(60,45,30,.10)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < N; i++) {
      const p = pt(i, 1);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p[0], p[1]); ctx.stroke();
    }

    // 数据面
    const val = d => Math.max(0.06, (scores && scores[d.key] || 0) / 100);
    ctx.beginPath();
    DIMENSIONS.forEach((d, i) => {
      const p = pt(i, val(d));
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fillStyle = hexA(th.accent, 0.20);
    ctx.fill();
    ctx.strokeStyle = th.accent;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 顶点
    DIMENSIONS.forEach((d, i) => {
      const p = pt(i, val(d));
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4.2, 0, Math.PI * 2);
      ctx.fillStyle = th.accent;
      ctx.fill();
    });

    // 标签
    DIMENSIONS.forEach((d, i) => {
      const p = pt(i, 1.17);
      ctx.fillStyle = '#6E6355';
      ctx.font = '25px -apple-system,"PingFang SC",sans-serif';
      ctx.textAlign = Math.abs(p[0] - cx) < 8 ? 'center' : (p[0] > cx ? 'left' : 'right');
      ctx.textBaseline = 'middle';
      ctx.fillText(d.name, p[0], p[1]);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // 判决两句话：字号自适应，保证整体不超过 3 行，给下面的雷达留位置
  function fitVerdictSize(ctx, lines, maxW) {
    for (let size = 50; size >= 34; size -= 4) {
      ctx.font = '600 ' + size + 'px "Songti SC",Georgia,serif';
      let rows = 0;
      lines.forEach(l => {
        let n = 1, cur = '';
        for (const ch of l) {
          if (ctx.measureText(cur + ch).width > maxW && cur) { n++; cur = ch; }
          else cur += ch;
        }
        rows += n;
      });
      if (rows * size * 1.44 <= 178) return size;
    }
    return 34;
  }

  function drawShare() {
    const c = $('shareCanvas'), ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const t = TYPES[state.type];
    const th = Object.assign({}, DEFAULT_THEME, (typeof THEMES !== 'undefined' && THEMES[state.type]) || {});

    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.bgTop);
    g.addColorStop(1, th.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 细边框
    ctx.strokeStyle = th.soft; ctx.lineWidth = 2;
    roundRect(ctx, 28, 28, W - 56, H - 56, 26); ctx.stroke();

    ctx.textAlign = 'left';
    // 顶部标识
    ctx.fillStyle = '#A08F7E';
    ctx.font = '22px -apple-system,"PingFang SC",sans-serif';
    ctx.fillText('配得感测试', 68, 96);

    // 判决（主视觉）——两行：第一行铺垫，第二行落刀
    const vlines = Array.isArray(t.verdict) ? t.verdict : [t.verdict];
    const vsize = fitVerdictSize(ctx, vlines, W - 128);
    const vlh = Math.round(vsize * 1.44);
    let y = 208;
    vlines.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? '#26211D' : th.accent;
      ctx.font = '600 ' + vsize + 'px "Songti SC",Georgia,serif';
      y = wrap(ctx, line, 64, y, W - 128, vlh);
    });

    // 类型名
    ctx.fillStyle = th.accent;
    ctx.font = '600 33px "Songti SC",Georgia,serif';
    ctx.fillText('——「' + t.name + '」', 64, y + 30);

    // 代价句
    ctx.fillStyle = '#6E6355';
    ctx.font = '27px "Songti SC",Georgia,serif';
    y = wrap(ctx, t.cost, 64, y + 96, W - 128, 44);

    // 分隔线
    ctx.strokeStyle = th.soft; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(64, y + 26); ctx.lineTo(W - 64, y + 26); ctx.stroke();

    // 雷达图：去掉二维码后，整块下半部都给它
    const areaTop = y + 26, areaBottom = H - 62;
    const R = Math.min(186, ((areaBottom - areaTop) / 2 - 14) / 1.18);
    drawShareRadar(ctx, W / 2, (areaTop + areaBottom) / 2, R, state.scores, th);

    $('modal').hidden = false;
  }

  $('btnShare').onclick = drawShare;
  $('btnCloseModal').onclick = () => { $('modal').hidden = true; };
  $('modal').onclick = e => { if (e.target === $('modal')) $('modal').hidden = true; };

  /* ---------- 重测 ---------- */
  $('btnRestart').onclick = () => {
    state.i = 0; state.answers.fill(null); state.scores = null; state.type = null;
    applyTheme(null);
    document.body.style.backgroundColor = '#FFFFFF';
    show('intro');
  };

  /* ---------- 授权码 ---------- */
  const norm = s => String(s || '').trim().toUpperCase().replace(/\s+/g, '');

  function hasAccess() {
    try {
      const saved = norm(localStorage.getItem(STORAGE_KEY));
      return !!saved && CODES.map(norm).indexOf(saved) >= 0;
    } catch (e) { return false; }
  }

  $('btnUnlockCode').onclick = () => {
    const v = norm($('codeInput').value);
    if (!v) { $('gateErr').textContent = '请先输入授权码'; return; }
    if (CODES.map(norm).indexOf(v) >= 0) {
      try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {}
      $('gateErr').textContent = '';
      show('intro');
    } else {
      $('gateErr').textContent = '授权码不正确，请检查后重试';
    }
  };

  $('codeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('btnUnlockCode').click();
  });

  // 首屏：有授权记录直接进封面，否则停在输码页
  show(hasAccess() ? 'intro' : 'gate');
})();

