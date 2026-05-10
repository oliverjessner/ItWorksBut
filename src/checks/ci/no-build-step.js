import { collectCiFiles } from "../helpers.js";

export default {
  id: "ci.no-build-step",
  title: "CI should run a build step",
  category: "ci",
  severity: "medium",
  tags: ["ci", "build"],
  run: async (context) => {
    const ciFiles = await collectCiFiles(context);
    if (ciFiles.length === 0) return [];

    const combined = (await Promise.all(ciFiles.map((file) => context.readFileSafe(file)))).filter(Boolean).join("\n");
    if (/\b(npm|pnpm|yarn)\s+(run\s+)?build\b|bun\s+run\s+build/i.test(combined)) return [];

    return [
      {
        message: "CI configuration exists, but no build step was detected.",
        recommendation: "Run the project build in CI, for example npm run build, before deployment or merge."
      }
    ];
  }
};
