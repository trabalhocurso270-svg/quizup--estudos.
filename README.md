# QuizUp Estudos

App de estudos gamificado para ENEM e reforço escolar: quiz, XP, conquistas, desempenho, ranking real e **gerador de questões com IA**.

- `server.js`: servidor único (site + API + banco SQLite + chamada à IA). Sem dependências.
- `index.html`: o app (funciona sozinho, com 8 questões embutidas, se aberto sem o servidor).
- `seed.json`: questões iniciais, carregadas no banco na primeira execução.

## Rodar no seu computador (Node 22.5 ou mais novo)

    ANTHROPIC_API_KEY=sua_chave GENERATE_PASSWORD=senha-do-professor node server.js

Abra http://localhost:3000. No Windows (PowerShell): `$env:ANTHROPIC_API_KEY="sua_chave"; node server.js`.

## Variáveis de ambiente

| Nome | Para que serve |
|---|---|
| `ANTHROPIC_API_KEY` | Chave da API (console.anthropic.com). Sem ela, o painel de IA não aparece. |
| `GENERATE_PASSWORD` | Senha para gerar questões. Recomendado, para ninguém gastar seu crédito. |
| `ANTHROPIC_MODEL` | Opcional. Padrão: `claude-sonnet-5-5`. |
| `DB_PATH` | Opcional. Caminho do arquivo do banco (use o de um disco persistente). |

## Publicar online

1. Crie um repositório no GitHub e envie estes arquivos. **Nunca** coloque a chave no código.
2. Em render.com (ou Railway/Fly.io): New > Web Service > escolha o repositório.
   Start command: `npm start`. Cadastre as variáveis acima.
3. O GitHub Pages hospeda só arquivos estáticos: lá o app abre, mas sem IA, banco e ranking.

## Limitações conhecidas

- **Persistência:** no plano gratuito do Render o disco é apagado a cada reinício, então as questões geradas e o ranking somem. Use um volume persistente (Railway, Fly.io ou disco do Render) e aponte `DB_PATH` para ele.
- **Ranking sem login:** cada navegador se identifica por um código aleatório, e o XP é enviado pelo próprio navegador, então dá para trapacear. Para valer nota ou prêmio, adicione autenticação.
- **Progresso do aluno** (respostas, conquistas) fica no navegador dele, não no servidor.
- **Questões de IA** podem ter gabarito ou explicação errados. Revise antes de usar (vêm marcadas como "IA (revisar)").
