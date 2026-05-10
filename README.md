# ItWorksBut

ItWorksBut is a Node.js CI tool for static checks in JavaScript, Node.js, web, Tauri, and Electron vibe coding projects.

It focuses on common "it works, but..." risks often found in AI-generated or rushed prototypes: committed env files, missing lockfiles, weak CI, unsafe web APIs, broad desktop permissions, and similar issues.

It only reads files and reports findings. It does not call external APIs, does not send telemetry, and does not modify the scanned project.

## Installation

```sh
npx itworksbut scan
```

### Homebrew

After the formula is committed to the tap, install with:

```sh
brew tap oliverjessner/tap
brew install itworksbut
itworksbut scan
```

One-line install:

```sh
brew install oliverjessner/tap/itworksbut
```

The `itworksbut` formula belongs in the Homebrew tap repo, not in this app repo:

```text
https://github.com/oliverjessner/homebrew-tap
└── Formula/
    └── itworksbut.rb
```

This repository contains a one-command release script. It runs checks, publishes the npm package, generates the Homebrew formula, commits it to the tap, and pushes the tap:

```sh
npm login
npm run publish
```

Do not run `npm publish` directly. The package blocks direct npm publishing so the Homebrew tap cannot be forgotten.

Preview everything without publishing:

```sh
npm run publish -- --dry-run
```

By default the script expects the tap checkout at `../homebrew-tap`. Override it when needed:

```sh
npm run publish -- --tap-path /path/to/homebrew-tap
```

Use `--no-push` when you want the script to commit the tap formula but leave the push to you.

## Local Usage

```sh
node ./bin/itworksbut.js scan
node ./bin/itworksbut.js scan --json
node ./bin/itworksbut.js scan --sarif
node ./bin/itworksbut.js scan --fail-on high
node ./bin/itworksbut.js scan --config itworksbut.config.json
node ./bin/itworksbut.js scan --path .
node ./bin/itworksbut.js scan --verbose
```

`scan` is intentionally the strict/default path: all checks are enabled, only heavy generated folders are skipped, and the default `fail-on` threshold is `low` so more issues fail early. Use `--config` only when you deliberately want to tune or suppress checks.

## Terminal Experience

Normal console output is intentionally more opinionated than the machine-readable reporters:

```sh
node ./bin/itworksbut.js scan --theme toxic
```

Console-only flags:

- `--no-color`
- `--no-banner`
- `--no-spinner`
- `--compact`
- `--quiet`
- `--verbose`
- `--theme default|toxic|mono`

In CI, spinners and banners are automatically disabled. With `--json` and `--sarif`, stdout contains only valid machine-readable output. The edgy tone applies only to the Console Reporter.

Exit codes:

- `0`: no findings at or above the configured `fail-on` severity
- `1`: at least one finding at or above the configured `fail-on` severity
- `2`: tool/runtime error

Severity levels are `critical`, `high`, `medium`, `low`, and `info`.

## GitHub Actions

```yaml
name: ItWorksBut

on:
    pull_request:
    push:
        branches: [main]

jobs:
    scan:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: 20
                  cache: npm
            - run: npm ci
            - run: node ./bin/itworksbut.js scan --fail-on high
```

For GitHub Code Scanning-style output:

```sh
node ./bin/itworksbut.js scan --sarif > itworksbut.sarif
```

## Configuration

Optional `itworksbut.config.json`:

```json
{
    "ignore": ["dist/**", "build/**", "node_modules/**"],
    "failOn": "low",
    "checks": {
        "env.env-file-tracked": true,
        "dependencies.lockfile-missing": true,
        "node.rate-limit-missing": false
    }
}
```

Checks are enabled by default. Set a check id to `false` to disable it.

This repository also has `itworksbut.self.config.json` for its own CI run. It ignores intentional test fixtures and scanner regex files. Do not use that profile if you want the highest finding rate.

Default ignored paths:

```text
node_modules/**
dist/**
build/**
.next/**
.nuxt/**
coverage/**
.git/**
target/**
src-tauri/target/**
out/**
release/**
.vite/**
```

## Example Output

```text
✖  CRITICAL  It works, but your .env is tracked.
   Check: env.env-file-tracked
   File:  .env
   Why:   .env appears to be tracked by git. Secrets may be exposed.
   Fix:   Remove it from git index, rotate secrets, and commit .env.example.

▲  HIGH  It works, but your SQL query is one template string away from pain.
   Check: database.raw-sql-interpolation
   File:  src/db.js:12
   Why:   Possible SQL injection risk: raw SQL appears to be built with template string interpolation.
   Fix:   Use parameterized queries, prepared statements, or ORM query builders instead of interpolating values into SQL strings.

SUMMARY
- ship status: DO NOT SHIP
- Fix the red stuff before production.
- total findings: 2
- critical: 1
- high: 1
- medium: 0
- low: 0
- info: 0
- fail-on: high
- exit decision: 1
```

Secret-like findings never print the full secret value. Findings report the file, line, and secret type where possible.

## What It Detects

The baseline includes 30 modular checks:

- `git.gitignore-missing`
- `git.gitignore-incomplete`
- `git.ignored-files-tracked`
- `env.env-file-tracked`
- `env.env-example-missing`
- `env.possible-secret-in-code`
- `env.frontend-secret-exposure`
- `dependencies.lockfile-missing`
- `dependencies.multiple-lockfiles`
- `dependencies.install-scripts-risk`
- `dependencies.audit-script-missing`
- `package.scripts-missing`
- `ci.no-ci-config`
- `ci.npm-install-instead-of-npm-ci`
- `ci.no-build-step`
- `ci.no-test-step`
- `node.express-json-limit-missing`
- `node.rate-limit-missing`
- `node.helmet-missing`
- `node.cors-wildcard`
- `web.client-side-auth-only`
- `web.dangerous-inner-html`
- `web.missing-output-sanitization`
- `api.missing-auth-on-routes`
- `api.idor-risk`
- `database.raw-sql-interpolation`
- `database.no-migrations`
- `electron.node-integration-enabled`
- `electron.context-isolation-disabled`
- `tauri.dangerous-allowlist-or-capabilities`

Each check is a plain ESM module with an `id`, metadata, and async `run(context)` function. Add new checks under `src/checks/` and register them in `src/checks/index.js`.

## What It Does Not Guarantee

ItWorksBut is a static heuristic scanner, not a pentest, SAST replacement, dependency vulnerability database, or runtime security monitor. Findings intentionally use wording such as "possible", "potential", and "appears to" when a check is heuristic.

Use it as a CI guardrail for common project hygiene and security mistakes. For production systems, combine it with code review, tests, dependency scanning, secrets scanning, threat modeling, and focused security assessment.
