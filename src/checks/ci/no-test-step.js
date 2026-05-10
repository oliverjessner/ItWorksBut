import { collectCiFiles } from "../helpers.js";

export default {
  id: "ci.no-test-step",
  title: "CI should run tests",
  category: "ci",
  severity: "medium",
  tags: ["ci", "tests"],
  run: async (context) => {
    const ciFiles = await collectCiFiles(context);
    if (ciFiles.length === 0) return [];

    const combined = (await Promise.all(ciFiles.map((file) => context.readFileSafe(file)))).filter(Boolean).join("\n");
    if (/\b(npm|pnpm|yarn)\s+(run\s+)?test\b|bun\s+test|vitest|jest|playwright\s+test/i.test(combined)) return [];

    return [
      {
        message: "CI configuration exists, but no test step was detected.",
        recommendation: "Run automated tests in CI, for example npm test, before deployment or merge."
      }
    ];
  }
};
