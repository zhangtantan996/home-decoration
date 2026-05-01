import { useEffect, useMemo, useRef, useState } from "react";

type TableColumnLayout = {
  key?: unknown;
  width?: number | string;
  fixed?: unknown;
};

type AdaptiveTableScrollOptions = {
  extraWidth?: number;
  growColumnKey?: string;
};

const FALLBACK_COLUMN_WIDTH = 120;

const resolveColumnWidth = (width: TableColumnLayout["width"]) => {
  if (typeof width === "number") return width;
  if (typeof width === "string") {
    const parsed = Number.parseInt(width, 10);
    return Number.isFinite(parsed) ? parsed : FALLBACK_COLUMN_WIDTH;
  }
  return FALLBACK_COLUMN_WIDTH;
};

const isFixedColumn = (column: TableColumnLayout) =>
  column.fixed === "left" || column.fixed === "right" || column.fixed === true;

export const useAdaptiveTableScroll = <T extends TableColumnLayout>(
  columns: T[],
  options: number | AdaptiveTableScrollOptions = 0,
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const extraWidth = typeof options === "number" ? options : options.extraWidth || 0;
  const growColumnKey = typeof options === "number" ? undefined : options.growColumnKey;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateWidth = () => setContainerWidth(node.clientWidth);
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const contentWidth = useMemo(
    () =>
      Math.ceil(
        columns.reduce(
          (sum, column) => sum + resolveColumnWidth(column.width),
          extraWidth,
        ),
      ),
    [columns, extraWidth],
  );

  const shouldScroll = containerWidth > 0 && contentWidth > containerWidth;
  const fixedColumnsWidth = useMemo(
    () =>
      Math.ceil(
        columns.reduce(
          (sum, column) =>
            isFixedColumn(column) ? sum + resolveColumnWidth(column.width) : sum,
          0,
        ),
      ),
    [columns],
  );
  const canUseFixedColumns =
    shouldScroll &&
    (containerWidth === 0 || fixedColumnsWidth <= containerWidth * 0.72);
  const growWidth = shouldScroll ? 0 : Math.max(0, containerWidth - contentWidth);

  const tableColumns = useMemo(
    () =>
      shouldScroll
        ? canUseFixedColumns
          ? columns
          : columns.map((column) =>
              column.fixed ? ({ ...column, fixed: undefined } as T) : column,
            )
        : columns.map((column) => {
            const shouldGrow =
              growWidth > 0 && growColumnKey && String(column.key) === growColumnKey;
            if (!column.fixed && !shouldGrow) return column;

            return {
              ...column,
              fixed: undefined,
              width: shouldGrow
                ? resolveColumnWidth(column.width) + growWidth
                : column.width,
            } as T;
          }),
    [canUseFixedColumns, columns, growColumnKey, growWidth, shouldScroll],
  );

  const tableScroll = useMemo(
    () => (shouldScroll ? { x: contentWidth } : undefined),
    [contentWidth, shouldScroll],
  );

  return {
    shouldScroll,
    tableContainerRef: containerRef,
    tableClassName: shouldScroll
      ? "hz-adaptive-table--scroll"
      : "hz-adaptive-table--compact",
    tableColumns,
    tableScroll,
  };
};
