// src/evaluation/dataset.ts

export const REAL_PROMPTS = [
  "Build a CRM with contacts, deals pipeline, and role-based access for admins and reps",
  "Create a SaaS invoicing tool with Stripe payments, PDF export, and client portal",
  "Build an internal HR tool with employee profiles, leave requests, and approval workflows",
  // ... 7 more
];

export const EDGE_CASES = [
  // Vague
  "Make an app",
  "I need something for my business",
  // Conflicting
  "Build a public app that only logged-in users can see with no login page",
  "Create a free app with premium features visible to all users",
  // Incomplete
  "Add payments", // no context
  "Build a dashboard", // no data sources
  // ... 4 more
];

// Metrics tracked per run
export type EvalMetric = {
  prompt: string;
  success: boolean;
  retries: number;
  failure_type?:
    | "json_invalid"
    | "schema_mismatch"
    | "hallucination"
    | "timeout";
  latency_ms: number;
  assumptions_made: number;
};
