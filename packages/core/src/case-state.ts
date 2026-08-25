import type {
  CaseState,
  Channel,
  PersonaId,
  PolicyDefinition,
  ProposedAction,
  RequiredDocument,
  TaskDefinition,
} from "./types.js";

export function createInitialCaseState(): CaseState {
  return {
    day: 1,
    simHour: 10,
    documentsReceived: [],
    touches: [],
    optedOut: false,
    smsConsent: true,
    emailConsent: true,
    noResponseSinceDay: 1,
    humanEscalated: false,
    completed: false,
  };
}

export function allDocumentsReceived(
  state: CaseState,
  required: RequiredDocument[],
): boolean {
  if (required.length === 0) {
    return false;
  }
  return required.every((doc) => state.documentsReceived.includes(doc.id));
}

export function missingDocuments(
  state: CaseState,
  required: RequiredDocument[],
): RequiredDocument[] {
  return required.filter((doc) => !state.documentsReceived.includes(doc.id));
}

export function countChannelTouches(
  state: CaseState,
  channel: Channel,
  currentDay: number,
  window: "calendar_day" | "rolling_7_days",
): number {
  return state.touches.filter((touch) => {
    if (touch.channel !== channel || touch.policyVerdict === "DENY") {
      return false;
    }
    if (window === "calendar_day") {
      return touch.day === currentDay;
    }
    return currentDay - touch.day <= 6;
  }).length;
}

export function detectSignals(
  state: CaseState,
  task: TaskDefinition,
): string[] {
  const signals: string[] = [];

  if (allDocumentsReceived(state, task.requiredDocuments)) {
    signals.push("all_documents_received");
    return signals;
  }

  if (state.day === 1) {
    signals.push("case_opened");
  }

  const daysSinceResponse = state.day - state.noResponseSinceDay;
  if (daysSinceResponse >= 2 && state.touches.length > 0) {
    signals.push("no_response_48h");
  }

  if (
    task.escalationAfterDay &&
    state.day >= task.escalationAfterDay &&
    !state.humanEscalated
  ) {
    signals.push("escalation_threshold");
  }

  if (state.recipientPromisedDay && state.day >= state.recipientPromisedDay) {
    signals.push("recipient_callback_due");
  }

  if (signals.length === 0 && !state.completed) {
    signals.push("continue_outreach");
  }

  return signals;
}

export function cloneCaseState(state: CaseState): CaseState {
  return {
    ...state,
    documentsReceived: [...state.documentsReceived],
    touches: [...state.touches],
  };
}

export const PERSONA_LABELS: Record<PersonaId, string> = {
  responsive: "Responsive — uploads after email reminder",
  ghost: "Ghost — ignores until late in the window",
  sms_preferred: "SMS preferred — only reacts to text messages",
  disputes: "Disputes — challenges required documents",
};
