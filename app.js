const STIDX = { 'Novo': 0, 'Aguardando conferência': 1, 'Confirmado': 2, 'Em preparo': 3, 'Saiu para entrega': 4, 'Entregue': 5, 'Cancelado': 6 };
let prods = [], cart = [], cat = 'Todos', forma = 'Pix', user = null, perfil = {}, PIX = null, FRETE = 0, FRETE_GRATIS = 0, BAIRROS = [], BAIRRO_OUTROS = 'padrao', RETIRADA = {}, REINICIAR = 'nunca', entrega = 'Entrega', UBER = { ativo: true, aviso: '' }, ENTREGA_ON = true, endTocado = false, enviando = false;
const $ = id => document.getElementById(id);
let INSTA = '';
function renderInsta() { const a = $('insta'); if (!a) return; a.style.display = INSTA ? '' : 'none'; a.href = INSTA ? 'https://instagram.com/' + encodeURIComponent(INSTA) : '#'; a.title = INSTA ? '@' + INSTA : ''; }
const abrir = id => { fechar(); $(id).classList.add('on'); if (id === 'pCarrinho') renderCarrinho(); };
const fechar = () => document.querySelectorAll('.ov').forEach(o => o.classList.remove('on'));
const aviso = m => { const t = $('toast'); t.textContent = m; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 3200); };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let GRUPOS_LOJA = [], HORARIOS = null, PAUSADO = false, PEDIDO_MIN = 0, T_ENT = '', T_RET = '';
const precoAtual = p => (p.promo > 0 && p.promo < p.preco) ? p.promo : p.preco;
const emPromo = p => precoAtual(p) < p.preco;
db.collection('produtos').where('ativo', '==', true).onSnapshot(s => { prods = s.docs.map(d => ({ id: d.id, ...d.data() })); renderLoja(); });
// Nome, frase de efeito e logo do banner: valem os do painel (config/loja); sem eles, os que vieram do gerador
let NOME = 'Emporio Medonça'; const NOME_GER = NOME, _bt = document.querySelector('.brand .logo-t'), _hp = document.querySelector('.hero p'), _he = document.querySelector('.hero');
const MARCA_GER = _bt ? _bt.textContent : '', SLOGAN_GER = _hp ? _hp.textContent : '', SF_GER = !!(_he && _he.classList.contains('sf'));
function aplicarMarca(c) {
  NOME = c.nome || NOME_GER; const mc = c.marca || (c.nome ? c.nome.slice(0, 28) : MARCA_GER);
  document.title = NOME; document.querySelectorAll('.brand .logo-t').forEach(e => e.textContent = mc);
  document.querySelectorAll('.brand img, .hero img, .ravatar').forEach(i => i.alt = NOME);
  if (_hp) _hp.textContent = c.slogan !== undefined ? c.slogan : SLOGAN_GER;
  document.querySelectorAll('.rcard h1').forEach(e => e.textContent = NOME); const rc = $('rchips'), sl = c.slogan !== undefined ? c.slogan : SLOGAN_GER; if (rc) rc.innerHTML = sl ? '<span>' + esc(sl) + '</span>' : '';
  if (_he) _he.classList.toggle('sf', c.logoSemFundo !== undefined ? !!c.logoSemFundo : SF_GER);
}
const logos = [...document.querySelectorAll('.brand img, .hero img, .ravatar')]; logos.forEach(i => i.dataset.o = i.getAttribute('src'));
// Sem "piscar" a logo antiga: usa a última logo salva neste aparelho; na primeira visita, esconde até a logo do restaurante chegar
const LOGO_KEY = 'logo_loja'; let logoCache = ''; try { logoCache = localStorage.getItem(LOGO_KEY) || ''; } catch (e) {}
logos.forEach(i => { if (logoCache) i.src = logoCache; else i.style.visibility = 'hidden'; });
setTimeout(() => logos.forEach(i => i.style.visibility = ''), 3000);   // se a internet falhar, mostra a logo padrão
db.collection('config').doc('loja').onSnapshot(s => {
  const c = s.data() || {}; aplicarMarca(c); if (c.whatsapp) LOJA.whatsapp = c.whatsapp; PIX = c.pix || null; GRUPOS_LOJA = Array.isArray(c.complementos) ? c.complementos : [];
  renderLoja();
  RETIRADA = c.retirada || {}; BAIRROS = Array.isArray(c.bairros) ? c.bairros : []; BAIRRO_OUTROS = c.bairroOutros || 'padrao'; FRETE = +c.frete || 0; FRETE_GRATIS = +c.freteGratis || 0; REINICIAR = c.reiniciar || 'nunca';
  UBER = { ativo: !(c.uberFlash && c.uberFlash.ativo === false), aviso: (c.uberFlash && c.uberFlash.aviso) || '' }; ENTREGA_ON = c.entregaAtiva !== false; corrigirEntrega();
  const PD = LOJA.padroes || {}, pega = k => c[k] !== undefined ? c[k] : PD[k]; PAUSADO = c.pausado === true; PEDIDO_MIN = +pega('pedidoMin') || 0; T_ENT = pega('tempoEntrega') || ''; T_RET = pega('tempoRetirada') || ''; { const hs = pega('horarios'); HORARIOS = (pega('horarioAuto') === true && Array.isArray(hs) && hs.length === 7) ? hs : null; } renderStatus();
  GAL_TIT = c.galeriaTitulo || ''; renderGaleria(); INSTA = c.instagram || ''; renderInsta();
  try { c.logo ? localStorage.setItem(LOGO_KEY, c.logo) : localStorage.removeItem(LOGO_KEY); } catch (e) {}
  logos.forEach(i => { const novo = c.logo || i.dataset.o; if (i.getAttribute('src') !== novo) i.src = novo; i.style.visibility = ''; });
  if ($('pCarrinho').classList.contains('on')) renderCarrinho();
}, () => {});
const esgotado = p => p.indisponivel === true;   // restaurante: o item está disponível ou não (sem contagem de estoque)
const selTam = el => { el.parentNode.querySelectorAll('b').forEach(x => x.classList.remove('on')); el.classList.add('on'); };

// ── Aberto / fechado: horário de funcionamento automático + pausa manual pelo painel ──
function agoraLoja() {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Fortaleza', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const g = t => f.find(x => x.type === t).value; let h = +g('hour'); if (h === 24) h = 0;
  return { dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')), min: h * 60 + (+g('minute')) };
}
const DIAS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function estadoAberto() {
  if (PAUSADO) return { ok: false, curto: 'Pedidos pausados', msg: 'Estamos com a cozinha cheia e pausamos os pedidos por um momento. Tente de novo em alguns minutos.' };
  if (!HORARIOS) return { ok: true, curto: 'Aberto agora' };
  const { dia, min } = agoraLoja(), tm = s => { const [h, m] = String(s || '').split(':'); return (+h || 0) * 60 + (+m || 0); };
  const hj = HORARIOS[dia] || {}, ont = HORARIOS[(dia + 6) % 7] || {};
  const aHj = tm(hj.de), fHj = tm(hj.ate), aOn = tm(ont.de), fOn = tm(ont.ate);
  const abertoHoje = hj.a && (fHj > aHj ? (min >= aHj && min < fHj) : min >= aHj);   // fecha depois da meia-noite: vale até o fim do dia
  const viradaOntem = ont.a && fOn <= aOn && min < fOn;
  if (abertoHoje || viradaOntem) return { ok: true, curto: 'Aberto agora' + ((viradaOntem ? fOn : fHj > aHj ? fHj : 0) ? ' · até ' + (viradaOntem ? ont.ate : hj.ate) : '') };
  for (let k = 0; k < 7; k++) {
    const d = (dia + k) % 7, h = HORARIOS[d] || {}; if (!h.a) continue; if (k === 0 && min >= tm(h.de)) continue;
    const quando = k === 0 ? 'hoje' : k === 1 ? 'amanhã' : DIAS_PT[d];
    return { ok: false, curto: 'Fechado · abrimos ' + quando + ' às ' + h.de, msg: 'Estamos fechados agora. Abrimos ' + quando + ' às ' + h.de + '. Você pode ver o cardápio, mas só consegue finalizar o pedido com a casa aberta.' };
  }
  return { ok: false, curto: 'Fechado no momento', msg: 'Estamos fechados no momento.' };
}
function renderStatus() {
  const e = estadoAberto(), s = $('status'); if (s) {
    const extra = [T_ENT ? 'Entrega ' + T_ENT : '', T_RET ? 'Retirada ' + T_RET : '', PEDIDO_MIN > 0 ? 'Pedido mínimo ' + R$(PEDIDO_MIN) : ''].filter(Boolean);
    s.className = 'status ' + (e.ok ? 'ok' : 'x'); s.innerHTML = '<b><i></i>' + esc(e.curto) + '</b>' + (extra.length ? '<span>' + extra.map(esc).join(' · ') + '</span>' : '');
  }
  const f = $('btnFin'); if (f) { f.disabled = !e.ok; f.textContent = e.ok ? 'Finalizar pedido' : e.curto; }
}
setInterval(renderStatus, 60000);

// ── Cardápio: busca, categorias, tamanhos, cores, promoções e ordenação ──
let CATS = [], fBusca = '', fOrd = 'pad', fPromo = false, fPMin = null, fPMax = null;
const setCat = i => { cat = CATS[i]; renderLoja(); };
const busca = v => { fBusca = v; renderLoja(); };
const ordenar = v => { fOrd = v; renderLoja(); };
const soPromoMuda = on => { fPromo = on; renderLoja(); };
const numPreco = v => { v = String(v || '').replace(/[^\d,.]/g, '').replace(',', '.'); return v === '' || isNaN(+v) ? null : +v; };
function aplicarPreco() {   // filtro De / Até (usa o preço atual: com promoção, vale o preço promocional)
  fPMin = numPreco($('pMin').value); fPMax = numPreco($('pMax').value);
  if (fPMin !== null && fPMax !== null && fPMin > fPMax) { [fPMin, fPMax] = [fPMax, fPMin]; $('pMin').value = fPMin; $('pMax').value = fPMax; }
  renderLoja();
}
function limparFiltros() { cat = 'Todos'; fBusca = ''; fOrd = 'pad'; fPromo = false; fPMin = fPMax = null; $('q').value = ''; $('ord').value = 'pad'; $('fPromo').checked = false; $('pMin').value = ''; $('pMax').value = ''; renderLoja(); }
const toggleMenuCats = e => { e.stopPropagation(); $('menuCats').classList.toggle('on'); };
document.addEventListener('click', () => $('menuCats').classList.remove('on'));
const irTopo = () => window.scrollTo({ top: 0, behavior: 'smooth' });
const irProdutos = () => $('produtos').scrollIntoView({ behavior: 'smooth' });
const irContato = () => { const u = 'https://wa.me/' + LOJA.whatsapp; if (!window.open(u, '_blank')) location.href = u; };
function renderLoja() {
  CATS = ['Todos', ...new Set(prods.map(p => p.categoria).filter(Boolean))];
  const nCat = c => c === 'Todos' ? prods.length : prods.filter(p => p.categoria === c).length;
  const bCat = (c, i, ir) => `<button class="${c === cat ? 'on' : ''}" onclick="setCat(${i})${ir ? ';irProdutos()' : ''}">${esc(c)} <small>(${nCat(c)})</small></button>`;
  $('cats').innerHTML = CATS.map((c, i) => bCat(c, i, false)).join('');
  $('menuCats').innerHTML = CATS.map((c, i) => bCat(c, i, true)).join('');
  const cb = $('catbar'); if (cb) cb.innerHTML = CATS.map((c, i) => `<button class="${c === cat ? 'on' : ''}" onclick="setCat(${i})">${esc(c)}</button>`).join('');
  const pcs = prods.map(precoAtual).filter(v => v > 0);   // mostra o menor e o maior preço do cardápio como dica nos campos
  if (pcs.length) { $('pMin').placeholder = String(Math.floor(Math.min(...pcs))); $('pMax').placeholder = String(Math.ceil(Math.max(...pcs))); }
  const bs = norm(fBusca);
  const L = prods.filter(p => (cat === 'Todos' || p.categoria === cat) && (!bs || norm(p.nome).includes(bs)) && (!fPromo || emPromo(p)) && (fPMin === null || precoAtual(p) >= fPMin) && (fPMax === null || precoAtual(p) <= fPMax));
  if (fOrd === 'menor') L.sort((x, y) => precoAtual(x) - precoAtual(y));
  else if (fOrd === 'maior') L.sort((x, y) => precoAtual(y) - precoAtual(x));
  else if (fOrd === 'az') L.sort((x, y) => String(x.nome).localeCompare(String(y.nome), 'pt-BR'));
  $('grid').innerHTML = L.map(p => {
    const off = esgotado(p), ads = p.adicionais || [], rm = p.remover || [];
    const tag = off ? '<span class="tag">Indisponível</span>' : (emPromo(p) ? '<span class="tag">Promoção</span>' : '');
    const pers = off ? '' : `<details class="pers"><summary>Personalizar</summary><div id="o${p.id}" onchange="precoLinha('${p.id}')">${ads.length ? '<h5>Adicionais</h5>' + ads.map((x, i) => `<label class="opt"><input type="checkbox" data-k="a" data-i="${i}"><span>${esc(x.nome)}</span>${+x.preco > 0 ? `<em>+ ${R$(x.preco)}</em>` : ''}</label>`).join('') : ''}${rm.length ? '<h5>Retirar</h5>' + rm.map((x, i) => `<label class="opt"><input type="checkbox" data-k="r" data-i="${i}"><span>Sem ${esc(x)}</span></label>`).join('') : ''}<h5>Observação</h5><input class="ob" id="ob${p.id}" maxlength="120" placeholder="Ex.: carne ao ponto, sem pimenta" autocomplete="off"></div></details>`;
    return `<div class="card${off ? ' off' : ''}"><div class="im" style="background-image:url('${esc(p.img)}')">${tag}</div><div class="in"><h3>${esc(p.nome)}</h3>${p.desc ? `<p class="desc">${esc(p.desc)}</p>` : ''}<div class="pr">${emPromo(p) ? `<s style="color:var(--mut);font-size:.8em;font-weight:400;margin-right:6px">${R$(p.preco)}</s>${R$(precoAtual(p))}` : R$(p.preco)}</div>
    ${pers}
    <div class="buy"><div class="qt"><button class="btn o" ${off ? 'disabled' : ''} onclick="maisMenos('${p.id}',-1)" aria-label="Diminuir">−</button><b id="q${p.id}">${QTD[p.id] || 1}</b><button class="btn o" ${off ? 'disabled' : ''} onclick="maisMenos('${p.id}',1)" aria-label="Aumentar">+</button></div>
    <button class="btn" id="ab${p.id}" ${off ? 'disabled' : ''} onclick="add('${p.id}')">${off ? 'Indisponível' : 'Adicionar · ' + R$(precoAtual(p) * (QTD[p.id] || 1))}</button></div></div></div>`;
  }).join('') || '<p style="color:var(--mut)">Nenhum item encontrado.</p>';
}
// Adicionais, itens a retirar e observação escolhidos no card (viram o detalhe da linha no pedido)
function extraDe(p, id) {
  const box = $('o' + id); let extra = 0; const ads = [], rm = [];
  if (box) box.querySelectorAll('input[type=checkbox]:checked').forEach(x => {
    const i = +x.dataset.i;
    if (x.dataset.k === 'a') { const o = (p.adicionais || [])[i]; if (o) { ads.push(o.nome); extra += +o.preco || 0; } }
    else { const o = (p.remover || [])[i]; if (o) rm.push(o); }
  });
  const ob = $('ob' + id), obs = ob ? ob.value.trim().slice(0, 120) : '';
  return { extra: r2(extra), ads, rm, obs, det: [...ads.map(n => '+ ' + n), ...rm.map(n => 'sem ' + n), obs ? 'Obs.: ' + obs : ''].filter(Boolean).join(' · ') };
}
function precoLinha(id) {
  const p = prods.find(x => x.id === id), b = $('ab' + id); if (!p || !b || b.disabled) return;
  b.textContent = 'Adicionar · ' + R$((precoAtual(p) + extraDe(p, id).extra) * (QTD[id] || 1));
}
let QTD = {};   // quantidade escolhida em cada item (antes de adicionar à sacola)
function maisMenos(id, d) {
  const n = Math.min(20, Math.max(1, (QTD[id] || 1) + d)); QTD[id] = n;
  const el = $('q' + id); if (el) el.textContent = n; precoLinha(id);
}
function add(id) {
  const p = prods.find(x => x.id === id), n = QTD[id] || 1; if (!p) return;
  if (esgotado(p)) return aviso('Este item está indisponível no momento');
  const e = extraDe(p, id), it = cart.find(c => c.id === id && (c.det || '') === e.det);
  if (it) it.q = Math.min(50, it.q + n); else cart.push({ id, nome: p.nome, preco: r2(precoAtual(p) + e.extra), extra: e.extra, ads: e.ads, tam: 'Único', det: e.det, q: n });
  QTD[id] = 1; const q = $('q' + id); if (q) q.textContent = 1;
  const box = $('o' + id); if (box) { box.querySelectorAll('input[type=checkbox]').forEach(x => x.checked = false); const ob = $('ob' + id); if (ob) ob.value = ''; const d = box.closest('details'); if (d) d.open = false; }
  precoLinha(id); atualizaSacola(); aviso(n > 1 ? n + ' itens adicionados à sacola' : 'Item adicionado à sacola');
  if (!clienteLogado()) setTimeout(() => { if (!clienteLogado()) { abrir('pConta'); aviso('Entre com seu telefone para continuar o pedido'); } }, 700);   // o item fica na sacola; pede o login logo depois
}
// Cliente "logado" = entrou pelo telefone (não vale visitante anônimo) e tem cadastro completo
const clienteLogado = () => !!(user && !user.isAnonymous && perfil && perfil.nome && perfil.tel);
const atualizaSacola = () => { const n = cart.reduce((a, c) => a + c.q, 0); $('qtd').textContent = n; const b = $('cbarN'), t = $('cbarT'), bar = $('cbar'); if (b) b.textContent = n + (n === 1 ? ' item' : ' itens'); if (t) t.textContent = R$(subtotal()); if (bar) bar.classList.toggle('on', n > 0); };
// + e − direto na sacola
function mudaQ(i, d) {
  const c = cart[i]; if (!c) return;
  c.q += d; if (c.q <= 0) cart.splice(i, 1);
  atualizaSacola(); renderCarrinho();
}

// ── Totais: subtotal + frete (o servidor confere tudo de novo ao criar o pedido) ──
const subtotal = () => cart.reduce((a, c) => a + c.preco * c.q, 0);
const norm = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const acharBairro = n => BAIRROS.find(b => norm(b.nome) === norm(n));
const bairroSel = () => { if (!$('eBai')) return ''; if (!BAIRROS.length) return $('eBaiO').value.trim(); const v = $('eBai').value; return v === '__outro' ? $('eBaiO').value.trim() : v; };
function taxaEntrega() {   // null = não entregamos nesse bairro
  if (!BAIRROS.length) return FRETE;   // sem tabela por bairro: taxa única
  const b = bairroSel(), m = acharBairro(b); if (m) return +m.taxa || 0;
  if (!b) return 0;   // ainda não escolheu o bairro
  return BAIRRO_OUTROS === 'bloquear' ? null : FRETE;
}
const freteVal = () => (entrega === 'Entrega' && cart.length) ? ((FRETE_GRATIS > 0 && subtotal() >= FRETE_GRATIS) ? 0 : (taxaEntrega() ?? 0)) : 0;
const total = () => Math.round((subtotal() + freteVal()) * 100) / 100;

// ── Entrega ou retirada + endereço (montado por aqui, acima da forma de pagamento) ──
function montarEntrega() {
  const fp = $('fp'); if (!fp || $('entBox')) return;
  const d = document.createElement('div'); d.id = 'entBox'; d.setAttribute('oninput', 'endTocado=true');
  d.innerHTML = `<label>Como você quer receber?</label>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px"><button class="btn" id="eBtE" style="flex:1 1 auto;padding-left:12px;padding-right:12px" onclick="setEntrega('Entrega')">Entrega</button><button class="btn o" id="eBtU" style="flex:1 1 auto;padding-left:12px;padding-right:12px" onclick="setEntrega('Uber Flash')">Uber Flash</button><button class="btn o" id="eBtR" style="flex:1 1 auto;padding-left:12px;padding-right:12px" onclick="setEntrega('Retirada')">Retirada</button></div>
  <div id="eUber" class="pinfo" style="display:none;margin-bottom:12px"></div>
  <div id="eEnd">
    <label>CEP</label><input id="eCep" inputmode="numeric" maxlength="9" placeholder="00000-000" autocomplete="postal-code" oninput="buscarCep()">
    <label>Rua</label><input id="eRua" autocomplete="address-line1">
    <div style="display:grid;grid-template-columns:96px 1fr;gap:0 10px"><div><label>Número</label><input id="eNum" inputmode="numeric"></div><div><label>Bairro</label><select id="eBai" style="width:100%;margin-bottom:12px;padding:10px" onchange="trocarBairro()"></select><input id="eBaiO" placeholder="Digite o bairro" style="display:none;margin-top:-4px"></div></div>
    <label>Cidade</label><input id="eCid" autocomplete="address-level2">
    <label>Complemento (opcional)</label><input id="eCom" placeholder="Apto, bloco...">
    <label>Ponto de referência (opcional)</label><input id="eRef">
  </div>
  <div id="eRetBox" style="display:none;margin-bottom:12px"></div>`;
  const lab = fp.previousElementSibling; fp.parentNode.insertBefore(d, lab && lab.tagName === 'LABEL' ? lab : fp);
}
// Uber Flash: o CLIENTE chama o motoboy pelo app do Uber e ele retira o pedido no restaurante. Não pede endereço e não tem frete no restaurante.
const UBER_AVISO = 'Você chama o Uber Flash pelo app e o motoboy retira o pedido no restaurante. A corrida é paga por você direto ao Uber. O Pix cobre só os produtos.';
function corrigirEntrega() {   // se a opção escolhida foi desligada no painel, passa para a próxima disponível
  if (entrega === 'Uber Flash' && !UBER.ativo) entrega = 'Entrega';
  if (entrega === 'Entrega' && !ENTREGA_ON) entrega = 'Retirada';
}
function pintarEntrega() {   // deixa a tela de acordo com a opção escolhida (Entrega, Uber Flash ou Retirada)
  if (!$('eBtE')) return;
  corrigirEntrega();
  const t = entrega, uf = t === 'Uber Flash';
  $('eBtE').className = 'btn' + (t === 'Entrega' ? '' : ' o'); $('eBtR').className = 'btn' + (t === 'Retirada' ? '' : ' o'); $('eBtU').className = 'btn' + (uf ? '' : ' o');
  $('eBtU').style.display = UBER.ativo ? '' : 'none'; $('eBtE').style.display = ENTREGA_ON ? '' : 'none';
  $('eEnd').style.display = t === 'Entrega' ? 'block' : 'none';   // endereço só para entrega do restaurante
  $('eUber').style.display = uf ? 'block' : 'none';
  if (uf) $('eUber').innerHTML = '🛵 ' + esc(UBER.aviso || UBER_AVISO) + (UBER.aviso ? '<br><small style="color:var(--mut)">' + esc(UBER_AVISO) + '</small>' : '');
  document.querySelectorAll('#fp div').forEach(d => d.style.display = (uf && d.dataset.f !== 'Pix') ? 'none' : '');   // Uber Flash: só Pix (o motoboy não leva maquininha)
}
function setEntrega(t) {
  entrega = t; corrigirEntrega(); t = entrega;
  if (t === 'Uber Flash') { forma = 'Pix'; document.querySelectorAll('#fp div').forEach(x => x.classList.toggle('on', x.dataset.f === 'Pix')); }
  pintarEntrega(); renderCarrinho();
}
let cepT = null;
function buscarCep() {
  const i = $('eCep'), v = i.value.replace(/\D/g, '').slice(0, 8);
  i.value = v.length > 5 ? v.slice(0, 5) + '-' + v.slice(5) : v;
  clearTimeout(cepT); if (v.length !== 8) return;
  cepT = setTimeout(async () => {
    try {
      const r = await (await fetch('https://viacep.com.br/ws/' + v + '/json/')).json(); if (r.erro) return;
      if (r.logradouro) $('eRua').value = r.logradouro; if (r.localidade) $('eCid').value = r.localidade;
      if (r.bairro) { setBairro(r.bairro); if (BAIRROS.length && !bairroSel()) aviso('Não entregamos no bairro ' + r.bairro + '. Escolha outro bairro ou retire no restaurante.'); renderCarrinho(); }
      $('eNum').focus();
    } catch (e) {}   // sem internet no ViaCEP: a pessoa preenche na mão
  }, 250);
}
const CAMPOS_END = [['eCep', 'cep'], ['eRua', 'rua'], ['eNum', 'numero'], ['eCid', 'cidade'], ['eCom', 'complemento'], ['eRef', 'ref']];
function preencherEnd() { if (!$('entBox') || endTocado || !perfil.end) return; CAMPOS_END.forEach(([i, k]) => $(i).value = perfil.end[k] || ''); setBairro(perfil.end.bairro); }
function limparEnd() { endTocado = false; if ($('entBox')) { CAMPOS_END.forEach(([i]) => $(i).value = ''); setBairro(''); } }
// Bairro: com tabela de taxas no painel vira uma lista (com o valor de cada um); sem tabela, é um campo de texto
let sigB = '';
function mostrarBairro() { const lista = BAIRROS.length > 0; $('eBai').style.display = lista ? 'block' : 'none'; $('eBaiO').style.display = (!lista || $('eBai').value === '__outro') ? 'block' : 'none'; $('eBaiO').style.marginTop = lista ? '-4px' : '0'; }
function setBairro(n) {
  if (!$('eBai')) return;
  if (!BAIRROS.length) { $('eBaiO').value = n || ''; return mostrarBairro(); }
  const m = acharBairro(n);
  if (m) { $('eBai').value = m.nome; $('eBaiO').value = ''; }
  else if (n && BAIRRO_OUTROS === 'padrao') { $('eBai').value = '__outro'; $('eBaiO').value = n; }
  else { $('eBai').value = ''; $('eBaiO').value = ''; }
  mostrarBairro();
}
function montarBairros() {
  if (!$('eBai')) return;
  const sig = JSON.stringify([BAIRROS, BAIRRO_OUTROS]); if (sig === sigB) return; sigB = sig;
  const atual = bairroSel();
  $('eBai').innerHTML = '<option value="">Escolha o bairro</option>' + BAIRROS.map(b => `<option value="${esc(b.nome)}">${esc(b.nome)} · ${(+b.taxa) ? R$(+b.taxa) : 'grátis'}</option>`).join('') + (BAIRRO_OUTROS === 'padrao' ? '<option value="__outro">Outro bairro</option>' : '');
  setBairro(atual);
}
function trocarBairro() { mostrarBairro(); renderCarrinho(); }
function lerEntrega() {
  if (entrega === 'Retirada' || entrega === 'Uber Flash') return { tipo: entrega };   // sem endereço
  const g = id => $(id).value.trim(), end = {};
  CAMPOS_END.forEach(([i, k]) => end[k] = g(i)); end.bairro = bairroSel();
  if (!end.rua || !end.numero || !end.bairro || !end.cidade) { aviso('Preencha rua, número, bairro e cidade'); return null; }
  if (taxaEntrega() === null) { aviso('Não entregamos neste bairro. Escolha outro bairro ou retire no restaurante.'); return null; }
  return { tipo: 'Entrega', endereco: end };
}
const txtEnd = e => e.rua + ', ' + e.numero + (e.complemento ? ' (' + e.complemento + ')' : '') + ' - ' + e.bairro + ', ' + e.cidade + (e.cep ? ' · CEP ' + e.cep : '') + (e.ref ? '\nRef.: ' + e.ref : '');

// Local de retirada (cadastrado no painel)
const txtRetirada = () => (RETIRADA.endereco ? RETIRADA.endereco : '') + (RETIRADA.horario ? '\nHorário: ' + RETIRADA.horario : '');
const mapsUrl = e => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e);   // abre o endereço direto no Google Maps (no celular, abre o app)
const mapaLink = e => '<a href="' + mapsUrl(e) + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">' + esc(e) + '</a>';
function renderRetirada() {
  const b = $('eRetBox'); if (!b) return;
  b.style.display = (entrega === 'Retirada' || entrega === 'Uber Flash') ? 'block' : 'none';
  b.innerHTML = RETIRADA.endereco
    ? '<label>' + (entrega === 'Uber Flash' ? 'Endereço onde o motoboy retira' : 'Local de retirada') + '</label><a class="mapa" href="' + mapsUrl(RETIRADA.endereco) + '" target="_blank" rel="noopener">📍 ' + esc(RETIRADA.endereco) + (RETIRADA.horario ? '<br><small style="color:var(--mut)">Horário: ' + esc(RETIRADA.horario) + '</small>' : '') + '<small class="mapa-d">Toque para abrir no Google Maps ↗</small></a>'
    : '<p style="color:var(--mut);font-size:13px">O local e o horário da retirada serão combinados pelo WhatsApp.</p>';
}

// ── Pagamento: quando o cliente paga (na entrega, na retirada ou antecipado) ──
const quandoPaga = () => forma === 'Pix' ? 'Antecipado' : (entrega === 'Retirada' ? 'Na retirada' : 'Na entrega');
const pagTxt = (pag, q) => pag + (q === 'Na entrega' ? ' · pagamento na entrega' : q === 'Na retirada' ? ' · pagamento na retirada' : q === 'Antecipado' ? ' · pago antecipado' : '');
function rotulosPagamento() {
  const q = entrega === 'Retirada' ? 'na retirada' : 'na entrega';
  document.querySelectorAll('#fp div').forEach(d => { d.innerHTML = d.dataset.f + '<small>' + (d.dataset.f === 'Pix' ? 'pague agora' : q) + '</small>'; });
}
function infoPagamento() {
  if (forma === 'Pix') return '';
  const onde = entrega === 'Retirada' ? 'ao retirar o pedido no restaurante' : 'quando receber o pedido';
  return '<div class="pinfo">' + (forma === 'Cartão' ? '💳 Você paga com cartão (maquininha) ' : '💵 Você paga em dinheiro ') + '<b>' + onde + '</b>.</div>';
}
// ── Cliente: o nome vem do cadastro (ou da conta Google), sem digitar de novo ──
function montarCliente() {
  montarEntrega();
  let b = $('cliBox'); if (b) return b;
  const fp = $('fp'), lab = fp.previousElementSibling; b = document.createElement('div'); b.id = 'cliBox';
  fp.parentNode.insertBefore(b, lab && lab.tagName === 'LABEL' ? lab : fp); return b;
}
function renderCliente() {
  const b = montarCliente(), nomeGoogle = user && user.displayName ? user.displayName.trim() : '';
  if (perfil && perfil.nome) {
    const nome = (perfil.nome + ' ' + (perfil.sobrenome || '')).trim();
    b.innerHTML = '<label>Pedido em nome de</label><div class="cli"><span><b>' + esc(nome) + '</b>' + (perfil.tel ? '<br><small>WhatsApp ' + esc(fmtTel(perfil.tel)) + '</small>' : '') + '</span><a onclick="editarDados();abrir(\'pConta\')">Alterar</a></div>';
  } else {
    b.innerHTML = '<label>Pedido em nome de</label><div class="cli"><span>' + (nomeGoogle ? '<b>' + esc(nomeGoogle) + '</b><br>' : '') + '<small>Falta confirmar seu nome e WhatsApp para finalizar.</small></span><a onclick="abrir(\'pConta\')">Preencher</a></div>';
  }
}
// Resumo antes do total: mostra exatamente o que está sendo cobrado (produtos + entrega)
function renderResumo() {
  let el = $('resumo');
  if (!el) {
    el = document.createElement('div'); el.id = 'resumo'; el.style.cssText = 'margin:12px 0;font-size:14px';
    const t = $('tot'), par = t.parentElement, alvo = (par.contains($('itens')) || par.contains($('fp'))) ? t : par;   // fica logo acima da linha do Total
    alvo.insertAdjacentElement('beforebegin', el);
  }
  if (!cart.length) { el.innerHTML = ''; return; }
  const lin = (a, b) => `<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:4px"><span>${a}</span><span>${b}</span></div>`;
  const n = cart.reduce((a, c) => a + c.q, 0), sub = subtotal(), f = freteVal(), t = taxaEntrega(), b = bairroSel();
  let h = lin('Produtos (' + n + (n === 1 ? ' item)' : ' itens)'), R$(sub)), obs = '';
  if (entrega === 'Uber Flash') { h += lin('Uber Flash', '<span style="color:var(--mut)">sem frete no restaurante</span>'); obs = 'Você chama o Uber Flash e paga a corrida direto ao Uber.' + (RETIRADA.endereco ? ' Retirada em: ' + esc(RETIRADA.endereco) + (RETIRADA.horario ? ' (' + esc(RETIRADA.horario) + ')' : '') + '.' : ''); }
  else if (entrega === 'Retirada') { h += lin('Retirada no restaurante', 'Sem custo'); if (RETIRADA.endereco) obs = 'Retire em: ' + esc(RETIRADA.endereco) + (RETIRADA.horario ? ' (' + esc(RETIRADA.horario) + ')' : '') + '.'; }
  else if (BAIRROS.length && !b) h += lin('Entrega', '<span style="color:var(--mut)">escolha o bairro</span>');
  else if (t === null) { h += lin('Entrega', '<span style="color:#e5484d">indisponível</span>'); obs = '<span style="color:#e5484d">Não entregamos neste bairro. Escolha outro bairro ou retire no restaurante.</span>'; }
  else {
    h += lin('Entrega' + (b ? ' · ' + esc(b) : ''), f ? R$(f) : 'Grátis');
    if (!f) obs = (FRETE_GRATIS > 0 && sub >= FRETE_GRATIS) ? 'Frete grátis: seu pedido passou de ' + R$(FRETE_GRATIS) + '.' : 'Entrega grátis para este bairro.';
    else if (FRETE_GRATIS > 0) obs = 'Faltam ' + R$(FRETE_GRATIS - sub) + ' em produtos para ganhar frete grátis.';
  }
  const eta = entrega === 'Retirada' ? T_RET : T_ENT; if (eta) h += lin('Tempo estimado', esc(eta));
  if (PEDIDO_MIN > 0 && sub < PEDIDO_MIN) obs = (obs ? obs + '<br>' : '') + '<span style="color:#e5484d">Faltam ' + R$(PEDIDO_MIN - sub) + ' em itens para o pedido mínimo de ' + R$(PEDIDO_MIN) + '.</span>';
  const fim = 'Total = itens' + (entrega === 'Entrega' ? ' + entrega' : entrega === 'Uber Flash' ? ' (a corrida do Uber Flash você paga ao Uber)' : '') + '.' + (forma === 'Pix' ? ' O código Pix abaixo já vem com este valor.' : '');
  el.innerHTML = h + '<div style="color:var(--mut);font-size:12px;margin-top:6px">' + (obs ? obs + '<br>' : '') + fim + '</div>';
}
function renderCarrinho() {
  montarEntrega(); pintarEntrega(); renderCliente(); rotulosPagamento(); montarBairros(); preencherEnd();
  $('itens').innerHTML = cart.map((c, i) => `<div class="li"><span><b style="font-weight:500">${esc(c.nome)}</b>${c.det ? `<br><small style="color:var(--mut)">${esc(c.det)}</small>` : ''}<br><span style="display:inline-flex;align-items:center;gap:12px;margin-top:6px"><a href="#" onclick="mudaQ(${i},-1);return false" style="font-size:18px;padding:0 6px" aria-label="Diminuir">−</a><b>${c.q}</b><a href="#" onclick="mudaQ(${i},1);return false" style="font-size:18px;padding:0 6px" aria-label="Aumentar">+</a></span></span><span>${R$(c.preco * c.q)} <a href="#" onclick="cart.splice(${i},1);atualizaSacola();renderCarrinho();return false" style="color:var(--mut)">✕</a></span></div>`).join('') || '<p style="color:var(--mut)">Sua sacola está vazia. Escolha algo no cardápio.</p>';
  renderRetirada(); renderResumo(); renderStatus();
  $('tot').textContent = R$(total()); pixBox();
}
document.querySelectorAll('#fp div').forEach(d => d.onclick = () => { forma = d.dataset.f; document.querySelectorAll('#fp div').forEach(x => x.classList.toggle('on', x === d)); pixBox(); renderResumo(); });
async function copiarPix() {
  const el = $('pixc');
  try { await navigator.clipboard.writeText(el.value); }
  catch (e) { el.focus(); el.select(); el.setSelectionRange(0, 99999); try { document.execCommand('copy'); } catch (_) {} }
  aviso('Código Pix copiado');
}
function pixBox() {
  const b = $('pixBox'); b.innerHTML = '';
  if (forma !== 'Pix') { b.innerHTML = infoPagamento(); return; }
  if (!total()) return;
  const txid = 'EMPORI' + Date.now();
  const code = (PIX && PIX.chave) ? gerarPix(PIX.chave, PIX.nome, PIX.cidade, total(), txid) : pixPayload(total(), txid);
  b.innerHTML = '<div id="qr"></div><textarea readonly rows="3" id="pixc">' + code + '</textarea><button class="btn o" onclick="copiarPix()">Copiar código Pix</button><p style="color:var(--mut);font-size:12px;margin:8px 0 14px">Pague e depois toque em Finalizar pedido.</p>';
  new QRCode($('qr'), { text: code, width: 180, height: 180 });
}

// ── Conta do cliente ──
let perfilUid = null, offPed = null;
const err = e => aviso(e.message.replace('Firebase: ', ''));
async function atualizarConta() {
  if (user && perfilUid !== user.uid) { const d = (await db.collection('clientes').doc(user.uid).get()).data(); if (perfilUid !== user.uid) { perfil = d || {}; perfilUid = user.uid; endTocado = false; } }
  if (!user) { perfil = {}; perfilUid = null; limparEnd(); }
  const ok = !!perfil.nome;
  $('bConta').textContent = ok ? perfil.nome : 'Entrar'; renderCliente();
  $('fLogin').style.display = ok ? 'none' : 'block'; $('fPedidos').style.display = ok ? 'block' : 'none';
  renderSeguranca();
  if (offPed) { offPed(); offPed = null; }
  if (!ok) { if (lgModo !== 'novo') modoLogin('tel'); if (user && user.displayName && !$('cNome').value) { const n = user.displayName.trim().split(/\s+/); $('cNome').value = n[0]; $('cSob').value = n.slice(1).join(' '); } return; }
  $('cNome').value = perfil.nome; $('cSob').value = perfil.sobrenome || ''; $('cTel').value = perfil.tel || '';
  offPed = db.collection('pedidos').where('uid', '==', user.uid).onSnapshot(s => {
    const docs = s.docs.map(d => d.data()).sort((a, b) => (b.criadoEm ? b.criadoEm.seconds : 9e9) - (a.criadoEm ? a.criadoEm.seconds : 9e9));
    $('meus').innerHTML = docs.map(p => `<div class="li" style="display:block">${p.numero ? '<small style="color:var(--mut)">Pedido nº ' + fmtNum(p.numero) + '</small><br>' : ''}<b>${R$(p.total)}</b> · ${esc(pagTxt(p.pagamento, p.pagamentoQuando))}<br><small style="color:var(--mut)">${p.itens.map(i => esc(i.nome) + (i.det ? ' (' + esc(i.det) + ')' : '') + '×' + i.q).join(', ')}${p.entrega ? '<br>' + (p.entrega.tipo === 'Uber Flash' ? 'Uber Flash · você chama o motoboy para retirar no restaurante' + (RETIRADA.endereco ? ' · ' + mapaLink(RETIRADA.endereco) : '') : p.entrega.tipo === 'Retirada' ? 'Retirada no restaurante' + (RETIRADA.endereco ? ' · ' + mapaLink(RETIRADA.endereco) : '') : 'Entrega' + (p.frete ? ' · frete ' + R$(p.frete) : '')) : ''}</small></div>`).join('') || '<p style="color:var(--mut)">Você ainda não fez pedidos.</p>';
  });
}
// Todo visitante ganha uma identidade anônima e é registrado em "visitas" (aparece na aba Clientes do painel)
let visitado = null;
function registrarVisita() {
  if (!user || visitado === user.uid) return; visitado = user.uid;
  const F = firebase.firestore.FieldValue, ref = db.collection('visitas').doc(user.uid);
  const novaSessao = !sessionStorage.getItem('v_' + user.uid); sessionStorage.setItem('v_' + user.uid, 1);
  ref.get().then(s => ref.set({
    ultima: F.serverTimestamp(), aparelho: navigator.userAgent.slice(0, 80),
    ...(perfil.nome ? { nome: (perfil.nome + ' ' + (perfil.sobrenome || '')).trim() } : {}),
    ...(novaSessao ? { n: F.increment(1) } : {}), ...(s.exists ? {} : { primeira: F.serverTimestamp() })
  }, { merge: true })).catch(() => {});
}
auth.onAuthStateChanged(u => { user = u; if (!u) { atualizarConta(); auth.signInAnonymously().catch(() => {}); return; } atualizarConta().then(registrarVisita); });

// Entrar / proteger a conta com Google. Cliente anônimo: vincula o Google à mesma conta (os pedidos continuam). Aparelho novo: entra e recupera o histórico.
function renderSeguranca() {
  const box = (id, pai) => { let b = $(id); if (!b) { b = document.createElement('div'); b.id = id; b.style.cssText = 'margin-top:18px;padding-top:14px;border-top:1px solid var(--line)'; $(pai).appendChild(b); } return b; };
  const L = box('gBoxL', 'fLogin'), P = box('gBoxP', 'fPedidos');
  L.style.display = 'none';   // totem: não tem login com Google, o cliente entra pelo telefone
  P.innerHTML = '<button class="btn o" style="width:100%" onclick="sairTotem()">Sair</button>';
}
async function entrarGoogle() {
  const prov = new firebase.auth.GoogleAuthProvider();
  try {
    if (user && user.isAnonymous) {
      try { await user.linkWithPopup(prov); await atualizarConta(); aviso('Login feito! Seus pedidos agora ficam salvos na sua conta Google.'); }
      catch (e) {
        if (e.code === 'auth/credential-already-in-use' && e.credential) { await auth.signInWithCredential(e.credential); aviso('Bem-vindo de volta!'); }   // este Google já tem conta: entra nela
        else throw e;
      }
    } else { await auth.signInWithPopup(prov); aviso('Bem-vindo!'); }
  } catch (e) { if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) err(e); }
}
async function sairConta() {
  if (user && user.isAnonymous && !confirm('Você não fez login com o Google. Se sair, você perde o acesso ao histórico de pedidos deste aparelho. Sair mesmo assim?')) return;
  await auth.signOut(); cart = []; atualizaSacola(); fechar(); aviso('Você saiu da conta');
}

function editarDados() { modoLogin('edit'); $('fLogin').style.display = 'block'; $('fPedidos').style.display = 'none'; }
// Totem: o telefone é o "login". O mesmo telefone sempre cai na mesma conta (mesmo cadastro, mesmos pedidos), mesmo depois de sair.
// Por baixo é uma conta de e-mail/senha do Firebase gerada a partir do número (não é segurança: quem digita o número entra na conta dele).
const TOTEM_DOM = '@totem.local', senhaTotem = t => 'tt' + t + 'x';
async function entrarPorTelefone(tel, podeCriar) {
  const email = tel + TOTEM_DOM, senha = senhaTotem(tel);
  try { return (await auth.signInWithEmailAndPassword(email, senha)).user; }
  catch (e) {
    if (!['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password'].includes(e.code)) throw e;
    if (!podeCriar) throw new Error('NOVO');   // número que ainda não tem cadastro e o cliente não informou o nome
    return (await auth.createUserWithEmailAndPassword(email, senha)).user;
  }
}
async function salvarDados() {
  const nome = $('cNome').value.trim(), sobrenome = $('cSob').value.trim(), tel = $('cTel').value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (lgModo === 'novo' && !(nome && sobrenome)) return aviso('Informe nome e sobrenome');
  if (lgModo === 'novo') lgNovoCad = true;
  if (!/^\d{10,11}$/.test(tel)) return aviso('Telefone inválido: use DDD + número');
  try {
    if (!user || user.email !== tel + TOTEM_DOM) user = await entrarPorTelefone(tel, !!(nome && sobrenome));
    const ex = (await db.collection('clientes').doc(user.uid).get()).data() || {}, n = nome || ex.nome, sn = sobrenome || ex.sobrenome;
    if (!n || !sn) return aviso('Informe nome e sobrenome');
    perfil = { ...ex, nome: n, sobrenome: sn, tel }; perfilUid = user.uid; endTocado = false;
    await db.collection('clientes').doc(user.uid).set(perfil);
  } catch (e) { return e.message === 'NOVO' ? aviso('Número novo: informe também nome e sobrenome') : err(e); }
  lgModo = 'tel'; await atualizarConta(); visitado = null; registrarVisita(); aviso(lgNovoCad ? 'Cadastro criado! Bem-vindo(a), ' + perfil.nome + '!' : 'Dados salvos!'); lgNovoCad = false; cart.length ? abrir('pCarrinho') : fechar();
}
const fmtTel = t => t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t.length === 10 ? `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}` : t;
const fmtNum = n => String(n).padStart(2, '0');

// ── Número do pedido em sequência (01, 02, 03...), com reinício opcional definido no painel ──
function chavePeriodo() {   // período atual no horário do restaurante; a semana começa na segunda-feira
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Fortaleza', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(new Date());
  const g = t => f.find(x => x.type === t).value, p = n => String(n).padStart(2, '0');
  const y = +g('year'), m = +g('month'), dia = +g('day'), dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(g('weekday'));
  if (REINICIAR === 'diario') return y + '-' + p(m) + '-' + p(dia);
  if (REINICIAR === 'mensal') return y + '-' + p(m);
  if (REINICIAR === 'semanal') { const seg = new Date(Date.UTC(y, m - 1, dia - dow)); return 'sem-' + seg.getUTCFullYear() + '-' + p(seg.getUTCMonth() + 1) + '-' + p(seg.getUTCDate()); }
  return 'sempre';
}
const r2 = n => Math.round(n * 100) / 100;

// ── Finalizar: o número do pedido e o pedido são gravados juntos, na mesma transação (não "queima" número se falhar).
async function finalizar() {
  if (enviando) return;
  if (!cart.length) return aviso('Sua sacola está vazia');
  const ab = estadoAberto(); if (!ab.ok) return aviso(ab.msg);
  for (const c of cart) { const p = prods.find(x => x.id === c.id); if (!p || esgotado(p)) return aviso('"' + c.nome + '" não está mais disponível. Retire do pedido para continuar.'); const ex = (c.ads || []).reduce((s, n) => s + (+((p.adicionais || []).find(x => x.nome === n) || {}).preco || 0), 0); let eg = 0; if (c.sel) { const r = calcGrupos(p, c.sel); if (r.erro) return aviso(r.erro); eg = r.extra; } c.extra = r2(ex + eg); c.preco = r2(precoAtual(p) + c.extra); }
  if (PEDIDO_MIN > 0 && subtotal() < PEDIDO_MIN) return aviso('Pedido mínimo: ' + R$(PEDIDO_MIN) + ' em itens');
  if (!clienteLogado()) { abrir('pConta'); return aviso('Entre com seu telefone para finalizar o pedido'); }
  const ent = lerEntrega(); if (!ent) return;
  const ped = {
    uid: user.uid, cliente: { nome: (perfil.nome + ' ' + (perfil.sobrenome || '')).trim(), tel: perfil.tel },
    itens: cart.map(c => ({ id: c.id, nome: c.nome, preco: c.preco, tam: c.tam, ...(c.det ? { det: c.det } : {}), ...(c.extra ? { extra: c.extra } : {}), q: c.q })),
    subtotal: r2(subtotal()), frete: freteVal(), total: total(), pagamento: forma, pagamentoQuando: quandoPaga(), entrega: ent,
    status: forma === 'Pix' ? 'Aguardando conferência' : 'Novo', criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  };
  const ref = db.collection('pedidos').doc(), cont = db.collection('config').doc('contador'), per = chavePeriodo();
  enviando = true; aviso('Enviando seu pedido...');
  try { const f = window.tirarFotoPedido && window.tirarFotoPedido(); if (f) ped.foto = f; } catch (e) {}   // foto do cliente no momento do pedido (se a câmera estiver ligada)
  try {
    await db.runTransaction(async t => {
      // leituras primeiro: contador e itens do cardápio; depois grava o número e o pedido juntos
      const d = await t.get(cont), ids = [...new Set(ped.itens.map(l => l.id))];
      const ps = await Promise.all(ids.map(id => t.get(db.collection('produtos').doc(id))));
      const P = {}; ps.forEach(x => P[x.id] = x.exists ? x.data() : null);
      ped.itens.forEach(l => {
        const p = P[l.id]; if (!p || p.ativo === false || p.indisponivel === true) throw new Error('"' + l.nome + '" não está mais disponível.');
        if (Math.abs(precoAtual(p) + (l.extra || 0) - l.preco) > 0.004) throw new Error('O preço de "' + l.nome + '" mudou. Confira a sacola e tente de novo.');
      });
      const c = d.exists ? d.data() : {};
      ped.numero = c.p === per ? (c.n || 0) + 1 : 1;
      t.set(cont, { n: ped.numero, p: per }); t.set(ref, ped);
    });
  } catch (e) {
    console.error(e); enviando = false;
    return aviso(e.code === 'permission-denied' ? 'Não foi possível registrar o pedido. Atualize a página e tente de novo.' : e.message.replace('Firebase: ', ''));
  }
  enviando = false;
  if (ent.tipo === 'Entrega') { perfil.end = ent.endereco; db.collection('clientes').doc(user.uid).set({ end: ent.endereco }, { merge: true }).catch(() => {}); }   // guarda o endereço para a próxima vez
  const entTxt = ent.tipo === 'Uber Flash' ? '*Uber Flash* (o cliente chama o motoboy para retirar no restaurante)' + (RETIRADA.endereco ? '\n' + txtRetirada() : '') : ent.tipo === 'Retirada' ? '*Retirada no restaurante*' + (RETIRADA.endereco ? '\n' + txtRetirada() : '') : '*Entrega*\n' + txtEnd(ent.endereco) + (ped.frete ? '\n*Frete:* ' + R$(ped.frete) : '');
  const msg = `*NOVO PEDIDO · ${NOME}*\nPedido nº ${fmtNum(ped.numero)}\n\n*Cliente*\n${ped.cliente.nome}\nWhatsApp: ${fmtTel(ped.cliente.tel)}\n\n*Itens*\n` + ped.itens.map(c => `${c.q}× ${c.nome} — ${R$(c.preco * c.q)}${c.det ? '\n   ↳ ' + c.det : ''}`).join('\n') + `\n\n${entTxt}\n\n*Pagamento:* ${pagTxt(forma, ped.pagamentoQuando)}\n*Total:* ${R$(ped.total)}`;
  // Totem: o pedido não abre o WhatsApp sozinho; o restaurante recebe pelo painel admin e pelos avisos.
  cart = []; $('qtd').textContent = 0; fechar(); posPedido();
}

// ── Galeria de fotos: carrossel contínuo (esteira que anda sozinha); as fotos vêm da coleção "galeria" (painel admin) ──
let GAL = [], GAL_TIT = '', galSig = '';
db.collection('galeria').orderBy('ordem').onSnapshot(
  s => { GAL = s.docs.map(d => d.data().img).filter(Boolean); renderGaleria(); },
  e => console.error('Galeria:', e.code, e.message)   // se aparecer permission-denied, publique o firestore.rules
);
function renderGaleria() {
  const sec = $('gal'); if (!sec) return;
  if (!GAL.length) { sec.style.display = 'none'; galSig = ''; return; }
  sec.style.display = ''; $('galT').textContent = GAL_TIT || 'GALERIA';
  const sig = GAL.length + ':' + GAL.map(g => g.length + g.slice(-24)).join('|');
  if (sig === galSig) return;   // só remonta quando as fotos mudam (a esteira não reinicia a cada ajuste do restaurante)
  galSig = sig;
  const tr = $('galTr'), n = GAL.length, k = Math.max(1, Math.ceil(1300 / (n * 230)));   // repete o conjunto até cobrir a largura da faixa, sem buracos
  tr.className = 'gal-slider'; tr.removeAttribute('style'); tr.textContent = '';
  const frag = document.createDocumentFragment();
  for (let r = 0; r < 2 * k; r++) for (let i = 0; i < n; i++) {   // 2 voltas: a animação anda 50% e recomeça sem emenda
    const d = document.createElement('div'); d.className = 'gal-slide';
    d.style.backgroundImage = 'url("' + GAL[i] + '")'; frag.appendChild(d);
  }
  tr.appendChild(frag);
  tr.style.animationDuration = (k * n * 7) + 's';   // ~7 s por foto
  tr.classList.add('gal-marquee');
}

// Total da sacola no cabeçalho: acompanha o contador de itens
new MutationObserver(() => { $('sacTot').textContent = R$(subtotal()); }).observe($('qtd'), { childList: true, characterData: true, subtree: true });

// Altura do cabeçalho: a barra de categorias gruda logo abaixo dele
const medeCab = () => { const h = document.querySelector('header'); if (h) document.documentElement.style.setProperty('--hh', h.offsetHeight + 'px'); };
addEventListener('resize', medeCab); addEventListener('load', medeCab); medeCab(); renderStatus(); atualizaSacola();

// ── Totem: depois de cada pedido, pergunta se quer pedir mais ou sair; sair libera o aparelho para o próximo cliente ──
const SAIR_EM = 30; let sairT = null;   // segundos até sair sozinho se ninguém tocar na tela
function posPedido() {
  let m = $('pPos');
  if (!m) {
    m = document.createElement('div'); m.id = 'pPos'; m.className = 'ov'; m.style.cssText = 'justify-content:center;align-items:center';
    m.innerHTML = '<div class="pn" style="height:auto;max-width:420px;text-align:center;border-radius:20px"><h2 class="pt">PEDIDO REGISTRADO!</h2><p style="color:var(--mut);margin:0 0 20px">Deseja pedir mais alguma coisa?</p><button class="btn" style="width:100%;margin-bottom:8px" onclick="continuarTotem()">Pedir mais</button><button class="btn o" id="pPosSair" style="width:100%" onclick="sairTotem()">Sair</button></div>';
    document.body.appendChild(m);
  }
  fechar(); m.classList.add('on');
  let n = SAIR_EM; const b = $('pPosSair'), pinta = () => b.textContent = 'Sair (' + n + 's)';
  pinta(); clearInterval(sairT); sairT = setInterval(() => { if (--n <= 0) sairTotem(); else pinta(); }, 1000);
}
function continuarTotem() { clearInterval(sairT); const m = $('pPos'); if (m) m.classList.remove('on'); }
function sairTotem() {   // sai da conta deste cliente: o próximo começa do zero (uma nova identidade anônima é criada sozinha)
  clearInterval(sairT); lgModo = 'tel'; auth.signOut().catch(() => {});
  cart = []; atualizaSacola(); ['cNome', 'cSob', 'cTel'].forEach(i => { const e = $(i); if (e) e.value = ''; });
  if (typeof limpaExtras === 'function') limpaExtras();
  fechar(); window.scrollTo({ top: 0 });
}
// ── Entrar / cadastrar em etapas: 1) só o telefone; 2) se já tem cadastro entra direto; se não tem, pede nome e sobrenome ──
let lgModo = 'tel', lgNovoCad = false;   // 'tel' (digitar o telefone) · 'novo' (cliente novo: nome) · 'edit' (alterar meus dados)
(function montarLogin() {
  const f = $('fLogin'); if (!f) return;
  f.innerHTML = '<h2 class="pt" id="lgT"></h2><p id="lgP" style="color:var(--mut);margin-bottom:14px;font-size:13px"></p>'
    + '<div id="lgTel"><label>Telefone / WhatsApp</label><input id="cTel" type="tel" inputmode="tel" placeholder="(85) 99999-8888" autocomplete="tel"></div>'
    + '<div id="lgNome"><label>Nome</label><input id="cNome" autocomplete="given-name"><label>Sobrenome</label><input id="cSob" autocomplete="family-name"></div>'
    + '<button class="btn" id="lgBtn" style="width:100%"></button>'
    + '<button class="btn o" id="lgVolta" style="width:100%;margin-top:8px">Voltar</button>';
  $('lgBtn').onclick = () => lgModo === 'tel' ? continuarTel() : salvarDados();
  $('lgVolta').onclick = () => { modoLogin('tel'); $('cTel').focus(); };
  ['cTel', 'cNome', 'cSob'].forEach(i => $(i).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('lgBtn').click(); } }));
  modoLogin('tel');
})();
function modoLogin(m) {
  lgModo = m;
  const T = { tel: ['ENTRAR OU CADASTRAR', 'Digite seu WhatsApp. Se você já tem cadastro, entra na hora. Se for sua primeira vez, pedimos seu nome em seguida.', 'Continuar'],
    novo: ['PRIMEIRO CADASTRO', 'Não encontramos o número <b id="lgNum"></b>. Informe seu nome para criar o cadastro.', 'Criar cadastro'],
    edit: ['SEUS DADOS', 'Confira ou altere seus dados.', 'Salvar'] }[m];
  $('lgT').textContent = T[0]; $('lgP').innerHTML = T[1]; $('lgBtn').textContent = T[2];
  $('lgTel').style.display = m === 'novo' ? 'none' : ''; $('lgNome').style.display = m === 'tel' ? 'none' : '';
  $('lgVolta').style.display = m === 'novo' ? '' : 'none';
  if (m === 'novo') { const n = $('lgNum'), t = $('cTel').value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); if (n) n.textContent = fmtTel(t); }
}
async function continuarTel() {
  const tel = $('cTel').value.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (!/^\d{10,11}$/.test(tel)) return aviso('Telefone inválido: use DDD + número');
  const b = $('lgBtn'); b.disabled = true;
  try {
    const u = await entrarPorTelefone(tel, false);   // se o número já existe, entra; se não, lança "NOVO"
    user = u;
    const ex = (await db.collection('clientes').doc(u.uid).get()).data() || {};
    if (!ex.nome) { modoLogin('novo'); $('cNome').focus(); return; }   // conta existe mas sem cadastro completo: pede o nome
    perfil = { ...ex, tel: ex.tel || tel }; perfilUid = u.uid; endTocado = false;
    lgModo = 'tel'; await atualizarConta(); visitado = null; registrarVisita();
    aviso('Bem-vindo(a) de volta, ' + ex.nome + '!'); cart.length ? abrir('pCarrinho') : fechar();
  } catch (e) {
    if (e.message === 'NOVO') { modoLogin('novo'); $('cNome').focus(); } else err(e);
  } finally { b.disabled = false; }
}
