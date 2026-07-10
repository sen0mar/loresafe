import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { generateOpenApiDocument } from "../src/openapi/openapi.js";

const contractPath = resolve(process.cwd(), "openapi/openapi.json");
const generatedContract = `${JSON.stringify(generateOpenApiDocument(), null, 2)}\n`;

if (process.argv.includes("--write")) {
  await mkdir(resolve(process.cwd(), "openapi"), { recursive: true });
  await writeFile(contractPath, generatedContract, "utf8");
  console.log(`Wrote ${contractPath}`);
} else {
  const versionedContract = await readFile(contractPath, "utf8");

  if (versionedContract !== generatedContract) {
    throw new Error(
      "The versioned OpenAPI contract is stale. Run pnpm --filter @loresafe/api api:contract:generate."
    );
  }

  console.log("OpenAPI contract is current and generated from the registered Zod schemas.");
}
