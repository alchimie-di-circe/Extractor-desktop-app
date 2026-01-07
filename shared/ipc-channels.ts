/**
 * IPC Channel names for keychain operations
 */
export const KeychainChannels = {
  SAVE: "keychain:save",
  GET: "keychain:get",
  DELETE: "keychain:delete",
  LIST: "keychain:list",
  HAS: "keychain:has",
} as const;

/**
 * IPC Channel names for config operations
 */
export const ConfigChannels = {
  GET: "config:get",
  SET: "config:set",
  GET_ALL: "config:get-all",
  SET_ALL: "config:set-all",
  DELETE: "config:delete",
  HAS: "config:has",
  RESET: "config:reset",
  GET_PATH: "config:get-path",
} as const;

/**
 * IPC Channel names for system operations
 */
export const SystemChannels = {
  GET_PLATFORM: "system:get-platform",
} as const;
