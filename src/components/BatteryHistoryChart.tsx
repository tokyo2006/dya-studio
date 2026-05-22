import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { IconRefresh } from "@tabler/icons-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { DeviceBatteryHistory } from "../hooks/useBatteryHistory";

interface BatteryHistoryChartProps {
  devices: DeviceBatteryHistory[];
  deviceColors: string[];
}

interface ChartDataPoint {
  timestamp: number;
  timeLabel: string;
  [key: string]: number | string | null; // Dynamic device keys
}

interface RestartMarker {
  timestamp: number;
}

// Format timestamp for display
function formatTimestamp(timestamp: number): string {
  const days = Math.floor(timestamp / (3600 * 24));
  const hours = Math.floor((timestamp % (3600 * 24)) / 3600);
  const minutes = Math.floor((timestamp % 3600) / 60);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Detect restart markers across all devices
function detectRestarts(devices: DeviceBatteryHistory[]): RestartMarker[] {
  const restarts: RestartMarker[] = [];
  const seenTimestamps = new Set<number>();

  devices.forEach((device) => {
    for (let i = 1; i < device.entries.length; i++) {
      const currTimestamp = device.entries[i].timestamp;
      const isRestart = device.entries[i].restarted;

      if (isRestart && !seenTimestamps.has(currTimestamp)) {
        restarts.push({ timestamp: currTimestamp });
        seenTimestamps.add(currTimestamp);
      }
    }
  });

  return restarts.sort((a, b) => a.timestamp - b.timestamp);
}

// Combine all device data into a unified timeline
function combineDeviceData(devices: DeviceBatteryHistory[]): ChartDataPoint[] {
  // Collect all unique timestamps
  const timestampSet = new Set<number>();
  devices.forEach((device) => {
    device.entries.forEach((entry) => {
      timestampSet.add(entry.timestamp);
    });
  });

  const sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b);

  // Create data points with all device values
  return sortedTimestamps.map((timestamp) => {
    const dataPoint: ChartDataPoint = {
      timestamp,
      timeLabel: formatTimestamp(timestamp),
    };

    devices.forEach((device) => {
      const entry = device.entries.find((e) => e.timestamp === timestamp);
      dataPoint[device.deviceName] = entry ? entry.batteryLevel : null;
    });

    return dataPoint;
  });
}

// Custom tooltip component
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 border border-[var(--color-border)]">
        <p className="text-xs font-medium text-[var(--color-text)] mb-2">
          {formatTimestamp(Number(label))}
        </p>
        {payload.map((entry, index) => (
          <p key={index} className="text-xs text-[var(--color-text-secondary)]">
            <span style={{ color: entry.color }}>●</span> {entry.name}:{" "}
            {entry.value}%
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function BatteryHistoryChart({
  devices,
  deviceColors,
}: BatteryHistoryChartProps) {
  const { t } = useTranslation();
  const chartData = useMemo(() => combineDeviceData(devices), [devices]);
  const restartMarkers = useMemo(() => detectRestarts(devices), [devices]);

  if (devices.length === 0 || chartData.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center border border-dashed border-[var(--color-border)] rounded-lg">
        <span className="text-[var(--color-text-muted)] text-sm">
          No battery history available
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
          Battery Level Over Time
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          {chartData.length} data points
        </span>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.3}
          />
          <XAxis
            dataKey="timestamp"
            stroke="var(--color-text-muted)"
            tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
            tickLine={{ stroke: "var(--color-border)" }}
            tickFormatter={formatTimestamp}
          />
          <YAxis
            stroke="var(--color-text-muted)"
            tick={{ fill: "var(--color-text-muted)", fontSize: 12 }}
            tickLine={{ stroke: "var(--color-border)" }}
            domain={[0, 100]}
            label={{
              value: "Battery %",
              angle: -90,
              position: "insideLeft",
              style: { fill: "var(--color-text-muted)", fontSize: 12 },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{
              paddingTop: "20px",
              fontSize: "12px",
              color: "var(--color-text-secondary)",
            }}
          />

          {/* Restart markers */}
          {restartMarkers.map((marker) => (
            <ReferenceLine
              key={`restart-${marker.timestamp}}`}
              ifOverflow="extendDomain"
              x={marker.timestamp}
              //   x={formatTimestamp(marker.timestamp)}
              stroke="var(--color-text-muted)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: "⟲",
                position: "top",
                fill: "var(--color-text-muted)",
                fontSize: 16,
              }}
            />
          ))}

          {/* Lines for each device */}
          {devices.map((device, index) => (
            <Line
              key={device.sourceId}
              type="monotone"
              dataKey={device.deviceName}
              stroke={deviceColors[index % deviceColors.length]}
              strokeWidth={1}
              dot={{ fill: deviceColors[index % deviceColors.length], r: 3 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend for restarts */}
      {restartMarkers.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mt-2">
          <IconRefresh size={14} />
          <span>{t("batteryHistory.restartIndicator")}</span>
        </div>
      )}
    </div>
  );
}
