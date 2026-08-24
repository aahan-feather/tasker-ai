import { useCallback, useEffect, useState } from "react";
import {
  CHANNEL_LABELS,
  fetchTemplates,
  OUTCOME_LABELS,
  PERSONAS,
  runSimulation,
} from "./api";
import type {
  PersonaId,
  PolicyDefinition,
  SimulationResult,
  TaskDefinition,
  TaskTemplate,
} from "./types";
import styles from "./App.module.css";

function cloneTask(task: TaskDefinition): TaskDefinition {
  return {
    ...task,
    requiredDocuments: task.requiredDocuments.map((d) => ({ ...d })),
    toolkit: [...task.toolkit],
  };
}

function clonePolicies(policies: PolicyDefinition[]): PolicyDefinition[] {
  return policies.map((p) => ({ ...p }));
}

export default function App() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [task, setTask] = useState<TaskDefinition | null>(null);
  const [policies, setPolicies] = useState<PolicyDefinition[]>([]);
  const [personaId, setPersonaId] = useState<PersonaId>("responsive");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplate = useCallback((template: TaskTemplate) => {
    setTask(cloneTask(template.task));
    setPolicies(clonePolicies(template.policies));
    setPersonaId(template.defaultPersonaId);
    setResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    fetchTemplates()
      .then((data) => {
        setTemplates(data);
        if (data.length > 0) {
          setSelectedTemplateId(data[0].id);
          loadTemplate(data[0]);
        }
      })
      .catch((e) => setError(e.message));
  }, [loadTemplate]);

  const onTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (template) loadTemplate(template);
  };

  const onRun = async () => {
    if (!task) return;
    setLoading(true);
    setError(null);
    try {
      const sim = await runSimulation(task, policies, personaId);
      setResult(sim);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setLoading(false);
    }
  };

  const updatePolicyMax = (policyId: string, max: number) => {
    setPolicies((prev) =>
      prev.map((p) => (p.id === policyId ? { ...p, max } : p)),
    );
  };

  if (!task) {
    return <div className={styles.loading}>Loading Task Studio…</div>;
  }

  const stepsByDay = result
    ? Array.from(
        result.steps.reduce((map, step) => {
          const list = map.get(step.day) ?? [];
          list.push(step);
          map.set(step.day, list);
          return map;
        }, new Map<number, SimulationResult["steps"]>()),
      )
    : [];

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Horizontal task orchestration</p>
          <h1>Task Studio</h1>
          <p className={styles.subtitle}>
            Define goals and policies, then simulate multi-day outreach without
            touching real customers.
          </p>
        </div>
        <button
          className={styles.runButton}
          onClick={onRun}
          disabled={loading}
          type="button"
        >
          {loading ? "Running simulation…" : "Run simulation"}
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.grid}>
        <aside className={styles.panel}>
          <h2>Task</h2>
          <label className={styles.field}>
            Template
            <select
              value={selectedTemplateId}
              onChange={(e) => onTemplateChange(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Outcome</span>
            <p className={styles.value}>{task.outcome}</p>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Deadline</span>
            <p className={styles.value}>{task.deadlineDays} days</p>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Required items</span>
            <ul className={styles.docList}>
              {task.requiredDocuments.map((doc) => (
                <li key={doc.id}>{doc.label}</li>
              ))}
            </ul>
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.label}>Toolkit</span>
            <div className={styles.chips}>
              {task.toolkit.map((ch) => (
                <span key={ch} className={styles.chip}>{CHANNEL_LABELS[ch]}</span>
              ))}
            </div>
          </div>

          <label className={styles.field}>
            Recipient persona (simulator)
            <select
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value as PersonaId)}
            >
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
        </aside>

        <aside className={styles.panel}>
          <h2>Task policies</h2>
          <p className={styles.panelHint}>
            Deterministic guardrails evaluated before every simulated action.
          </p>
          <ul className={styles.policyList}>
            {policies.map((policy) => (
              <li key={policy.id} className={styles.policyItem}>
                <div className={styles.policyHeader}>
                  <code>{policy.id}</code>
                  <span className={styles.policyType}>{policy.type}</span>
                </div>
                {policy.type === "frequency_cap" && (
                  <label className={styles.inlineField}>
                    Max {policy.channel}
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={policy.max ?? 0}
                      onChange={(e) =>
                        updatePolicyMax(policy.id, Number(e.target.value))
                      }
                    />
                    <span>{policy.window?.replace("_", " ")}</span>
                  </label>
                )}
                {policy.type === "time_window" && (
                  <p className={styles.policyDetail}>Allowed: {policy.allowed}</p>
                )}
                {policy.type === "messaging_policy" && (
                  <p className={styles.policyDetail}>{policy.rule}</p>
                )}
                {policy.type === "goal_gate" && (
                  <p className={styles.policyDetail}>
                    When {policy.when} → {policy.action}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </aside>

        <main className={styles.timelinePanel}>
          <div className={styles.timelineHeader}>
            <h2>Simulation timeline</h2>
            {result && (
              <div className={styles.resultMeta}>
                <span className={styles.outcomeBadge} data-outcome={result.outcome}>
                  {OUTCOME_LABELS[result.outcome]}
                </span>
                <span className={styles.metaText}>{result.summary}</span>
                <span className={styles.metaText}>
                  {result.steps.length} events · {result.durationMs}ms (simulated time compressed)
                </span>
              </div>
            )}
          </div>

          {!result && (
            <div className={styles.empty}>
              Click <strong>Run simulation</strong> to watch a {task.deadlineDays}-day
              journey unfold in seconds.
            </div>
          )}

          {result && (
            <div className={styles.timeline}>
              {stepsByDay.map(([day, steps]) => (
                <section key={day} className={styles.dayBlock}>
                  <div className={styles.dayLabel}>Day {day}</div>
                  <div className={styles.dayEvents}>
                    {steps.map((step, idx) => (
                      <article
                        key={`${day}-${idx}`}
                        className={styles.event}
                        data-verdict={step.evaluation?.verdict ?? "none"}
                      >
                        <div className={styles.eventTime}>
                          {String(step.hour).padStart(2, "0")}:00
                        </div>
                        <div className={styles.eventBody}>
                          {step.signal && (
                            <div className={styles.signal}>
                              Signal: {step.signal.replace(/_/g, " ")}
                            </div>
                          )}
                          {step.proposal && (
                            <div className={styles.proposal}>
                              <span className={styles.channelBadge}>
                                {CHANNEL_LABELS[step.proposal.channel]}
                              </span>
                              {step.proposal.reason}
                            </div>
                          )}
                          {step.evaluation && (
                            <div
                              className={styles.verdict}
                              data-verdict={step.evaluation.verdict}
                            >
                              Policy: {step.evaluation.verdict} — {step.evaluation.reason}
                            </div>
                          )}
                          {step.touch && (
                            <div className={styles.touch}>
                              {step.touch.outcome}
                              {step.touch.messagePreview && (
                                <blockquote>{step.touch.messagePreview}</blockquote>
                              )}
                            </div>
                          )}
                          {step.recipientEvent && (
                            <div className={styles.recipient}>
                              Recipient: {step.recipientEvent}
                            </div>
                          )}
                          {step.note && (
                            <div className={styles.note}>{step.note}</div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
