import boxen from 'boxen';
import Table from 'cli-table3';
import { SEVERITIES } from '../core/config.js';
import { getChalk } from '../cli/terminal.js';

const EDGY_TITLES = {
    'env.env-file-tracked': 'It works, but your .env is tracked.',
    'env.possible-secret-in-code': 'It works, but your repo may be leaking secrets.',
    'env.frontend-secret-exposure': 'It works, but your frontend env variable smells like a backend secret.',
    'secrets.secrets-in-logs': 'It works, but your logs may be leaking secrets.',
    'git.gitignore-missing': 'It works, but your repo forgot what not to commit.',
    'git.gitignore-incomplete': 'It works, but your .gitignore has holes.',
    'git.ignored-files-tracked': 'It works, but Git is already tracking files you meant to ignore.',
    'dependencies.lockfile-missing': 'It works on your machine, but your dependency tree is not locked.',
    'dependencies.multiple-lockfiles': 'It works, but your package managers are fighting.',
    'ci.no-ci-config': 'It works, but nobody checks it before it ships.',
    'ci.npm-install-instead-of-npm-ci': 'It works, but your CI is installing instead of reproducing.',
    'ci.no-test-step': 'It works, but your CI is basically decorative.',
    'node.express-json-limit-missing': 'It works, but your API accepts oversized bodies.',
    'node.rate-limit-missing': 'It works, but your endpoints have no brakes.',
    'node.helmet-missing': 'It works, but your HTTP headers are underdressed.',
    'node.cors-wildcard': 'It works, but CORS is holding the door open.',
    'node.child-process-user-input': 'It works, but your shell command trusts the internet.',
    'web.dangerous-inner-html': 'It works, but your frontend is injecting HTML with sharp edges.',
    'api.missing-auth-on-routes': 'It works, but this API route appears to trust strangers.',
    'api.idor-risk': 'It works, but this ID lookup may belong to someone else.',
    'auth.jwt-secret-weak-or-fallback': 'It works, but your JWT secret has a fallback key.',
    'auth.password-hashing-missing': 'It works, but your passwords may be stored too honestly.',
    'auth.missing-csrf-protection': 'It works, but your browser may be submitting forms behind your back.',
    'api.missing-method-guard': 'It works, but your API does not care how it gets called.',
    'api.mass-assignment-risk': 'It works, but your users may be editing fields they should never touch.',
    'api.no-schema-validation': 'It works, but your API believes whatever the request says.',
    'database.raw-sql-interpolation': 'It works, but your SQL query is one template string away from pain.',
    'database.no-migrations': 'It works, but your database schema has no paper trail.',
    'cookies.insecure-session-cookie': 'It works, but your session cookie is dressed for localhost.',
    'uploads.public-executable-upload': 'It works, but your uploads are sitting in the front window.',
    'webhooks.missing-raw-body': 'It works, but your webhook signature check may be checking the wrong body.',
    'llm.prompt-injection-risk': 'It works, but your AI output has admin energy.',
    'frontend.sourcemaps-production': 'It works, but your source code may be shipping with the app.',
    'frontend.localstorage-token': 'It works, but your auth token lives where XSS can read it.',
    'files.path-traversal-risk': 'It works, but your file path may be taking requests too literally.',
    'ssrf.user-controlled-fetch': 'It works, but your server is fetching whatever strangers ask for.',
    'next.public-server-code-risk': 'It works, but your client component is carrying server baggage.',
    'config.debug-production': 'It works, but production still thinks it is a dev server.',
    'electron.node-integration-enabled': 'It works, but Electron is holding the Node.js door open.',
    'electron.context-isolation-disabled': 'It works, but your renderer and backend are sharing a room.',
    'electron.remote-content-with-node': 'It works, but Electron is letting the internet sit next to Node.js.',
    'tauri.dangerous-allowlist-or-capabilities': 'It works, but your Tauri permissions look too generous.',
    'tauri.remote-url-permissions-risk': 'It works, but your Tauri app is trusting too much surface area.',
};

const SEVERITY_META = {
    critical: { symbol: '✖', label: 'CRITICAL' },
    high: { symbol: '▲', label: 'HIGH' },
    medium: { symbol: '◆', label: 'MEDIUM' },
    low: { symbol: '•', label: 'LOW' },
    info: { symbol: 'i', label: 'INFO' },
};

const FIX_PROMPT_ACTIONS = {
    'env.env-file-tracked':
        'Remove tracked env files from git, add safe examples such as .env.example, and make sure any exposed credentials are treated as compromised.',
    'env.possible-secret-in-code':
        'Move hardcoded secret material into a runtime secret store or CI secret, replace committed values with placeholders, and avoid printing secret values anywhere.',
    'env.frontend-secret-exposure':
        'Move secret-like frontend environment variables to server-side code and keep only intentionally public values behind public prefixes.',
    'secrets.secrets-in-logs':
        'Remove sensitive logging, mask secrets, and log only explicit non-sensitive fields.',
    'git.gitignore-missing':
        'Add a project-appropriate .gitignore for dependencies, local env files, build output, logs, databases, OS files, and coverage artifacts.',
    'git.gitignore-incomplete':
        'Update .gitignore with the missing high-risk patterns without removing existing project-specific ignores.',
    'git.ignored-files-tracked':
        'Stop tracking generated or local-only files that match ignore rules and preserve the files locally when appropriate.',
    'dependencies.lockfile-missing':
        'Generate and commit exactly one package-manager lockfile for the package manager used by the project.',
    'dependencies.multiple-lockfiles':
        'Keep the lockfile for the package manager the project actually uses and remove competing lockfiles.',
    'dependencies.install-scripts-risk':
        'Review install lifecycle scripts, remove them if unnecessary, or document and constrain them so CI installs stay predictable.',
    'dependencies.audit-script-missing':
        'Add a dependency audit or security script and wire it into CI without breaking existing scripts.',
    'package.scripts-missing':
        'Add the missing standard package scripts using the existing tooling and naming conventions in this project.',
    'ci.no-ci-config': 'Add a CI workflow that installs from the lockfile and runs checks, tests, and build steps.',
    'ci.npm-install-instead-of-npm-ci':
        'Replace npm install with npm ci in CI jobs unless the command is intentionally global installation.',
    'ci.no-build-step': "Add a build step to CI using the project's existing package scripts.",
    'ci.no-test-step': "Add a test step to CI using the project's existing test command.",
    'node.express-json-limit-missing':
        'Add explicit body size limits to express.json middleware and keep route behavior intact.',
    'node.rate-limit-missing':
        'Add appropriate rate limiting for API routes, especially authentication and write endpoints.',
    'node.helmet-missing':
        'Install and apply Helmet or equivalent security headers early in the Express middleware stack.',
    'node.cors-wildcard':
        'Restrict CORS origins to trusted application origins and avoid wildcard or credentials-unsafe configurations.',
    'node.child-process-user-input':
        'Avoid shell execution with user input. Use spawn with fixed command and argument arrays, validate against allowlists, and never concatenate shell strings.',
    'web.client-side-auth-only':
        'Move authorization enforcement to server-side API or route handlers and keep frontend checks as UI-only hints.',
    'web.dangerous-inner-html':
        'Remove direct HTML injection or add proven sanitization at the trust boundary before rendering.',
    'web.missing-output-sanitization': 'Escape or sanitize user-controlled output before it reaches HTML responses.',
    'api.missing-auth-on-routes':
        'Add explicit authentication and authorization to the route, or document why the route is intentionally public.',
    'api.idor-risk':
        'Scope object access by authenticated user, owner, tenant, account, or organization in addition to object id.',
    'auth.jwt-secret-weak-or-fallback':
        'Require a strong JWT secret from the environment in production and fail startup if it is missing.',
    'auth.password-hashing-missing':
        'Hash passwords with argon2, bcrypt, scrypt or PBKDF2 before storage. Never store raw passwords.',
    'auth.missing-csrf-protection':
        'Use SameSite cookies, CSRF tokens or another explicit CSRF mitigation for state-changing routes.',
    'api.missing-method-guard':
        'Restrict API routes to the intended HTTP methods and return 405 Method Not Allowed for unsupported methods.',
    'api.mass-assignment-risk':
        'Whitelist allowed fields explicitly. Never pass req.body directly into database create/update calls.',
    'api.no-schema-validation':
        'Validate request body, query and params with a schema library such as Zod, Joi, Valibot, AJV or equivalent.',
    'database.raw-sql-interpolation':
        'Replace SQL string interpolation or concatenation with parameterized queries, prepared statements, or a safe ORM query builder.',
    'database.no-migrations': 'Add versioned database migrations that match the detected ORM or database stack.',
    'cookies.insecure-session-cookie':
        'Set httpOnly, secure and sameSite for session cookies. Use secure: true in production.',
    'uploads.public-executable-upload':
        'Store uploads outside the public web root, validate MIME type and extension, enforce file size limits, and serve files through controlled routes.',
    'webhooks.missing-raw-body':
        'Use a raw body parser for signed webhook routes and register it before JSON parsing middleware.',
    'llm.prompt-injection-risk':
        'Treat model output as untrusted input. Validate with schemas, use allowlists, require human approval for dangerous actions, and never execute raw model output.',
    'frontend.sourcemaps-production':
        'Disable public production source maps unless intentionally needed. If needed, upload them privately to error tracking instead of serving them publicly.',
    'frontend.localstorage-token':
        'Prefer secure, httpOnly cookies for session tokens where appropriate. If browser storage is unavoidable, minimize token lifetime and harden XSS protections.',
    'files.path-traversal-risk':
        'Normalize and validate paths, use allowlists, reject traversal sequences, and ensure resolved paths stay inside an intended base directory.',
    'ssrf.user-controlled-fetch':
        'Use strict URL allowlists, block private/internal IP ranges including 127.0.0.1, localhost, 169.254.169.254 and RFC1918 ranges, and avoid fetching arbitrary user-provided URLs.',
    'next.public-server-code-risk':
        'Move database, filesystem, secret and server-only logic into Server Components, API routes or server actions. Keep Client Components free of backend dependencies.',
    'config.debug-production':
        'Disable verbose errors and debug flags in production. Avoid exposing stack traces, internal paths or development tooling.',
    'electron.node-integration-enabled':
        'Set nodeIntegration to false and expose only narrowly scoped APIs through preload.',
    'electron.context-isolation-disabled':
        'Enable contextIsolation and review preload boundaries for renderer-to-main communication.',
    'electron.remote-content-with-node':
        'Avoid loading remote content with Node.js integration. Use nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true and a minimal preload bridge.',
    'tauri.dangerous-allowlist-or-capabilities':
        'Tighten Tauri allowlists, capabilities, scopes, shell access, filesystem access, remote URLs, and CSP.',
    'tauri.remote-url-permissions-risk':
        'Use least-privilege capabilities, restrict shell/fs/http permissions, avoid broad wildcards, and configure a strict CSP.',
};

export function getConsoleFindingTitle(finding) {
    if (EDGY_TITLES[finding.checkId]) return EDGY_TITLES[finding.checkId];
    if (finding.heuristic) return `It works, but this pattern may be risky: ${finding.title || finding.checkId}.`;
    return `It works, but ${lowercaseFirst(finding.title || finding.message || finding.checkId)}.`;
}

export function getFixPrompt(finding) {
    const location = finding.file
        ? `${finding.file}${finding.line ? `:${finding.line}` : ''}`
        : 'the affected project files';
    const action =
        FIX_PROMPT_ACTIONS[finding.checkId] ||
        finding.recommendation ||
        'Fix the underlying issue without suppressing the scanner.';
    const heuristic = finding.heuristic
        ? 'This finding is heuristic, so inspect the code first and only change behavior when the risk is real.'
        : 'Treat this as a concrete finding.';
    const secretSafety = isSecretFinding(finding)
        ? 'Do not print, log, or preserve raw secret values; use placeholders only.'
        : '';
    const recommendation = finding.recommendation ? `Existing recommendation: ${finding.recommendation}` : '';

    return collapseWhitespace(
        [
            'You are a senior security engineer working in this repository.',
            `Fix the ItWorksBut finding ${finding.checkId} at ${location}.`,
            heuristic,
            `Problem: ${finding.message}`,
            `Required change: ${action}`,
            recommendation,
            secretSafety,
            'Keep existing behavior intact where possible, add or update focused tests when useful, and do not silence the check unless the underlying risk is actually fixed.',
        ]
            .filter(Boolean)
            .join(' '),
    );
}

export function formatSeverity(severity, options = {}) {
    const colors = getChalk(options);
    const meta = SEVERITY_META[severity] || SEVERITY_META.info;
    const raw = `${meta.symbol}  ${meta.label}`;

    if (options.noColor) {
        return {
            ...meta,
            text: colors.bold(raw),
            shortText: colors.bold(`${meta.symbol} ${meta.label}`),
        };
    }

    const stylers = {
        critical: value => colors.bgRed.white.bold(value),
        high: value => colors.red.bold(value),
        medium: value => colors.yellow.bold(value),
        low: value => colors.blue(value),
        info: value => colors.gray(value),
    };

    const style = stylers[severity] || stylers.info;
    return {
        ...meta,
        text: style(raw),
        shortText: style(`${meta.symbol} ${meta.label}`),
    };
}

export function getShipStatus(counts) {
    if (counts.critical > 0) {
        return {
            status: 'DO NOT SHIP',
            tone: 'Fix the red stuff before production.',
            severity: 'critical',
        };
    }
    if (counts.high > 0) {
        return {
            status: 'FIX BEFORE SHIP',
            tone: "Just copy the text from '🤖 Prompt:' and shove it into your AI.",
            severity: 'high',
        };
    }
    if (counts.medium > 0) {
        return {
            status: 'SHIP WITH CAUTION',
            tone: 'You can ship, but future-you will ask questions.',
            severity: 'medium',
        };
    }
    return {
        status: 'SHIP IT, BUT STAY PARANOID',
        tone: 'Suspiciously clean. Ship it, but stay paranoid.',
        severity: 'info',
    };
}

export function renderSummaryBox(counts, options = {}) {
    const colors = getChalk(options);
    const ship = getShipStatus(counts);
    const severity = formatSeverity(ship.severity, options);
    const content = [
        colors.bold('It works, but...'),
        '',
        `Ship status: ${severity.label === 'INFO' ? colors.bold(ship.status) : severityColor(ship.status, ship.severity, colors)}`,
        `Critical: ${counts.critical}`,
        `High:     ${counts.high}`,
        `Medium:   ${counts.medium}`,
        '',
        ship.tone,
    ].join('\n');

    return boxen(content, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor:
            ship.severity === 'critical' || ship.severity === 'high'
                ? 'red'
                : ship.severity === 'medium'
                  ? 'yellow'
                  : 'green',
    });
}

export function renderSummaryTable(counts, options = {}) {
    const table = new Table({
        head: ['Severity', 'Count'],
        style: {
            head: [],
            border: [],
        },
    });

    for (const severity of SEVERITIES) {
        const formatted = formatSeverity(severity, options);
        table.push([formatted.shortText, counts[severity]]);
    }

    return table.toString();
}

function severityColor(value, severity, colors) {
    if (severity === 'critical') return colors.bgRed.white.bold(value);
    if (severity === 'high') return colors.red.bold(value);
    if (severity === 'medium') return colors.yellow.bold(value);
    return colors.bold(value);
}

function lowercaseFirst(value) {
    if (!value) return value;
    const normalized = String(value).replace(/\.$/, '');
    return `${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
}

function isSecretFinding(finding) {
    return (
        finding.category === 'env' ||
        finding.tags?.some(tag => /secret|token|credential/i.test(tag)) ||
        Boolean(finding.metadata?.secretType)
    );
}

function collapseWhitespace(value) {
    return String(value).replace(/\s+/g, ' ').trim();
}
