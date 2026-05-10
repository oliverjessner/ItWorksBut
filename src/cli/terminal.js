import boxen from "boxen";
import chalk, { Chalk } from "chalk";
import figlet from "figlet";
import gradient from "gradient-string";
import ora from "ora";

const THEMES = new Set(["default", "toxic", "mono"]);

const SPINNER_TEXT = {
  git: "Checking git hygiene",
  env: "Sniffing for secrets",
  dependencies: "Interrogating package.json",
  ci: "Inspecting CI rituals",
  node: "Poking the Node.js backend",
  web: "Looking for frontend footguns",
  api: "Testing the API trust issues",
  database: "Watching SQL strings misbehave",
  electron: "Opening the Electron danger drawer",
  tauri: "Reading Tauri permissions",
  default: "Looking for things that work but should not ship"
};

export function normalizeTheme(theme) {
  const normalized = String(theme || "default").toLowerCase();
  if (!THEMES.has(normalized)) {
    throw new Error(`Invalid theme "${theme}". Expected one of: default, toxic, mono`);
  }
  return normalized;
}

export function isFancyOutputEnabled(options = {}, env = process.env, stdout = process.stdout) {
  return Boolean(stdout.isTTY) && !env.CI && !options.json && !options.sarif && !options.noColor && normalizeTheme(options.theme) !== "mono";
}

export function isColorEnabled(options = {}, env = process.env, stdout = process.stdout) {
  if (options.noColor || options.json || options.sarif) return false;
  if (normalizeTheme(options.theme) === "mono") return false;
  if (env.FORCE_COLOR && env.FORCE_COLOR !== "0") return true;
  if (env.CI) return false;
  return Boolean(stdout.isTTY);
}

export function getChalk(options = {}) {
  if (!isColorEnabled(options)) return new Chalk({ level: 0 });
  return chalk;
}

export function shouldUseSpinner(options = {}, env = process.env, stdout = process.stdout) {
  return (
    Boolean(stdout.isTTY) &&
    !env.CI &&
    !options.json &&
    !options.sarif &&
    !options.noSpinner &&
    !options.quiet
  );
}

export function createScanSpinner(options = {}) {
  if (!shouldUseSpinner(options)) return null;
  return ora({
    text: SPINNER_TEXT.default,
    stream: process.stderr,
    color: normalizeTheme(options.theme) === "toxic" ? "green" : "cyan"
  });
}

export function printIntro(options = {}) {
  if (options.json || options.sarif || options.noBanner || options.quiet || process.env.CI || !process.stdout.isTTY) {
    return;
  }

  const theme = normalizeTheme(options.theme);
  const colors = getChalk(options);
  const renderTheme = options.noColor ? "mono" : theme;
  const title = renderTitle(renderTheme);
  const claim =
    theme === "toxic"
      ? `${colors.bold("Green builds. Red flags.")}\n${colors.green("Let's see what breaks before production.")}`
      : `${colors.bold("AI-built? Nice.")}\n${colors.yellow("Now let's see what breaks before production.")}`;

  process.stdout.write(`${title}\n`);
  process.stdout.write(
    `${boxen(claim, {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: renderTheme === "mono" ? undefined : renderTheme === "toxic" ? "green" : "cyan"
    })}\n`
  );
}

function renderTitle(theme) {
  let title = "ItWorksBut";
  try {
    title = figlet.textSync("ItWorksBut", {
      font: "ANSI Shadow",
      horizontalLayout: "default",
      verticalLayout: "default"
    });
  } catch {
    title = "ItWorksBut";
  }

  try {
    if (theme === "mono") return title;
    if (theme === "toxic") return gradient(["#faff00", "#39ff14", "#00f5ff"])(title);
    return gradient.rainbow(title);
  } catch {
    return title;
  }
}
