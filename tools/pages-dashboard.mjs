#!/usr/bin/env node
// Lists all your GitHub repos, checks which have GitHub Pages enabled,
// and writes a clean dashboard (deployments.md + deployments.html).
//
// Usage:
//   GITHUB_TOKEN=xxx node tools/pages-dashboard.mjs            # your own repos (incl. private)
//   node tools/pages-dashboard.mjs <username>                  # public repos of a user
//   node tools/pages-dashboard.mjs --out ./dist                # output directory (default: .)
//
// Token: falls back to `gh auth token` if GITHUB_TOKEN is not set.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args.splice(outIdx, 2)[1] : ".";
const username = args[0];

let token = process.env.GITHUB_TOKEN;
if (!token) {
  try {
    token = execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {}
}
if (!token && !username) {
  console.error("Set GITHUB_TOKEN (or run `gh auth login`), or pass a username.");
  process.exit(1);
}

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token && { Authorization: `Bearer ${token}` }),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (res.status === 404) return null;
  if (res.status === 401) {
    console.error("401: bad or missing token. Set a valid GITHUB_TOKEN or run `gh auth login`.");
    process.exit(1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json();
}

async function allRepos() {
  const base = username
    ? `/users/${username}/repos?per_page=100`
    : `/user/repos?per_page=100&affiliation=owner`;
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await api(`${base}&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) return repos;
  }
}

const esc = (s = "") => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const repos = (await allRepos()).filter((r) => !r.archived && !r.fork);

// Check Pages with limited concurrency.
const rows = [];
let i = 0;
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (i < repos.length) {
      const r = repos[i++];
      let live = null;
      if (r.has_pages) {
        const pages = await api(`/repos/${r.full_name}/pages`).catch(() => null);
        live = pages?.html_url ?? null;
      }
      rows.push({
        name: r.name,
        repo: r.html_url,
        live: live ?? (r.homepage || null),
        source: live ? "Pages" : r.homepage ? "Homepage" : null,
        description: r.description ?? "",
        updated: r.pushed_at?.slice(0, 10) ?? "",
        private: r.private,
      });
    }
  }),
);

rows.sort((a, b) => Number(!!b.live) - Number(!!a.live) || b.updated.localeCompare(a.updated));
const deployed = rows.filter((r) => r.live);

const md = [
  "# My Deployments",
  "",
  `_${deployed.length} live of ${rows.length} repos · generated ${new Date().toISOString().slice(0, 10)}_`,
  "",
  "| Project | Live | Source | Description | Last push |",
  "|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| [${r.name}](${r.repo})${r.private ? " 🔒" : ""} | ${r.live ? `[open](${r.live})` : "—"} | ${r.source ?? ""} | ${r.description.replace(/\|/g, "\\|")} | ${r.updated} |`,
  ),
  "",
].join("\n");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>My Deployments</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1f2328;--muted:#656d76;--line:#d0d7de;--accent:#0969da}
@media(prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8d96a0;--line:#30363d;--accent:#4493f8}}
body{font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg);max-width:960px;margin:0 auto;padding:24px 16px}
input{width:100%;padding:8px 12px;font:inherit;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
.card{border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:12px 0;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.card h3{margin:0}.muted{color:var(--muted);font-size:14px}a{color:var(--accent)}
.live{font-weight:600}
</style></head><body>
<h1>My Deployments</h1>
<p class="muted">${deployed.length} live of ${rows.length} repos · generated ${new Date().toISOString().slice(0, 10)}</p>
<input id="q" placeholder="Search…" autofocus>
<div id="list">
${rows
  .map(
    (r) => `<div class="card" data-s="${esc((r.name + " " + r.description).toLowerCase())}">
<div><h3><a href="${esc(r.repo)}">${esc(r.name)}</a>${r.private ? " 🔒" : ""}</h3>
<div class="muted">${esc(r.description)}</div><div class="muted">Last push ${r.updated}</div></div>
<div>${r.live ? `<a class="live" href="${esc(r.live)}">Live ↗</a>` : '<span class="muted">not deployed</span>'}</div></div>`,
  )
  .join("\n")}
</div>
<script>
q.oninput=()=>{const v=q.value.toLowerCase();for(const c of list.children)c.hidden=!c.dataset.s.includes(v)}
</script></body></html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "deployments.md"), md);
writeFileSync(join(outDir, "deployments.html"), html);

console.table(deployed.map((r) => ({ name: r.name, live: r.live })));
console.log(`\nWrote ${join(outDir, "deployments.md")} and ${join(outDir, "deployments.html")}`);
