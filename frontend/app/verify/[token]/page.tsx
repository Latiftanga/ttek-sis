"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, Printer } from "lucide-react";
import { verifyApi, type VerifyReportResponse } from "@/lib/api";
import Button from "@/components/ui/Button";
import ReportCardBody from "@/components/students/ReportCardBody";

/**
 * Public report-card verifier. Anyone who scans the QR code on a printed
 * card lands here — no auth required. Renders the same beautiful card body
 * the school sees, with a "Verified by …" banner.
 */
export default function VerifyPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [data, setData] = useState<VerifyReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Plain fetch (not react-query) — keeps this page lean and standalone so
  // it doesn't drag in the dashboard's auth-aware QueryClient.
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    verifyApi
      .getReport(token)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ?? "Could not verify this report card.";
        setError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-dvh bg-gray-50 print:bg-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Verification banner — hidden on print */}
        <div className="mb-4 print:hidden">
          {error ? (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <p className="font-semibold text-rose-900">
                  Could not verify this report card
                </p>
                <p className="mt-0.5 text-sm text-rose-700">{error}</p>
                <p className="mt-2 text-xs text-rose-600">
                  The QR may have been mistyped, the card may have been altered,
                  or the school may have revoked it.
                </p>
              </div>
            </div>
          ) : data ? (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">
                    Verified authentic
                  </p>
                  <p className="mt-0.5 text-sm text-emerald-700">
                    Issued by{" "}
                    <span className="font-semibold">{data.school.name}</span>{" "}
                    · {data.report.term_name}, {data.report.academic_year}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => window.print()}
                size="sm"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
              Verifying…
            </div>
          )}
        </div>

        {/* The card itself */}
        {data && (
          <ReportCardBody
            report={data.report}
            school={data.school}
            subjects={data.breakdown.subjects}
            showBreakdownToggle
            verificationUrl={
              typeof window !== "undefined"
                ? `${window.location.origin}/verify/${token}`
                : null
            }
          />
        )}

        {/* Branding footer — hidden on print */}
        <p className="mt-6 text-center text-xs text-gray-400 print:hidden">
          Verification powered by{" "}
          <Link href="/" className="font-medium text-gray-500 hover:underline">
            TTEK-SIS
          </Link>
        </p>
      </div>
    </div>
  );
}
