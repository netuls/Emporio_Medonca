/* Histórico de pedidos + botão Finalizar (sem WhatsApp) */

// Finaliza o pedido: vira "Entregue" (entra nos relatórios) e vai para o Histórico, sem perguntar do WhatsApp
async function finalizarPedido(id) {
  if (!conferirPedido(id, 'Entregue')) return;   // mesma conferência de valores que o painel já faz
  try { await mudarStatus(id, 'Entregue'); avisoAdm('Pedido finalizado ✔ Veja em Histórico'); }
  catch (e) { alert('Erro ao finalizar: ' + e.message); }
}

(function () {
  var HIS = {};
  var num = function (id, p) { return p.numero ? String(p.numero).padStart(2, '0') : id.slice(0, 6).toUpperCase(); };
  var ts = function (p) { return p.criadoEm && p.criadoEm.toDate ? p.criadoEm.toDate() : null; };
  var fd = function (d) { return d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'; };

  function montar() {
    var tabs = document.querySelector('.tabs'); if (!tabs || $('tbH')) return;
    var b = document.createElement('button'); b.id = 'tbH'; b.textContent = 'Histórico'; b.onclick = function () { aba('H'); };
    tabs.insertBefore(b, $('tbR'));
    var d = document.createElement('div'); d.id = 'tH'; d.style.display = 'none';
    d.innerHTML = '<div class="sec"><h2 class="pt">HISTÓRICO DE PEDIDOS</h2>'
      + '<p class="rd">Pedidos finalizados (entregues) e cancelados. <b>Atenção:</b> ao excluir um pedido ele também sai dos Relatórios e do total gasto em Clientes. Exporte o CSV antes de apagar, se quiser guardar os dados.</p>'
      + '<div class="rk" id="hk"></div>'
      + '<div class="rctl" style="margin:16px 0"><input id="hq" placeholder="Buscar nº, cliente ou telefone" oninput="hisRender()" style="margin:0">'
      + '<select id="hf" onchange="hisRender()"><option value="all">Todos</option><option value="Entregue">Entregues</option><option value="Cancelado">Cancelados</option></select>'
      + '<select id="hp" onchange="hisRender()"><option value="all">Todas as formas de pagamento</option></select>'
      + '<button class="btn o" onclick="hisCarregar()">Atualizar</button><button class="btn o" onclick="hisCsv()">Exportar CSV</button></div>'
      + '<div class="rctl" style="margin:0 0 16px"><span style="color:var(--mut);font-size:13px">Limpar pedidos com mais de</span>'
      + '<select id="hd" style="min-width:120px"><option value="30">30 dias</option><option value="60">60 dias</option><option value="90" selected>90 dias</option><option value="180">180 dias</option><option value="365">1 ano</option></select>'
      + '<button class="btn o" style="color:#e5484d;border-color:#e5484d" onclick="hisApagarAntigos()">Apagar antigos</button></div>'
      + '<div style="overflow:auto"><table class="tb"><thead><tr><th>Pedido</th><th>WhatsApp</th><th>Itens</th><th>Data</th><th>Pagamento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody id="hb"></tbody></table></div></div>';
    $('tC').insertAdjacentElement('afterend', d);
  }

  // estende a troca de abas para incluir o Histórico
  var abaOrig = window.aba;
  window.aba = function (t) {
    abaOrig(t);   // com 'H' ele só esconde as outras abas
    var h = $('tH'); if (!h) return;
    h.style.display = t === 'H' ? 'block' : 'none'; $('tbH').classList.toggle('on', t === 'H');
    if (t === 'H') hisCarregar();
  };

  window.hisCarregar = async function () {
    try {
      var s = await db.collection('pedidos').where('status', 'in', ['Entregue', 'Cancelado']).limit(1000).get();
      HIS = {}; s.docs.forEach(function (d) { HIS[d.id] = d.data(); });
    } catch (e) { return alert('Erro ao carregar o histórico: ' + e.message); }
    hisRender();
  };

  function filtrados() {
    var q = $('hq').value.toLowerCase().trim(), f = $('hf').value, pg = $('hp').value;
    return Object.keys(HIS).map(function (id) { return { id: id, p: HIS[id] }; }).filter(function (x) {
      if (f !== 'all' && x.p.status !== f) return false;
      if (pg !== 'all' && (x.p.pagamento || 'Outro') !== pg) return false;
      var c = x.p.cliente || {};
      return !q || (num(x.id, x.p) + ' ' + (c.nome || '') + ' ' + (c.tel || '')).toLowerCase().includes(q);
    }).sort(function (a, b) { return (ts(b.p) || 0) - (ts(a.p) || 0); });
  }

  window.hisRender = function () {
    // opções do filtro de pagamento (montadas a partir dos pedidos carregados)
    var sel = $('hp'), atual = sel.value;
    var formas = Object.keys(HIS).map(function (k) { return HIS[k].pagamento || 'Outro'; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    sel.innerHTML = '<option value="all">Todas as formas de pagamento</option>' + formas.map(function (f) { return '<option value="' + esc(f) + '">' + esc(f) + '</option>'; }).join('');
    sel.value = formas.indexOf(atual) >= 0 ? atual : 'all';

    var l = filtrados(), all = l.map(function (x) { return x.p; });
    var ent = all.filter(function (p) { return p.status === 'Entregue'; });
    var rec = ent.reduce(function (a, p) { return a + (p.total || 0); }, 0);
    var kpi = function (t, v, s) { return '<div class="rc"><small>' + t + '</small><b>' + v + '</b><i>' + s + '</i></div>'; };
    $('hk').innerHTML = kpi('No histórico', all.length, 'na lista atual') + kpi('Entregues', ent.length, 'finalizados') + kpi('Cancelados', all.length - ent.length, 'pedidos') + kpi('Receita', R$(rec), 'dos entregues');

    $('hb').innerHTML = l.map(function (x) {
      var p = x.p, c = p.cliente || {}, id = x.id;
      return '<tr><td data-l="Pedido"><b>Nº ' + esc(num(id, p)) + '</b><br><small style="color:var(--mut)">' + esc(c.nome || '') + (p.origem === 'Manual' ? ' · 🧾 manual' : '') + '</small></td>'
        + '<td class="wa" data-l="WhatsApp">' + esc(c.tel || '—') + '</td>'
        + '<td data-l="Itens"><small>' + (p.itens || []).map(function (i) { return esc(i.nome) + (i.det ? ' (' + esc(i.det) + ')' : '') + '×' + i.q; }).join('<br>') + '</small></td>'
        + '<td data-l="Data">' + fd(ts(p)) + '</td><td data-l="Pagamento">' + esc(p.pagamento || '—') + '</td>'
        + '<td data-l="Valor">' + R$(p.total || 0) + (p.frete ? '<br><small style="color:var(--mut)">frete ' + R$(p.frete) + '</small>' : '') + '</td>'
        + '<td data-l="Status"><span class="st s' + (STIDX[p.status] ?? 0) + '">' + esc(p.status) + '</span></td>'
        + '<td class="acoes"><button class="ab g" onclick="hisImprimir(\'' + id + '\')">Imprimir</button><button class="ab r" onclick="hisExcluir(\'' + id + '\')">Excluir</button></td></tr>';
    }).join('') || '<tr><td colspan="8" style="color:var(--mut)">Nenhum pedido no histórico.</td></tr>';
  };

  window.hisImprimir = function (id) { if (!PED[id]) PED[id] = HIS[id]; imprimirPedido(id); };

  window.hisExcluir = async function (id) {
    var p = HIS[id]; if (!p) return;
    if (!confirm('Excluir o pedido nº ' + num(id, p) + ' (' + ((p.cliente || {}).nome || '') + ', ' + R$(p.total || 0) + ')?\n\nEle também sai dos Relatórios. Não tem volta.')) return;
    try { await db.collection('pedidos').doc(id).delete(); delete HIS[id]; hisRender(); avisoAdm('Pedido excluído'); }
    catch (e) { alert('Erro ao excluir: ' + e.message); }
  };

  window.hisApagarAntigos = async function () {
    var dias = +$('hd').value, lim = Date.now() - dias * 864e5;
    var ids = Object.keys(HIS).filter(function (id) { var d = ts(HIS[id]); return d && d.getTime() < lim; });
    if (!ids.length) return alert('Nenhum pedido com mais de ' + dias + ' dias.');
    if (!confirm('Apagar ' + ids.length + ' pedido(s) com mais de ' + dias + ' dias?\n\nEles também saem dos Relatórios. Exporte o CSV antes se quiser guardar. Não tem volta.')) return;
    try {
      for (var i = 0; i < ids.length; i += 400) {
        var b = db.batch(); ids.slice(i, i + 400).forEach(function (id) { b.delete(db.collection('pedidos').doc(id)); }); await b.commit();
      }
      ids.forEach(function (id) { delete HIS[id]; }); hisRender(); avisoAdm(ids.length + ' pedido(s) apagado(s)');
    } catch (e) { alert('Erro ao apagar: ' + e.message); }
  };

  window.hisCsv = function () {
    var l = filtrados(); if (!l.length) return alert('Não há pedidos para exportar.');
    var c = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var rows = [['Nº', 'Data', 'Cliente', 'Telefone', 'Itens', 'Frete', 'Pagamento', 'Status', 'Total']].concat(l.map(function (x) {
      var p = x.p, cl = p.cliente || {};
      return [num(x.id, p), fd(ts(p)), cl.nome, cl.tel, (p.itens || []).map(function (i) { return i.nome + (i.det ? ' (' + i.det + ')' : '') + ' x' + i.q; }).join(' | '), (p.frete || 0).toFixed(2).replace('.', ','), p.pagamento, p.status, (p.total || 0).toFixed(2).replace('.', ',')];
    }));
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(function (r) { return r.map(c).join(';'); }).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'historico-pedidos.csv'; document.body.appendChild(a); a.click(); a.remove();
  };

  montar();
})();
