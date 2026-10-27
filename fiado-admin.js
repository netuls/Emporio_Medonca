/* Aba "Fiado" do painel admin: controle de pedidos pagos no fiado, com filtro por data.
   Carregue DEPOIS do admin.js e do historico-admin.js.
   Como funciona: pedidos cuja forma de pagamento tem "fiado" no nome (ex.: "Fiado") entram aqui.
   O campo "pago" do pedido (o mesmo do Histórico) diz se já foi recebido; "pagoEm" guarda quando. */
(function () {
  var FI = {};                 // pedidos do período carregado (id -> dados)
  var ini = null, fim = null;  // período aplicado (Date)

  var ehFiado = function (p) { return /fiado/i.test(String(p.pagamento || '')); };
  var num = function (id, p) { return p.numero ? String(p.numero).padStart(2, '0') : id.slice(0, 6).toUpperCase(); };
  var ts = function (p) { return p.criadoEm && p.criadoEm.toDate ? p.criadoEm.toDate() : null; };
  var fd = function (d) { return d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'; };
  var fdia = function (d) { return d.toLocaleDateString('pt-BR'); };
  var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var doIso = function (s, fimDoDia) {   // "2026-01-07" -> Date local (início ou fim do dia)
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null;
    return fimDoDia ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999) : new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
  };
  var chave = function (p) { var c = p.cliente || {}, t = String(c.tel || '').replace(/\D/g, ''); return t || (c.nome || 'Sem nome').toLowerCase(); };

  function montar() {
    var tabs = document.querySelector('.tabs'); if (!tabs || $('tbF')) return;
    var b = document.createElement('button'); b.id = 'tbF'; b.textContent = 'Fiado'; b.onclick = function () { aba('F'); };
    tabs.insertBefore(b, $('tbR'));   // ordem: Painel, Catálogo, Histórico, Fiado, Relatórios, Clientes

    var d = document.createElement('div'); d.id = 'tF'; d.style.display = 'none';
    d.innerHTML = '<div class="sec"><h2 class="pt">FIADO</h2>'
      + '<p class="rd">Pedidos pagos no <b>fiado</b> (qualquer forma de pagamento com "fiado" no nome — cadastre em <b>Painel → Formas de pagamento</b>). Escolha o período, veja quem está devendo e marque como pago quando o cliente quitar. Pedidos cancelados não entram.</p>'
      + '<div class="rctl" style="margin:12px 0 6px">'
      + '<label style="margin:0;display:flex;align-items:center;gap:6px">De <input type="date" id="fDe" style="margin:0;width:auto" onchange="fiCarregar()"></label>'
      + '<label style="margin:0;display:flex;align-items:center;gap:6px">Até <input type="date" id="fAte" style="margin:0;width:auto" onchange="fiCarregar()"></label>'
      + '<button class="btn o" onclick="fiAtalho(\'hoje\')">Hoje</button>'
      + '<button class="btn o" onclick="fiAtalho(7)">Últimos 7 dias</button>'
      + '<button class="btn o" onclick="fiAtalho(\'mes\')">Este mês</button>'
      + '<button class="btn o" onclick="fiAtalho(\'mesant\')">Mês passado</button>'
      + '</div>'
      + '<div class="rctl" style="margin:10px 0 16px"><input id="fQ" placeholder="Buscar nº, cliente ou telefone" oninput="fiRender()" style="margin:0;flex:1;min-width:200px">'
      + '<select id="fS" onchange="fiRender()"><option value="aberto">Só em aberto (devendo)</option><option value="pago">Só pagos</option><option value="all">Todos</option></select>'
      + '<button class="btn o" onclick="fiCarregar()">Atualizar</button><button class="btn o" onclick="fiCsv()">Exportar CSV</button></div>'
      + '<div class="rk" id="fK"></div>'
      + '<h3 style="font-size:14px;margin:6px 0 8px">Por cliente</h3>'
      + '<div style="overflow:auto;margin-bottom:22px"><table class="tb"><thead><tr><th>Cliente</th><th>WhatsApp</th><th>Pedidos em aberto</th><th>Deve</th><th>Já pagou</th><th>Ações</th></tr></thead><tbody id="fC"></tbody></table></div>'
      + '<h3 style="font-size:14px;margin:6px 0 8px">Pedidos</h3>'
      + '<div style="overflow:auto"><table class="tb"><thead><tr><th>Pedido</th><th>WhatsApp</th><th>Itens</th><th>Data</th><th>Valor</th><th>Status</th><th>Situação</th><th>Ações</th></tr></thead><tbody id="fB"></tbody></table></div></div>';
    $('tC').insertAdjacentElement('afterend', d);

    // período padrão: este mês
    var h = new Date(); $('fDe').value = iso(new Date(h.getFullYear(), h.getMonth(), 1)); $('fAte').value = iso(h);
  }

  // estende a troca de abas
  var abaOrig = window.aba;
  window.aba = function (t) {
    abaOrig(t);
    var f = $('tF'); if (!f) return;
    f.style.display = t === 'F' ? 'block' : 'none'; $('tbF').classList.toggle('on', t === 'F');
    if (t === 'F') fiCarregar();
  };

  window.fiAtalho = function (k) {
    var h = new Date(), a, b = h;
    if (k === 'hoje') a = h;
    else if (k === 'mes') a = new Date(h.getFullYear(), h.getMonth(), 1);
    else if (k === 'mesant') { a = new Date(h.getFullYear(), h.getMonth() - 1, 1); b = new Date(h.getFullYear(), h.getMonth(), 0); }
    else a = new Date(h.getFullYear(), h.getMonth(), h.getDate() - (k - 1));
    $('fDe').value = iso(a); $('fAte').value = iso(b); fiCarregar();
  };

  window.fiCarregar = async function () {
    ini = doIso($('fDe').value, false); fim = doIso($('fAte').value, true);
    if (!ini || !fim) return;
    if (ini > fim) return alert('A data inicial não pode ser depois da data final.');
    try {
      // consulta só por data (não exige índice novo no Firebase); o filtro "fiado" é feito aqui
      var s = await db.collection('pedidos').where('criadoEm', '>=', ini).where('criadoEm', '<=', fim).orderBy('criadoEm', 'desc').limit(2000).get();
      FI = {}; s.docs.forEach(function (d) { var p = d.data(); if (ehFiado(p) && p.status !== 'Cancelado') FI[d.id] = p; });
    } catch (e) { return alert('Erro ao carregar o fiado: ' + e.message); }
    fiRender();
  };

  function lista() {
    var q = $('fQ').value.toLowerCase().trim(), f = $('fS').value;
    return Object.keys(FI).map(function (id) { return { id: id, p: FI[id] }; }).filter(function (x) {
      if (f === 'aberto' && x.p.pago) return false;
      if (f === 'pago' && !x.p.pago) return false;
      var c = x.p.cliente || {};
      return !q || (num(x.id, x.p) + ' ' + (c.nome || '') + ' ' + (c.tel || '')).toLowerCase().includes(q);
    }).sort(function (a, b) { return (ts(b.p) || 0) - (ts(a.p) || 0); });
  }

  window.fiRender = function () {
    var todos = Object.keys(FI).map(function (id) { return FI[id]; });
    var soma = function (a) { return a.reduce(function (t, p) { return t + (p.total || 0); }, 0); };
    var abertos = todos.filter(function (p) { return !p.pago; }), pagos = todos.filter(function (p) { return p.pago; });
    var kpi = function (t, v, s) { return '<div class="rc"><small>' + t + '</small><b>' + v + '</b><i>' + s + '</i></div>'; };
    var per = ini && fim ? fdia(ini) + ' a ' + fdia(fim) : '';
    $('fK').innerHTML = kpi('Total no período', R$(soma(todos)), todos.length + ' pedido(s) · ' + per)
      + kpi('Em aberto (devendo)', '<span style="color:var(--erro)">' + R$(soma(abertos)) + '</span>', abertos.length + ' pedido(s)')
      + kpi('Já recebido', '<span style="color:var(--ok)">' + R$(soma(pagos)) + '</span>', pagos.length + ' pedido(s)');

    // resumo por cliente (respeita busca; ignora o filtro de situação para mostrar o quadro completo)
    var q = $('fQ').value.toLowerCase().trim(), G = {};
    Object.keys(FI).forEach(function (id) {
      var p = FI[id], c = p.cliente || {};
      if (q && !(num(id, p) + ' ' + (c.nome || '') + ' ' + (c.tel || '')).toLowerCase().includes(q)) return;
      var k = chave(p), g = G[k] = G[k] || { nome: c.nome || 'Sem nome', tel: c.tel || '', ab: [], dev: 0, pago: 0 };
      if (p.pago) g.pago += p.total || 0; else { g.ab.push(id); g.dev += p.total || 0; }
    });
    var ks = Object.keys(G).sort(function (a, b) { return G[b].dev - G[a].dev || G[a].nome.localeCompare(G[b].nome, 'pt-BR'); });
    $('fC').innerHTML = ks.map(function (k, i) {
      var g = G[k], tel = String(g.tel).replace(/\D/g, '');
      return '<tr><td data-l="Cliente"><b>' + esc(g.nome) + '</b></td>'
        + '<td class="wa" data-l="WhatsApp">' + (tel ? '<a href="https://wa.me/55' + tel + '" target="_blank" rel="noopener" style="color:inherit">' + esc(g.tel) + '</a>' : '—') + '</td>'
        + '<td data-l="Em aberto">' + g.ab.length + '</td>'
        + '<td data-l="Deve"><b style="color:' + (g.dev ? 'var(--erro)' : 'var(--ok)') + '">' + R$(g.dev) + '</b></td>'
        + '<td data-l="Já pagou">' + R$(g.pago) + '</td>'
        + '<td class="acoes">' + (g.ab.length ? '<button class="ab g" onclick="fiQuitarCliente(\'' + encodeURIComponent(k) + '\')">✔ Quitar tudo</button>' + (tel ? '<button class="ab" onclick="fiCobrar(\'' + encodeURIComponent(k) + '\')">Cobrar</button>' : '') : '<small style="color:var(--mut)">Em dia</small>') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" style="color:var(--mut)">Nenhum cliente no período.</td></tr>';

    var l = lista();
    $('fB').innerHTML = l.map(function (x) {
      var p = x.p, c = p.cliente || {}, id = x.id, tel = String(c.tel || '').replace(/\D/g, '');
      return '<tr><td data-l="Pedido"><b>Nº ' + esc(num(id, p)) + '</b><br><small style="color:var(--mut)">' + esc(c.nome || '') + (p.origem === 'Manual' ? ' · 🧾 manual' : '') + '</small></td>'
        + '<td class="wa" data-l="WhatsApp">' + (tel ? '<a href="https://wa.me/55' + tel + '" target="_blank" rel="noopener" style="color:inherit">' + esc(c.tel) + '</a>' : '—') + '</td>'
        + '<td data-l="Itens"><small>' + (p.itens || []).map(function (i) { return esc(i.nome) + (i.det ? ' (' + esc(i.det) + ')' : '') + '×' + i.q; }).join('<br>') + '</small></td>'
        + '<td data-l="Data">' + fd(ts(p)) + '</td>'
        + '<td data-l="Valor">' + R$(p.total || 0) + '</td>'
        + '<td data-l="Status"><span class="st s' + (STIDX[p.status] ?? 0) + '">' + esc(p.status) + '</span></td>'
        + '<td data-l="Situação"><span style="font-weight:700;color:' + (p.pago ? 'var(--ok)' : 'var(--erro)') + '">' + (p.pago ? '● Pago' : '● Em aberto') + '</span>'
        + (p.pago && p.pagoEm && p.pagoEm.toDate ? '<br><small style="color:var(--mut)">em ' + fdia(p.pagoEm.toDate()) + '</small>' : '') + '</td>'
        + '<td class="acoes"><button class="ab ' + (p.pago ? 'r' : 'g') + '" onclick="fiPago(\'' + id + '\',' + !p.pago + ')">' + (p.pago ? 'Desfazer pagamento' : '✔ Marcar pago') + '</button></td></tr>';
    }).join('') || '<tr><td colspan="8" style="color:var(--mut)">Nenhum pedido no fiado neste período/filtro.</td></tr>';
  };

  function dadosPago(v) {
    return v ? { pago: true, pagoEm: firebase.firestore.FieldValue.serverTimestamp() }
             : { pago: false, pagoEm: firebase.firestore.FieldValue.delete() };
  }

  window.fiPago = async function (id, v) {
    try {
      await db.collection('pedidos').doc(id).update(dadosPago(v));
      FI[id].pago = v; if (v) FI[id].pagoEm = { toDate: function () { return new Date(); } }; else delete FI[id].pagoEm;
      fiRender(); avisoAdm(v ? 'Marcado como pago ✔' : 'Voltou para em aberto');
    } catch (e) { alert('Erro ao salvar: ' + e.message); }
  };

  window.fiQuitarCliente = async function (kEnc) {
    var k = decodeURIComponent(kEnc);
    var ids = Object.keys(FI).filter(function (id) { return !FI[id].pago && chave(FI[id]) === k; });
    if (!ids.length) return;
    var nome = (FI[ids[0]].cliente || {}).nome || 'o cliente', total = ids.reduce(function (t, id) { return t + (FI[id].total || 0); }, 0);
    if (!confirm('Marcar como PAGOS ' + ids.length + ' pedido(s) de ' + nome + ' neste período?\n\nTotal: ' + R$(total))) return;
    try {
      for (var i = 0; i < ids.length; i += 400) {
        var b = db.batch(); ids.slice(i, i + 400).forEach(function (id) { b.update(db.collection('pedidos').doc(id), dadosPago(true)); }); await b.commit();
      }
      ids.forEach(function (id) { FI[id].pago = true; FI[id].pagoEm = { toDate: function () { return new Date(); } }; });
      fiRender(); avisoAdm('Fiado de ' + nome + ' quitado ✔');
    } catch (e) { alert('Erro ao salvar: ' + e.message); }
  };

  // abre o WhatsApp do cliente com uma mensagem de cobrança (você ainda confere e envia)
  window.fiCobrar = function (kEnc) {
    var k = decodeURIComponent(kEnc);
    var ids = Object.keys(FI).filter(function (id) { return !FI[id].pago && chave(FI[id]) === k; });
    if (!ids.length) return;
    var c = FI[ids[0]].cliente || {}, tel = String(c.tel || '').replace(/\D/g, ''); if (!tel) return;
    var total = ids.reduce(function (t, id) { return t + (FI[id].total || 0); }, 0);
    var loja = (typeof LOJA !== 'undefined' && LOJA.nome) ? LOJA.nome : 'restaurante';
    var txt = 'Olá, ' + (c.nome || '') + '! Passando para lembrar do seu fiado no ' + loja + ': ' + ids.length + ' pedido(s), total de ' + R$(total) + '. Quando puder acertar, é só avisar. Obrigado!';
    window.open('https://wa.me/55' + tel + '?text=' + encodeURIComponent(txt), '_blank');
  };

  window.fiCsv = function () {
    var l = lista(); if (!l.length) return alert('Não há pedidos para exportar.');
    var c = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var rows = [['Nº', 'Data', 'Cliente', 'Telefone', 'Itens', 'Pagamento', 'Status', 'Situação', 'Pago em', 'Total']].concat(l.map(function (x) {
      var p = x.p, cl = p.cliente || {};
      return [num(x.id, p), fd(ts(p)), cl.nome, cl.tel, (p.itens || []).map(function (i) { return i.nome + (i.det ? ' (' + i.det + ')' : '') + ' x' + i.q; }).join(' | '), p.pagamento, p.status, p.pago ? 'Pago' : 'Em aberto', p.pago && p.pagoEm && p.pagoEm.toDate ? fdia(p.pagoEm.toDate()) : '', (p.total || 0).toFixed(2).replace('.', ',')];
    }));
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(function (r) { return r.map(c).join(';'); }).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'fiado-' + $('fDe').value + '_a_' + $('fAte').value + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  };

  montar();
})();
