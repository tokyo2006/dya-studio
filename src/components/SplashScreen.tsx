import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  IconBluetooth,
  IconUsb,
  IconDeviceDesktop,
  IconArrowUp,
} from "@tabler/icons-react";
import { useState, useCallback } from "react";
import type { ConnectionMethod } from "./DeviceConnection";
import { ConnectionNoticeDialog } from "./ConnectionNoticeDialog";
import { hasAcceptedNotice } from "../lib/connectionNoticeStorage";

interface SplashScreenProps {
  onConnect: (method: ConnectionMethod) => void;
  isConnecting: boolean;
  error: string | null;
}

// Slash line component for disabled state
function DisabledSlash({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className={`w-[70px] h-[2px] ${color} rotate-45 rounded-full`} />
    </div>
  );
}

export function SplashScreen({
  onConnect,
  isConnecting,
  error,
}: SplashScreenProps) {
  const { t } = useTranslation();
  // Dialog state
  const [showNotice, setShowNotice] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<ConnectionMethod | null>(
    null,
  );

  const handleConnectClick = useCallback(
    (method: ConnectionMethod) => {
      // Demo mode doesn't need the notice
      if (method === "demo") {
        onConnect(method);
        return;
      }

      // Check if user has already accepted the notice
      if (hasAcceptedNotice(method)) {
        onConnect(method);
        return;
      }

      // Show notice dialog
      setPendingMethod(method);
      setShowNotice(true);
    },
    [onConnect],
  );

  const handleAgree = useCallback(() => {
    setShowNotice(false);
    if (pendingMethod) {
      onConnect(pendingMethod);
      setPendingMethod(null);
    }
  }, [pendingMethod, onConnect]);

  const handleCancel = useCallback(() => {
    setShowNotice(false);
    setPendingMethod(null);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-bg)]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-cyber opacity-30" />

      {/* Animated rings */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full border border-[var(--color-electric)]/20"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full border border-[var(--color-electric)]/10"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
      />
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full border border-[var(--color-electric)]/5"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
      />

      {/* Content container */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-8"
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
      >
        {/* Brand name */}
        <motion.div
          className="flex flex-col items-center gap-2 mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <h1 className="text-4xl font-light tracking-[0.3em] text-[var(--color-text)]">
            DYA
          </h1>
          <p className="text-sm font-light tracking-[0.2em] text-[var(--color-text-muted)] uppercase">
            Studio
          </p>
        </motion.div>

        {/* Connection section */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 2 }}
        >
          {/* Connect label */}
          <p className="text-sm font-light tracking-wider text-[var(--color-text-secondary)] text-center uppercase">
            {t("splash.connect")}
          </p>

          {/* Connection buttons */}
          <div className="flex flex-col items-center gap-4">
            {/* Device connection buttons */}
            <div className="flex gap-6">
              <button
                onClick={() => handleConnectClick("serial")}
                disabled={isConnecting}
                className="relative w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed border-[var(--color-electric)] bg-[var(--color-electric)]/10 hover:bg-[var(--color-electric)]/20 hover:border-[var(--color-electric)] hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]"
                aria-label={t("connectionNotice.connectViaUSB")}
                title={t("connectionNotice.connectViaUSB")}
              >
                <IconUsb
                  size={28}
                  className="text-[var(--color-electric)] relative z-10"
                  strokeWidth={1.5}
                />
                {isConnecting && (
                  <DisabledSlash color="bg-[var(--color-electric)]" />
                )}
              </button>
              <button
                onClick={() => handleConnectClick("ble")}
                disabled={isConnecting}
                className="relative w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed border-[var(--color-neon)] bg-[var(--color-neon)]/10 hover:bg-[var(--color-neon)]/20 hover:border-[var(--color-neon)] hover:shadow-[0_0_20px_rgba(0,255,204,0.3)]"
                aria-label={t("connectionNotice.connectViaBluetooth")}
                title={t("connectionNotice.connectViaBluetooth")}
              >
                <IconBluetooth
                  size={28}
                  className="text-[var(--color-neon)] relative z-10"
                  strokeWidth={1.5}
                />
                {isConnecting && (
                  <DisabledSlash color="bg-[var(--color-neon)]" />
                )}
              </button>
              <button
                onClick={() => handleConnectClick("demo")}
                disabled={isConnecting}
                className="relative w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed border-[var(--color-cyber)] bg-[var(--color-cyber)]/10 hover:bg-[var(--color-cyber)]/20 hover:border-[var(--color-cyber)] hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                aria-label={t("splash.tryDemoMode")}
                title={t("splash.tryDemoMode")}
              >
                <IconDeviceDesktop
                  size={28}
                  className="text-[var(--color-cyber)] relative z-10"
                  strokeWidth={1.5}
                />
                {isConnecting && (
                  <DisabledSlash color="bg-[var(--color-cyber)]" />
                )}
              </button>
            </div>
          </div>

          {/* Demo mode hint */}
          <motion.p
            className="text-xs text-[var(--color-text-muted)] mt-2 text-center leading-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            {t("splash.tryDemoMode")}
            <span className="text-[var(--color-cyber)] font-bold mx-1">
              {t("splash.demoMode")}
            </span>
            {t("splash.withoutKeyboard")}
            <IconArrowUp size={14} className="inline-block" />
          </motion.p>
        </motion.div>
      </motion.div>
      {/* Loading indicator */}
      {isConnecting && (
        <motion.div
          className="flex gap-1 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-electric)]"
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1, 0.8],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>
      )}

      {/* Error message */}
      {error && (
        <motion.div
          className="mt-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm text-red-500">{error}</p>
        </motion.div>
      )}

      {/* Tagline */}
      <motion.p
        className="absolute bottom-12 text-xs font-light tracking-wider text-[var(--color-text-muted)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {t("splash.maintainedBy")}
        <a
          href="https://x.com/cormoran707"
          target="_blank"
          rel="noopener noreferrer"
          className="underline mx-1"
        >
          @cormoran707
        </a>
        <br />
        {t("splash.specialThanksTo")}
        <a
          href="https://zmk.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="underline mx-1"
        >
          ZMK community
        </a>
        {t("splash.period")}
      </motion.p>

      {/* Connection Notice Dialog */}
      <ConnectionNoticeDialog
        open={showNotice}
        method={pendingMethod}
        onAgree={handleAgree}
        onCancel={handleCancel}
      />
    </motion.div>
  );
}
