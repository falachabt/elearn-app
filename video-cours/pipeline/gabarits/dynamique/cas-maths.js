// Maths : la parabole se trace et les points apparaissent quand la voix les cite.
window.CAS = window.CAS || {};
const clamp01 = x => Math.max(0, Math.min(1, x));
const px = x => 80 + (x + 0.5) * 164;
const py = y => 60 + (6 - y) * 97.5;
CAS.maths = {
  init(root) {
    let d = '';
    for (let x = -0.5; x <= 4.5001; x += 0.05) {
      const y = x * x - 4 * x + 3;
      d += (d ? 'L' : 'M') + px(x).toFixed(1) + ' ' + py(y).toFixed(1);
    }
    root.innerHTML = `
      <div class="box">
        <div class="form" id="form" style="top:0;left:0"></div>
        <svg viewBox="0 0 920 1040" width="920" height="1040" style="position:absolute;left:0;top:0;overflow:visible">
          <line x1="0" y1="${py(0)}" x2="920" y2="${py(0)}" stroke="var(--encre)" stroke-width="4"/>
          <line x1="${px(0)}" y1="60" x2="${px(0)}" y2="860" stroke="var(--encre)" stroke-width="4"/>
          <text x="${px(0) - 36}" y="${py(0) + 44}" class="lab">0</text>
          <text x="${px(1) - 10}" y="${py(0) + 44}" class="lab">1</text>
          <text x="${px(3) - 10}" y="${py(0) + 44}" class="lab">3</text>
          <text x="${px(2) - 10}" y="${py(0) + 44}" class="lab" opacity="0">2</text>
          <path id="courbe" d="${d}" fill="none" stroke="#10B981" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
          <g id="sommet" opacity="0">
            <circle cx="${px(2)}" cy="${py(-1)}" r="18" fill="#FFD83D" stroke="var(--encre)" stroke-width="5"/>
            <text x="${px(2) + 34}" y="${py(-1) + 14}" class="lab">sommet (2 ; −1)</text>
          </g>
          <g id="r1" opacity="0"><circle cx="${px(1)}" cy="${py(0)}" r="18" fill="#FFD83D" stroke="var(--encre)" stroke-width="5"/></g>
          <g id="r2" opacity="0"><circle cx="${px(3)}" cy="${py(0)}" r="18" fill="#FFD83D" stroke="var(--encre)" stroke-width="5"/></g>
          <text id="l1" x="${px(1) - 60}" y="${py(0) - 40}" class="lab" opacity="0">x = 1</text>
          <text id="l2" x="${px(3) - 60}" y="${py(0) - 40}" class="lab" opacity="0">x = 3</text>
        </svg>
      </div>`;
    const form = root.querySelector('#form');
    form.innerHTML = '<div id="ft"></div>';
    katex.render('y = x^2 - 4x + 3', root.querySelector('#ft'), { displayMode: true, throwOnError: false });
    const c = root.querySelector('#courbe');
    this.L = c.getTotalLength();
    c.style.strokeDasharray = this.L;
    c.style.strokeDashoffset = this.L;
  },
  frame(t, T, root) {
    const set = (sel, on) => { const e = root.querySelector(sel); if (e) e.style.opacity = on ? 1 : 0; };
    set('#form', t >= T.m1);
    const c = root.querySelector('#courbe');
    c.style.strokeDashoffset = this.L * (1 - clamp01((t - (T.m1 + 1.5)) / 3));
    set('#sommet', t >= T.m2);
    set('#r1', t >= T.m3 + 1);
    set('#r2', t >= T.m3 + 1.4);
    set('#l1', t >= T.m4);
    set('#l2', t >= T.m4 + 0.8);
  }
};
