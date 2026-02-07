/**
 * Local storage utilities for connection notice acceptance
 */

// Version of the notice - increment when notice content changes
const NOTICE_VERSION = "1.0.0";
const NOTICE_STORAGE_KEY = "dya-studio-connection-notice-accepted";

/**
 * Check if user has already accepted the current version of the notice
 */
export function hasAcceptedNotice(): boolean {
  try {
    const accepted = localStorage.getItem(NOTICE_STORAGE_KEY);
    return accepted === NOTICE_VERSION;
  } catch {
    return false;
  }
}

/**
 * Save the notice acceptance to local storage
 */
export function saveNoticeAcceptance(): void {
  try {
    localStorage.setItem(NOTICE_STORAGE_KEY, NOTICE_VERSION);
  } catch {
    // Ignore storage errors
  }
}
