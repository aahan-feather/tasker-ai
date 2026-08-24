export type Channel = "email" | "sms" | "voice" | "upload_portal";

export type PolicyVerdict = "ALLOW" | "DENY" | "DEFER";

export type PersonaId = "responsive" | "ghost" | "sms_preferred" | "disputes";

export type SimulationOutcome = "success" | "partial" | "escalated" | "timeout";

export interface RequiredDocument {
  id: string;
  label: string;
}

export interface TaskDefinition {
  id: string;
  name: string;
  outcome: string;
  deadlineDays: number;
  requiredDocuments: RequiredDocument[];
  toolkit: Channel[];
  escalationAfterDay?: number;
}

export type PolicyType =
  | "frequency_cap"
  | "time_window"
  | "consent_required"
  | "goal_gate"
  | "messaging_policy";

export interface PolicyDefinition {
  id: string;
  type: PolicyType;
  channel?: Channel;
  max?: number;
  window?: "calendar_day" | "rolling_7_days";
  allowed?: string;
  when?: string;
  action?: string;
  visible?: boolean;
  rule?: string;
}

export interface TouchRecord {
  day: number;
  hour: number;
  channel: Channel;
  actionType: string;
  outcome: string;
  policyVerdict: PolicyVerdict;
  policyReason?: string;
  messagePreview?: string;
}

export interface CaseState {
  day: number;
  simHour: number;
  documentsReceived: string[];
  touches: TouchRecord[];
  optedOut: boolean;
  smsConsent: boolean;
  emailConsent: boolean;
  deferredUntilDay?: number;
  recipientPromisedDay?: number;
  noResponseSinceDay: number;
  humanEscalated: boolean;
  completed: boolean;
}

export interface ProposedAction {
  channel: Channel;
  actionType: "outreach" | "notify_human" | "wait";
  message?: string;
  reason: string;
  deferUntilDay?: number;
}

export interface PolicyEvaluation {
  verdict: PolicyVerdict;
  reason: string;
  policyId?: string;
  deferUntilDay?: number;
  deferUntilHour?: number;
}

export interface SimulationStep {
  day: number;
  hour: number;
  signal?: string;
  proposal?: ProposedAction;
  evaluation?: PolicyEvaluation;
  executed: boolean;
  touch?: TouchRecord;
  recipientEvent?: string;
  note?: string;
}

export interface SimulationRequest {
  task: TaskDefinition;
  policies: PolicyDefinition[];
  personaId: PersonaId;
}

export interface SimulationResult {
  id: string;
  task: TaskDefinition;
  policies: PolicyDefinition[];
  personaId: PersonaId;
  steps: SimulationStep[];
  outcome: SimulationOutcome;
  summary: string;
  startedAt: string;
  durationMs: number;
}

export interface TaskTemplate {
  id: string;
  label: string;
  description: string;
  task: TaskDefinition;
  policies: PolicyDefinition[];
  defaultPersonaId: PersonaId;
}
