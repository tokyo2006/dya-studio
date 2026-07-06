import {
  IconBrandWindows,
  IconBrandApple,
  IconBrandUbuntu,
  IconDeviceMobile,
  IconBrandAndroid,
  IconQuestionMark,
} from "@tabler/icons-react";
import { Os } from "../proto/cormoran/os_detection/os_detection";
import { osLabel } from "../lib/osDetection";
import { useLanguage } from "../hooks/useLanguage";

function renderIcon(os: number, size: number) {
  const iconClassName = "text-[var(--color-electric)]";
  switch (os) {
    case Os.OS_WINDOWS:
      return <IconBrandWindows size={size} className={iconClassName} />;
    case Os.OS_MACOS:
      return <IconBrandApple size={size} className={iconClassName} />;
    case Os.OS_LINUX:
      return <IconBrandUbuntu size={size} className={iconClassName} />;
    case Os.OS_IOS:
      return <IconDeviceMobile size={size} className={iconClassName} />;
    case Os.OS_ANDROID:
      return <IconBrandAndroid size={size} className={iconClassName} />;
    default:
      return <IconQuestionMark size={size} className={iconClassName} />;
  }
}

interface OsBadgeProps {
  os: number;
  size?: number;
  className?: string;
}

export function OsBadge({ os, size = 16, className = "" }: OsBadgeProps) {
  const { t } = useLanguage();
  const label = t(osLabel(os));
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[var(--color-text-secondary)] ${className}`}
    >
      {renderIcon(os, size)}
      <span className="text-sm">{label}</span>
    </span>
  );
}
