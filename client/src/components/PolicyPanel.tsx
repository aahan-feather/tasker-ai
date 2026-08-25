import type { PolicyDefinition } from "../types";
import styles from "./PolicyPanel.module.css";

interface PolicyPanelProps {
  policies: PolicyDefinition[];
  enabledIds: Set<string>;
  onToggle: (policyId: string) => void;
  onMaxChange: (policyId: string, max: number) => void;
}

function describePolicy(policy: PolicyDefinition): string {
  switch (policy.type) {
    case "frequency_cap":
      return `Max ${policy.max} ${policy.channel ?? "contact"} per ${policy.window?.replace("_", " ") ?? "window"}`;
    case "time_window":
      return `Allowed hours: ${policy.allowed ?? "—"}`;
    case "consent_required":
      return `Requires consent for ${policy.channel ?? "channel"}`;
    case "goal_gate":
      return `When ${policy.when?.replace(/_/g, " ") ?? "condition"} → ${policy.action?.replace(/_/g, " ") ?? "action"}`;
    case "messaging_policy":
      return policy.rule ?? "Customer-facing messaging rule";
    default:
      return policy.type;
  }
}

export function PolicyPanel({
  policies,
  enabledIds,
  onToggle,
  onMaxChange,
}: PolicyPanelProps) {
  return (
    <ul className={styles.list}>
      {policies.map((policy) => {
        const enabled = enabledIds.has(policy.id);
        return (
          <li
            key={policy.id}
            className={`${styles.item} ${!enabled ? styles.itemDisabled : ""}`}
          >
            <div className={styles.row}>
              <label className={styles.enable}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => onToggle(policy.id)}
                />
                <code>{policy.id}</code>
              </label>
              <span className={styles.type}>{policy.type}</span>
            </div>

            <p className={styles.desc}>{describePolicy(policy)}</p>

            {policy.type === "goal_gate" && (
              <p className={styles.hint}>
                Stops email/SMS/phone outreach once the scenario goal is marked complete
                (e.g. a tool return includes “success”, “booked”, or “confirmed”).
              </p>
            )}

            {enabled && policy.type === "frequency_cap" && (
              <label className={styles.inlineField}>
                Max
                <input
                  type="number"
                  min={0}
                  value={policy.max ?? 0}
                  onChange={(e) => onMaxChange(policy.id, Number(e.target.value))}
                />
              </label>
            )}
          </li>
        );
      })}
    </ul>
  );
}
