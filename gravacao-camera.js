/* Gravação por movimento (totem). Quando alguém aparece na frente da câmera (movimento), grava um trecho de vídeo.
   Os trechos ficam só neste computador (IndexedDB) e são apagados após o prazo (config/loja.camera.horas, padrão 24 h).
   Ligar/desligar: painel → Câmera do totem → "Gravar quando alguém aparecer". Carregado antes do camera.js. */
(function () {
  const MAXMB = 1500, FIM = 3000, MAXCLIP = 120000;   // teto de espaço; para após 3 s sem movimento (pessoa saiu); trecho máx. de 2 min
  let idb = null, loop = null, limp = null, rec = null, parts = [], ini = 0, ult = 0, hits = 0, prev = null, cfg = {}, pill = null;
  const abrir = () => idb || (idb = new Promise((ok, er) => { const r = indexedDB.open('emporio-gravacoes', 1); r.onupgradeneeded = () => r.result.createObjectStore('c', { keyPath: 'id', autoIncrement: true }); r.onsuccess = () => ok(r.result); r.onerror = () => er(r.error); }));
  const tx = async (m, f) => { const d = await abrir(); return new Promise((ok, er) => { const t = d.transaction('c', m), q = f(t.objectStore('c')); t.oncomplete = () => ok(q && q.result); t.onerror = () => er(t.error); }); };
  const listar = () => tx('readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => y.ini - x.ini));
  const horas = () => Math.min(72, Math.max(1, +cfg.horas || 24));

  async function limpar() {
    try {
      const lim = Date.now() - horas() * 3600e3; let tot = 0;
      for (const c of await listar()) { tot += c.blob.size; if (c.ini < lim || tot > MAXMB * 1048576) await tx('readwrite', s => s.delete(c.id)); }
    } catch (e) {}
  }
  function aviso(on) {
    if (!on) { if (pill) pill.remove(); pill = null; return; }
    if (!pill) { pill = document.createElement('div'); pill.style.cssText = 'position:fixed;z-index:36;left:50%;bottom:6px;transform:translateX(-50%);background:rgba(0,0,0,.72);color:#fff;font:600 11px/1.3 system-ui,sans-serif;padding:4px 10px;border-radius:99px;pointer-events:none;white-space:nowrap'; document.body.appendChild(pill); }
    pill.innerHTML = '<span id="gravDot" style="color:#888">●</span> Ambiente com câmera de segurança. Imagens apagadas após ' + horas() + ' h.';
  }
  const ponto = on => { const d = document.getElementById('gravDot'); if (d) d.style.color = on ? '#f33' : '#888'; };

  function gravar(st) {
    const tipo = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t)), t0 = Date.now(); parts = []; ini = t0;
    let r; try { r = rec = new MediaRecorder(st, { mimeType: tipo, videoBitsPerSecond: 400000 }); } catch (e) { rec = null; return; }
    r.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
    r.onstop = () => { const b = new Blob(parts, { type: r.mimeType || 'video/webm' }); parts = []; if (b.size > 2000) tx('readwrite', s => s.add({ ini: t0, dur: Date.now() - t0, blob: b })).catch(() => {}); };
    r.start(1000); ponto(true);
  }
  function fim() { if (rec && rec.state !== 'inactive') rec.stop(); rec = null; hits = 0; ponto(false); }
  function parar() { clearInterval(loop); clearInterval(limp); loop = limp = null; fim(); aviso(false); prev = null; }

  function iniciar(st, video, c) {
    parar(); cfg = c || {}; if (!cfg.gravar || !window.MediaRecorder) return;
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 48; const x = cv.getContext('2d', { willReadFrequently: true });
    aviso(true); limpar(); limp = setInterval(limpar, 600000);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    loop = setInterval(() => {
      if (video.readyState < 2) return;
      x.drawImage(video, 0, 0, 64, 48); const d = x.getImageData(0, 0, 64, 48).data, g = new Uint8Array(3072);
      for (let i = 0; i < 3072; i++) g[i] = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11;
      if (prev) {
        let n = 0; for (let i = 0; i < 3072; i++) if (Math.abs(g[i] - prev[i]) > 25) n++;
        if (n / 3072 > .02) { ult = Date.now(); hits++; } else hits = Math.max(0, hits - 1);   // movimento precisa se repetir 2x (evita ruído)
        if (!rec && hits >= 2) gravar(st);
        if (rec && (Date.now() - ult > FIM || Date.now() - ini > MAXCLIP)) fim();
      }
      prev = g;
    }, 400);
  }
  window.gravacaoCamera = { iniciar, parar };

  /* Painel admin: lista os trechos gravados NESTE navegador (abra o painel no computador do totem). */
  if (!document.getElementById('cam-sec')) return;
  const fmt = ms => new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const sec = document.createElement('div'); sec.className = 'sec'; sec.id = 'grav-sec';
  sec.innerHTML = '<h2 class="pt">GRAVAÇÕES DO TOTEM</h2><p class="rd">Trechos gravados quando alguém aparece na câmera. Ficam só neste computador e são apagados sozinhos após o prazo. Para ver, abra o painel neste mesmo computador e navegador do totem.</p><button class="btn" id="gravTudo">Apagar tudo agora</button><div id="gravL" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:12px"></div>';
  // Aba própria "Gravações" no menu lateral (mesmo padrão das abas Histórico e Catálogo)
  const tabs = document.querySelector('.tabs'), bt = document.createElement('button'), pg = document.createElement('div');
  bt.id = 'tbV'; bt.textContent = 'Gravações'; bt.onclick = () => aba('V'); tabs.insertBefore(bt, document.getElementById('tbR'));
  pg.id = 'tV'; pg.style.display = 'none'; pg.appendChild(sec); document.getElementById('tC').insertAdjacentElement('afterend', pg);
  const abaOrig = window.aba;
  window.aba = function (t) { abaOrig(t); const on = t === 'V'; pg.style.display = on ? 'block' : 'none'; bt.classList.toggle('on', on); if (on) desenhar(); };
  let urls = [];
  async function desenhar() {
    urls.forEach(URL.revokeObjectURL); urls = []; const L = document.getElementById('gravL'), a = await listar().catch(() => []);
    L.innerHTML = a.length ? '' : '<p class="rd">Nenhuma gravação neste computador.</p>';
    a.forEach(c => { const u = URL.createObjectURL(c.blob); urls.push(u); const d = document.createElement('div'); d.style.cssText = 'border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--card)';
      d.innerHTML = '<video controls preload="metadata" src="' + u + '" style="display:block;width:100%"></video><div style="padding:8px 10px;font-size:12px"><b>' + fmt(c.ini) + '</b> · ' + Math.round(c.dur / 1000) + ' s · ' + (c.blob.size / 1048576).toFixed(1) + ' MB<br><a class="ab" href="' + u + '" download="gravacao-' + c.ini + '.webm">Baixar</a> <button class="ab r">Apagar</button></div>';
      d.querySelector('button').onclick = async () => { await tx('readwrite', s => s.delete(c.id)); desenhar(); }; L.appendChild(d); });
  }
  document.getElementById('gravTudo').onclick = async () => { if (confirm('Apagar todas as gravações deste computador?')) { await tx('readwrite', s => s.clear()); desenhar(); } };
  desenhar(); setInterval(() => { if (pg.style.display !== 'none' && ![...sec.querySelectorAll('video')].some(v => !v.paused)) desenhar(); }, 30000);   // não atualiza enquanto um vídeo toca
})();
