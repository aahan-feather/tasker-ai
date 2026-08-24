import type {
  PersonaId,
  PolicyDefinition,
  SimulationResult,
  TaskDefinition,
  TaskTemplate,
} from "./types";

const API_BASE = "/api";

export async function fetchTemplates(): Promise<TaskTemplate[]> {
  const res = await fetch(`${API_BASE}/templates`);
  if (!res.ok) throw new Error("Failed to load templates");
  return res.json();
}

export async function runSimulation(
  task: TaskDefinition,
  policies: PolicyDefinition[],
  personaId: PersonaId,
): Promise<SimulationResult> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, policies, personaId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Simulation failed");
  }
  return res.json();
}

export const PERSONAS: { id: PersonaId; label: string }[] = [
  { id: "responsive", label: "Responsive" },
  { id: "ghost", label: "Ghost" },
  { id: "sms_preferred", label: "SMS preferred" },
  { id: "disputes", label: "Disputes requirements" },
];

export const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  voice: "Voice",
  upload_portal: "Upload portal",
};

export const OUTCOME_LABELS: Record<SimulationResult["outcome"], string> = {
  success: "Success",
  partial: "Partial",
  escalated: "Escalated",
  timeout: "Timeout",
};
