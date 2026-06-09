import { adoptionHref, homeHref, metricsHref } from "../app/routes";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="brand" href={homeHref()} aria-label="Reusable Workflows home">
          <span className="brand__mark" aria-hidden="true">
            RW
          </span>
          <span>Reusable Workflows</span>
        </a>
        <nav className="nav" aria-label="Primary navigation">
          <a href={homeHref("standard")}>Standard</a>
          <a href={homeHref("connections")}>Connections</a>
          <a href={homeHref("workflows")}>Workflows</a>
          <a href={homeHref("dogfood")}>Dogfood</a>
          <a href={adoptionHref()}>Adoption</a>
          <a href={metricsHref()}>Metrics</a>
          <a href={homeHref("release")}>Release</a>
        </nav>
      </div>
    </header>
  );
}
