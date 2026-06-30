import {
  IconHeartRateMonitor,
  IconCircleCheck,
  IconAlertCircle,
  IconCircleDashed,
} from "@tabler/icons-react";
import { useLanguage } from "../hooks/useLanguage";

interface HealthItem {
  name: string;
  description: string;
  status: "ok" | "error" | "unknown";
}

const healthItems: HealthItem[] = [
  {
    name: "Left MCU",
    description: "Main controller communication",
    status: "unknown",
  },
  {
    name: "Right MCU",
    description: "Split keyboard communication",
    status: "unknown",
  },
  {
    name: "Trackball IC",
    description: "PMW3360 sensor connection",
    status: "unknown",
  },
  {
    name: "Left Battery",
    description: "Battery fuel gauge",
    status: "unknown",
  },
  {
    name: "Right Battery",
    description: "Battery fuel gauge",
    status: "unknown",
  },
  {
    name: "BLE Radio",
    description: "Bluetooth module status",
    status: "unknown",
  },
];

function StatusIcon({ status }: { status: HealthItem["status"] }) {
  switch (status) {
    case "ok":
      return <IconCircleCheck size={20} className="text-[var(--color-neon)]" />;
    case "error":
      return <IconAlertCircle size={20} className="text-red-500" />;
    default:
      return (
        <IconCircleDashed
          size={20}
          className="text-[var(--color-text-muted)]"
        />
      );
  }
}

export function HealthCheckPage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-[var(--color-neon)]/10 border border-[var(--color-neon)]/20">
            <IconHeartRateMonitor
              size={24}
              className="text-[var(--color-neon)]"
            />
          </div>
          <div>
            <h1 className="text-xl font-medium text-[var(--color-text)]">
              {t("Health Check")}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {t("Circuit and component diagnostics")}
            </p>
          </div>
        </div>

        {/* Health Status Grid */}
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
          {healthItems.map((item) => (
            <div
              key={item.name}
              className="glass-card p-4 flex items-center gap-4"
            >
              <StatusIcon status={item.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {t(item.name)}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">
                  {t(item.description)}
                </p>
              </div>
              <span
                className={`text-xs font-mono uppercase ${
                  item.status === "ok"
                    ? "text-[var(--color-neon)]"
                    : item.status === "error"
                      ? "text-red-500"
                      : "text-[var(--color-text-muted)]"
                }`}
              >
                {t(item.status)}
              </span>
            </div>
          ))}
        </div>

        {/* Run Diagnostics Button */}
        <div className="mt-8 flex justify-center">
          <button className="btn-electric" disabled>
            {t("Run Diagnostics")}
          </button>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)]">
          <p className="text-xs text-[var(--color-text-muted)]">
            {t(
              "Connect your keyboard to run hardware diagnostics. This will check communication with all components and report any issues.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
