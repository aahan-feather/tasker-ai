import type { CustomScenarioDefinition, GraphSimulationRequest } from "./types.js";
import { DEFAULT_POLICIES } from "./policy-engine.js";

/** Sierra Horizon-style prior authorization example */
export const PRIOR_AUTH_SCENARIO: CustomScenarioDefinition = {
  description:
    "Prior authorization is required for a follow-up procedure. Coordinate between payer, provider, and patient until the follow-up appointment is booked.",
  outcome: "Follow-up appointment scheduled with authorization on file",
  deadlineDays: 7,
  initialSignal: "Prior authorization required for follow-up procedure",
  initialSignalBadge: "EHR",
  tools: [
    {
      id: "horizon_check",
      name: "Horizon",
      category: "horizon",
      description: "Long-horizon planning agent",
      action: "Starts the prior authorization check",
      returns: [
        "Authorization pending — additional evidence required",
        "Authorization approved",
        "Unable to determine — escalate to human",
      ],
    },
    {
      id: "payer_portal",
      name: "Payer portal",
      category: "api",
      description: "Insurance payer integration",
      action: "Checks status and evidence requirements",
      returns: [
        "Additional clinical evidence required",
        "Authorization approved",
        "Portal timeout — retry later",
      ],
    },
    {
      id: "payer_phone",
      name: "Payer",
      category: "phone",
      description: "Payer contact line",
      action: "Requests additional clinical evidence",
      returns: [
        "Evidence requirements confirmed by phone",
        "No answer — voicemail left",
        "Call declined — use portal only",
      ],
    },
    {
      id: "provider_phone",
      name: "Provider",
      category: "phone",
      description: "Clinical provider office",
      action: "Provides the requested clinical evidence",
      returns: [
        "Clinical notes faxed to payer",
        "Provider will call back tomorrow",
        "Provider unavailable today",
      ],
    },
    {
      id: "ehr_workflow",
      name: "EHR",
      category: "workflow",
      description: "Electronic health record",
      action: "Updates the procedure record",
      returns: [
        "Procedure record updated",
        "Record locked — manual review needed",
      ],
    },
    {
      id: "scheduling",
      name: "Scheduling",
      category: "workflow",
      description: "Appointment scheduling workflow",
      action: "Books a Thursday slot and sends SMS confirmation",
      returns: [
        "Thursday appointment booked — SMS confirmation sent",
        "No slots available this week",
        "Patient prefers SMS only — booked via text",
      ],
    },
  ],
};

export const DOCUMENT_COLLECTION_SCENARIO: CustomScenarioDefinition = {
  description:
    "Collect W-2, bank statements, and government ID from the client within 7 days using email, SMS, and phone follow-ups.",
  outcome: "All required documents received via secure portal",
  deadlineDays: 7,
  initialSignal: "Document package required for onboarding",
  initialSignalBadge: "CRM",
  tools: [
    {
      id: "email_request",
      name: "Email",
      category: "email",
      description: "Outbound email with secure upload link",
      action: "Sends personalized document checklist and portal link",
      returns: [
        "Email opened — partial upload received",
        "Email unopened after 48 hours",
        "Client replied with questions",
      ],
    },
    {
      id: "sms_reminder",
      name: "SMS",
      category: "sms",
      description: "Text message reminders",
      action: "Sends SMS reminder for outstanding documents",
      returns: [
        "Client uploaded documents via link",
        "SMS delivered — no response",
        "Client opted into SMS follow-up",
      ],
    },
    {
      id: "voice_followup",
      name: "Collections line",
      category: "phone",
      description: "Outbound voice follow-up",
      action: "Calls client about missing documents",
      returns: [
        "Client will upload by Friday",
        "Voicemail — no callback",
        "Client disputes one document requirement",
      ],
    },
    {
      id: "portal",
      name: "Upload portal",
      category: "tool",
      description: "Secure document portal",
      action: "Validates uploaded files",
      returns: [
        "All documents validated successfully",
        "One document rejected — re-upload needed",
      ],
    },
  ],
};

export const EXAMPLE_SCENARIOS: CustomScenarioDefinition[] = [
  PRIOR_AUTH_SCENARIO,
  DOCUMENT_COLLECTION_SCENARIO,
];

export function buildPriorAuthGraphRequest(): GraphSimulationRequest {
  return {
    scenario: PRIOR_AUTH_SCENARIO,
    policies: DEFAULT_POLICIES,
    limits: { maxDepth: 4, maxBranchesPerNode: 3, maxTotalNodes: 15 },
  };
}
