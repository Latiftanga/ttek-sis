import axios from "axios";
import { useAuthStore } from "@/lib/store";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true, // send the httpOnly refresh_token cookie on every request
});

// Attach the in-memory access token to each request.
// Tokens are never written to localStorage — the store holds them in memory only.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function redirectToLogin() {
  useAuthStore.getState().clearAuth();
  window.location.href = "/login";
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        // Refresh token is sent automatically via the httpOnly cookie.
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        useAuthStore.getState().setAccessToken(data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        redirectToLogin();
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),
  refresh: () =>
    axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true }).then((r) => r.data),
  logout: () =>
    axios.post(`${BASE_URL}/auth/logout`, {}, { withCredentials: true }).catch(() => {}),
  me: () => api.get("/me").then((r) => r.data),
};

// ── Students ────────────────────────────────────────────────────────────
export interface BulkUploadResult {
  imported: number;
  skipped: number;
  errors: { row: number; data: { student_number: string; name: string }; errors: string[] }[];
  message: string;
}

export const studentsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get("/students/", { params }).then((r) => r.data),
  get: (id: string) => api.get(`/students/${id}`).then((r) => r.data),
  create: (body: unknown) =>
    api.post("/students/", body).then((r) => r.data),
  update: (id: string, body: unknown) =>
    api.patch(`/students/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/students/${id}`),
  addContact: (studentId: string, body: unknown) =>
    api.post(`/students/${studentId}/contacts`, body).then((r) => r.data),
  enablePortal: (id: string) =>
    api.post(`/students/${id}/enable-portal`).then((r) => r.data),
  disablePortal: (id: string) =>
    api.post(`/students/${id}/disable-portal`).then((r) => r.data),
  resetPin: (id: string) =>
    api.post(`/students/${id}/reset-pin`).then((r) => r.data),
  downloadTemplate: () =>
    api.get("/students/upload/template", { responseType: "blob" }),
  bulkUpload: (file: File, params?: Record<string, string>): Promise<BulkUploadResult> => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post("/students/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        params,
      })
      .then((r) => r.data);
  },
};

// ── Staff ────────────────────────────────────────────────────────────────
export interface InviteResult {
  temp_password?: string;
}

export interface CreateStaffResult {
  temp_password?: string | null;
  [key: string]: unknown;
}

export const uploadApi = {
  photo: (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/upload/photo", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
};

export interface StaffBulkUploadResult {
  imported: number;
  skipped: number;
  errors: { row: number; data: { staff_number: string; name: string }; errors: string[] }[];
  message: string;
}

export const staffApi = {
  list: (params?: Record<string, string | number>) =>
    api.get("/staff/", { params }).then((r) => r.data),
  get: (id: string) => api.get(`/staff/${id}`).then((r) => r.data),
  create: (body: unknown): Promise<CreateStaffResult> =>
    api.post("/staff/", body).then((r) => r.data),
  update: (id: string, body: unknown) =>
    api.patch(`/staff/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/staff/${id}`),
  invite: (id: string, body: unknown): Promise<InviteResult> =>
    api.post(`/staff/${id}/invite`, body).then((r) => r.data),
  toggleAccount: (id: string) =>
    api.post(`/staff/${id}/toggle-account`).then((r) => r.data),
  // qualifications
  addQualification: (staffId: string, body: unknown) =>
    api.post(`/staff/${staffId}/qualifications`, body).then((r) => r.data),
  removeQualification: (staffId: string, qualId: string) =>
    api.delete(`/staff/${staffId}/qualifications/${qualId}`),
  // promotions
  addPromotion: (staffId: string, body: unknown) =>
    api.post(`/staff/${staffId}/promotions`, body).then((r) => r.data),
  removePromotion: (staffId: string, promoId: string) =>
    api.delete(`/staff/${staffId}/promotions/${promoId}`),
  // GES rank catalogue
  gesRanks: () => api.get("/staff/ges-ranks").then((r) => r.data),
  // bulk upload
  downloadTemplate: () =>
    api.get("/staff/upload/template", { responseType: "blob" }),
  bulkUpload: (file: File): Promise<StaffBulkUploadResult> => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post("/staff/upload", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
};

// ── School ──────────────────────────────────────────────────────────────

export interface SchoolProfile {
  id: string;
  name: string;
  slug: string;
  school_type: string;
  region: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  accent_color: string;
  subscription: string;
}

export interface SchoolPeriod {
  id: string;
  school_id: string;
  name: string;
  start_time: string;
  end_time: string;
  order: number;
  is_break: boolean;
  is_active: boolean;
}

export const schoolApi = {
  getProfile: (): Promise<SchoolProfile> =>
    api.get("/school/profile").then((r) => r.data),
  updateProfile: (body: Partial<Omit<SchoolProfile, "id" | "slug" | "subscription">>): Promise<SchoolProfile> =>
    api.patch("/school/profile", body).then((r) => r.data),
  listProgrammes: (ownOnly = false): Promise<{ id: string; name: string; short_name: string | null; description: string | null }[]> =>
    api.get("/school/programmes", { params: ownOnly ? { own_only: true } : {} }).then((r) => r.data),
  createProgramme: (body: { name: string; short_name: string; description?: string; order?: number }) =>
    api.post("/school/programmes", body).then((r) => r.data),
  updateProgramme: (id: string, body: { name?: string; short_name?: string; description?: string; order?: number }) =>
    api.patch(`/school/programmes/${id}`, body).then((r) => r.data),
  deleteProgramme: (id: string) =>
    api.delete(`/school/programmes/${id}`),
  listHouses: (): Promise<{ id: string; name: string; color: string | null }[]> =>
    api.get("/school/houses").then((r) => r.data),
  createHouse: (body: { name: string; color?: string; order?: number }) =>
    api.post("/school/houses", body).then((r) => r.data),
  updateHouse: (id: string, body: { name?: string; color?: string; order?: number }) =>
    api.patch(`/school/houses/${id}`, body).then((r) => r.data),
  deleteHouse: (id: string) =>
    api.delete(`/school/houses/${id}`),
};

// ── Academic request body types ─────────────────────────────────────────
export interface AcademicYearCreate {
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}

export interface AcademicYearUpdate {
  name?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
}

export interface TermCreate {
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}

export interface TermUpdate {
  name?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
}

export interface ClassCreate {
  level_group: string;
  level_number?: number | null;
  stream?: string | null;
  programme?: string | null;
  class_teacher_id?: string | null;
  capacity?: number;
}

export interface ClassUpdate {
  class_teacher_id?: string | null;
  capacity?: number;
  is_active?: boolean;
}

export interface SubjectCreate {
  name: string;
  code?: string | null;
  category?: string | null;
}

export interface SubjectUpdate {
  name?: string;
  code?: string | null;
  category?: string | null;
}

export interface EnrollmentCreate {
  student_id: string;
  class_id: string;
  academic_year_id: string;
  start_date: string;
  is_boarding?: boolean;
  notes?: string | null;
}

export interface PromoteRequest {
  to_class_id: string;
  academic_year_id: string;
  start_date: string;
  notes?: string | null;
}

export interface RepeatRequest {
  academic_year_id: string;
  start_date: string;
  notes?: string | null;
}

export interface TransferRequest {
  end_date: string;
  notes?: string | null;
}

export interface GraduateRequest {
  end_date: string;
  notes?: string | null;
}

export interface DemoteRequest {
  to_class_id: string;
  academic_year_id: string;
  start_date: string;
  notes?: string | null;
}

export interface BulkPromoteRequest {
  from_class_id: string;
  to_class_id: string;
  academic_year_id: string;
  start_date: string;
  exclude_student_ids?: string[];
}

export interface ClassSubjectCreate {
  subject_id: string;
  teacher_id?: string | null;
  order?: number;
}

export interface ClassSubjectUpdate {
  teacher_id?: string | null;
  order?: number;
}

// ── Academic ────────────────────────────────────────────────────────────
export const academicApi = {
  listYears: () => api.get("/academic-years").then((r) => r.data),
  createYear: (body: AcademicYearCreate) =>
    api.post("/academic-years", body).then((r) => r.data),
  updateYear: (id: string, body: AcademicYearUpdate) =>
    api.patch(`/academic-years/${id}`, body).then((r) => r.data),
  setCurrentYear: (id: string) =>
    api.post(`/academic-years/${id}/set-current`).then((r) => r.data),
  listTerms: (yearId: string) =>
    api.get(`/academic-years/${yearId}/terms`).then((r) => r.data),
  createTerm: (yearId: string, body: TermCreate) =>
    api.post(`/academic-years/${yearId}/terms`, body).then((r) => r.data),
  updateTerm: (termId: string, body: TermUpdate) =>
    api.patch(`/terms/${termId}`, body).then((r) => r.data),
  setCurrentTerm: (termId: string) =>
    api.post(`/terms/${termId}/set-current`).then((r) => r.data),
  listClasses: (params?: Record<string, string | boolean | null>) =>
    api.get("/classes", { params }).then((r) => r.data),
  getClass: (classId: string) =>
    api.get(`/classes/${classId}`).then((r) => r.data),
  createClass: (body: ClassCreate) =>
    api.post("/classes", body).then((r) => r.data),
  updateClass: (classId: string, body: ClassUpdate) =>
    api.patch(`/classes/${classId}`, body).then((r) => r.data),
  getClassStudents: (classId: string, yearId?: string) =>
    api
      .get(`/classes/${classId}/students`, {
        params: yearId ? { academic_year_id: yearId } : {},
      })
      .then((r) => r.data),
  listSubjects: (params?: Record<string, string>) =>
    api.get("/subjects", { params }).then((r) => r.data),
  createSubject: (body: SubjectCreate) =>
    api.post("/subjects", body).then((r) => r.data),
  updateSubject: (id: string, body: SubjectUpdate) =>
    api.patch(`/subjects/${id}`, body).then((r) => r.data),
  deleteSubject: (id: string) => api.delete(`/subjects/${id}`),
  // Enrollment
  enroll: (body: EnrollmentCreate) =>
    api.post("/enrollments", body).then((r) => r.data),
  promoteStudent: (enrollmentId: string, body: PromoteRequest) =>
    api.patch(`/enrollments/${enrollmentId}/promote`, body).then((r) => r.data),
  repeatStudent: (enrollmentId: string, body: RepeatRequest) =>
    api.patch(`/enrollments/${enrollmentId}/repeat`, body).then((r) => r.data),
  transferStudent: (enrollmentId: string, body: TransferRequest) =>
    api.patch(`/enrollments/${enrollmentId}/transfer`, body).then((r) => r.data),
  graduateStudent: (enrollmentId: string, body: GraduateRequest) =>
    api.patch(`/enrollments/${enrollmentId}/graduate`, body).then((r) => r.data),
  demoteStudent: (enrollmentId: string, body: DemoteRequest) =>
    api.patch(`/enrollments/${enrollmentId}/demote`, body).then((r) => r.data),
  unenroll: (enrollmentId: string) =>
    api.delete(`/enrollments/${enrollmentId}`),
  bulkPromote: (body: BulkPromoteRequest) =>
    api.post("/enrollments/bulk-promote", body).then((r) => r.data),
  // Student elective subject selections
  listStudentSubjects: (enrollmentId: string) =>
    api.get(`/enrollments/${enrollmentId}/subjects`).then((r) => r.data),
  setStudentSubjects: (enrollmentId: string, subjectIds: string[]) =>
    api.post(`/enrollments/${enrollmentId}/subjects/bulk`, { subject_ids: subjectIds }).then((r) => r.data),
  // Subject-centric elective enrollment
  listSubjectEnrollments: (classId: string, subjectId: string) =>
    api.get(`/classes/${classId}/subjects/${subjectId}/enrollments`).then((r) => r.data),
  setSubjectEnrollments: (classId: string, subjectId: string, enrollmentIds: string[]) =>
    api.post(`/classes/${classId}/subjects/${subjectId}/enrollments/bulk`, { enrollment_ids: enrollmentIds }).then((r) => r.data),
  // Class subjects (curriculum + teacher per class)
  listClassSubjects: (classId: string) =>
    api.get(`/classes/${classId}/subjects`).then((r) => r.data),
  addClassSubject: (classId: string, body: ClassSubjectCreate) =>
    api.post(`/classes/${classId}/subjects`, body).then((r) => r.data),
  updateClassSubject: (classId: string, csId: string, body: ClassSubjectUpdate) =>
    api.patch(`/classes/${classId}/subjects/${csId}`, body).then((r) => r.data),
  removeClassSubject: (classId: string, csId: string) =>
    api.delete(`/classes/${classId}/subjects/${csId}`),
};

// ── Attendance ─────────────────────────────────────────────────────────
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  id: string;
  school_id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  reason: string | null;
  recorded_by: string;
  recorded_at: string;
  is_edited: boolean;
  original_status: AttendanceStatus | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
  edit_reason: string | null;
}

export interface AttendanceSession {
  id: string;
  school_id: string;
  class_id: string;
  term_id: string;
  teacher_id: string;
  subject_id: string | null;
  period_id: string | null;
  session_type: "daily" | "lesson";
  date: string;
  status: "open" | "submitted" | "cancelled";
  client_opened_at: string;
  server_synced_at: string;
  submitted_at: string | null;
  sync_mode: "online" | "offline";
  sync_gap_seconds: number | null;
  is_flagged: boolean;
  flag_reason: string | null;
  review_outcome: "cleared" | "penalised" | null;
  created_at: string;
}

export interface ClassAttendanceSummary {
  class_id: string;
  class_name: string;
  date: string;
  total_students: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  not_marked: number;
  session_id: string | null;
  session_status: "open" | "submitted" | null;
}

export interface SchoolAttendanceToday {
  date: string;
  total_classes: number;
  sessions_submitted: number;
  sessions_open: number;
  sessions_not_started: number;
  flagged_sessions: number;
}

export interface SessionCreateBody {
  class_id: string;
  term_id: string;
  session_type: "daily" | "lesson";
  date: string;            // YYYY-MM-DD
  client_opened_at: string; // ISO datetime
  subject_id?: string;
  period_id?: string;
  client_id?: string;
}

export interface AttendanceRecordInput {
  student_id: string;
  status: AttendanceStatus;
  reason?: string | null;
}

export interface SessionSubmitBody {
  client_submitted_at: string;
  records: AttendanceRecordInput[];
}

export interface RecordEditBody {
  status: AttendanceStatus;
  reason?: string | null;
  edit_reason: string;
}

export interface FlaggedSessionBrief {
  session_id: string;
  class_id: string;
  date: string;
  teacher_id: string;
  flag_reason: string | null;
}

export interface AttendanceAlertsResponse {
  flagged_sessions: FlaggedSessionBrief[];
  threshold_pct: number;
  term_id: string;
  note: string;
}

export const attendanceApi = {
  listPeriods: (): Promise<SchoolPeriod[]> =>
    api.get("/attendance/periods").then((r) => r.data),
  createPeriod: (body: { name: string; start_time: string; end_time: string; order: number; is_break?: boolean }): Promise<SchoolPeriod> =>
    api.post("/attendance/periods", body).then((r) => r.data),
  updatePeriod: (id: string, body: { name?: string; start_time?: string; end_time?: string; order?: number; is_break?: boolean; is_active?: boolean }): Promise<SchoolPeriod> =>
    api.patch(`/attendance/periods/${id}`, body).then((r) => r.data),
  deletePeriod: (id: string) =>
    api.delete(`/attendance/periods/${id}`),
  createSession: (body: SessionCreateBody): Promise<AttendanceSession> =>
    api.post("/attendance/sessions", body).then((r) => r.data),
  submitSession: (sessionId: string, body: SessionSubmitBody): Promise<AttendanceSession> =>
    api.post(`/attendance/sessions/${sessionId}/submit`, body).then((r) => r.data),
  listSessions: (params?: Record<string, string>): Promise<AttendanceSession[]> =>
    api.get("/attendance/sessions", { params }).then((r) => r.data),
  listRecords: (sessionId: string): Promise<AttendanceRecord[]> =>
    api.get(`/attendance/sessions/${sessionId}/records`).then((r) => r.data),
  patchRecord: (recordId: string, body: RecordEditBody): Promise<AttendanceRecord> =>
    api.patch(`/attendance/records/${recordId}`, body).then((r) => r.data),
  getTodayForClass: (classId: string): Promise<ClassAttendanceSummary> =>
    api.get(`/attendance/class/${classId}/today`).then((r) => r.data),
  getSchoolToday: (): Promise<SchoolAttendanceToday> =>
    api.get("/attendance/today").then((r) => r.data),
  getAlerts: (): Promise<AttendanceAlertsResponse> =>
    api.get("/attendance/alerts").then((r) => r.data),
  getClassSummary: (classId: string, params?: Record<string, string>) =>
    api
      .get(`/attendance/summary/class/${classId}`, { params })
      .then((r) => r.data),
};

// ── Assessments ─────────────────────────────────────────────────────────
// "Assessment" is the term used in Ghanaian schools for tests/exercises/exams.
// "Grade" is reserved for the letter (A, B, C, F9) assigned by a grading scale.

export interface AssessmentCategory {
  id: string;
  school_id: string;
  name: string;
  weight: number;
  max_score: number;
  is_ca: boolean;
  allows_multiple: boolean;
  order: number;
  is_active: boolean;
  created_at: string;
}

export interface Assessment {
  id: string;
  school_id: string;
  category_id: string;
  class_id: string;
  subject_id: string;
  term_id: string;
  description: string | null;
  date_administered: string | null;
  max_score: number;
  is_published: boolean;
  created_by: string;
  created_at: string;
}

export interface AssessmentCreateBody {
  category_id: string;
  class_id: string;
  subject_id: string;
  term_id: string;
  description?: string | null;
  date_administered?: string | null;
  max_score: number;
}

export interface AssessmentUpdateBody {
  description?: string | null;
  date_administered?: string | null;
  max_score?: number;
}

export interface GradingBand {
  id: string;
  min_score: number;
  max_score: number;
  grade_label: string;
  remark: string | null;
  order: number;
}

export interface GradingScale {
  id: string;
  school_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  bands: GradingBand[];
}

export interface GradebookEntry {
  student_id: string;
  student_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  score: number | null;
  is_absent: boolean;
  remarks: string | null;
  is_edited: boolean;
  score_id: string | null;
}

export interface GradebookResponse {
  assessment: Assessment;
  entries: GradebookEntry[];
  total_students: number;
  scores_entered: number;
  scores_missing: number;
}

export interface ScoreInput {
  student_id: string;
  score?: number | null;
  is_absent?: boolean;
  remarks?: string | null;
}

export interface BulkScoreBody {
  records: ScoreInput[];
  client_id?: string;
}

export interface ScoreEditBody {
  score?: number | null;
  is_absent?: boolean;
  remarks?: string | null;
  reason?: string | null;
}

export interface ScoreEditLog {
  id: string;
  assessment_score_id: string;
  changed_by: string;
  changed_at: string;
  old_score: number | null;
  new_score: number | null;
  reason: string | null;
  is_after_submission: boolean;
  is_after_lock: boolean;
}

export const assessmentsApi = {
  listScales: (): Promise<GradingScale[]> =>
    api.get("/assessments/grading-scales").then((r) => r.data),

  listCategories: (params?: Record<string, string>): Promise<AssessmentCategory[]> =>
    api.get("/assessments/categories", { params }).then((r) => r.data),
  createCategory: (body: unknown): Promise<AssessmentCategory> =>
    api.post("/assessments/categories", body).then((r) => r.data),
  updateCategory: (id: string, body: unknown): Promise<AssessmentCategory> =>
    api.patch(`/assessments/categories/${id}`, body).then((r) => r.data),
  deleteCategory: (id: string): Promise<void> =>
    api.delete(`/assessments/categories/${id}`).then(() => undefined),

  createScale: (body: { name: string; description?: string }): Promise<GradingScale> =>
    api.post("/assessments/grading-scales", body).then((r) => r.data),
  addBand: (
    scaleId: string,
    body: {
      min_score: number;
      max_score: number;
      grade_label: string;
      remark?: string;
      order: number;
    },
  ): Promise<GradingBand> =>
    api
      .post(`/assessments/grading-scales/${scaleId}/bands`, body)
      .then((r) => r.data),

  list: (params?: Record<string, string>): Promise<Assessment[]> =>
    api.get("/assessments/", { params }).then((r) => r.data),
  create: (body: AssessmentCreateBody): Promise<Assessment> =>
    api.post("/assessments/", body).then((r) => r.data),
  update: (id: string, body: AssessmentUpdateBody): Promise<Assessment> =>
    api.patch(`/assessments/${id}`, body).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/assessments/${id}`).then(() => undefined),
  publish: (id: string): Promise<Assessment> =>
    api.post(`/assessments/${id}/publish`).then((r) => r.data),
  unpublish: (id: string): Promise<Assessment> =>
    api.post(`/assessments/${id}/unpublish`).then((r) => r.data),

  getGradebook: (id: string): Promise<GradebookResponse> =>
    api.get(`/assessments/${id}/gradebook`).then((r) => r.data),
  bulkScore: (id: string, body: BulkScoreBody) =>
    api.post(`/assessments/${id}/scores`, body).then((r) => r.data),
  editScore: (id: string, studentId: string, body: ScoreEditBody) =>
    api.patch(`/assessments/${id}/scores/${studentId}`, body).then((r) => r.data),
  getScoreHistory: (id: string, studentId: string): Promise<ScoreEditLog[]> =>
    api.get(`/assessments/${id}/scores/${studentId}/history`).then((r) => r.data),
};

