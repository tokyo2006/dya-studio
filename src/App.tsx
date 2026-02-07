import { useState, useContext, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconBattery2,
  IconBluetooth,
  IconHeartRateMonitor,
  IconHome,
  IconKeyboard,
  IconPointer,
  IconSettings,
} from "@tabler/icons-react";

import { SplashScreen } from "./components/SplashScreen";
import {
  DeviceConnectionProvider,
  ConnectionContext,
} from "./components/DeviceConnection";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TabNavigation } from "./components/TabNavigation";
import type { TabItem } from "./components/TabNavigation";
import { AppLayout } from "./layouts/AppLayout";
import { HomePage } from "./pages/HomePage";
import { BatteryPage } from "./pages/BatteryPage";
import { BLEConnectionsPage } from "./pages/BLEConnectionsPage";
import { HealthCheckPage } from "./pages/HealthCheckPage";
import { KeymapPage } from "./pages/KeymapPage";
import { TrackballPage } from "./pages/TrackballPage";
import { SettingsPage } from "./pages/SettingsPage";

const tabs: TabItem[] = [
  {
    id: "home",
    label: "Home",
    icon: <IconHome size={18} />,
    content: <HomePage />,
  },
  {
    id: "battery",
    label: "Battery",
    icon: <IconBattery2 size={18} />,
    content: <BatteryPage />,
  },
  {
    id: "ble",
    label: "BLE",
    icon: <IconBluetooth size={18} />,
    content: <BLEConnectionsPage />,
  },
  {
    id: "health",
    label: "Health",
    icon: <IconHeartRateMonitor size={18} />,
    content: <HealthCheckPage />,
  },
  {
    id: "keymap",
    label: "Keymap",
    icon: <IconKeyboard size={18} />,
    content: <KeymapPage />,
  },
  {
    id: "trackball",
    label: "Trackball",
    icon: <IconPointer size={18} />,
    content: <TrackballPage />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <IconSettings size={18} />,
    content: <SettingsPage />,
  },
];

function App() {
  return (
    <ThemeProvider>
      <DeviceConnectionProvider>
        <AppContent />
      </DeviceConnectionProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const connection = useContext(ConnectionContext);
  const [activeTab, setActiveTab] = useState("home");

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
    [setActiveTab],
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
