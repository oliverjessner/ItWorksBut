import { hasAuthKeyword, isServerOrApiFile, readNearby } from '../helpers.js';

const ROUTE_RE = /\b(?:app|router|fastify)\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/g;

export default {
    id: 'api.missing-auth-on-routes',
    title: 'API routes should have explicit authentication',
    category: 'auth',
    severity: 'high',
    tags: ['api', 'auth', 'heuristic'],
    run: async context => {
        const findings = [];

        for (const file of context.textFiles) {
            if (!/\.[cm]?[jt]s$/.test(file) && !isServerOrApiFile(file)) continue;
            const content = await context.readFileSafe(file);
            if (!content) continue;

            if ((file.startsWith('pages/api/') || file.startsWith('app/api/')) && !hasAuthKeyword(content)) {
                findings.push({
                    message: 'This API route file does not appear to contain an authentication check.',
                    file,
                    recommendation:
                        'Require authentication and authorization in API route handlers. Public routes should be documented explicitly.',
                    heuristic: true,
                });
                continue;
            }

            const lines = content.split(/\r?\n/);
            for (let index = 0; index < lines.length; index += 1) {
                ROUTE_RE.lastIndex = 0;
                const match = ROUTE_RE.exec(lines[index]);
                if (!match) continue;
                const routePath = match[2];
                if (!routePath.startsWith('/api') && !isServerOrApiFile(file)) continue;

                const nearby = await readNearby(context, file, index + 1, 6);
                if (hasAuthKeyword(nearby)) continue;

                findings.push({
                    message: `Possible unauthenticated API route ${routePath} appears without nearby auth middleware or checks.`,
                    file,
                    line: index + 1,
                    recommendation:
                        'Add explicit authentication middleware/checks near the route, or document why the route is intentionally public.',
                    heuristic: true,
                    metadata: { routePath },
                });
            }
        }

        return findings.slice(0, 100);
    },
};
