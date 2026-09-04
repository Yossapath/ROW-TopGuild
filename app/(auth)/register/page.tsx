"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { User, Lock, ArrowRight, Layers, Swords, Zap } from "lucide-react";

const JOBS = [
  "Lord Knight", "Paladin",
  "High Wizard", "Professor",
  "Sniper", "Clown", "Gypsy",
  "High Priest", "Champion",
  "Assassin Cross", "Stalker",
  "Whitesmith", "Creator"
];

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [userClass, setUserClass] = useState(JOBS[0]);
  const [power, setPower] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await axios.post("/api/auth/register", {
        username,
        password,
        class: userClass,
        power: Number(power)
      });
      
      if (res.data.ok) {
        setSuccess("สมัครสมาชิกสำเร็จ! กำลังพากลับไปหน้าเข้าสู่ระบบ...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
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

        {/* Right Side (Register Form) */}
        <div className="w-full max-w-md lg:w-1/2">
          <div className="relative rounded-2xl bg-white p-8 shadow-2xl overflow-hidden border border-slate-100">
            {/* Top blue border effect */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>

            <div className="mb-8 mt-2">
              <h2 className="text-2xl font-black italic text-slate-800 tracking-wider uppercase">REGISTER</h2>
              <p className="text-sm text-slate-500 mt-1">สมัครสมาชิกใหม่เพื่อเข้าร่วมกิลด์</p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-600 font-bold">
                {success}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Username
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    minLength={3}
                    placeholder="username"
                    className="block w-full rounded-xl border-0 bg-slate-100 py-3 pl-11 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 transition-colors"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Class (อาชีพ)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Swords className="h-5 w-5 text-slate-400" />
                  </div>
                  <select
                    className="block w-full rounded-xl border-0 bg-slate-100 py-3 pl-11 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 transition-colors appearance-none"
                    value={userClass}
                    onChange={(e) => setUserClass(e.target.value)}
                  >
                    {JOBS.map(job => (
                      <option key={job} value={job}>{job}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Combat Power (ค่าพลัง)
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Zap className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="150000"
                    className="block w-full rounded-xl border-0 bg-slate-100 py-3 pl-11 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 transition-colors"
                    value={power}
                    onChange={(e) => setPower(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="block w-full rounded-xl border-0 bg-slate-100 py-3 pl-11 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Link href="/login" className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
                  มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-xl bg-blue-600 py-4 text-sm font-bold tracking-wider text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-70 transition-all shadow-md hover:shadow-lg uppercase mt-2"
              >
                {loading ? "กำลังสมัครสมาชิก..." : (
                  <>
                    REGISTER <ArrowRight className="ml-2 h-4 w-4" />
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
