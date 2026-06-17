import { Gauge } from "lucide-react";

import {
  formatBytes,
  formatDateTime,
  formatDecimal,
  formatDuration,
  formatOps,
  formatScoreValue,
} from "../app/formatters";
import { metricsHref } from "../app/routes";
import type { BuildMetricsHistory } from "../build-metrics";
import { MetricsTrendChart } from "./MetricsTrendChart";
import { Card, CardContent } from "./ui";

export function MetricsSection({ history }: { history: BuildMetricsHistory }) {
  const builds = history.builds;
  const latest = builds[0];

  return (
    <section className="section metrics-section" id="metrics" aria-labelledby="metrics-title">
      <div className="section__heading workflow-index-heading">
        <div>
          <p className="eyebrow">Build Metrics</p>
          <h2 id="metrics-title">Last 5 successful main performance runs.</h2>
        </div>
        <p>
          The published site carries a static metrics history from successful <code>Validate</code>{" "}
          performance jobs on <code>main</code>. Each deploy preserves the previous published JSON,
          prepends the latest run, and keeps the newest five builds.
        </p>
      </div>
      <a className="button button--secondary section-link" href={metricsHref()}>
        <Gauge aria-hidden="true" />
        KPI definitions
      </a>

      {latest ? (
        <>
          <div className="metrics-grid" aria-label="Latest build metrics">
            <MetricCard
              label="Build duration"
              value={formatDuration(latest.durations.buildMs)}
              detail={`Run #${latest.runNumber}`}
            />
            <MetricCard
              label="JS bundle"
              value={formatBytes(latest.bundle.jsBytes)}
              detail={latest.bundle.withinBudget === false ? "Above budget" : "Within budget"}
            />
            <MetricCard
              label="Benchmark"
              value={formatOps(latest.benchmark.operationsPerSecond)}
              detail={latest.benchmark.name ?? "No benchmark name"}
            />
            <MetricCard
              label="Lighthouse"
              value={formatScoreValue(latest.lighthouse.score)}
              detail={`LCP ${formatDuration(latest.lighthouse.metrics.largestContentfulPaintMs)}`}
            />
          </div>

          <MetricsTrendChart builds={builds} />

          <div className="metrics-history">
            <div className="metrics-history__header">
              <h3>Run history</h3>
              <span>
                Updated {history.generatedAt ? formatDateTime(history.generatedAt) : "after deploy"}
              </span>
            </div>
            <div className="metrics-table-wrap">
              <table className="metrics-table" aria-label="Last 5 build metrics">
                <thead>
                  <tr>
                    <th scope="col">Run</th>
                    <th scope="col">Commit</th>
                    <th scope="col">Completed</th>
                    <th scope="col">Build</th>
                    <th scope="col">Bundle</th>
                    <th scope="col">Ops/s</th>
                    <th scope="col">Lighthouse</th>
                    <th scope="col">LCP</th>
                    <th scope="col">CLS</th>
                  </tr>
                </thead>
                <tbody>
                  {builds.map((build) => (
                    <tr key={build.id}>
                      <td>
                        <a href={build.runUrl}>#{build.runNumber}</a>
                      </td>
                      <td>
                        <a href={build.commitUrl}>{build.commitShortSha}</a>
                      </td>
                      <td>{formatDateTime(build.completedAt)}</td>
                      <td>{formatDuration(build.durations.buildMs)}</td>
                      <td>{formatBytes(build.bundle.jsBytes)}</td>
                      <td>{formatOps(build.benchmark.operationsPerSecond)}</td>
                      <td>{formatScoreValue(build.lighthouse.score)}</td>
                      <td>{formatDuration(build.lighthouse.metrics.largestContentfulPaintMs)}</td>
                      <td>{formatDecimal(build.lighthouse.metrics.cumulativeLayoutShift)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <Card className="metrics-empty">
          <CardContent className="metrics-empty__content">
            <p>
              No published build metrics yet. The next successful main-branch performance run will
              populate this section.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function MetricCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <Card className="metrics-card">
      <CardContent className="metrics-card__content">
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </CardContent>
    </Card>
  );
}
