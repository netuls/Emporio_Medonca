const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const STIDX = { 'Novo': 0, 'Aguardando conferência': 1, 'Confirmado': 2, 'Em preparo': 3, 'Saiu para entrega': 4, 'Entregue': 5, 'Cancelado': 6 };
const MSG_ST = ['Confirmado', 'Em preparo', 'Saiu para entrega', 'Entregue', 'Cancelado'];
let NOME_LOJA = 'Emporio Medonça', SLOGAN_LOJA = ''; const NOME_GER = NOME_LOJA, SLOGAN_GER = SLOGAN_LOJA, SF_GER = false;   // o painel pode trocar o nome e a frase (config/loja)
const assinatura = () => '\n\n_' + NOME_LOJA + (SLOGAN_LOJA ? ' · ' + SLOGAN_LOJA : '') + '_';
const MSG_PAD = {
  'Novo': 'Olá, {nome}! Recebemos o seu pedido nº {pedido}.\n\n*Total:* {total}\n\nEm instantes confirmamos por aqui.',
  'Aguardando conferência': 'Olá, {nome}! Recebemos o seu pedido nº {pedido} e estamos conferindo o pagamento.\n\n*Total:* {total}\n\nAssim que for confirmado, avisaremos por aqui.',
  'Confirmado': 'Olá, {nome}! Seu pedido nº {pedido} foi confirmado e já vai para a cozinha.\n\n{detalhes}\n*Total:* {total}',
  'Em preparo': 'Olá, {nome}! Seu pedido nº {pedido} já está sendo preparado. Avisaremos assim que ficar pronto.',
  'Saiu para entrega': 'Olá, {nome}! Seu pedido nº {pedido} saiu para entrega e chega em breve. Fique de olho no telefone.',
  'Entregue': 'Olá, {nome}! Seu pedido nº {pedido} foi entregue. Bom apetite e obrigado pela preferência!',
  'Cancelado': 'Olá, {nome}. Informamos que o seu pedido nº {pedido} foi cancelado. Em caso de dúvidas, estamos à disposição por aqui.' };
const MSG_OLD = {};
const msgDe = k => { const m = CFG.msgs && CFG.msgs[k]; return (m && !(MSG_OLD[k] || []).includes(m)) ? m : (NOME_LOJA !== NOME_GER ? MSG_PAD[k].split(NOME_GER).join(NOME_LOJA) : MSG_PAD[k]); };
let CFG = {}, ajInit = false, PED = {}, PROD = {}, logoNova;
let primeiro = true;

// ── Suporte a notificações (iPhone/Safari fora do app instalado NÃO tem Notification) ──
const temNotif = () => typeof window !== 'undefined' && 'Notification' in window;
const permNotif = () => temNotif() ? Notification.permission : 'unsupported';

// ── Som: bipe de verdade (3 toques) + vibração, para quando o painel está aberto ──
let actx;
function destravar() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) {}
  if (temNotif() && Notification.permission === 'default') { try { const r = Notification.requestPermission(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
}
['click', 'touchstart', 'keydown'].forEach(ev => document.addEventListener(ev, destravar, { once: true }));
function beep() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    [0, 0.3, 0.6].forEach(t => {
      const o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime + t;
      o.type = 'square'; o.frequency.value = 880; o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(0.4, n + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.22);
      o.start(n); o.stop(n + 0.25);
    });
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  } catch (e) {}
}
const OPC_NOTIF = { icon: 'icon-192.png', badge: 'badge.png', renotify: true, silent: false, requireInteraction: true, vibrate: [300, 150, 300, 150, 500] };
// Alerta de pedido novo com o painel aberto: som, notificação do sistema e título piscando
let ultimoAviso = 0, piscar = null;
function piscarTitulo() {
  if (piscar) return; const base = document.title; let on = false;
  piscar = setInterval(() => { document.title = (on = !on) ? '🛍️ NOVO PEDIDO!' : base; }, 900);
  const parar = () => { if (!document.hidden) { clearInterval(piscar); piscar = null; document.title = base; document.removeEventListener('visibilitychange', parar); window.removeEventListener('focus', parar); } };
  document.addEventListener('visibilitychange', parar); window.addEventListener('focus', parar);
}
async function alertaPedido(titulo, corpo) {
  ultimoAviso = Date.now(); beep(); piscarTitulo();
  if (!temNotif() || Notification.permission !== 'granted') { avisoAdm('⚠ Notificação do sistema indisponível: ative os avisos (no iPhone, só funciona com o painel instalado na Tela de Início)'); return; }
  const o = { ...OPC_NOTIF, body: corpo, tag: 'pedido-' + Date.now() };
  try { const reg = await navigator.serviceWorker.ready; await reg.showNotification(titulo, o); }
  catch (e) { try { new Notification(titulo, o); } catch (_) {} }
}
// Push com o painel ABERTO: o Firebase não chama o service worker, então mostramos a notificação aqui
let ouvindoPush = false;
function ouvirPush() {
  if (ouvindoPush) return;
  try {
    firebase.messaging().onMessage(async m => {
      const d = m.data || {};
      setTimeout(() => { if (Date.now() - ultimoAviso > 8000) alertaPedido(d.title || 'Novo pedido', d.body || ''); }, 4000);
    });
    ouvindoPush = true;
  } catch (e) { console.error('ouvirPush:', e); }
}
auth.onAuthStateChanged(u => {
  const ok = u && u.email === LOJA.adminEmail;
  $('login').style.display = ok ? 'none' : 'block'; $('app').style.display = ok ? 'block' : 'none';
  if (ok) iniciar();
});
window.verFoto = function (src) {
  const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer';
  const i = document.createElement('img'); i.src = src; i.style.cssText = 'max-width:92%;max-height:92%;border-radius:12px;image-rendering:auto';
  o.appendChild(i); o.onclick = () => o.remove(); document.body.appendChild(o);
};
function iniciar() {
  ouvirPush(); ajustarLayout(); criarBotaoVenda();
  db.collection('config').doc('loja').onSnapshot(s => { CFG = s.data() || {}; NOME_LOJA = CFG.nome || NOME_GER; SLOGAN_LOJA = CFG.slogan !== undefined ? CFG.slogan : SLOGAN_GER; document.title = NOME_LOJA + ' · Admin'; if (!ajInit) { ajInit = true; preencherAjustes(); if (typeof montarAparencia === 'function') montarAparencia(); montarFuncionamento(); preencherFuncionamento(); montarGaleria(); montarUber(); montarEntregaOpc(); } renderBairros(); pintarPausa(); prepararLogoImpressao(); });
  db.collection('pedidos').orderBy('criadoEm', 'desc').limit(100).onSnapshot(s => {
    if (!primeiro) s.docChanges().filter(c => c.type === 'added').forEach(c => {
      const p = c.doc.data(); if (p.origem === 'Manual') return; const t = $('toast'); t.textContent = '🛍️ Novo pedido recebido!'; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 5000);
      alertaPedido('🛍️ Novo pedido · ' + R$(p.total || 0), ((p.cliente && p.cliente.nome) || 'Cliente') + ' · ' + pagTxt(p.pagamento || '', p.pagamentoQuando) + ' · ' + (p.itens || []).map(i => i.nome + (i.det ? ' (' + i.det + ')' : '') + '×' + i.q).join(', '));
    });
    primeiro = false;
    PED = {}; s.docs.forEach(x => PED[x.id] = x.data());
      $('peds').innerHTML = s.docs.filter(d => !['Entregue', 'Cancelado'].includes(d.data().status)).map(d => { const p = d.data(), id = d.id, sc = STIDX[p.status] ?? 0, ent = p.entrega, end = ent && ent.endereco;
      const entHtml = !ent ? '' : ent.tipo === 'Uber Flash' ? '<br><small>🛵 Uber Flash · o cliente chama o motoboy</small>' : ent.tipo === 'Retirada' ? '<br><small>🏬 Retirada no restaurante</small>' : '<br><small>📍 <a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(txtEnd(end)) + '" target="_blank" rel="noopener" style="color:inherit">' + esc(end.rua) + ', ' + esc(end.numero) + (end.complemento ? ' (' + esc(end.complemento) + ')' : '') + ' - ' + esc(end.bairro) + ', ' + esc(end.cidade) + '</a>' + (end.ref ? '<br>Ref.: ' + esc(end.ref) : '') + '</small>';
      const b = (txt, cls, st) => `<button class="ab ${cls}" ${p.status === st ? 'disabled' : ''} onclick="setStatus('${id}','${st}')">${txt}</button>`;
      return `<tr><td data-l="Cliente"><b>${esc(p.cliente.nome)}</b><br><small style="color:var(--mut)">Pedido nº ${nPed(id)}${p.origem === 'Manual' ? ' · 🧾 venda manual' : ''}</small>${typeof p.foto === 'string' && p.foto.startsWith('data:image/jpeg;base64,') ? '<br><img src="' + p.foto + '" alt="Foto do cliente" title="Toque para ampliar" onclick="verFoto(this.src)" style="width:72px;height:54px;object-fit:cover;border-radius:8px;margin-top:6px;cursor:pointer;border:1px solid var(--bd,#ccc)">' : ''}${entHtml}</td><td class="wa" data-l="WhatsApp">${esc(p.cliente.tel)}</td><td data-l="Itens"><small>${p.itens.map(i => esc(i.nome) + (i.det ? ' (' + esc(i.det) + ')' : '') + '×' + i.q).join('<br>')}</small></td>
      <td data-l="Data">${p.criadoEm ? p.criadoEm.toDate().toLocaleString('pt-BR') : ''}</td><td data-l="Pagamento">${esc(p.pagamento)}${p.pagamentoQuando ? '<br><small style="color:var(--mut)">' + esc(({ 'Na entrega': 'na entrega', 'Na retirada': 'na retirada', 'Antecipado': 'pago antecipado' })[p.pagamentoQuando] || p.pagamentoQuando) + '</small>' : ''}</td><td data-l="Valor">${R$(p.total)}${p.frete ? '<br><small style="color:var(--mut)">frete ' + R$(p.frete) + '</small>' : ''}</td>
      <td data-l="Status"><span class="st s${sc}">${esc(p.status)}</span></td>
      <td class="acoes">${b('Confirmar', 'b', 'Confirmado')}${b('Em preparo', 'p', 'Em preparo')}${b('Saiu p/ entrega', 'c', 'Saiu para entrega')}${b('Entregue', 'g', 'Entregue')}${b('Cancelar', 'r', 'Cancelado')}<button class="ab g" onclick="finalizarPedido('${id}')">✔ Finalizar</button>
      <button class="ab g" onclick="zap('${id}')">WhatsApp</button><button class="ab b" onclick="enviarPix('${id}')">Enviar Pix</button><button class="ab g" onclick="imprimirPedido('${id}')">Imprimir</button><button class="ab r" onclick="excluirPedido('${id}')">Excluir</button></td></tr>`; }).join('');
  });
  db.collection('produtos').onSnapshot(s => {
    PROD = {}; s.docs.forEach(d => PROD[d.id] = d.data());
    $('lista').innerHTML = s.docs.map(d => { const p = d.data(), off = p.indisponivel === true, oc = p.ativo === false, na = (p.adicionais || []).length, nc = (p.complementos || []).length, nr = (p.remover || []).length; return `<div class="card${off ? ' off' : ''}"><div class="im" style="background-image:url('${esc(p.img)}')"></div><div class="in"><h3>${esc(p.nome)}</h3><div class="pr">${precoHtml(p)} · ${esc(p.categoria)}</div>
    ${p.desc ? `<small style="display:block;color:var(--mut);margin-bottom:6px">${esc(p.desc)}</small>` : ''}
    <small style="display:block;color:var(--mut);margin-bottom:10px">${nc ? nc + (nc === 1 ? ' complemento' : ' complementos') : na ? na + (na === 1 ? ' adicional' : ' adicionais') : 'Sem complementos'}${nr ? ' · ' + nr + ' para retirar' : ''}${oc ? ' · oculto no site' : ''}${off ? ' · indisponível' : ''}</small>
    <button class="btn${off ? '' : ' o'}" style="width:100%;margin-bottom:6px" onclick="db.collection('produtos').doc('${d.id}').update({indisponivel:${!off}})">${off ? 'Voltar a vender' : 'Marcar como indisponível'}</button>
    <button class="btn o" style="width:100%;margin-bottom:6px" onclick="editarProd('${d.id}')">Editar item</button>
    <button class="btn o" style="width:100%;margin-bottom:6px" onclick="trocarFotoProd('${d.id}')">Trocar foto</button>
    <button class="btn o" style="width:100%;margin-bottom:6px" onclick="db.collection('produtos').doc('${d.id}').update({ativo:${!p.ativo}})">${p.ativo ? 'Ocultar do site' : 'Mostrar no site'}</button>
    <button class="btn o" style="width:100%" onclick="if(confirm('Excluir este item do cardápio?'))db.collection('produtos').doc('${d.id}').delete()">Excluir</button></div></div>`; }).join('') || '<p style="color:var(--mut)">Nenhum item cadastrado ainda.</p>';
  });
}
const lerAds = t => { const vistos = new Set(); return String(t || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
  const m = l.match(/^(.*?)\s*[;=|]\s*(?:R\$)?\s*([\d.,]+)\s*$/), nome = (m ? m[1] : l).trim().slice(0, 40);
  let pr = 0; if (m) { const v = m[2]; pr = parseFloat(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v) || 0; }
  return nome ? { nome, preco: Math.round(Math.max(0, pr) * 100) / 100 } : null; }).filter(x => x && !vistos.has(x.nome.toLowerCase()) && vistos.add(x.nome.toLowerCase())).slice(0, 30); };
const adsTexto = a => (a || []).map(x => x.nome + ' ; ' + (+x.preco || 0).toFixed(2).replace('.', ',')).join('\n');
const lerRem = t => [...new Set(String(t || '').split(/[,\n]+/).map(x => x.trim().slice(0, 30)).filter(Boolean))].slice(0, 20);
function salvar() {
  if (!pn.value.trim() || !pp.value) return alert('Informe o nome e o preço do item');
  if (!pc.value.trim()) return alert('Informe a categoria (ex.: Lanches, Porções, Bebidas)');
  if (!fotoData && !confirm('Cadastrar sem foto?')) return;
  const promo = +$('pm').value || 0; if (promo && promo >= +pp.value) return alert('O preço promocional precisa ser menor que o preço normal.');
  const desc = $('pd').value.trim().slice(0, 160), adicionais = lerAds($('pa').value), remover = lerRem($('pr').value);
  db.collection('produtos').add({ nome: pn.value.trim(), preco: +pp.value, ...(promo ? { promo } : {}), categoria: pc.value.trim(), img: fotoData, ...(desc ? { desc } : {}), ...(adicionais.length ? { adicionais } : {}), ...(remover.length ? { remover } : {}), tamanhos: ['Único'], indisponivel: false, ativo: true })
    .then(() => { pn.value = pp.value = $('pm').value = $('pd').value = $('pa').value = $('pr').value = ''; pf.value = ''; fotoData = ''; $('prev').style.display = 'none'; avisoAdm('Item cadastrado'); })
    .catch(e => alert('Erro ao cadastrar: ' + e.message));
}

// ── Notificação push: registra este aparelho para receber aviso de pedido novo ──
async function ativarPush() {
  try {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);

    // iPhone/iPad fora do app instalado: o Safari não oferece notificações
    if (!temNotif() || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return alert(ios && !standalone
        ? 'No iPhone, as notificações só funcionam com o painel instalado.\n\n1. Toque em Compartilhar (quadrado com seta)\n2. Adicionar à Tela de Início\n3. Abra o painel pelo ícone criado\n4. Toque em Ativar avisos de lá\n\n(Precisa do iOS 16.4 ou mais novo.)'
        : 'Este navegador não suporta notificações push. Atualize o sistema ou use um navegador atualizado.');
    }

    if (!LOJA.vapidKey) return alert('Preencha vapidKey no config.js (veja o passo a passo).');
    if (await Notification.requestPermission() !== 'granted') return alert('Permita as notificações no navegador/celular.');
    const reg = await navigator.serviceWorker.ready;
    const token = await firebase.messaging().getToken({ vapidKey: LOJA.vapidKey, serviceWorkerRegistration: reg });
    await db.collection('admTokens').doc(token).set({ em: firebase.firestore.FieldValue.serverTimestamp(), aparelho: navigator.userAgent.slice(0, 80) });
    ouvirPush(); beep(); $('bPush').textContent = '🔔 Avisos ativos'; alert('Pronto! Este aparelho vai receber aviso de cada pedido novo.');
  } catch (e) { alert('Não foi possível ativar: ' + e.message); }
}
if (temNotif() && Notification.permission === 'granted') window.addEventListener('load', () => { const b = $('bPush'); if (b) b.textContent = '🔔 Avisos ativos'; });

const entrarAdmin = () => auth.signInWithEmailAndPassword(LOJA.adminEmail, $('s').value).catch(() => alert('Senha incorreta.'));

// ── Foto do produto: máxima qualidade (até 1200 px, JPEG alto) guardada junto do produto, sem Storage ──
let fotoData = '';
function processarFoto(f, cb) {
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    const k = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    let q = 0.92, d = c.toDataURL('image/jpeg', q);
    while (d.length > 900000 && q > 0.5) { q -= 0.07; d = c.toDataURL('image/jpeg', q); }   // limite de ~1 MB por documento do Firestore
    URL.revokeObjectURL(url); cb(d);
  };
  img.onerror = () => alert('Não foi possível ler esta imagem.');
  img.src = url;
}
function lerFoto(inp) {
  const f = inp.files[0]; if (!f) return;
  processarFoto(f, d => { fotoData = d; const p = $('prev'); p.src = d; p.style.display = 'block'; });
}
function trocarFotoProd(id) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { const f = inp.files[0]; if (f) processarFoto(f, d => db.collection('produtos').doc(id).update({ img: d }).then(() => avisoAdm('Foto trocada'), e => alert('Erro ao salvar: ' + e.message))); };
  inp.click();
}

// ── Ações do pedido e WhatsApp para o cliente ──
// ── Status do pedido ──
const CONF = ['Confirmado', 'Em preparo', 'Saiu para entrega', 'Entregue'], ST_NOVOS = ['Novo', 'Aguardando conferência'];
const mudarStatus = (id, st) => db.collection('pedidos').doc(id).update({ status: st });
function conferirPedido(id, st) {
  const p = PED[id]; if (!CONF.includes(st) || !ST_NOVOS.includes(p.status)) return true;   // só confere na primeira confirmação
  const itens = p.itens || [], c = x => Math.round((x || 0) * 100);
  if (itens.reduce((a, i) => a + c(i.preco) * i.q, 0) + c(p.frete) !== c(p.total)) { alert('⚠ O total deste pedido (' + R$(p.total) + ') não bate com a soma dos itens + frete. Não confirme; confira com o cliente.'); return false; }
  const av = [];
  itens.forEach(i => { const pr = PROD[i.id]; if (pr) { const atual = emPromo(pr) ? pr.promo : pr.preco; if (Math.abs(atual + (i.extra || 0) - i.preco) > 0.004) av.push(i.nome + ': pedido a ' + R$(i.preco) + ', preço atual ' + R$(atual)); } });
  if (p.entrega && p.entrega.tipo === 'Entrega') {
    const sub = itens.reduce((a, i) => a + i.preco * i.q, 0), bairro = (p.entrega.endereco || {}).bairro, t = taxaBairroAdm(bairro);
    if (t === null) av.push('Bairro "' + bairro + '" não está na sua lista de entrega');
    else { const esp = (CFG.freteGratis > 0 && sub >= CFG.freteGratis) ? 0 : t; if (Math.abs((p.frete || 0) - esp) > 0.004) av.push('Frete (' + bairro + '): pedido com ' + R$(p.frete || 0) + ', esperado ' + R$(esp)); }
  }
  return av.length ? confirm('⚠ Este pedido tem diferenças em relação ao painel:\n\n- ' + av.join('\n- ') + '\n\n(Pode ser só uma mudança de preço feita depois do pedido.) Confirmar mesmo assim?') : true;
}
let cmPend = null;
async function setStatus(id, st) {
  if (!conferirPedido(id, st)) return;
  try { await mudarStatus(id, st); } catch (e) { return alert(e.message); }
  const p = PED[id]; if (!MSG_ST.includes(st) || !(p.cliente.tel || '').replace(/\D/g, '')) return;
  cmPend = { id, st }; $('cmP').textContent = 'Status salvo: "' + st + '" (pedido de ' + p.cliente.nome + '). Abrir o WhatsApp com a mensagem pronta?'; $('cm').classList.add('on');
}
function cmNao() { $('cm').classList.remove('on'); }
function cmSim() { $('cm').classList.remove('on'); zap(cmPend.id, cmPend.st); }
async function excluirPedido(id) {
  if (!confirm('Excluir este pedido?')) return;
  try {
    await db.collection('pedidos').doc(id).delete();
  } catch (e) { alert('Erro: ' + e.message); }
}
const pagTxt = (pag, q) => pag + (q === 'Na entrega' ? ' · pagamento na entrega' : q === 'Na retirada' ? ' · pagamento na retirada' : q === 'Antecipado' ? ' · pago antecipado' : '');
const nPed = id => { const n = (PED[id] || {}).numero; return n ? String(n).padStart(2, '0') : id.slice(0, 6).toUpperCase(); };   // pedidos antigos, sem número sequencial, mostram o código antigo
const txtEnd = e => e.rua + ', ' + e.numero + (e.complemento ? ' (' + e.complemento + ')' : '') + ' - ' + e.bairro + ', ' + e.cidade + (e.cep ? ' · CEP ' + e.cep : '');
function detalhesPedido(p) {
  const ent = p.entrega, entTxt = !ent ? '' : ent.tipo === 'Retirada' ? '\n\n*Retirada no restaurante*' + ((CFG.retirada || {}).endereco ? '\n' + CFG.retirada.endereco + (CFG.retirada.horario ? '\nHorário: ' + CFG.retirada.horario : '') : '') : ent.tipo === 'Uber Flash' ? '\n\n*Uber Flash*\nVocê chama o motoboy do Uber Flash para retirar o pedido no restaurante.' + ((CFG.retirada || {}).endereco ? '\n' + CFG.retirada.endereco + (CFG.retirada.horario ? '\nHorário: ' + CFG.retirada.horario : '') : '') : '\n\n*Entrega*\n' + txtEnd(ent.endereco) + (p.frete ? '\n*Frete:* ' + R$(p.frete) : '');
  return '*Resumo do pedido*\n' + p.itens.map(i => i.q + '× ' + i.nome + ' — ' + R$(i.preco * i.q) + (i.det ? '\n   ↳ ' + i.det : '')).join('\n') + entTxt + '\n\n*Pagamento:* ' + pagTxt(p.pagamento, p.pagamentoQuando) + '\n';
}
function zap(id, stNovo) {
  const p = PED[id], tel = (p.cliente.tel || '').replace(/\D/g, ''); if (!tel) return alert('Pedido sem telefone.');
  const st = stNovo || p.status;
  let t = msgDe(st) || MSG_PAD['Novo'];
  // Só na confirmação vão os detalhes do pedido (se a mensagem salva não tiver {detalhes}, eles entram no final)
  if (st === 'Confirmado') t = t.includes('{detalhes}') ? t : t + '\n\n{detalhes}';
  else t = t.replace(/\{detalhes\}/g, '');
  t = t.replace(/\{detalhes\}/g, detalhesPedido(p)).replace(/\{nome\}/g, (p.cliente.nome || '').split(' ')[0]).replace(/\{total\}/g, R$(p.total)).replace(/\{pedido\}/g, nPed(id)).replace(/\{pagamento\}/g, p.pagamento || '').trim() + assinatura();
  window.open('https://wa.me/55' + tel + '?text=' + encodeURIComponent(t), '_blank');
}

// ── Ajustes do restaurante: WhatsApp, logo do site e mensagens ──
const mid = k => 'm-' + k.replace(/\W/g, '_');
function preencherAjustes() {
  $('anome').value = CFG.nome || NOME_GER; $('aslogan').value = CFG.slogan !== undefined ? CFG.slogan : SLOGAN_GER; $('asf').checked = CFG.logoSemFundo !== undefined ? !!CFG.logoSemFundo : SF_GER;
  const px = CFG.pix || LOJA.pix || {};
  $('pxt').value = px.tipo || 'cpf'; $('pxk').value = px.chave || ''; $('pxn').value = px.nome || ''; $('pxc').value = px.cidade || '';
  $('aw').value = (CFG.whatsapp || LOJA.whatsapp || '').replace(/^55/, ''); $('ar').value = CFG.reiniciar || 'nunca'; $('afr').value = CFG.frete || ''; $('afg').value = CFG.freteGratis || ''; $('ai').value = CFG.instagram ? '@' + CFG.instagram : '';
  $('arl').value = (CFG.retirada || {}).endereco || ''; $('arh').value = (CFG.retirada || {}).horario || ''; $('abn').value = CFG.bairroOutros || 'padrao';
  if (CFG.logo) { $('alogo').src = CFG.logo; $('alogo').style.display = 'block'; }
  $('amsgs').innerHTML = MSG_ST.map(k => `<label>${k}</label><textarea id="${mid(k)}" rows="2">${esc(msgDe(k))}</textarea>`).join('');
}
// Remove o fundo sólido ligado às bordas (opcional) e mede as margens vazias. px: RGBA. Altera px no lugar.
function aparaLogo(px, w, h, tirarFundo) {
  if (tirarFundo && w > 2 && h > 2) {
    const cantos = [0, w - 1, (h - 1) * w, h * w - 1].map(i => i * 4), r0 = px[cantos[0]], g0 = px[cantos[0] + 1], b0 = px[cantos[0] + 2];
    const dist = c => Math.abs(px[c] - r0) + Math.abs(px[c + 1] - g0) + Math.abs(px[c + 2] - b0);
    if (cantos.every(c => px[c + 3] > 240 && dist(c) <= 60)) {
      const vis = new Uint8Array(w * h), pilha = new Int32Array(w * h); let topo = 0, n = 0;
      const empurra = i => { if (!vis[i] && px[i * 4 + 3] > 200 && dist(i * 4) <= 70) { vis[i] = 1; pilha[topo++] = i; n++; } };
      for (let x = 0; x < w; x++) { empurra(x); empurra((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { empurra(y * w); empurra(y * w + w - 1); }
      while (topo) {
        const i = pilha[--topo], x = i % w, y = (i - x) / w;
        if (x > 0) empurra(i - 1); if (x < w - 1) empurra(i + 1); if (y > 0) empurra(i - w); if (y < h - 1) empurra(i + w);
      }
      if (n < w * h * 0.97) {   // se "sobrar" quase nada, a imagem é só fundo: não mexe
        const borda = [];
        for (let i = 0; i < w * h; i++) {
          if (vis[i]) { px[i * 4 + 3] = 0; continue; }
          const x = i % w, y = (i - x) / w;
          if ((x > 0 && vis[i - 1]) || (x < w - 1 && vis[i + 1]) || (y > 0 && vis[i - w]) || (y < h - 1 && vis[i + w])) borda.push(i);
        }
        borda.forEach(i => { const d = dist(i * 4); if (d < 180) px[i * 4 + 3] = Math.round(px[i * 4 + 3] * Math.max(0, Math.min(1, (d - 40) / 140))); });   // suaviza o contorno
      }
    }
  }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  return { x0, y0, x1, y1, pad: Math.max(2, Math.round(Math.max(x1 - x0, y1 - y0) * 0.02)) };
}
// Recorta as margens vazias (e, se pedido, tira o fundo sólido) de um <canvas>. Devolve um canvas novo, só com a logo.
function aparaLogoCanvas(src, tirarFundo) {
  const w = src.width, h = src.height, ctx = src.getContext('2d'), id = ctx.getImageData(0, 0, w, h), r = aparaLogo(id.data, w, h, tirarFundo);
  if (!r) return src;
  ctx.putImageData(id, 0, 0);
  const cw = r.x1 - r.x0 + 1, ch = r.y1 - r.y0 + 1, out = document.createElement('canvas');
  out.width = cw + r.pad * 2; out.height = ch + r.pad * 2;
  out.getContext('2d').drawImage(src, r.x0, r.y0, cw, ch, r.pad, r.pad, cw, ch);
  return out;
}
// Logo: tenta a MAIOR resolução possível (até 1200 px) em WebP (com transparência, bem mais leve que PNG).
// O limite existe porque a logo fica dentro do documento de ajustes do Firestore (máx. ~1 MB).
function lerLogo(inp) {
  const f = inp.files[0]; if (!f) return; const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    const auto = !($('alogoAuto') && !$('alogoAuto').checked), LIM = 750000;   // deixa folga para o resto do documento de ajustes
    let d = '';
    for (const max of [1200, 1000, 800, 640, 480]) {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
      const out = auto ? aparaLogoCanvas(c, true) : c;
      for (const q of [0.95, 0.9, 0.85, 0.8]) {
        const w = out.toDataURL('image/webp', q);
        if (!w.startsWith('data:image/webp')) break;          // navegador sem suporte a WebP: cai para PNG
        if (w.length <= LIM) { d = w; break; }
      }
      if (d) break;
      const p = out.toDataURL('image/png'); if (p.length <= LIM) { d = p; break; }
    }
    URL.revokeObjectURL(url);
    if (!d) return alert('Esta logo é pesada demais para salvar. Use uma imagem menor ou com menos efeitos.');
    logoNova = d; $('alogo').src = d; $('alogo').style.display = 'block';
  };
  img.onerror = () => alert('Não foi possível ler esta imagem.'); img.src = url;
}
function tirarLogo() { logoNova = ''; $('alogo').style.display = 'none'; $('af').value = ''; }
const normN = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
let BL = [];   // lista exibida (ordenada); os botões usam a posição nela
function renderBairros() {
  BL = (CFG.bairros || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  $('bl').innerHTML = BL.length
    ? BL.map((b, i) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><span style="flex:1">${esc(b.nome)}</span><span style="color:var(--mut)">R$</span><input type="number" step="0.01" min="0" inputmode="decimal" value="${b.taxa}" style="width:92px;margin:0" onchange="mudarTaxaBairro(${i}, this.value)"><button class="ab r" onclick="tirarBairro(${i})">Remover</button></div>`).join('')
    : '<p style="color:var(--mut);font-size:12px">Nenhum bairro cadastrado: vale a taxa padrão para todos.</p>';
}
async function gravarBairros(lista) {
  try { await db.collection('config').doc('loja').set({ bairros: lista, taxas: [...new Set(lista.map(b => b.taxa))] }, { merge: true }); return true; }
  catch (e) { alert('Erro ao salvar: ' + e.message); return false; }
}
async function addBairro() {
  const nome = $('bn').value.trim().slice(0, 60), taxa = parseFloat(String($('bv').value).replace(',', '.'));
  if (!nome) return alert('Digite o nome do bairro.');
  if (!(taxa >= 0)) return alert('Digite o valor da taxa (0 = entrega grátis).');
  const L = (CFG.bairros || []).slice(), i = L.findIndex(b => normN(b.nome) === normN(nome)), novo = { nome, taxa: Math.round(taxa * 100) / 100 };
  if (i >= 0) L[i] = novo; else { if (L.length >= 200) return alert('Limite de 200 bairros.'); L.push(novo); }
  if (await gravarBairros(L)) { $('bn').value = ''; $('bv').value = ''; $('bn').focus(); avisoAdm(i >= 0 ? 'Taxa atualizada' : 'Bairro adicionado'); }
}
async function mudarTaxaBairro(i, v) {
  const taxa = parseFloat(String(v).replace(',', '.')); if (!(taxa >= 0)) { renderBairros(); return alert('Valor inválido.'); }
  const L = BL.map(b => ({ ...b })); L[i].taxa = Math.round(taxa * 100) / 100;
  if (await gravarBairros(L)) avisoAdm('Taxa atualizada');
}
async function tirarBairro(i) {
  if (!confirm('Remover "' + BL[i].nome + '" da lista de entrega?')) return;
  if (await gravarBairros(BL.filter((_, k) => k !== i))) avisoAdm('Bairro removido');
}
function taxaBairroAdm(bairro) {   // null = bairro fora da lista e o restaurante não entrega fora dela
  const L = CFG.bairros || []; if (!L.length) return +CFG.frete || 0;
  const m = L.find(b => normN(b.nome) === normN(bairro)); if (m) return +m.taxa || 0;
  return CFG.bairroOutros === 'bloquear' ? null : (+CFG.frete || 0);
}
async function salvarRetirada() {   // salva na hora, sem precisar do botão "Salvar ajustes"
  try { await db.collection('config').doc('loja').set({ retirada: { endereco: $('arl').value.trim().slice(0, 200), horario: $('arh').value.trim().slice(0, 100) } }, { merge: true }); avisoAdm('Local de retirada salvo'); }
  catch (e) { alert('Erro ao salvar: ' + e.message); }
}
async function salvarAjustes() {
  let w = $('aw').value.replace(/\D/g, ''); if (w && w.length <= 11) w = '55' + w;
  if (w && !/^55\d{10,11}$/.test(w)) return alert('WhatsApp inválido: use DDD + número.');
  const instagram = $('ai').value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 30);   // aceita @perfil, perfil ou o link do perfil
  const nomeN = $('anome').value.trim().replace(/\s+/g, ' ').slice(0, 40); if (!nomeN) return alert('Informe o nome do restaurante.');
  const slogN = $('aslogan').value.trim().replace(/\s+/g, ' ').slice(0, 60);
  const msgs = {}; MSG_ST.forEach(k => msgs[k] = $(mid(k)).value.trim() || msgDe(k));
  const frete = Math.max(0, +$('afr').value || 0), freteGratis = Math.max(0, +$('afg').value || 0);
  const dados = { nome: nomeN, slogan: slogN, logoSemFundo: $('asf').checked, ...(nomeN !== (CFG.nome || NOME_GER) ? { marca: nomeN.slice(0, 28) } : {}), whatsapp: w, instagram, msgs, reiniciar: $('ar').value, frete, freteGratis, bairroOutros: $('abn').value, retirada: { endereco: $('arl').value.trim(), horario: $('arh').value.trim() } };
  if (logoNova !== undefined) dados.logo = logoNova || firebase.firestore.FieldValue.delete();
  try { await db.collection('config').doc('loja').set(dados, { merge: true }); logoNova = undefined; alert('Ajustes salvos!'); } catch (e) { alert('Erro ao salvar: ' + e.message); }
}


// ── Funcionamento: pausa rápida, horário automático, pedido mínimo e tempo estimado ──
const DIAS_ADM = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const cfgOuPadrao = k => CFG[k] !== undefined ? CFG[k] : (LOJA.padroes || {})[k];
function montarFuncionamento() {
  if ($('fn-sec')) return;
  const lista = $('lista'), prod = lista && lista.closest('.sec'); if (!prod) return;
  const s = document.createElement('div'); s.className = 'sec'; s.id = 'fn-sec';
  s.innerHTML = `<h2 class="pt">FUNCIONAMENTO</h2>
    <p class="rd">Controle quando o site aceita pedidos. O cliente sempre vê o cardápio, mas só finaliza o pedido com a casa aberta.</p>
    <div id="fnPausa" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0 0 18px;padding:14px;border:1px solid var(--line);border-radius:10px"></div>
    <label class="fnchk" style="display:flex;gap:8px;align-items:center;margin:0 0 12px;cursor:pointer"><input type="checkbox" id="fnAuto" style="width:auto;margin:0"> Abrir e fechar sozinho pelo horário abaixo</label>
    <div id="fnDias" style="margin:0 0 16px">${DIAS_ADM.map((d, i) => `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><label style="display:flex;gap:8px;align-items:center;min-width:120px;margin:0;cursor:pointer"><input type="checkbox" id="fa${i}" style="width:auto;margin:0">${d}</label><input type="time" id="fd${i}" style="width:auto;margin:0"><span style="color:var(--mut)">até</span><input type="time" id="ft${i}" style="width:auto;margin:0"></div>`).join('')}</div>
    <p class="rd" style="margin-top:-6px">Se fechar depois da meia-noite (ex.: das 18:00 às 02:00), basta colocar o horário da madrugada.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0 12px"><div><label>Pedido mínimo (R$, em itens)</label><input id="fnMin" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0 = sem mínimo"></div><div><label>Tempo estimado de entrega</label><input id="fnTe" maxlength="24" placeholder="40–50 min"></div><div><label>Tempo estimado de retirada</label><input id="fnTr" maxlength="24" placeholder="20–30 min"></div></div>
    <button class="btn" onclick="salvarFuncionamento()">Salvar funcionamento</button>`;
  prod.parentNode.insertBefore(s, prod);
}
function preencherFuncionamento() {
  if (!$('fn-sec')) return;
  const hs = cfgOuPadrao('horarios'), ok = Array.isArray(hs) && hs.length === 7;
  $('fnAuto').checked = cfgOuPadrao('horarioAuto') === true;
  for (let i = 0; i < 7; i++) { const h = ok ? hs[i] : { a: true, de: '11:00', ate: '22:00' }; $('fa' + i).checked = !!h.a; $('fd' + i).value = h.de || '11:00'; $('ft' + i).value = h.ate || '22:00'; }
  $('fnMin').value = cfgOuPadrao('pedidoMin') || ''; $('fnTe').value = cfgOuPadrao('tempoEntrega') || ''; $('fnTr').value = cfgOuPadrao('tempoRetirada') || '';
}
function pintarPausa() {
  const el = $('fnPausa'); if (!el) return; const p = CFG.pausado === true;
  el.style.borderColor = p ? '#e5484d' : 'var(--line)';
  el.innerHTML = `<div style="flex:1;min-width:200px"><b style="color:${p ? 'var(--erro)' : 'var(--ok)'}">${p ? '● Pedidos pausados' : '● Recebendo pedidos'}</b><div style="color:var(--mut);font-size:12px;margin-top:2px">${p ? 'Os clientes veem o aviso de cozinha cheia e não conseguem finalizar.' : 'Use a pausa quando a cozinha estiver lotada.'}</div></div><button class="btn${p ? '' : ' o'}" onclick="togglePausa()">${p ? 'Retomar pedidos' : 'Pausar pedidos'}</button>`;
}
async function togglePausa() {
  const novo = !(CFG.pausado === true);
  if (novo && !confirm('Pausar o recebimento de pedidos agora?')) return;
  try { await db.collection('config').doc('loja').set({ pausado: novo }, { merge: true }); avisoAdm(novo ? 'Pedidos pausados' : 'Pedidos retomados'); } catch (e) { alert('Erro: ' + e.message); }
}
async function salvarFuncionamento() {
  const horarios = [], re = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (let i = 0; i < 7; i++) { const a = $('fa' + i).checked, de = $('fd' + i).value, ate = $('ft' + i).value; if (a && (!re.test(de) || !re.test(ate))) return alert('Informe o horário de abrir e de fechar de ' + DIAS_ADM[i] + '.'); horarios.push({ a, de: re.test(de) ? de : '11:00', ate: re.test(ate) ? ate : '22:00' }); }
  const dados = { horarioAuto: $('fnAuto').checked, horarios, pedidoMin: Math.max(0, +$('fnMin').value || 0), tempoEntrega: $('fnTe').value.trim().slice(0, 24), tempoRetirada: $('fnTr').value.trim().slice(0, 24) };
  try { await db.collection('config').doc('loja').set(dados, { merge: true }); alert('Funcionamento salvo!'); } catch (e) { alert('Erro ao salvar: ' + e.message); }
}

// ── Pix ──
async function salvarPix() {
  const tipo = $('pxt').value; let chave = $('pxk').value.trim();
  const nome = $('pxn').value.trim(), cidade = $('pxc').value.trim();
  if (!chave || !nome || !cidade) return alert('Preencha a chave, o nome do recebedor e a cidade.');
  if (tipo === 'cpf') chave = chave.replace(/\D/g, '');
  if (tipo === 'tel') { chave = chave.replace(/\D/g, ''); if (chave.length <= 11) chave = '55' + chave; chave = '+' + chave; }
  if (tipo === 'email') chave = chave.toLowerCase();
  if (tipo === 'cpf' && ![11, 14].includes(chave.length)) return alert('CPF deve ter 11 dígitos ou CNPJ 14.');
  try { await db.collection('config').doc('loja').set({ pix: { tipo, chave, nome, cidade } }, { merge: true }); $('pxk').value = chave; alert('Pix salvo!'); }
  catch (e) { alert('Erro ao salvar: ' + e.message); }
}
function enviarPix(id) {
  const px = (CFG.pix && CFG.pix.chave) ? CFG.pix : LOJA.pix; if (!px || !px.chave) return alert('Cadastre sua chave Pix no painel PIX primeiro.');
  const p = PED[id], tel = (p.cliente.tel || '').replace(/\D/g, ''); if (!tel) return alert('Pedido sem telefone.');
  const code = gerarPix(px.chave, px.nome, px.cidade, p.total, id);
  const t = 'Olá, ' + (p.cliente.nome || '').split(' ')[0] + '! Segue o Pix referente ao seu pedido nº ' + nPed(id) + ' na ' + NOME_LOJA + '.\n\n*Valor:* ' + R$(p.total) + '\n*Favorecido:* ' + px.nome + '\n\nPara pagar, copie o código abaixo e use a opção "Pix Copia e Cola" no aplicativo do seu banco:' + assinatura() + '\n\n' + code;
  window.open('https://wa.me/55' + tel + '?text=' + encodeURIComponent(t), '_blank');
}

// ── Impressão do pedido: documento profissional com a logo do restaurante (folha A4 ou cupom térmico) ──
const IMPRESSAO_FORMATO = 'termico';   // 'a4' = folha comum · 'termico' = cupom 80 mm (para 58 mm, troque a largura no @page abaixo)


// Logo em preto para o cupom térmico: pinta a logo de preto num canvas (o filtro CSS é ignorado pelo Safari do iPhone na impressão)
let LOGO_PB = '';
function prepararLogoImpressao() {
  const img = new Image();
  img.onload = () => {
    try {
      const k = Math.min(1, 700 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k)), n = w * h;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h), px = d.data;
      // Cupom térmico é só preto no branco. Acha o fundo da logo (transparente, ou a cor que mais aparece) e deixa só o desenho em preto.
      let transp = 0; for (let i = 3; i < px.length; i += 4) if (px[i] < 40) transp++;
      let fundo = null;
      if (transp < n * 0.2) {   // logo "cheia" (com fundo colorido): o fundo é a cor mais comum
        const cont = {}; let melhor = -1, nb = 0;
        for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200) { const q = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4), v = (cont[q] || 0) + 1; cont[q] = v; if (v > nb) { nb = v; melhor = q; } }
        if (melhor >= 0) {
          let sr = 0, sg = 0, sb = 0, m = 0;
          for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200 && ((((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4)) === melhor)) { sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; m++; }
          fundo = [sr / m, sg / m, sb / m];
        }
      }
      let tinta = 0;
      for (let i = 0; i < px.length; i += 4) {
        let al = px[i + 3];
        if (fundo) al = al * Math.max(0, Math.min(1, (Math.abs(px[i] - fundo[0]) + Math.abs(px[i + 1] - fundo[1]) + Math.abs(px[i + 2] - fundo[2]) - 40) / 110));
        px[i] = px[i + 1] = px[i + 2] = 0; px[i + 3] = al; if (al > 128) tinta++;
      }
      // quase nada de desenho (ou um bloco todo preenchido): não dá para imprimir a logo, o recibo usa o nome do restaurante em texto
      if (tinta < n * 0.005 || tinta > n * 0.9) { LOGO_PB = 'sem'; return; }
      x.putImageData(d, 0, 0);
      LOGO_PB = c.toDataURL('image/png');
    } catch (e) { LOGO_PB = ''; }
  };
  img.src = CFG.logo || 'logo-full.png';
}

function imprimirPedido(id) {
  const p = PED[id]; if (!p) return;
  const term = IMPRESSAO_FORMATO === 'termico', itens = p.itens || [], ent = p.entrega, end = (ent && ent.endereco) || {};
  const sub = itens.reduce((a, i) => a + i.preco * i.q, 0), qtd = itens.reduce((a, i) => a + i.q, 0);
  const data = p.criadoEm ? p.criadoEm.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const semLogo = term && LOGO_PB === 'sem', logo = (term && LOGO_PB && !semLogo && LOGO_PB) || CFG.logo || 'logo-full.png';
  const zapLoja = vmFmtTel(vmTel(CFG.whatsapp || LOJA.whatsapp || '')), ret = CFG.retirada || {}, insta = CFG.instagram ? '@' + String(CFG.instagram).replace(/^@/, '') : '';
  const quando = ({ 'Na entrega': 'pagamento na entrega', 'Na retirada': 'pagamento na retirada', 'Antecipado': 'pago antecipadamente' })[p.pagamentoQuando] || '';
  const entBloco = !ent ? '—'
    : ent.tipo === 'Retirada' ? '<b>Retirada no restaurante</b>' + (ret.endereco ? '<br>' + esc(ret.endereco) : '') + (ret.horario ? '<br>Horário: ' + esc(ret.horario) : '')
    : ent.tipo === 'Uber Flash' ? '<b>Uber Flash</b><br>O cliente chama o motoboy para retirar no restaurante'
    : '<b>Entrega</b><br>' + esc(end.rua) + ', ' + esc(end.numero) + (end.complemento ? ' (' + esc(end.complemento) + ')' : '') + '<br>' + esc(end.bairro) + ' · ' + esc(end.cidade) + (end.cep ? '<br>CEP ' + esc(end.cep) : '') + (end.ref ? '<br>Ref.: ' + esc(end.ref) : '');
  const css = `
    @page{size:${term ? '80mm auto' : 'A4'};margin:${term ? '3mm' : '12mm'}}
    *{box-sizing:border-box}
    html,body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font:${term ? '11px' : '13px'}/1.45 Arial,Helvetica,sans-serif;color:#111}
    .hd{display:flex;align-items:center;justify-content:space-between;gap:16px;${term ? 'flex-direction:column;text-align:center;padding-bottom:8px;border-bottom:2px solid #000' : 'background:#0b0b0b;color:#fff;padding:18px 22px;border-radius:6px'}}
    .lg{max-height:${term ? '46px' : '64px'};max-width:${term ? '70%' : '55%'};object-fit:contain;${term && !LOGO_PB ? 'filter:grayscale(1) brightness(0)' : ''}}
    .lgt{font-weight:bold;font-size:16px;letter-spacing:.12em;text-transform:uppercase;line-height:1.2}
    .ped{text-align:${term ? 'center' : 'right'}}.ped small{display:block;letter-spacing:.3em;font-size:10px;opacity:.75}
    .ped b{display:block;font-size:${term ? '20px' : '26px'};letter-spacing:.04em;line-height:1.15}.ped span{font-size:${term ? '10px' : '12px'};opacity:.85}
    .loja{text-align:center;color:#555;font-size:${term ? '10px' : '11px'};margin:8px 0 ${term ? '8px' : '16px'}}
    .loja i{font-style:normal;display:block;letter-spacing:.14em;text-transform:uppercase;color:#111;font-size:${term ? '10px' : '11px'};margin-bottom:2px}
    .cols{display:${term ? 'block' : 'grid'};grid-template-columns:1fr 1fr;gap:12px;margin-bottom:${term ? '6px' : '14px'}}
    .bx{border:1px solid #cfcfcf;border-radius:6px;padding:${term ? '6px 8px' : '10px 12px'};margin-bottom:${term ? '6px' : '0'}}
    .bx h4{margin:0 0 5px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#777;font-weight:600}
    table{width:100%;border-collapse:collapse;margin:${term ? '4px 0' : '2px 0 10px'}}
    th{font-size:10px;letter-spacing:.12em;text-transform:uppercase;text-align:left;color:#555;border-bottom:2px solid #111;padding:6px 4px}
    td{padding:${term ? '4px' : '8px 4px'};border-bottom:1px solid #e3e3e3;vertical-align:top}
    .r{text-align:right;white-space:nowrap}.c{text-align:center}${term ? '.u{display:none}' : ''}
    td small{color:#666;display:block}
    .tot{margin-left:auto;width:${term ? '100%' : '260px'};margin-top:6px}
    .tot div{display:flex;justify-content:space-between;padding:3px 0}
    .tot .g{border-top:2px solid #111;margin-top:4px;padding-top:7px;font-size:${term ? '16px' : '19px'};font-weight:bold}
    .ft{text-align:center;margin-top:${term ? '10px' : '26px'};padding-top:10px;border-top:1px dashed #999;color:#555;font-size:${term ? '10px' : '11px'}}
    .ft b{display:block;color:#111;font-size:${term ? '12px' : '14px'};margin-bottom:2px}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pedido ${esc(nPed(id))} · ${esc(NOME_LOJA)}</title><style>${css}</style></head><body>
    <div class="hd">${semLogo ? '<div class="lgt">' + esc(NOME_LOJA) + '</div>' : '<img class="lg" src="' + esc(logo) + '" alt="' + esc(NOME_LOJA) + '">'}<div class="ped"><small>PEDIDO</small><b>Nº ${esc(nPed(id))}</b><span>${esc(data)}${p.origem === 'Manual' ? ' · venda manual' : ''}</span></div></div>
    <div class="loja"><i>${esc(NOME_LOJA)}${SLOGAN_LOJA ? ' · ' + esc(SLOGAN_LOJA) : ''}</i>${[zapLoja ? 'WhatsApp ' + esc(zapLoja) : '', insta ? 'Instagram ' + esc(insta) : ''].filter(Boolean).join(' · ')}${ret.endereco ? '<br>' + esc(ret.endereco) : ''}</div>
    <div class="cols">
      <div class="bx"><h4>Cliente</h4><b>${esc(p.cliente.nome)}</b>${p.cliente.tel ? '<br>' + esc(vmFmtTel(vmTel(p.cliente.tel))) : ''}</div>
      <div class="bx"><h4>Entrega</h4>${entBloco}</div>
    </div>
    <table><thead><tr><th class="c" style="width:34px">Qtd</th><th>Descrição</th><th class="r u">Unitário</th><th class="r">Total</th></tr></thead><tbody>
      ${itens.map(i => `<tr><td class="c">${i.q}</td><td>${esc(i.nome)}${i.det ? '<small>' + esc(i.det) + '</small>' : ''}</td><td class="r u">${R$(i.preco)}</td><td class="r">${R$(i.preco * i.q)}</td></tr>`).join('')}
    </tbody></table>
    <div class="tot"><div><span>Subtotal (${qtd} ${qtd === 1 ? 'item' : 'itens'})</span><span>${R$(sub)}</span></div>
      ${p.frete ? `<div><span>Frete</span><span>${R$(p.frete)}</span></div>` : ''}
      <div class="g"><span>TOTAL</span><span>${R$(p.total)}</span></div></div>
    <div class="bx" style="margin-top:14px"><h4>Pagamento</h4><b>${esc(p.pagamento || '—')}</b>${quando ? ' · ' + esc(quando) : ''}</div>
    <div class="ft"><b>Obrigado pela preferência!</b>${SLOGAN_LOJA ? esc(SLOGAN_LOJA) + ' · ' : ''}${esc(NOME_LOJA)}</div>
  </body></html>`;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const esperaImgs = (doc, fim) => {   // só imprime depois que a logo terminou de carregar (máx. 5 s)
    const pend = [...doc.images].filter(i => !i.complete);
    if (!pend.length) return fim();
    let n = pend.length, feito = false; const fecha = () => { if (!feito) { feito = true; fim(); } };
    pend.forEach(i => { const um = () => { if (--n <= 0) fecha(); }; i.addEventListener('load', um); i.addEventListener('error', um); });
    setTimeout(fecha, 5000);
  };
  const viaIframe = () => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    f.onload = () => esperaImgs(f.contentDocument, () => setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { alert('Não foi possível imprimir: ' + e.message); } setTimeout(() => f.remove(), 60000); }, 250));
    f.srcdoc = html; document.body.appendChild(f);
  };
  if (mobile) {   // celular: abre o recibo numa aba própria com um botão Imprimir (o toque no botão é o que libera a impressão no iPhone)
    const w = window.open('', '_blank');
    if (w) {
      const barra = '<style>@media print{.nao-imp{display:none!important}}</style>'
        + '<div class="nao-imp" style="position:sticky;top:0;z-index:9;display:flex;gap:8px;padding:10px;background:#111">'
        + '<button onclick="window.print()" style="flex:1;padding:14px;font-size:16px;font-weight:bold;border:0;border-radius:8px;background:#fff;color:#111">🖨️ Imprimir</button>'
        + '<button onclick="window.close()" style="padding:14px;font-size:16px;border:0;border-radius:8px;background:#333;color:#fff">Fechar</button></div>';
      w.document.open();
      w.document.write(html.replace('<body>', '<body>' + barra));
      w.document.close();
      return;
    }
  }
  viaIframe();
}

// ── Tamanhos e estoque ──
function avisoAdm(m) { const t = $('toast'); t.textContent = m; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 2500); }

const emPromo = p => p.promo > 0 && p.promo < p.preco;
const precoHtml = p => emPromo(p) ? '<s style="color:var(--mut)">' + R$(p.preco) + '</s> <b>' + R$(p.promo) + '</b>' : R$(p.preco);
let prodEd = null;
function editarProd(id) {
  const p = PROD[id]; if (!p) return; prodEd = id;
  $('epN').value = p.nome || ''; $('epP').value = p.preco ?? ''; $('epPm').value = emPromo(p) ? p.promo : ''; $('epC').value = p.categoria || ''; $('epD').value = p.desc || ''; $('epA').value = adsTexto(p.adicionais); $('epR').value = (p.remover || []).join(', ');
  $('ep').classList.add('on');
}
const fecharProd = () => { $('ep').classList.remove('on'); prodEd = null; };
async function salvarProd() {
  const nome = $('epN').value.trim(), preco = +$('epP').value, promo = +$('epPm').value || 0, categoria = $('epC').value.trim();
  if (!nome || !(preco > 0)) return alert('Informe nome e preço.');
  if (promo && promo >= preco) return alert('O preço promocional precisa ser menor que o preço normal.');
  try { await db.collection('produtos').doc(prodEd).update({ nome, preco, categoria, promo: promo || firebase.firestore.FieldValue.delete(), desc: $('epD').value.trim().slice(0, 160), adicionais: lerAds($('epA').value), remover: lerRem($('epR').value) }); fecharProd(); avisoAdm('Produto atualizado'); }
  catch (e) { alert('Erro ao salvar: ' + e.message); }
}

// ── Relatórios ──
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const REC = ['Entregue'];   // status que contam como venda: SOMENTE pedidos entregues entram na receita
let POR = {};
const mkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
const mnome = k => { const [y, m] = k.split('-'); return MESES[m - 1] + ' de ' + y; };
const mesAnt = k => { const [y, m] = k.split('-').map(Number); return mkey(new Date(y, m - 2, 1)); };
const ult12 = () => { const h = new Date(), r = []; for (let i = 0; i < 12; i++) r.push(mkey(new Date(h.getFullYear(), h.getMonth() - i, 1))); return r; };   // do mês atual para trás

function aba(t) {
  ['P', 'R', 'C'].forEach(k => { $('t' + k).style.display = t === k ? 'block' : 'none'; $('tb' + k).classList.toggle('on', t === k); });
  if (t === 'R') relCarregar();
  if (t === 'C') clCarregar();
}
async function relCarregar() {
  const h = new Date(), ini = new Date(h.getFullYear(), h.getMonth() - 12, 1);   // 13 meses: dá para comparar o mês mais antigo com o anterior
  try {
    const s = await db.collection('pedidos').where('criadoEm', '>=', ini).get();
    POR = {}; s.docs.forEach(d => { const p = d.data(); if (!p.criadoEm) return; const k = mkey(p.criadoEm.toDate()); (POR[k] = POR[k] || []).push(p); });
  } catch (e) { return alert('Erro ao carregar relatórios: ' + e.message); }
  const atual = $('rm').value;
  $('rm').innerHTML = ult12().map(k => `<option value="${k}">${mnome(k)}</option>`).join('');
  $('rm').value = atual && ult12().includes(atual) ? atual : mkey(h);
  relRender();
}
function relMes(d) { const h = new Date(); $('rm').value = mkey(new Date(h.getFullYear(), h.getMonth() + d, 1)); relRender(); }
function relSel(k) { $('rm').value = k; relRender(); window.scrollTo({ top: $('rOut').offsetTop - 80, behavior: 'smooth' }); }
function relAgg(lista) {
  const r = { receita: 0, pedidos: 0, itens: 0, cancel: 0, pend: 0, pag: {}, prod: {} };
  lista.forEach(p => {
    if (p.status === 'Cancelado') { r.cancel++; return; }
    if (!REC.includes(p.status)) { r.pend++; return; }
    const t = p.total || 0, f = p.pagamento || 'Outro';
    r.receita += t; r.pedidos++;
    r.pag[f] = r.pag[f] || { v: 0, n: 0 }; r.pag[f].v += t; r.pag[f].n++;
    (p.itens || []).forEach(i => { r.itens += i.q; r.prod[i.nome] = r.prod[i.nome] || { v: 0, q: 0 }; r.prod[i.nome].v += i.preco * i.q; r.prod[i.nome].q += i.q; });
  });
  return r;
}
const barra = (rot, sub, v, max, extra, cls, key) => `<div class="rb${key ? ' clk' : ''} ${cls || ''}"${key ? ` onclick="relSel('${key}')"` : ''}><div class="rt"><b>${rot}</b><span>${R$(v)}${extra || ''}</span></div><div class="rbar"><i style="width:${max > 0 ? Math.max(2, v / max * 100) : 0}%"></i></div><small>${sub}</small></div>`;
function relRender() {
  const k = $('rm').value; if (!k) return;
  const mes = relAgg(POR[k] || []), ant = relAgg(POR[mesAnt(k)] || []), K12 = ult12();
  const tudo = relAgg(K12.flatMap(m => POR[m] || []));
  const varp = ant.receita > 0 ? Math.round((mes.receita - ant.receita) / ant.receita * 100) : null;
  const fin = mes.pedidos + mes.cancel, tick = mes.pedidos ? mes.receita / mes.pedidos : 0;
  const kpi = (t, v, s) => `<div class="rc"><small>${t}</small><b>${v}</b><i>${s}</i></div>`;
  const ord = o => Object.entries(o).sort((a, b) => b[1].v - a[1].v);
  const pagBars = (agg, destaque) => {
    const l = ord(agg.pag), max = l.length ? l[0][1].v : 0, tot = agg.receita || 1;
    return l.map(([n, x], i) => barra(esc(n) + (destaque && i === 0 ? '<em class="tg">mais lucrativa</em>' : ''), x.n + ' pedido(s) · ticket ' + R$(x.v / x.n), x.v, max, ' · ' + Math.round(x.v / tot * 100) + '%')).join('') || '<p class="rd">Sem vendas no período.</p>';
  };
  const prods = ord(mes.prod).slice(0, 8), pmax = prods.length ? prods[0][1].v : 0;
  const vals = K12.map(m => relAgg(POR[m] || [])), mx = Math.max(...vals.map(v => v.receita));
  $('rOut').innerHTML =
    `<h3 class="pt" style="margin-bottom:10px">${mnome(k).toUpperCase()}</h3><div class="rk">`
    + kpi('Receita total', R$(mes.receita), varp === null ? 'sem mês anterior para comparar' : (varp >= 0 ? '▲ ' : '▼ ') + Math.abs(varp) + '% vs mês anterior')
    + kpi('Pedidos', mes.pedidos, 'entregues') + kpi('Itens vendidos', mes.itens, 'unidades') + kpi('Ticket médio', R$(tick), 'por pedido')
    + kpi('Cancelados', mes.cancel, fin ? Math.round(mes.cancel / fin * 100) + '% dos finalizados' : 'nenhum no mês') + kpi('Aguardando', mes.pend, 'ainda não entregues') + `</div>`
    + `<div class="rp"><h3>POR FORMA DE PAGAMENTO · ${mnome(k).toUpperCase()}</h3>${pagBars(mes)}</div>`
    + `<div class="rp"><h3>FORMA DE PAGAMENTO · ÚLTIMOS 12 MESES</h3><p class="rd">Total de ${R$(tudo.receita)} em ${tudo.pedidos} pedido(s). Veja qual forma de pagamento mais rendeu.</p>${pagBars(tudo, true)}</div>`
    + `<div class="rp"><h3>POR PRODUTO · ${mnome(k).toUpperCase()}</h3>${prods.map(([n, x]) => barra(esc(n), x.q + ' unidade(s)', x.v, pmax)).join('') || '<p class="rd">Sem vendas no período.</p>'}</div>`
    + `<div class="rp"><h3>ÚLTIMOS 12 MESES</h3><p class="rd">Toque em um mês para ver o detalhe dele.</p>${K12.map((m, i) => barra(mnome(m), vals[i].pedidos + ' pedido(s)', vals[i].receita, mx, '', m === k ? 'sel' : '', m)).join('')}</div>`;
}
function relCsv() {
  const k = $('rm').value, l = (POR[k] || []).slice().sort((a, b) => a.criadoEm.seconds - b.criadoEm.seconds);
  if (!l.length) return alert('Não há pedidos neste mês.');
  const c = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const linhas = [['Nº', 'Data', 'Cliente', 'Telefone', 'Itens', 'Entrega', 'Frete', 'Pagamento', 'Quando paga', 'Status', 'Total']].concat(l.map(p => [p.numero || '', p.criadoEm.toDate().toLocaleString('pt-BR'), p.cliente.nome, p.cliente.tel, (p.itens || []).map(i => i.nome + (i.det ? ' (' + i.det + ')' : '') + ' x' + i.q).join(' | '), p.entrega ? (p.entrega.tipo === 'Retirada' ? 'Retirada' : p.entrega.tipo === 'Uber Flash' ? 'Uber Flash' : txtEnd(p.entrega.endereco)) : '', (p.frete || 0).toFixed(2).replace('.', ','), p.pagamento, p.pagamentoQuando || '', p.status, (p.total || 0).toFixed(2).replace('.', ',')]));
  const blob = new Blob(['\ufeff' + linhas.map(r => r.map(c).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pedidos-' + k + '.csv'; document.body.appendChild(a); a.click(); a.remove();
}

// ── Clientes e visitantes ──
let clL = [];
const clTs = x => x && x.toDate ? x.toDate() : null;
const clFd = d => d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const clAp = u => /iPhone|iPad/.test(u) ? 'iPhone' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : '';
async function clCarregar() {
  try {
    const [cs, vs, ps] = await Promise.all([db.collection('clientes').get(), db.collection('visitas').get(), db.collection('pedidos').limit(3000).get()]);
    const M = {}, g = id => M[id] = M[id] || { id, nome: '', tel: '', bairro: '', n: 0, ped: 0, gasto: 0, ultVis: null, ultPed: null, ap: '' };
    vs.docs.forEach(d => { const x = d.data(), c = g(d.id); c.n = x.n || 0; c.ultVis = clTs(x.ultima); c.ap = clAp(x.aparelho || ''); if (x.nome) c.nome = x.nome; });
    cs.docs.forEach(d => { const x = d.data(), c = g(d.id); c.nome = ((x.nome || '') + ' ' + (x.sobrenome || '')).trim() || c.nome; c.tel = x.tel || ''; c.bairro = (x.end || {}).bairro || ''; });
    ps.docs.forEach(d => {
      const p = d.data(); if (!p.uid) return; const c = g(p.uid), t = clTs(p.criadoEm);
      if (!c.nome && p.cliente) c.nome = p.cliente.nome; if (!c.tel && p.cliente) c.tel = p.cliente.tel;
      if (t && (!c.ultPed || t > c.ultPed)) c.ultPed = t;
      if (p.status === 'Entregue') { c.ped++; c.gasto += p.total || 0; }   // só pedidos entregues contam como pedido
    });
    clL = Object.values(M);
  } catch (e) { return alert('Erro ao carregar clientes: ' + e.message + '\n\nConfira se o firestore.rules permite o admin ler "clientes" e "visitas".'); }
  clRender();
}
function clRender() {
  const q = $('clq').value.toLowerCase().trim(), fl = $('clf').value, od = $('clo').value, agora = Date.now(), ult = c => c.ultVis || c.ultPed;
  const l = clL.filter(c => {
    if (fl === 'cad' && !c.tel) return false; if (fl === 'comp' && !c.ped) return false; if (fl === 'vis' && c.tel) return false;
    return !q || (c.nome + ' ' + c.tel + ' ' + c.bairro).toLowerCase().includes(q);
  }).sort((a, b) => od === 'gasto' ? b.gasto - a.gasto : od === 'n' ? b.n - a.n : (ult(b) || 0) - (ult(a) || 0));
  const online = clL.filter(c => c.ultVis && agora - c.ultVis < 3e5).length, hoje = clL.filter(c => c.ultVis && agora - c.ultVis < 864e5).length;
  const kpi = (t, v, s) => `<div class="rc"><small>${t}</small><b>${v}</b><i>${s}</i></div>`;
  $('clk').innerHTML = kpi('Pessoas', clL.length, 'visitantes + clientes') + kpi('Cadastradas', clL.filter(c => c.tel).length, 'com nome e WhatsApp') + kpi('Já pediram', clL.filter(c => c.ped).length, 'pedido entregue') + kpi('Entraram em 24h', hoje, 'visitas recentes') + kpi('Online agora', online, 'últimos 5 minutos');
  $('clb').innerHTML = l.map(c => {
    const tel = String(c.tel || '').replace(/\D/g, '');
    return `<tr><td data-l="Quem"><b>${esc(c.nome || 'Visitante')}</b><br><small style="color:var(--mut)">${esc(c.bairro)}${c.bairro && c.ap ? ' · ' : ''}${esc(c.ap)}${!c.nome ? ' · ' + esc(c.id.slice(0, 6)) : ''}</small></td>
    <td data-l="WhatsApp">${tel ? `<a href="https://wa.me/55${tel}" target="_blank" rel="noopener" style="color:inherit">${esc(c.tel)}</a>` : '—'}</td>
    <td data-l="Visitas">${c.n || '—'}</td><td data-l="Última visita">${clFd(ult(c))}</td><td data-l="Pedidos">${c.ped || '—'}</td><td data-l="Total gasto">${c.gasto ? R$(c.gasto) : '—'}</td><td class="acoes"><button class="ab r" onclick="clApagar('${esc(c.id)}')">Apagar</button></td></tr>`;
  }).join('') || '<tr><td colspan="7" style="color:var(--mut)">Nenhum resultado.</td></tr>';
}
// Apaga o cadastro (clientes) e o registro de visitas. Os PEDIDOS ficam, para não bagunçar os relatórios.
async function clApagar(id) {
  const c = clL.find(x => x.id === id); if (!c) return;
  if (!confirm('Apagar "' + (c.nome || 'Visitante') + '"?\n\nSerão removidos o cadastro e o histórico de visitas. Os pedidos dessa pessoa continuam salvos.')) return;
  try {
    const b = db.batch(); b.delete(db.collection('clientes').doc(id)); b.delete(db.collection('visitas').doc(id)); await b.commit();
    clL = clL.filter(x => x.id !== id); clRender(); avisoAdm('Cliente apagado');
  } catch (e) { alert('Erro ao apagar: ' + e.message); }
}
async function clApagarTodos() {
  if (!clL.length) return alert('Não há clientes para apagar.');
  if (!confirm('Apagar TODOS os ' + clL.length + ' clientes e visitantes?\n\nSerão removidos cadastros e histórico de visitas. Os pedidos continuam salvos. Isso não tem volta.')) return;
  if ((prompt('Para confirmar, digite APAGAR') || '').trim().toUpperCase() !== 'APAGAR') return alert('Cancelado: nada foi apagado.');
  try {
    const ids = clL.map(x => x.id);
    for (let i = 0; i < ids.length; i += 200) {   // lotes de 200 (2 apagamentos por pessoa, limite de 500 por lote)
      const b = db.batch(); ids.slice(i, i + 200).forEach(id => { b.delete(db.collection('clientes').doc(id)); b.delete(db.collection('visitas').doc(id)); }); await b.commit();
    }
    clL = []; clRender(); avisoAdm('Todos os clientes foram apagados');
  } catch (e) { alert('Erro ao apagar: ' + e.message); }
}
function clCsv() {
  const c = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['Nome', 'WhatsApp', 'Bairro', 'Visitas', 'Última visita', 'Pedidos', 'Total gasto']].concat(clL.map(x => [x.nome || 'Visitante', x.tel, x.bairro, x.n, clFd(x.ultVis || x.ultPed), x.ped, x.gasto.toFixed(2).replace('.', ',')]));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(c).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = 'clientes.csv'; document.body.appendChild(a); a.click(); a.remove();
}

// ── Diagnóstico dos avisos: mostra em qual etapa o push quebra ──
async function testarAvisos() {
  const L = [], ok = (b, t) => L.push((b ? '✅ ' : '❌ ') + t);
  const seguro = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  ok(seguro, 'Endereço seguro (' + location.protocol + '//' + location.host + ')' + (seguro ? '' : ' → abra por https:// ou localhost, nunca por file://'));
  if (ios) ok(standalone, 'Aberto pelo ícone da Tela de Início' + (standalone ? '' : ' → no iPhone, instale em Compartilhar → Adicionar à Tela de Início e abra pelo ícone'));
  ok('serviceWorker' in navigator, 'Navegador tem service worker');
  ok(temNotif(), 'Navegador tem notificações' + (temNotif() ? '' : (ios ? ' → no iPhone só existe com o painel instalado na Tela de Início (iOS 16.4+)' : '')));
  let regs = []; try { regs = await navigator.serviceWorker.getRegistrations(); } catch (e) {}
  const sw = regs.find(r => r.active); ok(!!sw, 'Service worker ativo' + (sw ? '' : ' → recarregue com Ctrl+Shift+R'));
  let sup = false; try { sup = await firebase.messaging.isSupported(); } catch (e) {} ok(sup, 'Este navegador suporta push (FCM)' + (sup ? '' : ' → use Chrome/Edge fora do VS Code, ou iOS 16.4+ com o painel instalado'));
  const perm = permNotif();
  ok(perm === 'granted', 'Permissão de notificação: ' + (perm === 'unsupported' ? 'n/d' : perm) + (perm === 'denied' ? ' → libere nos ajustes do navegador/celular' : ''));
  ok(!!LOJA.vapidKey, 'vapidKey preenchida no config.js');
  try { const n = (await db.collection('admTokens').get()).size; ok(n > 0, 'Aparelhos registrados em admTokens: ' + n + (n ? '' : ' → clique em 🔔 Ativar avisos')); }
  catch (e) { ok(false, 'Sem acesso a admTokens (' + e.code + ') → ajuste o firestore.rules'); }
  beep(); piscarTitulo();
  if (temNotif() && Notification.permission === 'granted' && sw) {
    try { await sw.showNotification('🔧 Teste de aviso', { ...OPC_NOTIF, body: 'Se você viu e ouviu isto, o aparelho está pronto.', tag: 'teste' }); ok(true, 'Notificação de teste enviada (deve aparecer agora, com som)'); }
    catch (e) { ok(false, 'Falha ao mostrar notificação: ' + e.message); }
  }
  // Teste ponta a ponta: pede ao servidor para enviar um push de verdade
  avisoAdm('Testando o servidor...');
  try {
    const ref = await db.collection('admTestes').add({ em: firebase.firestore.FieldValue.serverTimestamp() });
    const res = await new Promise(r => { const off = ref.onSnapshot(s => { const d = s.data(); if (d && d.resultado) { off(); r(d.resultado); } }); setTimeout(() => { off(); r(null); }, 15000); });
    if (!res) ok(false, 'O servidor não respondeu em 15 s → a função "testePush" não está publicada ou está em outra região (veja REGIAO no index.js e rode firebase deploy --only functions)');
    else if (res.erro) ok(false, 'Servidor tentou enviar e deu erro: ' + res.erro);
    else if (!res.aparelhos) ok(false, 'Servidor respondeu, mas não há aparelho registrado → clique em 🔔 Ativar avisos');
    else ok(res.ok > 0, 'Servidor enviou push: ' + res.ok + ' ok, ' + res.falhas + ' falha(s)' + (res.ok > 0 ? ' → ele deve chegar em instantes (com a aba aberta, aparece com som; fechada, vem do sistema)' : ' → o aparelho registrado expirou; clique em 🔔 Ativar avisos de novo'));
    ref.delete().catch(() => {});
  } catch (e) { ok(false, 'Não consegui pedir o teste ao servidor (' + (e.code || e.message) + ') → publique o firestore.rules novo'); }
  L.push('', 'Se tudo está ✅ e o pedido de teste não avisa, olhe Firebase → Functions → Logs de "novoPedido".');
  alert(L.join('\n'));
}

// ── Venda manual: cliente que comprou fora do site ──
// Cria um pedido já ENTREGUE (entra na receita e nos relatórios) e pode ser de um item do cardápio ou avulso.
let VM = [], VMS = {}, VMGR = [];   // VMS = complementos escolhidos do item atual; VMGR = grupos do item atual
const VM_PAG = ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito'];
const VM_IN = 'width:100%;box-sizing:border-box;padding:10px;margin:0 0 8px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--tx);font-size:14px';
function criarBotaoVenda() {
  if ($('bVM')) return;
  const tb = $('peds') && $('peds').closest('table'); if (!tb) return;
  const b = document.createElement('button'); b.id = 'bVM'; b.className = 'btn'; b.textContent = '➕ Registrar venda manual'; b.style.margin = '0 0 12px'; b.onclick = abrirVendaManual;
  tb.parentNode.insertBefore(b, tb);
}
function abrirVendaManual() {
  fecharVendaManual(); VM = []; VMS = {};
  const h = new Date(), hoje = new Date(h - h.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  // formas de pagamento: as cadastradas no painel (ou Pix/Cartão/Dinheiro) + as comuns + Fiado + as já usadas em pedidos
  const cfgPag = Array.isArray(CFG.pagamentos) ? CFG.pagamentos.filter(Boolean) : [], vistos = new Set(), pags = [];
  [...(cfgPag.length ? cfgPag : ['Pix', 'Cartão', 'Dinheiro']), ...VM_PAG, 'Fiado', ...Object.values(PED).map(p => p.pagamento)].forEach(x => {
    x = String(x || '').trim(); const k = x.toLowerCase(); if (!x || k === 'sem cobrança' || vistos.has(k)) return; vistos.add(k); pags.push(x);
  });
  const prods = Object.entries(PROD).sort((a, b) => (a[1].nome || '').localeCompare(b[1].nome || '', 'pt-BR'));
  const d = document.createElement('div'); d.id = 'vm';
  d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;overflow:auto;padding:16px;box-sizing:border-box';
  d.innerHTML = `<div onclick="if(!event.target.closest('#vmN,#vmT,#vmRes')){const r=$('vmRes');if(r)r.style.display='none'}" style="max-width:460px;margin:0 auto;background:var(--card);color:var(--tx);border:1px solid var(--line);border-radius:14px;padding:18px">
    <h3 style="margin:0 0 4px">🧾 Registrar venda manual</h3>
    <p style="margin:0 0 14px;font-size:12px;color:var(--mut)">Para venda feita fora do site. Entra como <b>Entregue</b> e conta na receita.</p>
    <label style="font-size:12px;color:var(--mut)">Cliente (opcional) · busque pelo nome ou WhatsApp e toque para escolher</label><input id="vmN" autocomplete="off" placeholder="Buscar ou digitar o nome" oninput="vmBuscar('n')" onfocus="vmBuscar('n')" style="${VM_IN}"><div id="vmRes" style="display:none;max-height:200px;overflow:auto;border:1px solid var(--line);border-radius:8px;margin:-4px 0 8px;background:var(--bg)"></div>
    <input id="vmT" inputmode="tel" placeholder="WhatsApp (opcional)" oninput="vmBuscar('t')" onfocus="vmBuscar('t')" style="${VM_IN}">
    <div style="border-top:1px solid var(--line);margin:6px 0 12px"></div>
    <label style="font-size:12px;color:var(--mut)">Produto</label>
    <select id="vmP" onchange="vmProd()" style="${VM_IN}"><option value="">— Item avulso (fora do catálogo) —</option>${prods.map(([id, p]) => `<option value="${esc(id)}">${esc(p.nome)}</option>`).join('')}</select>
    <input id="vmNm" placeholder="Nome do item" style="${VM_IN}">
    <div id="vmCmp"></div>
    <div id="vmPv" style="font-size:12px;color:var(--mut);margin:0 0 10px"></div>
    <div style="display:flex;gap:8px"><div style="width:90px"><label style="font-size:12px;color:var(--mut)">Qtd</label><input id="vmQ" type="number" min="1" value="1" inputmode="numeric" style="${VM_IN}"></div>
    <div style="flex:1"><label style="font-size:12px;color:var(--mut)">Preço (R$)</label><input id="vmPr" oninput="vmPv()" type="number" step="0.01" min="0" inputmode="decimal" style="${VM_IN}"></div></div>
    <button class="btn o" style="width:100%;margin-bottom:10px" onclick="vmAdd()">+ Adicionar item</button>
    <div id="vmL" style="margin-bottom:12px"></div>
    <label style="font-size:12px;color:var(--mut)">Forma de pagamento</label><select id="vmPg" onchange="vmPgSel()" style="${VM_IN}"><option value="">— Selecione —</option>${pags.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}<option value="__outra">Outra (digitar)…</option></select><input id="vmPg2" maxlength="40" placeholder="Nome da forma de pagamento" style="${VM_IN};display:none">
    <label style="font-size:12px;color:var(--mut)">Data da venda</label><input id="vmD" type="date" value="${hoje}" max="${hoje}" style="${VM_IN}">
    <div style="display:flex;gap:8px;margin-top:6px"><button class="btn o" style="flex:1" onclick="fecharVendaManual()">Cancelar</button><button id="vmS" class="btn" style="flex:1" onclick="salvarVendaManual()">Registrar venda</button></div></div>`;
  document.body.appendChild(d); vmProd(); vmRender(); vmCarregarClientes();
}
// Clientes conhecidos: TODOS os cadastrados no site + todos que já fizeram pedido (sem repetir). Ao escolher, nome e WhatsApp vêm juntos.
let VMC = [], VML = [];
const vmTel = t => { let x = String(t || '').replace(/\D/g, ''); if (/^55\d{10,11}$/.test(x)) x = x.slice(2); return x; };
const vmFmtTel = t => t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t.length === 10 ? `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}` : t;
function vmMontar(...listas) {
  const m = new Map();
  listas.forEach(l => (l || []).forEach(c => {
    const nome = String((c && c.nome) || '').trim(), tel = vmTel(c && c.tel);
    if (!tel && (!nome || nome === 'Cliente (venda manual)')) return;
    const k = tel || normN(nome), x = m.get(k);
    if (!x) m.set(k, { nome: nome === 'Cliente (venda manual)' ? '' : nome, tel });
    else if (nome && nome !== 'Cliente (venda manual)' && nome.length > x.nome.length) x.nome = nome;
  }));
  return [...m.values()].sort((x, y) => (x.nome || '~').localeCompare(y.nome || '~', 'pt-BR'));
}
async function vmCarregarClientes() {
  const dePed = Object.values(PED).map(p => p.cliente);
  VMC = vmMontar(dePed);   // já mostra os dos pedidos recentes enquanto o resto carrega
  const [cs, ps] = await Promise.all([db.collection('clientes').get().catch(() => null), db.collection('pedidos').limit(3000).get().catch(() => null)]);
  VMC = vmMontar(cs ? cs.docs.map(x => { const c = x.data(); return { nome: ((c.nome || '') + ' ' + (c.sobrenome || '')).trim(), tel: c.tel }; }) : [], ps ? ps.docs.map(x => x.data().cliente) : dePed, dePed);
  if ($('vm') && document.activeElement && (document.activeElement.id === 'vmN' || document.activeElement.id === 'vmT')) vmBuscar(document.activeElement.id === 'vmT' ? 't' : 'n');
}
function vmBuscar(de) {
  const box = $('vmRes'); if (!box) return;
  const q = normN($('vmN').value), qt = vmTel($('vmT').value);
  const l = VMC.filter(c => de === 't' ? (!qt || c.tel.includes(qt)) : (!q || normN(c.nome).includes(q)));
  const exato = l.length === 1 && normN(l[0].nome) === q && l[0].tel === qt;
  if (!l.length || exato) { box.style.display = 'none'; return; }
  VML = l.slice(0, 80);
  box.innerHTML = VML.map((c, i) => `<div onclick="vmEscolher(${i})" style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--line);font-size:14px"><b>${esc(c.nome || 'Sem nome')}</b>${c.tel ? '<br><small style="color:var(--mut)">' + esc(vmFmtTel(c.tel)) + '</small>' : ''}</div>`).join('')
    + (l.length > 80 ? `<div style="padding:8px 12px;font-size:12px;color:var(--mut)">+ ${l.length - 80} clientes. Continue digitando para filtrar.</div>` : '');
  box.style.display = 'block';
}
function vmEscolher(i) { const c = VML[i]; if (!c) return; $('vmN').value = c.nome; $('vmT').value = c.tel; $('vmRes').style.display = 'none'; }
function fecharVendaManual() { const d = $('vm'); if (d) d.remove(); }
function vmProd() {   // troca de item: preenche o preço
  const id = $('vmP').value, p = PROD[id];
  $('vmNm').style.display = p ? 'none' : 'block';
  $('vmPr').value = p ? (emPromo(p) ? p.promo : p.preco) : '';
  VMS = {}; vmCmpRender();
}
function vmAdd() {
  const id = $('vmP').value, p = PROD[id], q = parseInt($('vmQ').value), preco = parseFloat(String($('vmPr').value).replace(',', '.'));
  const nome = p ? p.nome : $('vmNm').value.trim().slice(0, 80);
  if (!nome) return alert('Digite o nome do item.');
  if (!(q >= 1)) return alert('Quantidade inválida.');
  if (!(preco >= 0)) return alert('Informe o preço.');
  const c = vmCalc(p, false); if (c.erro) return alert(c.erro);
  const extra = vmR2(c.extra);
  const det = [c.det].filter(Boolean).join(' · ');
  VM.push({ id: p ? id : 'avulso', nome, tam: 'Único', ...(det ? { det } : {}), q, ...(extra ? { extra } : {}), preco: vmR2(preco + extra) });
  if (!p) $('vmNm').value = ''; $('vmQ').value = 1; VMS = {}; vmCmpRender(); vmRender();
}
// ── Complementos na venda manual (mesmos grupos do Catálogo) ──
const vmR2 = v => Math.round(v * 100) / 100;
function vmGrupos(p) {   // grupos ligados ao item (config/loja → complementos, pelos ids em p.grupos); itens antigos usam os do próprio item ou os adicionais
  if (!p) return [];
  const ids = Array.isArray(p.grupos) ? p.grupos : [], G = Array.isArray(CFG.complementos) ? CFG.complementos : [];
  const doItem = ids.map(id => G.find(g => g.id === id)).filter(Boolean);
  const l = (doItem.length ? doItem : (Array.isArray(p.complementos) ? p.complementos : [])).map((g, i) => {
    const min = Math.max(0, +g.min || 0), max = Math.max(1, min, +g.max || 1);
    return { ...g, id: String(g.id ?? 'g' + i), nome: g.nome || 'Opções', min, max, regra: g.regra || 'soma', opcoes: (g.opcoes || []).map(o => ({ ...o, nome: String(o.nome ?? ''), preco: +o.preco || 0, max: +o.max || 1 })) };
  }).filter(g => g.opcoes.length);
  if (!l.length && Array.isArray(p.adicionais) && p.adicionais.length) {
    l.push({ id: '_ad', nome: p.adTitulo || 'Adicionais', min: 0, max: p.adicionais.length, regra: 'soma', opcoes: p.adicionais.map(o => ({ nome: String(o.nome || ''), preco: +o.preco || 0, max: 1 })) });
  }
  return l;
}
const vmOmax = (g, o) => g.repete ? Math.max(1, +g.max || 1) : Math.max(1, Math.min(+o.max || 1, +g.max || 1));
const vmTot = g => Object.values(VMS[g.id] || {}).reduce((a, b) => a + (+b || 0), 0);
function vmCalc(p, frouxo) {   // preço extra e texto dos complementos escolhidos (mesma regra do site: soma / média / maior / menor)
  let extra = 0; const partes = [];
  for (const g of vmGrupos(p)) {
    const s = VMS[g.id] || {}, un = [], nomes = []; let tot = 0;
    for (const [i, q0] of Object.entries(s)) {
      const o = g.opcoes[+i], q = +q0; if (!o || !(q > 0)) continue;
      for (let k = 0; k < q; k++) un.push(o.preco); tot += q; nomes.push((q > 1 ? q + '× ' : '') + o.nome);
    }
    if (!frouxo && tot < g.min) return { erro: (g.min === g.max ? 'Escolha ' + g.min : 'Escolha pelo menos ' + g.min) + ' em "' + g.nome + '".', extra: 0, det: '' };
    if (!tot) continue;
    const soma = un.reduce((a, b) => a + b, 0);
    extra += g.regra === 'media' ? soma / un.length : g.regra === 'maior' ? Math.max(...un) : g.regra === 'menor' ? Math.min(...un) : soma;
    partes.push(g.nome + ': ' + nomes.join(', '));
  }
  return { extra: vmR2(extra), det: partes.join(' · ') };
}
function vmCmpRender() {
  const box = $('vmCmp'); if (!box) return;
  VMGR = vmGrupos(PROD[$('vmP').value]);
  box.innerHTML = VMGR.map((g, gi) => {
    const s = VMS[g.id] || {}, lim = g.min > 0 ? (g.min === g.max ? 'Escolha ' + g.max : 'Escolha de ' + g.min + ' a ' + g.max) : (g.max === 1 ? 'Escolha 1 (opcional)' : 'Escolha até ' + g.max);
    return `<div style="border:1px solid var(--line);border-radius:10px;padding:10px;margin:0 0 8px"><div style="font-weight:600;font-size:13px">${esc(g.nome)} <small style="color:var(--mut);font-weight:400">· ${lim}</small></div>`
      + g.opcoes.map((o, oi) => `<div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:13px"><span style="flex:1">${esc(o.nome)}${o.preco > 0 ? ' <small style="color:var(--mut)">+ ' + R$(o.preco) + '</small>' : ''}</span><button type="button" class="ab" onclick="vmStep(${gi},${oi},-1)">−</button><b style="min-width:18px;text-align:center">${s[oi] || 0}</b><button type="button" class="ab" onclick="vmStep(${gi},${oi},1)">+</button></div>`).join('') + '</div>';
  }).join('');
  vmPv();
}
function vmStep(gi, oi, d) {
  const g = VMGR[gi]; if (!g) return; const o = g.opcoes[oi], s = VMS[g.id] = VMS[g.id] || {}, n = (s[oi] || 0) + d;
  if (n < 0) return;
  if (d > 0) {
    if (g.max === 1) VMS[g.id] = { [oi]: 1 };   // escolha única: trocar de opção
    else {
      if (n > vmOmax(g, o)) return alert('Máximo de ' + vmOmax(g, o) + ' para "' + o.nome + '".');
      if (vmTot(g) >= g.max) return alert('Em "' + g.nome + '" você pode escolher até ' + g.max + '.');
      s[oi] = n;
    }
  } else { s[oi] = n; if (!n) delete s[oi]; }
  vmCmpRender();
}
function vmPv() {   // prévia do valor do item com os complementos
  const el = $('vmPv'); if (!el) return;
  const c = vmCalc(PROD[$('vmP').value], true), ex = vmR2(c.extra), base = parseFloat(String($('vmPr').value).replace(',', '.')) || 0;
  el.textContent = ex > 0 ? 'Complementos: + ' + R$(ex) + ' · cada unidade fica ' + R$(base + ex) : '';
}
function vmPgSel() { $('vmPg2').style.display = $('vmPg').value === '__outra' ? 'block' : 'none'; }
function vmDel(i) { VM.splice(i, 1); vmRender(); }
function vmRender() {
  const sub = VM.reduce((x, i) => x + i.preco * i.q, 0), tot = Math.round(sub * 100) / 100;
  $('vmL').innerHTML = VM.length
    ? VM.map((i, k) => `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;font-size:13px"><span style="flex:1">${i.q}× ${esc(i.nome)} ${i.det ? ' <small>(' + esc(i.det) + ')</small>' : ''}</span><b>${R$(i.preco * i.q)}</b><button class="ab r" onclick="vmDel(${k})">✕</button></div>`).join('')
      + `<div style="display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:8px;margin-top:6px"><span>Total</span><b style="font-size:16px">${R$(tot)}</b></div>`
    : '<p style="color:var(--mut);font-size:12px;margin:0">Nenhum item adicionado.</p>';
}
async function salvarVendaManual() {
  if (!VM.length) return alert('Adicione pelo menos um item.');
  const pag = ($('vmPg').value === '__outra' ? $('vmPg2').value : $('vmPg').value).trim().slice(0, 40); if (!pag) return alert('Escolha a forma de pagamento.');
  const nome = $('vmN').value.trim().slice(0, 80) || 'Cliente (venda manual)', tel = $('vmT').value.replace(/\D/g, '');
  const dt = $('vmD').value ? new Date($('vmD').value + 'T12:00:00') : new Date();
  const sub = Math.round(VM.reduce((x, i) => x + i.preco * i.q, 0) * 100) / 100, frete = 0, total = sub, btn = $('vmS'); btn.disabled = true;
  let ref;
  try {
    // cria como "Novo" com estoque liberado e passa para "Entregue" pela mesma rotina dos pedidos 
    ref = await db.collection('pedidos').add({ cliente: { nome, tel }, itens: VM.map(i => ({ ...i })), pagamento: pag, pagamentoQuando: 'Na retirada', subtotal: sub, total, frete, status: 'Novo', origem: 'Manual', criadoEm: firebase.firestore.Timestamp.fromDate(dt) });
    await mudarStatus(ref.id, 'Entregue');
    fecharVendaManual(); avisoAdm('Venda registrada ✔');
  } catch (e) {
    if (ref) await ref.delete().catch(() => {});   // não deixa venda pela metade
    btn.disabled = false; alert('Não foi possível registrar a venda: ' + e.message);
  }
}

// ── Layout: a tabela de pedidos não pode ser cortada na lateral (telas largas) ──
function ajustarLayout() {
  const tb = $('peds') && $('peds').closest('table'); if (!tb || window.innerWidth <= 900) return;
  for (let el = tb.parentElement; el && el !== document.body; el = el.parentElement) {
    const cs = getComputedStyle(el), mw = parseFloat(cs.maxWidth);
    if (mw && mw < 1400) el.style.maxWidth = 'min(1400px, 96vw)';   // alarga o painel para caberem todos os botões
    if (cs.overflowX === 'hidden') el.style.overflowX = 'auto';      // se ainda faltar espaço, rola em vez de cortar
  }
}

// ── Entrega: liga/desliga a opção "Entrega" (a entrega feita pelo próprio restaurante) ──
function montarEntregaOpc() {
  if ($('en-sec')) return;
  const alvo = $('uf-sec') || $('tema-sec') || [...document.querySelectorAll('#tP .sec')].find(x => { const h = x.querySelector('h2'); return h && h.textContent.trim() === 'PIX'; });
  if (!alvo) return;
  const s = document.createElement('div'); s.className = 'sec'; s.id = 'en-sec';
  s.innerHTML = `<h2 class="pt">ENTREGA</h2>
    <p class="rd">Entrega feita pelo próprio restaurante (com endereço, bairro e taxa). Desligada, o cliente <b>não vê</b> o botão Entrega: ficam só o Uber Flash (se estiver ligado) e Retirar no restaurante. Os pedidos que já existem não mudam.</p>
    <label>Oferecer Entrega no restaurante?</label><select id="enAtivo"><option value="1">Sim, oferecer</option><option value="0">Não oferecer</option></select>
    <button class="btn" onclick="salvarEntregaOpc()">Salvar Entrega</button>`;
  alvo.parentNode.insertBefore(s, alvo);
  $('enAtivo').value = CFG.entregaAtiva === false ? '0' : '1';
}
async function salvarEntregaOpc() {
  const on = $('enAtivo').value === '1';
  if (!on && (CFG.uberFlash || {}).ativo === false && !confirm('Com Entrega e Uber Flash desligados, o cliente só poderá retirar no restaurante. Continuar?')) return;
  try { await db.collection('config').doc('loja').set({ entregaAtiva: on }, { merge: true }); avisoAdm(on ? 'Entrega ligada' : 'Entrega desligada'); }
  catch (e) { alert('Erro ao salvar: ' + e.message); }
}

// ── Uber Flash: liga/desliga a opção no restaurante e define um aviso opcional para o cliente ──
function montarUber() {
  if ($('uf-sec')) return;
  const alvo = $('tema-sec') || [...document.querySelectorAll('#tP .sec')].find(x => { const h = x.querySelector('h2'); return h && h.textContent.trim() === 'PIX'; });
  if (!alvo) return;
  const s = document.createElement('div'); s.className = 'sec'; s.id = 'uf-sec';
  s.innerHTML = `<h2 class="pt">UBER FLASH</h2>
    <p class="rd">Para o cliente que chama o Uber Flash por conta própria. Ligado, o cliente vê a opção <b>Uber Flash</b> ao finalizar (junto de Entrega e Retirar no restaurante), <b>sem digitar endereço</b>: ele vê o endereço do restaurante, chama o motoboy pelo app do Uber e paga a corrida direto ao Uber. No restaurante ele paga <b>só os produtos, por Pix</b>. O endereço de retirada é o que está em Ajustes do restaurante.</p>
    <label>Oferecer Uber Flash no restaurante?</label><select id="ufAtivo"><option value="1">Sim, oferecer</option><option value="0">Não oferecer</option></select>
    <label>Aviso para o cliente (opcional)</label><textarea id="ufAviso" rows="3" maxlength="300" placeholder="Ex.: Uber Flash de segunda a sábado, das 9h às 17h."></textarea>
    <button class="btn" onclick="salvarUber()">Salvar Uber Flash</button>`;
  alvo.parentNode.insertBefore(s, alvo);
  const u = CFG.uberFlash || {}; $('ufAtivo').value = u.ativo === false ? '0' : '1'; $('ufAviso').value = u.aviso || '';
}
async function salvarUber() {
  if ($('ufAtivo').value === '0' && CFG.entregaAtiva === false && !confirm('Com Entrega e Uber Flash desligados, o cliente só poderá retirar no restaurante. Continuar?')) return;
  try { await db.collection('config').doc('loja').set({ uberFlash: { ativo: $('ufAtivo').value === '1', aviso: $('ufAviso').value.trim().slice(0, 300) } }, { merge: true }); avisoAdm('Uber Flash salvo'); }
  catch (e) { alert('Erro ao salvar: ' + e.message); }
}

// ── Galeria de fotos do site (carrossel): cada foto é um documento da coleção "galeria" (cabe no limite de 1 MB do Firestore) ──
const GAL_MAX = 12; let GALARR = [];
function montarGaleria() {   // cria a seção GALERIA DE FOTOS logo acima de PRODUTOS
  if ($('gal-sec')) return;
  const prod = [...document.querySelectorAll('#tP .sec')].find(x => { const h = x.querySelector('h2'); return h && h.textContent.trim() === 'CARDÁPIO'; });
  if (!prod) return;
  const s = document.createElement('div'); s.className = 'sec'; s.id = 'gal-sec';
  s.innerHTML = `<h2 class="pt">GALERIA DE FOTOS</h2>
    <p class="rd">Fotos que ficam passando sozinhas, em um carrossel contínuo, no site do cliente. Pode escolher várias de uma vez, até ${GAL_MAX} fotos. Use ◀ ▶ para mudar a ordem. A galeria só aparece no site quando tem pelo menos uma foto.</p>
    <label>Título acima das fotos</label>
    <div class="rctl"><input id="galTit" placeholder="Ex.: Nosso trabalho" maxlength="40" autocomplete="off" style="flex:1;min-width:160px;width:auto;margin:0" onkeydown="if(event.key==='Enter')salvarGalTit()"><button class="btn o" onclick="salvarGalTit()">Salvar título</button></div>
    <label style="display:block;margin-top:14px">Adicionar fotos</label><input id="galF" type="file" accept="image/*" multiple onchange="addGaleria(this)">
    <div id="galL" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-top:6px"></div>`;
  prod.parentNode.insertBefore(s, prod);
  $('galTit').value = CFG.galeriaTitulo || '';
  db.collection('galeria').orderBy('ordem').onSnapshot(sn => { GALARR = sn.docs.map(x => ({ id: x.id, ...x.data() })); renderGalAdm(); }, e => alert('Erro ao carregar a galeria: ' + e.message + '\n\nConfira se a regra da coleção "galeria" foi publicada no Firestore.'));
}
function renderGalAdm() {
  const L = $('galL'); if (!L) return;
  L.innerHTML = GALARR.length ? GALARR.map((g, i) => `<div style="border:1px solid var(--line);background:var(--card)"><img src="${esc(g.img)}" alt="" style="display:block;width:100%;aspect-ratio:3/4;object-fit:cover"><div style="display:flex;gap:4px;padding:6px"><button class="ab" ${i ? '' : 'disabled'} onclick="moverGaleria(${i},-1)">◀</button><button class="ab" ${i < GALARR.length - 1 ? '' : 'disabled'} onclick="moverGaleria(${i},1)">▶</button><button class="ab r" style="margin-left:auto" title="Remover" onclick="tirarGaleria(${i})">✕</button></div></div>`).join('')
    : '<p class="rd" style="grid-column:1/-1">Nenhuma foto ainda.</p>';
}
function fotoGaleria(f) {   // reduz para 900 px e JPEG leve: o site carrega todas as fotos de uma vez
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      let q = 0.82, d = c.toDataURL('image/jpeg', q);
      while (d.length > 250000 && q > 0.5) { q -= 0.06; d = c.toDataURL('image/jpeg', q); }
      URL.revokeObjectURL(url); res(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não foi possível ler ' + f.name)); };
    img.src = url;
  });
}
async function addGaleria(inp) {
  const fs = [...inp.files]; if (!fs.length) return;
  const livre = GAL_MAX - GALARR.length;
  if (livre <= 0) { inp.value = ''; return alert('A galeria já tem ' + GAL_MAX + ' fotos. Remova alguma para adicionar outra.'); }
  if (fs.length > livre) alert('Cabem só mais ' + livre + ' foto(s). Vou adicionar as primeiras ' + livre + '.');
  let n = 0; const base = Date.now();
  try {
    for (const f of fs.slice(0, livre)) { const d = await fotoGaleria(f); await db.collection('galeria').add({ img: d, ordem: base + n }); n++; }
    avisoAdm(n + (n === 1 ? ' foto adicionada' : ' fotos adicionadas'));
  } catch (e) { alert('Erro ao salvar: ' + e.message); }
  inp.value = '';
}
async function moverGaleria(i, d) {
  const a = GALARR[i], b = GALARR[i + d]; if (!a || !b) return;
  try { const bt = db.batch(); bt.update(db.collection('galeria').doc(a.id), { ordem: b.ordem }); bt.update(db.collection('galeria').doc(b.id), { ordem: a.ordem }); await bt.commit(); }
  catch (e) { alert('Erro ao mover: ' + e.message); }
}
async function tirarGaleria(i) {
  const g = GALARR[i]; if (!g || !confirm('Remover esta foto da galeria?')) return;
  try { await db.collection('galeria').doc(g.id).delete(); avisoAdm('Foto removida'); } catch (e) { alert('Erro ao remover: ' + e.message); }
}
async function salvarGalTit() {
  try { await db.collection('config').doc('loja').set({ galeriaTitulo: $('galTit').value.trim().slice(0, 40) }, { merge: true }); avisoAdm('Título salvo'); }
  catch (e) { alert('Erro ao salvar: ' + e.message); }
}
// ── Logo: liga/desliga sozinho "Esconder o fundo colorido da logo" ao escolher uma logo nova ──
// px = pixels RGBA, w x h = tamanho. Devolve { semFundo, motivo }.
function analisarFundoLogo(px, w, h) {
  const lum = i => (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
  let n = 0, transp = 0, soma = 0; const hist = new Array(256).fill(0);
  for (let i = 0; i < px.length; i += 4) {
    n++;
    if (px[i + 3] < 40) { transp++; continue; }
    const l = lum(i); soma += l; hist[Math.min(255, Math.round(l * 255))]++;
  }
  const opacos = n - transp;
  if (!opacos) return { semFundo: false, motivo: 'vazia' };
  const pct = q => { let acc = 0; const alvo = opacos * q; for (let k = 0; k < 256; k++) { acc += hist[k]; if (acc >= alvo) return k / 255; } return 1; };
  if (transp / n > 0.04) return { semFundo: false, motivo: soma / opacos < 0.2 ? 'transparente-escura' : 'transparente' };
  let bs = 0, bn = 0;
  const borda = (x, y) => { bs += lum((y * w + x) * 4); bn++; };
  for (let x = 0; x < w; x++) { borda(x, 0); borda(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { borda(0, y); borda(w - 1, y); }
  const fundo = bs / bn;
  if (fundo > 0.5) return { semFundo: false, motivo: 'fundo-claro' };
  if (pct(0.99) - fundo < 0.3) return { semFundo: false, motivo: 'escura' };
  return { semFundo: true, motivo: 'clara-fundo-escuro' };
}
(function () {
  const el = $('alogo'); if (!el) return;
  const MSG = {
    'clara-fundo-escuro': 'Detectei uma logo clara com fundo escuro/colorido: o efeito foi LIGADO para esconder esse fundo.',
    'transparente': 'Detectei uma logo com fundo transparente: o efeito foi DESLIGADO e ela aparece com as cores originais.',
    'transparente-escura': 'Fundo transparente, mas a logo é escura e pode ficar difícil de ver num site escuro. Efeito DESLIGADO; se ficar apagada, use uma versão clara da logo.',
    'fundo-claro': 'Detectei uma logo com fundo claro: o efeito foi DESLIGADO (ele deixaria um quadrado claro no banner).',
    'escura': 'Detectei uma logo escura: o efeito foi DESLIGADO (ela sumiria no fundo escuro). Se ficar apagada, use uma versão clara.'
  };
  el.addEventListener('load', () => {
    if (!logoNova || el.src !== logoNova) return;   // só para a logo recém-escolhida (não mexe na que já está salva)
    try {
      const k = Math.min(1, 160 / Math.max(el.naturalWidth, el.naturalHeight)), w = Math.max(1, Math.round(el.naturalWidth * k)), h = Math.max(1, Math.round(el.naturalHeight * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(el, 0, 0, w, h);
      const r = analisarFundoLogo(x.getImageData(0, 0, w, h).data, w, h);
      $('asf').checked = r.semFundo;
      let st = $('asfAuto');
      if (!st) { st = document.createElement('span'); st.id = 'asfAuto'; st.style.cssText = 'display:block;font-size:12px;color:var(--mut);margin:-8px 0 14px'; $('asf').parentNode.insertAdjacentElement('afterend', st); }
      st.textContent = MSG[r.motivo] ? MSG[r.motivo] + ' Você pode mudar a caixa acima e toque em Salvar ajustes para aplicar.' : '';
    } catch (e) {}   // se o navegador não deixar ler a imagem, a caixa continua como está
  });
})(); 
// ── Logo quadrada/com fundo escuro: vira transparente sozinha ao escolher a logo (some o "quadrado" no site) ──
(function () {
  // Logo clara sobre fundo escuro e OPACO (ex.: dourado num quadrado cinza-escuro): troca o fundo por transparência de verdade,
  // para a logo ficar "solta" no site em vez de aparecer como um quadrado. Altera px (RGBA) no lugar. Devolve true se mexeu.
  function fundoEscuroParaTransparente(px, w, h) {
    const n = w * h; if (n < 16) return false;
    const val = i => Math.max(px[i], px[i + 1], px[i + 2]) / 255;   // brilho da cor: azul ou vermelho vivo também contam como "claros"
    const hist = new Array(256).fill(0), hb = new Array(256).fill(0); let transp = 0, nb = 0;
    for (let i = 0; i < px.length; i += 4) { if (px[i + 3] < 40) transp++; else hist[Math.round(val(i) * 255)]++; }
    if (transp / n > 0.04) return false;   // já tem transparência: nada a fazer
    const borda = (x, y) => { hb[Math.round(val((y * w + x) * 4) * 255)]++; nb++; };
    for (let x = 0; x < w; x++) { borda(x, 0); borda(x, h - 1); }
    for (let y = 1; y < h - 1; y++) { borda(0, y); borda(w - 1, y); }
    const pct = (hh, tot, q) => { let acc = 0; for (let k = 0; k < 256; k++) { acc += hh[k]; if (acc >= tot * q) return k / 255; } return 1; };
    const fundo = pct(hb, nb, 0.5), fundoAlto = pct(hb, nb, 0.95), brilho = pct(hist, n - transp, 0.99);
    if (fundo > 0.4 || brilho - fundo < 0.3) return false;   // fundo claro ou logo escura: não serve
    const t0 = Math.min(Math.max(fundoAlto + 0.03, 0.22 * brilho), 0.45 * brilho), t1 = t0 + Math.max(0.12, 0.25 * brilho);
    for (let i = 0; i < px.length; i += 4) {
      const a = Math.min(1, Math.max(0, (val(i) - t0) / (t1 - t0)));
      if (a <= 0) { px[i] = px[i + 1] = px[i + 2] = 0; px[i + 3] = 0; continue; }
      if (a < 1) { const f = Math.min(4, 1 / a); px[i] = Math.min(255, px[i] * f); px[i + 1] = Math.min(255, px[i + 1] * f); px[i + 2] = Math.min(255, px[i + 2] * f); }   // mantém a cor que se veria sobre o preto
      px[i + 3] = Math.round(px[i + 3] * a);
    }
    return true;
  }
  const orig = aparaLogo;
  aparaLogo = function (px, w, h, tirarFundo) {
    if (tirarFundo) { try { fundoEscuroParaTransparente(px, w, h); } catch (e) {} }   // antes de recortar as margens
    return orig(px, w, h, tirarFundo);
  };
})();
