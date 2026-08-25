import type { CustomScenarioDefinition, ScenarioState } from "./types.js";

export function createScenarioState(): ScenarioState {
  return {
    day: 1,
    stepIndex: 0,
    memory: [],
    phoneCallsToday: 0,
    phoneCallsWeek: 0,
    completed: false,
    blocked: false,
    escalated: false,
    context: {},
  };
}

export function cloneScenarioState(state: ScenarioState): ScenarioState {
  return {
    ...state,
    memory: [...state.memory],
    context: { ...state.context },
  };
}

export function buildInitialMemory(scenario: CustomScenarioDefinition): string {
  return `Goal: ${scenario.outcome}. Context: ${scenario.description.slice(0, 120)}${scenario.description.length > 120 ? "…" : ""}`;
}

export function deriveMemoryFromReturn(
  returnValue: string | undefined,
  toolName: string,
): string | null {
  if (!returnValue) return null;
  const lower = returnValue.toLowerCase();
  if (lower.includes("sms") || lower.includes("text")) {
    return "The contact prefers SMS for follow-ups.";
  }
  if (lower.includes("thursday") || lower.includes("friday")) {
    return `Scheduling preference noted from ${toolName}: ${returnValue}`;
  }
  if (lower.includes("evidence") || lower.includes("document")) {
    return `${toolName} surfaced a documentation requirement: ${returnValue}`;
  }
  if (lower.includes("complete") || lower.includes("success") || lower.includes("booked")) {
    return `Progress via ${toolName}: ${returnValue}`;
  }
  return `${toolName} returned: ${returnValue}`;
}

export function isTerminalSuccessReturn(
  returnValue: string,
  outcome: string,
): boolean {
  const r = returnValue.toLowerCase();
  const o = outcome.toLowerCase();

  const explicitTerminal = [
    "goal achieved",
    "goal complete",
    "outcome achieved",
    "all documents validated successfully",
    "all required documents received",
  ];
  if (explicitTerminal.some((phrase) => r.includes(phrase))) {
    return true;
  }

  if (o.includes("appointment") && r.includes("appointment booked")) {
    return true;
  }
  if (o.includes("scheduled") && (r.includes("booked") || r.includes("scheduled"))) {
    return true;
  }
  if (o.includes("authorization") && r.includes("authorization approved")) {
    return true;
  }
  if (o.includes("document") && r.includes("all documents")) {
    return true;
  }

  return false;
}

export function applyToolReturn(
  state: ScenarioState,
  toolName: string,
  category: string,
  returnValue: string,
  scenarioOutcome: string,
): ScenarioState {
  const next = cloneScenarioState(state);
  next.stepIndex += 1;

  if (category === "phone") {
    next.phoneCallsToday += 1;
    next.phoneCallsWeek += 1;
  }

  if (isTerminalSuccessReturn(returnValue, scenarioOutcome)) {
    next.completed = true;
    next.context.status = "success";
  }

  const lower = returnValue.toLowerCase();
  if (lower.includes("blocked") || lower.includes("denied") || lower.includes("timeout")) {
    next.context.lastIssue = returnValue;
  }

  if (lower.includes("escalat") || lower.includes("manual review")) {
    next.escalated = true;
  }

  if (next.stepIndex % 2 === 0) {
    next.day = Math.min(next.day + 1, 30);
    next.phoneCallsToday = 0;
  }

  const mem = deriveMemoryFromReturn(returnValue, toolName);
  if (mem) {
    next.memory.push(mem);
  }

  next.context[`${toolName}_last`] = returnValue;
  return next;
}

export function applyPolicyDeny(state: ScenarioState): ScenarioState {
  const next = cloneScenarioState(state);
  next.blocked = true;
  return next;
}

export function applyPolicyDefer(state: ScenarioState): ScenarioState {
  const next = cloneScenarioState(state);
  next.day = Math.min(next.day + 1, 7);
  next.phoneCallsToday = 0;
  return next;
}
