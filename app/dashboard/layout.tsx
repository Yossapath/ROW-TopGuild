"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import Sidebar from "@/components/Sidebar";
import TopHeader from "@/components/TopHeader";
import CompleteProfilePopup from "@/components/CompleteProfilePopup";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  if (!mounted) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-theme-bg text-theme-text overflow-hidden transition-colors duration-300">
      <Sidebar isExpanded={isSidebarExpanded} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopHeader 
          isSidebarExpanded={isSidebarExpanded} 
          toggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)} 
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
      <CompleteProfilePopup />
    </div>
  );
}
