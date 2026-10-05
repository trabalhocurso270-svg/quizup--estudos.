// QuizUp Estudos: um único servidor com site + API + banco SQLite + gerador de questões com IA.
// Sem dependências externas (Node 22.5+).
const http = require("http"), fs = require("fs"), path = require("path");
const { DatabaseSync } = require("node:sqlite");
const PORT = process.env.PORT || 3000;
const KEY = process.env.ANTHROPIC_API_KEY;                       // chave da API (nunca vai para o navegador)
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const PASS = process.env.GENERATE_PASSWORD || "";                // opcional: protege a geração de questões
const DISC = ["Matemática","Português","Redação","Física","Química","Biologia","História","Geografia","Filosofia/Sociologia","Inglês"];

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, "quizup.db"));
db.exec(`CREATE TABLE IF NOT EXISTS questions(id INTEGER PRIMARY KEY AUTOINCREMENT,d TEXT,t TEXT,f TEXT,g TEXT,q TEXT,o TEXT,c INTEGER,e TEXT);
CREATE TABLE IF NOT EXISTS players(uid TEXT PRIMARY KEY,nome TEXT,xp INTEGER,at TEXT)`);
const ins = db.prepare("INSERT INTO questions(d,t,f,g,q,o,c,e) VALUES(?,?,?,?,?,?,?,?)");
const add = x => ins.run(x.d, x.t, x.f, x.g, x.q, JSON.stringify(x.o), x.c, x.e);
const list = () => db.prepare("SELECT * FROM questions ORDER BY id").all().map(r => ({ ...r, o: JSON.parse(r.o) }));
if (!db.prepare("SELECT COUNT(*) n FROM questions").get().n)
  JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8")).forEach(add);

const cl = s => String(s).replace(/[<>]/g, "").trim();            // evita HTML vindo da IA ou de usuários
let calls = [];                                                    // limite: 20 gerações por hora

async function gerar(d, assunto, f, n) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: "user", content:
`Você é professor(a) de ${d} e elabora questões para o ENEM. Crie ${n} questões ORIGINAIS de múltipla escolha (5 alternativas, só uma correta) sobre "${assunto}", dificuldade ${f}, em português do Brasil, com situação-problema no estilo ENEM. Não copie questões reais nem invente dados como se fossem oficiais. Varie a posição da alternativa correta. Responda SOMENTE com um array JSON, sem texto extra: [{"t":"subtópico curto","q":"enunciado","o":["A","B","C","D","E"],"c":0,"e":"explicação passo a passo"}] (c = índice da correta, de 0 a 4).` }] })
  });
  if (!r.ok) throw new Error("Falha ao falar com a IA (código " + r.status + ").");
  const j = await r.json(), txt = j.content.map(b => b.text || "").join("");
  const arr = JSON.parse(txt.slice(txt.indexOf("["), txt.lastIndexOf("]") + 1));
  return arr.filter(x => x && x.q && x.t && x.e && Array.isArray(x.o) && x.o.length === 5 && x.o.every(o => typeof o === "string") && Number.isInteger(x.c) && x.c >= 0 && x.c < 5)
    .slice(0, n).map(x => ({ d, t: cl(x.t).slice(0, 80), f, g: "IA (revisar)", q: cl(x.q), o: x.o.map(cl), c: x.c, e: cl(x.e) }));
}

const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(ok => { let b = ""; req.on("data", c => { b += c; if (b.length > 1e5) req.destroy(); }); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { ok({}); } }); });

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x"), u = url.pathname;
    if (req.method === "GET" && (u === "/" || u === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(path.join(__dirname, "index.html")));
    }
    if (u === "/api/status") return send(res, 200, { ia: !!KEY, senha: !!PASS });
    if (u === "/api/questions") return send(res, 200, list());
    if (u === "/api/ranking") {
      const me = url.searchParams.get("uid");
      return send(res, 200, db.prepare("SELECT uid,nome,xp FROM players ORDER BY xp DESC LIMIT 20").all().map(p => ({ nome: p.nome, xp: p.xp, eu: p.uid === me })));
    }
    if (u === "/api/score" && req.method === "POST") {
      const b = await body(req), uid = String(b.uid || "").slice(0, 60), nome = cl(b.nome || "").slice(0, 40), xp = Math.max(0, Math.min(1e6, +b.xp || 0));
      if (!uid || !nome) return send(res, 400, { erro: "Dados inválidos." });
      db.prepare("INSERT INTO players(uid,nome,xp,at) VALUES(?,?,?,?) ON CONFLICT(uid) DO UPDATE SET nome=excluded.nome,xp=excluded.xp,at=excluded.at").run(uid, nome, xp, new Date().toISOString());
      return send(res, 200, { ok: 1 });
    }
    if (u === "/api/generate" && req.method === "POST") {
      const b = await body(req);
      if (!KEY) return send(res, 503, { erro: "IA não configurada (falta ANTHROPIC_API_KEY)." });
      if (PASS && b.senha !== PASS) return send(res, 401, { erro: "Senha incorreta." });
      const now = Date.now(); calls = calls.filter(t => now - t < 36e5);
      if (calls.length >= 20) return send(res, 429, { erro: "Limite de gerações por hora atingido. Tente mais tarde." });
      const d = String(b.d), f = String(b.f), n = Math.min(5, Math.max(1, +b.n || 3)), a = cl(b.assunto || "").slice(0, 100);
      if (!DISC.includes(d) || !["Fácil", "Média", "Difícil"].includes(f) || !a) return send(res, 400, { erro: "Escolha disciplina, assunto e dificuldade." });
      calls.push(now);
      const qs = await gerar(d, a, f, n);
      if (!qs.length) return send(res, 502, { erro: "A IA não devolveu questões válidas. Tente de novo." });
      qs.forEach(add);
      return send(res, 200, { criadas: qs.length, questoes: list() });
    }
    send(res, 404, { erro: "Não encontrado." });
  } catch (e) { send(res, 500, { erro: e.message }); }
}).listen(PORT, () => console.log("QuizUp no ar: http://localhost:" + PORT));
