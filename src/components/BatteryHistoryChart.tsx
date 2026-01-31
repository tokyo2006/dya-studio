import { useMemo } from "react";
import { IconRefresh } from "@tabler/icons-react";
import type { BatteryHistoryEntryData } from "../hooks/useBatteryHistory";

interface BatteryHistoryChartProps {
  entries: BatteryHistoryEntryData[];
  deviceName: string;
  color: string;
}

interface ChartSegment {
  entries: BatteryHistoryEntryData[];
  isRestart: boolean;
  startX: number; // Pre-calculated X position
  width: number; // Pre-calculated width
}

// Detect timestamp resets (keyboard restarts) and calculate positions
function detectRestarts(entries: BatteryHistoryEntryData[]): ChartSegment[] {
  if (entries.length === 0) return [];

  const RESTART_GAP = 5; // Percentage of chart width for restart gap
  const allTimestamps = entries.map((e) => e.timestamp);
  const minTimestamp = Math.min(...allTimestamps);
  const maxTimestamp = Math.max(...allTimestamps);
  const timeRange = maxTimestamp - minTimestamp || 1;

  const segments: ChartSegment[] = [];
  let currentSegment: BatteryHistoryEntryData[] = [entries[0]];
  let cumulativeX = 0;

  for (let i = 1; i < entries.length; i++) {
    const prevTimestamp = entries[i - 1].timestamp;
    const currTimestamp = entries[i].timestamp;

    // Detect restart: timestamp goes backwards or resets to a very small value
    const isRestart = currTimestamp < prevTimestamp || currTimestamp < 3600; // Less than 1 hour suggests reset

    if (isRestart) {
      // Calculate and save current segment
      const segmentMinTime = Math.min(...currentSegment.map((e) => e.timestamp));
      const segmentMaxTime = Math.max(...currentSegment.map((e) => e.timestamp));
      const segmentWidth = ((segmentMaxTime - segmentMinTime) / timeRange) * 100;
      
      segments.push({ 
        entries: currentSegment, 
        isRestart: false,
        startX: cumulativeX,
        width: segmentWidth
      });
      cumulativeX += segmentWidth;

      // Add a restart marker
      segments.push({ 
        entries: [], 
        isRestart: true,
        startX: cumulativeX,
        width: RESTART_GAP
      });
      cumulativeX += RESTART_GAP;

      // Start new segment
      currentSegment = [entries[i]];
    } else {
      currentSegment.push(entries[i]);
    }
  }

  // Add final segment
  if (currentSegment.length > 0) {
    const segmentMinTime = Math.min(...currentSegment.map((e) => e.timestamp));
    const segmentMaxTime = Math.max(...currentSegment.map((e) => e.timestamp));
    const segmentWidth = ((segmentMaxTime - segmentMinTime) / timeRange) * 100;
    
    segments.push({ 
      entries: currentSegment, 
      isRestart: false,
      startX: cumulativeX,
      width: segmentWidth
    });
  }

  return segments;
}

function formatTimestamp(timestamp: number): string {
  const hours = Math.floor(timestamp / 3600);
  const minutes = Math.floor((timestamp % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function BatteryHistoryChart({
  entries,
  deviceName,
  color,
}: BatteryHistoryChartProps) {
  const segments = useMemo(() => detectRestarts(entries), [entries]);

  if (entries.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center border border-dashed border-[var(--color-border)] rounded-lg">
        <span className="text-[var(--color-text-muted)] text-sm">
          No battery history available
        </span>
      </div>
    );
  }

  // Chart dimensions
  const height = 192; // pixels
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartHeight = height - padding.top - padding.bottom;

  // Find min/max values
  const allTimestamps = entries.map((e) => e.timestamp);
  const minTimestamp = Math.min(...allTimestamps);
  const maxTimestamp = Math.max(...allTimestamps);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
          {deviceName}
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          {entries.length} entries
        </span>
      </div>

      <div className="relative" style={{ height: `${height}px` }}>
        <svg
          viewBox={`0 0 600 ${height}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Y-axis labels */}
          <g className="text-[var(--color-text-muted)]" fontSize="10">
            {[0, 25, 50, 75, 100].map((level) => {
              const y = padding.top + chartHeight - (level / 100) * chartHeight;
              return (
                <g key={level}>
                  <text x={padding.left - 8} y={y} textAnchor="end" dominantBaseline="middle">
                    {level}%
                  </text>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={600 - padding.right}
                    y2={y}
                    stroke="var(--color-border)"
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                  />
                </g>
              );
            })}
          </g>

          {/* Render segments */}
          {segments.map((segment, segIndex) => {
            if (segment.isRestart) {
              // Restart marker
              const x = padding.left + (segment.startX / 100) * (600 - padding.left - padding.right);

              return (
                <g key={`restart-${segIndex}`}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={height - padding.bottom}
                    stroke="var(--color-text-muted)"
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                  <g transform={`translate(${x}, ${padding.top - 5})`}>
                    <circle r="8" fill="var(--color-bg)" stroke="var(--color-border)" />
                    <text
                      fontSize="10"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="var(--color-text-muted)"
                    >
                      ⟲
                    </text>
                  </g>
                </g>
              );
            }

            // Data segment
            const segmentEntries = segment.entries;
            if (segmentEntries.length === 0) return null;

            const segmentMinTime = Math.min(...segmentEntries.map((e) => e.timestamp));
            const segmentMaxTime = Math.max(...segmentEntries.map((e) => e.timestamp));
            const segmentTimeRange = segmentMaxTime - segmentMinTime || 1;

            const points = segmentEntries
              .map((entry) => {
                const x =
                  padding.left +
                  (segment.startX / 100) * (600 - padding.left - padding.right) +
                  ((entry.timestamp - segmentMinTime) / segmentTimeRange) *
                    (segment.width / 100) *
                    (600 - padding.left - padding.right);
                const y =
                  padding.top + chartHeight - (entry.batteryLevel / 100) * chartHeight;
                return `${x},${y}`;
              })
              .join(" ");

            return (
              <g key={`segment-${segIndex}`}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Add dots for each point */}
                {segmentEntries.map((entry, pointIndex) => {
                  const x =
                    padding.left +
                    (segment.startX / 100) * (600 - padding.left - padding.right) +
                    ((entry.timestamp - segmentMinTime) / segmentTimeRange) *
                      (segment.width / 100) *
                      (600 - padding.left - padding.right);
                  const y =
                    padding.top + chartHeight - (entry.batteryLevel / 100) * chartHeight;
                  return (
                    <circle
                      key={pointIndex}
                      cx={x}
                      cy={y}
                      r="2"
                      fill={color}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* X-axis */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={600 - padding.right}
            y2={height - padding.bottom}
            stroke="var(--color-border)"
            strokeWidth="1"
          />

          {/* Y-axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke="var(--color-border)"
            strokeWidth="1"
          />
        </svg>

        {/* Time range label */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center">
          <span className="text-xs text-[var(--color-text-muted)]">
            {formatTimestamp(minTimestamp)} — {formatTimestamp(maxTimestamp)}
          </span>
        </div>
      </div>

      {/* Legend for restarts */}
      {segments.some((s) => s.isRestart) && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <IconRefresh size={14} />
          <span>Dashed line indicates keyboard restart</span>
        </div>
      )}
    </div>
  );
}
