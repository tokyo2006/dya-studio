import type { ReactNode } from "react";
import { IconAlertTriangleFilled } from "@tabler/icons-react";
import { useLanguage } from "../../hooks/useLanguage";

interface SectionCardProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function SectionCard({
  icon,
  title,
  subtitle,
  actions,
  children,
}: SectionCardProps) {
  return (
    <div className="glass-card p-6">
      <div className="flex flex-col tablet:flex-row tablet:items-center gap-3 mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-lg bg-[var(--color-electric)]/10 border border-[var(--color-electric)]/20">
            {icon}
          </div>
          <div>
            <h2 className="text-sm font-medium text-[var(--color-text)]">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[var(--color-text-muted)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 ml-auto">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}

interface NotAvailableNoticeProps {
  module: string;
  moduleUrl: string;
}

export function NotAvailableNotice({
  module,
  moduleUrl,
}: NotAvailableNoticeProps) {
  const { t } = useLanguage();
  return (
    <div className="p-4 rounded-lg bg-[var(--color-border)] border border-[var(--color-border-hover)] flex items-start gap-3">
      <div className="p-1">
        <IconAlertTriangleFilled
          size={20}
          className="text-[var(--color-text-muted)]"
        />
      </div>
      <p className="text-sm text-[var(--color-text-muted)]">
        <span>{t("Not available on this keyboard.")}</span>
        <br />
        {t("Make sure your firmware has the {{module}} enabled.", {
          module,
        })}
        <a
          href={moduleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-electric)] underline mx-1"
        >
          {module}
        </a>
      </p>
    </div>
  );
}

export function SectionError({ message }: { message: string }) {
  return (
    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
      <p className="text-sm text-red-400">{message}</p>
    </div>
  );
}
