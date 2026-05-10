import { SEVERITIES } from '../core/config.js';
import { countBySeverity, getExitCode } from '../core/findings.js';
import { isFancyOutputEnabled, getChalk } from '../cli/terminal.js';
import {
    formatSeverity,
    getConsoleFindingTitle,
    getFixPrompt,
    getShipStatus,
    renderSummaryBox,
    renderSummaryTable,
} from './consoleStyle.js';

export function reportConsole(result, options = {}) {
    const { findings, warnings, config, meta } = result;
    const counts = countBySeverity(findings);
    const colors = getChalk(options);
    const rich = isFancyOutputEnabled(options);

    if (!options.quiet && !rich) {
        process.stdout.write(`${colors.bold('ItWorksBut receipts')}\n\n`);
    }

    if (!options.quiet && findings.length === 0) {
        process.stdout.write(
            `${colors.green ? colors.green('Suspiciously clean. No findings.') : 'Suspiciously clean. No findings.'}\n\n`,
        );
    } else if (!options.quiet) {
        for (const severity of SEVERITIES) {
            const group = findings.filter(finding => finding.severity === severity);
            if (group.length === 0) continue;

            for (const finding of group) {
                writeFinding(finding, options);
            }
            process.stdout.write('\n');
        }
    }

    if (options.verbose && warnings.length > 0) {
        process.stdout.write('WARNINGS\n');
        for (const warning of warnings) {
            process.stdout.write(`- [${warning.checkId}] ${warning.message}\n`);
        }
        process.stdout.write('\n');
    }

    const exitCode = getExitCode(findings, config.failOn);
    writeSummary({ counts, total: findings.length, failOn: config.failOn, exitCode }, options);

    if (options.verbose) {
        process.stdout.write(`- files scanned: ${meta.filesScanned}\n`);
        process.stdout.write(`- text files scanned: ${meta.textFilesScanned}\n`);
        process.stdout.write(`- git available: ${meta.gitAvailable}\n`);
        process.stdout.write(`- warnings: ${warnings.length}\n`);
    }
}

function writeFinding(finding, options) {
    const colors = getChalk(options);
    const severity = formatSeverity(finding.severity, options);
    const title = getConsoleFindingTitle(finding);
    const location = finding.file ? (finding.line ? `${finding.file}:${finding.line}` : finding.file) : '';

    if (options.compact) {
        const where = location ? `${location} - ` : '';
        process.stdout.write(`${severity.compactText} ${finding.checkId} ${where}${title}\n`);
        return;
    }

    process.stdout.write(
        `${severity.text}  ${colors.bold(title)}${finding.heuristic ? colors.gray(' (heuristic)') : ''}\n`,
    );
    process.stdout.write(`   ✔ Check: ${finding.checkId}\n`);
    if (location) process.stdout.write(`   📁 File:  ${location}\n`);
    process.stdout.write(`   🤔 Why:   ${finding.message}\n`);
    process.stdout.write(`   🤖 Prompt:   ${getFixPrompt(finding)}\n`);

    if (options.verbose) {
        process.stdout.write(`   Category: ${finding.category || 'unknown'}\n`);
        if (finding.tags?.length) process.stdout.write(`   Tags:     ${finding.tags.join(', ')}\n`);
        if (finding.line) process.stdout.write(`   Line:     ${finding.line}\n`);
        const evidence = safeEvidence(finding);
        if (evidence) process.stdout.write(`   Evidence: ${evidence}\n`);
    }

    process.stdout.write('\n');
}

function writeSummary({ counts, total, failOn, exitCode }, options) {
    const colors = getChalk(options);
    const ship = getShipStatus(counts);

    if (isFancyOutputEnabled(options)) {
        process.stdout.write(`${renderSummaryBox(counts, options)}\n`);
        process.stdout.write(`${renderSummaryTable(counts, options)}\n`);
        process.stdout.write(`\nFail-on: ${failOn} | Exit decision: ${exitCode}\n`);
        return;
    }

    process.stdout.write('SUMMARY\n');
    process.stdout.write(`- ship status: ${colors.bold(ship.status)}\n`);
    process.stdout.write(`- ${ship.tone}\n`);
    process.stdout.write(`- total findings: ${total}\n`);
    for (const severity of SEVERITIES) {
        process.stdout.write(`- ${severity}: ${counts[severity]}\n`);
    }
    process.stdout.write(`- fail-on: ${failOn}\n`);
    process.stdout.write(`- exit decision: ${exitCode}\n`);
}

function safeEvidence(finding) {
    const metadata = finding.metadata || {};
    if (metadata.secretType) return `secret type: ${metadata.secretType}; value redacted`;
    if (metadata.pattern) return `pattern: ${metadata.pattern}`;
    if (metadata.routePath) return `route: ${metadata.routePath}`;
    if (metadata.envName) return `environment variable name: ${metadata.envName}`;
    return '';
}
