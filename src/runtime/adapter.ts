export type AppFiles = Record<string, string>;

export function generateAppSkeleton(schemas: {
  ui: any;
  api: any;
  db: any;
  auth: any;
}): AppFiles {
  const files: AppFiles = {};

  files["prisma/schema.prisma"] = generatePrismaSchema(schemas.db);

  for (const endpoint of schemas.api?.endpoints ?? []) {
    files[`app/api${endpoint.path}/route.ts`] = generateAPIRoute(endpoint, schemas.auth);
  }

  for (const page of schemas.ui?.pages ?? []) {
    files[`app/${page.slug}/page.tsx`] = generatePage(page);
  }

  files["middleware.ts"] = generateMiddleware(schemas.auth);
  files[".env.example"] = generateEnvTemplate(schemas.auth);
  files["package.json"] = generatePackageJson();

  return files;
}

function generatePrismaSchema(db: any): string {
  const lines: string[] = [
    `generator client {`,
    `  provider = "prisma-client-js"`,
    `}`,
    ``,
    `datasource db {`,
    `  provider = "postgresql"`,
    `  url      = env("DATABASE_URL")`,
    `}`,
    ``,
  ];

  for (const model of db?.models ?? []) {
    lines.push(`model ${pascalCase(model.name)} {`);
    for (const field of model.fields ?? []) {
      const optional = field.nullable ? "?" : "";
      const prismaType = mapToPrismaType(field.type);
      const decorators = field.primary ? " @id @default(cuid())" : "";
      lines.push(`  ${field.name.padEnd(20)} ${prismaType}${optional}${decorators}`);
    }
    const fieldNames = (model.fields ?? []).map((f: any) => f.name);
    if (!fieldNames.includes("createdAt"))
      lines.push(`  ${"createdAt".padEnd(20)} DateTime  @default(now())`);
    if (!fieldNames.includes("updatedAt"))
      lines.push(`  ${"updatedAt".padEnd(20)} DateTime  @updatedAt`);
    lines.push(`}`);
    lines.push(``);
  }

  return lines.join("\n");
}

function generateAPIRoute(endpoint: any, auth: any): string {
  const method = (endpoint.method ?? "GET").toUpperCase();
  const allowedRoles: string[] =
    auth?.route_guards?.find((g: any) => g.route === endpoint.path)?.allowed_roles ?? [];

  const bodyFields = (endpoint.body_fields ?? [])
    .map((f: any) => `    ${f.name}: ${mapToTSType(f.type)},`)
    .join("\n");

  const responseFields = (endpoint.response_fields ?? [])
    .map((f: any) => `    ${f.name}: ${mapToTSType(f.type)},`)
    .join("\n");

  return `import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

${allowedRoles.length > 0 ? `const ALLOWED_ROLES = ${JSON.stringify(allowedRoles)};` : ""}

export async function ${method}(req: NextRequest) {
  try {
    ${
      allowedRoles.length > 0
        ? `const session = await getServerSession(authOptions);
    if (!session || !ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }`
        : ``
    }

    ${
      method === "POST" || method === "PUT"
        ? `const body: {\n${bodyFields}\n    } = await req.json();`
        : `const { searchParams } = new URL(req.url);`
    }

    const result = {};

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error("[${endpoint.path}]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
`;
}

function generatePage(page: any): string {
  const formFields = (page.form_fields ?? [])
    .map(
      (f: any) => `
      <div className="field">
        <label htmlFor="${f.name}">${titleCase(f.name)}</label>
        <input
          id="${f.name}"
          name="${f.name}"
          type="${f.type === "password" ? "password" : f.type === "email" ? "email" : "text"}"
          value={form.${f.name}}
          onChange={e => setForm(p => ({ ...p, ${f.name}: e.target.value }))}
        />
      </div>`
    )
    .join("\n");

  const components = (page.components ?? [])
    .map((c: string) => `      `)
    .join("\n");

  const hasForms = (page.form_fields ?? []).length > 0;
  const apiEndpoint = page.form_fields?.[0]?.api_endpoint ?? "/api/data";

  return `"use client";
${hasForms ? `import { useState } from "react";` : ""}

export default function ${pascalCase(page.name)}Page() {
  ${
    hasForms
      ? `const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("${apiEndpoint}", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setMessage(data.success ? "Success!" : data.error ?? "Error");
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  }`
      : ""
  }

  return (
    <main className="page">
      <h1>${page.name}</h1>
${components}
      ${
        hasForms
          ? `<form onSubmit={handleSubmit}>
${formFields}
        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Submit"}
        </button>
        {message && <p className="msg">{message}</p>}
      </form>`
          : ""
      }
    </main>
  );
}
`;
}

function generateMiddleware(auth: any): string {
  const protectedRoutes = (auth?.route_guards ?? []).map((g: any) => g.route);

  return `import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth?.token?.role as string | undefined;
    const path = req.nextUrl.pathname;

    const permissionMatrix: Record<string, string[]> = ${JSON.stringify(
      auth?.permission_matrix ?? {},
      null,
      4
    )};

    const allowedRoles = permissionMatrix[path];
    if (allowedRoles && role && !allowedRoles.includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    return NextResponse.next();
  },
  { callbacks: { authorized: ({ token }) => !!token } }
);

export const config = {
  matcher: ${JSON.stringify(
    protectedRoutes.length ? protectedRoutes : ["/dashboard/:path*", "/api/:path*"]
  )},
};
`;
}

function generateEnvTemplate(auth: any): string {
  const lines = [
    `DATABASE_URL="postgresql://user:password@localhost:5432/mydb"`,
    `NEXTAUTH_SECRET="your-secret-here"`,
    `NEXTAUTH_URL="http://localhost:3000"`,
  ];
  if (auth?.type === "oauth") {
    lines.push(`GOOGLE_CLIENT_ID=""`);
    lines.push(`GOOGLE_CLIENT_SECRET=""`);
  }
  return lines.join("\n");
}

function generatePackageJson(): string {
  return JSON.stringify(
    {
      name: "generated-app",
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        "db:push": "prisma db push",
      },
      dependencies: {
        next: "14.2.0",
        react: "^18",
        "react-dom": "^18",
        "@prisma/client": "^5",
        "next-auth": "^4",
      },
      devDependencies: {
        prisma: "^5",
        typescript: "^5",
        "@types/node": "^20",
        "@types/react": "^18",
      },
    },
    null,
    2
  );
}

function pascalCase(str: string): string {
  return str.split(/[_\s-]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
}

function titleCase(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapToPrismaType(type: string): string {
  const map: Record<string, string> = {
    string: "String", text: "String", varchar: "String",
    int: "Int", integer: "Int", float: "Float", double: "Float",
    boolean: "Boolean", bool: "Boolean",
    date: "DateTime", datetime: "DateTime", timestamp: "DateTime",
    json: "Json", uuid: "String", id: "String",
  };
  return map[type.toLowerCase()] ?? "String";
}

function mapToTSType(type: string): string {
  const map: Record<string, string> = {
    string: "string", text: "string", varchar: "string",
    int: "number", integer: "number", float: "number", double: "number",
    boolean: "boolean", bool: "boolean",
    date: "string", datetime: "string",
    json: "Record<string, unknown>", uuid: "string", id: "string",
  };
  return map[type.toLowerCase()] ?? "string";
}
