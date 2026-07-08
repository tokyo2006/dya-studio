import { motion } from "framer-motion";
import { useLanguage } from "../hooks/useLanguage";

interface ReconnectingOverlayProps {
  /** Cancels an in-flight page-load auto-reconnect attempt. */
  onCancel: () => void;
}

/**
 * Minimal overlay shown while a page-load auto-reconnect attempt is in
 * flight. Unlike the full SplashScreen, this keeps the backdrop fully
 * transparent so the app doesn't appear to vanish behind an opaque splash
 * every time a paired device is silently reconnected — only a small
 * centered glass circle with a spinner and a cancel affordance is shown.
 */
export function ReconnectingOverlay({ onCancel }: ReconnectingOverlayProps) {
  const { t } = useLanguage();

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Centered glass circle - the only solid element on screen.
          rounded-full needs `!`: .glass-card's own border-radius wins the
          cascade otherwise and renders a rounded square. */}
      <div className="glass-card rounded-full! w-44 h-44 flex flex-col items-center justify-center gap-3 p-6">
        <motion.div
          className="w-12 h-12 rounded-full border-2 border-transparent border-t-[var(--color-electric)] border-r-[var(--color-electric)]"
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        <p className="text-xs font-light tracking-wider text-[var(--color-text-secondary)] text-center px-2">
          {t("Reconnecting to your keyboard...")}
        </p>
      </div>

      <button
        onClick={onCancel}
        aria-label={t("Cancel")}
        className="mt-4 text-xs text-[var(--color-text-muted)] underline underline-offset-4 hover:text-[var(--color-text-secondary)] transition-colors"
      >
        {t("Cancel")}
      </button>
    </motion.div>
  );
}
