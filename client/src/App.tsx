import { useCallback, useEffect, useState } from "react";
import {
  CHANNEL_LABELS,
  fetchExampleScenarios,
  fetchTemplates,
  OUTCOME_LABELS,
  PERSONAS,
  runGraphSimulation,
  runSimulation,
} from "./api";
import { GraphOverview } from "./components/GraphOverview";
import { HorizonTimeline } from "./components/HorizonTimeline";
import { PolicyPanel } from "./components/PolicyPanel";
import { ScenarioBuilder } from "./components/ScenarioBuilder";
import type {
  CustomScenarioDefinition,
  GraphSimulationLimits,
  PersonaId,
  PolicyDefinition,
  SimulationGraph,
  SimulationResult,
  TaskDefinition,
  TaskTemplate,
} from "./types";
import styles from "./App.module.css";

type AppMode = "graph" | "template";

const DEFAULT_LIMITS: GraphSimulationLimits = {
  maxDepth: 4,
  maxBranchesPerNode: 3,
  maxTotalNodes: 15,
};

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

const EMPTY_SCENARIO: CustomScenarioDefinition = {
  description: "",
  outcome: "",
  deadlineDays: 7,
  tools: [],
};

export default function App() {
  const [mode, setMode] = useState<AppMode>("graph");
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [examples, setExamples] = useState<CustomScenarioDefinition[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [task, setTask] = useState<TaskDefinition | null>(null);
  const [policies, setPolicies] = useState<PolicyDefinition[]>([]);
  const [enabledPolicyIds, setEnabledPolicyIds] = useState<Set<string>>(new Set());
  const [personaId, setPersonaId] = useState<PersonaId>("responsive");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [graph, setGraph] = useState<SimulationGraph | null>(null);
  const [selectedPathId, setSelectedPathId] = useState<string>("");
  const [scenario, setScenario] = useState<CustomScenarioDefinition>(EMPTY_SCENARIO);
  const [limits, setLimits] = useState<GraphSimulationLimits>(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplate = useCallback((template: TaskTemplate) => {
    const nextPolicies = clonePolicies(template.policies);
    setTask(cloneTask(template.task));
    setPolicies(nextPolicies);
    setEnabledPolicyIds(new Set(nextPolicies.map((p) => p.id)));
    setPersonaId(template.defaultPersonaId);
    setResult(null);
    setError(null);
  }, []);

  const activePolicies = policies.filter((p) => enabledPolicyIds.has(p.id));

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

    fetchExampleScenarios()
      .then((data) => {
        setExamples(data);
        if (data.length > 0) {
          setScenario(data[0]);
        }
      })
      .catch((e) => setError(e.message));
  }, [loadTemplate]);

  const onTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (template) loadTemplate(template);
  };

  const onRunTemplate = async () => {
    if (!task) return;
    setLoading(true);
    setError(null);
    setGraph(null);
    try {
      const sim = await runSimulation(task, activePolicies, personaId);
      setResult(sim);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setLoading(false);
    }
  };

  const onRunGraph = async () => {
    if (!scenario.tools.length) {
      setError("Add at least one tool to run the simulation graph.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const g = await runGraphSimulation({
        scenario,
        policies: activePolicies,
        limits,
      });
      setGraph(g);
      setSelectedPathId(g.paths[0]?.id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setLoading(false);
    }
  };

  const togglePolicy = (policyId: string) => {
    setEnabledPolicyIds((prev) => {
      const next = new Set(prev);
      if (next.has(policyId)) next.delete(policyId);
      else next.add(policyId);
      return next;
    });
  };

  const updatePolicyMax = (policyId: string, max: number) => {
    setPolicies((prev) =>
      prev.map((p) => (p.id === policyId ? { ...p, max } : p)),
    );
  };

  const selectedPath = graph?.paths.find((p) => p.id === selectedPathId);

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
            Define scenarios, tools, and policies — run branching simulation graphs
            and explore paths in a Horizon-style timeline.
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.modeTabs}>
            <button
              type="button"
              className={mode === "graph" ? styles.modeActive : styles.modeBtn}
              onClick={() => setMode("graph")}
            >
              Custom scenario
            </button>
            <button
              type="button"
              className={mode === "template" ? styles.modeActive : styles.modeBtn}
              onClick={() => setMode("template")}
            >
              Templates
            </button>
          </div>
          <button
            className={styles.runButton}
            onClick={mode === "graph" ? onRunGraph : onRunTemplate}
            disabled={loading || (mode === "template" && !task)}
            type="button"
          >
            {loading ? "Running…" : "Run simulation"}
          </button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {mode === "graph" ? (
        <div className={styles.graphLayout}>
          <aside className={styles.panel}>
            <h2>Scenario</h2>
            <ScenarioBuilder
              scenario={scenario}
              limits={limits}
              examples={examples}
              onScenarioChange={setScenario}
              onLimitsChange={setLimits}
            />
          </aside>

          <aside className={styles.panel}>
            <h2>Policies</h2>
            <p className={styles.panelHint}>
              Toggle guardrails for this run. Goal gates stop outreach when the goal
              is complete; caps apply to phone/SMS/email tools.
            </p>
            <PolicyPanel
              policies={policies}
              enabledIds={enabledPolicyIds}
              onToggle={togglePolicy}
              onMaxChange={updatePolicyMax}
            />
          </aside>

          <main className={styles.horizonPanel}>
            <div className={styles.timelineHeader}>
              <h2>Simulation graph</h2>
              {graph && (
                <p className={styles.metaText}>{graph.summary}</p>
              )}
            </div>

            {!graph && (
              <div className={styles.empty}>
                Configure your scenario and tools, then click{" "}
                <strong>Run simulation</strong> to generate up to{" "}
                {limits.maxTotalNodes} nodes with {limits.maxBranchesPerNode} branches
                per step.
              </div>
            )}

            {graph && selectedPath && (
              <>
                <GraphOverview
                  graph={graph}
                  selectedPathId={selectedPathId}
                  onSelectPath={setSelectedPathId}
                />
                <HorizonTimeline
                  graph={graph}
                  pathNodeIds={selectedPath.nodeIds}
                />
              </>
            )}
          </main>
        </div>
      ) : (
        <div className={styles.grid}>
          {!task ? (
            <div className={styles.loading}>Loading…</div>
          ) : (
            <>
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
                <label className={styles.field}>
                  Persona
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
                <h2>Policies</h2>
                <ul className={styles.policyList}>
                  {policies.map((policy) => (
                    <li key={policy.id} className={styles.policyItem}>
                      <code>{policy.id}</code>
                    </li>
                  ))}
                </ul>
              </aside>

              <main className={styles.timelinePanel}>
                <h2>Linear timeline</h2>
                {!result && (
                  <div className={styles.empty}>Run simulation for linear path.</div>
                )}
                {result && (
                  <div className={styles.timeline}>
                    {stepsByDay.map(([day, steps]) => (
                      <section key={day} className={styles.dayBlock}>
                        <div className={styles.dayLabel}>Day {day}</div>
                        <div className={styles.dayEvents}>
                          {steps.map((step, idx) => (
                            <article key={`${day}-${idx}`} className={styles.event}>
                              <div className={styles.eventBody}>
                                {step.signal && <div>{step.signal}</div>}
                                {step.proposal && (
                                  <div>
                                    {CHANNEL_LABELS[step.proposal.channel]} —{" "}
                                    {step.proposal.reason}
                                  </div>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    ))}
                    <span className={styles.outcomeBadge} data-outcome={result.outcome}>
                      {OUTCOME_LABELS[result.outcome]}
                    </span>
                  </div>
                )}
              </main>
            </>
          )}
        </div>
      )}
    </div>
  );
}
