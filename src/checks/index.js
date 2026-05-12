import gitignoreMissing from "./git/gitignore-missing.js";
import gitignoreIncomplete from "./git/gitignore-incomplete.js";
import ignoredFilesTracked from "./git/ignored-files-tracked.js";
import envFileTracked from "./env/env-file-tracked.js";
import envExampleMissing from "./env/env-example-missing.js";
import possibleSecretInCode from "./env/possible-secret-in-code.js";
import frontendSecretExposure from "./env/frontend-secret-exposure.js";
import secretsInLogs from "./secrets/secrets-in-logs.js";
import lockfileMissing from "./dependencies/lockfile-missing.js";
import multipleLockfiles from "./dependencies/multiple-lockfiles.js";
import installScriptsRisk from "./dependencies/install-scripts-risk.js";
import auditScriptMissing from "./dependencies/audit-script-missing.js";
import packageScriptsMissing from "./package/scripts-missing.js";
import noCiConfig from "./ci/no-ci-config.js";
import npmInstallInsteadOfNpmCi from "./ci/npm-install-instead-of-npm-ci.js";
import noBuildStep from "./ci/no-build-step.js";
import noTestStep from "./ci/no-test-step.js";
import expressJsonLimitMissing from "./node/express-json-limit-missing.js";
import rateLimitMissing from "./node/rate-limit-missing.js";
import helmetMissing from "./node/helmet-missing.js";
import corsWildcard from "./node/cors-wildcard.js";
import childProcessUserInput from "./node/child-process-user-input.js";
import clientSideAuthOnly from "./web/client-side-auth-only.js";
import dangerousInnerHtml from "./web/dangerous-inner-html.js";
import missingOutputSanitization from "./web/missing-output-sanitization.js";
import missingAuthOnRoutes from "./auth/missing-auth-on-routes.js";
import idorRisk from "./auth/idor-risk.js";
import jwtSecretWeakOrFallback from "./auth/jwt-secret-weak-or-fallback.js";
import passwordHashingMissing from "./auth/password-hashing-missing.js";
import missingCsrfProtection from "./auth/missing-csrf-protection.js";
import missingMethodGuard from "./api/missing-method-guard.js";
import massAssignmentRisk from "./api/mass-assignment-risk.js";
import noSchemaValidation from "./api/no-schema-validation.js";
import rawSqlInterpolation from "./database/raw-sql-interpolation.js";
import noMigrations from "./database/no-migrations.js";
import insecureSessionCookie from "./cookies/insecure-session-cookie.js";
import publicExecutableUpload from "./uploads/public-executable-upload.js";
import missingRawBody from "./webhooks/missing-raw-body.js";
import promptInjectionRisk from "./llm/prompt-injection-risk.js";
import sourceMapsProduction from "./frontend/sourcemaps-production.js";
import localstorageToken from "./frontend/localstorage-token.js";
import pathTraversalRisk from "./files/path-traversal-risk.js";
import userControlledFetch from "./ssrf/user-controlled-fetch.js";
import nextPublicServerCodeRisk from "./next/public-server-code-risk.js";
import debugProduction from "./config/debug-production.js";
import electronNodeIntegrationEnabled from "./electron/node-integration-enabled.js";
import electronContextIsolationDisabled from "./electron/context-isolation-disabled.js";
import electronRemoteContentWithNode from "./electron/remote-content-with-node.js";
import tauriDangerousAllowlistOrCapabilities from "./tauri/dangerous-allowlist-or-capabilities.js";
import tauriRemoteUrlPermissionsRisk from "./tauri/remote-url-permissions-risk.js";

export default [
  gitignoreMissing,
  gitignoreIncomplete,
  ignoredFilesTracked,
  envFileTracked,
  envExampleMissing,
  possibleSecretInCode,
  frontendSecretExposure,
  secretsInLogs,
  lockfileMissing,
  multipleLockfiles,
  installScriptsRisk,
  auditScriptMissing,
  packageScriptsMissing,
  noCiConfig,
  npmInstallInsteadOfNpmCi,
  noBuildStep,
  noTestStep,
  expressJsonLimitMissing,
  rateLimitMissing,
  helmetMissing,
  corsWildcard,
  childProcessUserInput,
  clientSideAuthOnly,
  dangerousInnerHtml,
  missingOutputSanitization,
  missingAuthOnRoutes,
  idorRisk,
  jwtSecretWeakOrFallback,
  passwordHashingMissing,
  missingCsrfProtection,
  missingMethodGuard,
  massAssignmentRisk,
  noSchemaValidation,
  rawSqlInterpolation,
  noMigrations,
  insecureSessionCookie,
  publicExecutableUpload,
  missingRawBody,
  promptInjectionRisk,
  sourceMapsProduction,
  localstorageToken,
  pathTraversalRisk,
  userControlledFetch,
  nextPublicServerCodeRisk,
  debugProduction,
  electronNodeIntegrationEnabled,
  electronContextIsolationDisabled,
  electronRemoteContentWithNode,
  tauriDangerousAllowlistOrCapabilities,
  tauriRemoteUrlPermissionsRisk
];
