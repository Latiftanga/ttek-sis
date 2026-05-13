"use client";
import { useRef, useState } from "react";
import { Camera, X, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  value?: string | null;
  initials?: string;
  onChange: (dataUrl: string | null) => void;
  onFile?: (file: File) => void;
  size?: "sm" | "md" | "lg";
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        // 128px covers 2× retina for the largest display (64px CSS); ~8–12 KB as base64
        const MAX = 128;
        let { width, height } = img;
        if (width > height) {
          if (width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
        } else {
          if (height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const sizes = {
  sm: { wrap: "h-14 w-14", text: "text-base", icon: "h-3.5 w-3.5" },
  md: { wrap: "h-20 w-20", text: "text-xl",   icon: "h-4 w-4"     },
  lg: { wrap: "h-24 w-24", text: "text-2xl",   icon: "h-4 w-4"     },
};

export default function AvatarUpload({
  value,
  initials = "?",
  onChange,
  onFile,
  size = "md",
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      onChange(dataUrl);   // instant preview
      onFile?.(file);      // trigger upload in parent
    } catch {
      toast.error("Could not process image — try a different file");
    }
  }

  const s = sizes[size];

  return (
    <div className="flex items-end gap-3">
      {/* avatar circle */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload student photo"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className={cn(
          "relative cursor-pointer overflow-hidden rounded-2xl",
          s.wrap,
          dragging
            ? "ring-2 ring-[var(--brand)] ring-offset-2"
            : "ring-2 ring-gray-200 dark:ring-gray-700"
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Student photo"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--brand)]/10">
            <span className={cn("font-bold text-[var(--brand)]", s.text)}>
              {initials}
            </span>
          </div>
        )}

        {/* hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
          <Camera className={cn("text-white", s.icon)} />
        </div>
      </div>

      {/* side actions */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Upload className="h-3.5 w-3.5" />
          {value ? "Change photo" : "Upload photo"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-red-950/40"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
        <p className="text-[10px] leading-tight text-gray-400">
          JPG, PNG or WebP · max 5 MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // reset so same file can be re-selected
          e.target.value = "";
        }}
      />
    </div>
  );
}
