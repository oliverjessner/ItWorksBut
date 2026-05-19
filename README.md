# ItWorksBut

ItWorksBut is a Node.js CI tool for static checks in JavaScript, Node.js, web, Tauri, and Electron vibe coding projects.

It focuses on common "it works, but..." risks often found in AI-generated or rushed prototypes: committed env files, missing lockfiles, weak CI, unsafe web APIs, broad desktop permissions, and similar issues.

For every finding, ItWorksBut gives you a copy-ready fix prompt you can paste into your coding agent. It does not just say what is wrong; it tells your AI exactly what to inspect, what to change, and what not to leak.

It mostly reads files and reports findings. It does not send telemetry. The outdated-package check may invoke your local package manager, and the CLI only writes files when you explicitly ask for `todo.md` with `--todo` or `report.md` with `--report`.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Options](#options)
- [Terminal Experience](#terminal-experience)
- [GitHub Actions](#github-actions)
- [Configuration](#configuration)
- [Example Output](#example-output)
- [What It Detects](#what-it-detects)
- [What It Does Not Guarantee](#what-it-does-not-guarantee)

## Installation

```sh
npm install --global itworksbut
itworksbut scan
```

### Homebrew

With the Homebrew tap:

```sh
brew tap oliverjessner/tap
brew install itworksbut
itworksbut scan
```

## Quick Start

```sh
itworksbut scan
```

`scan` is intentionally the strict/default path: all checks are enabled, only heavy generated folders are skipped, and the default `fail-on` threshold is `low` so more issues fail early. Use `--config` only when you deliberately want to tune or suppress checks.

Common commands:

```sh
itworksbut scan --path .
itworksbut deps
itworksbut stress
itworksbut scan --fail-on high
itworksbut scan --json
itworksbut scan --sarif > itworksbut.sarif
itworksbut scan --todo
itworksbut scan --report
itworksbut scan --config itworksbut.config.json
itworksbut scan --verbose
itworksbut --version
```

## Options

```text
itworksbut scan [options]
itworksbut deps [options]
itworksbut stress [options]
```

- `deps`: Run only dependency checks, including lockfile hygiene, install-script risk, audit script availability, and outdated packages.
- `stress`: Discover API endpoints and run a controlled Artillery load test against local or explicitly authorized targets.
- `--path <path>`: Scan a specific project directory. Defaults to the current directory.
- `--config <path>`: Use a custom config file. Defaults to `itworksbut.config.json` when present.
- `--fail-on <severity>`: Exit with code `1` when a finding at or above the severity exists. Levels: `critical`, `high`, `medium`, `low`, `info`. Default: `low`.
- `--target <url>`: Stress-test target. Defaults to `http://localhost:3000`. External targets require `--i-own-this`.
- `--duration <seconds>`: Stress-test duration. Default `30`, maximum `300`.
- `--arrival-rate <number>`: Arrival rate in requests per second. Default `5`, maximum `50`.
- `--max-vusers <number>`: Virtual user cap. Default `50`, maximum `100`.
- `--i-own-this`: Required for non-local stress-test targets.
- `--json`: Print machine-readable JSON only. No banner, colors, spinner, table, or extra text.
- `--sarif`: Print SARIF JSON for GitHub Code Scanning. No banner, colors, spinner, table, or extra text.
- `--todo`: Write an AI-ready `todo.md` into the scanned project with prioritized findings, fix prompts, and acceptance criteria.
- `--report`: Write a Markdown `report.md` into the current working directory.
- `--verbose`: Include scanner warnings and extra metadata in console output.
- `--quiet`: Print only the summary.
- `--no-color`: Disable colored output.
- `--no-banner`: Disable the ASCII intro banner.
- `--version`, `-v`: Print the installed ItWorksBut version.

Exit codes:

- `0`: no findings at or above the configured `fail-on` severity
- `1`: at least one finding at or above the configured `fail-on` severity
- `2`: tool/runtime error

Severity levels are `critical`, `high`, `medium`, `low`, and `info`.

## Terminal Experience

Normal console output is intentionally more opinionated than the machine-readable reporters:

```sh
itworksbut scan
```

Console-only flags:

- `--no-color`
- `--no-banner`
- `--quiet`
- `--verbose`

In CI, spinners and banners are automatically disabled. With `--json` and `--sarif`, stdout contains only valid machine-readable output. The edgy tone applies only to the Console Reporter.

To create a fix list for a coding agent:

```sh
itworksbut scan --todo
```

This writes `todo.md` to the scanned project. The file is ordered by severity and includes agent rules, exact fix prompts, locations, recommendations, and final verification checkboxes.

To create a Markdown scan report:

```sh
itworksbut scan --report
```

This writes `report.md` to the current working directory with check statuses, summaries, details, and recommendations.

To run a controlled API stress test:

```sh
itworksbut stress
itworksbut stress --target https://my-own-api.example --i-own-this
itworksbut stress --report
```

`stress` only tests local targets by default. For external hosts, pass `--i-own-this` to confirm that you own the target or have explicit authorization. Mutating endpoints such as `POST`, `PUT`, `PATCH`, and `DELETE` are discovered but skipped automatically.

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
            - run: npx itworksbut scan --fail-on high
```

For GitHub Code Scanning-style output:

```sh
itworksbut scan --sarif > itworksbut.sarif
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

![screenshot of an example output](/assets/medium_problems.webp)

## What It Detects

The baseline includes 51 modular checks:

- `git.gitignore-missing`
- `git.gitignore-incomplete`
- `git.ignored-files-tracked`
- `env.env-file-tracked`
- `env.env-example-missing`
- `env.possible-secret-in-code`
- `env.frontend-secret-exposure`
- `secrets.secrets-in-logs`
- `dependencies.lockfile-missing`
- `dependencies.multiple-lockfiles`
- `dependencies.install-scripts-risk`
- `dependencies.audit-script-missing`
- `dependencies.outdated-packages`
- `package.scripts-missing`
- `ci.no-ci-config`
- `ci.npm-install-instead-of-npm-ci`
- `ci.no-build-step`
- `ci.no-test-step`
- `node.express-json-limit-missing`
- `node.rate-limit-missing`
- `node.helmet-missing`
- `node.cors-wildcard`
- `node.child-process-user-input`
- `web.client-side-auth-only`
- `web.dangerous-inner-html`
- `web.missing-output-sanitization`
- `api.missing-auth-on-routes`
- `api.idor-risk`
- `auth.jwt-secret-weak-or-fallback`
- `auth.password-hashing-missing`
- `auth.missing-csrf-protection`
- `api.missing-method-guard`
- `api.mass-assignment-risk`
- `api.no-schema-validation`
- `database.raw-sql-interpolation`
- `database.no-migrations`
- `cookies.insecure-session-cookie`
- `uploads.public-executable-upload`
- `webhooks.missing-raw-body`
- `llm.prompt-injection-risk`
- `frontend.sourcemaps-production`
- `frontend.localstorage-token`
- `files.path-traversal-risk`
- `ssrf.user-controlled-fetch`
- `next.public-server-code-risk`
- `config.debug-production`
- `electron.node-integration-enabled`
- `electron.context-isolation-disabled`
- `electron.remote-content-with-node`
- `tauri.dangerous-allowlist-or-capabilities`
- `tauri.remote-url-permissions-risk`

Each check is a plain ESM module with an `id`, metadata, and async `run(context)` function. Add new checks under `src/checks/` and register them in `src/checks/index.js`.

## What It Does Not Guarantee

ItWorksBut is a static heuristic scanner, not a pentest, SAST replacement, dependency vulnerability database, or runtime security monitor. Findings intentionally use wording such as "possible", "potential", and "appears to" when a check is heuristic.

Use it as a CI guardrail for common project hygiene and security mistakes. For production systems, combine it with code review, tests, dependency scanning, secrets scanning, threat modeling, and focused security assessment.
