import { spawn } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;

async function loadChromium() {
  const spec = process.env.PLAYWRIGHT_CORE;
  if (spec) return (await import(spec)).chromium;
  return (await import("playwright-core")).chromium;
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${code}`))));
  });
}

function startPreview() {
  const child = spawn(
    "pnpm",
    ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "4174", "--strictPort"],
    { cwd: root, env: process.env, stdio: "pipe" },
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

const chromium = await loadChromium();
await run("pnpm", ["build"], { VITE_BUILD_ID: "a" });
const preview = await startPreview();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  channel: process.env.CHROME_PATH ? undefined : "chrome",
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
  await page.reload();
  await page.getByText("有新版本可用").waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "立即更新" }).click();
  await page.waitForFunction(() => document.documentElement.dataset.build === "b");
  console.log("PWA update prompt works");
} finally {
  await browser.close();
  preview.kill("SIGTERM");
  preview.unref();
}
