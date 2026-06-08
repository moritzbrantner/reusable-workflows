import { ArrowLeft, Gauge } from "lucide-react";

import type { BuildMetricsHistory } from "../build-metrics";
import { formatMetricRawValue, metricsChartSeries } from "../app/metricsCatalog";
import {
  formatBytes,
  formatDateTime,
  formatDecimal,
  formatDuration,
  formatOps,
  formatScoreValue,
} from "../app/formatters";
import { homeHref, metricsHref } from "../app/routes";
import { Badge, Card, CardContent, Stat, StatDescription, StatValue } from "../components/ui";
import { MetricsTrendChart } from "../components/MetricsTrendChart";
import { SiteHeader } from "../components/SiteHeader";

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

export function MetricsPage({ history }: { history: BuildMetricsHistory }) {
  const builds = history.builds;
  const latest = builds[0];

  return (
    <>
      <SiteHeader />
      <main id="top">
        <section className="workflow-hero metrics-page-hero" aria-labelledby="metrics-page-title">
          <div className="workflow-hero__body">
            <a className="back-link" href={homeHref("metrics")}>
              <ArrowLeft aria-hidden="true" />
              Home metrics summary
            </a>
            <p className="eyebrow">Build Metrics</p>
            <h1 id="metrics-page-title">KPI definitions for performance runs.</h1>
            <p className="hero__lede">
              The metrics page documents the KPIs shown in the trend chart, where they come from,
              and how each line is normalized so build, bundle, benchmark, and Lighthouse values can
              share one axis.
            </p>
            <div className="workflow-hero__meta" aria-label="Metrics metadata">
              <Badge>Last {history.limit} successful runs</Badge>
              <Badge variant="secondary">Indexed chart</Badge>
              <Badge variant="outline">
                Updated {history.generatedAt ? formatDateTime(history.generatedAt) : "after deploy"}
              </Badge>
            </div>
          </div>
          <div className="workflow-hero__stats" aria-label="Metrics summary">
            <Stat className="signal-board__stat">
              <StatValue className="signal-board__stat-value">{builds.length}</StatValue>
              <StatDescription className="signal-board__stat-description">
                Runs tracked
              </StatDescription>
            </Stat>
            <Stat className="signal-board__stat">
              <StatValue className="signal-board__stat-value">
                {metricsChartSeries.length}
              </StatValue>
              <StatDescription className="signal-board__stat-description">KPIs</StatDescription>
            </Stat>
            <Stat className="signal-board__stat">
              <StatValue className="signal-board__stat-value">
                {latest ? formatBytes(latest.bundle.budgetBytes) : "n/a"}
              </StatValue>
              <StatDescription className="signal-board__stat-description">
                JS budget
              </StatDescription>
            </Stat>
            <Stat className="signal-board__stat">
              <StatValue className="signal-board__stat-value">
                {latest ? `#${latest.runNumber}` : "n/a"}
              </StatValue>
              <StatDescription className="signal-board__stat-description">
                Latest run
              </StatDescription>
            </Stat>
          </div>
        </section>

        <section className="section metrics-detail-section" aria-labelledby="metrics-trend-title">
          <div className="section__heading workflow-index-heading">
            <div>
              <p className="eyebrow">Trend</p>
              <h2 id="metrics-trend-title">Normalized KPI lines on one chart.</h2>
            </div>
            <p>
              Each KPI is indexed against its own most recent available value, so every visible line
              has a comparable baseline of 100 even though the raw units differ.
            </p>
          </div>
          {latest ? (
            <MetricsTrendChart builds={builds} />
          ) : (
            <Card className="metrics-empty">
              <CardContent className="metrics-empty__content">
                <p>
                  No published build metrics yet. The next successful main-branch performance run
                  will populate the trend chart.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="section metrics-detail-section" aria-labelledby="metrics-kpis-title">
          <div className="section__heading workflow-index-heading">
            <div>
              <p className="eyebrow">KPI Reference</p>
              <h2 id="metrics-kpis-title">What each metric means.</h2>
            </div>
            <p>
              The raw values remain visible in the latest cards and run history. The normalized
              values are used only for the multi-line chart.
            </p>
          </div>

          <div className="metrics-definition-grid">
            {metricsChartSeries.map((series) => (
              <MetricDefinitionCard key={series.id} latest={latest} series={series} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function MetricDefinitionCard({
  latest,
  series,
}: {
  latest?: BuildMetricsHistory["builds"][number];
  series: (typeof metricsChartSeries)[number];
}) {
  return (
    <article className="metrics-definition-card">
      <div className="metrics-definition-card__header">
        <span style={{ backgroundColor: series.color }} aria-hidden="true" />
        <h3>{series.label}</h3>
      </div>
      <p>{series.description}</p>
      <dl>
        <div>
          <dt>Latest raw value</dt>
          <dd>{latest ? formatMetricRawValue(latest, series.id) : "n/a"}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>
            <code>{series.source}</code>
          </dd>
        </div>
        <div>
          <dt>Normalization</dt>
          <dd>{series.normalization}</dd>
        </div>
        <div>
          <dt>Signal</dt>
          <dd>{series.interpretation}</dd>
        </div>
      </dl>
    </article>
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
