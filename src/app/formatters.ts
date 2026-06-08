export function formatValue(value: unknown) {
  if (typeof value === "string") {
    return value === "" ? "empty string" : value;
  }

  return JSON.stringify(value);
}

export function formatDuration(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${Math.round(value)}ms`;
}

export function formatBytes(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return `${Math.round(value / 1024).toLocaleString("en-US")} KB`;
}

export function formatOps(value: number | null) {
  return value === null ? "n/a" : value.toLocaleString("en-US");
}

export function formatScoreValue(value: number | null) {
  return value === null ? "n/a" : `${Math.round(value * 100)}%`;
}

export function formatDecimal(value: number | null) {
  return value === null ? "n/a" : value.toFixed(3).replace(/\.?0+$/, "");
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
