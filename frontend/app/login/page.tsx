"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { getApiError } from "@/lib/utils";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/layout/ThemeToggle";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await authApi.login(data.email, data.password);
      setAuth(res.user, res.school, res.access_token, res.refresh_token);
      router.replace("/dashboard");
    } catch (err: unknown) {
      toast.error(getApiError(err, "Login failed. Check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Left branding panel — desktop only */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex lg:w-1/2"
        style={{
          background:
            "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 55%, black))",
        }}
      >
        {/* Decorative blobs */}
        <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute bottom-32 left-8 h-40 w-40 rounded-full bg-white/5" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-xl font-bold shadow-lg backdrop-blur-sm">
            T
          </div>
          <div>
            <p className="text-lg font-bold">TTEK-SIS</p>
            <p className="text-xs text-emerald-200">Tagnatek</p>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative">
          <h2 className="text-3xl font-bold leading-snug">
            Manage your school <br />
            <span className="text-emerald-200">with confidence.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-emerald-100">
            Students, attendance, grades, and academic records — all in one
            place. Built for Ghanaian schools.
          </p>

          {/* Feature list */}
          <ul className="mt-6 space-y-2 text-sm text-emerald-100">
            {[
              "Student enrolment & records",
              "Attendance tracking",
              "Gradebook & assessments",
              "Multi-role access control",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px]">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-emerald-300">
          &copy; {new Date().getFullYear()} Tagnatek. All rights reserved.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col">
        {/* Theme toggle (top-right) */}
        <div className="flex justify-end p-4">
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="mb-8 text-center lg:hidden">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg" style={{ backgroundColor: "var(--brand)" }}>
                T
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                TTEK-SIS
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Tagnatek Student Information System
              </p>
            </div>

            {/* Desktop heading */}
            <div className="mb-8 hidden lg:block">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome back
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Sign in to your school account to continue.
              </p>
            </div>

            {/* Form card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  id="email"
                  label="Email address"
                  type="email"
                  placeholder="you@school.edu.gh"
                  autoComplete="email"
                  error={errors.email?.message}
                  {...register("email")}
                />
                <Input
                  id="password"
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  error={errors.password?.message}
                  {...register("password")}
                />
                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Sign in
                </Button>
              </form>
              <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
                Forgot your password? Please contact your school administrator.
              </p>
            </div>

            <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-600">
              Tagnatek Student Information System &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
