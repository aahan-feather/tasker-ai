import type {
  CaseState,
  Channel,
  PolicyDefinition,
  PolicyEvaluation,
  ProposedAction,
  RequiredDocument,
  TaskDefinition,
} from "./types.js";
import {
  allDocumentsReceived,
  countChannelTouches,
} from "./case-state.js";

function parseTimeWindow(allowed: string): { start: number; end: number } {
  const [start, end] = allowed.split("-");
  const startHour = parseInt(start.split(":")[0], 10);
  const endHour = parseInt(end.split(":")[0], 10);
  return { start: startHour, end: endHour };
}

function evaluateFrequencyCap(
  policy: PolicyDefinition,
  state: CaseState,
  action: ProposedAction,
): PolicyEvaluation | null {
  if (policy.type !== "frequency_cap" || !policy.channel || !policy.max || !policy.window) {
    return null;
  }
  if (action.channel !== policy.channel) {
    return null;
  }

  const count = countChannelTouches(state, policy.channel, state.day, policy.window);
  if (count >= policy.max) {
    const windowLabel =
      policy.window === "calendar_day" ? "today" : "in the last 7 days";
    return {
      verdict: "DENY",
      reason: `${policy.channel} cap exceeded (${count}/${policy.max} ${windowLabel})`,
      policyId: policy.id,
    };
  }

  return null;
}

function evaluateTimeWindow(
  policy: PolicyDefinition,
  state: CaseState,
  action: ProposedAction,
): PolicyEvaluation | null {
  if (policy.type !== "time_window" || !policy.allowed) {
    return null;
  }
  if (action.actionType === "wait" || action.actionType === "notify_human") {
    return null;
  }

  const { start, end } = parseTimeWindow(policy.allowed);
  if (state.simHour < start || state.simHour >= end) {
    return {
      verdict: "DEFER",
      reason: `Outside quiet hours (${policy.allowed})`,
      policyId: policy.id,
      deferUntilHour: start,
    };
  }

  return null;
}

function evaluateConsent(
  policy: PolicyDefinition,
  action: ProposedAction,
  state: CaseState,
): PolicyEvaluation | null {
  if (policy.type !== "consent_required" || !policy.channel) {
    return null;
  }
  if (action.channel !== policy.channel) {
    return null;
  }

  if (policy.channel === "sms" && !state.smsConsent) {
    return {
      verdict: "DENY",
      reason: "SMS consent not granted",
      policyId: policy.id,
    };
  }
  if (policy.channel === "email" && !state.emailConsent) {
    return {
      verdict: "DENY",
      reason: "Email consent not granted",
      policyId: policy.id,
    };
  }

  return null;
}

function evaluateGoalGate(
  policy: PolicyDefinition,
  state: CaseState,
  task: TaskDefinition,
  action: ProposedAction,
): PolicyEvaluation | null {
  if (policy.type !== "goal_gate") {
    return null;
  }
  if (policy.when === "all_documents_received" && policy.action === "suppress_all_outreach") {
    if (allDocumentsReceived(state, task.requiredDocuments) && action.actionType === "outreach") {
      return {
        verdict: "DENY",
        reason: "Goal complete — outreach suppressed",
        policyId: policy.id,
      };
    }
  }
  return null;
}

export function evaluatePolicies(
  state: CaseState,
  task: TaskDefinition,
  policies: PolicyDefinition[],
  action: ProposedAction,
): PolicyEvaluation {
  if (state.optedOut && action.actionType === "outreach") {
    return { verdict: "DENY", reason: "Recipient opted out" };
  }

  if (state.deferredUntilDay && state.day < state.deferredUntilDay) {
    return {
      verdict: "DEFER",
      reason: `Deferred until day ${state.deferredUntilDay}`,
      deferUntilDay: state.deferredUntilDay,
    };
  }

  if (
    state.recipientPromisedDay &&
    state.day < state.recipientPromisedDay &&
    action.channel === "voice"
  ) {
    return {
      verdict: "DEFER",
      reason: `Recipient asked to wait until day ${state.recipientPromisedDay}`,
      deferUntilDay: state.recipientPromisedDay,
    };
  }

  for (const policy of policies) {
    const checks = [
      evaluateFrequencyCap(policy, state, action),
      evaluateTimeWindow(policy, state, action),
      evaluateConsent(policy, action, state),
      evaluateGoalGate(policy, state, task, action),
    ];

    for (const result of checks) {
      if (result) {
        return result;
      }
    }
  }

  if (!task.toolkit.includes(action.channel) && action.actionType === "outreach") {
    return { verdict: "DENY", reason: `Channel ${action.channel} not in toolkit` };
  }

  return { verdict: "ALLOW", reason: "All policies passed" };
}

export const DEFAULT_POLICIES: PolicyDefinition[] = [
  {
    id: "voice_daily_cap",
    type: "frequency_cap",
    channel: "voice",
    max: 3,
    window: "calendar_day",
  },
  {
    id: "voice_weekly_cap",
    type: "frequency_cap",
    channel: "voice",
    max: 7,
    window: "rolling_7_days",
  },
  {
    id: "quiet_hours",
    type: "time_window",
    allowed: "08:00-21:00",
  },
  {
    id: "consent_sms",
    type: "consent_required",
    channel: "sms",
  },
  {
    id: "consent_email",
    type: "consent_required",
    channel: "email",
  },
  {
    id: "stop_on_success",
    type: "goal_gate",
    when: "all_documents_received",
    action: "suppress_all_outreach",
  },
  {
    id: "outreach_promise",
    type: "messaging_policy",
    visible: true,
    rule: "We will not call more than once per day",
  },
];
