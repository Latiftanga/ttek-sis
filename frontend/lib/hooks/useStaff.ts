"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { staffApi, type InviteResult, type CreateStaffResult } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export interface StaffUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login?: string | null;
}

export interface StaffQualification {
  id: string;
  staff_id: string;
  title: string;
  institution?: string | null;
  year_obtained?: number | null;
  cert_type?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface StaffPromotion {
  id: string;
  staff_id: string;
  from_rank?: string | null;
  to_rank: string;
  effective_date: string;
  promotion_type: string;
  reference_no?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface GESRank {
  id: string;
  name: string;
  category: string;
  order: number;
}

export interface Staff {
  id: string;
  school_id: string;
  staff_number?: string | null;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  title?: string | null;
  license_number?: string | null;
  specialization?: string | null;
  date_joined?: string | null;
  status: "active" | "on_leave" | "transferred" | "retired";
  current_rank?: string | null;
  user?: StaffUser | null;
  qualifications?: StaffQualification[];
  promotions?: StaffPromotion[];
  created_at: string;
  updated_at: string;
}

export interface StaffFilters {
  search?: string;
  status?: string;
  role?: string;
  skip?: number;
  limit?: number;
}

function useSlug() {
  return useAuthStore((s) => s.school?.slug);
}

export function useStaff(filters: StaffFilters = {}) {
  const slug = useSlug();
  const params: Record<string, string | number> = {};
  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.role)   params.role   = filters.role;
  if (filters.skip  !== undefined) params.skip  = filters.skip;
  if (filters.limit !== undefined) params.limit = filters.limit;

  return useQuery<Staff[]>({
    queryKey: [slug, "staff", filters],
    queryFn: () => staffApi.list(params),
    enabled: !!slug,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useStaffMember(id: string) {
  const slug = useSlug();
  return useQuery<Staff>({
    queryKey: [slug, "staff", id],
    queryFn: () => staffApi.get(id),
    enabled: !!id && !!slug,
  });
}

export function useGESRanks() {
  return useQuery<GESRank[]>({
    queryKey: ["ges-ranks"],
    queryFn: () => staffApi.gesRanks(),
    staleTime: Infinity,   // ranks never change at runtime
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation<CreateStaffResult, Error, unknown>({
    mutationFn: (body: unknown) => staffApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "staff"] }),
  });
}

export function useUpdateStaff(id: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => staffApi.update(id, body),
    onSuccess: (updated: Staff) => {
      qc.setQueryData([slug, "staff", id], updated);
      qc.invalidateQueries({ queryKey: [slug, "staff"] });
    },
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (id: string) => staffApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "staff"] }),
  });
}

export function useInviteStaff(staffId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation<InviteResult & Staff, Error, unknown>({
    mutationFn: (body) => staffApi.invite(staffId, body) as Promise<InviteResult & Staff>,
    onSuccess: (data) => {
      qc.setQueryData([slug, "staff", staffId], data);
      qc.invalidateQueries({ queryKey: [slug, "staff"] });
    },
  });
}

export function useToggleStaffAccount(staffId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: () => staffApi.toggleAccount(staffId),
    onSuccess: (updated: Staff) => {
      qc.setQueryData([slug, "staff", staffId], updated);
      qc.invalidateQueries({ queryKey: [slug, "staff"] });
    },
  });
}

export function useAddQualification(staffId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => staffApi.addQualification(staffId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "staff", staffId] }),
  });
}

export function useRemoveQualification(staffId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (qualId: string) => staffApi.removeQualification(staffId, qualId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "staff", staffId] }),
  });
}

export function useAddPromotion(staffId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (body: unknown) => staffApi.addPromotion(staffId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "staff", staffId] }),
  });
}

export function useRemovePromotion(staffId: string) {
  const qc = useQueryClient();
  const slug = useSlug();
  return useMutation({
    mutationFn: (promoId: string) => staffApi.removePromotion(staffId, promoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [slug, "staff", staffId] }),
  });
}
