import api from "./axios";

export interface PlatformMercadoPagoStatus {
  isConnected: boolean;
  provider: string;
  mpUserId: string | null;
  mpPublicKey: string | null;
  accountEmail: string | null;
  accountNickname: string | null;
  environment: "production" | "sandbox" | string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  mpTokenExpiresAt: string | null;
  expiresInDays: number | null;
  source: "database" | "environment" | "unconfigured";
  hasEnvFallback: boolean;
  hasClientIdAndSecret: boolean;
  redirectUri: string;
}

export interface PlatformSyncResult {
  success: boolean;
  latencyMs: number;
  source: string;
  accountEmail: string | null;
  accountNickname: string | null;
  countryId: string;
  liveMode: boolean;
  message: string;
}

export interface ManualCredentialsPayload {
  accessToken: string;
  publicKey?: string;
}

/**
 * Obtiene el estado público de Mercado Pago para la cuenta receptora de la plataforma (Admin)
 */
export async function getAdminMercadoPagoStatus(): Promise<PlatformMercadoPagoStatus> {
  const { data } = await api.get<PlatformMercadoPagoStatus>("/memberships/admin/mercadopago/status");
  return data;
}

/**
 * Solicita el URL OAuth firmado criptográficamente para conectar la cuenta con Mercado Pago
 */
export async function getAdminMercadoPagoAuthorizeUrl(): Promise<string> {
  const { data } = await api.get<{ url: string }>("/memberships/admin/mercadopago/authorize");
  return data.url;
}

/**
 * Desconecta la cuenta de Mercado Pago de la plataforma
 */
export async function disconnectAdminMercadoPago(): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post<{ success: boolean; message: string }>("/memberships/admin/mercadopago/disconnect");
  return data;
}

/**
 * Ejecuta un ping de conectividad con Mercado Pago para validar latencia y credenciales
 */
export async function syncAdminMercadoPago(): Promise<PlatformSyncResult> {
  const { data } = await api.post<PlatformSyncResult>("/memberships/admin/mercadopago/sync");
  return data;
}

/**
 * Guarda credenciales manuales (Access Token / Public Key)
 */
export async function saveAdminManualCredentials(
  payload: ManualCredentialsPayload
): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post<{ success: boolean; message: string }>(
    "/memberships/admin/mercadopago/manual-credentials",
    payload
  );
  return data;
}
