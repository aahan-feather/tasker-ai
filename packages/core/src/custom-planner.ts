import type {
  CustomScenarioDefinition,
  CustomToolDefinition,
  PolicyDefinition,
  PolicyEvaluation,
  ScenarioState,
  ToolCategory,
} from "./types.js";
import { evaluatePolicies } from "./policy-engine.js";
import type { ProposedAction } from "./types.js";

export interface ProposedToolAction {
  toolId: string;
  toolName: string;
  category: ToolCategory;
  reason: string;
}

function categoryToChannel(category: ToolCategory): ProposedAction["channel"] | null {
  switch (category) {
    case "phone":
      return "voice";
    case "sms":
      return "sms";
    case "email":
      return "email";
    default:
      return null;
  }
}

export function evaluateToolPolicies(
  state: ScenarioState,
  policies: PolicyDefinition[],
  proposal: ProposedToolAction,
  scenario: CustomScenarioDefinition,
): PolicyEvaluation {
  if (proposal.category === "phone") {
    const dailyCap = policies.find(
      (p) => p.type === "frequency_cap" && p.channel === "voice" && p.window === "calendar_day",
    );
    if (dailyCap?.max && state.phoneCallsToday >= dailyCap.max) {
      return {
        verdict: "DENY",
        reason: `Phone cap exceeded (${state.phoneCallsToday}/${dailyCap.max} today)`,
        policyId: dailyCap.id,
      };
    }
    const weeklyCap = policies.find(
      (p) => p.type === "frequency_cap" && p.channel === "voice" && p.window === "rolling_7_days",
    );
    if (weeklyCap?.max && state.phoneCallsWeek >= weeklyCap.max) {
      return {
        verdict: "DENY",
        reason: `Weekly phone cap exceeded (${state.phoneCallsWeek}/${weeklyCap.max})`,
        policyId: weeklyCap.id,
      };
    }
  }

  const channel = categoryToChannel(proposal.category);

  if (channel) {
    const goalId = "__scenario_goal__";
    const pseudoTask = {
      id: "custom",
      name: scenario.outcome,
      outcome: scenario.outcome,
      deadlineDays: scenario.deadlineDays,
      requiredDocuments: [{ id: goalId, label: scenario.outcome }],
      toolkit: [channel],
    };

    const pseudoAction: ProposedAction = {
      channel,
      actionType: "outreach",
      reason: proposal.reason,
    };

    const channelTouches =
      proposal.category === "phone" && state.phoneCallsToday > 0
        ? Array.from({ length: state.phoneCallsToday }, () => ({
            day: state.day,
            hour: 10,
            channel: "voice" as const,
            actionType: "outreach",
            outcome: "sim",
            policyVerdict: "ALLOW" as const,
          }))
        : [];

    return evaluatePolicies(
      {
        day: state.day,
        simHour: 10,
        documentsReceived: state.completed ? [goalId] : [],
        touches: channelTouches,
        optedOut: false,
        smsConsent: true,
        emailConsent: true,
        noResponseSinceDay: 1,
        humanEscalated: state.escalated,
        completed: state.completed,
      },
      pseudoTask,
      policies,
      pseudoAction,
    );
  }

  return { verdict: "ALLOW", reason: "No channel policy applies to this tool" };
}

export function planNextTool(
  scenario: CustomScenarioDefinition,
  state: ScenarioState,
): ProposedToolAction | null {
  if (state.completed || state.blocked) {
    return null;
  }

  const tools = scenario.tools;
  if (tools.length === 0) {
    return null;
  }

  const tool = tools[state.stepIndex % tools.length];
  return {
    toolId: tool.id,
    toolName: tool.name,
    category: tool.category,
    reason: tool.action,
  };
}

export function categorySubtitle(category: ToolCategory): string {
  const map: Record<ToolCategory, string> = {
    horizon: "Horizon",
    api: "API",
    phone: "Phone",
    workflow: "Workflow",
    sms: "SMS",
    email: "Email",
    tool: "Tool",
  };
  return map[category];
}

export function inferBadgeFromScenario(scenario: CustomScenarioDefinition): string {
  if (scenario.initialSignalBadge) return scenario.initialSignalBadge;
  const first = scenario.tools[0];
  return first?.name ?? "Signal";
}

export function inferSignalTitle(scenario: CustomScenarioDefinition): string {
  if (scenario.initialSignal) return scenario.initialSignal;
  const words = scenario.description.split(/[.!?]/)[0]?.trim();
  return words && words.length > 10 ? words : scenario.outcome;
}
