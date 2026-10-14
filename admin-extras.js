// admin-extras.js — carregue DEPOIS do admin.js
// Mostra a observação, o troco e a opção de talheres nos pedidos (tabela, mensagem de WhatsApp e impressão).
(function () {
  const tem = p => p && (p.obs || p.troco || p.semTalher);

  // 1) Tabela de pedidos
  const tb = $('peds');
  if (tb) new MutationObserver(() => {
    tb.querySelectorAll('tr:not([data-x])').forEach(tr => {
      tr.dataset.x = 1;
      const m = tr.innerHTML.match(/setStatus\('([^']+)'/), p = m && PED[m[1]];
      if (!tem(p)) return;
      const itens = tr.children[2], pag = tr.children[4];
      if (itens) itens.insertAdjacentHTML('beforeend',
        (p.obs ? '<br><small><b>📝 Obs.:</b> ' + esc(p.obs) + '</small>' : '') + (p.semTalher ? '<br><small>🍴 Sem talheres</small>' : ''));
      if (pag && p.troco) pag.insertAdjacentHTML('beforeend', '<br><small>troco p/ ' + R$(p.troco) + '</small>');
    });
  }).observe(tb, { childList: true });

  // 2) Mensagem de WhatsApp (resumo enviado ao confirmar)
  const det = window.detalhesPedido;
  window.detalhesPedido = p => det(p)
    + (p.obs ? '\n*Observação:* ' + p.obs + '\n' : '')
    + (p.troco ? '*Troco para:* ' + R$(p.troco) + '\n' : '')
    + (p.semTalher ? '*Sem talheres e guardanapos*\n' : '');

  // 3) Impressão (cupom da cozinha)
  window.extraPrint = p => !tem(p) ? '' : '<div class="bx" style="margin-top:8px"><h4>Observações</h4>'
    + (p.obs ? '<b>' + esc(p.obs) + '</b><br>' : '')
    + (p.troco ? 'Troco para ' + R$(p.troco) + '<br>' : '')
    + (p.semTalher ? 'Sem talheres e guardanapos' : '') + '</div>';
  const src = window.imprimirPedido.toString(), alvo = '<div class="ft">';
  if (src.includes(alvo)) (0, eval)(src.replace(alvo, () => '${extraPrint(p)}' + alvo));
  else console.warn('admin-extras: trecho da impressão não encontrado');
})();

// ── Adicionais sem ponto e vírgula: campos de nome e preço, com botão para incluir e remover ──
// (por baixo continua gravando no mesmo formato, então o resto do painel não muda)
(function () {
  function editor(id, tid) {
    const ta = $(id); if (!ta) return;
    const lab = ta.previousElementSibling;
    if (lab && lab.tagName === 'LABEL') lab.textContent = 'Adicionais (complementos que o cliente pode pedir)';
    ta.style.display = 'none';
    const tl = document.createElement('label'); tl.textContent = 'Nome da seção no site (opcional · padrão: Adicionais)';
    const ti = document.createElement('input'); ti.id = tid; ti.maxLength = 40; ti.placeholder = 'Ex.: Turbine seu lanche, Escolha o molho';
    ta.insertAdjacentElement('afterend', ti); ta.insertAdjacentElement('afterend', tl);
    const box = document.createElement('div'); box.style.marginBottom = '14px';
    ti.insertAdjacentElement('afterend', box);
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn o'; btn.textContent = '+ Adicionar complemento';
    box.appendChild(btn);
    let last = null;
    const write = () => {
      const l = [...box.querySelectorAll('.adrow')].map(r => ({ nome: r.children[0].value.trim(), preco: parseFloat(String(r.children[1].value).replace(',', '.')) || 0 })).filter(x => x.nome);
      ta.value = last = adsTexto(l);
    };
    const row = a => {
      const r = document.createElement('div'); r.className = 'adrow'; r.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px';
      r.innerHTML = '<input placeholder="Ex.: Bacon extra" maxlength="40" style="flex:1;min-width:0;margin:0"><input type="number" step="0.01" min="0" inputmode="decimal" placeholder="Preço" style="width:100px;margin:0"><button type="button" class="ab r" aria-label="Remover">✕</button>';
      r.children[0].value = a.nome || ''; r.children[1].value = a.preco || '';
      r.oninput = write; r.children[2].onclick = () => { r.remove(); write(); };
      box.insertBefore(r, btn); return r;
    };
    btn.onclick = () => row({}).children[0].focus();
    const build = () => { box.querySelectorAll('.adrow').forEach(r => r.remove()); lerAds(ta.value).forEach(row); last = ta.value; };
    build();
    setInterval(() => { if (ta.value !== last) build(); }, 400);   // acompanha quando o painel preenche ou limpa o campo (editar item, cadastrar)
  }
  // Nome da seção de adicionais: grava junto do item (campo adTitulo)
  function patchFn(nome, trocas) {
    let src = window[nome].toString();
    for (const [de, para] of trocas) { if (!src.includes(de)) return console.warn('admin-extras: trecho não encontrado em ' + nome); src = src.replace(de, () => para); }
    (0, eval)(src);
  }
  window.adExtra = () => { const v = ($('paT') ? $('paT').value : '').trim().slice(0, 40); return v ? { adTitulo: v } : {}; };
  patchFn('salvar', [["tamanhos: ['Único']", "...adExtra(), tamanhos: ['Único']"], ["fotoData = '';", "fotoData = ''; if ($('paT')) $('paT').value = '';"]]);
  patchFn('salvarProd', [["adicionais: lerAds($('epA').value),", "adicionais: lerAds($('epA').value), adTitulo: ($('epAT').value.trim().slice(0, 40) || firebase.firestore.FieldValue.delete()),"]]);
  const eo = window.editarProd; window.editarProd = function (id) { eo(id); $('epAT').value = (PROD[id] || {}).adTitulo || ''; };
  editor('pa', 'paT'); editor('epA', 'epAT');
})();

// ── Aparência do site (nova): cor de destaque, cor de realce e letra dos títulos ──
// Substitui o painel antigo, que era feito para um site escuro e não mexia no visual claro.
(function () {
  const FONTES = [
    { id: 'padrao', nome: 'Padrão · moderna', fam: "'Plus Jakarta Sans',system-ui,sans-serif", g: '' },
    { id: 'playfair', nome: 'Playfair · elegante', fam: "'Playfair Display',serif", g: 'Playfair+Display:wght@600;700;800' },
    { id: 'cormorant', nome: 'Cormorant · luxo', fam: "'Cormorant Garamond',serif", g: 'Cormorant+Garamond:wght@600;700' },
    { id: 'montserrat', nome: 'Montserrat · limpa', fam: "'Montserrat',sans-serif", g: 'Montserrat:wght@600;700;800' },
    { id: 'poppins', nome: 'Poppins · jovem', fam: "'Poppins',sans-serif", g: 'Poppins:wght@600;700' },
    { id: 'bebas', nome: 'Bebas Neue · forte', fam: "'Bebas Neue',sans-serif", g: 'Bebas+Neue' }
  ];
  const PRESETS = [
    { nome: 'Grafite e dourado', ac: '#17171A', gold: '#A87F32' },
    { nome: 'Vinho e dourado', ac: '#7A1426', gold: '#B8893B' },
    { nome: 'Azul-marinho', ac: '#1F3A5F', gold: '#C8963E' },
    { nome: 'Verde-floresta', ac: '#1F5F3F', gold: '#C9A24A' },
    { nome: 'Laranja', ac: '#D9601A', gold: '#17171A' },
    { nome: 'Vermelho', ac: '#D42A2A', gold: '#17171A' }
  ];
  const PADRAO = Object.assign({ ac: '#17171A', gold: '#A87F32', fonte: 'padrao' }, LOJA.visual || {});   // LOJA.visual = cores e letra escolhidas no gerador
  const hexOk = h => /^#[0-9a-f]{6}$/i.test(h || '');
  const lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  let V = { ...PADRAO };
  const carregaFonte = f => { if (!f.g || document.getElementById('vf-' + f.id)) return; const l = document.createElement('link'); l.id = 'vf-' + f.id; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=' + f.g + '&display=swap'; document.head.appendChild(l); };

  function prever() {
    const f = FONTES.find(x => x.id === V.fonte) || FONTES[0], on = lum(V.ac) > 0.6 ? '#111' : '#fff';
    $('vsAc').value = V.ac; $('vsGo').value = V.gold;
    $('vsH').style.fontFamily = f.fam;
    $('vsB').style.cssText += ';background:' + V.ac + ';color:' + on;
    $('vsT').style.background = V.gold; $('vsC').style.borderBottomColor = V.gold; $('vsC').style.color = V.ac;
    $('vsF').innerHTML = FONTES.map(x => '<button type="button" class="btn o" data-f="' + x.id + '" style="text-transform:none;padding:12px 10px;' + (x.id === V.fonte ? 'border-color:' + V.ac + ';box-shadow:0 0 0 1px ' + V.ac : '') + '"><span style="display:block;font-family:' + x.fam + ';font-size:18px;font-weight:700;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(NOME_LOJA) + '</span><small style="color:var(--mut)">' + esc(x.nome) + '</small></button>').join('');
  }

  window.montarAparencia = function () {
    if ($('tema-sec')) return;
    const pix = [...document.querySelectorAll('#tP .sec')].find(x => { const h = x.querySelector('h2'); return h && h.textContent.trim() === 'PIX'; });
    if (!pix) return;
    const v = CFG.visual || {};
    V = { ac: hexOk(v.ac) ? v.ac : PADRAO.ac, gold: hexOk(v.gold) ? v.gold : PADRAO.gold, fonte: FONTES.some(x => x.id === v.fonte) ? v.fonte : PADRAO.fonte };
    FONTES.forEach(carregaFonte);
    const s = document.createElement('div'); s.className = 'sec'; s.id = 'tema-sec';
    s.innerHTML = '<h2 class="pt">APARÊNCIA DO SITE</h2>'
      + '<p class="rd">Escolha as cores e a letra dos títulos do site do cliente. A prévia abaixo muda na hora; o site só muda depois que você tocar em <b>Salvar aparência</b>.</p>'
      + '<label>Estilos prontos</label><div id="vsPre" style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 16px">'
      + PRESETS.map((p, i) => '<button type="button" class="btn o" data-i="' + i + '" style="padding:8px 12px;display:inline-flex;align-items:center;gap:8px"><span style="width:16px;height:16px;border-radius:50%;background:' + p.ac + ';box-shadow:0 0 0 3px ' + p.gold + '"></span>' + esc(p.nome) + '</button>').join('') + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><label>Cor de destaque (botões, sacola, categoria)</label><input type="color" id="vsAc" style="height:46px;padding:4px;cursor:pointer"></div>'
      + '<div><label>Cor de realce (etiqueta Promoção, aba ativa)</label><input type="color" id="vsGo" style="height:46px;padding:4px;cursor:pointer"></div></div>'
      + '<label>Letra dos títulos</label><div id="vsF" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin:6px 0 18px"></div>'
      + '<label>Prévia</label><div style="border:1px solid var(--line);border-radius:14px;padding:16px;margin:6px 0 16px;background:#F4F4F6"><div id="vsH" style="font-size:22px;font-weight:700;margin-bottom:12px">' + esc(NOME_LOJA) + '</div><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span id="vsB" style="padding:11px 18px;border-radius:10px;font-weight:600;font-size:14px">Adicionar · R$ 32,00</span><span id="vsT" style="padding:3px 10px;border-radius:99px;font-size:12px;font-weight:700;color:#fff">Promoção</span><span id="vsC" style="font-weight:600;padding:8px 4px;border-bottom:3px solid #000">Lanches</span></div></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" onclick="salvarVisual()">Salvar aparência</button><button class="btn o" type="button" onclick="padraoVisual()">Voltar ao padrão</button></div>';
    pix.parentNode.insertBefore(s, pix);
    $('vsPre').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; V.ac = PRESETS[+b.dataset.i].ac; V.gold = PRESETS[+b.dataset.i].gold; prever(); };
    $('vsF').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; V.fonte = b.dataset.f; prever(); };
    $('vsAc').oninput = () => { V.ac = $('vsAc').value; prever(); };
    $('vsGo').oninput = () => { V.gold = $('vsGo').value; prever(); };
    prever();
  };
  window.salvarVisual = async () => {
    try { await db.collection('config').doc('loja').set({ visual: { ac: V.ac, gold: V.gold, fonte: V.fonte }, tema: firebase.firestore.FieldValue.delete() }, { merge: true }); avisoAdm('Aparência salva'); }
    catch (e) { alert('Erro ao salvar: ' + e.message); }
  };
  window.padraoVisual = async () => {
    if (!confirm('Voltar às cores e à letra originais do site?')) return;
    try { await db.collection('config').doc('loja').set({ visual: firebase.firestore.FieldValue.delete(), tema: firebase.firestore.FieldValue.delete() }, { merge: true }); V = { ...PADRAO }; prever(); avisoAdm('Aparência original restaurada'); }
    catch (e) { alert('Erro: ' + e.message); }
  };
})();
