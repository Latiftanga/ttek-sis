"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileQuestion, ArrowLeft, LayoutDashboard } from "lucide-react";
import Button from "@/components/ui/Button";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
        <FileQuestion className="h-10 w-10 text-gray-400 dark:text-gray-500" />
      </div>

      <div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">404</h1>
        <p className="mt-2 text-base text-gray-500 dark:text-gray-400">
          This page doesn&rsquo;t exist or hasn&rsquo;t been built yet.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go back
        </Button>
        <Link href="/dashboard">
          <Button>
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
