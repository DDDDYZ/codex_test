import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createServer } from "vite";

// Load the same TypeScript fixtures through Vite as the application does.
const fixtureLoader = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const { questionBank } = await fixtureLoader.ssrLoadModule(
  "/src/content/questions.ts",
);
await fixtureLoader.close();
const lessonIds = [...new Set(questionBank.map((q) => q.lessonId))];

const port = Number(process.env.FDL_TEST_PORT || 4197);
const base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk));
server.stderr.on("data", (chunk) => (serverLog += chunk));
let browser;
const errors = [];
const completed = [];
async function scenario(name, fn) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${name}: ${error.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${name}: ${msg.text()}`);
  });
  try {
    await fn(page, context);
    completed.push(name);
    console.log(`PASS ${name}`);
  } finally {
    await context.close();
  }
}
async function number(page, name, value) {
  const input = page.getByRole("spinbutton", { name, exact: true });
  await input.fill(String(value));
  await input.press("Enter");
}
async function go(page, path) {
  await page.goto(`${base}/#${path}`, { waitUntil: "networkidle" });
  if (path.startsWith("/lesson/")) {
    const id = path.split("/")[2];
    await page.locator(`.lesson-intro[data-lesson-id="${id}"]`).waitFor();
  } else if (path.startsWith("/practice")) {
    await page
      .getByRole("heading", { name: "在线答题", exact: true, level: 1 })
      .waitFor();
  }
}
async function answerCurrent(page, q, value = q.answer) {
  if (q.kind === "choice")
    await page.locator(".practice-options input").nth(Number(value)).check();
  else
    await page.getByRole("textbox", { name: /你的答案/ }).fill(String(value));
}
async function fillAttempt(page, questions) {
  for (let i = 0; i < questions.length; i++) {
    await page
      .getByRole("button", { name: new RegExp(`^第 ${i + 1} 题，`) })
      .click();
    await answerCurrent(page, questions[i]);
  }
  await page
    .getByRole("button", { name: "提交答卷", exact: true })
    .last()
    .click();
}
async function noOverflow(page) {
  // Recharts resizes through ResizeObserver after a viewport change.
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, undefined, { timeout: 5000 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `horizontal overflow at ${page.viewportSize().width}px`,
  );
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(serverLog);
    try {
      const r = await fetch(base);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error("Preview startup timeout: " + serverLog);
  const executablePath =
    process.env.FDL_CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-gl=angle",
      "--use-angle=swiftshader",
    ],
  });
  mkdirSync("test-results", { recursive: true });
  await scenario(
    "performance parameters, force diagrams, envelope and CSV",
    async (page) => {
      await go(page, "/lesson/dynamic-pressure");
      assert.equal(
        await page
          .getByRole("heading", {
            name: /动压：速度如何放大气动力/,
            level: 1,
          })
          .count(),
        1,
      );
      await number(page, "真空速 V数值", 100);
      assert.match(await page.locator(".perf-context").innerText(), /6125 Pa/);
      await page
        .getByRole("button", { name: "记录动压实验完成", exact: true })
        .click();
      assert.match(await page.locator(".lesson-task").innerText(), /已记录/);
      await page
        .getByRole("button", { name: "↺ 恢复默认", exact: true })
        .click();
      await number(page, "选定升力系数 CL 数值", 0.6742);
      assert.match(await page.locator(".perf-readouts").innerText(), /13.48/);
      await page
        .getByRole("button", { name: "记录实验任务完成", exact: true })
        .click();
      await page
        .getByRole("button", { name: "保存参数快照", exact: true })
        .click();
      await number(page, "零升阻力系数 CD₀数值", 0.04);
      assert.equal(await page.locator(".perf-comparison table").count(), 1);
      await page.getByRole("tab", { name: /平飞性能/ }).click();
      await page
        .getByRole("button", { name: "↺ 恢复默认", exact: true })
        .click();
      await number(page, "可用推力 T数值", 828.39);
      await page
        .getByRole("button", { name: "记录实验任务完成", exact: true })
        .click();
      await number(page, "真空速 V数值", 15);
      assert.match(
        await page.locator(".performance-lab").innerText(),
        /CL.*超过|失速/,
      );
      assert.equal(
        await page
          .getByRole("img", {
            name: "当前条件超出模型适用范围，已隐藏受力矢量",
            exact: true,
          })
          .count(),
        1,
      );
      await page.getByRole("tab", { name: /爬升与滑翔/ }).click();
      await page
        .getByRole("button", { name: "↺ 恢复默认", exact: true })
        .click();
      assert.match(await page.locator(".perf-readouts").innerText(), /4.96/);
      await page
        .getByRole("button", { name: "记录实验任务完成", exact: true })
        .click();
      await page
        .getByRole("button", { name: "无动力滑翔 · T = 0", exact: true })
        .click();
      assert.match(await page.locator(".perf-readouts").innerText(), /-/);
      const downloadPromise = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "导出曲线 CSV ↗", exact: true })
        .click();
      const download = await downloadPromise;
      await download.saveAs("test-results/glide.csv");
      const csv = readFileSync("test-results/glide.csv", "utf8")
        .trim()
        .split("\n");
      const fields = csv[0].split(",");
      const thrust = fields.indexOf("thrust_N"),
        power = fields.indexOf("available_power_kW");
      assert.ok(csv.length > 20);
      for (const line of csv.slice(1)) {
        const row = line.split(",");
        assert.equal(Number(row[thrust]), 0);
        assert.equal(Number(row[power]), 0);
      }
      await page.getByRole("tab", { name: /协调转弯/ }).click();
      await page
        .getByRole("button", { name: "↺ 恢复默认", exact: true })
        .click();
      await number(page, "倾斜角 φ数值", 60);
      assert.match(await page.locator(".perf-readouts").innerText(), /2.00/);
      await page
        .getByRole("button", { name: "记录实验任务完成", exact: true })
        .click();
      await number(page, "倾斜角 φ数值", 0);
      assert.match(
        await page.locator(".perf-diagram-footer").innerText(),
        /直线飞行/,
      );
      await number(page, "质量 m数值", 0);
      assert.match(await page.getByRole("alert").innerText(), /400–2000/);
      assert.equal(
        await page
          .getByRole("spinbutton", { name: "质量 m数值", exact: true })
          .inputValue(),
        "1000",
      );
      await page
        .getByRole("button", { name: "↺ 恢复默认", exact: true })
        .click();
      await page.screenshot({
        path: "test-results/performance-desktop.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page);
      await page.getByRole("button", { name: "切换明暗主题" }).click();
      await page.screenshot({
        path: "test-results/performance-mobile.png",
        fullPage: true,
      });
    },
  );
  await scenario(
    "full online answer sheet, score and mastery persistence",
    async (page) => {
      await go(page, "/practice");
      await page.getByRole("radio", { name: "综合练习", exact: true }).check();
      await page
        .getByRole("button", { name: "开始答题 →", exact: true })
        .click();
      assert.equal(
        await page.locator(".practice-card-grid button").count(),
        questionBank.length,
      );
      await fillAttempt(page, questionBank);
      assert.equal(
        await page.locator(".practice-score-value strong").innerText(),
        "100",
      );
      assert.equal(
        await page.locator(".practice-review").count(),
        questionBank.length,
      );
      assert.equal(await page.locator(".practice-review.incorrect").count(), 0);
      await page.reload({ waitUntil: "networkidle" });
      await page
        .getByRole("button", { name: "查看成绩与解析", exact: true })
        .click();
      assert.equal(
        await page.locator(".practice-score-value strong").innerText(),
        "100",
      );
      await page.getByRole("button", { name: "学习路径", exact: true }).click();
      assert.match(
        await page.locator(".path-metrics").innerText(),
        new RegExp(`${questionBank.length} / ${questionBank.length}`),
      );
    },
  );
  await scenario(
    "draft resume, unanswered submission and retry wrong questions",
    async (page) => {
      const questions = questionBank.filter((q) => q.lessonId === "polar");
      await go(page, "/practice?level=2&lesson=polar");
      await page
        .getByRole("button", { name: "开始答题 →", exact: true })
        .click();
      await answerCurrent(
        page,
        questions[0],
        (questions[0].answer + 1) % questions[0].options.length,
      );
      await page.getByRole("button", { name: "下一题 →", exact: true }).click();
      await page.reload({ waitUntil: "networkidle" });
      await page
        .getByRole("button", { name: "继续作答 →", exact: true })
        .click();
      assert.match(
        await page.locator(".practice-question-meta").first().innerText(),
        /第 2/,
      );
      await page
        .getByRole("button", { name: "提交答卷", exact: true })
        .last()
        .click();
      assert.match(
        await page.locator(".practice-confirm").innerText(),
        /2 道题未作答/,
      );
      await page.getByRole("button", { name: "确认交卷", exact: true }).click();
      assert.equal(
        await page.locator(".practice-score-value strong").innerText(),
        "0",
      );
      await page
        .getByRole("button", { name: "重练本次错题（3）", exact: true })
        .click();
      await fillAttempt(page, questions);
      assert.equal(
        await page.locator(".practice-score-value strong").innerText(),
        "100",
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page);
      await page.screenshot({
        path: "test-results/practice-mobile.png",
        fullPage: true,
      });
    },
  );
  await scenario(
    "Phase 1 lesson completion remains connected to separate practice page",
    async (page) => {
      await go(page, "/lesson/first-flight");
      await page.getByRole("button", { name: "4 倍", exact: true }).click();
      await number(page, "质量数值", 1499);
      await number(page, "推力数值", 1097.6);
      await page
        .getByRole("button", { name: "记录实验任务完成", exact: true })
        .click();
      await page.getByRole("button", { name: "单步", exact: true }).click();
      assert.match(await page.locator(".transport").innerText(), /0.02 s/);
      await page
        .getByRole("button", { name: "进入本课答题 →", exact: true })
        .click();
      await page
        .getByRole("button", { name: "开始答题 →", exact: true })
        .click();
      await fillAttempt(
        page,
        questionBank.filter((q) => q.level === 1),
      );
      await page
        .getByRole("button", { name: "学习：飞机为什么能飞 →", exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: "完成本课", exact: true }).click();
      assert.match(
        await page.locator(".progress-pill").innerText(),
        new RegExp(`1 / ${lessonIds.length}`),
      );
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(
        await page
          .getByRole("button", { name: "✓ 本课已完成", exact: true })
          .count(),
        1,
      );
    },
  );
  await scenario(
    "all course routes and migrated Phase 1 progress",
    async (page, context) => {
      await context.addInitScript(() =>
        localStorage.setItem(
          "fdl-progress-v1",
          JSON.stringify({
            completed: true,
            prediction: true,
            answers: {
              balance: true,
              speed: true,
              stall: true,
              calculation: true,
              experiment: true,
            },
          }),
        ),
      );
      await page.setViewportSize({ width: 390, height: 844 });
      for (const id of lessonIds) {
        await go(page, `/lesson/${id}`);
        assert.equal(await page.locator(".lesson-intro h1").count(), 1);
        assert.equal(
          await page.locator(".katex-error").count(),
          0,
          `Formula rendering failed in ${id}: ${await page.locator(".katex-error").allTextContents()}`,
        );
        for (const value of await page
          .locator(".formula")
          .evaluateAll((els) =>
            els.map((el) => el.getAttribute("aria-label") || ""),
          )) {
          assert.doesNotMatch(
            value,
            /[\u0000-\u001f]/,
            `Control character in displayed formula: ${id}`,
          );
          assert.doesNotMatch(
            value,
            /(?:^|[^\\])\\\\(?:dot|quad|begin|sin|frac|alpha)/,
            `Double-escaped formula command: ${id}: ${value}`,
          );
        }
        assert.equal(
          await page.getByRole("heading", { name: "显示出现问题" }).count(),
          0,
        );
        await noOverflow(page);
      }
      assert.match(
        await page.locator(".progress-pill").innerText(),
        new RegExp(`1 / ${lessonIds.length}`),
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page);
    },
  );
  await scenario(
    "CG, static margin, coupled trim and invalid limits",
    async (page) => {
      await go(page, "/lesson/static-stability");
      assert.match(
        await page.locator(".stability-readouts").innerText(),
        /17.02/,
      );
      await page
        .getByRole("button", { name: "保存参数快照", exact: true })
        .click();
      await number(page, "重心位置 hCG数值", 35);
      assert.match(
        await page.locator(".stability-readouts").innerText(),
        /12.02/,
      );
      await page
        .getByRole("button", { name: "记录实验任务完成", exact: true })
        .click();
      assert.match(await page.locator(".lesson-task").innerText(), /已记录/);
      assert.equal(
        await page.locator(".stability-comparison table").count(),
        1,
      );
      await number(page, "重心位置 hCG数值", 60);
      assert.match(
        await page.locator(".stability-status").innerText(),
        /静不稳定/,
      );
      await page.getByRole("tab", { name: /纵向配平/ }).click();
      await page
        .getByRole("button", { name: "↺ 恢复默认", exact: true })
        .click();
      await number(page, "真空速 V数值", 40);
      assert.match(
        await page.locator(".stability-readouts").innerText(),
        /4.50/,
      );
      assert.match(
        await page.locator(".stability-status").last().innerText(),
        /配平可行/,
      );
      await page
        .getByRole("button", { name: "记录实验任务完成", exact: true })
        .click();
      const promise = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "导出曲线 CSV ↗", exact: true })
        .click();
      const download = await promise;
      await download.saveAs("test-results/stability.csv");
      const csv = readFileSync("test-results/stability.csv", "utf8")
        .trim()
        .split("\n");
      assert.ok(csv.length > 50);
      assert.ok(
        csv.every((row) => row.split(",").length === csv[0].split(",").length),
      );
      await number(page, "升降舵偏角上限 |δe|数值", 1);
      assert.match(
        await page.locator(".stability-status").last().innerText(),
        /配平不可行/,
      );
      assert.match(await page.locator(".stability-readouts").innerText(), /—/);
      await number(page, "质量 m数值", 0);
      assert.match(await page.getByRole("alert").innerText(), /未应用/);
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page);
      await page.screenshot({
        path: "test-results/stability-mobile.png",
        fullPage: true,
      });
    },
  );
  await scenario(
    "coordinate transform, modal responses and eigenvalue stability",
    async (page) => {
      await go(page, "/lesson/coordinates-linearization");
      await number(page, "俯仰 θ数值", 30);
      await number(page, "航向 ψ数值", 30);
      assert.match(
        await page.locator(".dyn-vector-grid").innerText(),
        /-0.500/,
      );
      await page
        .getByRole("button", { name: "验证并记录坐标实验", exact: true })
        .click();
      assert.match(await page.locator(".lesson-task").innerText(), /已记录/);
      await number(page, "俯仰 θ数值", 90);
      assert.match(
        await page.locator(".dynamics-lab").innerText(),
        /当前 Euler 速率映射奇异/,
      );
      const smallError = parseFloat(
        await page.locator(".lin-metrics strong").last().innerText(),
      );
      await page
        .getByRole("button", { name: "大扰动 30°", exact: true })
        .click();
      const largeError = parseFloat(
        await page.locator(".lin-metrics strong").last().innerText(),
      );
      assert.ok(
        largeError > 100 * smallError,
        `linear approximation error should grow: ${smallError} -> ${largeError}`,
      );
      const trimSlider = page.getByRole("slider", {
        name: "线性化配平角",
        exact: true,
      });
      await trimSlider.press("End");
      for (let i = 0; i < 15; i++) await trimSlider.press("ArrowLeft");
      const trimInput = parseFloat(
        await page.locator(".lin-metrics strong").first().innerText(),
      );
      assert.ok(Math.abs(trimInput - 0.28125) < 1e-5);
      await page
        .getByRole("button", { name: "默认工作点", exact: true })
        .click();
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page);
      await page.screenshot({
        path: "test-results/linearization-mobile.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.getByRole("tab", { name: "纵向模态", exact: true }).click();
      await page
        .getByRole("button", { name: "单步 0.01 s", exact: true })
        .click();
      assert.match(await page.locator(".dyn-status").innerText(), /0.01 s/);
      await number(page, "短周期阻尼比 ζ数值", 0.7);
      await page
        .getByRole("button", { name: "计算至终点", exact: true })
        .click();
      await page
        .getByRole("button", { name: "记录动态实验完成", exact: true })
        .click();
      await page
        .getByRole("button", { name: "保存参数与时程快照", exact: true })
        .click();
      await number(page, "短周期阻尼比 ζ数值", -0.1);
      assert.match(
        await page.locator(".dyn-status").innerText(),
        /失稳：存在正实部/,
      );
      await page
        .getByRole("button", { name: "计算至终点", exact: true })
        .click();
      const promise = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "导出当前时程 CSV", exact: true })
        .click();
      const download = await promise;
      await download.saveAs("test-results/dynamics.csv");
      assert.match(
        readFileSync("test-results/dynamics.csv", "utf8"),
        /continuous_stability=unstable/,
      );
      await page.getByRole("tab", { name: "横侧向模态", exact: true }).click();
      assert.match(await page.locator(".dyn-status").innerText(), /失稳/);
      await page
        .getByRole("button", { name: "计算至终点", exact: true })
        .click();
      await page
        .getByRole("button", { name: "记录动态实验完成", exact: true })
        .click();
      await number(page, "螺旋增长率 aS数值", -0.025);
      assert.match(await page.locator(".dyn-status").innerText(), /渐近稳定/);
      await page.getByRole("button", { name: "播放", exact: true }).click();
      await page.waitForTimeout(250);
      await page.getByRole("button", { name: "暂停", exact: true }).click();
      assert.doesNotMatch(
        await page.locator(".dyn-status strong").innerText(),
        /t = 0.00/,
      );
      await page.getByRole("button", { name: "重置时程", exact: true }).click();
      assert.match(
        await page.locator(".dyn-status strong").innerText(),
        /0.00/,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page);
      await page.screenshot({
        path: "test-results/dynamics-mobile.png",
        fullPage: true,
      });
    },
  );
  await scenario(
    "PID actuators, planar hold and quaternion six-DOF motion",
    async (page) => {
      await go(page, "/lesson/pid-control");
      assert.match(
        await page.locator(".ctl-status").innerText(),
        /虚拟操纵指令已限幅/,
      );
      await page
        .getByRole("button", { name: "单步 +0.01 s", exact: true })
        .click();
      assert.match(await page.locator(".ctl-runbar").innerText(), /0.01 s/);
      await page
        .getByRole("combobox", { name: "播放速度", exact: true })
        .selectOption("4");
      await page.getByRole("button", { name: "运行", exact: true }).click();
      await page.waitForFunction(
        () => !document.querySelector(".ctl-task")?.disabled,
      );
      await page.getByRole("button", { name: "暂停", exact: true }).click();
      await page
        .getByRole("button", { name: "记录俯仰控制观察", exact: true })
        .click();
      assert.match(await page.locator(".lesson-task").innerText(), /已记录/);
      await page
        .getByRole("button", { name: "保存响应快照", exact: true })
        .click();
      const csvPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出 CSV", exact: true }).click();
      const csvDownload = await csvPromise;
      await csvDownload.saveAs("test-results/pid.csv");
      const csv = readFileSync("test-results/pid.csv", "utf8")
        .trim()
        .split("\n");
      assert.ok(csv.length > 20);
      assert.match(csv[0], /theta_deg.*target_deg/);
      await number(page, "目标俯仰角 θc数值", 0);
      assert.match(await page.locator(".ctl-runbar").innerText(), /0.00 s/);
      assert.match(await page.locator(".ctl-metrics").innerText(), /— %/);
      await number(page, "比例增益 Kp数值", -1);
      assert.match(await page.getByRole("alert").innerText(), /有限数值/);
      assert.equal(
        await page
          .getByRole("spinbutton", { name: "比例增益 Kp数值", exact: true })
          .getAttribute("aria-invalid"),
        "true",
      );
      await page
        .getByRole("combobox", { name: "控制模式", exact: true })
        .selectOption("manual");
      await number(page, "手动虚拟操纵量 u数值", 4);
      await page
        .getByRole("button", { name: "单步 +0.01 s", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("spinbutton", {
            name: "手动虚拟操纵量 u数值",
            exact: true,
          })
          .inputValue(),
        "4",
      );
      await page
        .getByRole("tab", { name: "高度与速度保持", exact: true })
        .click();
      await number(page, "目标空速 Vc数值", 60);
      await number(page, "目标高度 hc数值", 1040);
      await number(page, "3 s 起的垂直风 · 向上为正数值", 1);
      await page
        .getByRole("combobox", { name: "播放速度", exact: true })
        .selectOption("4");
      await page.getByRole("button", { name: "运行", exact: true }).click();
      await page.waitForFunction(
        () => !document.querySelector(".ctl-task")?.disabled,
      );
      await page.getByRole("button", { name: "暂停", exact: true }).click();
      await page
        .getByRole("button", { name: "记录高度与速度保持观察", exact: true })
        .click();
      const holdMetrics = await page
        .locator(".ctl-metrics strong")
        .allTextContents();
      assert.ok(parseFloat(holdMetrics[0]) > 50);
      assert.ok(parseFloat(holdMetrics[1]) > 1000);
      await page
        .getByRole("checkbox", { name: "速度保持 · PI", exact: true })
        .uncheck();
      await number(page, "手动推力数值", 1000);
      await page
        .getByRole("checkbox", { name: "高度保持 · PI 外环", exact: true })
        .uncheck();
      await number(page, "手动升力系数 CL数值", 0.4);
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page);
      await page.screenshot({
        path: "test-results/autopilot-mobile.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page
        .getByRole("tab", { name: "六自由度仿真", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: "播放速度", exact: true })
        .selectOption("4");
      await page.getByRole("button", { name: "运行", exact: true }).click();
      await page.waitForFunction(
        () => !document.querySelector(".ctl-task")?.disabled,
      );
      await page.getByRole("button", { name: "暂停", exact: true }).click();
      assert.match(await page.locator(".ctl-metrics").innerText(), /1000.00 m/);
      assert.match(await page.locator(".ctl-status").innerText(), /1.000000/);
      await page
        .getByRole("button", { name: "记录六自由度观察", exact: true })
        .click();
      await page
        .getByRole("button", { name: "保存响应快照", exact: true })
        .click();
      await page
        .getByRole("button", { name: "恢复默认参数", exact: true })
        .click();
      await number(page, "升降舵 δe · 正值后缘向下数值", -2);
      await page.getByRole("button", { name: "运行", exact: true }).click();
      await page.waitForFunction(
        () => !document.querySelector(".ctl-task")?.disabled,
      );
      await page.getByRole("button", { name: "暂停", exact: true }).click();
      const pitch = parseFloat(
        (await page.locator(".ctl-metrics strong").nth(1).innerText()).split(
          "/",
        )[0],
      );
      assert.ok(
        pitch > 0,
        `negative mechanical elevator should raise nose: ${pitch}`,
      );
      const sixPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出 CSV", exact: true }).click();
      const sixDownload = await sixPromise;
      await sixDownload.saveAs("test-results/sixdof.csv");
      assert.match(
        readFileSync("test-results/sixdof.csv", "utf8"),
        /qw,qx,qy,qz/,
      );
      await number(page, "稳态风 · 向东为正数值", 2);
      await number(page, "副翼 · 正值右滚数值", 1);
      await page
        .getByRole("button", { name: "恢复默认参数", exact: true })
        .click();
      assert.match(await page.locator(".ctl-runbar").innerText(), /0.00 s/);
      assert.equal(
        await page
          .getByRole("spinbutton", {
            name: "升降舵 δe · 正值后缘向下数值",
            exact: true,
          })
          .inputValue(),
        "0",
      );
      assert.equal(
        await page
          .getByRole("spinbutton", {
            name: "稳态风 · 向东为正数值",
            exact: true,
          })
          .inputValue(),
        "0",
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page);
      await page.screenshot({
        path: "test-results/sixdof-mobile.png",
        fullPage: true,
      });
    },
  );
  assert.deepEqual(errors, [], "Browser errors: " + errors.join("\n"));
  console.log(
    `Browser scenarios passed: ${completed.length}. No console/page errors.`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
