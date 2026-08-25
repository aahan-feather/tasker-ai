import type {
  CaseState,
  Channel,
  PersonaId,
  ProposedAction,
  RequiredDocument,
  TaskDefinition,
} from "./types.js";
import {
  allDocumentsReceived,
  missingDocuments,
} from "./case-state.js";

function outreachMessage(
  channel: Channel,
  missing: RequiredDocument[],
): string {
  const list = missing.map((d) => d.label).join(", ");
  switch (channel) {
    case "email":
      return `Please upload the following documents via our secure portal: ${list}`;
    case "sms":
      return `Reminder: we still need ${list}. Upload link sent.`;
    case "voice":
      return `Calling to follow up on missing documents: ${list}`;
    default:
      return `Document request: ${list}`;
  }
}

export function planNextAction(
  task: TaskDefinition,
  state: CaseState,
  signal: string,
): ProposedAction {
  if (allDocumentsReceived(state, task.requiredDocuments)) {
    return {
      channel: "upload_portal",
      actionType: "wait",
      reason: "All required documents received",
    };
  }

  if (signal === "escalation_threshold") {
    return {
      channel: "email",
      actionType: "notify_human",
      reason: "Escalation threshold reached — notify human owner",
      message: "Case requires personal follow-up",
    };
  }

  const missing = missingDocuments(state, task.requiredDocuments);
  const voiceCountToday = state.touches.filter(
    (t) => t.channel === "voice" && t.day === state.day,
  ).length;
  const hasOutreachToday = state.touches.some(
    (t) => t.day === state.day && t.actionType === "outreach",
  );

  if (signal === "case_opened" || state.day === 1) {
    const emailSent = state.touches.some(
      (t) => t.day === state.day && t.channel === "email",
    );
    const smsSent = state.touches.some(
      (t) => t.day === state.day && t.channel === "sms",
    );

    if (task.toolkit.includes("email") && !emailSent) {
      return {
        channel: "email",
        actionType: "outreach",
        reason: "Initial document request",
        message: outreachMessage("email", missing),
      };
    }

    if (task.toolkit.includes("sms") && !smsSent) {
      return {
        channel: "sms",
        actionType: "outreach",
        reason: "Initial SMS with upload link",
        message: outreachMessage("sms", missing),
      };
    }
  }

  if (signal === "no_response_48h" && task.toolkit.includes("voice") && voiceCountToday === 0) {
    return {
      channel: "voice",
      actionType: "outreach",
      reason: "No response in 48h — attempt voice follow-up",
      message: outreachMessage("voice", missing),
    };
  }

  if (signal === "recipient_callback_due" && task.toolkit.includes("voice")) {
    return {
      channel: "voice",
      actionType: "outreach",
      reason: "Recipient callback date reached",
      message: outreachMessage("voice", missing),
    };
  }

  if (!hasOutreachToday && task.toolkit.includes("sms")) {
    return {
      channel: "sms",
      actionType: "outreach",
      reason: "Daily SMS reminder for outstanding documents",
      message: outreachMessage("sms", missing),
    };
  }

  if (!hasOutreachToday && task.toolkit.includes("email")) {
    return {
      channel: "email",
      actionType: "outreach",
      reason: "Daily email reminder",
      message: outreachMessage("email", missing),
    };
  }

  return {
    channel: "upload_portal",
    actionType: "wait",
    reason: "No further outreach planned for today",
  };
}

export interface RecipientReaction {
  event: string;
  documentsUploaded?: string[];
  promisedDay?: number;
  optedOut?: boolean;
  dispute?: string;
}

export function simulateRecipientReaction(
  personaId: PersonaId,
  state: CaseState,
  channel: Channel,
  message?: string,
  required: RequiredDocument[] = [],
): RecipientReaction {
  const missing = missingDocuments(state, required);

  switch (personaId) {
    case "responsive":
      if (channel === "email" && state.day >= 1 && missing.length > 0) {
        const uploaded = missing.slice(0, Math.min(2, missing.length)).map((d) => d.id);
        return {
          event: `Opened email and uploaded ${uploaded.length} document(s)`,
          documentsUploaded: uploaded,
        };
      }
      if (channel === "voice" && missing.length > 0) {
        return {
          event: "Answered call — will upload remaining documents tomorrow",
          promisedDay: state.day + 1,
        };
      }
      return { event: "No response yet" };

    case "ghost":
      if (state.day >= 6 && missing.length > 0) {
        return {
          event: "Finally uploaded one document after repeated reminders",
          documentsUploaded: [missing[0].id],
        };
      }
      if (channel === "voice") {
        return { event: "Voicemail — no callback" };
      }
      return { event: "Ignored message" };

    case "sms_preferred":
      if (channel === "sms" && missing.length > 0) {
        const uploaded = missing.slice(0, 1).map((d) => d.id);
        return {
          event: `Replied via SMS and uploaded ${uploaded[0]}`,
          documentsUploaded: uploaded,
        };
      }
      if (channel === "email") {
        return { event: "Email unopened" };
      }
      if (channel === "voice") {
        return {
          event: "Declined call — asked to text only",
          promisedDay: state.day + 1,
        };
      }
      return { event: "No response on this channel" };

    case "disputes":
      if (state.day === 1 && channel === "email") {
        return {
          event: "Replied disputing one required document",
          dispute: "I don't think you need my bank statement for this",
        };
      }
      if (state.day >= 4 && channel === "sms" && missing.length > 0) {
        return {
          event: "Uploaded documents after dispute resolved via SMS",
          documentsUploaded: missing.map((d) => d.id),
        };
      }
      return { event: "Waiting on clarification" };

    default:
      return { event: message ? "Message received" : "No response" };
  }
}
