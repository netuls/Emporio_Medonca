// ── Pix (BR Code / Copia e Cola) ──
function pixCRC(s) {
  let c = 0xFFFF;
  for (let i = 0; i < s.length; i++) {
    c ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF;
  }
  return c.toString(16).toUpperCase().padStart(4, '0');
}
function gerarPix(chave, nome, cidade, valor, txid) {
  const f = (id, v) => id + String(v.length).padStart(2, '0') + v;
  const limpa = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().trim();
  const conta = f('00', 'br.gov.bcb.pix') + f('01', chave);
  const tx = String(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  let p = f('00', '01') + f('26', conta) + f('52', '0000') + f('53', '986');
  if (valor > 0) p += f('54', Number(valor).toFixed(2));
  p += f('58', 'BR') + f('59', limpa(nome).slice(0, 25)) + f('60', limpa(cidade).slice(0, 15)) + f('62', f('05', tx));
  p += '6304';
  return p + pixCRC(p);
}

// ── Aparência do site: cor de destaque, cor de realce e letra dos títulos (config/loja → visual) ──
// Sem "visual" salvo, valem as cores e a letra que o gerador colocou no style.css e em LOJA.visual.
const VISUAL_FONTES = [
  { id: 'padrao', fam: "'Plus Jakarta Sans',system-ui,sans-serif", g: '' },
  { id: 'playfair', fam: "'Playfair Display',serif", g: 'Playfair+Display:wght@600;700;800' },
  { id: 'cormorant', fam: "'Cormorant Garamond',serif", g: 'Cormorant+Garamond:wght@600;700' },
  { id: 'montserrat', fam: "'Montserrat',sans-serif", g: 'Montserrat:wght@600;700;800' },
  { id: 'poppins', fam: "'Poppins',sans-serif", g: 'Poppins:wght@600;700' },
  { id: 'bebas', fam: "'Bebas Neue',sans-serif", g: 'Bebas+Neue' }
];
const VISUAL = (() => {
  const raiz = document.documentElement, ok = h => /^#[0-9a-f]{6}$/i.test(h || ''), rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (h, alvo, t) => '#' + rgb(h).map(v => Math.round(v + (alvo - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
  const lum = h => { const [r, g, b] = rgb(h).map(v => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const VARS = ['--ac', '--ac-d', '--ac-t', '--on', '--gold', '--ag', '--fonte'];
  function aplicar(v) {
    VARS.forEach(k => raiz.style.removeProperty(k));
    if (!v) return;
    const st = (k, x) => raiz.style.setProperty(k, x);
    if (ok(v.ac)) { st('--ac', v.ac); st('--ac-d', v.ac); st('--ac-t', mix(v.ac, 255, 0.92)); st('--on', lum(v.ac) > 0.6 ? '#111' : '#fff'); st('--ag', 'linear-gradient(135deg,' + mix(v.ac, 255, 0.1) + ',' + mix(v.ac, 0, 0.35) + ')'); }
    if (ok(v.gold)) st('--gold', v.gold);
    const f = VISUAL_FONTES.find(x => x.id === v.fonte);
    if (f) {
      st('--fonte', f.fam);
      if (f.g && !document.getElementById('vf-' + f.id)) { const l = document.createElement('link'); l.id = 'vf-' + f.id; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=' + f.g + '&display=swap'; document.head.appendChild(l); }
    }
  }
  return { aplicar };
})();
// Acompanha o que o painel salvou (vale para o site e para o painel)
if (typeof db !== 'undefined') db.collection('config').doc('loja').onSnapshot(s => VISUAL.aplicar((s.data() || {}).visual), () => {});
