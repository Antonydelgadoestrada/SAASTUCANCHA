import api from "./axios";

export type LoyaltyMode = "A" | "B";

export interface LoyaltyConfig {
  id: string;
  clubId: string;
  isActive: boolean;
  mode: LoyaltyMode;
  dayPoints: number;
  nightPoints: number;
  nightStartsAt: string;
  bonusEveryX: number;
  bonusPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLoyaltyConfigDto {
  isActive?: boolean;
  mode?: LoyaltyMode;
  dayPoints?: number;
  nightPoints?: number;
  nightStartsAt?: string;
  bonusEveryX?: number;
  bonusPoints?: number;
}

export type LoyaltyRewardType =
  | "TEXT_ONLY"
  | "FIXED_DISCOUNT"
  | "PERCENT_DISCOUNT"
  | "FREE_HOUR";

export interface LoyaltyReward {
  id: string;
  clubId: string;
  name: string;
  description?: string;
  pointsCost: number;
  isActive: boolean;
  rewardType?: LoyaltyRewardType;
  discountValue?: number | null;
  maxDiscountAmount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLoyaltyRewardDto {
  name: string;
  description?: string;
  pointsCost: number;
  isActive?: boolean;
  rewardType?: LoyaltyRewardType;
  discountValue?: number | null;
  maxDiscountAmount?: number | null;
}

export interface UpdateLoyaltyRewardDto {
  name?: string;
  description?: string;
  pointsCost?: number;
  isActive?: boolean;
  rewardType?: LoyaltyRewardType;
  discountValue?: number | null;
  maxDiscountAmount?: number | null;
}

export type LoyaltyRedemptionStatus =
  | "PENDING"
  | "DELIVERED"
  | "REJECTED"
  | "EXPIRED"
  | "APPLIED";

export interface LoyaltyRedemption {
  id: string;
  clubId: string;
  userId: string;
  rewardId?: string | null;
  rewardNameSnapshot: string;
  rewardCostSnapshot: number;
  code: string;
  status: LoyaltyRedemptionStatus;
  rejectReason?: string | null;
  requestedAt: string;
  expiresAt: string;
  resolvedAt?: string | null;
  resolvedByUserId?: string | null;
  rewardTypeSnapshot?: LoyaltyRewardType;
  discountValueSnapshot?: number | null;
  maxDiscountSnapshot?: number | null;
  bookingId?: string | null;
  appliedDiscountAmount?: number | null;
  appliedAt?: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  reward?: LoyaltyReward;
  booking?: {
    id: string;
    reservationNumber?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    totalPrice?: number;
  };
}

export type LoyaltyTransactionType =
  | "EARN_DAY"
  | "EARN_NIGHT"
  | "EARN_COUNT"
  | "EARN_BONUS"
  | "REDEEM"
  | "REFUND"
  | "REVERSAL";

export interface LoyaltyTransaction {
  id: string;
  clubId: string;
  userId: string;
  type: LoyaltyTransactionType;
  points: number;
  bookingId?: string | null;
  redemptionId?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface UserLoyaltyBalance {
  balance: number;
  paidReservationsCount: number;
}

// =========================================================================
// CLUB API CALLS
// =========================================================================

export const getClubLoyaltyConfig = async (): Promise<LoyaltyConfig> => {
  const res = await api.get("/loyalty/club/config");
  return res.data;
};

export const updateClubLoyaltyConfig = async (
  dto: UpdateLoyaltyConfigDto
): Promise<LoyaltyConfig> => {
  const res = await api.put("/loyalty/club/config", dto);
  return res.data;
};

export const getClubLoyaltyRewards = async (): Promise<LoyaltyReward[]> => {
  const res = await api.get("/loyalty/club/rewards");
  return res.data;
};

export const createClubLoyaltyReward = async (
  dto: CreateLoyaltyRewardDto
): Promise<LoyaltyReward> => {
  const res = await api.post("/loyalty/club/rewards", dto);
  return res.data;
};

export const updateClubLoyaltyReward = async (
  id: string,
  dto: UpdateLoyaltyRewardDto
): Promise<LoyaltyReward> => {
  const res = await api.put(`/loyalty/club/rewards/${id}`, dto);
  return res.data;
};

export const deleteClubLoyaltyReward = async (id: string): Promise<void> => {
  await api.delete(`/loyalty/club/rewards/${id}`);
};

export const getClubLoyaltyRedemptions = async (
  status?: LoyaltyRedemptionStatus
): Promise<LoyaltyRedemption[]> => {
  const params: any = {};
  if (status) params.status = status;
  const res = await api.get("/loyalty/club/redemptions", { params });
  return res.data;
};

export const deliverClubLoyaltyReward = async (
  code: string
): Promise<LoyaltyRedemption> => {
  const res = await api.post("/loyalty/club/redemptions/deliver", { code });
  return res.data;
};

export const rejectClubLoyaltyRedemption = async (
  id: string,
  reason: string
): Promise<LoyaltyRedemption> => {
  const res = await api.post(`/loyalty/club/redemptions/${id}/reject`, {
    reason,
  });
  return res.data;
};

export interface PreviewCouponDto {
  code: string;
  courtId: string;
  basePrice: number;
  date?: string;
  duration?: number;
  startTime?: string;
  userEmail?: string;
}

export interface PreviewCouponResult {
  valid: boolean;
  code: string;
  redemptionId: string;
  rewardType: LoyaltyRewardType;
  rewardName: string;
  discountAmount: number;
  netPrice: number;
  originalPrice: number;
  requiresPayment: boolean;
  courtPriceDay: number;
  message?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export const previewClubCoupon = async (
  dto: PreviewCouponDto
): Promise<PreviewCouponResult> => {
  const res = await api.post("/loyalty/club/coupons/preview", dto);
  return res.data;
};

// =========================================================================
// USER API CALLS
// =========================================================================

export const getUserLoyaltyBalance = async (
  clubId: string
): Promise<UserLoyaltyBalance> => {
  const res = await api.get(`/loyalty/user/balance/${clubId}`);
  return res.data;
};

export const getUserLoyaltyRewards = async (
  clubId: string
): Promise<LoyaltyReward[]> => {
  const res = await api.get(`/loyalty/user/rewards/${clubId}`);
  return res.data;
};

export const redeemUserLoyaltyReward = async (
  clubId: string,
  rewardId: string
): Promise<{ redemption: LoyaltyRedemption; newBalance: number }> => {
  const res = await api.post("/loyalty/user/redeem", { clubId, rewardId });
  return res.data;
};

export const getUserLoyaltyRedemptions = async (
  clubId: string
): Promise<LoyaltyRedemption[]> => {
  const res = await api.get(`/loyalty/user/redemptions/${clubId}`);
  return res.data;
};

export const getUserLoyaltyTransactions = async (
  clubId: string,
  limit: number = 50
): Promise<LoyaltyTransaction[]> => {
  const res = await api.get(`/loyalty/user/transactions/${clubId}`, {
    params: { limit },
  });
  return res.data;
};
