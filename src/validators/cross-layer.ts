import { callLLM } from "../llm/client.js";

export type ValidationError = {
  layer: string;
  field: string;
  issue: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export function crossLayerValidate(schemas: {
  ui: any; api: any; db: any; auth: any;
}): ValidationResult {
  const errors: ValidationError[] = [];

  const apiPaths = new Set(
    (schemas.api?.endpoints ?? []).map((e: any) => e.path as string)
  );
  const dbFields = new Set(
    (schemas.db?.models ?? []).flatMap((m: any) =>
      (m.fields ?? []).map((f: any) => f.name as string)
    )
  );

  for (const page of schemas.ui?.pages ?? []) {
    for (const field of page.form_fields ?? []) {
      if (field.api_endpoint && !apiPaths.has(field.api_endpoint)) {
        errors.push({
          layer: "ui→api",
          field: field.name,
          issue: `UI field "${field.name}" references non-existent API endpoint "${field.api_endpoint}"`,
        });
      }
    }
  }

  for (const endpoint of schemas.api?.endpoints ?? []) {
    for (const bf of endpoint.body_fields ?? []) {
      if (!dbFields.has(bf.name)) {
        errors.push({
          layer: "api→db",
          field: bf.name,
          issue: `API body field "${bf.name}" on ${endpoint.path} not found in DB schema`,
        });
      }
    }
  }

  for (const guard of schemas.auth?.route_guards ?? []) {
    if (!apiPaths.has(guard.route)) {
      errors.push({
        layer: "auth→api",
        field: guard.route,
        issue: `Auth guard on "${guard.route}" but that route doesn't exist in API spec`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function validateAndRepair(
  schemas: { ui: any; api: any; db: any; auth: any },
  attempt = 0
): Promise<{ ui: any; api: any; db: any; auth: any }> {
  const MAX_ATTEMPTS = 3;
  const result = crossLayerValidate(schemas);

  if (result.valid) {
    console.log(`  [Stage 4] All cross-layer checks passed ✓`);
    return schemas;
  }

  if (attempt >= MAX_ATTEMPTS) {
    console.warn(
      `  [Stage 4] Max repair attempts reached. Proceeding with ${result.errors.length} unresolved errors.`
    );
    return schemas;
  }

  console.log(
    `  [Stage 4] Found ${result.errors.length} errors (attempt ${attempt + 1}/${MAX_ATTEMPTS}), repairing...`
  );
  result.errors.forEach((e) => console.log(`    ✗ [${e.layer}] ${e.issue}`));

  const brokenLayers = [...new Set(result.errors.map((e) => e.layer.split("→")[0]))];

  for (const layer of brokenLayers) {
    const layerErrors = result.errors.filter((e) => e.layer.startsWith(layer));
    const repaired = await callLLM({
      system: `You are repairing a "${layer}" config JSON. Fix ONLY the listed errors.
Return ONLY the corrected JSON for the ${layer} layer. No markdown, no explanation.`,
      user: `Current ${layer} schema:\n${JSON.stringify(
        schemas[layer as keyof typeof schemas],
        null,
        2
      )}

Errors to fix:\n${JSON.stringify(layerErrors, null, 2)}

Other layers for context:\n${JSON.stringify(
        Object.fromEntries(Object.entries(schemas).filter(([k]) => k !== layer)),
        null,
        2
      )}`,
    });

    (schemas as any)[layer] = JSON.parse(repaired);
    console.log(`    ✓ Repaired "${layer}" layer`);
  }

  return validateAndRepair(schemas, attempt + 1);
}
