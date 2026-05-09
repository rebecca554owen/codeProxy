import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fillStatusBarDetails,
  type StatusBarData,
  type StatusBlockDetail,
} from "@/modules/providers/provider-usage";

const COLOR_STOPS = [
  { r: 239, g: 68, b: 68 },
  { r: 250, g: 204, b: 21 },
  { r: 34, g: 197, b: 94 },
] as const;

function rateToColor(rate: number): string {
  const t = Math.max(0, Math.min(1, rate));
  const segment = t < 0.5 ? 0 : 1;
  const localT = segment === 0 ? t * 2 : (t - 0.5) * 2;
  const from = COLOR_STOPS[segment];
  const to = COLOR_STOPS[segment + 1];
  const r = Math.round(from.r + (to.r - from.r) * localT);
  const g = Math.round(from.g + (to.g - from.g) * localT);
  const b = Math.round(from.b + (to.b - from.b) * localT);
  return `rgb(${r}, ${g}, ${b})`;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

const idleBlockClass = "bg-slate-200 dark:bg-white/10";

export function ProviderStatusBar({
  data,
  compact = false,
  className,
}: {
  data: StatusBarData;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const resolvedData = data.blockDetails ? data : fillStatusBarDetails(data);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);
  const [tooltipOffset, setTooltipOffset] = useState(0);
  const [tooltipArrowOffset, setTooltipArrowOffset] = useState<number | null>(null);
  const blocksRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wrapperRefs = useRef<Array<HTMLDivElement | null>>([]);

  const hasData = resolvedData.totalSuccess + resolvedData.totalFailure > 0;
  const rateText = hasData ? `${resolvedData.successRate.toFixed(1)}%` : "--";
  const rateClass = !hasData
    ? "text-slate-400 dark:text-white/40"
    : resolvedData.successRate >= 90
      ? "text-emerald-600 dark:text-emerald-300"
      : resolvedData.successRate >= 50
        ? "text-amber-600 dark:text-amber-300"
        : "text-rose-600 dark:text-rose-300";

  useEffect(() => {
    if (activeTooltip === null) return;
    const handler = (event: PointerEvent) => {
      if (blocksRef.current && !blocksRef.current.contains(event.target as Node)) {
        setActiveTooltip(null);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [activeTooltip]);

  useEffect(() => {
    if (activeTooltip === null) return;
    const updatePosition = () => {
      const container = blocksRef.current;
      const tooltip = tooltipRef.current;
      const wrapper = wrapperRefs.current[activeTooltip];
      if (!container || !tooltip || !wrapper) return;

      const containerRect = container.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const wrapperCenter = wrapperRect.left + wrapperRect.width / 2;
      const defaultLeft = wrapperCenter - tooltipRect.width / 2;
      const minLeft = containerRect.left;
      const maxLeft = containerRect.right - tooltipRect.width;
      const clampedLeft = Math.min(Math.max(defaultLeft, minLeft), Math.max(minLeft, maxLeft));
      setTooltipOffset(clampedLeft - defaultLeft);
      setTooltipArrowOffset(wrapperCenter - clampedLeft);
    };

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
    };
  }, [activeTooltip, resolvedData]);

  const handlePointerEnter = useCallback((event: React.PointerEvent, index: number) => {
    if (event.pointerType === "mouse") {
      setActiveTooltip(index);
    }
  }, []);

  const handlePointerLeave = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === "mouse") {
      setActiveTooltip(null);
    }
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent, index: number) => {
    if (event.pointerType === "touch") {
      event.preventDefault();
      setActiveTooltip((prev) => (prev === index ? null : index));
    }
  }, []);

  const renderTooltip = (detail: StatusBlockDetail) => {
    const total = detail.success + detail.failure;
    const timeRange = `${formatTime(detail.startTime)} – ${formatTime(detail.endTime)}`;
    return (
      <div
        ref={tooltipRef}
        className="absolute left-1/2 top-0 z-20 min-w-[10rem] -translate-y-[calc(100%+0.5rem)] rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] shadow-lg dark:border-neutral-700 dark:bg-neutral-950"
        style={{
          transform: `translateX(calc(-50% + ${tooltipOffset}px)) translateY(calc(-100% - 0.5rem))`,
        }}
      >
        <div
          className="absolute -bottom-1 h-2 w-2 rotate-45 border-b border-r border-slate-200 bg-white dark:border-neutral-700 dark:bg-neutral-950"
          style={{
            left: tooltipArrowOffset !== null ? `${tooltipArrowOffset - 4}px` : "50%",
          }}
        />
        <span className="block text-slate-500 dark:text-white/55">{timeRange}</span>
        {total > 0 ? (
          <span className="mt-1 flex items-center gap-2">
            <span className="text-emerald-600 dark:text-emerald-300">
              {t("status_bar.success_short")} {detail.success}
            </span>
            <span className="text-rose-600 dark:text-rose-300">
              {t("status_bar.failure_short")} {detail.failure}
            </span>
            <span className="text-slate-500 dark:text-white/55">
              ({(detail.rate * 100).toFixed(1)}%)
            </span>
          </span>
        ) : (
          <span className="mt-1 block text-slate-500 dark:text-white/55">
            {t("status_bar.no_requests")}
          </span>
        )}
      </div>
    );
  };

  const barHeight = compact ? "h-1.5" : "h-2";
  const containerCls = compact ? "flex items-center gap-2" : "mt-3 flex items-center gap-2";
  const rateWidth = compact ? "w-12" : "w-14";

  return (
    <div className={[containerCls, className].filter(Boolean).join(" ")}>
      <div ref={blocksRef} className="flex flex-1 items-center gap-0.5">
        {resolvedData.blockDetails.map((detail, index) => {
          const isIdle = detail.rate === -1;
          const isActive = activeTooltip === index;
          return (
            <div
              key={index}
              ref={(node) => {
                wrapperRefs.current[index] = node;
              }}
              className={`relative flex-1 ${isActive ? "z-10" : ""}`}
              onPointerEnter={(event) => handlePointerEnter(event, index)}
              onPointerLeave={handlePointerLeave}
              onPointerDown={(event) => handlePointerDown(event, index)}
            >
              <div
                className={[
                  barHeight,
                  "w-full rounded-sm opacity-90 dark:opacity-95",
                  isIdle ? idleBlockClass : "",
                ].join(" ")}
                style={isIdle ? undefined : { backgroundColor: rateToColor(detail.rate) }}
                aria-hidden="true"
              />
              {isActive ? renderTooltip(detail) : null}
            </div>
          );
        })}
      </div>
      <span
        className={`${rateWidth} shrink-0 text-right text-xs font-semibold tabular-nums ${rateClass}`}
      >
        {rateText}
      </span>
    </div>
  );
}
