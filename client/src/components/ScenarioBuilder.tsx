import type {
  CustomScenarioDefinition,
  CustomToolDefinition,
  GraphSimulationLimits,
  ToolCategory,
} from "../types";
import styles from "./ScenarioBuilder.module.css";

const CATEGORIES: ToolCategory[] = [
  "horizon",
  "api",
  "phone",
  "workflow",
  "sms",
  "email",
  "tool",
];

interface ScenarioBuilderProps {
  scenario: CustomScenarioDefinition;
  limits: Partial<GraphSimulationLimits>;
  examples: CustomScenarioDefinition[];
  onScenarioChange: (scenario: CustomScenarioDefinition) => void;
  onLimitsChange: (limits: Partial<GraphSimulationLimits>) => void;
}

function parseOptionalLimit(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

function newTool(): CustomToolDefinition {
  return {
    id: `tool_${Date.now()}`,
    name: "New tool",
    category: "api",
    description: "",
    action: "Performs an action",
    returns: ["Success", "Failure", "Needs follow-up"],
  };
}

export function ScenarioBuilder({
  scenario,
  limits,
  examples,
  onScenarioChange,
  onLimitsChange,
}: ScenarioBuilderProps) {
  const updateTool = (index: number, patch: Partial<CustomToolDefinition>) => {
    const tools = scenario.tools.map((t, i) =>
      i === index ? { ...t, ...patch } : t,
    );
    onScenarioChange({ ...scenario, tools });
  };

  const updateReturns = (index: number, text: string) => {
    const returns = text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    updateTool(index, { returns });
  };

  const loadExample = (ex: CustomScenarioDefinition) => {
    onScenarioChange({
      ...ex,
      tools: ex.tools.map((t) => ({ ...t, id: `${t.id}_${Date.now()}` })),
    });
  };

  return (
    <div className={styles.wrapper}>
      <label className={styles.field}>
        Load example
        <select
          value=""
          onChange={(e) => {
            const idx = Number(e.target.value);
            if (!Number.isNaN(idx) && examples[idx]) loadExample(examples[idx]);
          }}
        >
          <option value="">Choose an example…</option>
          {examples.map((ex, i) => (
            <option key={i} value={i}>
              {ex.initialSignal ?? ex.outcome}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        Scenario description
        <textarea
          rows={4}
          value={scenario.description}
          onChange={(e) =>
            onScenarioChange({ ...scenario, description: e.target.value })
          }
          placeholder="Describe the business scenario…"
        />
      </label>

      <label className={styles.field}>
        Goal / outcome
        <input
          type="text"
          value={scenario.outcome}
          onChange={(e) =>
            onScenarioChange({ ...scenario, outcome: e.target.value })
          }
        />
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          Initial signal badge
          <input
            type="text"
            value={scenario.initialSignalBadge ?? ""}
            onChange={(e) =>
              onScenarioChange({
                ...scenario,
                initialSignalBadge: e.target.value,
              })
            }
            placeholder="EHR"
          />
        </label>
        <label className={styles.field}>
          Deadline (days)
          <input
            type="number"
            min={1}
            value={scenario.deadlineDays}
            onChange={(e) =>
              onScenarioChange({
                ...scenario,
                deadlineDays: Number(e.target.value),
              })
            }
          />
        </label>
      </div>

      <label className={styles.field}>
        Initial signal (optional)
        <input
          type="text"
          value={scenario.initialSignal ?? ""}
          onChange={(e) =>
            onScenarioChange({ ...scenario, initialSignal: e.target.value })
          }
        />
      </label>

      <div className={styles.limits}>
        <span className={styles.sectionTitle}>Graph limits (optional)</span>
        <p className={styles.limitsHint}>
          Leave blank for no limit. The graph expands across all tool return branches
          until the scenario completes or branches end.
        </p>
        <div className={styles.row}>
          <label className={styles.field}>
            Max depth
            <input
              type="number"
              min={1}
              placeholder="No limit"
              value={limits.maxDepth ?? ""}
              onChange={(e) =>
                onLimitsChange({
                  ...limits,
                  maxDepth: parseOptionalLimit(e.target.value),
                })
              }
            />
          </label>
          <label className={styles.field}>
            Branches / node
            <input
              type="number"
              min={1}
              placeholder="No limit"
              value={limits.maxBranchesPerNode ?? ""}
              onChange={(e) =>
                onLimitsChange({
                  ...limits,
                  maxBranchesPerNode: parseOptionalLimit(e.target.value),
                })
              }
            />
          </label>
          <label className={styles.field}>
            Max nodes
            <input
              type="number"
              min={1}
              placeholder="No limit"
              value={limits.maxTotalNodes ?? ""}
              onChange={(e) =>
                onLimitsChange({
                  ...limits,
                  maxTotalNodes: parseOptionalLimit(e.target.value),
                })
              }
            />
          </label>
        </div>
      </div>

      <div className={styles.toolsHeader}>
        <span className={styles.sectionTitle}>Tools</span>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() =>
            onScenarioChange({
              ...scenario,
              tools: [...scenario.tools, newTool()],
            })
          }
        >
          + Add tool
        </button>
      </div>

      <div className={styles.toolList}>
        {scenario.tools.map((tool, index) => (
          <div key={tool.id} className={styles.toolCard}>
            <div className={styles.row}>
              <label className={styles.field}>
                Name
                <input
                  value={tool.name}
                  onChange={(e) => updateTool(index, { name: e.target.value })}
                />
              </label>
              <label className={styles.field}>
                Category
                <select
                  value={tool.category}
                  onChange={(e) =>
                    updateTool(index, {
                      category: e.target.value as ToolCategory,
                    })
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className={styles.field}>
              Description
              <input
                value={tool.description}
                onChange={(e) =>
                  updateTool(index, { description: e.target.value })
                }
              />
            </label>
            <label className={styles.field}>
              What it does (action)
              <input
                value={tool.action}
                onChange={(e) => updateTool(index, { action: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              Possible returns (one per line — each can branch)
              <textarea
                rows={3}
                value={tool.returns.join("\n")}
                onChange={(e) => updateReturns(index, e.target.value)}
              />
            </label>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() =>
                onScenarioChange({
                  ...scenario,
                  tools: scenario.tools.filter((_, i) => i !== index),
                })
              }
            >
              Remove tool
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
