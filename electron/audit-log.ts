import { app } from "electron";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type AuditEvent = {
  timestamp: string;
  actor: string;
  action: string;
  success: boolean;
  providerId?: string | null;
  role?: string | null;
  model?: string | null;
  errorCode?: string;
  metadata?: Record<string, unknown>;
};

function getActor(): string {
  try {
    return os.userInfo().username;
  } catch {
    return "unknown";
  }
}

function getAuditLogPath(): string {
  return path.join(app.getPath("userData"), "audit.log");
}

export function logAuditEvent(event: Omit<AuditEvent, "timestamp" | "actor">): void {
  const payload: AuditEvent = {
    timestamp: new Date().toISOString(),
    actor: getActor(),
    ...event,
  };

  const line = `${JSON.stringify(payload)}\n`;
  fs.appendFile(getAuditLogPath(), line).catch((error) => {
    console.error("Failed to write audit log:", error);
  });
}
