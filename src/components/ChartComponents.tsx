import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { ChartLegendItem } from "../app/types";

export function ChartPanel({
  children,
  className,
  description,
  title,
}: {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className={className}>
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function ChartSeriesLegend({
  "aria-label": ariaLabel = "Chart series legend",
  className,
  hiddenIds,
  items,
  onHiddenIdsChange,
  orientation = "vertical",
  showCounts = true,
}: {
  "aria-label"?: string;
  className?: string;
  hiddenIds: string[];
  items: ChartLegendItem[];
  onHiddenIdsChange: (hiddenIds: string[]) => void;
  orientation?: "horizontal" | "vertical";
  showCounts?: boolean;
}) {
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const visibility = useChartSeriesVisibility({
    hiddenIds,
    itemIds,
    onHiddenIdsChange,
  });

  return (
    <div
      aria-label={ariaLabel}
      className={["chart-series-legend", `chart-series-legend--${orientation}`, className]
        .filter(Boolean)
        .join(" ")}
      role="group"
    >
      {items.map((item) => {
        const visible = visibility.isVisible(item.id);

        return (
          <label className="chart-series-legend__item" key={item.id}>
            <input
              aria-label={typeof item.label === "string" ? item.label : undefined}
              checked={visible}
              disabled={item.disabled}
              onChange={() => visibility.toggle(item.id)}
              type="checkbox"
            />
            <span
              aria-hidden="true"
              className="chart-series-legend__swatch"
              style={{ backgroundColor: item.color ?? "var(--muted)" }}
            />
            <span className="chart-series-legend__content">
              <span className="chart-series-legend__label-row">
                <span className="chart-series-legend__label">{item.label}</span>
                {showCounts && item.meta ? (
                  <span className="chart-series-legend__meta">{item.meta}</span>
                ) : null}
              </span>
              {item.description ? (
                <span className="chart-series-legend__description">{item.description}</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function useChartSeriesVisibility({
  hiddenIds,
  itemIds,
  minVisible = 1,
  onHiddenIdsChange,
}: {
  hiddenIds?: string[];
  itemIds: string[];
  minVisible?: number;
  onHiddenIdsChange?: (hiddenIds: string[]) => void;
}) {
  const [uncontrolledHiddenIds, setUncontrolledHiddenIds] = useState<string[]>([]);
  const resolvedHiddenIds = useMemo(
    () => normalizeHiddenChartSeriesIds(hiddenIds ?? uncontrolledHiddenIds, itemIds, minVisible),
    [hiddenIds, itemIds, minVisible, uncontrolledHiddenIds],
  );
  const visibleIds = useMemo(
    () => itemIds.filter((id) => !resolvedHiddenIds.includes(id)),
    [itemIds, resolvedHiddenIds],
  );
  const setHiddenIds = useCallback(
    (nextHiddenIds: string[]) => {
      const normalized = normalizeHiddenChartSeriesIds(nextHiddenIds, itemIds, minVisible);

      if (hiddenIds === undefined) {
        setUncontrolledHiddenIds(normalized);
      }

      onHiddenIdsChange?.(normalized);
    },
    [hiddenIds, itemIds, minVisible, onHiddenIdsChange],
  );
  const toggle = useCallback(
    (id: string) => {
      if (!itemIds.includes(id)) {
        return;
      }

      if (resolvedHiddenIds.includes(id)) {
        setHiddenIds(resolvedHiddenIds.filter((hiddenId) => hiddenId !== id));
        return;
      }

      if (visibleIds.length <= minVisible) {
        return;
      }

      setHiddenIds([...resolvedHiddenIds, id]);
    },
    [itemIds, minVisible, resolvedHiddenIds, setHiddenIds, visibleIds.length],
  );
  const isVisible = useCallback((id: string) => visibleIds.includes(id), [visibleIds]);

  return {
    hiddenIds: resolvedHiddenIds,
    isVisible,
    setHiddenIds,
    toggle,
    visibleIds,
  };
}

function normalizeHiddenChartSeriesIds(hiddenIds: string[], itemIds: string[], minVisible: number) {
  const hiddenIdSet = new Set(hiddenIds);
  const maxHiddenCount = Math.max(0, itemIds.length - Math.max(0, minVisible));

  return itemIds.filter((id) => hiddenIdSet.has(id)).slice(0, maxHiddenCount);
}
