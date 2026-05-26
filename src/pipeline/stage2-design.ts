import { z } from "zod";
import { Intent } from "./stage1-intent.js";
import { callLLM } from "../llm/client.js";

export const ArchSchema = z.object({
  services: z.array(
    z.object({
      name: z.string(),
      responsibility: z.string(),
      endpoints: z.array(z.string()),
    })
  ),
  data_model: z.array(
    z.object({
      table: z.string(),
      fields: z.array(
        z.object({ name: z.string(), type: z.string(), nullable: z.boolean() })
      ),
      relations: z.array(
        z.object({
          to: z.string(),
          type: z.enum(["one-to-many", "many-to-many", "one-to-one"]),
        })
      ),
    })
  ),
  auth_strategy: z.object({
    type: z.enum(["jwt", "session", "oauth"]),
    roles: z.array(z.string()),
    permission_model: z.enum(["rbac", "abac", "simple"]),
  }),
  business_rules: z.array(z.string()),
});

export type Architecture = z.infer<typeof ArchSchema>;

export async function designSystem(intent: Intent): Promise<Architecture> {
  console.log("  [Stage 2] Designing system architecture...");
  const raw = await callLLM({
    system: `You are a senior system architect. Convert this app intent into a concrete system design.
Return ONLY valid JSON with NO markdown fences, no explanations. Match this shape exactly:
{
  services: Array<{ name: string, responsibility: string, endpoints: string[] }>,
  data_model: Array<{ table: string, fields: Array<{ name: string, type: string, nullable: boolean }>, relations: Array<{ to: string, type: "one-to-many"|"many-to-many"|"one-to-one" }> }>,
  auth_strategy: { type: "jwt"|"session"|"oauth", roles: string[], permission_model: "rbac"|"abac"|"simple" },
  business_rules: string[]
}`,
    user: `Intent:\n${JSON.stringify(intent, null, 2)}`,
  });

  const parsed = JSON.parse(raw);
  const result = ArchSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Stage 2 schema validation failed: ${JSON.stringify(result.error.flatten())}`
    );
  }
  return result.data;
}
