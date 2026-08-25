import { runSimulation, TASK_TEMPLATES } from "@task-studio/core";

const template = TASK_TEMPLATES[0];
const result = runSimulation({
  task: template.task,
  policies: template.policies,
  personaId: "responsive",
});

console.log(`Outcome: ${result.outcome}`);
console.log(result.summary);
console.log(`Steps: ${result.steps.length}`);
console.log(
  result.steps
    .filter((s) => s.executed || s.evaluation?.verdict === "DENY")
    .slice(0, 8)
    .map((s) => `Day ${s.day} ${s.hour}:00 — ${s.signal} — ${s.proposal?.channel ?? "-"} — ${s.evaluation?.verdict ?? s.note}`)
    .join("\n"),
);
