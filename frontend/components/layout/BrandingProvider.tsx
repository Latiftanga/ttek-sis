"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import { DEFAULT_BRAND } from "@/lib/branding";

/**
 * Reads school.accent_color from the auth store and writes it to the
 * --brand CSS custom property on <html>. All brand-colored elements
 * consume var(--brand) so they automatically update when the school changes.
 */
export default function BrandingProvider() {
  const school = useAuthStore((s) => s.school);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--brand",
      school?.accent_color ?? DEFAULT_BRAND
    );
  }, [school?.accent_color]);

  useEffect(() => {
    if (school?.name) {
      document.title = `${school.name} — TTEK-SIS`;
    }
  }, [school?.name]);

  return null;
}
