"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useUpsertTermCard } from "@/lib/hooks/useAssessments";
import { getApiError, cn } from "@/lib/utils";
import type { TermReportCard } from "@/lib/api";
import {
  SKILL_ROWS,
  RATING_LEVELS,
} from "@/components/students/ReportCardBody";
import Button from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import Textarea from "@/components/ui/Textarea";

type SkillKey =
  | "punctuality"
  | "neatness"
  | "conduct"
  | "cooperation"
  | "participation";

/**
 * Edit drawer for the soft fields on a report card: skill ratings + the
 * two remark text areas. Opens from the report card page's action bar.
 * Headteacher remark input is hidden for users who can't write to it.
 */
export default function EditTermCardDrawer({
  open,
  onClose,
  studentId,
  termId,
  termName,
  existing,
  canEditHeadteacher,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  termId: string;
  termName: string;
  existing: TermReportCard | null;
  canEditHeadteacher: boolean;
}) {
  const upsert = useUpsertTermCard(studentId);

  // Local state mirrors the saved card so the user can tweak before saving.
  const [skills, setSkills] = useState<Record<SkillKey, number | null>>({
    punctuality: null,
    neatness: null,
    conduct: null,
    cooperation: null,
    participation: null,
  });
  const [classRemark, setClassRemark] = useState("");
  const [headteacherRemark, setHeadteacherRemark] = useState("");

  // Re-hydrate from server values whenever the drawer is opened.
  useEffect(() => {
    if (!open) return;
    setSkills({
      punctuality: existing?.punctuality ?? null,
      neatness: existing?.neatness ?? null,
      conduct: existing?.conduct ?? null,
      cooperation: existing?.cooperation ?? null,
      participation: existing?.participation ?? null,
    });
    setClassRemark(existing?.class_teacher_remark ?? "");
    setHeadteacherRemark(existing?.headteacher_remark ?? "");
  }, [open, existing]);

  function setSkill(key: SkillKey, value: number) {
    setSkills((prev) => ({ ...prev, [key]: prev[key] === value ? null : value }));
  }

  async function handleSave() {
    try {
      await upsert.mutateAsync({
        term_id: termId,
        punctuality: skills.punctuality,
        neatness: skills.neatness,
        conduct: skills.conduct,
        cooperation: skills.cooperation,
        participation: skills.participation,
        class_teacher_remark: classRemark.trim() || null,
        // Only send if the user is allowed to write it; otherwise the
        // backend preserves whatever was already there.
        headteacher_remark: canEditHeadteacher
          ? headteacherRemark.trim() || null
          : undefined,
      });
      toast.success("Report card saved");
      onClose();
    } catch (err) {
      toast.error(getApiError(err, "Could not save. Please try again."));
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Edit report card — ${termName}`}
      width="lg"
    >
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            Skills & Conduct
          </h3>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Click a level to set it. Click the selected level again to clear.
          </p>
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <th className="w-1/3 px-3 py-2 text-left font-medium"></th>
                  {RATING_LEVELS.map((lvl) => (
                    <th key={lvl} className="px-3 py-2 text-center font-medium">
                      {lvl}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {SKILL_ROWS.map(({ key, label }) => {
                  const k = key as SkillKey;
                  return (
                    <tr key={k}>
                      <td className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                        {label}
                      </td>
                      {RATING_LEVELS.map((_, idx) => {
                        const value = idx + 1;
                        const selected = skills[k] === value;
                        return (
                          <td key={value} className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => setSkill(k, value)}
                              aria-label={`${label} ${RATING_LEVELS[idx]}`}
                              aria-pressed={selected}
                              className={cn(
                                "mx-auto block h-5 w-5 rounded-full border-2 transition-colors",
                                selected
                                  ? "border-[var(--brand)] bg-[var(--brand)]"
                                  : "border-gray-300 hover:border-[var(--brand)] dark:border-gray-600",
                              )}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            Remarks
          </h3>
          <div className="space-y-3">
            <Textarea
              id="tc_class"
              label="Class Teacher's Remark"
              placeholder="e.g. A diligent student who shows steady improvement."
              rows={3}
              value={classRemark}
              onChange={(e) => setClassRemark(e.target.value)}
            />
            {canEditHeadteacher ? (
              <Textarea
                id="tc_head"
                label="Headteacher's Remark"
                placeholder="e.g. Keep up the good work."
                rows={3}
                value={headteacherRemark}
                onChange={(e) => setHeadteacherRemark(e.target.value)}
              />
            ) : (
              <p className="text-xs italic text-gray-400">
                Only headteachers and admins can write the headteacher&apos;s
                remark.
              </p>
            )}
          </div>
        </section>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={upsert.isPending}>
            Save report card
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
