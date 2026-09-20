"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Position,
  type Edge,
  type Node
} from "reactflow";
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

function nodeStyle(item: SkillGraphNode): React.CSSProperties {
  if (item.status === "STRONG") {
    return { border: "1px solid #86efac", background: "#f0fdf4", color: "#14532d" };
  }
  if (item.status === "DEVELOPING") {
    return { border: "1px solid #fde68a", background: "#fffbeb", color: "#78350f" };
  }
  if (item.status === "GAP") {
    return { border: "1px solid #fca5a5", background: "#fef2f2", color: "#7f1d1d" };
  }
  return { border: "1px solid #cbd5e1", background: "#f8fafc", color: "#334155" };
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
          const capability = item.capabilityScore == null ? "Unknown" : item.capabilityScore.toFixed(1) + "/4";
          const gap = item.gapSeverity == null ? "No snapshot" : Math.round(item.gapSeverity * 100) + "% gap";

          graphNodes.push({
            id: item.requirementId,
            position: { x: (stage - 1) * 300, y: index * 150 },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            data: {
              label: (
                <div className="min-w-44 text-left">
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-xs opacity-75">
                    Stage {stage} · {capability}
                  </p>
                  <p className="mt-1 text-xs opacity-75">
                    Target {item.targetScore.toFixed(1)}/4 · {gap}
                  </p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {item.priorityBand ?? item.status}
                  </p>
                </div>
              )
            },
            style: {
              ...nodeStyle(item),
              borderRadius: 14,
              padding: 12,
              width: 230,
              boxShadow: "0 1px 3px rgba(15,23,42,0.08)"
            }
          });
        });
    }

    const graphEdges: Edge[] = dependencies.map((edge, index) => ({
      id: "dep-" + index + "-" + edge.prerequisiteRequirementId + "-" + edge.dependentRequirementId,
      source: edge.prerequisiteRequirementId,
      target: edge.dependentRequirementId,
      animated: edge.edgeType === "HARD",
      markerEnd: { type: MarkerType.ArrowClosed },
      style: edge.edgeType === "HARD"
        ? { strokeWidth: 2 }
        : { strokeWidth: 1.5, strokeDasharray: "6 5" },
      label: edge.edgeType === "HARD" ? "prerequisite" : "supports",
      labelStyle: { fontSize: 10 }
    }));

    return { nodes: graphNodes, edges: graphEdges };
  }, [items, dependencies]);

  if (!items.length) return null;

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Skill Graph</p>
          <h2 className="mt-1 text-xl font-semibold">{roleName} competency path</h2>
          <p className="mt-1 text-sm text-slate-600">
            Role requirements are arranged by learning stage. Solid edges are hard prerequisites; dashed edges are supporting dependencies.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-800">Strong</span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">Developing</span>
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-800">Gap</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Unknown</span>
        </div>
      </div>

      <div className="mt-5 h-[560px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.35}
          maxZoom={1.6}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          onNodeClick={(_, node) => {
            const item = items.find(candidate => candidate.requirementId === node.id);
            if (item) {
              document.getElementById("skill-" + item.skillId)?.scrollIntoView({
                behavior: "smooth",
                block: "center"
              });
            }
          }}
        >
          <Background gap={20} size={1} />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
