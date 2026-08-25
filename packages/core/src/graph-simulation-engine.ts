import {
  evaluateToolPolicies,
  inferBadgeFromScenario,
  inferSignalTitle,
  planNextTool,
  categorySubtitle,
} from "./custom-planner.js";
import {
  applyPolicyDeny,
  applyPolicyDefer,
  applyToolReturn,
  buildInitialMemory,
  createScenarioState,
} from "./scenario-state.js";
import type {
  ActionBlock,
  GraphSimulationLimits,
  GraphSimulationRequest,
  GraphPathOutcome,
  SimulationGraph,
  SimulationGraphNode,
  SimulationGraphPath,
} from "./types.js";
import { DEFAULT_GRAPH_LIMITS } from "./types.js";

const TIME_LABELS = [
  "Day 1",
  "+5 minutes",
  "Day 2",
  "+45 minutes",
  "Day 3",
  "+2 hours",
  "Day 4",
  "+1 day",
  "Day 5",
  "Day 6",
  "Day 7",
];

let nodeCounter = 0;

function nextNodeId(): string {
  return `node_${nodeCounter++}`;
}

function enumeratePaths(
  rootId: string,
  nodes: SimulationGraphNode[],
): SimulationGraphPath[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const paths: SimulationGraphPath[] = [];
  let pathIdx = 0;

  function walk(nodeId: string, acc: string[]): void {
    const node = byId.get(nodeId);
    if (!node) return;

    const current = [...acc, nodeId];

    if (node.isTerminal || node.childIds.length === 0) {
      const outcome: GraphPathOutcome = node.stateSnapshot.completed
        ? "success"
        : node.stateSnapshot.blocked
          ? "blocked"
          : node.stateSnapshot.escalated
            ? "partial"
            : "ongoing";

      const labels = current
        .slice(1)
        .map((id) => byId.get(id)?.branchLabel)
        .filter(Boolean)
        .slice(0, 2);

      paths.push({
        id: `path_${pathIdx++}`,
        nodeIds: current,
        label: labels.length > 0 ? labels.join(" → ") : `Path ${pathIdx}`,
        outcome,
      });
      return;
    }

    for (const childId of node.childIds) {
      walk(childId, current);
    }
  }

  walk(rootId, []);
  return paths;
}

/** Browser-safe ceiling when the user leaves max nodes blank. */
const SAFETY_MAX_NODES = 250;

function cap(value: number | undefined): number | null {
  if (value === undefined || value <= 0) return null;
  return value;
}

function formatLimitsSummary(limits: GraphSimulationLimits): string {
  const parts: string[] = [];
  const depth = cap(limits.maxDepth);
  const branches = cap(limits.maxBranchesPerNode);
  const nodes = cap(limits.maxTotalNodes);
  if (depth !== null) parts.push(`depth ${depth}`);
  if (branches !== null) parts.push(`${branches} branches/node`);
  const nodesLimit = cap(limits.maxTotalNodes);
  if (nodesLimit !== null) parts.push(`max ${nodesLimit} nodes`);
  else parts.push(`max ${SAFETY_MAX_NODES} nodes (safety cap)`);
  return parts.length > 0 ? parts.join(", ") : "no graph limits";
}

export function runGraphSimulation(request: GraphSimulationRequest): SimulationGraph {
  const start = Date.now();
  nodeCounter = 0;

  const limits: GraphSimulationLimits = {
    ...DEFAULT_GRAPH_LIMITS,
    ...request.limits,
  };

  const maxDepth = cap(limits.maxDepth);
  const maxBranchesPerNode = cap(limits.maxBranchesPerNode);
  const maxTotalNodes = cap(limits.maxTotalNodes) ?? SAFETY_MAX_NODES;

  const nodes: SimulationGraphNode[] = [];
  const rootState = createScenarioState();
  const initialMemory = buildInitialMemory(request.scenario);

  const root: SimulationGraphNode = {
    id: nextNodeId(),
    depth: 0,
    columnIndex: 0,
    timeLabel: TIME_LABELS[0],
    signal: {
      title: inferSignalTitle(request.scenario),
      badge: inferBadgeFromScenario(request.scenario),
      description: request.scenario.description,
    },
    agentMemory: [initialMemory],
    actions: [],
    childIds: [],
    stateSnapshot: rootState,
    isTerminal: false,
  };
  nodes.push(root);

  const queue: Array<{ parentId: string; state: typeof rootState; depth: number }> = [
    { parentId: root.id, state: rootState, depth: 0 },
  ];

  while (queue.length > 0 && nodes.length < maxTotalNodes) {
    const item = queue.shift()!;
    const parent = nodes.find((n) => n.id === item.parentId);
    if (!parent) continue;

    if (maxDepth !== null && item.depth >= maxDepth) {
      parent.isTerminal = true;
      continue;
    }

    const proposal = planNextTool(request.scenario, item.state);
    if (!proposal) {
      parent.isTerminal = true;
      continue;
    }

    const tool = request.scenario.tools.find((t) => t.id === proposal.toolId);
    if (!tool) {
      parent.isTerminal = true;
      continue;
    }

    const evaluation = evaluateToolPolicies(
      item.state,
      request.policies,
      proposal,
      request.scenario,
    );

    type Branch = {
      label: string;
      returnValue?: string;
      verdict: ActionBlock["policyVerdict"];
      reason: string;
      newState: typeof item.state;
      expandable: boolean;
    };

    let branches: Branch[] = [];

    if (evaluation.verdict === "DENY") {
      branches = [
        {
          label: `Policy blocked: ${evaluation.reason}`,
          verdict: "DENY",
          reason: evaluation.reason,
          newState: applyPolicyDeny(item.state),
          expandable: false,
        },
      ];
    } else if (evaluation.verdict === "DEFER") {
      branches = [
        {
          label: "Deferred by policy",
          verdict: "DEFER",
          reason: evaluation.reason,
          newState: applyPolicyDefer(item.state),
          expandable: true,
        },
      ];
    } else {
      const variants = tool.returns.length > 0 ? tool.returns : ["Completed successfully"];
      const branchCap = maxBranchesPerNode ?? variants.length;
      branches = variants.slice(0, branchCap).map((ret) => ({
        label: ret,
        returnValue: ret,
        verdict: "ALLOW" as const,
        reason: evaluation.reason,
        newState: applyToolReturn(
          item.state,
          tool.name,
          tool.category,
          ret,
          request.scenario.outcome,
        ),
        expandable: true,
      }));
    }

    const branchSlice =
      maxBranchesPerNode === null
        ? branches
        : branches.slice(0, maxBranchesPerNode);

    for (const branch of branchSlice) {
      if (nodes.length >= maxTotalNodes) break;

      const childDepth = item.depth + 1;
      const childId = nextNodeId();
      const timeLabel = TIME_LABELS[childDepth] ?? `Step ${childDepth}`;

      const action: ActionBlock = {
        toolName: proposal.toolName,
        category: proposal.category,
        subtitle: `${proposal.toolName} • ${categorySubtitle(proposal.category)}`,
        description: proposal.reason,
        returnValue: branch.returnValue,
        policyVerdict: branch.verdict,
        policyReason: branch.reason,
      };

      const child: SimulationGraphNode = {
        id: childId,
        parentId: item.parentId,
        depth: childDepth,
        columnIndex: childDepth,
        timeLabel,
        agentMemory: [...branch.newState.memory],
        actions: [action],
        childIds: [],
        branchLabel: branch.label,
        stateSnapshot: branch.newState,
        isTerminal: false,
      };

      nodes.push(child);
      parent.childIds.push(childId);

      const canExpand =
        branch.expandable &&
        (maxDepth === null || childDepth < maxDepth) &&
        !branch.newState.completed &&
        !branch.newState.blocked &&
        nodes.length < maxTotalNodes;

      if (canExpand) {
        queue.push({ parentId: childId, state: branch.newState, depth: childDepth });
      } else {
        child.isTerminal = true;
      }
    }

    if (parent.childIds.length === 0) {
      parent.isTerminal = true;
    }
  }

  const paths = enumeratePaths(root.id, nodes);
  const successPaths = paths.filter((p) => p.outcome === "success").length;

  return {
    id: `graph_${start}`,
    scenario: request.scenario,
    policies: request.policies,
    limits,
    nodes,
    rootId: root.id,
    paths,
    nodeCount: nodes.length,
    pathCount: paths.length,
    summary: `Generated ${nodes.length} nodes across ${paths.length} paths (${successPaths} successful). Limits: ${formatLimitsSummary(limits)}.`,
    startedAt: new Date(start).toISOString(),
    durationMs: Date.now() - start,
  };
}
