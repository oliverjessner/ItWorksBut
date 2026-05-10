const DB_PACKAGES = ["prisma", "@prisma/client", "drizzle-orm", "sequelize", "knex", "sqlite", "sqlite3", "better-sqlite3", "pg", "mysql2"];
const MIGRATION_PATTERNS = [
  "prisma/migrations/**",
  "migrations/**",
  "db/migrations/**",
  "src/db/migrations/**",
  "drizzle/**"
];

export default {
  id: "database.no-migrations",
  title: "Database projects should include migrations",
  category: "database",
  severity: "medium",
  tags: ["database", "deployment"],
  run: async (context) => {
    const dbDetected =
      DB_PACKAGES.some((name) => context.hasDependency(name) || context.hasDevDependency(name)) ||
      context.allFiles.some((file) => file === "prisma/schema.prisma" || file.endsWith(".sql"));

    if (!dbDetected) return [];
    const hasMigrations = MIGRATION_PATTERNS.some((pattern) => context.findFiles(pattern).length > 0);
    if (hasMigrations) return [];

    return [
      {
        message: "Database or ORM usage appears to exist, but no migrations directory was found.",
        recommendation: "Add versioned database migrations and run them through a controlled deployment process.",
        heuristic: true
      }
    ];
  }
};
