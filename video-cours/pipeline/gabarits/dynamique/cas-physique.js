// Physique : la chute se déroule au rythme de la voix (durée de la chute = phrase 2).
window.CAS = window.CAS || {};
CAS.physique = {
  init(root) {
    root.innerHTML = `
      <div class="box">
        <div class="form" id="form" style="top:0;left:0;width:100%"><div id="ft"></div></div>
        <svg viewBox="0 0 920 1040" width="920" height="1040" style="position:absolute;left:0;top:0;overflow:visible">
          <defs><marker id="fl" markerUnits="userSpaceOnUse" markerWidth="18" markerHeight="18" refX="9" refY="9" orient="auto"><path d="M0,0 L18,9 L0,18 z" fill="#0A0A0A"/></marker></defs>
          <line x1="0" y1="800" x2="920" y2="800" stroke="var(--encre)" stroke-width="6"/>
          <line x1="150" y1="200" x2="150" y2="800" stroke="var(--muet)" stroke-width="4" stroke-dasharray="14 12"/>
          <text x="90" y="200" class="lab">20 m</text>
          <text x="90" y="800" class="lab" dy="50">0 m</text>
          <circle id="bille" cx="460" cy="174" r="26" fill="#10B981" stroke="var(--encre)" stroke-width="6"/>
          <line id="vit" x1="520" y1="174" x2="520" y2="174" stroke="#FFD83D" stroke-width="10" marker-end="url(#fl)" stroke-linecap="round"/>
          <text id="vt" x="580" y="174" class="lab"></text>
          <text id="ht" x="580" y="240" class="lab"></text>
          <text id="tt" x="580" y="306" class="lab"></text>
        </svg>
      </div>`;
    katex.render('v = g\\,t \\qquad h = h_0 - \\tfrac{1}{2} g\\,t^2', root.querySelector('#ft'), { displayMode: true, throwOnError: false });
    root.querySelector('#form').style.opacity = 1;
    root.querySelector('#ft .katex').style.fontSize = '64px';
  },
  frame(t, T, root) {
    const k = clamp(t - T.p1, 0, 1e9);
    const span = T.p3 - T.p2;
    const s = t < T.p2 ? 0 : clamp((t - T.p2) / span * 2, 0, 2);
    const h = Math.max(0, 20 - 5 * s * s);
    const v = 10 * s;
    const cy = 774 - h * 30;
    root.querySelector('#bille').setAttribute('cy', cy);
    const vit = root.querySelector('#vit');
    const len = Math.min(v * 6, Math.max(0, 774 - cy - 26));
    vit.setAttribute('y1', cy); vit.setAttribute('y2', cy + len);
    vit.style.opacity = t >= T.p2 ? 1 : 0;
    const f = x => x.toFixed(1).replace('.', ',');
    root.querySelector('#tt').textContent = 't = ' + f(s) + ' s';
    root.querySelector('#ht').textContent = 'h = ' + f(h) + ' m';
    root.querySelector('#vt').textContent = 'v = ' + f(v) + ' m/s';
  }
};
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
