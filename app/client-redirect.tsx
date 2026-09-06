"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import Link from "next/link";
import { Shield, Swords, LogIn } from "lucide-react";

export default function ClientRedirect() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard/roster");
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full p-8 rounded-2xl bg-theme-surface border border-theme-border shadow-xl flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-primary/20 border border-brand-primary/40 flex items-center justify-center text-brand-secondary mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-theme-textHi mb-2">TopGuild</h1>
        <p className="text-sm text-theme-textLo mb-6">
          ระบบจัดการสมาชิกกิลด์ จัดทีมสนามหลัก-สนามรอง จองคิวดันเจี้ยน
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link
            href="/login"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-primary text-white font-medium hover:bg-brand-primary/90 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            เข้าสู่ระบบ
          </Link>
          <Link
            href="/booking"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-theme-hover border border-theme-border text-theme-text font-medium hover:bg-theme-border transition-colors"
          >
            <Swords className="w-4 h-4" />
            จองคิวดันเจี้ยน
          </Link>
        </div>
      </div>
    </div>
  );
}
