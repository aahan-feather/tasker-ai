import cors from "cors";
import express from "express";
import {
  runSimulation,
  runGraphSimulation,
  TASK_TEMPLATES,
  EXAMPLE_SCENARIOS,
  type GraphSimulationRequest,
  type PersonaId,
  type SimulationRequest,
} from "@task-studio/core";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/templates", (_req, res) => {
  res.json(TASK_TEMPLATES);
});

app.post("/api/simulate", (req, res) => {
  try {
    const body = req.body as SimulationRequest;
    if (!body.task || !body.policies || !body.personaId) {
      res.status(400).json({ error: "task, policies, and personaId are required" });
      return;
    }

    const result = runSimulation(body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Simulation failed",
    });
  }
});

app.post("/api/simulate/template/:templateId", (req, res) => {
  try {
    const templateId = req.params.templateId;
    const personaId = req.body?.personaId as PersonaId | undefined;
    const template = TASK_TEMPLATES.find((t) => t.id === templateId);

    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    const result = runSimulation({
      task: template.task,
      policies: template.policies,
      personaId: personaId ?? template.defaultPersonaId,
    });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Simulation failed",
    });
  }
});

app.get("/api/examples", (_req, res) => {
  res.json(EXAMPLE_SCENARIOS);
});

app.post("/api/simulate/graph", (req, res) => {
  try {
    const body = req.body as GraphSimulationRequest;
    if (!body.scenario || !body.policies) {
      res.status(400).json({ error: "scenario and policies are required" });
      return;
    }
    if (!body.scenario.tools?.length) {
      res.status(400).json({ error: "scenario must include at least one tool" });
      return;
    }

    const result = runGraphSimulation(body);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Graph simulation failed",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Task Studio API listening on http://localhost:${PORT}`);
});
