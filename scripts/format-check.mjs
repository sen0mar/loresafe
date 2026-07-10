import { execFileSync, spawnSync } from "node:child_process";

const supportedExtensionPattern =
  /\.(?:css|html|js|json|jsx|md|mjs|ts|tsx|ya?ml)$/;
const ignoredPathPattern =
  /^(?:apps\/api\/(?:openapi\/openapi\.json|src\/generated\/)|context\/images\/|extra\/|pnpm-lock\.yaml$)/;

const runGit = (args) =>
  execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .map((filePath) => filePath.trim())
    .filter(Boolean);

const getBaseRef = () => {
  if (process.env.FORMAT_BASE_REF) {
    return process.env.FORMAT_BASE_REF;
  }

  try {
    return execFileSync("git", ["merge-base", "origin/main", "HEAD"], {
      encoding: "utf8"
    }).trim();
  } catch {
    return "HEAD";
  }
};

const changedFiles = runGit([
  "diff",
  "--name-only",
  "--diff-filter=ACMR",
  getBaseRef()
]);
const untrackedFiles = runGit(["ls-files", "--others", "--exclude-standard"]);
const filesToCheck = [...new Set([...changedFiles, ...untrackedFiles])].filter(
  (filePath) =>
    supportedExtensionPattern.test(filePath) &&
    !ignoredPathPattern.test(filePath)
);

if (filesToCheck.length === 0) {
  console.log("No changed files require a formatting check.");
  process.exit(0);
}

const prettierResult = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "prettier", "--check", ...filesToCheck],
  { stdio: "inherit" }
);

process.exit(prettierResult.status ?? 1);
