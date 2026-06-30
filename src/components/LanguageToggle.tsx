import { IconLanguage } from "@tabler/icons-react";
import { useLanguage } from "../hooks/useLanguage";

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className = "" }: LanguageToggleProps) {
  const { language, toggleLanguage, t } = useLanguage();
  const nextLanguage = language === "en" ? "ja" : "en";

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`theme-toggle language-toggle ${className}`}
      aria-label={t("Switch language")}
      title={t("Language")}
    >
      <IconLanguage size={18} />
      <span className="text-xs font-medium uppercase leading-none">
        {nextLanguage}
      </span>
    </button>
  );
}
