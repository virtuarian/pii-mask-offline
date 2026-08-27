/**
 * Cache versioning (see docs/CACHING_STRATEGY.md).
 *
 * App shell and model assets are versioned independently so that a UI-only
 * release doesn't force re-downloading the (large) model, and a model
 * update doesn't require an app rebuild to take effect for existing users.
 * Bump APP_CACHE_VERSION for any src/ change; bump MODEL_CACHE_VERSION only
 * when the files under public/models/ change.
 */
export const APP_CACHE_VERSION = "1";
export const MODEL_CACHE_VERSION = "1";

export const APP_SHELL_CACHE_NAME = `app-shell-v${APP_CACHE_VERSION}`;
export const MODEL_ASSETS_CACHE_NAME = `model-assets-v${MODEL_CACHE_VERSION}`;

/** Every cache name this app is allowed to keep; `activate` deletes anything else. */
export const CURRENT_CACHE_NAMES: readonly string[] = [
  APP_SHELL_CACHE_NAME,
  MODEL_ASSETS_CACHE_NAME,
];
