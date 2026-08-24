import type { SimulationGraph, SimulationGraphPath } from "../types";
import styles from "./GraphOverview.module.css";

interface GraphOverviewProps {
  graph: SimulationGraph;
  selectedPathId: string;
  onSelectPath: (pathId: string) => void;
}

const OUTCOME_COLOR: Record<SimulationGraphPath["outcome"], string> = {
  success: styles.outcomeSuccess,
  partial: styles.outcomePartial,
  blocked: styles.outcomeBlocked,
  ongoing: styles.outcomeOngoing,
};

export function GraphOverview({
  graph,
  selectedPathId,
  onSelectPath,
}: GraphOverviewProps) {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  return (
    <div className={styles.wrapper}>
      <div className={styles.stats}>
        <span>{graph.nodeCount} nodes</span>
        <span>{graph.pathCount} paths</span>
        <span>
          depth ≤ {graph.limits.maxDepth} · {graph.limits.maxBranchesPerNode} branches/node
        </span>
      </div>

      <div className={styles.pathList}>
        {graph.paths.map((path) => (
          <button
            key={path.id}
            type="button"
            className={`${styles.pathBtn} ${path.id === selectedPathId ? styles.pathBtnActive : ""}`}
            onClick={() => onSelectPath(path.id)}
          >
            <span className={`${styles.outcomeDot} ${OUTCOME_COLOR[path.outcome]}`} />
            <span className={styles.pathLabel}>{path.label}</span>
            <span className={styles.pathMeta}>{path.nodeIds.length} steps</span>
          </button>
        ))}
      </div>

      <div className={styles.miniGraph}>
        {graph.paths.slice(0, 6).map((path) => (
          <div key={path.id} className={styles.miniPath}>
            {path.nodeIds.map((nodeId) => {
              const node = nodeMap.get(nodeId);
              if (!node) return null;
              const onPath = graph.paths.find((p) => p.id === selectedPathId)?.nodeIds.includes(nodeId);
              return (
                <div
                  key={nodeId}
                  className={`${styles.miniNode} ${onPath ? styles.miniNodeActive : ""}`}
                  title={node.branchLabel ?? node.timeLabel}
                >
                  {node.actions[0]?.toolName ?? node.signal?.badge ?? "•"}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
