/**
 * Centralized haptic feedback utility.
 * Uses navigator.vibrate() — supported on Android/Chrome.
 * Silently no-ops on unsupported browsers (iOS Safari, most desktops).
 */

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

/** Generic single pulse */
export const hapticTap = (ms: number) => vibrate(ms);

/** 20ms pulse — Extract / Mix button press */
export const hapticPrimaryAction = () => vibrate(20);

/** Double-pulse [30, 50, 30] — Extract / Mix completion */
export const hapticPrimarySuccess = () => vibrate([30, 50, 30]);

/** 15ms pulse — File drop or selection validated */
export const hapticFileSelect = () => vibrate(15);

/** 5ms pulse — Toolbar formatting / LaTeX insert */
export const hapticFormat = () => vibrate(5);

/** Long error pattern [100, 80, 40] — Error toasts */
export const hapticError = () => vibrate([100, 80, 40]);
