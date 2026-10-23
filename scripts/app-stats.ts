// Counts the Claude tokens and the commits for each app and writes
// _data/stats.yml, which the home page and the app pages show.
//
// Tokens: Claude Code keeps a log of every session in ~/.claude/projects.
// Each reply in it carries its token usage and the folder the session ran
// in, and that folder says which app the reply was for. Claude Code deletes
// logs after cleanupPeriodDays (30 by default), so run this at least once a
// month: a token count never goes below the one written before.
//
// Commits: every commit on every branch of the app's repositories, each
// commit once.
//
//   bun scripts/app-stats.ts
//
// With --publish it also commits _data/stats.yml and pushes it, so the site
// stays current on its own. A Stop hook in ~/.claude/settings.json runs it
// that way after each Claude reply; it then does the work at most every 15
// minutes, and only on main.
//
//   bun scripts/app-stats.ts --publish

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const development = join(homedir(), "development");
const site = join(import.meta.dir, "..");
const publish = process.argv.includes("--publish");
const message = "Update the Claude tokens and commits";

function git(...args: string[]) {
  const run = Bun.spawnSync(["git", "-C", site, ...args]);
  return { ok: run.exitCode === 0, out: run.stdout.toString().trim() };
}

if (publish) {
  // The time of the last run, which also keeps two sessions from running
  // this at once.
  const stamp = join(site, ".git", "app-stats-published");
  const last = await stat(stamp).then((s) => s.mtimeMs).catch(() => 0);
  if (Date.now() - last < 15 * 60_000) process.exit(0);
  // A branch, a rebase or a merge in progress is work of its own: leave it.
  if (git("symbolic-ref", "--short", "-q", "HEAD").out !== "main") process.exit(0);
  await writeFile(stamp, "");
}

// Per app: the folders its sessions ran in, and its repositories.
const apps: Record<string, { folders: RegExp[]; repos: string[] }> = {
  plopp: {
    folders: [/\/development\/bubble-wrap-app(\/|$)/],
    repos: ["bubble-wrap-app"],
  },
  grammgenau: {
    folders: [/\/development\/grammgenau(\/|$)/],
    repos: ["grammgenau"],
  },
  movenote: {
    folders: [/\/development\/workout-tracker[^/]*(\/|$)/, /\/\.t3\/worktrees\/workout-tracker(\/|$)/],
    repos: ["workout-tracker", "workout-tracker-server"],
  },
  "pubg-stream-report": {
    folders: [/\/development\/pubg-[^/]*(\/|$)/],
    repos: ["pubg-streamer-encounters", "pubg-stream-report-legal"],
  },
};

const out = join(site, "_data", "stats.yml");
const slugs = Object.keys(apps);

async function* logs(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* logs(path);
    else if (entry.name.endsWith(".jsonl")) yield path;
  }
}

function appOf(cwd: string): string | undefined {
  const path = cwd.replaceAll("\\", "/").toLowerCase();
  return slugs.find((slug) => apps[slug].folders.some((re) => re.test(path)));
}

async function countTokens(): Promise<Record<string, number>> {
  const totals: Record<string, number> = Object.fromEntries(slugs.map((slug) => [slug, 0]));
  // A reply is logged once per content block, each time with the same usage.
  const seen = new Set<string>();
  for await (const file of logs(join(homedir(), ".claude", "projects"))) {
    for (const line of (await readFile(file, "utf8")).split("\n")) {
      if (!line.includes('"usage"')) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const usage = entry.message?.usage;
      const slug = entry.cwd && appOf(entry.cwd);
      if (entry.type !== "assistant" || !usage || !slug) continue;
      const id = `${entry.message.id}:${entry.requestId}`;
      if (seen.has(id)) continue;
      seen.add(id);
      totals[slug] +=
        (usage.input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0) +
        (usage.output_tokens ?? 0);
    }
  }
  return totals;
}

async function countCommits(repos: string[]): Promise<number> {
  const hashes = new Set<string>();
  for (const repo of repos) {
    const git = Bun.spawnSync(["git", "-C", join(development, repo), "rev-list", "--all"]);
    if (git.exitCode !== 0) throw new Error(`git rev-list failed in ${repo}: ${git.stderr}`);
    for (const hash of git.stdout.toString().split("\n")) if (hash) hashes.add(hash);
  }
  return hashes.size;
}

// "1,2 Mrd." or "345 Mio.", as the page shows it.
function label(n: number): string {
  const [value, unit] = n >= 1e9 ? [n / 1e9, "Mrd."] : [n / 1e6, "Mio."];
  const digits = value < 10 ? 1 : 0;
  return `${value.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${unit}`;
}

const tokens = await countTokens();
const before = await readFile(out, "utf8").catch(() => "");
for (const slug of slugs) {
  const old = Number(before.match(new RegExp(`^  ${slug}:\\n    tokens: (\\d+)`, "m"))?.[1] ?? 0);
  tokens[slug] = Math.max(tokens[slug], old);
}

const commits: Record<string, number> = {};
for (const slug of slugs) commits[slug] = await countCommits(apps[slug].repos);

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);
const yml = [
  "# Written by scripts/app-stats.ts. Run it again rather than editing this.",
  `updated: ${new Date().toISOString().slice(0, 10)}`,
  `tokens: ${sum(tokens)}`,
  `tokens_label: "${label(sum(tokens))}"`,
  `commits: ${sum(commits)}`,
  `commits_label: "${sum(commits).toLocaleString("de-DE")}"`,
  "apps:",
  ...slugs.flatMap((slug) => [
    `  ${slug}:`,
    `    tokens: ${tokens[slug]}`,
    `    tokens_label: "${label(tokens[slug])}"`,
    `    commits: ${commits[slug]}`,
    `    commits_label: "${commits[slug].toLocaleString("de-DE")}"`,
  ]),
  "",
].join("\n");

// A new day alone is no news: "Stand" on the page is the day the numbers
// last changed.
const withoutDate = (text: string) => text.replace(/^updated: .*$/m, "");
if (withoutDate(yml) !== withoutDate(before)) await writeFile(out, yml);
console.log(yml);

if (publish) {
  if (git("status", "--porcelain", "--", "_data/stats.yml").out) {
    git("commit", "-q", "-m", message, "--", "_data/stats.yml");
  }
  // Push only commits of this script, never work that is not pushed yet.
  const ahead = git("log", "origin/main..HEAD", "--format=%s").out;
  if (ahead && ahead.split("\n").every((subject) => subject === message)) {
    git("push", "-q", "origin", "main");
  }
}
