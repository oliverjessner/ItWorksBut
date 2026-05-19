#!/usr/bin/env node

import { parseArgs } from '../src/cli/parseArgs.js';
import { printUsage, printRuntimeError, printVersion } from '../src/cli/output.js';
import { createScanSpinner, printIntro } from '../src/cli/terminal.js';
import { packageInfo } from '../src/core/packageInfo.js';
import { scanProject } from '../src/core/scanner.js';
import { getExitCode } from '../src/core/findings.js';
import { reportConsole } from '../src/reporters/consoleReporter.js';
import { reportJson } from '../src/reporters/jsonReporter.js';
import { reportSarif } from '../src/reporters/sarifReporter.js';
import { writeTodoReport } from '../src/reporters/todoReporter.js';
import { writeMarkdownReport } from '../src/reporters/markdownReport.js';
import { runStressCommand } from '../src/commands/stress.js';

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printUsage();
        return 0;
    }

    if (args.version) {
        printVersion(`It Works But… version ${packageInfo.version}`);
        return 0;
    }

    if (args.command === 'stress') {
        return await runStressCommand(args);
    }

    if (!['scan', 'deps'].includes(args.command)) {
        printUsage();
        return 2;
    }

    printIntro(args);

    const spinner = createScanSpinner(args);
    if (spinner) spinner.start();

    let result;
    try {
        result = await scanProject({
            rootPath: args.path,
            configPath: args.config,
            failOn: args.failOn,
            verbose: args.verbose,
            categories: args.command === 'deps' ? ['dependencies'] : undefined,
        });
        if (spinner) spinner.succeed('Scan complete. Now the receipts.');
    } catch (error) {
        if (spinner) spinner.fail('Scan stopped before the receipts were printed.');
        throw error;
    }

    if (args.sarif) {
        process.stdout.write(`${JSON.stringify(reportSarif(result), null, 2)}\n`);
    } else if (args.json) {
        process.stdout.write(`${JSON.stringify(reportJson(result), null, 2)}\n`);
    } else if (args.todo) {
        const filePath = await writeTodoReport(result);
        if (!args.quiet) process.stdout.write(`Wrote AI todo file: ${filePath}\n`);
    } else {
        reportConsole(result, args);
    }

    if (args.report) {
        const report = await writeMarkdownReport(result);
        if (!args.json && !args.sarif) {
            const verb = report.overwritten ? 'Overwrote' : 'Wrote';
            process.stdout.write(`${verb} scan report: ${report.filePath}\n`);
        }
    }

    return getExitCode(result.findings, result.config.failOn);
}

main()
    .then(code => {
        process.exitCode = code;
    })
    .catch(error => {
        printRuntimeError(error);
        process.exitCode = 2;
    });
