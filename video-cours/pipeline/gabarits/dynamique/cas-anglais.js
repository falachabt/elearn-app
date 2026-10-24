// Anglais : dialogue à deux voix, une bulle par réplique, au moment où elle est dite.
window.CAS = window.CAS || {};
CAS.anglais = {
  init(root) {
    root.innerHTML = `
      <div class="box">
        <div class="rond" style="left:40px;top:0;background:var(--marque);color:#0A0A0A">M</div>
        <div class="nom" style="left:170px;top:36px">Maya</div>
        <div class="rond" style="right:40px;top:0;background:var(--jaune);color:#0A0A0A">L</div>
        <div class="nom" style="right:170px;top:36px;text-align:right">Leo</div>
        <div class="bulle a" id="d1" style="left:40px;top:170px">Hey Leo, are you ready for the English exam tomorrow?</div>
        <div class="bulle b" id="d2" style="right:40px;top:460px;text-align:right">Almost! Can you help me with the past tense?</div>
        <div class="bulle a" id="d3" style="left:40px;top:750px">Sure. For yesterday, we say “I went”, not “I goed”.</div>
        <div class="bulle b" id="d4" style="right:40px;top:1000px;text-align:right">Got it. Thanks, Maya!</div>
      </div>`;
  },
  frame(t, T, root) {
    ['d1', 'd2', 'd3', 'd4'].forEach((id, i) => {
      const key = 'd' + (i + 1);
      const on = t >= T[key];
      const el = root.querySelector('#' + id);
      el.style.opacity = on ? 1 : 0;
      el.style.transform = on ? 'translateY(0)' : 'translateY(24px)';
    });
  }
};
