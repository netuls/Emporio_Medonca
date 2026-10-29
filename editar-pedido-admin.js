/* Editar pedido no painel admin — carregue DEPOIS do admin.js (e do admin-extras.js).
   Cria o botão "✏ Editar" nos pedidos em andamento e também na aba Histórico (pedidos Entregues; cancelados não). Dá para mudar:
   - forma de pagamento (o "quando paga" e o status Pix/Novo se ajustam sozinhos);
   - quantidade de cada item e remover item;
   - complementos / observação de cada item (texto livre + atalhos com as opções do cardápio) e o valor dos complementos;
   O subtotal e o total são recalculados (o frete continua o mesmo). Se o item tem estoque controlado,
   a diferença de quantidade é descontada/devolvida do estoque na mesma gravação. */
(function () {
  if (typeof db === 'undefined' || typeof PED === 'undefined') return;
  const r2 = n => Math.round((+n || 0) * 100) / 100;
  const num = v => { const s = String(v == null ? '' : v).replace(/[^\d,.-]/g, ''); return r2(parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0); };
  const IN = 'width:100%;box-sizing:border-box;padding:10px;margin:0 0 8px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--tx);font-size:14px';
  const temEst = p => p && p.estoque !== undefined && p.estoque !== null && p.estoque !== '' && !isNaN(+p.estoque);
  let ED = null;   // { id, itens: [{...item, _q, _base, _extra, _det, _orig}] }

  // ---------- botão nas linhas da tabela ----------
  const tb = $('peds');
  function marcar() {
    tb.querySelectorAll('tr:not([data-ed])').forEach(tr => {
      tr.dataset.ed = 1;
      const m = tr.innerHTML.match(/setStatus\('([^']+)'/); if (!m) return;
      const cel = tr.querySelector('td.acoes'); if (!cel) return;
      const b = document.createElement('button'); b.className = 'ab b'; b.textContent = '✏ Editar'; b.onclick = () => editarPedido(m[1]);
      cel.insertBefore(b, cel.firstChild);
      // selo "editado" ao lado do número do pedido
      const p = PED[m[1]]; if (p && p.editado) { const c = tr.children[0]; if (c) c.insertAdjacentHTML('beforeend', '<br><small style="color:var(--mut)">✏ pedido editado</small>'); }
    });
  }
  if (tb) { new MutationObserver(marcar).observe(tb, { childList: true }); marcar(); }

  // Aba Histórico: o botão entra nas linhas de pedidos Entregues (a tabela é refeita a cada filtro)
  function marcarHis(hb) {
    hb.querySelectorAll('tr:not([data-ed])').forEach(tr => {
      tr.dataset.ed = 1;
      const m = tr.innerHTML.match(/hisImprimir\('([^']+)'/); if (!m) return;
      if (/Cancelado/.test((tr.querySelector('[data-l="Status"]') || {}).textContent || '')) return;
      const cel = tr.querySelector('td.acoes'); if (!cel) return;
      const b = document.createElement('button'); b.className = 'ab b'; b.textContent = '✏ Editar'; b.onclick = () => editarPedido(m[1], true);
      cel.insertBefore(b, cel.firstChild);
    });
  }
  const espera = setInterval(() => {
    const hb = $('hb'); if (!hb) return; clearInterval(espera);
    new MutationObserver(() => marcarHis(hb)).observe(hb, { childList: true }); marcarHis(hb);
  }, 500);

  // ---------- formas de pagamento disponíveis ----------
  function listaPagamentos(atual) {
    const cfg = Array.isArray(CFG.pagamentos) ? CFG.pagamentos.filter(Boolean) : [], vistos = new Set(), out = [];
    [...(cfg.length ? cfg : ['Pix', 'Cartão', 'Dinheiro']), ...(typeof VM_PAG !== 'undefined' ? VM_PAG : []), 'Fiado', atual, ...Object.values(PED).map(p => p.pagamento)].forEach(x => {
      x = String(x || '').trim(); const k = x.toLowerCase(); if (!x || k === 'sem cobrança' || vistos.has(k)) return; vistos.add(k); out.push(x);
    });
    return out;
  }

  // ---------- atalhos de complementos do cardápio ----------
  function opcoesDe(id) {
    const p = PROD[id]; if (!p || typeof vmGrupos !== 'function') return [];
    const out = []; vmGrupos(p).forEach(g => g.opcoes.forEach(o => out.push({ nome: o.nome, preco: +o.preco || 0, grupo: g.nome })));
    return out;
  }

  // ---------- janela ----------
  function fechar() { const m = $('edPed'); if (m) m.remove(); ED = null; document.body.style.overflow = ''; }
  window.edFechar = fechar;

  function linhaHtml(it, i) {
    const ops = opcoesDe(it.id);
    const chips = ops.length ? '<div style="margin:0 0 6px;display:flex;flex-wrap:wrap;gap:4px"><small style="color:var(--mut);width:100%">Toque para acrescentar:</small>'
      + ops.map((o, k) => '<button type="button" class="ab" onclick="edChip(' + i + ',' + k + ')">+ ' + esc(o.nome) + (o.preco > 0 ? ' (' + R$(o.preco) + ')' : '') + '</button>').join('') + '</div>' : '';
    return '<div class="bx" style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:10px" data-l="' + i + '">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>' + esc(it.nome) + '</b><button type="button" class="ab r" onclick="edRemover(' + i + ')">Remover item</button></div>'
      + '<div style="display:flex;align-items:center;gap:10px;margin:10px 0"><span style="font-size:13px;color:var(--mut)">Quantidade</span>'
      + '<button type="button" class="ab" onclick="edQ(' + i + ',-1)" style="min-width:36px">−</button><b id="edQ' + i + '">' + it._q + '</b><button type="button" class="ab" onclick="edQ(' + i + ',1)" style="min-width:36px">+</button></div>'
      + '<label style="font-size:12px;color:var(--mut)">Complementos / observação deste item</label>'
      + '<textarea id="edD' + i + '" rows="2" maxlength="300" style="' + IN + '" oninput="edTot()">' + esc(it._det) + '</textarea>' + chips
      + '<label style="font-size:12px;color:var(--mut)">Valor dos complementos por unidade (R$)</label>'
      + '<input id="edE' + i + '" inputmode="decimal" value="' + String(it._extra.toFixed(2)).replace('.', ',') + '" style="' + IN + '" oninput="edTot()">'
      + '<div style="font-size:13px;color:var(--mut)">Unidade: ' + R$(it._base) + ' + complementos = <b id="edU' + i + '"></b> · linha: <b id="edL' + i + '"></b></div></div>';
  }

  function pinta() {
    const p = ED.p, lista = listaPagamentos(p.pagamento);
    const atualOk = lista.some(x => x.toLowerCase() === String(p.pagamento || '').toLowerCase());
    $('edBody').innerHTML =
      '<div style="font-size:13px;color:var(--mut);margin-bottom:12px">Pedido nº ' + nPed(ED.id) + ' · ' + esc((p.cliente || {}).nome || '') + ' · status: ' + esc(p.status) + '</div>'
      + '<h4 style="margin:0 0 6px">Forma de pagamento</h4>'
      + '<select id="edPg" onchange="edPgSel()" style="' + IN + '">' + lista.map(x => '<option value="' + esc(x) + '"' + (x.toLowerCase() === String(p.pagamento || '').toLowerCase() ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '<option value="__outra">Outra (digitar)…</option></select>'
      + '<input id="edPg2" maxlength="40" placeholder="Nome da forma de pagamento" style="' + IN + ';display:none">'
      + '<h4 style="margin:14px 0 6px">Itens</h4><div id="edItens">' + ED.itens.map(linhaHtml).join('') + '</div>'
      + '<div style="font-size:14px;line-height:1.7;margin:10px 0">Subtotal: <b id="edSub"></b><br>Frete: <b>' + R$(p.frete || 0) + '</b> <small style="color:var(--mut)">(não muda)</small><br>Total: <b id="edTot" style="font-size:18px"></b></div>';
    if (!atualOk) { /* forma antiga que não está na lista: já foi incluída por listaPagamentos */ }
    edTot();
  }

  async function editarPedido(id, doHistorico) {
    let p = PED[id];
    if (!p || doHistorico) {   // pedido do Histórico: busca a versão mais recente no banco
      try { const d = await db.collection('pedidos').doc(id).get(); p = d.exists ? d.data() : null; } catch (e) { return alert('Não foi possível abrir o pedido: ' + e.message); }
    }
    if (!p) return alert('Pedido não encontrado.');
    if (p.status === 'Cancelado') return alert('Pedido cancelado não pode ser editado.');
    fechar();
    ED = { id, p, itens: (p.itens || []).map(it => ({ ...it, _q: +it.q || 1, _extra: r2(it.extra || 0), _base: r2((+it.preco || 0) - (+it.extra || 0)), _det: it.det || '', _qOrig: +it.q || 1 })) };
    const m = document.createElement('div'); m.id = 'edPed'; m.className = 'ov on'; m.style.cssText = 'justify-content:center;align-items:center;z-index:9998';
    m.innerHTML = '<div class="pn" style="height:auto;max-width:520px;max-height:92vh;overflow:auto;border:1px solid var(--line)"><h3 class="pt" style="margin-bottom:12px">EDITAR PEDIDO</h3><div id="edBody"></div>'
      + '<div style="display:flex;gap:8px;margin-top:14px"><button class="btn" id="edSalvar" style="flex:1" onclick="edSalvar()">Salvar alterações</button><button class="btn o" style="flex:1" onclick="edFechar()">Cancelar</button></div></div>';
    m.addEventListener('click', e => { if (e.target === m) fechar(); });
    document.body.appendChild(m); document.body.style.overflow = 'hidden';
    pinta();
  }
  window.editarPedido = editarPedido;

  // lê os campos da tela para ED (antes de repintar ou salvar)
  function ler() { ED.itens.forEach((it, i) => { const d = $('edD' + i), e = $('edE' + i); if (d) it._det = d.value.trim().slice(0, 300); if (e) it._extra = Math.max(0, num(e.value)); }); }
  window.edPgSel = () => { $('edPg2').style.display = $('edPg').value === '__outra' ? 'block' : 'none'; };
  window.edQ = (i, d) => { ler(); ED.itens[i]._q = Math.min(50, Math.max(1, ED.itens[i]._q + d)); $('edQ' + i).textContent = ED.itens[i]._q; edTot(); };
  window.edRemover = i => {
    if (ED.itens.length <= 1) return alert('O pedido precisa ter pelo menos um item. Para desfazer o pedido, use "Cancelar".');
    ler(); const pg = $('edPg').value, pg2 = $('edPg2').value; ED.itens.splice(i, 1); pinta(); $('edPg').value = pg; $('edPg2').value = pg2; edPgSel();
  };
  window.edChip = (i, k) => {
    ler(); const it = ED.itens[i], o = opcoesDe(it.id)[k]; if (!o) return;
    it._det = (it._det ? it._det + ' · ' : '') + '+ ' + o.nome; it._extra = r2(it._extra + o.preco);
    $('edD' + i).value = it._det; $('edE' + i).value = it._extra.toFixed(2).replace('.', ','); edTot();
  };
  window.edTot = () => {
    if (!ED) return; ler(); let sub = 0;
    ED.itens.forEach((it, i) => { const un = r2(it._base + it._extra), li = r2(un * it._q); sub += li; $('edU' + i).textContent = R$(un); $('edL' + i).textContent = R$(li); });
    ED.sub = r2(sub); ED.total = r2(sub + (ED.p.frete || 0)); $('edSub').textContent = R$(ED.sub); $('edTot').textContent = R$(ED.total);
  };

  // ---------- salvar ----------
  window.edSalvar = async () => {
    ler(); edTot();
    const antigo = ED.p; if (!antigo) return;
    const pag = ($('edPg').value === '__outra' ? $('edPg2').value : $('edPg').value).trim().slice(0, 40); if (!pag) return alert('Escolha a forma de pagamento.');
    const itens = ED.itens.map(it => {
      const o = { id: it.id, nome: it.nome, preco: r2(it._base + it._extra), tam: it.tam || 'Único', q: it._q };
      if (it._det) o.det = it._det; if (it._extra) o.extra = it._extra; return o;
    });
    const total = ED.total, sub = ED.sub, entrega = antigo.entrega, retira = (entrega && entrega.tipo === 'Retirada') || antigo.origem === 'Manual';
    const dados = {
      itens, subtotal: sub, total, pagamento: total === 0 ? 'Sem cobrança' : pag,
      pagamentoQuando: total === 0 ? 'Sem cobrança' : /^pix$/i.test(pag) ? 'Antecipado' : retira ? 'Na retirada' : 'Na entrega',
      editado: true, editadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (['Novo', 'Aguardando conferência'].includes(antigo.status)) dados.status = total > 0 && /^pix$/i.test(pag) ? 'Aguardando conferência' : 'Novo';
    // diferença de quantidade por produto (para o estoque)
    const dif = {}; (antigo.itens || []).forEach(i => dif[i.id] = (dif[i.id] || 0) - (+i.q || 0)); itens.forEach(i => dif[i.id] = (dif[i.id] || 0) + i.q);
    const ids = Object.keys(dif).filter(k => dif[k] !== 0);
    const b = $('edSalvar'); b.disabled = true; b.textContent = 'Salvando…';
    try {
      await db.runTransaction(async t => {
        const ref = db.collection('pedidos').doc(ED.id), s = await t.get(ref);
        if (!s.exists) throw new Error('Este pedido não existe mais.');
        if (s.data().status === 'Cancelado') throw new Error('O pedido foi cancelado.');
        const docs = await Promise.all(ids.map(id => t.get(db.collection('produtos').doc(id))));
        docs.forEach((d, k) => {
          if (!d.exists) return; const p = d.data(); if (!temEst(p)) return;
          const resta = Math.floor(+p.estoque) - dif[ids[k]];
          if (resta < 0) throw new Error('Estoque insuficiente de "' + (p.nome || 'item') + '": só há ' + Math.max(0, Math.floor(+p.estoque)) + ' unidade(s) disponível(is) além do que já está no pedido.');
          t.update(d.ref, { estoque: resta });
        });
        t.update(ref, dados);
      });
      fechar(); avisoAdm('Pedido atualizado ✔'); if (typeof hisCarregar === 'function' && $('tH') && $('tH').style.display === 'block') hisCarregar();
    } catch (e) { b.disabled = false; b.textContent = 'Salvar alterações'; alert('Não foi possível salvar: ' + e.message); }
  };
})();
