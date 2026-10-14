// ── Aba "Catálogo" do painel admin: grupos de complementos + itens do cardápio ──
// Carregue DEPOIS do admin.js. Os grupos ficam em config/loja (campo "complementos"); cada item guarda os ids em "grupos".
let CG = [], cgEd = null, cgMoved = false, EC = {};   // EC = estoque dos complementos (coleção estoqueComp: um documento por opção, campo n)
const ecHex = s => Array.from(new TextEncoder().encode(String(s || '').trim().toLowerCase())).map(b => b.toString(16).padStart(2, '0')).join('');
const ecKey = (g, o) => g.id + '_k' + ecHex(o.nome);   // mesma chave usada pelo site do cliente
const CGI = 'width:100%;box-sizing:border-box;padding:10px;margin:0 0 8px;border-radius:8px;border:1px solid var(--line);background:#fff;color:var(--tx);font-size:14px';
const CG_REGRAS = { soma: 'Somar tudo', media: 'Média das escolhidas', maior: 'Pela mais cara', menor: 'Pela mais barata' };
const CG_REGRA_AJ = {
  soma: 'Cobra a soma de tudo que o cliente escolher. Ex.: 2 bacon (R$ 3) + 1 cheddar (R$ 4) = R$ 10.',
  media: 'Cobra a média dos preços escolhidos. Ex.: meio a meio com sabores de R$ 40 e R$ 50 = R$ 45.',
  maior: 'Cobra só o preço da opção mais cara entre as escolhidas. Ex.: sabores de R$ 40 e R$ 50 = R$ 50.',
  menor: 'Cobra só o preço da opção mais barata entre as escolhidas. Ex.: sabores de R$ 40 e R$ 50 = R$ 40.'
};
const cgNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
const cgId = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const cgLimite = g => g.min > 0 ? (g.min === g.max ? 'escolhe ' + g.max : 'escolhe de ' + g.min + ' a ' + g.max) : 'escolhe até ' + g.max + ' (opcional)';
const cgProds = () => (typeof PROD !== 'undefined' ? PROD : {});

function cgMontarAba() {
  if ($('tbG') || !$('tbP') || !$('tC')) return;
  const b = document.createElement('button'); b.id = 'tbG'; b.textContent = 'Catálogo'; b.onclick = () => aba('G');
  $('tbP').insertAdjacentElement('afterend', b);
  const t = document.createElement('div'); t.id = 'tG'; t.style.display = 'none';
  t.innerHTML = `<div class="sec" id="cg-sec"><h2 class="pt">COMPLEMENTOS</h2>
    <p class="rd">Crie grupos de opções (adicionais, molhos, sabores...) e ligue a vários itens do cardápio de uma vez. Em cada grupo você define quantas opções o cliente escolhe (mínimo e máximo), se pode repetir a mesma opção (ex.: 2× bacon) e como o preço é calculado.</p>
    <div id="cgL"></div><button class="btn" onclick="cgNovo()">+ Novo grupo</button></div>
    <div class="sec" id="stk-sec"><h2 class="pt">PREÇO E ESTOQUE</h2>
    <p class="rd">Ajuste o preço (pode ser <b>0,00</b> quando o valor vem só dos complementos) e o estoque de cada item. Deixe o estoque <b>vazio</b> para não controlar. A cada pedido o estoque diminui sozinho e, ao chegar em 0, o item aparece como "Esgotado" no site.</p>
    <div id="stkL"></div><button class="btn" onclick="stkSalvar()">Salvar preços e estoque</button></div>`;
  $('tC').insertAdjacentElement('afterend', t);
  const orig = aba;
  aba = function (k) {
    orig(k); const on = k === 'G';
    $('tG').style.display = on ? 'block' : 'none'; $('tbG').classList.toggle('on', on);
    if (on) { cgMoverProdutos(); cgRender(); }
  };
}
// Traz o cadastro de itens e a lista do cardápio (que ficavam na aba Painel) para a aba Catálogo
function cgMoverProdutos() {
  if (cgMoved) return;
  const secs = []; ['pn', 'lista'].forEach(id => { const el = $(id), s = el && el.closest('.sec'); if (s && !secs.includes(s)) secs.push(s); });
  if (!secs.length) return;
  secs.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
  secs.forEach(s => $('tG').appendChild(s)); cgMoved = true;
}
// ── Preço e estoque de cada item (aceita preço 0,00; estoque vazio = sem controle) ──
function stkRender() {
  const L = $('stkL'); if (!L) return;
  if (L.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;   // não refaz a lista enquanto a pessoa digita
  const P = Object.entries(cgProds()).sort((a, b) => (a[1].nome || '').localeCompare(b[1].nome || '', 'pt-BR'));
  const I = 'width:100%;box-sizing:border-box;padding:8px;margin:0;border-radius:8px;border:1px solid var(--line);background:#fff;color:var(--tx);font-size:14px';
  L.innerHTML = P.length ? '<div style="display:grid;grid-template-columns:1fr 100px 110px;gap:6px;font-size:12px;color:var(--mut);margin-bottom:4px"><span>Item</span><span>Preço (R$)</span><span>Estoque</span></div>'
    + P.map(([id, p]) => `<div style="display:grid;grid-template-columns:1fr 100px 110px;gap:6px;align-items:center;margin-bottom:6px"><span>${esc(p.nome)}${p.estoque !== undefined && p.estoque !== null && +p.estoque <= 0 ? ' <small style="color:#e5484d">(esgotado)</small>' : ''}</span><input data-stk="p" data-id="${esc(id)}" type="number" step="0.01" min="0" inputmode="decimal" value="${p.preco ?? 0}" style="${I}"><input data-stk="e" data-id="${esc(id)}" type="number" step="1" min="0" inputmode="numeric" placeholder="sem controle" value="${p.estoque ?? ''}" style="${I}"></div>`).join('')
    : '<p class="rd">Cadastre os itens do cardápio primeiro.</p>';
  // estoque de cada opção dos grupos de complementos (vazio = sem controle)
  if (CG.length) L.innerHTML += '<h3 style="font-size:14px;margin:20px 0 6px">Estoque dos complementos</h3><p class="rd" style="margin-top:0">Deixe vazio para não controlar. Cada pedido diminui o estoque da opção escolhida e, ao chegar em 0, ela aparece como "Esgotado". Se você mudar o nome de uma opção, o estoque dela recomeça (vazio).</p>'
    + CG.map(g => `<div style="margin-bottom:12px"><b style="font-size:13px">${esc(g.nome)}</b>` + g.opcoes.map(o => { const k = ecKey(g, o), v = EC[k]; return `<div style="display:grid;grid-template-columns:1fr 110px;gap:6px;align-items:center;margin:4px 0"><span>${esc(o.nome)}${v !== undefined && v <= 0 ? ' <small style="color:#e5484d">(esgotado)</small>' : ''}</span><input data-stk="c" data-key="${esc(k)}" data-name="${esc(o.nome)}" type="number" step="1" min="0" inputmode="numeric" placeholder="sem controle" value="${v ?? ''}" style="${I}"></div>`; }).join('') + '</div>').join('');
}
async function stkSalvar() {
  const P = cgProds(), F = firebase.firestore.FieldValue, b = db.batch(); let n = 0;
  for (const el of document.querySelectorAll('#stkL input[data-stk="p"]')) {
    const id = el.dataset.id, p = P[id]; if (!p) continue;
    const eEl = document.querySelector('#stkL input[data-stk="e"][data-id="' + id + '"]');
    const preco = Math.round(cgNum(el.value) * 100) / 100; if (preco < 0) return alert('O preço de "' + p.nome + '" não pode ser negativo.');
    const eTxt = eEl.value.trim(); if (eTxt !== '' && (isNaN(+eTxt) || +eTxt < 0)) return alert('Estoque inválido em "' + p.nome + '".');
    const est = eTxt === '' ? null : Math.floor(+eTxt), estAtual = (p.estoque === undefined || p.estoque === null) ? null : Math.floor(+p.estoque);
    const mud = {}; if (preco !== (+p.preco || 0)) mud.preco = preco; if (est !== estAtual) mud.estoque = est === null ? F.delete() : est;
    if (Object.keys(mud).length) { b.update(db.collection('produtos').doc(id), mud); n++; }
  }
  for (const el of document.querySelectorAll('#stkL input[data-stk="c"]')) {   // estoque dos complementos
    const k = el.dataset.key, v = el.value.trim();
    if (v !== '' && (isNaN(+v) || +v < 0)) return alert('Estoque inválido em "' + el.dataset.name + '".');
    const atual = Object.prototype.hasOwnProperty.call(EC, k) ? EC[k] : null, novo = v === '' ? null : Math.floor(+v);
    if (novo === atual) continue;
    const ref = db.collection('estoqueComp').doc(k);
    if (novo === null) b.delete(ref); else b.set(ref, { n: novo });
    n++;
  }
  if (!n) return avisoAdm('Nada para salvar');
  try { await b.commit(); avisoAdm('Preços e estoque salvos (' + n + ' item' + (n > 1 ? 's' : '') + ')'); } catch (e) { alert('Erro ao salvar: ' + e.message); }
}
function cgRender() {
  stkRender();
  const L = $('cgL'); if (!L) return; const P = cgProds();
  L.innerHTML = CG.length ? CG.map(g => {
    const uso = Object.values(P).filter(p => (p.grupos || []).includes(g.id)).length;
    return `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:8px"><div style="flex:1;min-width:200px"><b>${esc(g.nome)}</b><br><small style="color:var(--mut)">Cliente ${cgLimite(g)} · ${CG_REGRAS[g.regra] || CG_REGRAS.soma} · ${g.opcoes.length} opção(ões) · usado em ${uso} item(ns)</small></div><button class="ab" onclick="cgEditar('${g.id}')">Editar</button><button class="ab r" onclick="cgExcluir('${g.id}')">Excluir</button></div>`;
  }).join('') : '<p class="rd">Nenhum grupo criado ainda.</p>';
}

function cgNovo() { cgAbrir(null); }
function cgEditar(id) { const g = CG.find(x => x.id === id); if (g) cgAbrir(g); }
function cgFechar() { const d = $('cgM'); if (d) d.remove(); cgEd = null; }
function cgAbrir(g) {
  cgFechar();
  cgEd = g ? JSON.parse(JSON.stringify(g)) : { id: cgId(), nome: '', min: 0, max: 1, regra: 'soma', opcoes: [{ nome: '', preco: 0, max: 1 }] };
  const P = Object.entries(cgProds()).sort((a, b) => (a[1].nome || '').localeCompare(b[1].nome || '', 'pt-BR'));
  const comAds = P.filter(([, p]) => (p.adicionais || []).length);
  const d = document.createElement('div'); d.id = 'cgM';
  d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;overflow:auto;padding:16px;box-sizing:border-box';
  d.innerHTML = `<div style="max-width:560px;margin:0 auto;background:var(--card);color:var(--tx);border:1px solid var(--line);border-radius:14px;padding:18px">
    <h3 style="margin:0 0 12px">${g ? 'Editar grupo' : 'Novo grupo de complementos'}</h3>
    <label>Nome do grupo</label><input id="cgN" maxlength="40" placeholder="Ex.: Adicionais, Escolha o molho" value="${esc(cgEd.nome)}" style="${CGI}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div><label>Mínimo de escolhas</label><input id="cgMin" type="number" min="0" max="20" inputmode="numeric" value="${cgEd.min}" style="${CGI};margin-bottom:2px"><small style="color:var(--mut)">0 = o cliente pode pular</small></div>
      <div><label>Máximo de escolhas</label><input id="cgMax" type="number" min="1" max="20" inputmode="numeric" value="${cgEd.max}" style="${CGI};margin-bottom:2px"><small style="color:var(--mut)">total de unidades no grupo</small></div></div>
    <label style="display:block;margin-top:10px">Como cobrar</label>
    <select id="cgR" onchange="cgRegraTxt()" style="${CGI};margin-bottom:2px">${Object.entries(CG_REGRAS).map(([k, v]) => `<option value="${k}" ${cgEd.regra === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <small id="cgRt" style="display:block;color:var(--mut);margin-bottom:12px"></small>
    <label>Opções</label><div id="cgOps"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:2px 0 6px"><button class="btn o" type="button" onclick="cgAddOp()">+ Adicionar opção</button>
    ${comAds.length ? `<select id="cgImp" onchange="cgImportar(this.value)" style="${CGI};margin:0;width:auto;flex:1;min-width:180px"><option value="">Importar adicionais antigos de...</option>${comAds.map(([id, p]) => `<option value="${esc(id)}">${esc(p.nome)}</option>`).join('')}</select>` : ''}</div>
    <small style="display:block;color:var(--mut);margin-bottom:12px">"Máx." é quantas vezes o cliente pode escolher a mesma opção (ex.: 2 para poder pedir bacon em dobro).</small>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><label style="margin:0">Usar nestes itens do cardápio</label><span><a href="#" onclick="cgTodos(true);return false" style="font-size:13px">marcar todos</a> · <a href="#" onclick="cgTodos(false);return false" style="font-size:13px">limpar</a></span></div>
    <div id="cgUso" style="max-height:200px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px 10px;margin:6px 0 14px">${P.length ? P.map(([id, p]) => `<label style="display:flex;gap:8px;align-items:center;padding:5px 0;margin:0;font-weight:500;cursor:pointer"><input type="checkbox" value="${esc(id)}" ${(p.grupos || []).includes(cgEd.id) ? 'checked' : ''} style="width:auto;margin:0">${esc(p.nome)}</label>`).join('') : '<small style="color:var(--mut)">Cadastre os itens do cardápio primeiro.</small>'}</div>
    <div style="display:flex;gap:8px"><button class="btn o" style="flex:1" onclick="cgFechar()">Cancelar</button><button id="cgS" class="btn" style="flex:1" onclick="cgSalvar()">Salvar grupo</button></div></div>`;
  document.body.appendChild(d); cgOpsHtml(); cgRegraTxt();
}
function cgRegraTxt() { const el = $('cgRt'); if (el) el.textContent = CG_REGRA_AJ[$('cgR').value] || ''; }
function cgOpsHtml() {
  $('cgOps').innerHTML = '<div style="display:grid;grid-template-columns:1fr 84px 64px 34px;gap:6px;font-size:12px;color:var(--mut);margin-bottom:4px"><span>Nome</span><span>Preço (R$)</span><span>Máx.</span><span></span></div>'
    + cgEd.opcoes.map((o, i) => `<div style="display:grid;grid-template-columns:1fr 84px 64px 34px;gap:6px;margin-bottom:6px"><input value="${esc(o.nome)}" maxlength="40" placeholder="Ex.: Bacon" oninput="cgOp(${i},'nome',this.value)" style="${CGI};margin:0"><input value="${o.preco || ''}" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0,00" oninput="cgOp(${i},'preco',this.value)" style="${CGI};margin:0"><input value="${o.max || 1}" type="number" min="1" max="20" inputmode="numeric" oninput="cgOp(${i},'max',this.value)" style="${CGI};margin:0"><button class="ab r" type="button" onclick="cgDelOp(${i})" aria-label="Remover opção" style="margin:0">✕</button></div>`).join('');
}
function cgOp(i, k, v) { if (cgEd && cgEd.opcoes[i]) cgEd.opcoes[i][k] = v; }
function cgAddOp() { if (cgEd.opcoes.length >= 40) return alert('Limite de 40 opções por grupo.'); cgEd.opcoes.push({ nome: '', preco: 0, max: 1 }); cgOpsHtml(); }
function cgDelOp(i) { cgEd.opcoes.splice(i, 1); if (!cgEd.opcoes.length) cgEd.opcoes.push({ nome: '', preco: 0, max: 1 }); cgOpsHtml(); }
function cgTodos(on) { document.querySelectorAll('#cgUso input').forEach(x => x.checked = on); }
function cgImportar(id) {
  const p = cgProds()[id]; if (!p) return;
  const vazio = cgEd.opcoes.length === 1 && !String(cgEd.opcoes[0].nome || '').trim(); if (vazio) cgEd.opcoes = [];
  (p.adicionais || []).forEach(a => { if (!cgEd.opcoes.some(o => String(o.nome).toLowerCase() === String(a.nome).toLowerCase())) cgEd.opcoes.push({ nome: a.nome, preco: +a.preco || 0, max: 1 }); });
  if (!$('cgN').value.trim()) $('cgN').value = 'Adicionais';
  const s = $('cgImp'); if (s) s.value = ''; cgOpsHtml();
}
async function cgSalvar() {
  const nome = $('cgN').value.trim().slice(0, 40); if (!nome) return alert('Dê um nome ao grupo.');
  const vistos = new Set(), ops = [];
  cgEd.opcoes.forEach(o => { const n = String(o.nome || '').trim().slice(0, 40), k = n.toLowerCase(); if (!n || vistos.has(k)) return; vistos.add(k); ops.push({ nome: n, preco: Math.max(0, Math.round(cgNum(o.preco) * 100) / 100), max: Math.max(1, Math.min(20, parseInt(o.max) || 1)) }); });
  if (!ops.length) return alert('Adicione pelo menos uma opção com nome.');
  const max = Math.max(1, Math.min(20, parseInt($('cgMax').value) || 1)), min = Math.max(0, parseInt($('cgMin').value) || 0);
  if (min > max) return alert('O mínimo não pode ser maior que o máximo.');
  const cap = ops.reduce((a, o) => a + Math.min(o.max, max), 0);
  if (min > cap) return alert('Com essas opções o cliente só consegue escolher ' + cap + ', mas o mínimo é ' + min + '. Adicione opções ou aumente o "Máx." de alguma.');
  const g = { id: cgEd.id, nome, min, max, regra: $('cgR').value, opcoes: ops };
  const lista = CG.slice(), ix = lista.findIndex(x => x.id === g.id); if (ix >= 0) lista[ix] = g; else lista.push(g);
  if (lista.length > 40) return alert('Limite de 40 grupos.');
  const marcados = [...document.querySelectorAll('#cgUso input:checked')].map(x => x.value), P = cgProds(), F = firebase.firestore.FieldValue, btn = $('cgS'); btn.disabled = true;
  try {
    await db.collection('config').doc('loja').set({ complementos: lista }, { merge: true });
    const b = db.batch();
    Object.keys(P).forEach(pid => {
      const tem = (P[pid].grupos || []).includes(g.id), quer = marcados.includes(pid), ref = db.collection('produtos').doc(pid);
      if (quer && !tem) b.update(ref, { grupos: F.arrayUnion(g.id) }); else if (!quer && tem) b.update(ref, { grupos: F.arrayRemove(g.id) });
    });
    await b.commit(); cgFechar(); avisoAdm('Grupo salvo');
  } catch (e) { btn.disabled = false; alert('Erro ao salvar: ' + e.message); }
}
async function cgExcluir(id) {
  const g = CG.find(x => x.id === id); if (!g || !confirm('Excluir o grupo "' + g.nome + '"? Ele sai de todos os itens do cardápio.')) return;
  const P = cgProds(), F = firebase.firestore.FieldValue;
  try {
    await db.collection('config').doc('loja').set({ complementos: CG.filter(x => x.id !== id) }, { merge: true });
    const b = db.batch(); Object.keys(P).forEach(pid => { if ((P[pid].grupos || []).includes(id)) b.update(db.collection('produtos').doc(pid), { grupos: F.arrayRemove(id) }); });
    Object.keys(EC).filter(k => k.startsWith(id + '_')).forEach(k => b.delete(db.collection('estoqueComp').doc(k)));   // some o estoque das opções do grupo
    await b.commit(); avisoAdm('Grupo excluído');
  } catch (e) { alert('Erro ao excluir: ' + e.message); }
}

function cgIniciar() {
  cgMontarAba();
  db.collection('config').doc('loja').onSnapshot(s => { CG = Array.isArray((s.data() || {}).complementos) ? s.data().complementos : []; cgRender(); }, () => {});
  db.collection('produtos').onSnapshot(() => cgRender(), () => {});
  db.collection('estoqueComp').onSnapshot(s => { EC = {}; s.docs.forEach(d => { const n = +d.data().n; if (!isNaN(n)) EC[d.id] = Math.floor(n); }); stkRender(); }, () => {});
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cgMontarAba); else cgMontarAba();
auth.onAuthStateChanged(u => { if (u && u.email === LOJA.adminEmail && !cgIniciar.ok) { cgIniciar.ok = true; cgIniciar(); } });
