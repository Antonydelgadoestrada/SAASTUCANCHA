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
