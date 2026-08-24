import type { Channel, ProposedAction, TouchRecord } from "./types.js";

export interface MockToolResult {
  success: boolean;
  outcome: string;
  messagePreview?: string;
}

export function executeMockTool(
  action: ProposedAction,
  day: number,
  hour: number,
): MockToolResult {
  if (action.actionType === "wait") {
    return { success: true, outcome: "Waiting — no outbound action" };
  }

  if (action.actionType === "notify_human") {
    return {
      success: true,
      outcome: "Human owner notified for escalation",
      messagePreview: action.message,
    };
  }

  switch (action.channel) {
    case "email":
      return {
        success: true,
        outcome: "Email sent (simulated)",
        messagePreview: action.message,
      };
    case "sms":
      return {
        success: true,
        outcome: "SMS sent (simulated)",
        messagePreview: action.message,
      };
    case "voice":
      return {
        success: true,
        outcome: "Outbound call placed (simulated)",
        messagePreview: action.message,
      };
    case "upload_portal":
      return {
        success: true,
        outcome: "Upload portal link generated (simulated)",
        messagePreview: action.message,
      };
    default:
      return { success: false, outcome: `Unknown channel: ${action.channel}` };
  }
}

export function buildTouchRecord(
  day: number,
  hour: number,
  channel: Channel,
  action: ProposedAction,
  mockResult: MockToolResult,
  verdict: TouchRecord["policyVerdict"],
  policyReason?: string,
): TouchRecord {
  return {
    day,
    hour,
    channel,
    actionType: action.actionType,
    outcome: mockResult.outcome,
    policyVerdict: verdict,
    policyReason,
    messagePreview: mockResult.messagePreview,
  };
}
