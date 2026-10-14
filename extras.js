// extras.js — carregado DEPOIS do app.js (já está no index.html)
// Adiciona: observação do pedido, troco para dinheiro, opção de talheres e a janela do produto com COMPLEMENTOS por item
// (molhos, acompanhamentos, adicionais com preço; configurados no painel em Editar item).
(function () {
  const num = v => parseFloat(String(v || '').replace(/[^\d,.]/g, '').replace(',', '.')) || 0;

  // Troca trechos do código de uma função do app.js sem precisar editá-lo
  function patch(nome, trocas) {
    const fn = window[nome];
    if (typeof fn !== 'function') return console.warn('extras: função não encontrada: ' + nome);
    let src = fn.toString();
    for (const [de, para] of trocas) {
      if (!src.includes(de)) return console.warn('extras: trecho não encontrado em ' + nome + ': ' + de);
      src = src.replace(de, () => para);
    }
    (0, eval)(src);
  }

  // ── Campos extras na sacola (acima do botão Finalizar) ──
  function montarExtras() {
    const btn = $('btnFin'); if (!btn) return;
    let b = $('extraBox');
    if (!b) {
      b = document.createElement('div'); b.id = 'extraBox';
      b.innerHTML = '<label for="xObs">Observação do pedido (opcional)</label>'
        + '<textarea id="xObs" rows="2" maxlength="200" placeholder="Ex.: tocar o interfone, entregar na portaria"></textarea>'
        + '<div id="xTr" style="display:none"><label for="xTroco">Troco para quanto? (opcional)</label>'
        + '<input id="xTroco" inputmode="decimal" placeholder="Ex.: 50,00 · deixe vazio se não precisa de troco"></div>'
        + '<label class="fck" style="display:flex;align-items:center;gap:10px;margin:6px 0 16px;cursor:pointer;text-transform:none;letter-spacing:0;font-size:14px"><input type="checkbox" id="xTalher" checked style="width:20px;height:20px;min-width:20px;margin:0;padding:0;flex:none;accent-color:var(--ac)"><span>Enviar talheres e guardanapos</span></label>';
      btn.parentNode.insertBefore(b, btn);
    }
    $('xTr').style.display = forma === 'Dinheiro' ? 'block' : 'none';
  }
  const envolve = nome => { const o = window[nome]; window[nome] = function () { const r = o.apply(this, arguments); montarExtras(); return r; }; };
  envolve('renderCarrinho'); envolve('pixBox');

  // ── Dados que vão no pedido ──
  window.extraPed = () => {
    const o = {}, obs = ($('xObs') ? $('xObs').value : '').trim().slice(0, 200);
    if (obs) o.obs = obs;
    if (forma === 'Dinheiro' && $('xTroco')) { const t = num($('xTroco').value); if (t > 0) o.troco = Math.round(t * 100) / 100; }
    if ($('xTalher') && !$('xTalher').checked) o.semTalher = true;
    return o;
  };
  window.validaExtras = () => {
    const e = window.extraPed();
    if (e.troco && e.troco < total()) { aviso('O valor do troco precisa ser maior que o total (' + R$(total()) + ')'); return false; }
    return true;
  };
  window.extraMsg = p => (p.obs ? '\n\n*Observação:* ' + p.obs : '') + (p.troco ? '\n*Troco para:* ' + R$(p.troco) : '') + (p.semTalher ? '\n*Sem talheres e guardanapos*' : '');
  window.limpaExtras = () => { if ($('xObs')) $('xObs').value = ''; if ($('xTroco')) $('xTroco').value = ''; if ($('xTalher')) $('xTalher').checked = true; };

  patch('finalizar', [
    ["const ent = lerEntrega(); if (!ent) return;", "const ent = lerEntrega(); if (!ent) return; if (!validaExtras()) return;"],
    ["status: forma === 'Pix'", "...extraPed(), status: forma === 'Pix'"],
    ["*Total:* ${R$(ped.total)}`", "*Total:* ${R$(ped.total)}${extraMsg(ped)}`"],
    ["cart = []; $('qtd').textContent = 0;", "cart = []; $('qtd').textContent = 0; limpaExtras();"]
  ]);

  // ── Complementos por item: cada item guarda os próprios em "complementos" (configurados em Editar item, no painel) ──
  const normG = (g, i) => {
    const min = Math.max(0, +g.min || 0), max = Math.max(1, min, +g.max || 1);
    const ops = (g.opcoes || []).map(o => ({ ...o, nome: String(o.nome ?? ''), preco: +o.preco || 0, max: +o.max || 1 }));
    return { ...g, id: String(g.id ?? 'g' + i), nome: g.nome || 'Opções', min, max, regra: g.regra || 'soma', opcoes: ops };
  };
  const gruposDe = p => {   // grupos ligados ao item (config/loja → complementos, pelos ids em p.grupos); itens antigos usam os complementos do próprio item
    const ids = Array.isArray(p.grupos) ? p.grupos : [], G = typeof GRUPOS_LOJA !== 'undefined' ? GRUPOS_LOJA : [];
    const doItem = ids.map(id => G.find(g => g.id === id)).filter(Boolean);
    return (doItem.length ? doItem : (Array.isArray(p.complementos) ? p.complementos : [])).map(normG).filter(g => g.opcoes.length);
  };
  const gOmax = (g, o) => g.repete ? Math.max(1, +g.max || 1) : Math.max(1, Math.min(+o.max || 1, +g.max || 1));   // grupo com "repete": toda opção pode ser escolhida várias vezes (até o máximo do grupo)
  const gLimite = g => g.min > 0 ? (g.min === g.max ? 'Escolha ' + g.max : 'Escolha de ' + g.min + ' a ' + g.max) : (g.max === 1 ? 'Escolha 1 (opcional)' : 'Escolha até ' + g.max);
  const gRegraTxt = g => ({ media: 'Cobra a média dos preços escolhidos', maior: 'Cobra a opção mais cara escolhida', menor: 'Cobra a opção mais barata escolhida' })[g.regra] || '';
  // Preço e texto dos complementos. frouxo = true ignora o mínimo (para mostrar o preço enquanto o cliente ainda escolhe).
  // O app.js também chama esta função no finalizar() para conferir o preço.
  function calcGrupos(p, sel, frouxo) {
    let extra = 0; const partes = [];
    for (const g of gruposDe(p)) {
      const s = (sel || {})[g.id] || {}, un = [], nomes = []; let tot = 0;
      for (const [i, q0] of Object.entries(s)) {
        const o = g.opcoes[+i], q = +q0; if (!o || !(q > 0)) continue;
        if (q > gOmax(g, o)) return { erro: 'Máximo de ' + gOmax(g, o) + ' para "' + o.nome + '". Ajuste o item.', extra: 0, det: '' };
        for (let k = 0; k < q; k++) un.push(+o.preco || 0);
        tot += q; nomes.push((q > 1 ? q + '× ' : '') + o.nome);
      }
      if (tot > g.max) return { erro: 'Em "' + g.nome + '" você pode escolher até ' + g.max + '.', extra: 0, det: '' };
      if (!frouxo && tot < g.min) return { erro: (g.min === g.max ? 'Escolha ' + g.min : 'Escolha pelo menos ' + g.min) + ' em "' + g.nome + '".', extra: 0, det: '' };
      if (!tot) continue;
      const soma = un.reduce((a, b) => a + b, 0);
      extra += g.regra === 'media' ? soma / un.length : g.regra === 'maior' ? Math.max(...un) : g.regra === 'menor' ? Math.min(...un) : soma;
      partes.push(g.nome + ': ' + nomes.join(', '));
    }
    return { extra: r2(extra), det: partes.join(' · ') };
  }
  window.calcGrupos = calcGrupos; window.gruposDe = gruposDe;

  // ── Estoque dos complementos: quanto ainda dá para escolher de cada opção (já descontando o que está na sacola) ──
  const compUsado = (g, o) => cart.reduce((a, c) => {
    const s = c.sel && c.sel[g.id]; if (!s) return a; let n = 0;
    g.opcoes.forEach((x, i) => { if (x.nome === o.nome && s[i]) n += +s[i]; });
    return a + n * c.q;
  }, 0);
  const compRest = (g, o) => { const k = compKey(g, o); return Object.prototype.hasOwnProperty.call(EST_COMP, k) ? Math.max(0, EST_COMP[k] - compUsado(g, o)) : Infinity; };
  window.compRest = compRest;

  // ── Preço de vitrine: item com preço 0,00 nunca aparece como R$ 0,00; mostra "a partir de" o menor valor que o cliente paga em complementos ──
  window.precoVitrine = p => {
    const base = precoAtual(p); if (base > 0) return { valor: base, aPartir: false };
    let obrig = 0, menorPago = Infinity;
    gruposDe(p).forEach(g => {
      const ops = g.opcoes.filter(o => compRest(g, o) > 0);   // opção esgotada não entra na conta
      ops.forEach(o => { if (+o.preco > 0) menorPago = Math.min(menorPago, +o.preco); });
      if (g.min > 0) {   // grupo obrigatório: custo da escolha mais barata possível, pela regra de cobrança do grupo
        const un = []; ops.forEach(o => { const n = Math.min(gOmax(g, o), compRest(g, o)); for (let k = 0; k < n; k++) un.push(+o.preco || 0); });
        un.sort((a, b) => a - b); const t = un.slice(0, g.min); if (t.length < g.min) return;
        obrig += g.regra === 'media' ? t.reduce((a, b) => a + b, 0) / t.length : g.regra === 'maior' ? t[t.length - 1] : g.regra === 'menor' ? t[0] : t.reduce((a, b) => a + b, 0);
      }
    });
    obrig = r2(obrig);
    if (obrig > 0) return { valor: obrig, aPartir: true };
    if (isFinite(menorPago)) return { valor: menorPago, aPartir: true };
    return { valor: 0, aPartir: false };
  };
  const APARTIR = '<small style="font-weight:400;color:var(--mut);margin-right:4px">a partir de</small>';
  const precoHtml = p => {
    const v = window.precoVitrine(p);
    if (v.aPartir) return APARTIR + R$(v.valor);
    if (v.valor > 0) return emPromo(p) ? '<s style="color:var(--mut);font-size:.8em;font-weight:400;margin-right:6px">' + R$(p.preco) + '</s>' + R$(precoAtual(p)) : R$(p.preco);
    return 'Grátis';   // sem preço e sem nenhum complemento pago: não há valor a mostrar
  };
  window.diagGrupos = () => console.log('Complementos por item:\n' + prods.map(p => p.nome + ' → ' + (gruposDe(p).map(g => g.nome + ' (' + g.opcoes.length + ')').join(', ') || 'nenhum')).join('\n'));

  // ── Janela do produto (estilo app de delivery): o item só entra na sacola por ela ──
  const css = document.createElement('style');
  css.textContent = `
.card .im{position:relative}
.xclk{cursor:pointer}
.xplus{position:absolute;right:8px;bottom:8px;width:32px;height:32px;border-radius:50%;background:var(--tx);color:var(--bg);font:600 20px/32px Inter,sans-serif;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.45)}
.xm{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.74);display:flex;align-items:center;justify-content:center;padding:16px}
.xm-box{display:flex;width:min(940px,100%);height:min(600px,calc(100dvh - 32px));background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.7)}
.xm-img{flex:1 1 50%;display:grid;place-items:center;padding:18px;background:var(--card);min-width:0}
.xm-img img{width:100%;max-height:100%;object-fit:cover;border-radius:10px;aspect-ratio:1}
.xm-noimg .xm-img{display:none}
.xm-side{flex:0 0 min(420px,50%);display:flex;flex-direction:column;background:var(--bg);min-height:0}
.xm-noimg .xm-side{flex:1}
.xm-top{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;font-weight:600}
.xm-x{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--tx);cursor:pointer;font-size:15px}
.xm-body{flex:1;overflow:auto;padding:0 14px 14px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.xm-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:12px}
.xm-card h3{font-size:16px;letter-spacing:.08em}.xm-card p{color:var(--mut);font-size:13px;margin:8px 0}
.xm-pr{font-weight:700;font-size:17px;color:var(--ac)}.xm-pr s{color:var(--mut);font-weight:400;font-size:13px;margin-right:6px}
.xm-sec{background:var(--card);border:1px solid var(--line);border-radius:10px;margin-bottom:12px;overflow:hidden}
.xm-sec>h4{padding:14px 16px 2px;font-size:14px;font-weight:600}.xm-sec>small{display:block;padding:0 16px 10px;color:var(--mut);font-size:12px}
.xm-opt{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1px solid var(--line);cursor:pointer;font-size:14px;font-weight:400}
.xm-opt em{display:block;font-style:normal;font-weight:600;font-size:13px;margin-top:2px;color:var(--ac)}
.xm-opt input{width:22px;height:22px;margin:0;padding:0;flex:none;accent-color:var(--ac)}
.xm-opt.dis{opacity:.45}
.xm-sec .gb{font-size:11px;font-weight:700;border-radius:999px;padding:2px 8px;margin-left:6px;background:var(--line);color:var(--ac)}
.xm-sec.bad{box-shadow:0 0 0 2px #e5484d inset}
.gck{width:22px;height:22px;border:1.5px solid var(--mut);border-radius:6px;flex:none;display:inline-block;position:relative;background:var(--bg)}
.gck.rd{border-radius:50%}
.gck.on{background:var(--ac);border-color:var(--ac)}
.gck.on::after{content:'';position:absolute;left:7px;top:3px;width:5px;height:10px;border:solid var(--on);border-width:0 2px 2px 0;transform:rotate(45deg)}
.gck.rd.on::after{left:5px;top:5px;width:9px;height:9px;border:0;background:var(--on);border-radius:50%;transform:none}
.gq{display:flex;align-items:center;gap:10px;flex:none}
.gq button{width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:none;font-size:20px;line-height:1;cursor:pointer;color:var(--tx);touch-action:manipulation;padding:0}
.gq button:disabled{opacity:.35;cursor:default}
.gq b{min-width:16px;text-align:center}
.xm-sec textarea{display:block;width:100%;border:0;border-top:1px solid var(--line);border-radius:0;margin:0;resize:vertical}
.xm-foot{display:flex;gap:10px;padding:12px 14px;background:var(--card);border-top:1px solid var(--line)}
.xm-q{display:flex;align-items:center;background:var(--bg);border:1px solid var(--line);border-radius:4px}
.xm-q button{width:38px;height:44px;border:0;background:none;color:var(--tx);font-size:20px;cursor:pointer}.xm-q b{min-width:26px;text-align:center}
.xm-add{flex:1;display:flex;justify-content:space-between;align-items:center;padding:0 16px;min-height:44px}
@media(max-width:760px){.xm{align-items:flex-end;padding:0}.xm-box{flex-direction:column;width:100%;height:92dvh;border-radius:16px 16px 0 0}.xm-img{flex:0 0 auto;padding:0}.xm-img img{aspect-ratio:16/9;border-radius:0;max-height:210px}.xm-side{flex:1 1 auto}}`;
  document.head.appendChild(css);

  function simplificaCards() {   // tira "personalizar" e os botões do cartão: o cartão inteiro abre a janela
    document.querySelectorAll('#grid .card').forEach(c => {
      const b = c.querySelector('[id^="ab"]'), id = b ? b.id.slice(2) : '';
      c.querySelectorAll('.pers,.buy').forEach(x => x.remove());
      const pr = prods.find(x => x.id === id), prEl = c.querySelector('.pr'); if (pr && prEl) prEl.innerHTML = precoHtml(pr);   // nunca mostra R$ 0,00
      if (!id || c.classList.contains('off')) return;
      c.dataset.id = id; c.classList.add('xclk');
      const im = c.querySelector('.im'); if (im && !im.querySelector('.xplus')) im.insertAdjacentHTML('beforeend', '<span class="xplus">+</span>');
    });
  }
  const rl = window.renderLoja; window.renderLoja = function () { rl.apply(this, arguments); simplificaCards(); };

  const fechaModal = () => { const m = $('xm'); if (m) m.remove(); document.body.style.overflow = ''; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fechaModal(); });

  function abrirModal(id) {
    const p = prods.find(x => x.id === id); if (!p || esgotado(p)) return;
    const lim = estRest(p); if (lim < 1) return aviso('Você já adicionou todo o estoque disponível deste item');   // estoque: já está tudo na sacola
    fechaModal();
    const gr = gruposDe(p), ads = gr.length ? [] : (p.adicionais || []), rm = p.remover || []; let q = 1;   // com complementos, os adicionais antigos não aparecem
    const S = {};   // S[idDoComplemento][indiceDaOpcao] = quantidade escolhida
    const tot = gid => Object.values(S[gid] || {}).reduce((a, b) => a + b, 0);
    const gHtml = () => gr.map(g => {
      const t = tot(g.id), cheio = t >= g.max, rg = gRegraTxt(g);
      const rows = g.opcoes.map((o, i) => {
        const qn = (S[g.id] || {})[i] || 0, rest = compRest(g, o), omx = Math.min(gOmax(g, o), Math.floor(rest / q)), om = gOmax(g, o), pr = +o.preco > 0 ? '<em>+ ' + R$(o.preco) + '</em>' : '', at = 'data-g="' + esc(g.id) + '" data-i="' + i + '"';
        const out = omx < 1 && !qn, est = out ? '<small style="color:#e5484d;font-weight:600">Esgotado</small>' : (isFinite(rest) && rest <= 5 ? '<small style="color:var(--mut)">Restam ' + rest + '</small>' : '');   // estoque do complemento
        if (om === 1) return '<div class="xm-opt' + (out ? ' dis' : ' xg') + (!qn && cheio && g.max > 1 ? ' dis' : '') + '" ' + at + '><span>' + esc(o.nome) + pr + est + '</span><i class="gck' + (g.max === 1 ? ' rd' : '') + (qn ? ' on' : '') + '"></i></div>';
        return '<div class="xm-opt' + (out ? ' dis' : '') + '" style="cursor:default"><span>' + esc(o.nome) + pr + est + '</span><div class="gq"><button type="button" class="xg-b" ' + at + ' data-d="-1" aria-label="Menos"' + (qn ? '' : ' disabled') + '>−</button><b>' + qn + '</b><button type="button" class="xg-b" ' + at + ' data-d="1" aria-label="Mais"' + ((qn >= omx || (cheio && g.max > 1)) ? ' disabled' : '') + '>+</button></div></div>';
      }).join('');
      return '<div class="xm-sec" data-gs="' + esc(g.id) + '"><h4>' + esc(g.nome) + (g.min > 0 ? '<b class="gb">Obrigatório</b>' : '') + '</h4><small>' + gLimite(g) + (g.max > 1 ? ' · ' + t + '/' + g.max : '') + (rg ? ' · ' + esc(rg) : '') + '</small>' + rows + '</div>';
    }).join('');
    const m = document.createElement('div'); m.id = 'xm'; m.className = 'xm';
    m.innerHTML = '<div class="xm-box' + (p.img ? '' : ' xm-noimg') + '"><div class="xm-img">' + (p.img ? '<img src="' + esc(p.img) + '" alt="' + esc(p.nome) + '">' : '') + '</div>'
      + '<div class="xm-side"><div class="xm-top"><span>Detalhes do produto</span><button class="xm-x" type="button" aria-label="Fechar">✕</button></div><div class="xm-body">'
      + '<div class="xm-card"><h3>' + esc(p.nome) + '</h3>' + (p.desc ? '<p>' + esc(p.desc) + '</p>' : '')
      + '<div class="xm-pr">' + (precoAtual(p) > 0 ? (emPromo(p) ? '<s>' + R$(p.preco) + '</s>' : '') + R$(precoAtual(p)) : precoHtml(p)) + '</div>' + (temEstoque(p) && lim <= 10 ? '<p style="margin:8px 0 0">Restam ' + lim + ' em estoque</p>' : '') + '</div>'
      + '<div id="xmG">' + gHtml() + '</div>'
      + (ads.length ? '<div class="xm-sec"><h4>' + esc(p.adTitulo || 'Adicionais') + '</h4><small>Escolha quantos quiser</small>' + ads.map((x, i) => '<label class="xm-opt"><span>' + esc(x.nome) + (+x.preco > 0 ? '<em>+ ' + R$(x.preco) + '</em>' : '') + '</span><input type="checkbox" data-k="a" data-i="' + i + '"></label>').join('') + '</div>' : '')
      + (rm.length ? '<div class="xm-sec"><h4>Retirar ingredientes</h4><small>Marque o que você não quer</small>' + rm.map((x, i) => '<label class="xm-opt"><span>Sem ' + esc(x) + '</span><input type="checkbox" data-k="r" data-i="' + i + '"></label>').join('') + '</div>' : '')
      + '<div class="xm-sec"><h4>Observação</h4><small>Opcional</small><textarea id="xmObs" rows="2" maxlength="120" placeholder="Ex.: carne ao ponto, sem pimenta"></textarea></div>'
      + '</div><div class="xm-foot"><div class="xm-q"><button class="xm-mn" type="button" aria-label="Diminuir">−</button><b class="xm-qn">1</b><button class="xm-pl" type="button" aria-label="Aumentar">+</button></div>'
      + '<button class="btn xm-add" type="button"><span>Adicionar</span><b class="xm-tot"></b></button></div></div></div>';
    document.body.appendChild(m); document.body.style.overflow = 'hidden';
    const sel = k => [...m.querySelectorAll('input[data-k="' + k + '"]:checked')].map(x => +x.dataset.i);
    const extra = () => r2(sel('a').reduce((s, i) => s + (+ads[i].preco || 0), 0) + (calcGrupos(p, S, true).extra || 0));
    const atualiza = () => { const tt = (precoAtual(p) + extra()) * q; m.querySelector('.xm-tot').textContent = tt > 0 ? R$(tt) : ''; m.querySelector('.xm-qn').textContent = q; };   // sem R$ 0,00: o valor aparece quando o cliente escolhe os complementos
    const pintaG = () => { const b = $('xmG'); if (b) b.innerHTML = gHtml(); atualiza(); };
    const gMuda = (gid, i, d) => {
      const g = gr.find(x => x.id === gid); if (!g) return;
      const o = g.opcoes[i], om = gOmax(g, o); S[gid] = S[gid] || {}; const s = S[gid]; let n = (s[i] || 0) + d;
      if (d > 0) { const r = compRest(g, o); if (((s[i] || 0) + 1) * q > r) return aviso(r < 1 ? '"' + o.nome + '" esgotou' : 'Só restam ' + r + ' de "' + o.nome + '"' + (q > 1 ? ' (para ' + q + ' itens, reduza a quantidade)' : '')); }   // estoque do complemento
      if (g.max === 1 && d > 0) { Object.keys(s).forEach(k => delete s[k]); n = 1; }   // escolha única: troca a opção anterior
      else {
        if (n < 0) n = 0;
        if (d > 0 && n > om) return aviso('Máximo de ' + om + ' para "' + o.nome + '"');
        if (d > 0 && tot(gid) >= g.max) return aviso('Em "' + g.nome + '" você pode escolher até ' + g.max);
      }
      if (n > 0) s[i] = n; else delete s[i];
      pintaG();
    };
    const adicionar = () => {
      const chk = calcGrupos(p, S);
      if (chk.erro) {
        const ruim = gr.find(g => tot(g.id) < g.min), el = ruim && m.querySelector('[data-gs="' + ruim.id + '"]');
        if (el) { m.querySelectorAll('.xm-sec.bad').forEach(x => x.classList.remove('bad')); el.classList.add('bad'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        return aviso(chk.erro);
      }
      for (const g of gr) for (const [i, n] of Object.entries(S[g.id] || {})) { const r = compRest(g, g.opcoes[+i]); if (n * q > r) return aviso('Só restam ' + r + ' de "' + g.opcoes[+i].nome + '". Ajuste o item.'); }   // estoque dos complementos
      const a = sel('a').map(i => ads[i]), r = sel('r').map(i => rm[i]), obs = $('xmObs').value.trim().slice(0, 120), ex = extra(), gd = calcGrupos(p, S, true);
      const det = [gd.det, ...a.map(o => '+ ' + o.nome), ...r.map(n => 'sem ' + n), obs ? 'Obs.: ' + obs : ''].filter(Boolean).join(' · ');
      const it = cart.find(c => c.id === p.id && (c.det || '') === det);
      if (it) it.q = Math.min(50, it.q + q); else cart.push({ id: p.id, nome: p.nome, preco: r2(precoAtual(p) + ex), extra: ex, ads: a.map(o => o.nome), sel: JSON.parse(JSON.stringify(S)), tam: 'Único', det, q });
      fechaModal(); atualizaSacola(); aviso(q > 1 ? q + ' itens adicionados à sacola' : 'Item adicionado à sacola');
    };
    m.addEventListener('change', atualiza);
    m.addEventListener('click', e => {
      const t = e.target;
      if (t === m || t.closest('.xm-x')) return fechaModal();
      const og = t.closest('.xg'), ob = t.closest('.xg-b');
      if (og) return gMuda(og.dataset.g, +og.dataset.i, og.querySelector('.gck.on') ? -1 : 1);
      if (ob) return gMuda(ob.dataset.g, +ob.dataset.i, +ob.dataset.d);
      if (t.closest('.xm-mn')) { q = Math.max(1, q - 1); pintaG(); }
      else if (t.closest('.xm-pl')) {
        let mc = Infinity; gr.forEach(g => Object.entries(S[g.id] || {}).forEach(([i, n]) => { if (n > 0) mc = Math.min(mc, Math.floor(compRest(g, g.opcoes[+i]) / n)); }));   // estoque dos complementos já escolhidos
        if (q >= lim) aviso('Só restam ' + lim + ' unidade(s) deste item'); else if (q >= mc) aviso('Estoque de complemento insuficiente para mais unidades');
        q = Math.max(1, Math.min(20, lim, mc, q + 1)); pintaG();
      }
      else if (t.closest('.xm-add')) adicionar();
    });
    atualiza();
  }
  $('grid').addEventListener('click', e => { const c = e.target.closest('.card.xclk'); if (c) abrirModal(c.dataset.id); });
  renderLoja(); montarExtras();
})();
