#!/usr/bin/env node
// Buscador de skills: procura nas skills deste repo, nas já instaladas e no catálogo skills.sh,
// e instala a escolhida no Claude Code.
//
//   node scripts/skill-finder.mjs buscar <termo ou comando>   [--json] [--limite 10]
//   node scripts/skill-finder.mjs instalar <owner/repo@skill> [-g]
//   node scripts/skill-finder.mjs instaladas
//
// Termos em português são traduzidos para a busca no skills.sh (ex.: "editar vídeo" -> "video editing").

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_DIRS = [
  ["repo", join(REPO, "skills")],
  ["instalada (projeto)", join(process.cwd(), ".claude", "skills")],
  ["instalada (global)", join(homedir(), ".claude", "skills")],
];

// Comandos/palavras em PT-BR -> termos que o catálogo entende.
const ALIASES = {
  "editar": "editing", "edição": "editing", "edicao": "editing", "vídeo": "video", "video": "video",
  "legenda": "captions subtitles", "legendas": "captions subtitles", "corte": "cut clips", "cortes": "clips",
  "roteiro": "script", "roteiros": "script", "gancho": "hook", "ganchos": "hooks",
  "anúncio": "ads", "anuncio": "ads", "anúncios": "ads", "anuncios": "ads", "tráfego": "paid ads", "trafego": "paid ads",
  "criativo": "ad creative", "criativos": "ad creative", "copy": "copywriting",
  "página": "landing page", "pagina": "landing page", "conversão": "cro conversion", "conversao": "cro conversion",
  "planilha": "xlsx spreadsheet", "apresentação": "pptx slides", "apresentacao": "pptx slides",
  "imagem": "image", "imagens": "images", "miniatura": "thumbnail", "capa": "thumbnail cover",
  "tradução": "translate", "traducao": "translate", "traduzir": "translate", "voz": "voice tts",
  "música": "music", "musica": "music", "publicar": "publish social", "postar": "publish social",
  "email": "email", "e-mail": "email", "automação": "automation", "automacao": "automation",
  "banco": "database", "dados": "data analytics", "relatório": "report", "relatorio": "report",
  "site": "website", "design": "design", "marca": "brand", "pesquisa": "research", "concorrentes": "competitors",
  "whatsapp": "whatsapp", "instagram": "instagram", "tiktok": "tiktok", "youtube": "youtube",
};

const STOP = new Set(["de", "da", "do", "das", "dos", "para", "pra", "um", "uma", "o", "a", "os", "as", "e", "em", "no", "na", "com", "que", "quero", "preciso", "skill", "skills", "fazer", "meu", "minha"]);

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function translate(query) {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w && !STOP.has(w));
  const out = [];
  for (const w of words) out.push(ALIASES[w] ?? ALIASES[norm(w)] ?? w);
  return [...new Set(out.join(" ").split(" "))].join(" ");
}

function readSkill(dir, name) {
  const file = join(dir, name, "SKILL.md");
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  const desc = fm.match(/^description:\s*"?(.*?)"?\s*$/m)?.[1] ?? "";
  return { name: fm.match(/^name:\s*(.*)$/m)?.[1]?.trim() || name, description: desc };
}

function localSkills() {
  const seen = new Map();
  for (const [origin, dir] of LOCAL_DIRS) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const s = readSkill(dir, entry);
      if (!s) continue;
      const prev = seen.get(s.name);
      if (prev) { if (!prev.origins.includes(origin)) prev.origins.push(origin); continue; }
      seen.set(s.name, { ...s, origins: [origin], path: join(dir, entry) });
    }
  }
  return [...seen.values()];
}

function score(skill, terms) {
  const name = norm(skill.name), desc = norm(skill.description);
  let s = 0, hits = 0;
  for (const t of terms) {
    if (t.length < 2) continue;
    const inName = name.includes(t), inDesc = desc.includes(t);
    if (inName) s += 3;
    if (inDesc) s += 1;
    if (inName || inDesc) hits++;
  }
  return hits ? s + hits * 3 : 0; // quem cobre mais termos do pedido sobe
}

function remoteSearch(query) {
  try {
    const raw = execFileSync("npx", ["-y", "skills", "find", query], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 90_000,
    });
    const text = raw.replace(/\x1b\[[0-9;]*m/g, "");
    const out = [];
    const re = /^([\w.-]+\/[\w.-]+@[\w.:-]+)\s+([\d.,]+[KM]?) installs\s*\n└\s*(\S+)/gm;
    for (const m of text.matchAll(re)) out.push({ id: m[1], installs: m[2], url: m[3] });
    return out;
  } catch (e) {
    return { error: (e.stderr || e.message || "").toString().split("\n")[0] };
  }
}

const args = process.argv.slice(2);
const cmd = args.shift();
const flag = (f) => { const i = args.indexOf(f); if (i < 0) return false; args.splice(i, 1); return true; };
const opt = (f, d) => { const i = args.indexOf(f); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };

if (cmd === "buscar" || cmd === "search") {
  const json = flag("--json");
  const limit = Number(opt("--limite", opt("--limit", 10)));
  const query = args.join(" ").trim();
  if (!query) { console.error("Uso: buscar <termo ou comando>"); process.exit(1); }
  const translated = translate(query);
  const terms = [...new Set([...norm(query).split(/\s+/), ...norm(translated).split(/\s+/)])].filter((t) => !STOP.has(t));

  const local = localSkills()
    .map((s) => ({ ...s, score: score(s, terms) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const remote = remoteSearch(translated);
  const remoteList = Array.isArray(remote) ? remote.slice(0, limit) : [];

  if (json) {
    console.log(JSON.stringify({ query, translated, local, remote: remoteList, remoteError: remote.error ?? null }, null, 2));
    process.exit(0);
  }
  console.log(`\nBusca: "${query}"  →  catálogo: "${translated}"\n`);
  console.log("── Já disponíveis (não precisa instalar) ──");
  if (!local.length) console.log("  nenhuma");
  for (const s of local) console.log(`  /${s.name}  [${s.origins.join(", ")}]\n     ${s.description.slice(0, 140)}`);
  console.log("\n── No catálogo skills.sh (instaláveis) ──");
  if (remote.error) console.log(`  erro na busca: ${remote.error}`);
  else if (!remoteList.length) console.log("  nenhuma");
  remoteList.forEach((r, i) => console.log(`  ${i + 1}. ${r.id}  (${r.installs} instalações)\n     ${r.url}`));
  if (remoteList.length) console.log(`\nInstalar: node scripts/skill-finder.mjs instalar ${remoteList[0].id}   (-g para todos os projetos)`);
} else if (cmd === "instalar" || cmd === "install") {
  const global = flag("-g") || flag("--global");
  const id = args[0];
  const m = id?.match(/^([\w.-]+\/[\w.-]+)@([\w.:-]+)$/);
  if (!m) { console.error("Uso: instalar <owner/repo@skill> [-g]"); process.exit(1); }
  const cliArgs = ["-y", "skills", "add", m[1], "-s", m[2], "-a", "claude-code", "-y", ...(global ? ["-g"] : [])];
  console.log(`> npx ${cliArgs.join(" ")}`);
  execFileSync("npx", cliArgs, { stdio: "inherit" });
  console.log(`\nPronto: /${m[2]} instalada ${global ? "globalmente" : "neste projeto"}. Reinicie a sessão do Claude Code se ela não aparecer.`);
} else if (cmd === "instaladas" || cmd === "list") {
  for (const s of localSkills()) console.log(`/${s.name}  [${s.origins.join(", ")}]`);
} else {
  console.log(`Buscador de skills
  buscar <termo ou comando> [--json] [--limite N]   procura nas skills locais e no skills.sh
  instalar <owner/repo@skill> [-g]                   instala no Claude Code (projeto, ou global com -g)
  instaladas                                         lista o que já está disponível`);
}
