import { useState, useContext, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconBattery2,
  IconBluetooth,
  IconHome,
  IconKeyboard,
  IconKeyboardShow,
  IconListDetails,
  IconPointer,
  IconPuzzle,
  IconSettings,
} from "@tabler/icons-react";

import { SplashScreen } from "./components/SplashScreen";
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
import { BatteryPage } from "./pages/BatteryPage";
import { BLEConnectionsPage } from "./pages/BLEConnectionsPage";
import { KeymapPage } from "./pages/KeymapPage";
import { ComboPage } from "./pages/ComboPage";
import { TrackballPage } from "./pages/TrackballPage";
import { MacroPage } from "./pages/MacroPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CustomSubsystemsPage } from "./pages/CustomSubsystemsPage";
import { useLanguage } from "./hooks/useLanguage";

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
      id: "macro",
      label: t("Macro"),
      icon: <IconListDetails size={18} />,
      content: <MacroPage />,
    },
    {
      id: "combo",
      label: t("Combo"),
      icon: <IconKeyboardShow size={18} />,
      content: <ComboPage />,
    },
    {
      id: "trackball",
      label: t("Trackball"),
      icon: <IconPointer size={18} />,
      content: <TrackballPage />,
    },
    {
      id: "ble",
      label: t("BLE"),
      icon: <IconBluetooth size={18} />,
      content: <BLEConnectionsPage />,
    },
    {
      id: "settings",
      label: t("Settings"),
      icon: <IconSettings size={18} />,
      content: <SettingsPage />,
    },
    {
      id: "battery",
      label: t("Battery"),
      icon: <IconBattery2 size={18} />,
      content: <BatteryPage />,
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
  const [activeTab, setActiveTab] = useState("home");
  const tabs = getTabs(t);

  const setActiveTabWithTracking = useCallback(
    (tabId: string) => {
      // Google Analytics pageview tracking
      if (window.gtag) {
        window.gtag("event", "page_view", {
          page_title: tabs.find((tab) => tab.id === tabId)?.label || "Unknown",
          page_path: `/${tabId}`,
        });
      }
      setActiveTab(tabId);
    },
    [setActiveTab, tabs],
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
        {!connection.isConnected && (
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
    </>
  );
}

export default App;
