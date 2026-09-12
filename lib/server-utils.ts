import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data }, { status });
}
export function err(message: string, status = 400) {
  return NextResponse.json<ApiResponse>({ ok: false, error: message }, { status });
}
export function unauthorized(message = "Unauthorized") { return err(message, 401); }
export function forbidden(message = "Forbidden — Admin only") { return err(message, 403); }
export function notFound(message = "Not found") { return err(message, 404); }
export function conflict(message = "Conflict") { return err(message, 409); }
export function tooManyRequests(message = "Too Many Requests") { return err(message, 429); }

// Safe server error handler to prevent leaking internal stack traces / configs
export function handleServerError(error: unknown, userMessage = "Internal server error") {
  console.error("[ServerError]", error);

  if (error && typeof error === "object") {
    // 1. Zod validation error
    if ("name" in error && error.name === "ZodError") {
      const issues = (error as any).issues || (error as any).errors;
      const msg = Array.isArray(issues) ? issues.map((e: any) => e.message).join(", ") : "Validation failed";
      return err(msg || "Validation failed", 400);
    }

    // 2. Custom App Error with explicit HTTP status code
    if ("status" in error && typeof (error as any).status === "number" && (error as any).status >= 400 && (error as any).status < 600) {
      return err((error as any).message || userMessage, (error as any).status);
    }
    if ("statusCode" in error && typeof (error as any).statusCode === "number" && (error as any).statusCode >= 400 && (error as any).statusCode < 600) {
      return err((error as any).message || userMessage, (error as any).statusCode);
    }

    // 3. Known business rule conflict / duplicate errors
    if (error instanceof Error) {
      const msg = error.message;
      if (
        msg.includes("อยู่ในคิวแล้ว") ||
        msg.includes("อยู่ใน Roster แล้ว") ||
        msg.includes("DUPLICATE_QUEUE_NAME") ||
        msg.includes("Conflict") ||
        msg.includes("conflict")
      ) {
        return err(msg === "DUPLICATE_QUEUE_NAME" ? "ชื่อนี้อยู่ในคิวแล้ว (สถานะรอ หรือ กำลังลง)" : msg, 409);
      }
      if (msg.includes("ครบ 30 คนแล้ว") || msg.includes("DAILY_LIMIT_EXCEEDED")) {
        return err("วันนี้มีผู้เล่นจองครบ 30 คนแล้ว — ระบบปิดรับจองสำหรับวันนี้", 403);
      }
    }
  }

  return err(userMessage, 500);
}

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
