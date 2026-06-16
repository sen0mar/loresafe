import { spawn } from "node:child_process";

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const maxAttempts = parsePositiveInt(process.env.PRISMA_MIGRATE_DEPLOY_MAX_ATTEMPTS, 6);
const baseDelayMs = parsePositiveInt(process.env.PRISMA_MIGRATE_DEPLOY_RETRY_DELAY_MS, 5_000);
const maxDelayMs = parsePositiveInt(process.env.PRISMA_MIGRATE_DEPLOY_MAX_RETRY_DELAY_MS, 30_000);
const outputLimit = 20_000;

const sleep = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const appendOutput = (currentOutput, chunk) => {
  const nextOutput = `${currentOutput}${chunk}`;

  return nextOutput.length > outputLimit ? nextOutput.slice(-outputLimit) : nextOutput;
};

const isAdvisoryLockTimeout = (output) => {
  const normalizedOutput = output.toLowerCase();

  return (
    normalizedOutput.includes("p1002") &&
    normalizedOutput.includes("advisory lock")
  );
};

const runMigrateDeploy = () =>
  new Promise((resolve) => {
    const child = spawn("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      env: process.env,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output = appendOutput(output, text);
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output = appendOutput(output, text);
      process.stderr.write(text);
    });

    child.on("error", (error) => {
      process.stderr.write(`${error.message}\n`);
      resolve({ exitCode: 1, output: error.message });
    });

    child.on("close", (exitCode) => {
      resolve({ exitCode: exitCode ?? 1, output });
    });
  });

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const { exitCode, output } = await runMigrateDeploy();

  if (exitCode === 0) {
    process.exit(0);
  }

  if (!isAdvisoryLockTimeout(output) || attempt === maxAttempts) {
    process.exit(exitCode);
  }

  const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  process.stderr.write(
    `Prisma migrate deploy hit an advisory lock timeout. Retrying in ${Math.round(
      delayMs / 1000
    )}s (${attempt + 1}/${maxAttempts}).\n`
  );
  await sleep(delayMs);
}
