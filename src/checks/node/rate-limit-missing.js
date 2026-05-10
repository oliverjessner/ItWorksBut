import { hasText } from "../helpers.js";

const RATE_LIMIT_PACKAGES = ["express-rate-limit", "@fastify/rate-limit", "rate-limiter-flexible"];

export default {
  id: "node.rate-limit-missing",
  title: "API servers should include rate limiting",
  category: "node",
  severity: "medium",
  tags: ["node", "api", "availability"],
  run: async (context) => {
    const serverDetected =
      context.hasDependency("express") ||
      context.hasDependency("fastify") ||
      context.hasDependency("@fastify/fastify") ||
      (await hasText(context, /\b(app|router)\.(get|post|put|patch|delete)\s*\(|\bfastify\.(get|post|put|patch|delete)\s*\(/g));

    if (!serverDetected) return [];
    if (RATE_LIMIT_PACKAGES.some((name) => context.hasDependency(name) || context.hasDevDependency(name))) return [];
    if (await hasText(context, /\brateLimit\b|rate-limit|RateLimiter/g)) return [];

    return [
      {
        message: "An API server appears to exist, but no rate-limit dependency or middleware was detected.",
        recommendation: "Add route-appropriate rate limiting, for example express-rate-limit or @fastify/rate-limit, especially for auth and write endpoints.",
        heuristic: true
      }
    ];
  }
};
