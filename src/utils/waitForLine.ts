import * as readline from "node:readline";

/** Waits for Enter without leaving `stdin` in flowing mode (fixes Git Bash / Windows shell not returning a prompt). */
export function waitForLine(): Promise<void> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.once("line", () => {
      rl.close();
      resolve();
    });
  });
}
