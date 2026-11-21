import { spawn } from "node:child_process";
import playwright from "/tmp/pw/node_modules/playwright-core/index.js";

const root = new URL("..", import.meta.url).pathname;
const nodeBin = `${process.env.HOME}/.nvm/versions/node/v26.13.1/bin`;
const envBase = { ...process.env, PATH: `${nodeBin}:${process.env.PATH}` };

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...envBase, ...env },
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${code}`))));
  });
}

function startPreview() {
  const child = spawn(
    "pnpm",
    ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "4174", "--strictPort"],
    { cwd: root, env: envBase, stdio: "pipe" },
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("preview did not start")), 20000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("4174")) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("exit", (code) => reject(new Error(`preview exited ${code}`)));
  });
}

const { chromium } = playwright;
await run("pnpm", ["build"], { VITE_BUILD_ID: "a" });
const preview = await startPreview();
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4174/quest-checkin/");
  await page.waitForTimeout(800);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const first = await page.evaluate(() => document.documentElement.dataset.build);
  if (first !== "a") throw new Error(`first build was ${first}`);
  await run("pnpm", ["build"], { VITE_BUILD_ID: "b" });
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });
  await page.getByText("有新版本可用").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "立即更新" }).click();
  await page.waitForFunction(() => document.documentElement.dataset.build === "b");
  console.log("PWA update prompt works");
} finally {
  await browser.close();
  preview.kill("SIGTERM");
  preview.unref();
}
