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
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (
    user: AuthUser,
    school: SchoolBrief | null,
    access: string,
    refresh: string
  ) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      school: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, school, accessToken, refreshToken) => {
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        set({ user, school, accessToken, refreshToken });
      },
      clearAuth: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, school: null, accessToken: null, refreshToken: null });
      },
    }),
    {
      name: "ttek-auth",
      partialize: (s) => ({
        user: s.user,
        school: s.school,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
    }
  )
);
