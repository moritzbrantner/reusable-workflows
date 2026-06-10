export function DependencyGraph({
  ariaLabel,
  caption,
  className,
  edges = [],
  nodes,
  showLegend = false,
}: {
  ariaLabel: string;
  caption?: string;
  className?: string;
  edges?: readonly {
    id: string;
    kind?: string;
    label?: string;
    source: string;
    target: string;
  }[];
  nodes: readonly {
    description: string;
    group: string;
    height: number;
    id: string;
    label: string;
    status: string;
    tone: string;
    version?: string;
    width: number;
    x: number;
    y: number;
  }[];
  showLegend?: boolean;
}) {
  const padding = 56;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const width = Math.max(...nodes.map((node) => node.x + node.width)) + padding * 2;
  const height = Math.max(...nodes.map((node) => node.y + node.height)) + padding * 2;

  return (
    <figure className={className} data-slot="dependency-graph">
      <div data-slot="dependency-graph-scroll-area">
        <svg
          aria-label={ariaLabel}
          data-slot="dependency-graph-svg"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <defs>
            <marker
              id="workflow-graph-arrow"
              markerHeight="8"
              markerWidth="8"
              orient="auto"
              refX="7"
              refY="4"
              viewBox="0 0 8 8"
            >
              <path d="M0 0L8 4L0 8Z" />
            </marker>
          </defs>
          <g transform={`translate(${padding} ${padding})`}>
            {edges.map((edge, edgeIndex) => {
              const source = nodeById.get(edge.source);
              const target = nodeById.get(edge.target);

              if (!source || !target) {
                return null;
              }

              const sourceX = source.x + source.width;
              const sourceY = source.y + source.height / 2;
              const targetX = target.x;
              const targetY = target.y + target.height / 2;
              const curve = Math.max(64, Math.abs(targetX - sourceX) * 0.45);
              const labelX = sourceX + (targetX - sourceX) / 2;
              const labelY = sourceY + (targetY - sourceY) / 2 - 8 - (edgeIndex % 2) * 8;

              return (
                <g
                  className="workflow-graph__edge"
                  data-kind={edge.kind ?? "runtime"}
                  key={edge.id}
                >
                  <path
                    d={`M ${sourceX} ${sourceY} C ${sourceX + curve} ${sourceY}, ${targetX - curve} ${targetY}, ${targetX} ${targetY}`}
                  />
                  {edge.label ? (
                    <text x={labelX} y={labelY}>
                      {edge.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {nodes.map((node) => (
              <g
                className="workflow-graph__node"
                data-status={node.status}
                data-tone={node.tone}
                key={node.id}
                transform={`translate(${node.x} ${node.y})`}
              >
                <rect height={node.height} rx="8" width={node.width} />
                <text className="workflow-graph__node-label" x="16" y="28">
                  {node.label}
                </text>
                <text className="workflow-graph__node-group" x="16" y="50">
                  {node.group}
                </text>
                <foreignObject height={node.height - 64} width={node.width - 32} x="16" y="60">
                  <p>{node.description}</p>
                </foreignObject>
              </g>
            ))}
          </g>
        </svg>
      </div>
      {showLegend ? (
        <div data-slot="dependency-graph-legend">
          <span data-tone="accent">Caller Workflow</span>
          <span data-tone="success">Reusable Workflow</span>
          <span data-tone="warning">Compatibility</span>
          <span data-tone="muted">No caller workflow</span>
        </div>
      ) : null}
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
