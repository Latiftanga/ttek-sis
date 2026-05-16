"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SchoolBrief {
  id: string;
  name: string;
  slug: string;
  school_type: string;
  accent_color: string;
  logo_url?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  school_id?: string;
  is_active: boolean;
}

interface AuthState {
  user: AuthUser | null;
  school: SchoolBrief | null;
  // Access token is kept in memory only — never written to localStorage.
  // Refresh token lives in an httpOnly cookie managed by the backend.
  accessToken: string | null;
  setAuth: (user: AuthUser, school: SchoolBrief | null, access: string) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      school: null,
      accessToken: null,
      setAuth: (user, school, accessToken) => {
        set({ user, school, accessToken });
      },
      setAccessToken: (accessToken) => {
        set({ accessToken });
      },
      clearAuth: () => {
        set({ user: null, school: null, accessToken: null });
      },
    }),
    {
      name: "ttek-auth",
      // Only persist non-sensitive metadata so the app can render school
      // branding on reload. Tokens are intentionally excluded.
      partialize: (s) => ({ user: s.user, school: s.school }),
    }
  )
);
