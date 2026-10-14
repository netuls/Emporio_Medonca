/* Tela inicial do totem — carregado por último (depois do app.js, extras.js, pagamentos.js e camera.js).
   Ao abrir o site (e sempre que o cliente sai ou fica parado), mostra a logo grande e o botão FAZER PEDIDO. */
(function () {
  const OCIOSO_S = 90;   // segundos sem tocar na tela para voltar ao início (mude aqui se quiser mais ou menos tempo)

  const css = document.createElement('style');
  css.textContent = `
#welcome{position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6vh;padding:5vh 6vw;background:var(--bg);text-align:center;transition:opacity .35s ease,visibility .35s}
#welcome.off{opacity:0;visibility:hidden;pointer-events:none}
#welcome .wlogo{max-width:min(78vw,720px);max-height:46vh;width:auto;height:auto;object-fit:contain}
#welcome .wbtn{font-size:clamp(22px,4.2vw,40px);padding:.9em 2.2em;border-radius:999px;letter-spacing:.08em;min-height:88px;min-width:min(86vw,520px);box-shadow:0 14px 40px -12px rgba(0,0,0,.35);animation:wpulso 2.4s ease-in-out infinite}
#welcome .wbtn:active{transform:scale(.97)}
#welcome small{color:var(--mut);font-size:clamp(14px,2vw,20px)}
@keyframes wpulso{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
body.wopen{overflow:hidden}`;
  document.head.appendChild(css);

  const W = document.getElementById('welcome'), go = document.getElementById('wGo'), st = document.getElementById('wSt');
  if (!W || !go) return;

  // Versão nova do site: o totem se atualiza sozinho, mas só na tela inicial (nunca no meio do pedido de um cliente)
  let atualizar = false;
  if ('serviceWorker' in navigator) {
    const tinha = !!navigator.serviceWorker.controller;   // na primeira visita não precisa recarregar
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!tinha) return; atualizar = true; if (!W.classList.contains('off')) location.reload(); });
    window.buscarSW = () => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
    setInterval(window.buscarSW, 30 * 60 * 1000);   // procura versão nova a cada 30 min
  }

  function pintaStatus() { try { st.textContent = typeof estadoAberto === 'function' ? estadoAberto().curto : ''; } catch (e) {} }
  function mostrar() {
    if (atualizar) return location.reload();   // há versão nova esperando: aproveita que o totem está na tela inicial
    if (window.buscarSW) window.buscarSW();
    pintaStatus(); W.classList.remove('off'); document.body.classList.add('wopen');
    if (typeof fechar === 'function') fechar();
    const m = document.getElementById('xm'); if (m) m.remove();   // fecha a janela de produto, se estiver aberta
    window.scrollTo({ top: 0 });
  }
  function esconder() {
    W.classList.add('off'); document.body.classList.remove('wopen');
    window.scrollTo({ top: 0 });
    const p = document.getElementById('produtos'); if (p) setTimeout(() => p.scrollIntoView({ behavior: 'smooth' }), 60);   // já abre no cardápio
    reinicia();
  }
  go.addEventListener('click', esconder);

  // Quem sair (botão Sair, fim do tempo depois do pedido) volta para a tela inicial
  const sairOrig = window.sairTotem;
  if (typeof sairOrig === 'function') window.sairTotem = function () { const r = sairOrig.apply(this, arguments); mostrar(); return r; };

  // Sem ninguém tocar na tela por um tempo: limpa a sacola, sai da conta (se houver) e volta ao início
  let ocioso = null;
  function reinicia() {
    clearTimeout(ocioso);
    if (!W.classList.contains('off')) return;   // já está na tela inicial
    ocioso = setTimeout(() => {
      if (document.getElementById('pPos') && document.getElementById('pPos').classList.contains('on')) return reinicia();   // pedido concluído: o app.js já tem o próprio contador
      const logado = typeof user !== 'undefined' && user && !user.isAnonymous;
      if (logado || (typeof cart !== 'undefined' && cart.length) || (typeof perfil !== 'undefined' && perfil && perfil.nome)) window.sairTotem(); else mostrar();
    }, OCIOSO_S * 1000);
  }
  ['pointerdown', 'keydown', 'touchstart', 'scroll', 'input'].forEach(ev => addEventListener(ev, reinicia, { passive: true, capture: true }));
  setInterval(pintaStatus, 60000);

  mostrar();
})();
