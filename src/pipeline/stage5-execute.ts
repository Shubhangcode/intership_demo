// src/runtime/adapter.ts
// Converts validated schemas → runnable Next.js app skeleton

export function generateAppSkeleton(schemas: {
  ui: any;
  api: any;
  db: any;
  auth: any;
}): Record<string, string> {
  const files: Record<string, string> = {};

  // Generate Prisma schema
  files["prisma/schema.prisma"] = generatePrismaSchema(schemas.db);

  // Generate API routes
  for (const endpoint of schemas.api.endpoints) {
    files[`app/api${endpoint.path}/route.ts`] = generateAPIRoute(
      endpoint,
      schemas.auth,
    );
  }

  // Generate page components
  for (const page of schemas.ui.pages) {
    files[`app/${page.slug}/page.tsx`] = generatePage(page);
  }

  // Generate middleware (auth guards)
  files["middleware.ts"] = generateMiddleware(schemas.auth);

  return files;
}
