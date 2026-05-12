import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
            refresh_token: refresh,
          });
          localStorage.setItem("access_token", data.access_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      } else {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((r) => r.data),
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

// ── Academic ────────────────────────────────────────────────────────────
export const academicApi = {
  listYears: () => api.get("/academic-years").then((r) => r.data),
  createYear: (body: unknown) =>
    api.post("/academic-years", body).then((r) => r.data),
  updateYear: (id: string, body: unknown) =>
    api.patch(`/academic-years/${id}`, body).then((r) => r.data),
  setCurrentYear: (id: string) =>
    api.post(`/academic-years/${id}/set-current`).then((r) => r.data),
  listTerms: (yearId: string) =>
    api.get(`/academic-years/${yearId}/terms`).then((r) => r.data),
  createTerm: (yearId: string, body: unknown) =>
    api.post(`/academic-years/${yearId}/terms`, body).then((r) => r.data),
  setCurrentTerm: (termId: string) =>
    api.post(`/terms/${termId}/set-current`).then((r) => r.data),
  listClasses: (params?: Record<string, string | boolean>) =>
    api.get("/classes", { params }).then((r) => r.data),
  createClass: (body: unknown) =>
    api.post("/classes", body).then((r) => r.data),
  getClassStudents: (classId: string, yearId?: string) =>
    api
      .get(`/classes/${classId}/students`, {
        params: yearId ? { academic_year_id: yearId } : {},
      })
      .then((r) => r.data),
  listSubjects: (params?: Record<string, string>) =>
    api.get("/subjects", { params }).then((r) => r.data),
  createSubject: (body: unknown) =>
    api.post("/subjects", body).then((r) => r.data),
  deleteSubject: (id: string) => api.delete(`/subjects/${id}`),
  enroll: (body: unknown) =>
    api.post("/enrollments", body).then((r) => r.data),
};

// ── Attendance ─────────────────────────────────────────────────────────
export const attendanceApi = {
  listPeriods: () => api.get("/attendance/periods").then((r) => r.data),
  createSession: (body: unknown) =>
    api.post("/attendance/sessions", body).then((r) => r.data),
  submitSession: (sessionId: string, body: unknown) =>
    api.post(`/attendance/sessions/${sessionId}/submit`, body).then((r) => r.data),
  listSessions: (params?: Record<string, string>) =>
    api.get("/attendance/sessions", { params }).then((r) => r.data),
  getClassSummary: (classId: string, params?: Record<string, string>) =>
    api
      .get(`/attendance/summary/class/${classId}`, { params })
      .then((r) => r.data),
};

// ── Grades ──────────────────────────────────────────────────────────────
export const gradesApi = {
  listScales: () =>
    api.get("/assessments/grading-scales").then((r) => r.data),
  listCategories: (params?: Record<string, string>) =>
    api.get("/assessments/categories", { params }).then((r) => r.data),
  createCategory: (body: unknown) =>
    api.post("/assessments/categories", body).then((r) => r.data),
  listAssessments: (params?: Record<string, string>) =>
    api.get("/assessments/", { params }).then((r) => r.data),
  createAssessment: (body: unknown) =>
    api.post("/assessments/", body).then((r) => r.data),
  getGradebook: (assessmentId: string) =>
    api.get(`/assessments/${assessmentId}/gradebook`).then((r) => r.data),
  bulkScore: (assessmentId: string, body: unknown) =>
    api
      .post(`/assessments/${assessmentId}/scores/bulk`, body)
      .then((r) => r.data),
};
