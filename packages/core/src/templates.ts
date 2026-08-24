import type { TaskTemplate } from "./types.js";
import { DEFAULT_POLICIES } from "./policy-engine.js";

export const DOCUMENT_COLLECTION_TEMPLATE: TaskTemplate = {
  id: "collect_documents",
  label: "Document collection",
  description:
    "Collect required documents within a deadline using email, SMS, and voice.",
  defaultPersonaId: "responsive",
  task: {
    id: "collect_documents",
    name: "Collect documents",
    outcome: "All required documents received and validated",
    deadlineDays: 7,
    requiredDocuments: [
      { id: "w2", label: "W-2" },
      { id: "bank_statement", label: "Bank statement (last 2 months)" },
      { id: "id", label: "Government ID" },
    ],
    toolkit: ["email", "sms", "voice", "upload_portal"],
    escalationAfterDay: 5,
  },
  policies: DEFAULT_POLICIES,
};

export const APPOINTMENT_TEMPLATE: TaskTemplate = {
  id: "schedule_appointment",
  label: "Appointment scheduling",
  description: "Book a follow-up appointment within 14 days.",
  defaultPersonaId: "sms_preferred",
  task: {
    id: "schedule_appointment",
    name: "Schedule appointment",
    outcome: "Follow-up appointment confirmed in calendar",
    deadlineDays: 14,
    requiredDocuments: [{ id: "appointment", label: "Confirmed appointment" }],
    toolkit: ["email", "sms", "voice"],
    escalationAfterDay: 10,
  },
  policies: [
    {
      id: "voice_daily_cap",
      type: "frequency_cap",
      channel: "voice",
      max: 2,
      window: "calendar_day",
    },
    {
      id: "voice_weekly_cap",
      type: "frequency_cap",
      channel: "voice",
      max: 5,
      window: "rolling_7_days",
    },
    {
      id: "quiet_hours",
      type: "time_window",
      allowed: "09:00-18:00",
    },
    {
      id: "consent_sms",
      type: "consent_required",
      channel: "sms",
    },
    {
      id: "stop_on_success",
      type: "goal_gate",
      when: "all_documents_received",
      action: "suppress_all_outreach",
    },
  ],
};

export const TASK_TEMPLATES: TaskTemplate[] = [
  DOCUMENT_COLLECTION_TEMPLATE,
  APPOINTMENT_TEMPLATE,
];

export function getTemplateById(id: string): TaskTemplate | undefined {
  return TASK_TEMPLATES.find((t) => t.id === id);
}
