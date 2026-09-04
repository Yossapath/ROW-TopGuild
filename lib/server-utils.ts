import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data }, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json<ApiResponse>({ ok: false, error: message }, { status });
}

export function unauthorized() {
  return err("Unauthorized", 401);
}

export function forbidden() {
  return err("Forbidden — Admin only", 403);
}
