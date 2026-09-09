#!/usr/bin/env node
import { FileCredentialVault } from "./store.js";

async function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stderr.isTTY || !process.stdin.setRawMode) {
    throw new Error("Protected entry requires an interactive terminal.");
  }
  process.stderr.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stderr.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") return finish(new Error("Protected entry cancelled."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (value.length < 256) value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const dataDirectory = process.env.BYOAG_DATA_DIR;
  if (!dataDirectory) throw new Error("BYOAG_DATA_DIR is required.");
  const code = await readHidden("Pairing code: ");
  const reference = await new FileCredentialVault(dataDirectory).storeOneTimeSecret(code);
  process.stdout.write(`${reference}\n`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Protected entry failed.");
  process.exitCode = 1;
});
