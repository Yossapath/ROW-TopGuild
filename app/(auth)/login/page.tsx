"use client";

import { useSearchParams } from "next/navigation";
import { Layers } from "lucide-react";
import { Suspense } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="relative rounded-2xl bg-white dark:bg-[#242424] p-8 shadow-2xl overflow-hidden border border-slate-100 dark:border-[#333333] text-center">
      {/* Top blue border effect */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-[#0b3d63]"></div>

      <div className="mb-8 mt-2 flex flex-col items-center">
        <h2 className="text-2xl font-black italic text-slate-800 dark:text-white tracking-wider uppercase mb-2">LOGIN</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">เข้าสู่ระบบด้วยบัญชี Discord ของคุณ</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-600 dark:text-red-400">
          เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Discord: {error}
        </div>
      )}

      <a
        href="/api/auth/discord"
        className="flex w-full items-center justify-center rounded-xl bg-[#5865F2] py-4 text-sm font-bold tracking-wider text-white hover:bg-[#4752C4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] transition-all shadow-md hover:shadow-lg uppercase"
      >
        <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 127.14 96.36">
          <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.2,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
        </svg>
        LOGIN WITH DISCORD
      </a>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#1c1c1c]">
      <div className="flex w-full max-w-5xl mx-auto items-center justify-center p-4 lg:p-8">
        
        {/* Left Side (Branding) */}
        <div className="hidden lg:flex w-1/2 flex-col justify-center pr-12">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-[#0b3d63] text-white shadow-lg">
            <Layers size={40} />
          </div>
          <h1 className="text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-2">TOPGUILD</h1>
          <h2 className="text-4xl font-black text-blue-600 dark:text-white leading-tight">
            RAGNAROK <br />
            THE NEW WORLD
          </h2>
          <p className="mt-6 text-sm font-bold tracking-widest text-slate-500 dark:text-gray-400 uppercase">
            Guild Data Management System
          </p>
        </div>

        {/* Right Side (Login Form) */}
        <div className="w-full max-w-md lg:w-1/2">
          <Suspense fallback={<div className="text-slate-500 dark:text-slate-400">Loading...</div>}>
            <LoginForm />
          </Suspense>
        </div>

      </div>
    </div>
  );
}
