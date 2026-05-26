// src/validators/cross-layer.ts

export type ValidationResult = {
  valid: boolean;
  errors: Array<{ layer: string; field: string; issue: string }>;
};

export function crossLayerValidate(schemas: {
  ui: any;
  api: any;
  db: any;
  auth: any;
}): ValidationResult {
  const errors = [];

  // Rule 1: Every UI form field must map to an API endpoint body field
  for (const page of schemas.ui.pages ?? []) {
    for (const field of page.form_fields ?? []) {
      const apiMatch = findAPIField(schemas.api, field.name);
      if (!apiMatch) {
        errors.push({
          layer: "ui→api",
          field: field.name,
          issue: "UI field has no API mapping",
        });
      }
    }
  }

  // Rule 2: Every API body field must exist in DB schema
  for (const endpoint of schemas.api.endpoints ?? []) {
    for (const field of endpoint.body_fields ?? []) {
      const dbMatch = findDBField(schemas.db, field.name);
      if (!dbMatch) {
        errors.push({
          layer: "api→db",
          field: field.name,
          issue: "API field not in DB schema",
        });
      }
    }
  }

  // Rule 3: Auth routes must reference real API endpoints
  for (const rule of schemas.auth.route_guards ?? []) {
    const exists = schemas.api.endpoints?.some(
      (e: any) => e.path === rule.route,
    );
    if (!exists) {
      errors.push({
        layer: "auth→api",
        field: rule.route,
        issue: "Auth guard on non-existent route",
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// src/stage4-validate.ts — repair engine
export async function validateAndRepair(
  schemas: any,
  attempt = 0,
): Promise<any> {
  const MAX_ATTEMPTS = 3;
  const result = crossLayerValidate(schemas);

  if (result.valid) return schemas;
  if (attempt >= MAX_ATTEMPTS) throw new Error("Max repair attempts exceeded");

  // Targeted repair — only re-gen the broken layer, not everything
  const brokenLayers = [
    ...new Set(result.errors.map((e) => e.layer.split("→")[0])),
  ];

  for (const layer of brokenLayers) {
    const errorContext = result.errors.filter((e) => e.layer.startsWith(layer));
    schemas[layer] = await repairLayer(
      layer,
      schemas[layer],
      errorContext,
      schemas,
    );
  }

  return validateAndRepair(schemas, attempt + 1);
}

async function repairLayer(
  layer: string,
  schema: any,
  errors: any[],
  allSchemas: any,
) {
  return callLLM({
    system: `You are repairing a ${layer} schema. Fix ONLY the listed errors. Return corrected JSON only.`,
    user: `Current schema:\n${JSON.stringify(schema)}\n\nErrors:\n${JSON.stringify(errors)}\n\nOther layers for context:\n${JSON.stringify(allSchemas)}`,
  });
}
