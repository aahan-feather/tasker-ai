import { planNextAction, simulateRecipientReaction } from "./agent-planner.js";
import {
  allDocumentsReceived,
  cloneCaseState,
  createInitialCaseState,
  detectSignals,
} from "./case-state.js";
import { buildTouchRecord, executeMockTool } from "./mock-tools.js";
import { evaluatePolicies } from "./policy-engine.js";
import type {
  CaseState,
  SimulationOutcome,
  SimulationRequest,
  SimulationResult,
  SimulationStep,
  TaskDefinition,
} from "./types.js";
import { getTemplateById } from "./templates.js";
import type { PersonaId } from "./types.js";

function applyRecipientReaction(
  state: CaseState,
  reaction: ReturnType<typeof simulateRecipientReaction>,
): void {
  if (reaction.documentsUploaded) {
    for (const docId of reaction.documentsUploaded) {
      if (!state.documentsReceived.includes(docId)) {
        state.documentsReceived.push(docId);
      }
    }
    state.noResponseSinceDay = state.day;
  } else if (reaction.event.includes("No response") || reaction.event.includes("Ignored")) {
    // keep noResponseSinceDay
  } else if (!reaction.dispute) {
    state.noResponseSinceDay = state.day;
  }

  if (reaction.promisedDay) {
    state.recipientPromisedDay = reaction.promisedDay;
  }
  if (reaction.optedOut) {
    state.optedOut = true;
  }
}

function determineOutcome(
  state: CaseState,
  task: TaskDefinition,
): SimulationOutcome {
  if (allDocumentsReceived(state, task.requiredDocuments)) {
    return "success";
  }
  if (state.humanEscalated) {
    return "escalated";
  }
  if (state.documentsReceived.length > 0) {
    return "partial";
  }
  return "timeout";
}

function buildSummary(
  outcome: SimulationOutcome,
  state: CaseState,
  task: TaskDefinition,
): string {
  const received = state.documentsReceived.length;
  const total = task.requiredDocuments.length;
  switch (outcome) {
    case "success":
      return `Goal achieved: all ${total} required items received by day ${state.day}.`;
    case "escalated":
      return `Escalated to human on day ${state.day} with ${received}/${total} documents received.`;
    case "partial":
      return `Deadline reached with partial progress: ${received}/${total} documents received.`;
    case "timeout":
      return `Deadline reached with no documents received.`;
  }
}

const OUTREACH_HOURS = [10, 14, 17];

export function runSimulation(request: SimulationRequest): SimulationResult {
  const start = Date.now();
  const { task, policies, personaId } = request;
  const steps: SimulationStep[] = [];
  let state = createInitialCaseState();

  for (let day = 1; day <= task.deadlineDays; day++) {
    state.day = day;

    if (allDocumentsReceived(state, task.requiredDocuments)) {
      state.completed = true;
      steps.push({
        day,
        hour: OUTREACH_HOURS[0],
        signal: "all_documents_received",
        executed: false,
        note: "Goal complete — simulation ending",
      });
      break;
    }

    for (const hour of OUTREACH_HOURS) {
      state.simHour = hour;
      const signals = detectSignals(state, task);

      for (const signal of signals) {
        if (signal === "all_documents_received") {
          state.completed = true;
          break;
        }

        const proposal = planNextAction(task, state, signal);
        const evaluation = evaluatePolicies(state, task, policies, proposal);

        const step: SimulationStep = {
          day,
          hour,
          signal,
          proposal,
          evaluation,
          executed: false,
        };

        if (evaluation.verdict === "DENY") {
          step.note = `Blocked: ${evaluation.reason}`;
          steps.push(step);
          continue;
        }

        if (evaluation.verdict === "DEFER") {
          if (evaluation.deferUntilDay) {
            state.deferredUntilDay = evaluation.deferUntilDay;
          }
          step.note = `Deferred: ${evaluation.reason}`;
          steps.push(step);
          continue;
        }

        if (proposal.actionType === "wait") {
          step.note = proposal.reason;
          steps.push(step);
          continue;
        }

        const mockResult = executeMockTool(proposal, day, hour);
        const touch = buildTouchRecord(
          day,
          hour,
          proposal.channel,
          proposal,
          mockResult,
          "ALLOW",
          evaluation.reason,
        );
        state.touches.push(touch);
        step.executed = true;
        step.touch = touch;

        if (proposal.actionType === "notify_human") {
          state.humanEscalated = true;
          step.note = "Human escalation triggered";
          steps.push(step);
          continue;
        }

        const reaction = simulateRecipientReaction(
          personaId,
          state,
          proposal.channel,
          proposal.message,
          task.requiredDocuments,
        );
        step.recipientEvent = reaction.event;
        applyRecipientReaction(state, reaction);

        if (reaction.dispute) {
          step.note = `Dispute: ${reaction.dispute}`;
        }

        steps.push(step);

        if (allDocumentsReceived(state, task.requiredDocuments)) {
          state.completed = true;
          break;
        }
      }

      if (state.completed) break;
    }

    state.deferredUntilDay = undefined;
    if (state.completed) break;
  }

  const finalState = state;
  const outcome = determineOutcome(finalState, task);

  return {
    id: `sim_${start}`,
    task,
    policies,
    personaId,
    steps,
    outcome,
    summary: buildSummary(outcome, finalState, task),
    startedAt: new Date(start).toISOString(),
    durationMs: Date.now() - start,
  };
}

export function runSimulationFromTemplate(
  templateId: string,
  personaId?: PersonaId,
): SimulationResult | null {
  const template = getTemplateById(templateId);
  if (!template) return null;

  return runSimulation({
    task: template.task,
    policies: template.policies,
    personaId: personaId ?? template.defaultPersonaId,
  });
}
