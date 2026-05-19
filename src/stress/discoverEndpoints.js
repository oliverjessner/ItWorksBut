import path from "node:path";
import { DEFAULT_IGNORE } from "../core/config.js";
import { walkProject } from "../core/fileWalker.js";
import { readFileSafe } from "../utils/fs.js";

const HTTP_METHODS = ["get", "head", "post", "put", "patch", "delete"];
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ROUTE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
const DISCOVERY_IGNORE = [
  ...DEFAULT_IGNORE,
  "test/**",
  "tests/**",
  "__tests__/**",
  "**/*.test.js",
  "**/*.test.ts",
  "**/*.spec.js",
  "**/*.spec.ts"
];

export async function discoverEndpoints(rootPath) {
  const { textFiles } = await walkProject(rootPath, DISCOVERY_IGNORE);
  return await discoverEndpointsFromFiles({
    rootPath,
    files: textFiles,
    readFile: async (relativePath) => await readFileSafe(path.join(rootPath, relativePath))
  });
}

export async function discoverEndpointsFromFiles({ rootPath, files, readFile }) {
  const endpoints = [];

  for (const file of files.filter(isSourceFile)) {
    const content = await readFile(file);
    if (content === null || content === undefined) continue;

    endpoints.push(...discoverExpressEndpoints(file, content));
    endpoints.push(...discoverFetchReferences(file, content));
    endpoints.push(...discoverNextAppRouterEndpoints(file, content));
    endpoints.push(...discoverNextPagesRouterEndpoints(file, content));
  }

  return classifyEndpoints(dedupeEndpoints(endpoints), rootPath);
}

export function classifyEndpoints(endpoints) {
  const all = endpoints.map((endpoint) => {
    const method = endpoint.method.toUpperCase();
    const dynamic = isDynamicRoute(endpoint.path);
    const unsafe = MUTATING_METHODS.has(method);
    let status = "selected";
    let reason;

    if (unsafe) {
      status = "skipped";
      reason = "unsafe method";
    } else if (dynamic) {
      status = "skipped";
      reason = "dynamic route requires parameter";
    }

    return {
      ...endpoint,
      method,
      dynamic,
      status,
      reason
    };
  });

  return {
    status: all.length === 0 ? "skip" : "pass",
    endpoints: all,
    safeEndpoints: all.filter((endpoint) => endpoint.status === "selected"),
    skippedEndpoints: all
      .filter((endpoint) => endpoint.status === "skipped")
      .map(({ method, path, reason, source, type }) => ({ method, path, reason, source, type }))
  };
}

function discoverExpressEndpoints(file, content) {
  const endpoints = [];
  const methods = HTTP_METHODS.join("|");
  const regex = new RegExp(`\\b(?:app|router|server)\\s*\\.\\s*(${methods})\\s*\\(\\s*(['"\`])([^'"\`]+)\\2`, "gi");
  let match;

  while ((match = regex.exec(content)) !== null) {
    const routePath = normalizeRoutePath(match[3]);
    if (!routePath) continue;
    endpoints.push(endpoint(match[1], routePath, file, "express"));
  }

  return endpoints;
}

function discoverFetchReferences(file, content) {
  const endpoints = [];
  const regex = /\bfetch\s*\(\s*(['"`])(\/api\/[^'"`]+)\1/gi;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const routePath = normalizeRoutePath(match[2]);
    if (!routePath) continue;
    endpoints.push(endpoint("GET", routePath, file, "fetch-reference"));
  }

  return endpoints;
}

function discoverNextAppRouterEndpoints(file, content) {
  const normalized = normalizeFilePath(file);
  const match = normalized.match(/(?:^|\/)(?:src\/)?app\/api\/(.+)\/route\.(?:js|jsx|ts|tsx|mjs|cjs)$/);
  if (!match) return [];

  const routePath = normalizeRoutePath(`/api/${routeSegmentsToPath(match[1])}`);
  const exportedMethods = discoverExportedRouteMethods(content);
  const methods = exportedMethods.length > 0 ? exportedMethods : ["GET"];

  return methods.map((method) => endpoint(method, routePath, file, "next-app-router"));
}

function discoverNextPagesRouterEndpoints(file, content) {
  const normalized = normalizeFilePath(file);
  const match = normalized.match(/(?:^|\/)(?:src\/)?pages\/api\/(.+)\.(?:js|jsx|ts|tsx|mjs|cjs)$/);
  if (!match) return [];

  const routePath = normalizeRoutePath(`/api/${routeSegmentsToPath(match[1])}`);
  const guardedMethods = discoverMethodGuards(content);
  const methods = guardedMethods.length > 0 ? guardedMethods : ["GET"];

  return methods.map((method) => endpoint(method, routePath, file, "next-pages-router"));
}

function discoverExportedRouteMethods(content) {
  const methods = new Set();
  const regex = /\bexport\s+(?:async\s+)?function\s+(GET|HEAD|POST|PUT|PATCH|DELETE)\b/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    methods.add(match[1]);
  }

  return [...methods];
}

function discoverMethodGuards(content) {
  const methods = new Set();
  const regex = /\b(?:req|request)\.method\s*(?:===|!==|==|!=)\s*['"`](GET|HEAD|POST|PUT|PATCH|DELETE)['"`]/gi;
  let match;

  while ((match = regex.exec(content)) !== null) {
    methods.add(match[1].toUpperCase());
  }

  return [...methods];
}

function endpoint(method, routePath, file, type) {
  return {
    method: method.toUpperCase(),
    path: routePath,
    source: file,
    type
  };
}

function dedupeEndpoints(endpoints) {
  const byKey = new Map();
  for (const endpoint of endpoints) {
    const key = `${endpoint.method.toUpperCase()} ${endpoint.path}`;
    if (!byKey.has(key)) byKey.set(key, endpoint);
  }
  return [...byKey.values()].sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
}

function isSourceFile(file) {
  const normalized = normalizeFilePath(file);
  return ROUTE_EXTENSIONS.has(path.extname(normalized));
}

function normalizeFilePath(file) {
  return String(file).replace(/\\/g, "/");
}

function normalizeRoutePath(value) {
  if (!value || value.includes("${")) return null;
  const pathValue = value.startsWith("/") ? value : `/${value}`;
  return pathValue.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

function routeSegmentsToPath(value) {
  return value
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/^\[(\.\.\.)?(.+)]$/, ":$2"))
    .join("/");
}

function isDynamicRoute(routePath) {
  return /(^|\/):[^/]+|\[[^/]+]|\*/.test(routePath);
}
