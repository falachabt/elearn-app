// Chimie : la couleur change et l'équation se complète au rythme de la voix.
window.CAS = window.CAS || {};
const hex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const mix = (a, b, p) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((x, i) => Math.round(x + (B[i] - x) * p)).join(',') + ')'; };
CAS.chimie = {
  init(root) {
    const pieces = ['\\mathrm{HCl}', '+\\ \\mathrm{NaOH}', '\\rightarrow', '\\mathrm{NaCl} + \\mathrm{H_2O}'];
    root.innerHTML = `
      <div class="box">
        <svg viewBox="0 0 920 1040" width="920" height="1040" style="position:absolute;left:0;top:0;overflow:visible">
          <line id="jet" x1="460" y1="60" x2="460" y2="200" stroke="#10B981" stroke-width="10" stroke-linecap="round" stroke-dasharray="24 18" opacity="0"/>
          <path d="M280 220 L640 220 L600 720 L320 720 Z" fill="var(--carte)" stroke="var(--encre)" stroke-width="8" stroke-linejoin="round"/>
          <path id="liq" d="M296 470 L624 470 L600 712 L320 712 Z" fill="#E6F4EE"/>
          <path d="M280 220 L640 220 L600 720 L320 720 Z" fill="none" stroke="var(--encre)" stroke-width="8" stroke-linejoin="round"/>
        </svg>
        <div id="etat" class="lab" style="position:absolute;left:0;top:760px;width:920px;text-align:center"></div>
        <div id="eq" style="position:absolute;left:0;top:860px;width:920px;display:flex;justify-content:center;gap:18px;align-items:center;flex-wrap:nowrap"></div>
      </div>`;
    const eq = root.querySelector('#eq');
    pieces.forEach((p, i) => {
      const s = document.createElement('div');
      s.className = 'piece'; s.dataset.i = i; s.style.opacity = 0;
      katex.render(p, s, { displayMode: false, throwOnError: false });
      eq.appendChild(s);
    });
    eq.querySelectorAll('.katex').forEach(k => { k.style.fontSize = '64px'; });
  },
  frame(t, T, root) {
    const p = Math.max(0, Math.min(1, (t - T.c3) / 2));
    root.querySelector('#liq').setAttribute('fill', mix('#E6F4EE', '#FF5FA2', p));
    root.querySelector('#etat').textContent = p > 0.5 ? 'Solution basique : rose' : 'Solution acide : incolore';
    root.querySelector('#jet').style.opacity = t >= T.c1 && t < T.c2 ? 1 : 0;
    root.querySelectorAll('.piece').forEach((el, i) => {
      el.style.opacity = t >= T.c2 + i * 0.8 ? 1 : 0;
    });
  }
};
