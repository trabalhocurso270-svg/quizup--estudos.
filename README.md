# QuizUp Estudos: passo a passo completo (GitHub + MongoDB Atlas + Render + UptimeRobot)

Tempo estimado: 40 a 60 minutos. Tudo usa planos gratuitos, inclusive a IA (Google Gemini). Os nomes de botões dos sites podem mudar um pouco com o tempo, mas o caminho é o mesmo.

**Contas que você vai criar:** Google AI Studio (conta Google), MongoDB Atlas, GitHub, Render e UptimeRobot.

**Guarde num bloco de notas (nunca no GitHub):** a chave do Gemini, a string de conexão do MongoDB e a senha de professor.

## 1. Chave gratuita do Google Gemini (a IA que gera questões)

1. Acesse **aistudio.google.com** e entre com uma conta Google.
2. Clique em **Get API key** > **Create API key** (se pedir, escolha ou crie um projeto). Copie a chave, que começa com `AIza`.
3. Não precisa de cartão de crédito. O plano gratuito permite alguns pedidos por minuto e algumas centenas de pedidos por dia (o AI Studio mostra o limite exato do seu projeto), o que é suficiente para gerar questões em sala.
4. Nome do modelo: o projeto usa `gemini-3-flash-preview` por padrão. Se esse nome sair do ar, o servidor tenta escolher sozinho outro modelo Flash. Se mesmo assim der erro, cadastre no Render a variável `GEMINI_MODEL` com um nome de modelo Flash que apareça no AI Studio.
5. Privacidade: no plano gratuito o Google pode usar os dados enviados para melhorar seus produtos. O app envia só disciplina, assunto e dificuldade, nunca dados de alunos. Não mude isso.

## 2. Banco de dados no MongoDB Atlas

1. Acesse **mongodb.com/atlas** e crie uma conta (pode usar o Google).
2. Crie um cluster: escolha o plano **M0 (Free)**, qualquer provedor e uma região próxima (ex.: São Paulo), e clique em **Create**.
3. Em **Database Access**, clique em **Add New Database User**. Escolha usuário e senha (**use só letras e números na senha**, para evitar erros) e guarde os dois. Permissão: *Read and write to any database*.
4. Em **Network Access**, clique em **Add IP Address** > **Allow access from anywhere** (`0.0.0.0/0`) > **Confirm**. É necessário porque o IP do Render gratuito muda.
5. Em **Database** (ou Clusters), clique em **Connect** > **Drivers** e copie a string, parecida com:
   `mongodb+srv://usuario:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
6. Troque `<password>` (com os sinais `<` e `>`) pela senha do passo 3. Essa é a sua `MONGODB_URI`.

## 3. Código no GitHub

1. Crie uma conta em **github.com**.
2. Clique em **+** > **New repository**. Nome: `quizup-estudos`. Marque **Private** se não quiser o código público. Clique em **Create repository**.
3. Descompacte o zip no seu computador.
4. Na página do repositório, clique em **uploading an existing file**, arraste os arquivos `server.js`, `index.html`, `seed.json`, `package.json` e `README.md` e clique em **Commit changes**.
5. O `.gitignore` é um arquivo oculto e pode não ser arrastado. Não é obrigatório, mas se quiser: **Add file** > **Create new file**, nome `.gitignore`, conteúdo `node_modules` e `.env` (um por linha), e faça o commit.
6. Confira: o repositório deve mostrar os arquivos. **Nenhuma chave pode aparecer em nenhum deles.**

## 4. Servidor no Render

1. Crie uma conta em **render.com** (pode entrar com o GitHub).
2. Clique em **New +** > **Web Service** > **Build and deploy from a Git repository** e autorize o acesso ao repositório `quizup-estudos`.
3. Preencha:
   - **Language/Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Em **Environment Variables**, adicione:
   - `MONGODB_URI` = a string do passo 2
   - `GEMINI_API_KEY` = a chave do passo 1
   - `GENERATE_PASSWORD` = uma senha de professor que você inventar
   - (opcional) `GEMINI_MODEL` = nome de outro modelo Flash, se o padrão der erro
5. Clique em **Create Web Service** e espere o deploy (2 a 5 minutos). Nos **Logs**, deve aparecer `QuizUp no ar na porta ...`.
6. No topo da página do serviço está o endereço, tipo `https://quizup-estudos.onrender.com`. Esse é o link do seu app.

## 5. Teste tudo

1. Abra o link, crie sua conta e faça um quiz.
2. Em **Questões**, use **✨ Gerar questões com IA**: escolha disciplina e assunto, digite a senha de professor e gere. As questões vêm marcadas "IA (revisar)".
3. Abra **Ranking**: seu nome deve aparecer depois do primeiro quiz.
4. No Atlas, em **Browse Collections**, você verá o banco `quizup` com `questions` e `players`.

## 6. Manter o servidor acordado (UptimeRobot)

O Render gratuito dorme após 15 minutos sem acessos, e acordar leva cerca de 1 minuto.

1. Crie uma conta em **uptimerobot.com**.
2. Clique em **+ New monitor**.
3. **Monitor Type:** HTTP(s). **Friendly Name:** QuizUp. **URL:** `https://SEU-APP.onrender.com/api/status` (troque pelo seu endereço).
4. **Monitoring Interval:** 5 minutos (o mínimo do plano gratuito). Deixe seu e-mail nos alertas e clique em **Create Monitor**.
5. Em alguns minutos o monitor fica **Up**. O plano gratuito é para uso pessoal e não comercial.

## 7. Atualizar o app depois

No GitHub, abra o arquivo, clique no lápis, edite e faça **Commit changes**. O Render publica a nova versão sozinho.

## Problemas comuns

- **Log "Falta a variável MONGODB_URI":** a variável não foi cadastrada no Render.
- **"bad auth" ou "Authentication failed":** usuário ou senha errados na string (confira se trocou o `<password>`).
- **Timeout ao conectar:** faltou liberar `0.0.0.0/0` em Network Access no Atlas.
- **Painel de IA não aparece:** falta `GEMINI_API_KEY` no Render.
- **"Falha na IA (código 400/403)":** chave errada ou copiada incompleta. Gere outra no AI Studio.
- **"Falha na IA (código 404)":** o modelo não existe mais. Cadastre `GEMINI_MODEL` com um modelo Flash listado no AI Studio.
- **"Limite gratuito da IA atingido":** espere um minuto (ou até o dia seguinte, se o limite diário acabou).
- **"Senha incorreta":** a senha digitada é diferente de `GENERATE_PASSWORD`.
- **Primeiro acesso lento:** o servidor estava dormindo. O UptimeRobot reduz isso, mas o Render pode mudar as regras do plano gratuito.

## Segurança e limites

- Se uma chave vazar (por exemplo, for para o GitHub), apague-a no AI Studio e crie outra.
- O ranking confia no XP enviado pelo navegador, então dá para trapacear. Para valer nota ou prêmio, adicione login.
- Questões geradas por IA podem ter erros. Revise antes de usar com alunos.
