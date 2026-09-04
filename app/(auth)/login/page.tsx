"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";
import Link from "next/link";
import { User, Lock, ArrowRight, Layers } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await axios.post("/api/auth", { action: "login", username, password });
      if (res.data.ok) {
        setUser(res.data.data.user);
        router.push("/dashboard");
      }
    } catch (err: any) {
      let errorMsg = err.response?.data?.error || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
      if (errorMsg.includes("Could not load the default credentials")) {
        errorMsg = "ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล (กรุณาตั้งค่า Firebase ใน Vercel)";
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="flex w-full max-w-5xl mx-auto items-center justify-center p-4 lg:p-8">
        
        {/* Left Side (Branding) */}
        <div className="hidden lg:flex w-1/2 flex-col justify-center pr-12">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
            <Layers size={40} />
          </div>
          <h1 className="text-5xl font-black tracking-tight text-slate-900 mb-2">TOPGUILD</h1>
          <h2 className="text-4xl font-black text-blue-600 leading-tight">
            RAGNAROK <br />
            THE NEW WORLD
          </h2>
          <p className="mt-6 text-sm font-bold tracking-widest text-slate-500 uppercase">
            Guild Data Management System
          </p>
        </div>

        {/* Right Side (Login Form) */}
        <div className="w-full max-w-md lg:w-1/2">
          <div className="relative rounded-2xl bg-white p-8 shadow-2xl overflow-hidden border border-slate-100">
            {/* Top blue border effect */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>

            <div className="mb-8 mt-2">
              <h2 className="text-2xl font-black italic text-slate-800 tracking-wider uppercase">LOGIN</h2>
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  User
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="username"
                    className="block w-full rounded-xl border-0 bg-slate-100 py-3.5 pl-11 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 transition-colors"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="block w-full rounded-xl border-0 bg-slate-100 py-3.5 pl-11 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Link href="/register" className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                  สมัครสมาชิกใหม่
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-xl bg-blue-600 py-4 text-sm font-bold tracking-wider text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-70 transition-all shadow-md hover:shadow-lg uppercase"
              >
                {loading ? "กำลังเข้าสู่ระบบ..." : (
                  <>
                    LOGIN <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
