"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import {
  useAcademicYears,
  useTerms,
  useClasses,
  useSubjects,
} from "@/lib/hooks/useAcademic";
import {
  useAssessmentCategories,
  useCreateAssessment,
} from "@/lib/hooks/useAssessments";
import { getApiError } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

const ACTOR_ROLES = new Set([
  "school_admin",
  "headteacher",
  "teacher",
]);

const formSchema = z.object({
  class_id: z.string().min(1, "Pick a class"),
  subject_id: z.string().min(1, "Pick a subject"),
  category_id: z.string().min(1, "Pick a mode"),
  term_id: z.string().min(1, "Pick a term"),
  title: z.string().trim().min(1, "Give it a title"),
  date_administered: z.string().optional(),
  max_score: z.coerce
    .number({ message: "Must be a number" })
    .positive("Must be greater than 0"),
});
type FormValues = z.infer<typeof formSchema>;

export default function NewAssessmentPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const canCreate = !!user?.role && ACTOR_ROLES.has(user.role);

  const { data: years = [], isLoading: yearsLoading } = useAcademicYears();
  const currentYear = years.find((y) => y.is_current);
  const { data: terms = [], isLoading: termsLoading } = useTerms(
    currentYear?.id ?? null,
  );
  const currentTerm = terms.find((t) => t.is_current);

  const { data: classes = [] } = useClasses(true);
  const { data: subjects = [] } = useSubjects();
  const { data: categories = [] } = useAssessmentCategories();

  const create = useCreateAssessment();

  const todayIso = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      class_id: "",
      subject_id: "",
      category_id: "",
      term_id: "",
      title: "",
      date_administered: todayIso,
      max_score: 100,
    },
  });

  // Adopt current term once it's known
  useEffect(() => {
    if (currentTerm?.id) {
      setValue("term_id", currentTerm.id, { shouldDirty: false });
    }
  }, [currentTerm?.id, setValue]);

  // When category changes, pre-fill max_score from category.max_score (decision #4)
  const selectedCategoryId = watch("category_id");
  useEffect(() => {
    if (!selectedCategoryId) return;
    const cat = categories.find((c) => c.id === selectedCategoryId);
    if (cat) {
      setValue("max_score", Number(cat.max_score), { shouldDirty: false });
    }
  }, [selectedCategoryId, categories, setValue]);

  async function onSubmit(values: FormValues) {
    try {
      const created = await create.mutateAsync({
        class_id: values.class_id,
        subject_id: values.subject_id,
        category_id: values.category_id,
        term_id: values.term_id,
        title: values.title.trim(),
        date_administered: values.date_administered || null,
        max_score: values.max_score,
      });
      toast.success(`"${created.title}" created`);
      router.push(`/assessments/${created.id}`);
    } catch (err) {
      toast.error(getApiError(err, "Could not create the assessment. Please try again."));
    }
  }

  if (yearsLoading || termsLoading) {
    return <LoadingSkeleton />;
  }

  if (!canCreate) {
    return (
      <PageShell>
        <BackLink />
        <AccessDenied />
      </PageShell>
    );
  }

  if (!currentTerm) {
    return (
      <PageShell>
        <BackLink />
        <NoTermGate />
      </PageShell>
    );
  }

  if (categories.length === 0) {
    return (
      <PageShell>
        <BackLink />
        <NoCategoriesGate isAdmin={user?.role !== "teacher"} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <BackLink />
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
        New assessment
      </h1>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            id="class_id"
            label="Class *"
            error={errors.class_id?.message}
            {...register("class_id")}
          >
            <option value="">— Select class —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            id="subject_id"
            label="Subject *"
            error={errors.subject_id?.message}
            {...register("subject_id")}
          >
            <option value="">— Select subject —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <Select
          id="category_id"
          label="Mode *"
          error={errors.category_id?.message}
          {...register("category_id")}
        >
          <option value="">— Select mode —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (weight {Number(c.weight)}%)
            </option>
          ))}
        </Select>

        <Input
          id="title"
          label="Title *"
          placeholder="e.g. Class Test 1"
          error={errors.title?.message}
          {...register("title")}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            id="term_id"
            label="Term *"
            error={errors.term_id?.message}
            {...register("term_id")}
          >
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.is_current ? " (current)" : ""}
              </option>
            ))}
          </Select>

          <Input
            id="date_administered"
            label="Date"
            type="date"
            error={errors.date_administered?.message}
            {...register("date_administered")}
          />

          <Input
            id="max_score"
            label="Max score *"
            type="number"
            min={0}
            step="0.5"
            error={errors.max_score?.message}
            {...register("max_score")}
          />
        </div>
        <p className="-mt-2 text-xs text-gray-400 dark:text-gray-500">
          Max score pre-fills from the mode default and can be overridden for
          this assessment.
        </p>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/assessments")}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Create assessment
          </Button>
        </div>
      </form>
    </PageShell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

function BackLink() {
  return (
    <Link
      href="/assessments"
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Assessments
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-8 w-48 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="h-96 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Only teachers, head teachers and school admins can create assessments.
        </p>
      </div>
    </div>
  );
}

function NoTermGate() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">
            No current term is set
          </h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            A head teacher or admin must set the current term in{" "}
            <span className="font-medium">Academic → Calendar</span> before
            assessments can be created.
          </p>
        </div>
      </div>
    </div>
  );
}

function NoCategoriesGate({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">
            No assessment modes yet
          </h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            Every assessment must belong to a mode (Class Test, Exercise,
            End of Term Exam, etc.).
          </p>
          {isAdmin ? (
            <Link
              href="/assessments/setup"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
            >
              Open Assessment setup →
            </Link>
          ) : (
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
              Ask your school admin to set assessment modes up first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
