/**
 * Navigation utility
 * Abstracted so it can be easily mocked in tests.
 */
export function navigateTo(url: string): void {
  window.location.assign(url);
}
