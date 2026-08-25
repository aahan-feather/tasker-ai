import type { SimulationGraph, SimulationGraphNode } from "../types";
import styles from "./HorizonTimeline.module.css";

interface HorizonTimelineProps {
  graph: SimulationGraph;
  pathNodeIds: string[];
  pendingChildCount?: number;
}

const CATEGORY_CLASS: Record<string, string> = {
  horizon: styles.catHorizon,
  api: styles.catApi,
  phone: styles.catPhone,
  workflow: styles.catWorkflow,
  sms: styles.catSms,
  email: styles.catEmail,
  tool: styles.catTool,
};

export function HorizonTimeline({
  graph,
  pathNodeIds,
  pendingChildCount = 2,
}: HorizonTimelineProps) {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const pathNodes = pathNodeIds
    .map((id) => nodeMap.get(id))
    .filter((n): n is SimulationGraphNode => n !== undefined);

  const lastNode = pathNodes[pathNodes.length - 1];
  const hasMore = lastNode && !lastNode.isTerminal && lastNode.childIds.length > 0;

  return (
    <div className={styles.wrapper}>
      <div className={styles.rail}>
        {pathNodes.map((node, idx) => (
          <div key={node.id} className={styles.railSegment}>
            <div className={styles.railDot} />
            <span className={styles.railLabel}>{node.timeLabel}</span>
            {idx < pathNodes.length - 1 && <div className={styles.railLine} />}
          </div>
        ))}
        {hasMore && (
          <div className={styles.railSegment}>
            <div className={styles.railDotMuted} />
            <span className={styles.railLabelMuted}>…</span>
          </div>
        )}
      </div>

      <div className={styles.columns}>
        {pathNodes.map((node) => (
          <div key={node.id} className={styles.column}>
            {node.signal && (
              <div className={styles.signalCard}>
                <div className={styles.signalHeader}>
                  <span className={styles.signalTitle}>Signal</span>
                  <span className={styles.signalBadge}>{node.signal.badge}</span>
                </div>
                <p className={styles.signalHeadline}>{node.signal.title}</p>
                <p className={styles.signalDesc}>{node.signal.description}</p>
              </div>
            )}

            {node.agentMemory.length > 0 && (
              <div className={styles.memoryCard}>
                <div className={styles.memoryHeader}>
                  <span className={styles.sparkle}>✦</span>
                  Agent memory
                </div>
                <ul className={styles.memoryList}>
                  {node.agentMemory.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {node.actions.map((action, i) => (
              <div
                key={i}
                className={`${styles.actionBlock} ${CATEGORY_CLASS[action.category] ?? styles.catTool}`}
              >
                <div className={styles.actionMeta}>{action.subtitle}</div>
                <p className={styles.actionDesc}>{action.description}</p>
                {action.returnValue && (
                  <p className={styles.actionReturn}>→ {action.returnValue}</p>
                )}
                {action.policyVerdict && action.policyVerdict !== "ALLOW" && (
                  <p className={styles.policyNote}>
                    Policy: {action.policyVerdict} — {action.policyReason}
                  </p>
                )}
              </div>
            ))}

            {node.branchLabel && node.depth > 0 && (
              <div className={styles.branchTag}>Branch: {node.branchLabel}</div>
            )}
          </div>
        ))}

        {hasMore &&
          Array.from({ length: pendingChildCount }).map((_, i) => (
            <div key={`pending-${i}`} className={styles.column}>
              <div className={styles.pendingBlock}>
                <div className={styles.pendingLine} />
                <div className={styles.pendingLine} />
                <div className={styles.pendingLineShort} />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
