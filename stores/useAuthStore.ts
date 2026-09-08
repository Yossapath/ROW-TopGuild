import { create } from "zustand";
import type { AuthPayload } from "@/types";

interface AuthState {
  user: AuthPayload | null;
  isAuthenticated: boolean;
  setUser: (user: AuthPayload | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
