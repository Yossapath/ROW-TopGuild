import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data }, { status });
}
export function err(message: string, status = 400) {
  return NextResponse.json<ApiResponse>({ ok: false, error: message }, { status });
}
export function unauthorized() { return err("Unauthorized", 401); }
export function forbidden() { return err("Forbidden — Admin only", 403); }

// logAction: fire-and-forget system log writer
export async function logAction(params: {
  module: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  extra?: unknown;
}) {
  try {
    const { logsRef } = await import("@/lib/firebase-admin");
    await logsRef().collection("entries").add({
      ...params,
      extra: params.extra ?? {},
      timestamp: Date.now(),
    });
  } catch (e) {
    console.error("[logAction] failed:", e);
  }
}
