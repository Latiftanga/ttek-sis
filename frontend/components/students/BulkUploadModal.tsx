"use client";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Upload, FileSpreadsheet, Download, CheckCircle2, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { studentsApi } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface UploadError {
  row: number;
  data: { student_number: string; name: string };
  errors: string[];
}

interface UploadResult {
  imported: number;
  skipped: number;
  errors: UploadError[];
  message: string;
}

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
}

export default function BulkUploadModal({ open, onClose }: BulkUploadModalProps) {
  const qc = useQueryClient();
  const school = useAuthStore((s) => s.school);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  function handleClose() {
    setSelectedFile(null);
    setResult(null);
    onClose();
  }

  function handleFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    setSelectedFile(file);
    setResult(null);
  }

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      const res = await studentsApi.downloadTemplate();
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${school?.slug ?? "school"}_student_import.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download template");
    } finally {
      setDownloading(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const data = await studentsApi.bulkUpload(selectedFile);
      setResult(data as UploadResult);
      // reset input so the same file can be re-uploaded after fixing errors
      if (fileInputRef.current) fileInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: [school?.slug, "students"] });
      if ((data as UploadResult).imported > 0) {
        toast.success((data as UploadResult).message);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Bulk Upload Students" size="lg">
      <div className="space-y-5">
        {/* template download */}
        <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-950/40">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-200">
              Use the school-branded template
            </p>
            <p className="mt-0.5 text-blue-600 dark:text-blue-400">
              Download the template with your school&rsquo;s class and house
              dropdowns pre-filled.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={downloading}
            onClick={handleDownloadTemplate}
          >
            <Download className="h-4 w-4" />
            Template
          </Button>
        </div>

        {/* drop zone */}
        {!result && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Select Excel file"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            className={cn(
              "cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors",
              dragging
                ? "border-[var(--brand)] bg-[var(--brand)]/5"
                : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600",
              selectedFile && "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {selectedFile ? (
              <>
                <FileSpreadsheet className="mx-auto h-10 w-10 text-emerald-500" />
                <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {selectedFile.name}
                </p>
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                  {(selectedFile.size / 1024).toFixed(1)} KB — click to change
                </p>
              </>
            ) : (
              <>
                <Upload className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Drop your Excel file here
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  or click to browse — .xlsx / .xls
                </p>
              </>
            )}
          </div>
        )}

        {/* result */}
        {result && (
          <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {result.imported} student{result.imported !== 1 ? "s" : ""} imported
                </p>
                {result.skipped > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {result.skipped} row{result.skipped !== 1 ? "s" : ""} skipped
                  </p>
                )}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Skipped rows:
                </p>
                {result.errors.map((e) => (
                  <div
                    key={e.row}
                    className="flex items-start gap-2 rounded bg-red-50 p-2 dark:bg-red-950/30"
                  >
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <div className="text-xs">
                      <span className="font-medium text-red-700 dark:text-red-300">
                        Row {e.row}: {e.data.name} ({e.data.student_number})
                      </span>
                      <ul className="mt-0.5 list-disc pl-4 text-red-600 dark:text-red-400">
                        {e.errors.map((msg, i) => (
                          <li key={i}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setResult(null); setSelectedFile(null); }}
            >
              Upload another file
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button variant="secondary" onClick={handleClose}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && (
            <Button
              onClick={handleUpload}
              loading={uploading}
              disabled={!selectedFile}
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
