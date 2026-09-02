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
          <a href={homeHref("standard")}>Architecture</a>
          <a href={homeHref("connections")}>Dogfood graph</a>
          <a href={homeHref("workflows")}>Capabilities</a>
          <a href={homeHref("dogfood")}>Validation</a>
          <a href={adoptionHref()}>v1.3 compatibility</a>
          <a href={metricsHref()}>Metrics</a>
          <a href={homeHref("release")}>Refs</a>
        </nav>
      </div>
    </header>
  );
}
