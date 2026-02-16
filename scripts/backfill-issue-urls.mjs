import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT_DIR = join(import.meta.dirname, "..");
const SRC_DIR = join(ROOT_DIR, "src");

// Fetch all issues from GitHub (paginated)
console.log("Fetching issues from GitHub...");
const issuesRaw = execFileSync(
  "gh",
  [
    "api",
    "repos/xoundbyte/soul-over-ai/issues?state=all&per_page=100",
    "--paginate",
    "--jq",
    '.[] | select(.pull_request == null) | { title, url: .html_url }',
  ],
  { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
);

// Parse newline-delimited JSON objects
const issues = issuesRaw
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

console.log(`Fetched ${issues.length} issues.`);

// Build a map of spotifyId -> issue URL from titles like "Artist Name (spotifyId)"
const spotifyToIssue = new Map();
const spotifyIdPattern = /\(([a-zA-Z0-9]{22})\)\s*$/;

for (const issue of issues) {
  const match = issue.title.match(spotifyIdPattern);
  if (match) {
    const spotifyId = match[1];
    // Keep the first (newest / highest issue number) match
    if (!spotifyToIssue.has(spotifyId)) {
      spotifyToIssue.set(spotifyId, issue.url);
    }
  }
}

console.log(`Found ${spotifyToIssue.size} issues with Spotify IDs in title.`);

// Process artist files
const files = (await readdir(SRC_DIR)).filter((f) => f.endsWith(".json"));

let updated = 0;
let matched = 0;

for (const file of files) {
  const filePath = join(SRC_DIR, file);
  const raw = await readFile(filePath, "utf-8");
  const artist = JSON.parse(raw);

  if (!artist.spotify) continue;

  const issueUrl = spotifyToIssue.get(artist.spotify);
  if (!issueUrl) continue;

  matched++;

  if (artist.issue === issueUrl) continue;

  artist.issue = issueUrl;
  await writeFile(filePath, JSON.stringify(artist, null, 2) + "\n", "utf-8");
  updated++;
}

console.log(
  `Done. Matched ${matched} artists to issues, updated ${updated} files.`
);
