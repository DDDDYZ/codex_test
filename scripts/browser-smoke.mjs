import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { questionBank } from "../src/content/questions.ts";

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
            name: /动压：速度如何放大气动力/, level:1,
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
      assert.equal(await page.getByRole("spinbutton",{name:"质量 m数值",exact:true}).inputValue(),"1000");
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
      assert.match(await page.locator(".progress-pill").innerText(), /1 \/ 6/);
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
      for (const id of [
        "first-flight",
        "dynamic-pressure",
        "polar",
        "level-flight",
        "climb-glide",
        "turn",
      ]) {
        await go(page, `/lesson/${id}`);
        assert.equal(await page.locator(".lesson-intro h1").count(), 1);
        assert.equal(await page.locator(".katex-error").count(), 0);
        assert.equal(
          await page.getByRole("heading", { name: "显示出现问题" }).count(),
          0,
        );
      }
      assert.match(await page.locator(".progress-pill").innerText(), /1 \/ 6/);
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page);
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
