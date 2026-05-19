import path from "node:path";
import { validateStressOptions } from "../utils/targetSafety.js";
import { discoverEndpoints } from "../stress/discoverEndpoints.js";
import { createArtilleryConfig } from "../stress/stressConfig.js";
import { runArtillery } from "../stress/artilleryRunner.js";
import { parseArtilleryResult } from "../stress/stressResultParser.js";
import { reportStressConsole } from "../stress/stressRenderer.js";
import { writeStressMarkdownReport } from "../reporters/stressMarkdownReport.js";

export async function runStressCommand(args, options = {}) {
  if (args.todo || args.sarif) {
    throw new Error("The stress command supports console output, --json, and --report.");
  }

  const result = await runStress({
    rootPath: path.resolve(args.path || "."),
    ...validateStressOptions(args)
  }, options);

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    reportStressConsole(result, args);
  }

  if (args.report) {
    const report = await writeStressMarkdownReport(result);
    if (!args.json && !args.quiet) {
      const verb = report.overwritten ? "Overwrote" : "Wrote";
      process.stdout.write(`${verb} stress report: ${report.filePath}\n`);
    }
  }

  return result.status === "fail" ? 1 : 0;
}

export async function runStress(options, runnerOptions = {}) {
  const startedAt = new Date();
  const discovery = withExplicitTargetEndpoint(await discoverEndpoints(options.rootPath), options.targetPath);
  const baseDetails = {
    target: options.target,
    artilleryTarget: options.artilleryTarget || options.target,
    duration: options.duration,
    arrivalRate: options.arrivalRate,
    maxVusers: options.maxVusers,
    endpointsFound: discovery.endpoints.length,
    safeEndpoints: discovery.safeEndpoints.length,
    skippedEndpoints: discovery.skippedEndpoints,
    startedAt: startedAt.toISOString()
  };

  if (discovery.endpoints.length === 0) {
    return stressResult({
      status: "skip",
      summary: "No API endpoints found.",
      details: {
        ...baseDetails,
        testedEndpoints: [],
        warnings: 0,
        failed: 0,
        completedAt: new Date().toISOString()
      }
    });
  }

  if (discovery.safeEndpoints.length === 0) {
    return stressResult({
      status: "fail",
      summary: "No safe GET/HEAD endpoints can be tested automatically.",
      details: {
        ...baseDetails,
        testedEndpoints: [],
        warnings: 0,
        failed: 1,
        completedAt: new Date().toISOString()
      }
    });
  }

  const config = createArtilleryConfig({
    target: options.artilleryTarget || options.target,
    duration: options.duration,
    arrivalRate: options.arrivalRate,
    maxVusers: options.maxVusers,
    endpoints: discovery.safeEndpoints
  });

  const artillery = await runArtillery(config, {
    rootPath: options.rootPath,
    duration: options.duration,
    ...runnerOptions
  });
  const parsed = parseArtilleryResult(artillery, discovery.safeEndpoints);

  return stressResult({
    status: parsed.status,
    summary: parsed.summary,
    details: {
      ...baseDetails,
      testedEndpoints: parsed.testedEndpoints,
      warnings: parsed.warnings,
      failed: parsed.failed,
      artilleryError: parsed.error,
      completedAt: new Date().toISOString()
    }
  });
}

function stressResult(result) {
  return {
    id: "stress-test",
    title: "API stress test",
    ...result
  };
}

function withExplicitTargetEndpoint(discovery, targetPath) {
  if (!targetPath) return discovery;
  if (discovery.endpoints.some((endpoint) => endpoint.method === "GET" && endpoint.path === targetPath)) {
    return discovery;
  }

  const explicitEndpoint = {
    method: "GET",
    path: targetPath,
    source: "--target",
    type: "explicit-target",
    dynamic: false,
    status: "selected"
  };

  return {
    status: "pass",
    endpoints: sortEndpoints([...discovery.endpoints, explicitEndpoint]),
    safeEndpoints: sortEndpoints([...discovery.safeEndpoints, explicitEndpoint]),
    skippedEndpoints: discovery.skippedEndpoints
  };
}

function sortEndpoints(endpoints) {
  return [...endpoints].sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
}
