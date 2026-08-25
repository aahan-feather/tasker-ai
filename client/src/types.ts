export type Channel = "email" | "sms" | "voice" | "upload_portal";

export type PolicyVerdict = "ALLOW" | "DENY" | "DEFER";

export type PersonaId = "responsive" | "ghost" | "sms_preferred" | "disputes";

export type SimulationOutcome = "success" | "partial" | "escalated" | "timeout";

export interface RequiredDocument {
  id: string;
  label: string;
}

export interface TaskDefinition {
  id: string;
  name: string;
  outcome: string;
  deadlineDays: number;
  requiredDocuments: RequiredDocument[];
  toolkit: Channel[];
  escalationAfterDay?: number;
}

export type PolicyType =
  | "frequency_cap"
  | "time_window"
  | "consent_required"
  | "goal_gate"
  | "messaging_policy";

export interface PolicyDefinition {
  id: string;
  type: PolicyType;
  channel?: Channel;
  max?: number;
  window?: "calendar_day" | "rolling_7_days";
  allowed?: string;
  when?: string;
  action?: string;
  visible?: boolean;
  rule?: string;
}

export interface TouchRecord {
  day: number;
  hour: number;
  channel: Channel;
  actionType: string;
  outcome: string;
  policyVerdict: PolicyVerdict;
  policyReason?: string;
  messagePreview?: string;
}

export interface ProposedAction {
  channel: Channel;
  actionType: "outreach" | "notify_human" | "wait";
  message?: string;
  reason: string;
  deferUntilDay?: number;
}

export interface PolicyEvaluation {
  verdict: PolicyVerdict;
  reason: string;
  policyId?: string;
  deferUntilDay?: number;
  deferUntilHour?: number;
}

export interface SimulationStep {
  day: number;
  hour: number;
  signal?: string;
  proposal?: ProposedAction;
  evaluation?: PolicyEvaluation;
  executed: boolean;
  touch?: TouchRecord;
  recipientEvent?: string;
  note?: string;
}

export interface SimulationResult {
  id: string;
  task: TaskDefinition;
  policies: PolicyDefinition[];
  personaId: PersonaId;
  steps: SimulationStep[];
  outcome: SimulationOutcome;
  summary: string;
  startedAt: string;
  durationMs: number;
}

export interface TaskTemplate {
  id: string;
  label: string;
  description: string;
  task: TaskDefinition;
  policies: PolicyDefinition[];
  defaultPersonaId: PersonaId;
}

export interface SimulationRequest {
  task: TaskDefinition;
  policies: PolicyDefinition[];
  personaId: PersonaId;
}

export type ToolCategory =
  | "horizon"
  | "api"
  | "phone"
  | "workflow"
  | "sms"
  | "email"
  | "tool";

export interface CustomToolDefinition {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  action: string;
  returns: string[];
}

export interface CustomScenarioDefinition {
  description: string;
  outcome: string;
  deadlineDays: number;
  initialSignal?: string;
  initialSignalBadge?: string;
  tools: CustomToolDefinition[];
}

export interface GraphSimulationLimits {
  maxDepth?: number;
  maxBranchesPerNode?: number;
  maxTotalNodes?: number;
}

export interface GraphSimulationRequest {
  scenario: CustomScenarioDefinition;
  policies: PolicyDefinition[];
  limits?: Partial<GraphSimulationLimits>;
}

export interface SignalCard {
  title: string;
  badge: string;
  description: string;
}

export interface ActionBlock {
  toolName: string;
  category: ToolCategory;
  subtitle: string;
  description: string;
  returnValue?: string;
  policyVerdict?: PolicyVerdict;
  policyReason?: string;
  pending?: boolean;
}

export interface SimulationGraphNode {
  id: string;
  parentId?: string;
  depth: number;
  columnIndex: number;
  timeLabel: string;
  signal?: SignalCard;
  agentMemory: string[];
  actions: ActionBlock[];
  childIds: string[];
  branchLabel?: string;
  isTerminal: boolean;
}

export type GraphPathOutcome = "success" | "partial" | "blocked" | "ongoing";

export interface SimulationGraphPath {
  id: string;
  nodeIds: string[];
  label: string;
  outcome: GraphPathOutcome;
}

export interface SimulationGraph {
  id: string;
  scenario: CustomScenarioDefinition;
  policies: PolicyDefinition[];
  limits: GraphSimulationLimits;
  nodes: SimulationGraphNode[];
  rootId: string;
  paths: SimulationGraphPath[];
  nodeCount: number;
  pathCount: number;
  summary: string;
  startedAt: string;
  durationMs: number;
}
