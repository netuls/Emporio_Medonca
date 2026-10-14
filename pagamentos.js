/* Formas de pagamento do site — carregado DEPOIS do app.js e do extras.js.
   Lê config/loja.pagamentos (definido no painel admin) e monta os botões de pagamento da sacola. */
(function () {
  if (typeof db === 'undefined' || typeof forma === 'undefined') return;
  const PADRAO = ['Pix', 'Cartão', 'Dinheiro'], CHAVE = 'pagamentos_loja';
  const limpa = l => Array.isArray(l) ? [...new Set(l.map(x => String(x || '').replace(/[<>&"]/g, '').trim().slice(0, 24)).filter(Boolean))].slice(0, 10) : [];
  let PGS = PADRAO.slice();
  try { const c = limpa(JSON.parse(localStorage.getItem(CHAVE) || 'null')); if (c.length) PGS = c; } catch (e) {}   // evita "piscar" a lista antiga

  function montar() {
    const fp = $('fp'); if (!fp) return;
    if (!PGS.includes(forma)) forma = PGS.includes('Pix') ? 'Pix' : PGS[0];
    fp.innerHTML = PGS.map(n => '<div data-f="' + esc(n) + '"' + (n === forma ? ' class="on"' : '') + '>' + esc(n) + '</div>').join('');
    fp.style.gridTemplateColumns = 'repeat(auto-fit,minmax(110px,1fr))';
    fp.querySelectorAll('div').forEach(d => d.onclick = () => {
      forma = d.dataset.f; fp.querySelectorAll('div').forEach(x => x.classList.toggle('on', x === d)); pixBox(); renderResumo();
    });
    rotulosPagamento(); pintarEntrega();
    if ($('pCarrinho').classList.contains('on')) renderCarrinho();
  }

  // Mensagem de pagamento para qualquer forma (não só Cartão e Dinheiro)
  window.infoPagamento = function () {
    if (forma === 'Pix') return '';
    const onde = entrega === 'Retirada' ? 'ao retirar o pedido no restaurante' : 'quando receber o pedido';
    const txt = forma === 'Dinheiro' ? '💵 Você paga em dinheiro ' : forma === 'Cartão' ? '💳 Você paga com cartão (maquininha) ' : '💳 Você paga com ' + esc(forma) + ' ';
    return '<div class="pinfo">' + txt + '<b>' + onde + '</b>.</div>';
  };

  // Uber Flash só aceita Pix: sem Pix na lista, a opção some
  const pintaOrig = window.pintarEntrega;
  window.pintarEntrega = function () {
    if (!PGS.includes('Pix') && entrega === 'Uber Flash') entrega = ENTREGA_ON ? 'Entrega' : 'Retirada';
    const r = pintaOrig.apply(this, arguments);
    const bu = $('eBtU'); if (bu && !PGS.includes('Pix')) bu.style.display = 'none';
    return r;
  };

  db.collection('config').doc('loja').onSnapshot(s => {
    const l = limpa((s.data() || {}).pagamentos); PGS = l.length ? l : PADRAO.slice();
    try { localStorage.setItem(CHAVE, JSON.stringify(PGS)); } catch (e) {}
    montar();
  }, () => {});
  montar();
})();
