import {
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useLanguage } from "../hooks/useLanguage";
import {
  classifyTps43Gesture,
  TPS43_DEFAULT_PRESS_AND_HOLD_TIME,
  type Tps43Gesture,
  type Tps43GestureResult,
} from "../lib/tps43Gestures";
import type { Tps43State } from "../proto/tokyo2006/tps43/tps43";

const VIEW_WIDTH = 430;
const VIEW_HEIGHT = 400;
const PAD = { x: 5, y: 5, width: 420, height: 390, rx: 30 } as const;
const CENTER_X = PAD.x + PAD.width / 2;
const CENTER_Y = PAD.y + PAD.height / 2;

/** Hold ring reference span: the full circle means 1 s or more. */
const HOLD_RING_RADIUS = 72;
const HOLD_RING_CIRCUMFERENCE = 2 * Math.PI * HOLD_RING_RADIUS;
const HOLD_RING_REFERENCE_MS = 1000;
const HOLD_RING_MIN_FRACTION = 0.05;

const ENABLED_OPACITY = 0.78;
const MUTED_OPACITY = 0.38;
const ENABLED_TONE = "var(--color-electric)";
const MUTED_TONE = "var(--color-text-muted)";

interface Point {
  x: number;
  y: number;
}

interface PointerStart {
  point: Point;
  time: number;
}

const nowMs = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

/**
 * One static gesture layer. The layer stays visible when its toggle is off so
 * the map still explains what the pad can do; it is only dimmed.
 */
function GestureLayer({
  name,
  enabled,
  children,
}: {
  name: string;
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <g
      data-testid={`tps43-layer-${name}`}
      data-enabled={enabled ? "true" : "false"}
      data-tone={enabled ? "electric" : "muted"}
      style={{
        color: enabled ? ENABLED_TONE : MUTED_TONE,
        opacity: enabled ? ENABLED_OPACITY : MUTED_OPACITY,
      }}
      pointerEvents="none"
    >
      {children}
    </g>
  );
}

/**
 * Hybrid TPS43 preview: a static map of the configured gestures with a small
 * try-it pad on top. Recognition here is a client-side approximation for the
 * Studio; the IQS572 in the firmware performs the real detection.
 */
export function Tps43GestureMap({ values }: { values: Tps43State }) {
  const { t } = useLanguage();
  const instanceId = useId().replace(/:/g, "");
  const clipId = `tps43-pad-clip-${instanceId}`;
  const shadeId = `tps43-pad-shade-${instanceId}`;

  const [fingerCount, setFingerCount] = useState<1 | 2>(1);
  const [trail, setTrail] = useState<Point[]>([]);
  const [result, setResult] = useState<Tps43GestureResult | null>(null);
  const startRef = useRef<PointerStart | null>(null);

  const tapEnabled = values.oneFingerTap === true;
  const scrollEnabled = values.scroll === true;
  const holdEnabled = values.pressAndHold === true;
  const palmEnabled = values.palmReject === true;

  const holdMs = Math.max(
    0,
    Math.round(values.pressAndHoldTime ?? TPS43_DEFAULT_PRESS_AND_HOLD_TIME),
  );
  const holdFraction = Math.min(
    1,
    Math.max(HOLD_RING_MIN_FRACTION, holdMs / HOLD_RING_REFERENCE_MS),
  );
  const holdDash = `${(HOLD_RING_CIRCUMFERENCE * holdFraction).toFixed(
    1,
  )} ${HOLD_RING_CIRCUMFERENCE.toFixed(1)}`;

  const scrollAxis =
    result?.gesture === "scroll" ? result.detail?.axis : undefined;

  const toPad = (event: PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
      };
    }
    // jsdom has a zero-sized layout; tests pass viewBox coordinates directly.
    return { x: event.clientX, y: event.clientY };
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable in the jsdom test environment.
    }
    const point = toPad(event);
    startRef.current = { point, time: nowMs() };
    setTrail([point]);
    setResult(null);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!startRef.current) return;
    const point = toPad(event);
    setTrail((previous) => [...previous.slice(-159), point]);
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const start = startRef.current;
    if (!start) return;
    startRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // See setPointerCapture above.
    }

    const end = toPad(event);
    setTrail((previous) => [...previous.slice(-159), end]);
    const dx = end.x - start.point.x;
    const dy = end.y - start.point.y;
    const durationMs = Math.max(0, nowMs() - start.time);
    setResult(
      classifyTps43Gesture(
        {
          fingerCount,
          distance: Math.hypot(dx, dy),
          durationMs,
          dx,
          dy,
        },
        values,
      ),
    );
  };

  const handlePointerCancel = () => {
    startRef.current = null;
    // A cancelled pointer never produces an end point; clear the partial trail
    // instead of leaving it on the pad as if the gesture were still in flight.
    setTrail([]);
  };

  const gestureLabel: Record<Tps43Gesture, string> = {
    tap: t("Tap"),
    "two-finger-tap": t("Two-finger tap"),
    hold: t("Hold"),
    scroll: t("Scroll"),
    none: t("No gesture"),
  };
  const lastPoint = trail[trail.length - 1];

  return (
    <div className="space-y-3">
      <svg
        data-testid="tps43-gesture-map"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={t("TPS43 gesture map")}
        className="mx-auto w-full max-w-[420px] touch-none select-none cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <defs>
          <linearGradient id={shadeId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-text)"
              stopOpacity={0.04}
            />
            <stop offset="100%" stopColor="#000" stopOpacity={0.12} />
          </linearGradient>
          <clipPath id={clipId}>
            <rect
              x={PAD.x}
              y={PAD.y}
              width={PAD.width}
              height={PAD.height}
              rx={PAD.rx}
            />
          </clipPath>
        </defs>

        <rect
          data-testid="tps43-pad"
          x={PAD.x}
          y={PAD.y}
          width={PAD.width}
          height={PAD.height}
          rx={PAD.rx}
          fill="var(--color-surface)"
          stroke="var(--color-border-hover)"
          strokeWidth={2.5}
        />
        <rect
          x={PAD.x}
          y={PAD.y}
          width={PAD.width}
          height={PAD.height}
          rx={PAD.rx}
          fill={`url(#${shadeId})`}
          pointerEvents="none"
        />

        <g
          stroke="var(--color-text)"
          strokeWidth={1}
          opacity={0.08}
          pointerEvents="none"
        >
          {[100, 200, 300].map((y) => (
            <line key={`h${y}`} x1={PAD.x} y1={y} x2={425} y2={y} />
          ))}
          {[107, CENTER_X, 323].map((x) => (
            <line key={`v${x}`} x1={x} y1={PAD.y} x2={x} y2={395} />
          ))}
        </g>

        {/* Static gesture layers. Swipe and zoom are not shown in v1. */}
        <GestureLayer name="tap" enabled={tapEnabled}>
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={34}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          />
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={52}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            opacity={0.35}
          />
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={24}
            fill="currentColor"
            opacity={0.14}
          />
          <circle cx={CENTER_X} cy={CENTER_Y} r={5} fill="currentColor" />
          <text
            x={CENTER_X}
            y={250}
            textAnchor="middle"
            fontSize={10.5}
            fill="currentColor"
          >
            {t("Tap")}
          </text>
        </GestureLayer>

        <GestureLayer name="scroll" enabled={scrollEnabled}>
          <g opacity={scrollAxis === "vertical" ? 0.35 : 1}>
            <circle cx={188} cy={178} r={8} fill="currentColor" />
            <circle cx={242} cy={222} r={8} fill="currentColor" />
            <path
              d="M 150 178 L 178 178 M 162 168 L 150 178 L 162 188"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 280 222 L 252 222 M 268 212 L 280 222 L 268 232"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <g opacity={scrollAxis === "horizontal" ? 0.35 : 1}>
            <path
              d="M 215 155 L 215 127 M 205 139 L 215 127 L 225 139"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.65}
            />
            <path
              d="M 215 245 L 215 273 M 205 261 L 215 273 L 225 261"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.65}
            />
          </g>
          <text
            x={CENTER_X}
            y={304}
            textAnchor="middle"
            fontSize={10.5}
            fill="currentColor"
          >
            {t("Two-finger scroll")}
          </text>
        </GestureLayer>

        <GestureLayer name="hold" enabled={holdEnabled}>
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={HOLD_RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            opacity={0.55}
          />
          <circle
            data-testid="tps43-hold-ring"
            data-hold-ms={holdMs}
            cx={CENTER_X}
            cy={CENTER_Y}
            r={HOLD_RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeDasharray={holdDash}
            transform={`rotate(-90 ${CENTER_X} ${CENTER_Y})`}
          />
          <text
            x={CENTER_X}
            y={122}
            textAnchor="middle"
            fontSize={10.5}
            fill="currentColor"
          >
            {t("Hold {{ms}} ms", { ms: holdMs })}
          </text>
        </GestureLayer>

        <GestureLayer name="palm" enabled={palmEnabled}>
          <g transform="translate(365 340)">
            <circle r={22} fill="currentColor" opacity={0.14} />
            <path
              d="M -8 8 L -3 -4 L 3 -4 L 8 8 M -10 12 L 10 12"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1={-12}
              y1={-12}
              x2={12}
              y2={12}
              stroke="#ef4444"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </g>
          <text
            x={365}
            y={374}
            textAnchor="middle"
            fontSize={10.5}
            fill="currentColor"
          >
            {t("Palm")}
          </text>
        </GestureLayer>

        {/* Size label, part of the static map. */}
        <g pointerEvents="none" clipPath={`url(#${clipId})`}>
          <text
            x={22}
            y={32}
            fontSize={13}
            fontFamily="ui-monospace, monospace"
            letterSpacing=".08em"
            fill="var(--color-text-secondary)"
          >
            TPS43
          </text>
          <text
            x={22}
            y={50}
            fontSize={11}
            fontFamily="ui-monospace, monospace"
            fill="var(--color-text-muted)"
          >
            43 × 40 mm
          </text>
        </g>

        {/* Live pointer trail, clipped to the pad like a real finger. */}
        <g pointerEvents="none" clipPath={`url(#${clipId})`}>
          {trail.length > 1 && (
            <polyline
              data-testid="tps43-trail"
              points={trail.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke="var(--color-electric)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          )}
          {lastPoint && (
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={5}
              fill="var(--color-electric)"
            />
          )}
        </g>
      </svg>

      <div
        role="group"
        aria-label={t("Fingers")}
        className="flex justify-center"
      >
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-border)]">
          {([1, 2] as const).map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setFingerCount(count)}
              aria-pressed={fingerCount === count}
              className={`px-3 py-1 text-xs transition-colors ${
                fingerCount === count
                  ? "bg-[var(--color-electric)]/15 text-[var(--color-electric)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {count}F
            </button>
          ))}
        </div>
      </div>

      <div
        data-testid="tps43-result"
        data-gesture={result?.gesture}
        data-axis={result?.detail?.axis}
        data-enabled={result ? String(result.enabled) : undefined}
        role="status"
        aria-live="polite"
        className="min-h-[40px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2.5 py-2 text-xs text-[var(--color-text-muted)]"
      >
        {result ? (
          <>
            <span className="text-[var(--color-text)]">
              {gestureLabel[result.gesture]}
            </span>
            {result.gesture === "scroll" && result.detail && (
              <span> · {t(result.detail.axis)}</span>
            )}
            {!result.enabled && <span> · {t("disabled")}</span>}
          </>
        ) : (
          t("Drag on the pad to try a gesture.")
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        {t(
          "Recognition is approximate; IQS572 does the real gesture detection.",
        )}
      </p>
    </div>
  );
}
