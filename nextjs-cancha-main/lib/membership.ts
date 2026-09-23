import api from "./axios";

export interface MembershipPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  interval: "MONTHLY" | "SEMIANNUAL" | "ANNUAL";
  graceDays: number;
  features: string[];
  maxCourts?: number;
  isActive: boolean;
}

export interface ClubMembership {
  id: string;
  clubId: string;
  planId: string;
  plan: MembershipPlan;
  status: "PENDING" | "ACTIVE" | "GRACE" | "EXPIRED" | "CANCELLED";
  startDate: string;
  endDate: string;
  graceEndDate?: string;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string;
}

export interface MembershipPayment {
  id: string;
  clubId: string;
  planId: string;
  plan: MembershipPlan;
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "REJECTED" | "REFUNDED";
  mpPaymentId?: string;
  mpPreferenceId?: string;
  paymentMethod?: string;
  paymentType?: string;
  comprobanteUrl?: string;
  referenceNumber?: string;
  notes?: string;
  paidAt?: string;
  createdAt: string;
}

export const getActiveMembershipPlans = async (): Promise<MembershipPlan[]> => {
  const result = await api.get("/memberships/plans");
  return result.data;
};

export const getMyClubMembership = async (): Promise<{ membership: ClubMembership | null }> => {
  const result = await api.get("/memberships/my-membership");
  return result.data;
};

export const getMyClubMembershipHistory = async (): Promise<ClubMembership[]> => {
  const result = await api.get("/memberships/history");
  return result.data;
};

export const getMyMembershipPayments = async (): Promise<MembershipPayment[]> => {
  const result = await api.get("/memberships/payments");
  return result.data;
};

export const createMembershipCheckout = async (
  planId: string,
  autoRenew: boolean = true
): Promise<{ init_point: string; preferenceId: string; paymentId: string }> => {
  const result = await api.post("/memberships/checkout-preference", { planId, autoRenew });
  return result.data;
};

export const submitMembershipManualPayment = async (
  formData: FormData
): Promise<{ payment: MembershipPayment; membership: ClubMembership }> => {
  const result = await api.post("/memberships/manual-payment", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return result.data;
};

export const cancelMembershipAutoRenew = async (): Promise<ClubMembership> => {
  const result = await api.post("/memberships/cancel-autorenew");
  return result.data;
};

export const checkMembershipPaymentStatus = async (
  paymentId: string
): Promise<MembershipPayment> => {
  const result = await api.get(`/memberships/check-status/${paymentId}`);
  return result.data;
};

// ─── TIPOS Y APIS PARA ADMINISTRADOR ──────────────────────────────────

export interface AdminClubClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp?: string;
  address: string;
  district: string;
  logo?: string;
  status: string;
  createdAt: string;
  owner?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  } | null;
  membership: {
    id: string;
    planId: string;
    planName: string;
    interval: "MONTHLY" | "SEMIANNUAL" | "ANNUAL";
    price: number;
    currency: string;
    startDate: string;
    endDate: string;
    graceEndDate?: string;
    status: string;
    originalStatus?: string;
    autoRenew: boolean;
    cancelAtPeriodEnd: boolean;
    isExpiringSoon: boolean;
    daysRemaining: number;
  } | null;
  effectiveStatus: string;
  isExpiringSoon: boolean;
  isTrialActive: boolean;
  trialEndDate?: string;
}

export interface AdminClientsStats {
  totalClubs: number;
  activeMemberships: number;
  expiringSoon: number;
  gracePeriod: number;
  expired: number;
  mrr: number;
}

export interface AdminClientsResponse {
  clients: AdminClubClient[];
  stats: AdminClientsStats;
}

export interface AdminMembershipPaymentItem {
  id: string;
  clubId: string;
  clubName: string;
  clubEmail: string;
  clubLogo?: string | null;
  clubDistrict?: string | null;
  planId: string;
  planName: string;
  interval: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "REJECTED" | "REFUNDED";
  mpPaymentId?: string | null;
  mpPreferenceId?: string | null;
  mpMerchantOrderId?: string | null;
  paymentMethod?: string;
  paymentType?: string;
  paidAt?: string | null;
  createdAt: string;
  comprobanteUrl?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  gatewayResponse?: any;
}

export interface AdminPaymentsSummary {
  totalPaidAmount: number;
  monthPaidAmount: number;
  totalTransactions: number;
  paidCount: number;
  pendingCount: number;
  rejectedCount: number;
  refundedCount: number;
}

export interface AdminPaymentsResponse {
  payments: AdminMembershipPaymentItem[];
  summary: AdminPaymentsSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const getAdminClients = async (params?: {
  search?: string;
  filter?: string;
}): Promise<AdminClientsResponse> => {
  const result = await api.get("/memberships/admin/clients", { params });
  return result.data;
};

export const getAdminMembershipPayments = async (params?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<AdminPaymentsResponse> => {
  const result = await api.get("/memberships/admin/payments", { params });
  return result.data;
};

