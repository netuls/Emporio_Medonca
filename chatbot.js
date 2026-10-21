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
#cbFab{position:fixed;left:16px;bottom:88px;z-index:50;display:flex;align-items:center;gap:8px;padding:12px 18px;border:0;border-radius:999px;background:var(--ac);color:var(--on,#fff);font:600 14px/1 inherit;cursor:pointer;box-shadow:0 8px 24px -6px rgba(0,0,0,.5)}
#cbBox{position:fixed;left:16px;bottom:16px;z-index:55;width:min(390px,calc(100vw - 32px));height:min(580px,calc(100dvh - 32px));display:none;flex-direction:column;background:var(--card);color:var(--tx);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.7)}
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
@media(max-width:560px){#cbFab{bottom:84px}#cbBox{left:0;right:0;bottom:0;width:100%;height:88dvh;border-radius:16px 16px 0 0}}`;
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
    if (!msgs.children.length) bolha((clienteLogado() ? 'Oi, ' + perfil.nome + '! ' : 'Oi! ') + 'Me diga o que você quer pedir e como prefere pagar. Eu monto a sacola e você confere antes de finalizar.', 'bot');
    painelSacola(); txt.focus();
  }
  function fecharChat() { box.classList.remove('on'); fab.style.display = ''; }
  fab.onclick = abrirChat;
  box.querySelector('.cb-top button').onclick = fecharChat;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('on')) fecharChat(); });
  $('cbVer').onclick = () => { if (!clienteLogado()) { if (etapa === 'nome') bolha('Falta só o seu nome e sobrenome.', 'bot'); else perguntarTel(); return; } fecharChat(); abrir('pCarrinho'); };   // sem login, o app.js leva para entrar/cadastrar e depois abre a sacola

  // ── Login pelo WhatsApp dentro do chat (usa o continuarTel/salvarDados do app.js; o número e o nome NUNCA vão para a IA) ──
  let etapa = null, pediuTel = false, pendente = null;   // pendente: parte do pedido que veio na mesma frase do número   // etapa: null · 'tel' (esperando o número) · 'nome' (número novo: esperando nome e sobrenome)
  const PH = txt.placeholder;
  function setEtapa(e) {
    etapa = e; txt.placeholder = e === 'tel' ? '(85) 99999-8888' : e === 'nome' ? 'Nome e sobrenome' : PH;
    txt.inputMode = e === 'tel' ? 'tel' : 'text'; txt.maxLength = e === 'tel' ? 20 : 400;
  }
  const extrairTel = t => { const m = String(t).match(/(?:\+?55[\s-]?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}/); if (!m) return null; const d = m[0].replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''); return /^\d{10,11}$/.test(d) ? d : null; };
  const semTel = t => String(t).replace(/(?:\+?55[\s-]?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}/, ' ')
    .replace(/\b(?:meu|minha)?\s*(?:whats?\s?app|whastapp|whatsap|zap(?:zap)?|wpp|telefone|celular|n[uú]mero|contato)\s*(?:é|eh|:|-)?\s*/gi, ' ')
    .replace(/,\s*(?=,)/g, '').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,.;-]+|[\s,.;-]+$/g, '');
  function perguntarTel() { setEtapa('tel'); bolha('Para finalizar, qual é o seu WhatsApp com DDD? Ex.: (85) 99999-8888', 'bot'); }
  function logou() {
    setEtapa(null);
    if (pendente) { fechar(); bolha('Pronto, ' + perfil.nome + '! Você está identificado(a). Já vou anotar seu pedido.', 'bot'); return; }   // fechar(): tira a sacola que o login abre sozinho
    if (cart.length) { bolha('Pronto, ' + perfil.nome + '! Você está identificado(a). Abrindo sua sacola…', 'bot'); fecharChat(); }
    else bolha('Pronto, ' + perfil.nome + '! Você está identificado(a). O que você vai querer?', 'bot');
  }
  async function fluxoLogin(t, tel) {
    if (etapa === 'nome') {
      if (/^(cancelar|voltar)$/i.test(t)) { setEtapa(null); pendente = null; bolha('Tudo bem. Quando quiser finalizar, toque em "Ver sacola e pagar".', 'bot'); return; }
      const partes = t.replace(/[<>]/g, ' ').trim().split(/\s+/).filter(Boolean);
      if (partes.length < 2) { bolha('Preciso do nome e do sobrenome. Ex.: Maria Silva', 'bot'); return; }
      $('cNome').value = partes[0].slice(0, 30); $('cSob').value = partes.slice(1).join(' ').slice(0, 40);
      await salvarDados();
      if (clienteLogado()) return logou();
      bolha('Não consegui criar o cadastro. Tente de novo.', 'bot'); return;
    }
    if (clienteLogado()) { if (!pendente) bolha('Já estou com o seu cadastro, não precisa informar o número de novo.', 'bot'); return; }
    if (!tel) { bolha('Esse número parece incompleto. Informe o WhatsApp com DDD. Ex.: (85) 99999-8888', 'bot'); return; }
    $('cTel').value = tel; lgModo = 'tel';
    await continuarTel();   // entra se o número já tem cadastro; senão muda para o modo "novo"
    if (clienteLogado()) return logou();
    if (lgModo === 'novo') { setEtapa('nome'); bolha('Não encontrei esse número. Para criar seu cadastro, me diga seu nome e sobrenome.', 'bot'); return; }
    bolha('Não consegui entrar com esse número. Confira e tente de novo.', 'bot');
  }

  async function perguntarIA(t) {   // fala com o atendente (Gemini) e aplica o resultado na sacola
    if (!prods.length) { bolha('O cardápio ainda está carregando. Tente de novo em um instante.', 'nota'); return; }
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
      const { notas, mudou } = aplicar(j);
      historico.push({ role: 'user', texto: t }); historico.push({ role: 'bot', texto: j.resposta || '' });
      historico = historico.slice(-10);
      if (j.resposta) bolha(j.resposta, 'bot');
      notas.forEach(n => bolha(n, 'nota'));
      if (!estadoAberto().ok) bolha(estadoAberto().curto + '. Você pode montar a sacola, mas só finaliza com a casa aberta.', 'nota');
      painelSacola();
      if (mudou && cart.length && !clienteLogado() && !pediuTel && !etapa) { pediuTel = true; perguntarTel(); }
    } catch (e) {
      espera.remove(); bolha('Sem conexão com o atendente. Você pode pedir pelo cardápio normalmente.', 'nota');
    }
  }

  async function enviar() {
    const t = txt.value.trim(); if (!t || ocupado) return;
    const tel = extrairTel(t), soNum = /^[\d\s()+.\-]+$/.test(t);
    txt.value = ''; ocupado = true; $('cbEnv').disabled = true; bolha(t, 'eu');
    try {
      if (etapa === 'nome' || tel || (etapa === 'tel' && soNum && t.replace(/\D/g, '').length >= 6)) {   // telefone e nome ficam aqui, nunca vão para a IA
        if (tel) { const resto = semTel(t); if (/[a-zà-ú]{3,}/i.test(resto)) pendente = resto; }   // "quero empada, meu zap é 85..." : guarda o pedido para anotar logo após o login
        await fluxoLogin(t, tel);
        if (clienteLogado() && pendente) { const p = pendente; pendente = null; await perguntarIA(p); }
      } else await perguntarIA(t);
    } catch (e) { console.error(e); bolha('Não consegui agora. Tente de novo.', 'bot'); }
    finally { ocupado = false; $('cbEnv').disabled = false; txt.focus(); }
  }
  $('cbEnv').onclick = enviar;
  txt.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });
  // Totem: quando o cliente sai (ou o tempo acaba), apaga a conversa para o próximo cliente começar do zero
  const sairOrig = window.sairTotem;
  if (typeof sairOrig === 'function') window.sairTotem = function () {
    historico = []; setEtapa(null); pediuTel = false; pendente = null; msgs.textContent = ''; txt.value = ''; fecharChat(); painelSacola();
    return sairOrig.apply(this, arguments);
  };
  new MutationObserver(painelSacola).observe($('qtd'), { childList: true, characterData: true, subtree: true });
})();
