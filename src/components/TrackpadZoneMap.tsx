import { useMemo, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import {
  CALIBRATION,
  beginGesture,
  endGesture,
  stepGesture,
  wedgeAngles,
  zoneAt,
  type GestureResult,
  type LastTap,
  type ZoneParams,
} from "../lib/cirqueZones";

const DEG = Math.PI / 180;
const polar = (r: number, deg: number): [number, number] => [
  r * Math.cos(deg * DEG),
  r * Math.sin(deg * DEG),
];

/** Horizontal extent (in degrees) where normalized x >= ringMinAxisPct. */
const RIGHT_SECTOR_DEG =
  (Math.acos(CALIBRATION.ringMinAxisPct / 100) * 180) / Math.PI;

export function TrackpadZoneMap({ params }: { params: ZoneParams }) {
  const { t } = useLanguage();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gesture = useRef<ReturnType<typeof beginGesture> | null>(null);
  const lastTap = useRef<LastTap | null>(null);
  const [trail, setTrail] = useState<Array<{ x: number; y: number }>>([]);
  const [finger, setFinger] = useState<{ x: number; y: number } | null>(null);
  const [result, setResult] = useState<GestureResult | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const angles = useMemo(() => wedgeAngles(params), [params]);
  const ringPct = params.ringPct ?? CALIBRATION.ringPct;
  const centerDeg = params.centerDeg ?? CALIBRATION.wedgeCenterDeg;
  const auxEnabled = params.auxEnabled ?? false;
  const auxW = Math.max(0, params.auxWidthPct ?? 0);
  const auxH = Math.max(0, params.auxHeightPct ?? 0);
  const auxValid = auxW > 0 && auxH > 0;

  const scrollBand = useMemo(() => {
    const a = RIGHT_SECTOR_DEG;
    return [
      `M ${polar(ringPct, -a).join(" ")}`,
      `A ${ringPct} ${ringPct} 0 0 1 ${polar(ringPct, a).join(" ")}`,
      `L ${polar(100, a).join(" ")}`,
      `A 100 100 0 0 0 ${polar(100, -a).join(" ")} Z`,
    ].join(" ");
  }, [ringPct]);

  const wedge = useMemo(() => {
    const inner = CALIBRATION.wedgeInnerPct;
    const [ix, iy] = polar(inner, angles.min);
    return [
      `M ${ix} ${iy}`,
      `L ${polar(100, angles.min).join(" ")}`,
      `A 100 100 0 0 1 ${polar(100, angles.max).join(" ")}`,
      `L ${polar(inner, angles.max).join(" ")}`,
      `A ${inner} ${inner} 0 0 0 ${ix} ${iy} Z`,
    ].join(" ");
  }, [angles]);

  const toPad = (evt: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { nx: 0, ny: 0 };
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { nx: 0, ny: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    // viewBox is in pad units where radius 100 == active range border
    return { nx: p.x, ny: p.y };
  };

  const pushLog = (line: string) => setLog((prev) => [...prev.slice(-5), line]);

  const onDown = (evt: React.PointerEvent<SVGSVGElement>) => {
    evt.preventDefault();
    evt.currentTarget.setPointerCapture(evt.pointerId);
    const { nx, ny } = toPad(evt);
    const now = performance.now();
    gesture.current = beginGesture(nx, ny, now, lastTap.current, params);
    setTrail([{ x: nx, y: ny }]);
    setFinger({ x: nx, y: ny });
    setResult(null);
    pushLog(
      `${t("down")} (${nx.toFixed(0)}, ${ny.toFixed(0)}) · ${zoneAt(nx, ny, params)}`,
    );
  };

  const onMove = (evt: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g) return;
    const { nx, ny } = toPad(evt);
    stepGesture(g, nx, ny);
    setTrail((prev) => [...prev.slice(-160), { x: nx, y: ny }]);
    setFinger({ x: nx, y: ny });
  };

  const onUp = () => {
    const g = gesture.current;
    if (!g) return;
    const r = endGesture(g, performance.now());
    gesture.current = null;
    setResult(r);
    setFinger(null);
    if (r.type === "tap") {
      lastTap.current = {
        t: performance.now(),
        nx: g.prev.nx,
        ny: g.prev.ny,
        code: r.click === "left" ? 0 : 1,
      };
    } else {
      lastTap.current = null;
    }
    pushLog(
      `${t("up")} · ${r.type}${r.click ? ` / ${r.click}` : ""}${
        r.type === "scroll" ? ` / ${r.ticks} ${t("ticks")}` : ""
      }`,
    );
  };

  const typeLabel: Record<string, string> = {
    pointer: t("Pointer move"),
    tap: t("Tap"),
    scroll: t("Edge scroll"),
    drag: t("Tap and drag"),
  };
  const buttonLabel = (c: GestureResult["click"]) =>
    c === "right"
      ? t("Right click")
      : c === "left"
        ? t("Left click")
        : c === "middle"
          ? t("Middle click")
          : c === "left-hold"
            ? t("Left click (hold)")
            : "—";

  return (
    <div className="grid grid-cols-1 gap-4 items-start">
      <div>
        <svg
          ref={svgRef}
          viewBox="-140 -140 280 280"
          className="mx-auto w-full max-w-[360px] touch-none select-none cursor-crosshair"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <defs>
            <pattern
              id="cirque-hatch"
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width={6} height={6} fill="var(--color-surface, #101319)" />
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke="var(--color-border)"
                strokeWidth={1.2}
              />
            </pattern>
            <clipPath id="cirque-pad-clip">
              <circle cx={0} cy={0} r={100} />
            </clipPath>
          </defs>

          {/* module border (not sensitive) */}
          <circle
            cx={0}
            cy={0}
            r={117}
            fill="url(#cirque-hatch)"
            stroke="var(--color-border)"
          />
          {/* active range */}
          <circle
            cx={0}
            cy={0}
            r={100}
            fill="var(--color-surface, #101319)"
            stroke="var(--color-border-hover, var(--color-border))"
          />
          {/* measured reachable edge */}
          <circle
            cx={0}
            cy={0}
            r={CALIBRATION.reachablePct}
            fill="none"
            stroke="var(--color-text-muted)"
            strokeDasharray="2 3"
            strokeWidth={0.8}
          />

          {/* scroll band */}
          <path
            d={scrollBand}
            fill="var(--color-electric)"
            fillOpacity={0.14}
            stroke="var(--color-electric)"
            strokeWidth={0.9}
          />
          {[-40, 0, 40].map((deg) => {
            const [x, y] = polar((ringPct + 100) / 2, deg);
            return (
              <text
                key={deg}
                x={x}
                y={y + 3}
                textAnchor="middle"
                fontSize={9}
                fontWeight={700}
                fill="var(--color-electric)"
              >
                {params.invertScroll ? "↓" : "↑"}
              </text>
            );
          })}

          {/* secondary tap wedge */}
          <path
            d={wedge}
            fill="#f5a524"
            fillOpacity={0.2}
            stroke="#f5a524"
            strokeWidth={0.9}
          />
          <text
            x={polar(109, centerDeg)[0]}
            y={polar(109, centerDeg)[1]}
            textAnchor="middle"
            fontSize={8}
            fontWeight={600}
            fill="#f5a524"
          >
            {angles.min.toFixed(0)}°–{angles.max.toFixed(0)}°
          </text>

          {/* upper-left auxiliary (middle click) zone */}
          {auxEnabled && auxValid && (
            <g clipPath="url(#cirque-pad-clip)">
              <rect
                x={-100}
                y={-100}
                width={auxW}
                height={auxH}
                fill="#a78bfa"
                fillOpacity={0.18}
                stroke="#a78bfa"
                strokeWidth={0.9}
              />
              <text
                x={-100 + auxW / 2}
                y={-100 + auxH / 2 + 3}
                textAnchor="middle"
                fontSize={8}
                fontWeight={600}
                fill="#a78bfa"
              >
                M
              </text>
            </g>
          )}

          {/* clock reference */}
          <circle cx={0} cy={0} r={1.6} fill="var(--color-text-muted)" />
          {[
            ["3", 0],
            ["6", 90],
            ["9", 180],
            ["12", -90],
          ].map(([label, deg]) => {
            const [x, y] = polar(125, Number(deg));
            return (
              <text
                key={label}
                x={x}
                y={y + 3}
                textAnchor="middle"
                fontSize={8}
                fill="var(--color-text-muted)"
              >
                {label}
              </text>
            );
          })}

          {/* trail + finger */}
          {trail.length > 1 && (
            <polyline
              points={trail.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--color-electric)"
              strokeWidth={1.2}
              strokeDasharray="2 2"
              opacity={0.8}
            />
          )}
          {finger && (
            <circle
              cx={finger.x}
              cy={finger.y}
              r={4}
              fill="var(--color-electric)"
              fillOpacity={0.85}
            />
          )}
        </svg>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-[var(--color-border)] p-2">
            <div className="text-[var(--color-text-muted)]">{t("Gesture")}</div>
            <div className="mt-0.5 text-[var(--color-text)]">
              {result ? typeLabel[result.type] : "—"}
            </div>
          </div>
          <div className="rounded-md border border-[var(--color-border)] p-2">
            <div className="text-[var(--color-text-muted)]">
              {t("Wheel ticks")}
            </div>
            <div className="mt-0.5 text-[var(--color-text)]">
              {result?.type === "scroll" ? `${result.ticks}` : "—"}
            </div>
          </div>
          <div className="rounded-md border border-[var(--color-border)] p-2">
            <div className="text-[var(--color-text-muted)]">{t("Button")}</div>
            <div className="mt-0.5 text-[var(--color-text)]">
              {buttonLabel(result?.click ?? null)}
            </div>
          </div>
          <div className="rounded-md border border-[var(--color-border)] p-2">
            <div className="text-[var(--color-text-muted)]">
              {t("Pointer delta")}
            </div>
            <div className="mt-0.5 text-[var(--color-text)]">
              {result?.type === "pointer"
                ? `${Math.round(result.moveX)}, ${Math.round(result.moveY)}`
                : "—"}
            </div>
          </div>
        </div>

        <div className="h-28 overflow-auto rounded-md border border-[var(--color-border)] p-2 font-mono text-[11px] leading-relaxed text-[var(--color-text-muted)]">
          {log.length === 0 ? (
            <span>{t("Press and drag on the pad to simulate a gesture.")}</span>
          ) : (
            log.map((line, i) => <div key={i}>{line}</div>)
          )}
        </div>

        {auxEnabled && !auxValid && (
          <div className="text-[11px] text-amber-500">
            {t("Middle-click zone needs a non-zero width and height")}
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#f5a524]/40 ring-1 ring-[#f5a524]" />
            {t("Right-click wedge")}
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[var(--color-electric)]/20 ring-1 ring-[var(--color-electric)]" />
            {t("Scroll band")}
          </span>
          {auxEnabled && (
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#a78bfa]/20 ring-1 ring-[#a78bfa]" />
              {t("Middle-click zone")}
            </span>
          )}
          <span>{t("Hatched ring = module border (not sensitive)")}</span>
        </div>
      </div>
    </div>
  );
}
