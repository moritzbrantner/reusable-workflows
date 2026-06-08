import { parsedWorkflowsBySlug } from "./workflowCatalog";

const standalonePageSlugs = new Set(["metrics"]);

export function slugFromPath(pathname: string) {
  const candidate = lastPathPart(pathname);

  return candidate && parsedWorkflowsBySlug.has(candidate) ? candidate : "";
}

export function standalonePageFromPath(pathname: string) {
  const candidate = lastPathPart(pathname);

  return candidate && standalonePageSlugs.has(candidate) ? candidate : "";
}

function lastPathPart(pathname: string) {
  let candidate = "";

  for (const part of pathname.replace(/\/index\.html$/, "/").split("/")) {
    if (part) {
      candidate = part;
    }
  }

  return candidate;
}

export function appBasePath(
  pathname = typeof window === "undefined" ? "/" : window.location.pathname,
) {
  const parts = pathname
    .replace(/\/index\.html$/, "/")
    .split("/")
    .filter(Boolean);
  const lastPart = parts.at(-1);
  const baseParts = lastPart && isRoutePart(lastPart) ? parts.slice(0, -1) : parts;

  return baseParts.length > 0 ? `/${baseParts.join("/")}/` : "/";
}

function isRoutePart(part: string) {
  return parsedWorkflowsBySlug.has(part) || standalonePageSlugs.has(part);
}

export function homeHref(hash?: string, pathname?: string) {
  const basePath = appBasePath(pathname);

  return hash ? `${basePath}#${hash}` : basePath;
}

export function metricsHref(pathname?: string) {
  return `${appBasePath(pathname)}metrics`;
}

export function workflowHref(slug: string, pathname?: string) {
  return `${appBasePath(pathname)}${slug}`;
}
