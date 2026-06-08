import type { BuildMetricsHistory } from "../build-metrics";
import { createMetricsChartRows, metricsChartSeries } from "../app/metricsCatalog";
import type { ChartLegendItem, MetricsChartSeriesId } from "../app/types";
import { ChartPanel, ChartSeriesLegend, useChartSeriesVisibility } from "./ChartComponents";

export function MetricsTrendChart({ builds }: { builds: BuildMetricsHistory["builds"] }) {
  const rows = createMetricsChartRows(builds);
  const legendItems: ChartLegendItem[] = metricsChartSeries.map((series) => ({
    color: series.color,
    id: series.id,
    label: series.label,
  }));
  const visibility = useChartSeriesVisibility({
    itemIds: metricsChartSeries.map((series) => series.id),
  });
  const visibleSeries = metricsChartSeries.filter((series) => visibility.isVisible(series.id));
  const chartWidth = 720;
  const chartHeight = 320;
  const chartPadding = { bottom: 36, left: 48, right: 20, top: 16 };
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const chartValues = rows.flatMap((row) =>
    visibleSeries.flatMap((series) => {
      const value = row[series.id];

      return typeof value === "number" && Number.isFinite(value) ? [value] : [];
    }),
  );
  const maxY = Math.max(125, Math.ceil((Math.max(...chartValues, 100) + 10) / 25) * 25);
  const yTicks = Array.from({ length: maxY / 25 + 1 }, (_, index) => index * 25);
  const getX = (index: number) =>
    chartPadding.left +
    (rows.length <= 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const getY = (value: number) => chartPadding.top + plotHeight - (value / maxY) * plotHeight;
  const getPath = (seriesId: MetricsChartSeriesId) => {
    let isDrawingSegment = false;

    return rows
      .flatMap((row, index) => {
        const value = row[seriesId];

        if (typeof value !== "number" || !Number.isFinite(value)) {
          isDrawingSegment = false;
          return [];
        }

        const command = isDrawingSegment ? "L" : "M";
        isDrawingSegment = true;

        return [`${command} ${getX(index).toFixed(1)} ${getY(value).toFixed(1)}`];
      })
      .join(" ");
  };
  const paths = Object.fromEntries(
    metricsChartSeries.map((series) => [series.id, getPath(series.id)]),
  ) as Record<MetricsChartSeriesId, string>;

  return (
    <ChartPanel
      className="metrics-chart-panel"
      title="Performance trend"
      description="Each KPI is indexed to its most recent available value at 100 for cross-metric comparison."
    >
      <div className="metrics-chart-layout">
        <div className="metrics-chart" role="img" aria-label="Last 5 build metrics trend chart">
          <svg
            aria-hidden="true"
            className="metrics-chart__svg"
            preserveAspectRatio="none"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          >
            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  className="metrics-chart__grid-line"
                  x1={chartPadding.left}
                  x2={chartWidth - chartPadding.right}
                  y1={getY(tick)}
                  y2={getY(tick)}
                />
                <text
                  className="metrics-chart__axis-label"
                  x={chartPadding.left - 12}
                  y={getY(tick)}
                >
                  {tick}
                </text>
              </g>
            ))}
            {rows.map((row, index) => (
              <text
                className="metrics-chart__axis-label metrics-chart__axis-label--x"
                key={row.runLabel}
                x={getX(index)}
                y={chartHeight - 10}
              >
                {row.runLabel}
              </text>
            ))}
            {visibleSeries.map((series) => (
              <g key={series.id}>
                {paths[series.id] ? (
                  <path
                    className="metrics-chart__line"
                    d={paths[series.id]}
                    stroke={series.color}
                  />
                ) : null}
                {rows.map((row, index) => {
                  const value = row[series.id];

                  if (typeof value !== "number" || !Number.isFinite(value)) {
                    return null;
                  }

                  return (
                    <circle
                      className="metrics-chart__point"
                      cx={getX(index)}
                      cy={getY(value)}
                      fill={series.color}
                      key={`${series.id}-${row.runLabel}`}
                      r={3.5}
                    >
                      <title>
                        {series.label}, {row.runLabel}: {row.raw[series.id]} ({Math.round(value)}{" "}
                        indexed)
                      </title>
                    </circle>
                  );
                })}
              </g>
            ))}
          </svg>
          <div className="metrics-chart__tooltip-list" aria-label="Chart values">
            {rows.map((row) => (
              <div key={row.runLabel}>
                <strong>{row.runLabel}</strong>
                <span>{row.completedLabel}</span>
                <dl>
                  {visibleSeries.map((series) => (
                    <div key={series.id}>
                      <dt>
                        <i style={{ backgroundColor: series.color }} aria-hidden="true" />
                        {series.label}
                      </dt>
                      <dd>{row.raw[series.id]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
        <ChartSeriesLegend
          hiddenIds={visibility.hiddenIds}
          items={legendItems}
          onHiddenIdsChange={visibility.setHiddenIds}
          orientation="vertical"
          showCounts={false}
        />
      </div>
    </ChartPanel>
  );
}
