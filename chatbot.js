/* Pedido por chat — carregado DEPOIS do app.js, extras.js e pagamentos.js.
   O cliente escreve o que quer; a função da Netlify (Gemini) devolve um pedido em JSON;
   AQUI o site confere tudo de novo (cardápio, estoque, complementos, preço) e só então põe na sacola.
   A IA nunca grava pedido: quem finaliza (login, endereço, Pix, estoque, número do pedido) continua sendo o finalizar() do app.js. */
(function () {
  if (typeof prods === 'undefined' || typeof calcGrupos !== 'function' || typeof gruposDe !== 'function') return;

  // Site hospedado no GitHub Pages: a função roda na Netlify, então use o endereço completo dela.
  // Troque SEU-SITE pelo nome do site na Netlify (ex.: https://emporio-chat.netlify.app/.netlify/functions/chat-pedido).
  // Se algum dia o site inteiro for para a Netlify, pode voltar para '/.netlify/functions/chat-pedido'.
  const ENDPOINT = 'https://emporiomedonca.netlify.app/.netlify/functions/chat-pedido';
  const ENTREGAS = ['Entrega', 'Retirada', 'Uber Flash'];
  const num = v => Math.max(1, Math.min(20, Math.floor(+v) || 1));
  const moeda = v => typeof R$ === 'function' ? R$(v) : 'R$ ' + (+v).toFixed(2).replace('.', ',');
  let historico = [], ocupado = false;

  // ── Cardápio enxuto que vai para a IA (sem dados de cliente) ──
  function cardapio() {
    return prods.map(p => {
      const o = { id: p.id, nome: p.nome, categoria: p.categoria || '', preco: precoAtual(p) };
      if (p.desc) o.desc = String(p.desc).slice(0, 90);
      if (esgotado(p)) o.esgotado = true;
      if ((p.remover || []).length) o.remover = p.remover;
      const gr = gruposDe(p);
      if (gr.length) o.grupos = gr.map(g => ({
        id: g.id, nome: g.nome, min: g.min, max: g.max, regra: g.regra,
        opcoes: g.opcoes.map((x, i) => ({ i, nome: x.nome, preco: +x.preco || 0, ...(compRest(g, x) < 1 ? { esgotado: true } : {}) }))
      }));
      return o;
    });
  }
  const formasPagamento = () => [...document.querySelectorAll('#fp div')].map(d => d.dataset.f).filter(Boolean);
  const sacolaTxt = () => cart.map(c => ({ id: c.id, nome: c.nome, q: c.q, ...(c.det ? { det: c.det } : {}) }));

  // ── Aplica a resposta da IA na sacola (tudo conferido de novo aqui) ──
  function aplicar(r) {
    const notas = []; let mudou = false;

    for (const id of r.remover_ids || []) {
      for (let i = cart.length - 1; i >= 0; i--) if (cart[i].id === id) { cart.splice(i, 1); mudou = true; }
    }

    for (const it of r.itens || []) {
      const p = prods.find(x => x.id === String(it.id));
      if (!p) { notas.push('Não encontrei um dos itens no cardápio.'); continue; }
      if (esgotado(p)) { notas.push('"' + p.nome + '" está indisponível agora.'); continue; }
      const q = num(it.quantidade), gr = gruposDe(p), sel = {};

      for (const o of it.opcoes || []) {
        const g = gr.find(x => x.id === String(o.grupo)), i = Math.floor(+o.opcao);
        if (!g || !g.opcoes[i]) continue;
        sel[g.id] = sel[g.id] || {}; sel[g.id][i] = (sel[g.id][i] || 0) + num(o.quantidade);
      }
      const chk = calcGrupos(p, sel);   // confere mínimo, máximo, repetição e calcula o extra
      if (chk.erro) { notas.push(p.nome + ': ' + chk.erro); continue; }

      let faltou = null;   // estoque dos complementos (considera o que já está na sacola)
      for (const g of gr) for (const [i, n] of Object.entries(sel[g.id] || {})) { const o = g.opcoes[+i], rest = compRest(g, o); if (n * q > rest) faltou = rest < 1 ? '"' + o.nome + '" esgotou.' : 'Só restam ' + rest + ' de "' + o.nome + '".'; }
      if (faltou) { notas.push(p.nome + ': ' + faltou); continue; }
      if (q > estRest(p)) { notas.push(estRest(p) > 0 ? 'Só restam ' + estRest(p) + ' de "' + p.nome + '".' : 'Você já tem todo o estoque de "' + p.nome + '" na sacola.'); continue; }

      const rm = (p.remover || []).filter(n => (it.sem || []).some(s => norm(s) === norm(n)));
      const obs = String(it.obs || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 120);
      const det = [chk.det, ...rm.map(n => 'sem ' + n), obs ? 'Obs.: ' + obs : ''].filter(Boolean).join(' · ');
      const ex = cart.find(c => c.id === p.id && (c.det || '') === det);
      if (ex) ex.q = Math.min(50, ex.q + q);
      else cart.push({ id: p.id, nome: p.nome, preco: r2(precoAtual(p) + chk.extra), extra: chk.extra, ads: [], sel, tam: 'Único', det, q });
      mudou = true;
    }

    if (ENTREGAS.includes(r.entrega)) {
      if (r.entrega === 'Entrega' && !ENTREGA_ON) notas.push('Não estamos fazendo entrega agora.');
      else if (r.entrega === 'Uber Flash' && !UBER.ativo) notas.push('O Uber Flash não está disponível agora.');
      else setEntrega(r.entrega);
    }
    if (r.pagamento) {
      const d = [...document.querySelectorAll('#fp div')].find(x => norm(x.dataset.f) === norm(r.pagamento));
      if (!d) notas.push('Não temos a forma de pagamento "' + String(r.pagamento).slice(0, 24) + '".');
      else if (entrega === 'Uber Flash' && d.dataset.f !== 'Pix') notas.push('No Uber Flash só dá para pagar com Pix.');
      else d.click();
    }

    if (mudou) { atualizaSacola(); if ($('pCarrinho').classList.contains('on')) renderCarrinho(); }
    return { notas, mudou };
  }

  // ── Visual (usa as variáveis de cor do próprio site) ──
  const css = document.createElement('style');
  css.textContent = `
#cbFab{position:fixed;right:16px;bottom:88px;z-index:50;display:flex;align-items:center;gap:8px;padding:12px 18px;border:0;border-radius:999px;background:var(--ac);color:var(--on,#fff);font:600 14px/1 inherit;cursor:pointer;box-shadow:0 8px 24px -6px rgba(0,0,0,.5)}
#cbBox{position:fixed;right:16px;bottom:16px;z-index:55;width:min(390px,calc(100vw - 32px));height:min(580px,calc(100dvh - 32px));display:none;flex-direction:column;background:var(--card);color:var(--tx);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.7)}
#cbBox.on{display:flex}
.cb-top{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--line);font-weight:600}
.cb-top button{width:32px;height:32px;border-radius:50%;border:1px solid var(--line);background:none;color:var(--tx);cursor:pointer}
.cb-msgs{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.cb-m{max-width:86%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word}
.cb-m.bot{align-self:flex-start;background:var(--bg);border:1px solid var(--line)}
.cb-m.eu{align-self:flex-end;background:var(--ac);color:var(--on,#fff)}
.cb-m.nota{align-self:flex-start;background:none;border:1px dashed var(--line);color:var(--mut);font-size:13px}
.cb-sac{display:none;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--line);background:var(--bg);font-size:13px}
.cb-sac.on{display:flex}
.cb-in{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--line)}
.cb-in input{flex:1;margin:0;min-width:0}
.cb-in .btn{padding-left:16px;padding-right:16px}
@media(max-width:560px){#cbFab{bottom:84px}#cbBox{right:0;bottom:0;width:100%;height:88dvh;border-radius:16px 16px 0 0}}`;
  document.head.appendChild(css);

  const fab = document.createElement('button'); fab.id = 'cbFab'; fab.type = 'button'; fab.textContent = '💬 Pedir por chat';
  const box = document.createElement('div'); box.id = 'cbBox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Pedir por chat');
  box.innerHTML = '<div class="cb-top"><span>Faça seu pedido por aqui</span><button type="button" aria-label="Fechar">✕</button></div>'
    + '<div class="cb-msgs" id="cbMsgs"></div>'
    + '<div class="cb-sac" id="cbSac"><span id="cbSacT"></span><button class="btn" type="button" id="cbVer">Ver sacola e pagar</button></div>'
    + '<div class="cb-in"><input id="cbTxt" maxlength="400" placeholder="Ex.: 2 X-Burger sem cebola, 1 suco, pago no Pix" autocomplete="off"><button class="btn" type="button" id="cbEnv">Enviar</button></div>';
  document.body.appendChild(fab); document.body.appendChild(box);

  const msgs = $('cbMsgs'), txt = $('cbTxt');
  function bolha(t, tipo) { const d = document.createElement('div'); d.className = 'cb-m ' + tipo; d.textContent = t; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; }
  function painelSacola() {
    const n = cart.reduce((a, c) => a + c.q, 0), s = $('cbSac');
    s.classList.toggle('on', n > 0); $('cbSacT').textContent = n + (n === 1 ? ' item' : ' itens') + ' · ' + moeda(subtotal());
  }
  function abrirChat() {
    box.classList.add('on'); fab.style.display = 'none';
    if (!msgs.children.length) bolha('Oi! Me diga o que você quer pedir e como prefere pagar. Eu monto a sacola e você confere antes de finalizar.', 'bot');
    painelSacola(); txt.focus();
  }
  function fecharChat() { box.classList.remove('on'); fab.style.display = ''; }
  fab.onclick = abrirChat;
  box.querySelector('.cb-top button').onclick = fecharChat;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('on')) fecharChat(); });
  $('cbVer').onclick = () => { fecharChat(); abrir('pCarrinho'); };   // sem login, o app.js leva para entrar/cadastrar e depois abre a sacola

  async function enviar() {
    const t = txt.value.trim(); if (!t || ocupado) return;
    if (!prods.length) return bolha('O cardápio ainda está carregando. Tente de novo em um instante.', 'nota');
    txt.value = ''; ocupado = true; $('cbEnv').disabled = true; bolha(t, 'eu');
    const espera = bolha('Anotando…', 'nota');
    try {
      const u = auth.currentUser;   // visitante anônimo ou cliente logado: os dois têm token do Firebase
      if (!u) { espera.remove(); bolha('Conectando… tente de novo em um segundo.', 'nota'); return; }
      const token = await u.getIdToken();
      const r = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ mensagem: t, historico: historico, loja: NOME, aberto: estadoAberto().ok, cardapio: cardapio(), sacola: sacolaTxt(), pagamentos: formasPagamento() })
      });
      const j = await r.json().catch(() => ({}));
      espera.remove();
      if (!r.ok) { bolha(j.erro || 'Não consegui responder agora. Você pode pedir pelo cardápio normalmente.', 'nota'); return; }
      const { notas } = aplicar(j);
      historico.push({ role: 'user', texto: t }); historico.push({ role: 'bot', texto: j.resposta || '' });
      historico = historico.slice(-10);
      if (j.resposta) bolha(j.resposta, 'bot');
      notas.forEach(n => bolha(n, 'nota'));
      if (!estadoAberto().ok) bolha(estadoAberto().curto + '. Você pode montar a sacola, mas só finaliza com a casa aberta.', 'nota');
      painelSacola();
    } catch (e) {
      espera.remove(); bolha('Sem conexão com o atendente. Você pode pedir pelo cardápio normalmente.', 'nota');
    } finally { ocupado = false; $('cbEnv').disabled = false; txt.focus(); }
  }
  $('cbEnv').onclick = enviar;
  txt.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });
  // Totem: quando o cliente sai (ou o tempo acaba), apaga a conversa para o próximo cliente começar do zero
  const sairOrig = window.sairTotem;
  if (typeof sairOrig === 'function') window.sairTotem = function () {
    historico = []; msgs.textContent = ''; txt.value = ''; fecharChat(); painelSacola();
    return sairOrig.apply(this, arguments);
  };
  new MutationObserver(painelSacola).observe($('qtd'), { childList: true, characterData: true, subtree: true });
})();
