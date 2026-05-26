import { Architecture } from "./stage2-design.js";
import { callLLM } from "../llm/client.js";

export async function generateSchemas(arch: Architecture) {
  console.log("  [Stage 3] Generating 4 schemas in parallel...");

  const [uiRaw, apiRaw, dbRaw, authRaw] = await Promise.all([
    callLLM({
      system: `Generate a UI config JSON. Return ONLY valid JSON, no markdown.
Shape: { pages: Array<{ name: string, slug: string, components: string[], form_fields: Array<{ name: string, type: string, api_endpoint: string }> }>, navigation: string[] }`,
      user: JSON.stringify(arch),
    }),
    callLLM({
      system: `Generate an API spec JSON. Return ONLY valid JSON, no markdown.
Shape: { endpoints: Array<{ path: string, method: string, description: string, body_fields: Array<{ name: string, type: string }>, response_fields: Array<{ name: string, type: string }> }> }`,
      user: JSON.stringify(arch),
    }),
    callLLM({
      system: `Generate a DB schema JSON (Prisma-style). Return ONLY valid JSON, no markdown.
Shape: { models: Array<{ name: string, fields: Array<{ name: string, type: string, primary: boolean, nullable: boolean }>, indexes: string[] }> }`,
      user: JSON.stringify(arch),
    }),
    callLLM({
      system: `Generate an auth config JSON. Return ONLY valid JSON, no markdown.
Shape: { roles: Array<{ name: string, inherits: string[] }>, route_guards: Array<{ route: string, allowed_roles: string[] }>, permission_matrix: Record<string, string[]> }`,
      user: JSON.stringify(arch),
    }),
  ]);

  return {
    ui: JSON.parse(uiRaw),
    api: JSON.parse(apiRaw),
    db: JSON.parse(dbRaw),
    auth: JSON.parse(authRaw),
  };
}
