"use client";

import { useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Position,
  type Edge,
  type Node
} from "reactflow";
import { ArrowDownRight, Target } from "lucide-react";
import "reactflow/dist/style.css";

export type SkillGraphNode = {
  requirementId: string;
  skillId: string;
  name: string;
  category: string | null;
  stage: number;
  targetScore: number;
  capabilityScore: number | null;
  confidence: number;
  priorityBand: string | null;
  gapSeverity: number | null;
  status: "STRONG" | "DEVELOPING" | "GAP" | "UNKNOWN";
};

export type SkillGraphEdge = {
  prerequisiteRequirementId: string;
  dependentRequirementId: string;
  edgeType: "HARD" | "SOFT";
};

function palette(item: SkillGraphNode) {
  if (item.status === "STRONG") {
    return { border: "#A6F4C5", background: "#F6FEF9", color: "#05603A", accent: "#12B76A" };
  }
  if (item.status === "DEVELOPING") {
    return { border: "#FEC84B", background: "#FFFAEB", color: "#93370D", accent: "#F79009" };
  }
  if (item.status === "GAP") {
    return { border: "#FECDCA", background: "#FEF3F2", color: "#912018", accent: "#F04438" };
  }
  return { border: "#D0D5DD", background: "#F9FAFB", color: "#344054", accent: "#98A2B3" };
}

export function SkillGraph({
  roleName,
  items,
  dependencies
}: {
  roleName: string;
  items: SkillGraphNode[];
  dependencies: SkillGraphEdge[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find(item => item.requirementId === selectedId) ?? null;

  const connectedIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>([selectedId]);
    for (const edge of dependencies) {
      if (edge.prerequisiteRequirementId === selectedId) set.add(edge.dependentRequirementId);
      if (edge.dependentRequirementId === selectedId) set.add(edge.prerequisiteRequirementId);
    }
    return set;
  }, [dependencies, selectedId]);

  const { nodes, edges } = useMemo(() => {
    const stageGroups = new Map<number, SkillGraphNode[]>();

    for (const item of items) {
      const list = stageGroups.get(item.stage) ?? [];
      list.push(item);
      stageGroups.set(item.stage, list);
    }

    const graphNodes: Node[] = [];
    for (const [stage, stageItems] of [...stageGroups.entries()].sort((a, b) => a[0] - b[0])) {
      stageItems
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((item, index) => {
          const tones = palette(item);
          const capability = item.capabilityScore == null ? "Unknown" : item.capabilityScore.toFixed(1) + "/4";
          const dimmed = selectedId ? !connectedIds.has(item.requirementId) : false;
          const selectedNode = selectedId === item.requirementId;

          graphNodes.push({
            id: item.requirementId,
            position: { x: (stage - 1) * 310, y: index * 155 },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            data: {
              label: (
                <div className="min-w-44 text-left">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: tones.accent }} />
                    <div>
                      <p className="font-semibold leading-5">{item.name}</p>
                      <p className="mt-1 text-xs opacity-70">{item.category ?? "Skill"} · Stage {stage}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <span className="opacity-70">Current {capability}</span>
                    <span className="font-semibold">Target {item.targetScore.toFixed(1)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: Math.max(4, Math.min(100, ((item.capabilityScore ?? 0) / Math.max(item.targetScore, 0.1)) * 100)) + "%",
                        background: tones.accent
                      }}
                    />
                  </div>
                </div>
              )
            },
            style: {
              border: "1px solid " + tones.border,
              background: tones.background,
              color: tones.color,
              borderRadius: 14,
              padding: 12,
              width: 238,
              opacity: dimmed ? 0.36 : 1,
              boxShadow: selectedNode
                ? "0 0 0 3px rgba(91,92,226,0.15), 0 10px 30px rgba(16,24,40,0.10)"
                : "0 1px 3px rgba(16,24,40,0.07)",
              transition: "opacity 180ms ease, box-shadow 180ms ease, transform 180ms ease"
            }
          });
        });
    }

    const graphEdges: Edge[] = dependencies.map((edge, index) => {
      const highlighted = selectedId
        ? edge.prerequisiteRequirementId === selectedId || edge.dependentRequirementId === selectedId
        : false;
      return {
        id: "dep-" + index + "-" + edge.prerequisiteRequirementId + "-" + edge.dependentRequirementId,
        source: edge.prerequisiteRequirementId,
        target: edge.dependentRequirementId,
        animated: highlighted && edge.edgeType === "HARD",
        markerEnd: { type: MarkerType.ArrowClosed, color: highlighted ? "#5B5CE2" : "#98A2B3" },
        style: {
          strokeWidth: highlighted ? 2.4 : edge.edgeType === "HARD" ? 1.8 : 1.4,
          stroke: highlighted ? "#5B5CE2" : "#98A2B3",
          strokeDasharray: edge.edgeType === "SOFT" ? "6 5" : undefined,
          opacity: selectedId && !highlighted ? 0.2 : 0.72,
          transition: "opacity 180ms ease, stroke 180ms ease"
        }
      };
    });

    return { nodes: graphNodes, edges: graphEdges };
  }, [items, dependencies, selectedId, connectedIds]);

  if (!items.length) return null;

  return (
    <section className="surface-card mt-8 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div>
          <p className="eyebrow">Skill Graph</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{roleName} competency path</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
            Click a skill to isolate its prerequisite neighborhood. Solid links are required dependencies; dashed links are supporting relationships.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Legend dot="#12B76A" label="Strong" />
          <Legend dot="#F79009" label="Developing" />
          <Legend dot="#F04438" label="Gap" />
          <Legend dot="#98A2B3" label="Unknown" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px]">
        <div className="h-[570px] overflow-hidden bg-[#FAFBFC]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.35}
            maxZoom={1.65}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            onPaneClick={() => setSelectedId(null)}
            onNodeClick={(_, node) => setSelectedId(node.id)}
          >
            <Background gap={24} size={1} color="#E4E7EC" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
        </div>

        <aside className="border-t border-slate-100 bg-white p-5 lg:border-l lg:border-t-0">
          {selected ? (
            <div className="soft-pop">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Selected skill</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">{selected.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">{selected.category ?? "Skill"} · Stage {selected.stage}</p>
                </div>
                <span
                  className="mt-1 size-3 rounded-full"
                  style={{ background: palette(selected).accent }}
                />
              </div>

              <div className="mt-5 space-y-3">
                <InspectorRow label="Current capability" value={selected.capabilityScore == null ? "Unknown" : selected.capabilityScore.toFixed(2) + " / 4"} />
                <InspectorRow label="Target" value={selected.targetScore.toFixed(2) + " / 4"} />
                <InspectorRow label="Confidence" value={Math.round(selected.confidence * 100) + "%"} />
                <InspectorRow label="Gap" value={selected.gapSeverity == null ? "No snapshot" : Math.round(selected.gapSeverity * 100) + "%"} />
                <InspectorRow label="Priority" value={selected.priorityBand ?? "—"} />
              </div>

              <button
                type="button"
                onClick={() => document.getElementById("skill-" + selected.skillId)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className="btn-secondary mt-5 w-full"
              >
                Inspect evidence <ArrowDownRight className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center text-center">
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Target className="size-5" />
              </span>
              <p className="mt-4 text-sm font-semibold text-slate-800">Select a skill node</p>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                We will highlight its connected requirements and show the learner-state details here.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
      <span className="size-2 rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}
