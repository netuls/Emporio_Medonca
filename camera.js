/* Câmera do totem: mostra a webcam ao vivo (espelhada) num canto da tela, para o cliente se ver.
   Nada é gravado nem enviado: o vídeo fica só no navegador deste computador.
   Liga/desliga e posição ficam no painel admin (config/loja.camera). Carregado depois do pagamentos.js. */
(function () {
  if (typeof db === 'undefined') return;
  const POS = ['be', 'bd', 'te', 'td'], TAM = { p: 130, m: 190, g: 270 };
  let stream = null, box = null, ult = null, tok = 0;
  const css = document.createElement('style');
  css.textContent = '#cam{position:fixed;z-index:35;border-radius:16px;overflow:hidden;background:#000;border:2px solid #fff;box-shadow:0 12px 30px -10px rgba(0,0,0,.5);pointer-events:none}'
    + '#cam video{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;transform:scaleX(-1)}'
    + '#cam span{display:block;padding:5px 8px;background:rgba(0,0,0,.72);color:#fff;font:600 12px/1.3 system-ui,sans-serif;text-align:center}'
    + '#cam.be{left:16px;bottom:16px}#cam.bd{right:84px;bottom:16px}#cam.te{left:16px;top:16px}#cam.td{right:16px;top:16px}'
    + 'body:has(.cbar.on) #cam.be,body:has(.cbar.on) #cam.bd{bottom:100px}'
    + '@media(max-width:760px){#cam{max-width:32vw}}';
  document.head.appendChild(css);

  // Abre a webcam. Se ela estiver ocupada/instável (NotReadableError), tenta de novo algumas vezes e com configuração mais simples.
  async function abrirCamera(meu) {
    const jeitos = [{ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }, { video: true, audio: false }];
    let ultimo;
    for (let i = 0; i < 5; i++) {
      for (const j of jeitos) {
        if (meu !== tok) return null;   // a configuração mudou enquanto tentava
        try { return await navigator.mediaDevices.getUserMedia(j); }
        catch (e) { ultimo = e; if (!['NotReadableError', 'AbortError', 'OverconstrainedError'].includes(e.name)) throw e; }
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw ultimo;
  }
  function parar() { if (window.gravacaoCamera) window.gravacaoCamera.parar(); tok++; if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } if (box) { box.remove(); box = null; } }
  async function ligar(c) {
    parar(); if (!c || !(c.ativo || c.gravar)) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return console.info('Câmera: o navegador não permite (precisa de https).');
    const meu = tok;
    try {
      const st = await abrirCamera(meu);
      if (!st) return;
      if (meu !== tok) { st.getTracks().forEach(t => t.stop()); return; }   // a configuração mudou enquanto pedia a permissão
      stream = st; box = document.createElement('div'); box.id = 'cam';
      box.className = POS.includes(c.pos) ? c.pos : 'be'; box.style.width = (TAM[c.tam] || TAM.m) + 'px';
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.autoplay = true; v.srcObject = st; box.appendChild(v);
      const tx = String(c.texto || '').trim().slice(0, 40);
      if (tx) { const sp = document.createElement('span'); sp.textContent = tx; box.appendChild(sp); }
      if (!c.ativo) box.style.cssText += ';left:-9999px;top:0;width:160px;height:120px';   // só grava: imagem fora da tela
      document.body.appendChild(box); v.play().catch(() => {});
      if (c.gravar && window.gravacaoCamera) window.gravacaoCamera.iniciar(st, v, c);
      const tr = st.getVideoTracks()[0]; if (tr) tr.onended = parar;   // câmera desconectada
    } catch (e) { console.info('Câmera não iniciada:', e.name, e.message); }   // permissão negada ou sem câmera: o site segue normal
  }
  db.collection('config').doc('loja').onSnapshot(s => {
    const c = (s.data() || {}).camera || null, sig = JSON.stringify(c);
    if (sig === ult) return; ult = sig; ligar(c);
  }, () => {});
})();
