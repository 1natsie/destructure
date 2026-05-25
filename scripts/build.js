/// <reference types="node" />

import { execFileSync, spawnSync } from "node:child_process";
import { access, glob, mkdir, rm, watch } from "node:fs/promises";
import path from "node:path";

const rootPath = path.resolve(import.meta.dirname, "..");
const tsgoPath = path.resolve(
  rootPath,
  `node_modules/.bin/tsgo${process.platform === "win32" ? ".exe" : ""}`,
);

const hasTsgo = await access(tsgoPath)
  .then(() => true)
  .catch(() => false);

const runTsgo = async () => {
  execFileSync(tsgoPath, { cwd: rootPath, stdio: "inherit" });
  return null;
};

const runTsc = async () => {
  const isBun = process.isBun;
  isBun
    ? spawnSync("bun", ["run", "./node_modules/typescript/lib/tsc.js"], {
        cwd: rootPath,
        stdio: "inherit",
      })
    : spawnSync("node", ["./node_modules/typescript/lib/tsc.js"], {
        cwd: rootPath,
        stdio: "inherit",
      });
  return null;
};

export const buildOnce = async () => {
  console.log(`Starting build process.`);

  console.log(`Cleaning up previous build artefacts.`);
  await rm("./dist", { recursive: true, force: true });

  console.log(`Creating dist directory.`);
  await mkdir("./dist", { recursive: true });

  console.log(`Building with ${hasTsgo ? "tsgo" : "tsc"}.`);
  const startTime = performance.now();
  await (hasTsgo ? runTsgo() : runTsc());

  console.log(`Build complete in ${performance.now() - startTime}ms.`);
  return null;
};

export const build = async (watchMode = false) => {
  if (!watchMode) return buildOnce();

  await buildOnce();
  for await (const _event of watch(path.resolve(rootPath, "src"), {
    persistent: true,
    recursive: true,
    maxQueue: 1,
    overflow: "ignore",
  })) {
    process.stdout.write("\x1Bc");
    await buildOnce();
  }

  return null;
};

if (import.meta.main) await build();
