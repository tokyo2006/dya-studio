/**
 * Interactive keyboard preview for the KScan Diagnostics section.
 *
 * Renders one keycap per physical-layout key (index = keymap position),
 * with row GPIO pin buttons on the left and column GPIO pin buttons along
 * the bottom, derived from the wiring map (buildWiringMap in
 * ../../lib/kscanTopology). Hovering (mouse or keyboard focus) or clicking
 * a pin button highlights every key on that line (and vice versa); click
 * toggles a persistent pin so multiple lines can stay highlighted at once
 * (the primary interaction on touch, where hover doesn't apply). Key
 * status markers reuse the same suspect/no-record logic as the stats
 * table.
 *
 * Geometry math (rotatedCorners/BASE_UNIT_SIZE, responsive ResizeObserver
 * scaling) is modeled on ../KeyboardLayout.tsx, adapted from the reference
 * KeyboardView.tsx — this is a standalone, lighter component with no
 * keymap bindings, styled with this app's CSS variables.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { IconAlertTriangle, IconCircleDashed } from "@tabler/icons-react";
import type {
  KeyPhysicalAttrs,
  PhysicalLayout,
} from "@zmkfirmware/zmk-studio-ts-client/keymap";
import { colorForLine, type KeyWiringInfo } from "../../lib/kscanTopology";
import type { PositionStats } from "../../proto/cormoran/kscan_diagnostics/kscan_diagnostics";
import { useLanguage } from "../../hooks/useLanguage";

const BASE_UNIT_SIZE = 54;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.1;
const PIN_GUTTER = 140;

type LayoutGeometry = Pick<
  KeyPhysicalAttrs,
  "width" | "height" | "x" | "y" | "r" | "rx" | "ry"
>;

function rotatedCorners(geometry: LayoutGeometry) {
  const corners = [
    { x: geometry.x, y: geometry.y },
    { x: geometry.x + geometry.width, y: geometry.y },
    { x: geometry.x + geometry.width, y: geometry.y + geometry.height },
    { x: geometry.x, y: geometry.y + geometry.height },
  ];
  if (!geometry.r) return corners;
  const radians = (geometry.r / 100) * (Math.PI / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return corners.map((corner) => {
    const dx = corner.x - geometry.rx;
    const dy = corner.y - geometry.ry;
    return {
      x: geometry.rx + dx * cos - dy * sin,
      y: geometry.ry + dx * sin + dy * cos,
    };
  });
}

export interface PinLine {
  port: string;
  pin: number;
}

function lineKey(line: PinLine): string {
  return `${line.port}:${line.pin}`;
}

export interface KeyMarker {
  /** Key recorded zero presses since last stats reset. */
  noRecord: boolean;
  /** Key looks like chatter or a stuck switch (see findSuspectKeys). */
  suspect: boolean;
}

function computeMarker(stats: PositionStats | undefined): KeyMarker | null {
  if (!stats) return null;
  const suspect = stats.repressLt10 > 0 || stats.presses !== stats.releases;
  const noRecord = stats.presses === 0 && stats.releases === 0;
  if (!suspect && !noRecord) return null;
  return { noRecord, suspect };
}

export interface KscanKeyboardViewProps {
  layout: PhysicalLayout;
  wiring: Map<number, KeyWiringInfo>;
  statsByPosition: Map<number, PositionStats>;
}

export function KscanKeyboardView({
  layout,
  wiring,
  statsByPosition,
}: KscanKeyboardViewProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1.0);
  const [hoveredLines, setHoveredLines] = useState<Set<string>>(new Set());
  const [pinnedLines, setPinnedLines] = useState<Set<string>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<number | null>(null);

  const rawBounds = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    if (layout.keys.length === 0) {
      return { width: 200, height: 160, offsetX: 10, offsetY: 10 };
    }
    layout.keys.flatMap(rotatedCorners).forEach((point) => {
      const x = (point.x / 100) * BASE_UNIT_SIZE;
      const y = (point.y / 100) * BASE_UNIT_SIZE;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
    return {
      width: maxX - minX + 20,
      height: maxY - minY + 20,
      offsetX: -minX + 10,
      offsetY: -minY + 10,
    };
  }, [layout.keys]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateScale = () => {
      const containerWidth = el.clientWidth;
      const targetWidth = containerWidth - PIN_GUTTER - 32;
      const naturalScale =
        targetWidth > 0 ? targetWidth / rawBounds.width : MIN_SCALE;
      setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, naturalScale)));
    };
    updateScale();
    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(updateScale);
      resizeObserver.observe(el);
      return () => resizeObserver.disconnect();
    }
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [rawBounds.width]);

  // Unique row lines (left) and column lines (bottom), derived from the
  // wiring map for every key in this layout.
  const { rowLines, colLines } = useMemo(() => {
    const rowMap = new Map<string, PinLine>();
    const colMap = new Map<string, PinLine>();
    for (const info of wiring.values()) {
      if (info.rowLine) rowMap.set(lineKey(info.rowLine), info.rowLine);
      if (info.colLine) colMap.set(lineKey(info.colLine), info.colLine);
    }
    const byPortPin = (a: PinLine, b: PinLine) =>
      a.port === b.port ? a.pin - b.pin : a.port.localeCompare(b.port);
    return {
      rowLines: [...rowMap.values()].sort(byPortPin),
      colLines: [...colMap.values()].sort(byPortPin),
    };
  }, [wiring]);

  const activeLineKeys = useMemo(() => {
    const set = new Set(pinnedLines);
    for (const k of hoveredLines) set.add(k);
    if (hoveredKey !== null) {
      const info = wiring.get(hoveredKey);
      if (info?.rowLine) set.add(lineKey(info.rowLine));
      if (info?.colLine) set.add(lineKey(info.colLine));
    }
    return set;
  }, [pinnedLines, hoveredLines, hoveredKey, wiring]);

  const setLineHover = (line: PinLine, hovering: boolean) => {
    setHoveredLines((prev) => {
      const next = new Set(prev);
      const key = lineKey(line);
      if (hovering) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const togglePin = (line: PinLine) => {
    setPinnedLines((prev) => {
      const next = new Set(prev);
      const key = lineKey(line);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearPinned = () => setPinnedLines(new Set());

  const keyHighlightColor = (position: number): string | null => {
    const info = wiring.get(position);
    if (!info) return null;
    if (info.rowLine && activeLineKeys.has(lineKey(info.rowLine))) {
      return colorForLine(lineKey(info.rowLine));
    }
    if (info.colLine && activeLineKeys.has(lineKey(info.colLine))) {
      return colorForLine(lineKey(info.colLine));
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="flex items-stretch gap-2 overflow-x-auto"
      >
        {/* Row pin buttons — left side, vertical stack. */}
        <div className="flex flex-col justify-center gap-1 flex-shrink-0">
          {rowLines.map((line) => (
            <PinButton
              key={lineKey(line)}
              line={line}
              active={activeLineKeys.has(lineKey(line))}
              pinned={pinnedLines.has(lineKey(line))}
              onHoverChange={(hovering) => setLineHover(line, hovering)}
              onToggle={() => togglePin(line)}
            />
          ))}
        </div>

        <div className="flex flex-col items-center flex-1 min-w-0">
          <div
            className="relative"
            style={{
              width: Math.ceil(rawBounds.width * scale),
              height: Math.ceil(rawBounds.height * scale),
            }}
          >
            {layout.keys.map((key, position) => (
              <KeyboardKey
                key={position}
                position={position}
                attrs={key}
                scale={scale}
                offsetX={rawBounds.offsetX}
                offsetY={rawBounds.offsetY}
                wiring={wiring.get(position) ?? null}
                stats={statsByPosition.get(position) ?? null}
                marker={computeMarker(statsByPosition.get(position))}
                highlightColor={keyHighlightColor(position)}
                onHover={setHoveredKey}
              />
            ))}
          </div>

          {/* Column pin buttons — bottom, horizontal row. */}
          <div className="flex flex-wrap justify-center gap-1 mt-2">
            {colLines.map((line) => (
              <PinButton
                key={lineKey(line)}
                line={line}
                active={activeLineKeys.has(lineKey(line))}
                pinned={pinnedLines.has(lineKey(line))}
                onHoverChange={(hovering) => setLineHover(line, hovering)}
                onToggle={() => togglePin(line)}
              />
            ))}
          </div>
        </div>
      </div>

      {pinnedLines.size > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={clearPinned}
            className="btn-ghost text-xs"
          >
            {t("Clear")}
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[11px] text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-surface)] border border-[var(--color-border)]" />
          {t("Untested")}
        </span>
        <span className="flex items-center gap-1.5">
          <IconCircleDashed
            size={12}
            className="text-[var(--color-text-muted)]"
          />
          {t("No record (0 presses)")}
        </span>
        <span className="flex items-center gap-1.5">
          <IconAlertTriangle size={12} className="text-amber-400" />
          {t("Suspect (chatter or mismatch)")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-[var(--color-text-muted)]" />
          {t("No wiring info (split peripheral half)")}
        </span>
      </div>
    </div>
  );
}

interface PinButtonProps {
  line: PinLine;
  active: boolean;
  pinned: boolean;
  onHoverChange: (hovering: boolean) => void;
  onToggle: () => void;
}

function PinButton({
  line,
  active,
  pinned,
  onHoverChange,
  onToggle,
}: PinButtonProps) {
  const color = colorForLine(lineKey(line));
  return (
    <button
      type="button"
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-mono transition-colors ${
        active
          ? "border-current bg-[var(--color-surface-elevated)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-hover)]"
      }`}
      style={active ? { color } : undefined}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      onClick={onToggle}
      aria-pressed={pinned}
      data-testid={`pin-${lineKey(line)}`}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {line.port} {line.pin}
    </button>
  );
}

interface KeyboardKeyProps {
  position: number;
  attrs: KeyPhysicalAttrs;
  scale: number;
  offsetX: number;
  offsetY: number;
  wiring: KeyWiringInfo | null;
  stats: PositionStats | null;
  marker: KeyMarker | null;
  highlightColor: string | null;
  onHover: (position: number | null) => void;
}

function KeyboardKey({
  position,
  attrs,
  scale,
  offsetX,
  offsetY,
  wiring,
  stats,
  marker,
  highlightColor,
  onHover,
}: KeyboardKeyProps) {
  const { t } = useLanguage();
  const unitSize = BASE_UNIT_SIZE * scale;
  const x = ((attrs.x + offsetX) / 100) * unitSize;
  const y = ((attrs.y + offsetY) / 100) * unitSize;
  const width = (attrs.width / 100) * unitSize;
  const height = (attrs.height / 100) * unitSize;
  const rotation = attrs.r / 100;
  const rotationCenterX = ((attrs.rx + offsetX) / 100) * unitSize - x;
  const rotationCenterY = ((attrs.ry + offsetY) / 100) * unitSize - y;

  const hasWiring = wiring !== null;

  const content = (
    <div
      data-testid={`kscan-key-${position}`}
      className={`absolute rounded-md border flex items-center justify-center text-[10px] font-mono cursor-default select-none transition-colors ${
        hasWiring
          ? "bg-[var(--color-surface)] border-[var(--color-border)]"
          : "bg-[var(--color-surface)]/50 border-dashed border-[var(--color-text-muted)]/50"
      }`}
      style={{
        left: x,
        top: y,
        width: Math.max(width, 16),
        height: Math.max(height, 16),
        ...(rotation !== 0 && {
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${rotationCenterX}px ${rotationCenterY}px`,
        }),
        ...(highlightColor && {
          boxShadow: `0 0 0 2px ${highlightColor}`,
          borderColor: highlightColor,
        }),
      }}
      onMouseEnter={() => onHover(position)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="text-[var(--color-text-muted)]">{position}</span>
      {marker?.noRecord && (
        <IconCircleDashed
          size={10}
          className="absolute -top-1 -right-1 text-[var(--color-text-muted)] bg-[var(--color-surface)] rounded-full"
        />
      )}
      {marker?.suspect && (
        <IconAlertTriangle
          size={10}
          className={`absolute -top-1 -right-1 rounded-full bg-[var(--color-surface)] ${
            marker.noRecord ? "" : ""
          } text-amber-400`}
        />
      )}
    </div>
  );

  return (
    <Tooltip.Provider delayDuration={150} disableHoverableContent>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{content}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="px-3 py-2 rounded bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] shadow-lg z-50 max-w-xs"
            sideOffset={5}
          >
            <KeyTooltipContent
              position={position}
              wiring={wiring}
              stats={stats}
              t={t}
            />
            <Tooltip.Arrow className="fill-[var(--color-surface-elevated)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function KeyTooltipContent({
  position,
  wiring,
  stats,
  t,
}: {
  position: number;
  wiring: KeyWiringInfo | null;
  stats: PositionStats | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="font-medium">
        {t("Position {{position}}", { position })}
      </div>
      {wiring ? (
        <>
          <div>
            {t("Row {{row}} / Col {{col}}", {
              row: wiring.row,
              col: wiring.column,
            })}
          </div>
          {wiring.rowLine && (
            <div>
              {t("Row line")}: {wiring.rowLine.port} {wiring.rowLine.pin}
            </div>
          )}
          {wiring.colLine && (
            <div>
              {t("Col line")}: {wiring.colLine.port} {wiring.colLine.pin}
            </div>
          )}
          {wiring.device && (
            <div>
              {t("Debounce")}: {wiring.device.debouncePressMs}/
              {wiring.device.debounceReleaseMs}ms
            </div>
          )}
        </>
      ) : (
        <div>{t("Wiring info unavailable (split peripheral half)")}</div>
      )}
      {stats && (
        <>
          <div className="border-t border-[var(--color-border)] my-1" />
          <div>
            {t("Presses")}: {stats.presses} / {t("Releases")}: {stats.releases}
          </div>
          <div>
            {t("Min repress gap")}: {stats.minRepressGapMs}ms
          </div>
          <div>
            {t("Chatter")} &lt;5/10/20/50ms: {stats.repressLt5}/
            {stats.repressLt10}/{stats.repressLt20}/{stats.repressLt50}
          </div>
        </>
      )}
    </div>
  );
}
