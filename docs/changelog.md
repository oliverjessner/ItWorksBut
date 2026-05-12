# 0.5.0

- `auth.missing-csrf-protection` – Detects cookie-based auth without obvious CSRF protection.
- `api.missing-method-guard` – Detects API handlers without explicit HTTP method checks.
- `api.mass-assignment-risk` – Detects direct use of user input in database create/update operations.
- `api.no-schema-validation` – Detects API routes that consume request input without visible schema validation.
- `files.path-traversal-risk` – Detects user-controlled input used in filesystem path operations.
- `ssrf.user-controlled-fetch` – Detects user-controlled URLs passed into server-side HTTP requests.
- `frontend.localstorage-token` – Detects auth tokens stored in `localStorage` or `sessionStorage`.
- `next.public-server-code-risk` – Detects Next.js Client Components importing server-side code or secrets.
- `electron.remote-content-with-node` – Detects Electron apps loading remote content with risky renderer privileges.
- `tauri.remote-url-permissions-risk` – Detects broad Tauri permissions, remote URLs, or weak CSP settings.
