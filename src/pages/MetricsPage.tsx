import { ArrowLeft } from "lucide-react";

import type { BuildMetricsHistory } from "../build-metrics";
import { formatMetricRawValue, metricsChartSeries } from "../app/metricsCatalog";
import { formatBytes, formatDateTime } from "../app/formatters";
import { homeHref } from "../app/routes";
import { Badge, Card, CardContent, Stat, StatDescription, StatValue } from "../components/ui";
import { MetricsTrendChart } from "../components/MetricsTrendChart";
import { SiteHeader } from "../components/SiteHeader";

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
              Each KPI is indexed against its own oldest visible value, so every visible line has a
              comparable baseline of 100 even though the raw units differ.
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
