// ═══════════════════════════════════════════════════════════════════
//  CONFIGURAÇÃO DO RESTAURANTE — Emporio Medonça
//  Arquivo gerado por criar-restaurante.html. Nome, WhatsApp, Pix, frete, retirada, logo e mensagens
//  podem ser mudados depois pelo painel (admin.html), sem editar este arquivo.
// ═══════════════════════════════════════════════════════════════════
const LOJA = {
  nome: "Emporio Medonça",
  whatsapp: "5585996870852",            // DDI+DDD+número, só dígitos: recebe o aviso do pedido
  adminEmail: "admin@emporiomedonca.com",   // e-mail "interno" do admin (não precisa existir); no painel você digita só a senha
  pix: {"tipo":"cpf","chave":"","nome":"EMPORIO MEDONCA","cidade":"FORTALEZA"},
  vapidKey: "BOlQwdVipKeU0DoCKVcOEEPXke21vagdp27ISJFWuM47iN3-ajzS9AwV5Z9Bz9sLR1v8Z2yJ6l2JPaHnc5Vg0dQ",   // Firebase > Configurações > Cloud Messaging > Certificados push da Web > Gerar par de chaves
  geradoEm: "2026-10-14",
  versao: "2026.10.14b-restaurante",
  visual: {"ac":"#B88B2D","gold":"#A87F32","fonte":"padrao"},   // cores e letra iniciais (o dono muda em Aparência do site, no painel)
  padroes: {
    "horarioAuto": true,
    "horarios": [
      {
        "a": true,
        "de": "11:00",
        "ate": "23:00"
      },
      {
        "a": true,
        "de": "11:00",
        "ate": "23:00"
      },
      {
        "a": true,
        "de": "11:00",
        "ate": "23:00"
      },
      {
        "a": true,
        "de": "11:00",
        "ate": "23:00"
      },
      {
        "a": true,
        "de": "11:00",
        "ate": "23:00"
      },
      {
        "a": true,
        "de": "11:00",
        "ate": "23:00"
      },
      {
        "a": true,
        "de": "11:00",
        "ate": "23:00"
      }
    ],
    "pedidoMin": 0,
    "tempoEntrega": "",
    "tempoRetirada": ""
  },   // valores iniciais de funcionamento (o painel passa a valer depois que o dono salvar)
  firebase: {
    "apiKey": "AIzaSyCk9GzPZmYYca_JopIKEo5vKZq6X8tIrpo",
    "authDomain": "emporio-ff1e4.firebaseapp.com",
    "projectId": "emporio-ff1e4",
    "storageBucket": "emporio-ff1e4.firebasestorage.app",
    "messagingSenderId": "953609728122",
    "appId": "1:953609728122:web:435bbddbc592c676788bc3"
  }
};
firebase.initializeApp(LOJA.firebase);
const db = firebase.firestore(), auth = firebase.auth();
const R$ = v => 'R$ ' + Number(v).toFixed(2).replace('.', ',');

// ── Pix copia-e-cola (BR Code) ──
function pixPayload(valor, txid) {
  const t = (i, v) => i + String(v.length).padStart(2, '0') + v;
  const lim = (s, n) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().slice(0, n);
  const p = t('00','01') + t('26', t('00','br.gov.bcb.pix') + t('01', LOJA.pix.chave)) + t('52','0000') + t('53','986') +
    t('54', valor.toFixed(2)) + t('58','BR') + t('59', lim(LOJA.pix.nome,25)) + t('60', lim(LOJA.pix.cidade,15)) +
    t('62', t('05', (txid || '***').replace(/\W/g,'').slice(0,25) || '***')) + '6304';
  let c = 0xFFFF;
  for (let i = 0; i < p.length; i++) { c ^= p.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; }
  return p + c.toString(16).toUpperCase().padStart(4, '0');
}

// ── PWA: registra o service worker (requer HTTPS, como no GitHub Pages/Firebase Hosting) ──
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js?cfg=' + encodeURIComponent(JSON.stringify(LOJA.firebase))).catch(console.error));
