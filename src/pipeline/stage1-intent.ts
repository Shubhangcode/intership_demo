import { z } from "zod";
import { callLLM } from "../llm/client.js";

export const IntentSchema = z.object({
  app_name: z.string(),
  app_type: z.enum(["crm", "ecommerce", "saas", "internal_tool", "marketplace", "other"]),
  entities: z.array(
    z.object({
      name: z.string(),
      attributes: z.array(z.string()),
      relations: z.array(z.string()),
    })
  ),
  features: z.array(
    z.enum([
      "auth", "payments", "rbac", "analytics", "notifications",
      "search", "file_upload", "api_keys", "audit_log", "dashboard",
    ])
  ),
  roles: z.array(
    z.object({
      name: z.string(),
      permissions: z.array(z.string()),
    })
  ),
  pages: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type Intent = z.infer<typeof IntentSchema>;

const SYSTEM_PROMPT = `You are a software architect parsing a user's app description.
Extract structured intent as JSON. For vague inputs, make reasonable assumptions and list them in "assumptions".
Return ONLY valid JSON with NO markdown fences, no explanations, nothing else.
The JSON must exactly match this TypeScript type:
{
  app_name: string,
  app_type: "crm"|"ecommerce"|"saas"|"internal_tool"|"marketplace"|"other",
  entities: Array<{ name: string, attributes: string[], relations: string[] }>,
  features: Array<"auth"|"payments"|"rbac"|"analytics"|"notifications"|"search"|"file_upload"|"api_keys"|"audit_log"|"dashboard">,
  roles: Array<{ name: string, permissions: string[] }>,
  pages: string[],
  assumptions: string[]
}`;

export async function extractIntent(userPrompt: string): Promise<Intent> {
  console.log("  [Stage 1] Extracting intent...");
  const raw = await callLLM({
    system: SYSTEM_PROMPT,
    user: `User request: "${userPrompt}"`,
  });

  const parsed = JSON.parse(raw);
  const result = IntentSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Stage 1 schema validation failed: ${JSON.stringify(result.error.flatten())}`
    );
  }
  return result.data;
}
