const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export const STRESS_DEFAULTS = {
  target: "http://localhost:3000",
  duration: 30,
  arrivalRate: 5,
  maxVusers: 50
};

export const STRESS_LIMITS = {
  duration: 300,
  arrivalRate: 50,
  maxVusers: 100
};

export function validateStressOptions(args = {}) {
  const target = normalizeTarget(args.target || STRESS_DEFAULTS.target);
  const parsedTarget = new URL(target);
  const targetPath = getExplicitTargetPath(parsedTarget);
  const duration = parsePositiveNumber(args.duration, STRESS_DEFAULTS.duration, "duration");
  const arrivalRate = parsePositiveNumber(args.arrivalRate, STRESS_DEFAULTS.arrivalRate, "arrival-rate");
  const maxVusers = parsePositiveInteger(args.maxVusers, STRESS_DEFAULTS.maxVusers, "max-vusers");

  assertWithinLimit(duration, STRESS_LIMITS.duration, "duration", "seconds");
  assertWithinLimit(arrivalRate, STRESS_LIMITS.arrivalRate, "arrival-rate", "requests/second");
  assertWithinLimit(maxVusers, STRESS_LIMITS.maxVusers, "max-vusers", "virtual users");

  const local = isLocalTarget(target);
  if (!local && !args.iOwnThis) {
    throw new Error(
      "Refusing to stress-test an external target without --i-own-this. Only run this against systems you own or are explicitly authorized to test."
    );
  }

  return {
    target,
    artilleryTarget: targetPath ? parsedTarget.origin : target,
    targetPath,
    duration,
    arrivalRate,
    maxVusers,
    iOwnThis: Boolean(args.iOwnThis),
    local
  };
}

export function isLocalTarget(target) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return false;
  }

  return LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
}

function normalizeTarget(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid stress target URL: ${value}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Stress target must use http:// or https://.");
  }

  return parsed.toString().replace(/\/$/, "");
}

function getExplicitTargetPath(parsed) {
  const pathname = parsed.pathname.replace(/\/$/, "") || "/";
  if (pathname === "/" && !parsed.search) return null;
  return `${pathname}${parsed.search}`;
}

function parsePositiveNumber(value, fallback, label) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`Invalid --${label}: expected a positive number.`);
  }
  return number;
}

function parsePositiveInteger(value, fallback, label) {
  const number = parsePositiveNumber(value, fallback, label);
  if (!Number.isInteger(number)) {
    throw new Error(`Invalid --${label}: expected a positive integer.`);
  }
  return number;
}

function assertWithinLimit(value, limit, label, unit) {
  if (value > limit) {
    throw new Error(`Refusing --${label} ${value}. Maximum allowed is ${limit} ${unit}.`);
  }
}
