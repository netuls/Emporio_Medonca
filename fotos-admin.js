/* Fotos dos clientes no painel admin — carregado DEPOIS do admin.js.
   - Mostra as fotos tiradas ao finalizar o pedido (campo "foto" do pedido, guardado pelo site do cliente).
   - Cada foto fica visível por 24 horas; depois some do painel e é apagada do banco (o pedido continua, só perde a foto).
   - A limpeza roda ao abrir o painel e a cada 5 minutos enquanto ele estiver aberto. */
(function () {
  const DIA = 24 * 3600 * 1000;
  let iniciado = false, lista = [];

  const hora = ms => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const resta = ms => { const m = Math.max(0, Math.floor((DIA - (Date.now() - ms)) / 60000)); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'min'; };
  const msDe = p => p.criadoEm && p.criadoEm.toMillis ? p.criadoEm.toMillis() : null;

  function secao() {
    let s = document.getElementById('fotos-sec'); if (s) return s;
    const ref = document.getElementById('peds'), pai = ref && ref.closest('.sec');
    s = document.createElement('div'); s.className = 'sec'; s.id = 'fotos-sec';
    s.innerHTML = '<h2 class="pt">FOTOS DOS CLIENTES (24H)</h2><p class="rd">Foto tirada quando o cliente finaliza o pedido, para ajudar a identificar quem pediu. Cada foto some sozinha 24 horas depois. Para isso, a câmera precisa estar ligada em "Câmera do totem".</p><div id="fotosG" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px"></div>';
    if (pai) pai.insertAdjacentElement('afterend', s); else (document.getElementById('tP') || document.body).appendChild(s);
    return s;
  }

  function desenhar() {
    secao(); const G = document.getElementById('fotosG'); if (!G) return;
    const agora = Date.now();
    const vivas = lista.map(p => ({ p, t: msDe(p) })).filter(x => x.t && agora - x.t < DIA).sort((a, b) => b.t - a.t);
    G.innerHTML = vivas.length ? vivas.map(({ p, t }) => `<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--card)">
      <img src="${esc(p.foto)}" alt="Foto do cliente" data-foto="${esc(p.id)}" style="display:block;width:100%;aspect-ratio:1;object-fit:cover;cursor:zoom-in">
      <div style="padding:8px 10px;font-size:12px"><b>${p.numero ? 'Pedido nº ' + String(p.numero).padStart(2, '0') : 'Pedido'}</b><br>${esc((p.cliente && p.cliente.nome) || '')}<br><span style="color:var(--mut)">${hora(t)} · some em ${resta(t)}</span>
      <button class="ab r" data-del="${esc(p.id)}" style="display:block;margin-top:6px">Apagar agora</button></div></div>`).join('')
      : '<p class="rd">Nenhuma foto nas últimas 24 horas.</p>';
  }

  // Apaga a foto (só o campo; o pedido continua) dos pedidos com mais de 24 horas
  async function limpar() {
    const F = firebase.firestore.FieldValue, velhos = lista.filter(p => { const t = msDe(p); return t && Date.now() - t >= DIA; }).slice(0, 400);
    if (!velhos.length) return;
    try {
      const b = db.batch(); velhos.forEach(p => b.update(db.collection('pedidos').doc(p.id), { foto: F.delete(), temFoto: F.delete() })); await b.commit();
    } catch (e) { console.warn('Fotos: não foi possível apagar as antigas:', e.message); }
  }

  async function apagarUma(id) {
    if (!confirm('Apagar esta foto agora? O pedido continua, só a foto é removida.')) return;
    const F = firebase.firestore.FieldValue;
    try { await db.collection('pedidos').doc(id).update({ foto: F.delete(), temFoto: F.delete() }); if (typeof avisoAdm === 'function') avisoAdm('Foto apagada'); }
    catch (e) { alert('Erro ao apagar: ' + e.message); }
  }

  function ampliar(id) {
    const p = lista.find(x => x.id === id); if (!p) return;
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out';
    d.innerHTML = '<img src="' + esc(p.foto) + '" alt="Foto do cliente" style="max-width:100%;max-height:100%;border-radius:12px">';
    d.onclick = () => d.remove(); document.body.appendChild(d);
  }

  document.addEventListener('click', e => {
    const del = e.target.closest('[data-del]'), img = e.target.closest('img[data-foto]');
    if (del) apagarUma(del.dataset.del); else if (img) ampliar(img.dataset.foto);
  });

  function iniciar() {
    secao();
    db.collection('pedidos').where('temFoto', '==', true).onSnapshot(s => {
      lista = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => typeof p.foto === 'string' && p.foto);
      desenhar(); limpar();
    }, e => console.warn('Fotos:', e.message));
    setInterval(() => { desenhar(); limpar(); }, 5 * 60 * 1000);   // confere de novo a cada 5 min (o tempo que falta e a limpeza)
  }

  auth.onAuthStateChanged(u => { if (u && u.email === LOJA.adminEmail && !iniciado) { iniciado = true; iniciar(); } });
})();
