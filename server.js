// QuizUp Estudos: um único servidor com site + API + banco MongoDB Atlas + gerador de questões com IA (Google Gemini, plano gratuito).
// Única dependência: o driver oficial 'mongodb'.
const http = require("http"), fs = require("fs"), path = require("path");
const { MongoClient } = require("mongodb");
const PORT = process.env.PORT || 3000;
const KEY = process.env.GEMINI_API_KEY;                          // chave do Google AI Studio (nunca vai para o navegador)
let MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";   // pode trocar pela variável GEMINI_MODEL
const G = "https://generativelanguage.googleapis.com/v1beta/";
const PASS = process.env.GENERATE_PASSWORD || "";                // opcional: protege a geração de questões
const DISC = ["Matemática","Português","Redação","Física","Química","Biologia","História","Geografia","Filosofia/Sociologia","Inglês"];

const URI = process.env.MONGODB_URI;                               // string de conexão do MongoDB Atlas
if (!URI) { console.error("Falta a variável MONGODB_URI."); process.exit(1); }
let Qs, Pl, Ct;
const list = () => Qs.find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
async function add(arr) {                                          // grava questões com id numérico sequencial
  const n = (await Ct.findOneAndUpdate({ _id: "q" }, { $inc: { n: arr.length } }, { upsert: true, returnDocument: "after" })).n;
  await Qs.insertMany(arr.map((x, i) => ({ id: n - arr.length + 1 + i, d: x.d, t: x.t, f: x.f, g: x.g, q: x.q, o: x.o, c: x.c, e: x.e })));
}
async function init() {
  const cli = await new MongoClient(URI).connect(), db = cli.db(process.env.MONGODB_DB || "quizup");
  Qs = db.collection("questions"); Pl = db.collection("players"); Ct = db.collection("counters");
  await Qs.createIndex({ id: 1 }, { unique: true }); await Pl.createIndex({ xp: -1 });
  if (!(await Qs.countDocuments())) await add(JSON.parse(fs.readFileSync(path.join(__dirname, "seed.json"), "utf8")));
}

const cl = s => String(s).replace(/[<>]/g, "").trim();            // evita HTML vindo da IA ou de usuários
let calls = [];                                                    // limite: 20 gerações por hora

const chamar = prompt => fetch(G + "models/" + MODEL + ":generateContent", {
  method: "POST",
  headers: { "content-type": "application/json", "x-goog-api-key": KEY },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.8 } })
});

async function gerar(d, assunto, f, n) {
  const prompt = `Você é professor(a) de ${d} e elabora questões para o ENEM. Crie ${n} questões ORIGINAIS de múltipla escolha (5 alternativas, só uma correta) sobre "${assunto}", dificuldade ${f}, em português do Brasil, com situação-problema no estilo ENEM. Não copie questões reais nem invente dados como se fossem oficiais. Varie a posição da alternativa correta. Responda SOMENTE com um array JSON, sem texto extra: [{"t":"subtópico curto","q":"enunciado","o":["A","B","C","D","E"],"c":0,"e":"explicação passo a passo"}] (c = índice da correta, de 0 a 4).`;
  let r = await chamar(prompt);
  if (r.status === 404 && !process.env.GEMINI_MODEL) {             // modelo padrão saiu do ar: escolhe um Flash disponível
    const m = await (await fetch(G + "models?pageSize=200", { headers: { "x-goog-api-key": KEY } })).json();
    const ok = (m.models || []).find(x => /flash/.test(x.name) && !/lite|image|tts|live|audio/.test(x.name) && (x.supportedGenerationMethods || []).includes("generateContent"));
    if (ok) { MODEL = ok.name.replace("models/", ""); r = await chamar(prompt); }
  }
  if (r.status === 429) throw new Error("Limite gratuito da IA atingido. Espere um minuto e tente de novo.");
  if (!r.ok) throw new Error("Falha na IA (código " + r.status + "). Confira GEMINI_API_KEY e GEMINI_MODEL.");
  const j = await r.json(), txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
  const arr = JSON.parse(txt.slice(txt.indexOf("["), txt.lastIndexOf("]") + 1));
  return arr.filter(x => x && x.q && x.t && x.e && Array.isArray(x.o) && x.o.length === 5 && x.o.every(o => typeof o === "string") && Number.isInteger(x.c) && x.c >= 0 && x.c < 5)
    .slice(0, n).map(x => ({ d, t: cl(x.t).slice(0, 80), f, g: "IA (revisar)", q: cl(x.q), o: x.o.map(cl), c: x.c, e: cl(x.e) }));
}

const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(ok => { let b = ""; req.on("data", c => { b += c; if (b.length > 1e5) req.destroy(); }); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch { ok({}); } }); });

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x"), u = url.pathname;
    if (req.method === "GET" && (u === "/" || u === "/index.html")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(path.join(__dirname, "index.html")));
    }
    if (u === "/api/status") return send(res, 200, { ia: !!KEY, senha: !!PASS });
    if (u === "/api/questions") return send(res, 200, await list());
    if (u === "/api/ranking") {
      const me = url.searchParams.get("uid");
      return send(res, 200, (await Pl.find().sort({ xp: -1 }).limit(20).toArray()).map(p => ({ nome: p.nome, xp: p.xp, eu: p._id === me })));
    }
    if (u === "/api/score" && req.method === "POST") {
      const b = await body(req), uid = String(b.uid || "").slice(0, 60), nome = cl(b.nome || "").slice(0, 40), xp = Math.max(0, Math.min(1e6, +b.xp || 0));
      if (!uid || !nome) return send(res, 400, { erro: "Dados inválidos." });
      await Pl.updateOne({ _id: uid }, { $set: { nome, xp, at: new Date() } }, { upsert: true });
      return send(res, 200, { ok: 1 });
    }
    if (u === "/api/generate" && req.method === "POST") {
      const b = await body(req);
      if (!KEY) return send(res, 503, { erro: "IA não configurada (falta GEMINI_API_KEY)." });
      if (PASS && b.senha !== PASS) return send(res, 401, { erro: "Senha incorreta." });
      const now = Date.now(); calls = calls.filter(t => now - t < 36e5);
      if (calls.length >= 20) return send(res, 429, { erro: "Limite de gerações por hora atingido. Tente mais tarde." });
      const d = String(b.d), f = String(b.f), n = Math.min(5, Math.max(1, +b.n || 3)), a = cl(b.assunto || "").slice(0, 100);
      if (!DISC.includes(d) || !["Fácil", "Média", "Difícil"].includes(f) || !a) return send(res, 400, { erro: "Escolha disciplina, assunto e dificuldade." });
      calls.push(now);
      const qs = await gerar(d, a, f, n);
      if (!qs.length) return send(res, 502, { erro: "A IA não devolveu questões válidas. Tente de novo." });
      await add(qs);
      return send(res, 200, { criadas: qs.length, questoes: await list() });
    }
    send(res, 404, { erro: "Não encontrado." });
  } catch (e) { send(res, 500, { erro: e.message }); }
});
init().then(() => server.listen(PORT, () => console.log("QuizUp no ar na porta " + PORT)))
  .catch(e => { console.error("Erro ao conectar no MongoDB:", e.message); process.exit(1); });
