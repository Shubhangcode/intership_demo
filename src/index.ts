import { extractIntent } from "./pipeline/stage1-intent.js";
import { designSystem } from "./pipeline/stage2-design.js";
import { generateSchemas } from "./pipeline/stage3-schema.js";
import { validateAndRepair } from "./validators/cross-layer.js";
import { generateAppSkeleton } from "./runtime/adapter.js";
import fs from "fs";
import path from "path";

export async function compileApp(userPrompt: string) {
  const startTime = Date.now();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`APP COMPILER — Starting pipeline`);
  console.log(`Prompt: "${userPrompt}"`);
  console.log(`${"=".repeat(60)}\n`);

  const intent = await extractIntent(userPrompt);
  console.log(`  ✓ Intent: ${intent.app_name} (${intent.app_type}), ${intent.entities.length} entities`);
  if (intent.assumptions.length > 0) {
    intent.assumptions.forEach((a) => console.log(`    - ${a}`));
  }

  const architecture = await designSystem(intent);
  console.log(`  ✓ Architecture: ${architecture.services.length} services, ${architecture.data_model.length} tables`);

  const rawSchemas = await generateSchemas(architecture);
  console.log(`  ✓ Schemas: UI pages=${rawSchemas.ui?.pages?.length ?? 0}, API endpoints=${rawSchemas.api?.endpoints?.length ?? 0}, DB models=${rawSchemas.db?.models?.length ?? 0}`);

  const validSchemas = await validateAndRepair(rawSchemas);

  console.log("  [Stage 5] Generating runnable app files...");
  const appFiles = generateAppSkeleton(validSchemas);
  console.log(`  ✓ Generated ${Object.keys(appFiles).length} files`);

  const latency = Date.now() - startTime;
  console.log(`\nDONE in ${(latency / 1000).toFixed(1)}s\n`);

  return {
    intent,
    architecture,
    schemas: validSchemas,
    app_files: appFiles,
    meta: { latency_ms: latency, files_generated: Object.keys(appFiles).length, assumptions: intent.assumptions },
  };
}

const prompt =
  process.argv[2] ??
  "Build a CRM with login, contacts, dashboard, role-based access for admins and reps, and a premium plan with payments. Admins can see analytics.";

compileApp(prompt)
  .then((output) => {
    const outDir = "output";
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "manifest.json"),
      JSON.stringify({ intent: output.intent, architecture: output.architecture, schemas: output.schemas, meta: output.meta }, null, 2)
    );
    for (const [filePath, content] of Object.entries(output.app_files)) {
      const fullPath = path.join(outDir, "app-skeleton", filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
    console.log(`Output saved to ./${outDir}/`);
    Object.keys(output.app_files).forEach((f) => console.log(`  ${f}`));
  })
  .catch((err) => {
    console.error("Pipeline failed:", err.message);
    process.exit(1);
  });
