# ItWorksBut Scan Report

Generated: 2026-05-19 11:48:18

Project: itworksbut
Path: /Users/oli/github/ItWorksBut

## Summary

| Status | Count |
| ------ | ----: |
| Pass   |    32 |
| Warn   |     1 |
| Fail   |    18 |
| Skip   |     0 |

## Checks

### .gitignore should exist

Status: pass

Summary:
No issues found.

Details:
None.

### .gitignore should cover common generated and secret files

Status: pass

Summary:
No issues found.

Details:
None.

### Ignored files should not be tracked by git

Status: pass

Summary:
No issues found.

Details:
None.

### Environment files must not be tracked

Status: pass

Summary:
No issues found.

Details:
None.

### .env.example should document required environment variables

Status: pass

Summary:
No issues found.

Details:
None.

### Possible hardcoded secrets should not appear in source

Status: pass

Summary:
No issues found.

Details:
None.

### Frontend-public environment variables should not look secret

Status: pass

Summary:
No issues found.

Details:
None.

### Logs should not include secrets or sensitive request data

Status: pass

Summary:
No issues found.

Details:
None.

### Package lockfile should be committed

Status: pass

Summary:
No issues found.

Details:
None.

### Only one JavaScript package lockfile should be committed

Status: pass

Summary:
No issues found.

Details:
None.

### Install lifecycle scripts should be reviewed

Status: pass

Summary:
No issues found.

Details:
None.

### Dependency security audit should be available

Status: pass

Summary:
No issues found.

Details:
None.

### Outdated packages

Status: pass

Summary:
all dependencies are up to date

Details:
None.

### package.json should expose standard project scripts

Status: pass

Summary:
No issues found.

Details:
None.

### CI configuration should exist

Status: pass

Summary:
No issues found.

Details:
None.

### CI should prefer npm ci over npm install

Status: pass

Summary:
No issues found.

Details:
None.

### CI should run a build step

Status: pass

Summary:
No issues found.

Details:
None.

### CI should run tests

Status: pass

Summary:
No issues found.

Details:
None.

### express.json should set a body size limit

Status: pass

Summary:
No issues found.

Details:
None.

### API servers should include rate limiting

Status: pass

Summary:
No issues found.

Details:
None.

### Express apps should use Helmet or equivalent security headers

Status: pass

Summary:
No issues found.

Details:
None.

### CORS should not be broadly open by default

Status: fail

Summary:
2 findings reported.

Details:

- CORS configuration appears broadly open (cors() with default open origin).
- CORS configuration appears broadly open (origin: true).

### Child process commands should not trust user input

Status: fail

Summary:
1 finding reported.

Details:

- User-controlled input appears to flow into a child process command.

### Authorization should not appear to exist only in frontend code

Status: pass

Summary:
No issues found.

Details:
None.

### Direct HTML injection APIs should be reviewed

Status: fail

Summary:
4 findings reported.

Details:

- dangerouslySetInnerHTML appears to be used. This can create XSS risk if any input is attacker-controlled.
- dangerouslySetInnerHTML appears to be used. This can create XSS risk if any input is attacker-controlled.
- dangerouslySetInnerHTML appears to be used. This can create XSS risk if any input is attacker-controlled.
- dangerouslySetInnerHTML appears to be used. This can create XSS risk if any input is attacker-controlled.

### HTML built from request data should be sanitized or escaped

Status: pass

Summary:
No issues found.

Details:
None.

### API routes should have explicit authentication

Status: pass

Summary:
No issues found.

Details:
None.

### Object lookup by id should be scoped to the authenticated owner

Status: fail

Summary:
1 finding reported.

Details:

- Potential IDOR risk: SQL lookup by id appears without a nearby owner, tenant, or user scope check.

### JWT secrets should not use weak hardcoded values or fallbacks

Status: fail

Summary:
1 finding reported.

Details:

- JWT signing or verification appears to use a weak hardcoded secret or a development fallback.

### User passwords should be hashed before storage

Status: fail

Summary:
1 finding reported.

Details:

- This code appears to create users or store passwords without an obvious password hashing step.

### Cookie-based authentication should include CSRF protection

Status: pass

Summary:
No issues found.

Details:
None.

### API handlers should restrict HTTP methods

Status: pass

Summary:
No issues found.

Details:
None.

### Create and update operations should not trust raw request bodies

Status: fail

Summary:
2 findings reported.

Details:

- User-controlled input appears to be passed directly into a create or update operation.
- User-controlled input appears to be passed directly into a create or update operation.

### API request input should be schema validated

Status: pass

Summary:
No issues found.

Details:
None.

### Raw SQL should not be built with string interpolation

Status: fail

Summary:
3 findings reported.

Details:

- Possible SQL injection risk: raw SQL appears to be built with template string interpolation.
- Possible SQL injection risk: raw SQL appears to be built with string concatenation.
- Possible SQL injection risk: raw SQL appears to be built with template string interpolation.

### Database projects should include migrations

Status: pass

Summary:
No issues found.

Details:
None.

### Session cookies should use secure attributes

Status: fail

Summary:
3 findings reported.

Details:

- A session or auth cookie appears to be set without secure cookie attributes.
- A session or auth cookie appears to be set without secure cookie attributes.
- A session or auth cookie appears to be set without secure cookie attributes.

### Uploads should not be stored directly in public web roots

Status: fail

Summary:
1 finding reported.

Details:

- Uploaded files appear to be stored in a public directory, possibly without strict file type and size validation.

### Signed webhooks should verify the exact raw body

Status: fail

Summary:
1 finding reported.

Details:

- Webhook signature verification appears to use a parsed request body. Some providers require the exact raw body.

### LLM output should not flow directly into dangerous actions

Status: fail

Summary:
1 finding reported.

Details:

- LLM output appears to flow into code execution, shell commands, HTML injection, database queries, file writes or network requests.

### Production source maps should not be served publicly by accident

Status: warn

Summary:
1 finding reported.

Details:

- Production source maps appear to be enabled or generated.

### Authentication tokens should not live in browser storage by default

Status: fail

Summary:
1 finding reported.

Details:

- Authentication tokens appear to be stored in localStorage or sessionStorage.

### File path operations should not trust request input

Status: fail

Summary:
2 findings reported.

Details:

- User-controlled input appears to be used in a file path operation.
- User-controlled input appears to be used in a file path operation.

### Server-side HTTP requests should not trust user-controlled URLs

Status: fail

Summary:
1 finding reported.

Details:

- User-controlled input appears to flow into a server-side HTTP request.

### Next.js Client Components should not import server-only code

Status: pass

Summary:
No issues found.

Details:
None.

### Production configuration should not enable debug behavior

Status: pass

Summary:
No issues found.

Details:
None.

### Electron nodeIntegration should be disabled

Status: fail

Summary:
2 findings reported.

Details:

- Electron BrowserWindow webPreferences enables nodeIntegration.
- Electron BrowserWindow webPreferences enables nodeIntegration.

### Electron contextIsolation should be explicitly enabled

Status: fail

Summary:
1 finding reported.

Details:

- Electron BrowserWindow webPreferences disables contextIsolation.

### Electron remote content should not run with privileged renderer settings

Status: fail

Summary:
1 finding reported.

Details:

- Electron appears to load remote content while enabling risky renderer privileges.

### Tauri allowlists and capabilities should be narrowly scoped

Status: pass

Summary:
No issues found.

Details:
None.

### Tauri remote URLs and permissions should be least privilege

Status: pass

Summary:
No issues found.

Details:
None.

## Recommendations

- Hash passwords with argon2, bcrypt, scrypt or PBKDF2 before storage. Never store raw passwords.
- Avoid loading remote content with Node.js integration. Use nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true and a minimal preload bridge.
- Normalize and validate paths, use allowlists, reject traversal sequences, and ensure resolved paths stay inside an intended base directory.
- Avoid shell execution with user input. Use spawn with fixed command and argument arrays, validate against allowlists, and never concatenate shell strings.
- Use strict URL allowlists, block private/internal IP ranges including 127.0.0.1, localhost, 169.254.169.254 and RFC1918 ranges, and avoid fetching arbitrary user-provided URLs.
- Scope object reads and writes by authenticated user, owner, account, tenant, or organization, not by id alone.
- Whitelist allowed fields explicitly. Never pass req.body directly into database create/update calls.
- Require a strong JWT secret from the environment in production and fail startup if it is missing.
- Set httpOnly, secure and sameSite for session cookies. Use secure: true in production.
- Use parameterized queries, prepared statements, or ORM query builders instead of interpolating values into SQL strings.
- Set contextIsolation: true and expose narrow, validated APIs from preload.
- Set nodeIntegration: false, keep contextIsolation: true, and expose only minimal APIs through a strict preload script.
- Prefer secure, httpOnly cookies for session tokens where appropriate. If browser storage is unavoidable, minimize token lifetime and harden XSS protections.
- Treat model output as untrusted input. Validate with schemas, use allowlists, require human approval for dangerous actions, and never execute raw model output.
- Restrict CORS origins to the exact trusted application origins and handle credentials carefully.
- Store uploads outside the public web root, validate MIME type and extension, enforce file size limits, and serve files through controlled routes.
- Avoid raw HTML insertion when possible. If HTML is required, sanitize with a proven sanitizer and keep trusted and untrusted content separate.
- Use a raw body parser for signed webhook routes and register it before JSON parsing middleware.
- Disable public production source maps unless intentionally needed. If needed, upload them privately to error tracking instead of serving them publicly.
- Review failed checks and scanner warnings before shipping.
