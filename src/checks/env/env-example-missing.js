import { isEnvFile } from "../helpers.js";

export default {
  id: "env.env-example-missing",
  title: ".env.example should document required environment variables",
  category: "env",
  severity: "medium",
  tags: ["env", "developer-experience", "deployment"],
  run: async (context) => {
    if (await context.fileExists(".env.example")) return [];

    const envFilePresent = context.allFiles.some((file) => isEnvFile(file));
    const envUsage = await context.grep(/\b(process\.env|import\.meta\.env|Deno\.env)\b/, {
      include: ["*.js", "*.ts", "*.jsx", "*.tsx", "*.mjs", "*.cjs"],
      maxMatches: 1
    });

    if (!envFilePresent && envUsage.length === 0) return [];

    return [
      {
        message: "Environment variable usage appears to exist, but .env.example is missing.",
        recommendation: "Add .env.example with variable names and safe placeholder values so CI and contributors know what must be configured.",
        heuristic: true
      }
    ];
  }
};
