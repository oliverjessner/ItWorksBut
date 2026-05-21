import path from "node:path";
import { DEFAULT_IGNORE } from "../core/config.js";
import { walkProject } from "../core/fileWalker.js";
import { readFileSafe } from "../utils/fs.js";
import { isServerOrApiFile } from "../checks/helpers.js";

const HTTP_METHODS = ["get", "head", "post", "put", "patch", "delete", "options"];
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ROUTE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"]);
const API_HANDLER_EVIDENCE = [
  /\b(?:req|request)\s*,\s*(?:res|response)\b/i,
  /\b(?:res|response)\s*\.\s*(?:json|send|status|end|redirect|writeHead|setHeader)\s*\(/i,
  /\b(?:ctx|context)\s*\.\s*(?:body|response|status|json)\b/i,
  /\bNextResponse\s*\.\s*(?:json|redirect)\s*\(/,
  /\b(?:new\s+Response|Response\.json)\s*\(/,
  /\bdefineEventHandler\s*\(/,
  /\bexport\s+(?:async\s+)?function\s+(?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/,
  /\bexport\s+(?:const|let|var)\s+(?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\s*=/
];
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
  const fileContents = [];

  for (const file of files.filter(isSourceFile)) {
    const content = await readFile(file);
    if (content === null || content === undefined) continue;
    fileContents.push({ file, content });
  }

  const mountPrefixes = collectMountPrefixes(fileContents);

  for (const { file, content } of fileContents) {
    endpoints.push(...discoverExpressEndpoints(file, content, mountPrefixes));
    endpoints.push(...discoverMountedRouterEndpoints(file, content, mountPrefixes));
    endpoints.push(...discoverFastifyRouteObjects(file, content));
    endpoints.push(...discoverFetchReferences(file, content));
    endpoints.push(...discoverFileConventionEndpoints(file, content));
    endpoints.push(...discoverApiCandidateFileEndpoints(file, content));
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

    if (method === "OPTIONS") {
      status = "skipped";
      reason = "unsupported method";
    } else if (unsafe) {
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

function discoverExpressEndpoints(file, content, mountPrefixes = []) {
  const endpoints = [];
  const methods = HTTP_METHODS.join("|");
  const regex = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*\\.\\s*(${methods})\\s*\\(\\s*(['"\`])([^'"\`]+)\\3`, "gi");
  const receivers = collectRouteReceivers(content);
  const mountedRouterFile = hasApplicableMount(file, mountPrefixes);
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (!isRouteReceiver(match[1], receivers)) continue;
    if (mountedRouterFile && isRouterReceiver(match[1], receivers)) continue;
    const routePath = normalizeRoutePath(match[4]);
    if (!routePath) continue;
    endpoints.push(endpoint(match[2], routePath, file, "express"));
  }

  return endpoints;
}

function discoverMountedRouterEndpoints(file, content, mountPrefixes) {
  const applicableMounts = mountPrefixes.filter((mount) => mountAppliesToFile(mount, file));
  if (applicableMounts.length === 0) return [];

  const endpoints = [];
  const methods = HTTP_METHODS.join("|");
  const regex = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*\\.\\s*(${methods})\\s*\\(\\s*(['"\`])([^'"\`]+)\\3`, "gi");
  const receivers = collectRouteReceivers(content);
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (!isRouterReceiver(match[1], receivers)) continue;
    const routePath = normalizeRoutePath(match[4]);
    if (!routePath || routePath.startsWith("/api")) continue;
    for (const mount of applicableMounts) {
      endpoints.push(endpoint(match[2], joinRoutePath(mount.prefix, routePath), file, "mounted-router"));
    }
  }

  return endpoints;
}

function discoverFastifyRouteObjects(file, content) {
  const endpoints = [];
  const regex = /\bfastify\s*\.\s*route\s*\(\s*\{([\s\S]*?)\}\s*\)/gi;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const objectText = match[1];
    const methodMatch = objectText.match(/\bmethod\s*:\s*(['"`])(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\1/i);
    const urlMatch = objectText.match(/\b(?:url|path)\s*:\s*(['"`])([^'"`]+)\1/i);
    if (!methodMatch || !urlMatch) continue;
    const routePath = normalizeRoutePath(urlMatch[2]);
    if (!routePath) continue;
    endpoints.push(endpoint(methodMatch[2], routePath, file, "fastify-route-object"));
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

function discoverFileConventionEndpoints(file, content) {
  return [
    ...discoverNextAppRouterEndpoints(file, content),
    ...discoverNextPagesRouterEndpoints(file, content),
    ...discoverSvelteKitEndpoints(file, content),
    ...discoverNitroEndpoints(file, content),
    ...discoverAstroApiEndpoints(file, content)
  ];
}

function discoverNextAppRouterEndpoints(file, content) {
  const normalized = normalizeFilePath(file);
  const match = normalized.match(/(?:^|\/)(?:src\/)?app\/(.+)\/route\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts)$/);
  if (!match) return [];

  const routePath = normalizeRoutePath(`/${routeSegmentsToPath(match[1])}`);
  const exportedMethods = discoverExportedRouteMethods(content);
  const methods = exportedMethods.length > 0 ? exportedMethods : ["GET"];

  return methods.map((method) => endpoint(method, routePath, file, "next-app-router"));
}

function discoverNextPagesRouterEndpoints(file, content) {
  const normalized = normalizeFilePath(file);
  const match = normalized.match(/(?:^|\/)(?:src\/)?pages\/api\/(.+)\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts)$/);
  if (!match) return [];

  const routePath = normalizeRoutePath(`/api/${routeSegmentsToPath(match[1])}`);
  const guardedMethods = discoverMethodGuards(content);
  const methods = guardedMethods.length > 0 ? guardedMethods : ["GET"];

  return methods.map((method) => endpoint(method, routePath, file, "next-pages-router"));
}

function discoverSvelteKitEndpoints(file, content) {
  const normalized = normalizeFilePath(file);
  const match = normalized.match(/(?:^|\/)(?:src\/)?routes\/(.+)\/\+server\.(?:js|ts|mjs|cjs|mts|cts)$/);
  if (!match) return [];

  const routePath = normalizeRoutePath(`/${routeSegmentsToPath(match[1])}`);
  const exportedMethods = discoverExportedRouteMethods(content);
  const methods = exportedMethods.length > 0 ? exportedMethods : ["GET"];

  return methods.map((method) => endpoint(method, routePath, file, "sveltekit-server-route"));
}

function discoverNitroEndpoints(file, content) {
  const normalized = normalizeFilePath(file);
  const match = normalized.match(/(?:^|\/)(?:src\/)?server\/api\/(.+?)(?:\.(get|head|post|put|patch|delete|options))?\.(?:js|ts|mjs|cjs|mts|cts)$/i);
  if (!match) return [];

  const routePath = normalizeRoutePath(`/api/${routeSegmentsToPath(match[1])}`);
  const methods = match[2] ? [match[2].toUpperCase()] : discoverMethodGuards(content);

  return (methods.length > 0 ? methods : ["GET"]).map((method) => endpoint(method, routePath, file, "nitro-server-api"));
}

function discoverAstroApiEndpoints(file, content) {
  const normalized = normalizeFilePath(file);
  const match = normalized.match(/(?:^|\/)(?:src\/)?pages\/api\/(.+)\.(?:js|ts|mjs|cjs|mts|cts)$/);
  if (!match) return [];

  const routePath = normalizeRoutePath(`/api/${routeSegmentsToPath(match[1])}`);
  const exportedMethods = discoverExportedRouteMethods(content);
  const methods = exportedMethods.length > 0 ? exportedMethods : ["GET"];

  return methods.map((method) => endpoint(method, routePath, file, "astro-api-route"));
}

function discoverApiCandidateFileEndpoints(file, content) {
  if (!isSastApiCandidate(file, content)) return [];
  if (hasExplicitRouteDeclaration(content) || isFileConventionRoute(file)) return [];

  const routePath = inferRoutePathFromFile(file);
  if (!routePath) return [];

  const methods = discoverExportedRouteMethods(content);
  const guardedMethods = discoverMethodGuards(content);
  const inferredMethods = methods.length > 0 ? methods : guardedMethods;

  return (inferredMethods.length > 0 ? inferredMethods : ["GET"]).map((method) => endpoint(method, routePath, file, "sast-api-candidate"));
}

function discoverExportedRouteMethods(content) {
  const methods = new Set();
  const regexes = [
    /\bexport\s+(?:async\s+)?function\s+(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g,
    /\bexport\s+(?:const|let|var)\s+(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\s*=/g
  ];

  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      methods.add(match[1]);
    }
  }

  return [...methods];
}

function discoverMethodGuards(content) {
  const methods = new Set();
  const regex = /\b(?:req|request)\.method\s*(?:===|!==|==|!=)\s*['"`](GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)['"`]/gi;
  let match;

  while ((match = regex.exec(content)) !== null) {
    methods.add(match[1].toUpperCase());
  }

  return [...methods];
}

function collectMountPrefixes(fileContents) {
  const mounts = [];
  const useRegex = /\b[A-Za-z_$][\w$]*\s*\.\s*use\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*(?:([A-Za-z_$][\w$]*)\s*\(|([A-Za-z_$][\w$]*)\b|require\s*\(\s*(['"`])([^'"`]+)\5\s*\))/gi;
  const registerRegex = /\b[A-Za-z_$][\w$]*\s*\.\s*register\s*\(\s*([A-Za-z_$][\w$]*)\b[\s\S]*?\bprefix\s*:\s*(['"`])([^'"`]+)\2/gi;

  for (const { file, content } of fileContents) {
    const localModuleBindings = collectLocalModuleBindings(file, content);
    let match;

    useRegex.lastIndex = 0;
    while ((match = useRegex.exec(content)) !== null) {
      const mount = createUseMount(match, localModuleBindings, file);
      if (mount) mounts.push(mount);
    }

    registerRegex.lastIndex = 0;
    while ((match = registerRegex.exec(content)) !== null) {
      const mount = createNamedMount(match[3], match[1], localModuleBindings);
      if (mount) mounts.push(mount);
    }
  }

  return dedupeMounts(mounts);
}

function collectLocalModuleBindings(file, content) {
  const bindings = new Map();
  const destructuredRequireRegex = /\b(?:const|let|var)\s*\{\s*([^}]+)\s*\}\s*=\s*require\s*\(\s*(['"`])([^'"`]+)\2\s*\)/g;
  const requireRegex = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*\(\s*(['"`])([^'"`]+)\2\s*\)/g;
  const namedImportRegex = /\bimport\s*\{\s*([^}]+)\s*\}\s*from\s*(['"`])([^'"`]+)\2/g;
  const defaultImportRegex = /\bimport\s+([A-Za-z_$][\w$]*)\s+from\s*(['"`])([^'"`]+)\2/g;
  const namespaceImportRegex = /\bimport\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*(['"`])([^'"`]+)\2/g;

  let match;
  while ((match = destructuredRequireRegex.exec(content)) !== null) {
    addNamedBindings(bindings, match[1], resolveLocalModuleFiles(file, match[3]));
  }

  while ((match = requireRegex.exec(content)) !== null) {
    addBinding(bindings, match[1], resolveLocalModuleFiles(file, match[3]));
  }

  while ((match = namedImportRegex.exec(content)) !== null) {
    addNamedBindings(bindings, match[1], resolveLocalModuleFiles(file, match[3]));
  }

  while ((match = defaultImportRegex.exec(content)) !== null) {
    addBinding(bindings, match[1], resolveLocalModuleFiles(file, match[3]));
  }

  while ((match = namespaceImportRegex.exec(content)) !== null) {
    addBinding(bindings, match[1], resolveLocalModuleFiles(file, match[3]));
  }

  return bindings;
}

function addNamedBindings(bindings, bindingList, targetFiles) {
  for (const binding of bindingList.split(",")) {
    const normalized = binding.trim();
    if (!normalized) continue;
    const localName = normalized.includes(" as ")
      ? normalized.split(/\s+as\s+/).pop().trim()
      : normalized.split(":").pop().trim();
    addBinding(bindings, localName, targetFiles);
  }
}

function addBinding(bindings, name, targetFiles) {
  if (!name || targetFiles.length === 0) return;
  bindings.set(name, targetFiles);
}

function createUseMount(match, localModuleBindings, file) {
  const [, , rawPrefix, calledIdentifier, identifier, , requireSpecifier] = match;
  const mountedName = calledIdentifier || identifier;
  if (requireSpecifier) {
    return createMount(rawPrefix, resolveLocalModuleFiles(file, requireSpecifier));
  }
  return createNamedMount(rawPrefix, mountedName, localModuleBindings, Boolean(calledIdentifier));
}

function createNamedMount(rawPrefix, mountedName, localModuleBindings, called = false) {
  const prefix = normalizeRoutePath(rawPrefix);
  if (!prefix || prefix === "/") return null;

  const targetFiles = localModuleBindings.get(mountedName) || [];
  if (targetFiles.length > 0) return { prefix, targetFiles };
  if (!called && isRouterReceiver(mountedName)) return { prefix, targetFiles: [] };

  return null;
}

function createMount(rawPrefix, targetFiles) {
  const prefix = normalizeRoutePath(rawPrefix);
  if (!prefix || prefix === "/" || targetFiles.length === 0) return null;
  return { prefix, targetFiles };
}

function resolveLocalModuleFiles(file, specifier) {
  if (!specifier || !specifier.startsWith(".")) return [];

  const dirname = path.posix.dirname(normalizeFilePath(file));
  const base = path.posix.normalize(path.posix.join(dirname, normalizeFilePath(specifier)));
  if (ROUTE_EXTENSIONS.has(path.posix.extname(base))) return [base];

  return [
    ...[...ROUTE_EXTENSIONS].map((extension) => `${base}${extension}`),
    ...[...ROUTE_EXTENSIONS].map((extension) => `${base}/index${extension}`)
  ];
}

function dedupeMounts(mounts) {
  const byKey = new Map();
  for (const mount of mounts) {
    const key = `${mount.prefix}|${mount.targetFiles.join(",")}`;
    if (!byKey.has(key)) byKey.set(key, mount);
  }
  return [...byKey.values()].sort((a, b) => {
    const byPrefix = a.prefix.localeCompare(b.prefix);
    if (byPrefix !== 0) return byPrefix;
    return a.targetFiles.join(",").localeCompare(b.targetFiles.join(","));
  });
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

function hasApplicableMount(file, mounts) {
  return mounts.some((mount) => mountAppliesToFile(mount, file));
}

function mountAppliesToFile(mount, file) {
  const normalized = normalizeFilePath(file);
  if (mount.targetFiles.length > 0) return mount.targetFiles.includes(normalized);
  return isLikelyRouterModulePath(normalized);
}

function isLikelyRouterModulePath(file) {
  return (
    file.startsWith("routes/") ||
    file.startsWith("api/") ||
    file.includes("/routes/") ||
    file.includes("/api/")
  );
}

function collectRouteReceivers(content) {
  const all = new Set(["app", "server", "router", "apirouter", "routes", "route", "fastify"]);
  const routers = new Set(["router", "apirouter", "routes", "route"]);
  const expressAppRegex = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:express|fastify)\s*\(/g;
  const expressRouterRegex = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:express\s*\.\s*Router|Router)\s*\(/g;

  let match;
  while ((match = expressAppRegex.exec(content)) !== null) {
    all.add(match[1].toLowerCase());
  }

  while ((match = expressRouterRegex.exec(content)) !== null) {
    all.add(match[1].toLowerCase());
    routers.add(match[1].toLowerCase());
  }

  return { all, routers };
}

function isRouteReceiver(value, receivers = collectRouteReceivers("")) {
  const normalized = String(value || "").toLowerCase();
  return receivers.all.has(normalized) || normalized.endsWith("router") || normalized.endsWith("server");
}

function isRouterReceiver(value, receivers = collectRouteReceivers("")) {
  const normalized = String(value || "").toLowerCase();
  return receivers.routers.has(normalized) || normalized.endsWith("router");
}

function isSastApiCandidate(file, content) {
  const normalized = normalizeFilePath(file);
  if (hasVendoredPathSegment(normalized)) return false;

  return (
    isServerOrApiFile(normalized) ||
    normalized.startsWith("api/") ||
    normalized.startsWith("routes/") ||
    normalized.startsWith("handlers/") ||
    normalized.startsWith("controllers/") ||
    normalized.includes("/handlers/") ||
    normalized.includes("/controllers/")
  ) && hasApiHandlerEvidence(content);
}

function hasApiHandlerEvidence(content) {
  return API_HANDLER_EVIDENCE.some((regex) => regex.test(content));
}

function hasVendoredPathSegment(file) {
  return /(?:^|\/)(?:vendor|vendors|third_party|third-party)\//i.test(file);
}

function hasExplicitRouteDeclaration(content) {
  const methods = HTTP_METHODS.join("|");
  return new RegExp(`\\b[A-Za-z_$][\\w$]*\\s*\\.\\s*(?:${methods}|route)\\s*\\(`, "i").test(content);
}

function isFileConventionRoute(file) {
  const normalized = normalizeFilePath(file);
  return (
    /(?:^|\/)(?:src\/)?app\/.+\/route\./.test(normalized) ||
    /(?:^|\/)(?:src\/)?pages\/api\/.+\./.test(normalized) ||
    /(?:^|\/)(?:src\/)?routes\/.+\/\+server\./.test(normalized) ||
    /(?:^|\/)(?:src\/)?server\/api\/.+\./.test(normalized)
  );
}

function inferRoutePathFromFile(file) {
  const normalized = normalizeFilePath(file);
  const withoutExtension = normalized.replace(/\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts)$/, "");
  const patterns = [
    { regex: /(?:^|\/)(?:src\/)?api\/(.+)$/, prefix: "/api/" },
    { regex: /(?:^|\/)(?:src\/)?server\/api\/(.+)$/, prefix: "/api/" },
    { regex: /(?:^|\/)(?:src\/)?routes\/(.+)$/, prefix: "/" },
    { regex: /(?:^|\/)(?:src\/)?server\/routes\/(.+)$/, prefix: "/" },
    { regex: /(?:^|\/)(?:src\/)?handlers\/(.+)$/, prefix: "/" },
    { regex: /(?:^|\/)(?:src\/)?controllers\/(.+)$/, prefix: "/" }
  ];

  for (const { regex, prefix } of patterns) {
    const match = withoutExtension.match(regex);
    if (!match) continue;
    return normalizeRoutePath(`${prefix}${routeSegmentsToPath(match[1])}`);
  }

  return null;
}

function normalizeFilePath(file) {
  return String(file).replace(/\\/g, "/");
}

function normalizeRoutePath(value) {
  if (!value || value.includes("${")) return null;
  const pathValue = value.startsWith("/") ? value : `/${value}`;
  return pathValue.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

function joinRoutePath(prefix, routePath) {
  return normalizeRoutePath(`${prefix}/${routePath.replace(/^\//, "")}`);
}

function routeSegmentsToPath(value) {
  return value
    .split("/")
    .filter(Boolean)
    .filter((segment) => !segment.startsWith("(") && !segment.startsWith("@") && !segment.startsWith("_"))
    .map((segment) => segment.replace(/^\[\[?\.\.\.(.+)]]?$/, ":$1").replace(/^\[(.+)]$/, ":$1"))
    .filter((segment) => segment !== "index")
    .join("/");
}

function isDynamicRoute(routePath) {
  return /(^|\/):[^/]+|\[[^/]+]|\*/.test(routePath);
}
