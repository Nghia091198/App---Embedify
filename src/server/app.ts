import { createHaravanApp } from '../haravan/index.js';

/** Middleware `requestLogger` được gắn trong `createHaravanApp` (trước mọi route). */
export function createBackendApp() {
  return createHaravanApp();
}
