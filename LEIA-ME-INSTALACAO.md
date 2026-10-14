# Instalação — Emporio Medonça

Este pacote já está pronto: cardápio para os clientes (`index.html`) e painel do dono (`admin.html`).
Falta só ligar ao banco de dados (Firebase) e publicar. Siga na ordem.

## 1. Firebase (banco de dados)

1. https://console.firebase.google.com → **Adicionar projeto** (nome livre).
2. **Firestore Database** → *Criar banco de dados* → modo **produção** → local **São Paulo (`southamerica-east1`)**.
   (A pasta `functions` já está configurada para essa mesma região. Se escolher outro local, mude a constante `REGIAO` em `functions/index.js`.)
3. **Authentication → Sign-in method**: ative os **três** métodos abaixo (o sistema usa os três):
   - **Anônimo** (cada visitante ganha uma identidade para fazer pedidos);
   - **Google** (o cliente pode guardar o histórico de pedidos);
   - **E-mail/senha** (é o acesso do dono ao painel).
   Depois, em **Users → Adicionar usuário**: e-mail `admin@emporiomedonca.com` e a senha que o dono vai usar no painel.
4. **Configurações do projeto → Seus apps → </> (Web)**: registre o app (os dados já estão no `config.js`).
5. **Firestore Database → Regras**: apague o que estiver lá, cole o conteúdo do arquivo `firestore.rules` deste pacote e clique em **Publicar**.
   Essas regras só deixam o e-mail `admin@emporiomedonca.com` administrar o restaurante e protegem os pedidos de cada cliente.
6. **Authentication → Settings → User actions**: desmarque **Enable create (sign-up)** (o dono não usa cadastro por e-mail; o cliente entra como anônimo ou com Google).
7. A chave VAPID dos avisos já está no `config.js`.

## 2. Publicar o site (precisa ser https)
Escolha uma opção:
- **Netlify (mais simples):** app.netlify.com/drop → arraste a pasta inteira.
- **GitHub Pages:** suba os arquivos em um repositório e ative o Pages.
- **Firebase Hosting:** com o Node instalado, rode `npm i -g firebase-tools`, `firebase login` e, dentro desta pasta, `firebase deploy --only hosting,firestore:rules`.

Depois, no Firebase: **Authentication → Settings → Domínios autorizados** → adicione o endereço do site (sem isso o login com Google não abre).

- Cardápio dos clientes: `https://SEU-ENDERECO/`
- Painel do dono: `https://SEU-ENDERECO/admin.html` (senha do passo 1.3)

## 3. Avisos de pedido novo no celular (opcional, mas recomendado)
O painel avisa com som quando está aberto. Para receber o aviso **com o painel fechado**, publique a função da pasta `functions`:
1. O projeto precisa estar no plano **Blaze** (pago conforme o uso; para um restaurante de bairro o custo costuma ser zero ou centavos).
2. Com o Node 20 instalado: `npm i -g firebase-tools`, `firebase login` e, dentro desta pasta, `firebase deploy --only functions`.
3. No painel, toque em **🔔 Ativar avisos** em cada aparelho do dono e depois em **🔧 Testar** (ele mostra em qual etapa algo falha).
No iPhone, instale o painel na tela de início (Compartilhar → Adicionar à Tela de Início) antes de ativar os avisos.

## 4. Primeiro uso (painel → `admin.html`)
1. **Ajustes do restaurante**: WhatsApp, **Instagram** (o @ vira um ícone no site; vazio = sem ícone), local e horário de retirada, taxa padrão de entrega, taxa por bairro, frete grátis e as mensagens enviadas ao cliente.
2. **Funcionamento**: horário automático ligado (11:00 às 23:00, 7 dia(s) por semana). Aqui o dono liga o horário automático, define pedido mínimo e tempo estimado, e usa o botão **Pausar pedidos** quando a cozinha estiver lotada. Salve com *Salvar funcionamento*.
3. **Uber Flash**: o cliente escolhe entre Entrega, Uber Flash ou Retirar no restaurante. No Uber Flash o cliente chama o motoboy pelo app do Uber, sem digitar endereço, e paga só os itens por Pix. Dá para ligar/desligar a opção na seção UBER FLASH do painel.
4. **Pix**: **cadastre sua chave Pix** (ainda não foi informada) e toque em *Salvar Pix*.
5. **Cardápio**: cadastre cada item com foto, preço, categoria (ex.: Lanches, Porções, Bebidas) e descrição. O cadastro e a lista do cardápio ficam na aba **Catálogo** do painel. Para molhos, acompanhamentos e adicionais com preço, crie um **grupo de complementos** na mesma aba (*+ Novo grupo*): dê um nome (ex.: Escolha o molho), defina o **mínimo** e o **máximo** de escolhas (mínimo 1 ou mais = o cliente é obrigado a escolher), como cobrar (somar, média, mais cara ou mais barata) e as opções com preço, e marque em quais itens do cardápio o grupo vale: um grupo serve vários itens de uma vez. Em *Máx.* da opção você deixa o cliente escolher a mesma opção mais de uma vez (ex.: bacon 2×). Em *Itens que o cliente pode retirar* separe por vírgula (`cebola, tomate`). O cliente ainda escreve uma observação por item. Acabou um prato? Toque em **Marcar como indisponível** e ele fica cinza no site, sem apagar o cadastro.
6. **Galeria de fotos** (opcional): na seção *Galeria de fotos* do painel, escolha até 12 fotos. Elas passam sozinhas, em carrossel, acima do cardápio. Sem nenhuma foto, a galeria fica escondida.
7. Faça um pedido de teste pelo site e acompanhe no painel.
8. Apague o pedido de teste (botão *Excluir*).

## 5. Como o painel funciona
- **Pedidos**: Confirmar → Em preparo → Saiu para entrega → **Entregue**. Cada mudança oferece abrir o WhatsApp com a mensagem pronta. Adicionais, itens retirados e observações aparecem no pedido, no WhatsApp e no cupom impresso.
- **Aparência**: em *Aparência do site*, o dono escolhe um estilo pronto, a cor de destaque (botões, sacola, categoria ativa), a cor de realce (etiqueta Promoção) e a letra dos títulos. A prévia muda na hora; o site só muda depois de *Salvar aparência*.
- **Sacola do cliente**: o cliente toca no cartão do prato para abrir a janela do produto (complementos, retirar ingredientes, observação e quantidade). Na sacola ele ainda escreve uma observação do pedido, informa o troco (pagando em dinheiro) e escolhe se quer talheres e guardanapos. Tudo isso aparece no pedido e no WhatsApp.
- **Aberto e fechado**: com o horário automático ligado, fora do expediente o site mostra *Fechado* e bloqueia o botão de finalizar. *Pausar pedidos* faz o mesmo na hora, até o dono retomar.
- **Formas de pagamento**: na seção *Formas de pagamento* do painel, o dono adiciona ou remove as opções que o cliente vê ao finalizar o pedido (ex.: Cartão de débito, Vale refeição). Sem o Pix na lista, a opção Uber Flash some do site.
- **Câmera do totem**: na seção *Câmera do totem* do painel, o dono liga a webcam do computador para o cliente se ver numa tela, num canto (a imagem não é gravada nem enviada). No computador do totem, permita a câmera quando o navegador perguntar.
- **Visual do site**: o site do cliente usa o estilo de totem (capa grande, categorias fixas no topo, cartões com foto grande e botão Meus pedidos). Os complementos ficam dentro da seção Cardápio do painel.
- **Relatórios**: a receita conta **somente pedidos Entregues**. Cancelados e em andamento ficam de fora.
- **Registrar venda manual**: para pedido de balcão ou de telefone. Já entra como Entregue.
- **Clientes**: quem visitou, quem se cadastrou e quem já pediu (só pedidos entregues contam).

## Se algo der errado
- *"permission-denied" / pedido não envia*: as regras do passo 1.5 não foram publicadas (ou o e-mail do admin é diferente do que está no `config.js`).
- *Login com Google não abre*: falta o domínio em Domínios autorizados (passo 2) ou o método Google não foi ativado (passo 1.3).
- *Painel não entra*: confira se o usuário `admin@emporiomedonca.com` existe em Authentication → Users e se o método E-mail/senha está ativo.
- *Mudou um arquivo e nada mudou no site*: use Ctrl+Shift+R. O site guarda cópia para funcionar como aplicativo; aumente o número da versão em `sw.js` (`emporio-medonca-v1` → `emporio-medonca-v2`).
- *Avisos não chegam*: toque em **🔧 Testar** no painel; ele aponta a etapa que falhou.

## Dados desta instalação
- Restaurante: Emporio Medonça
- WhatsApp: 5585996870852
- E-mail do admin: admin@emporiomedonca.com
- Funcionamento inicial: horário automático ligado (11:00 às 23:00, 7 dia(s) por semana)
- Versão do sistema: 2026.10.14b-restaurante
