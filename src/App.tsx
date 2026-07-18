import { useContext, useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconHome,
  IconKeyboard,
  IconPlugConnected,
  IconPointer,
  IconPuzzle,
  IconSettings,
  IconStethoscope,
  IconWand,
} from "@tabler/icons-react";

import { SplashScreen } from "./components/SplashScreen";
import { ReconnectingOverlay } from "./components/ReconnectingOverlay";
import {
  DeviceConnectionProvider,
  ConnectionContext,
} from "./components/DeviceConnection";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { KeyboardLayoutProvider } from "./contexts/KeyboardLayoutProvider";
import { TabNavigation } from "./components/TabNavigation";
import type { TabItem } from "./components/TabNavigation";
import { AppLayout } from "./layouts/AppLayout";
import { HomePage } from "./pages/HomePage";
import { ConnectionPage } from "./pages/ConnectionPage";
import { KeymapPage } from "./pages/KeymapPage";
import { TrackballPage } from "./pages/TrackballPage";
import { MacroComboPage } from "./pages/MacroComboPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CustomSubsystemsPage } from "./pages/CustomSubsystemsPage";
import { TroubleshootingPage } from "./pages/TroubleshootingPage";
import { useLanguage } from "./hooks/useLanguage";
import { useUrlTab, pathnameFromTabId } from "./hooks/useUrlTab";
import { useDevtool } from "./hooks/useDevtool";
import { DevtoolWindow } from "./components/DevtoolWindow";

function getTabs(t: (key: string) => string): TabItem[] {
  return [
    {
      id: "home",
      label: t("Home"),
      icon: <IconHome size={18} />,
      content: <HomePage />,
    },
    {
      id: "keymap",
      label: t("Keymap"),
      icon: <IconKeyboard size={18} />,
      content: <KeymapPage />,
    },
    {
      id: "macro-combo",
      label: t("Macro&Combo"),
      icon: <IconWand size={18} />,
      content: <MacroComboPage />,
    },
    {
      id: "trackball",
      label: t("Trackball"),
      icon: <IconPointer size={18} />,
      content: <TrackballPage />,
    },
    {
      id: "connection",
      label: t("Connection"),
      icon: <IconPlugConnected size={18} />,
      content: <ConnectionPage />,
    },
    {
      id: "settings",
      label: t("Settings"),
      icon: <IconSettings size={18} />,
      content: <SettingsPage />,
    },
    {
      id: "troubleshooting",
      label: t("Troubleshooting"),
      icon: <IconStethoscope size={18} />,
      content: <TroubleshootingPage />,
    },
    {
      id: "subsystems",
      label: t("Subsystems"),
      icon: <IconPuzzle size={18} />,
      content: <CustomSubsystemsPage />,
    },
  ];
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <KeyboardLayoutProvider>
          <DeviceConnectionProvider>
            <AppContent />
          </DeviceConnectionProvider>
        </KeyboardLayoutProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const connection = useContext(ConnectionContext);
  const { t } = useLanguage();
  const [urlTab, navigateToTab] = useUrlTab();
  const tabs = getTabs(t);
  const { isAvailable: isDevtoolAvailable } = useDevtool();
  const [devtoolOpen, setDevtoolOpen] = useState(false);
  const activeTab = tabs.some((tab) => tab.id === urlTab) ? urlTab : "home";

  useEffect(() => {
    // Canonicalize unknown paths (e.g. a stale/typo'd link) to the home tab.
    if (urlTab !== activeTab && window.location.pathname !== "/") {
      window.history.replaceState(null, "", "/");
    }
  }, [urlTab, activeTab]);

  const setActiveTabWithTracking = useCallback(
    (tabId: string) => {
      // Google Analytics pageview tracking
      if (window.gtag) {
        window.gtag("event", "page_view", {
          page_title: tabs.find((tab) => tab.id === tabId)?.label || "Unknown",
          page_path: pathnameFromTabId(tabId),
        });
      }
      navigateToTab(tabId);
    },
    [navigateToTab, tabs],
  );
  useEffect(() => {
    if (connection.deviceName && window.gtag) {
      window.gtag("event", "keyboard_connected", {
        name: connection.deviceName,
      });
    }
  }, [connection.deviceName]);

  return (
    <>
      <AnimatePresence>
        {connection.isReconnecting ? (
          <ReconnectingOverlay
            key="reconnecting"
            onCancel={connection.onCancelReconnect}
          />
        ) : (
          !connection.isConnected && (
            <motion.div
              key="splash"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <SplashScreen
                onConnect={connection.onConnect}
                isConnecting={connection.isLoading}
                error={connection.error}
              />
            </motion.div>
          )
        )}
      </AnimatePresence>

      {connection.isConnected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="h-screen"
        >
          <AppLayout
            isConnected={connection.isConnected}
            deviceName={connection.deviceName}
            onConnect={connection.onConnect}
            onDisconnect={connection.onDisconnect}
            isConnecting={connection.isLoading}
          >
            <TabNavigation
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTabWithTracking}
            />
          </AppLayout>
        </motion.div>
      )}

      {connection.isConnected && isDevtoolAvailable && (
        <button
          className="fixed bottom-5 right-5 z-[9998] h-8 px-3 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-electric)] hover:border-[var(--color-electric)] hover:shadow-glow-electric-sm transition-all duration-200 flex items-center justify-center text-[10px] font-sans font-medium tracking-wide"
          onClick={() => setDevtoolOpen((v) => !v)}
          title={t("Debug Tool")}
          aria-label={t("Debug Tool")}
        >
          {t("Debug Tool")}
        </button>
      )}

      {connection.isConnected && isDevtoolAvailable && devtoolOpen && (
        <DevtoolWindow onClose={() => setDevtoolOpen(false)} />
      )}
    </>
  );
}

export default App;
