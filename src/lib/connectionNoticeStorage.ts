/**
 * Local storage utilities for connection notice acceptance
 */

import type { ConnectionMethod } from "../components/DeviceConnection";

// Version of the notice - increment when notice content changes
const NOTICE_VERSION = "1.1.0";
const NOTICE_STORAGE_KEY = "dya-studio-connection-notice-accepted";

/**
 * Check if user has already accepted the current version of the notice
 */
export function hasAcceptedNotice(connectionMethod: ConnectionMethod): boolean {
  try {
    const accepted = localStorage.getItem(
      NOTICE_STORAGE_KEY + `-${connectionMethod}`,
    );
    return accepted === NOTICE_VERSION;
  } catch {
    return false;
  }
}

/**
 * Save the notice acceptance to local storage
 */
export function saveNoticeAcceptance(connectionMethod: ConnectionMethod): void {
  try {
    localStorage.setItem(
      NOTICE_STORAGE_KEY + `-${connectionMethod}`,
      NOTICE_VERSION,
    );
  } catch {
    // Ignore storage errors
  }
}
