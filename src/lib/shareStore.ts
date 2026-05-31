// Removed Supabase import

export interface ShareLink {
  token: string;
  shipmentId: string;
  senderEmail: string;
  recipientLabel?: string;
  createdAt: string;
  revoked: boolean;
}

// Helper functions for localStorage
const getLocalData = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const setLocalData = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export async function createShareLink(shipmentId: string, senderEmail: string, recipientLabel?: string): Promise<string> {
  const shares = getLocalData<ShareLink>('swiftly_shares');
  
  // Check if an active share already exists for this shipment & sender
  const existing = shares.find(s => s.shipmentId === shipmentId && s.senderEmail.toLowerCase() === senderEmail.toLowerCase() && !s.revoked);
  if (existing) return existing.token;

  const token = generateToken();
  const payload: ShareLink = {
    token,
    shipmentId: shipmentId,
    senderEmail: senderEmail,
    recipientLabel: recipientLabel,
    createdAt: new Date().toISOString(),
    revoked: false,
  };

  shares.push(payload);
  setLocalData('swiftly_shares', shares);
  return token;
}

export async function getShareByToken(token: string): Promise<ShareLink | null> {
  const shares = getLocalData<ShareLink>('swiftly_shares');
  return shares.find(s => s.token === token && !s.revoked) || null;
}

export async function getSharesForShipment(shipmentId: string): Promise<ShareLink[]> {
  const shares = getLocalData<ShareLink>('swiftly_shares');
  return shares.filter(s => s.shipmentId === shipmentId && !s.revoked);
}

export async function getSharesBySender(senderEmail: string): Promise<ShareLink[]> {
  const shares = getLocalData<ShareLink>('swiftly_shares');
  return shares.filter(s => s.senderEmail.toLowerCase() === senderEmail.toLowerCase() && !s.revoked);
}

export async function revokeShareLink(token: string): Promise<void> {
  const shares = getLocalData<ShareLink>('swiftly_shares');
  const index = shares.findIndex(s => s.token === token);
  if (index >= 0) {
    shares[index].revoked = true;
    setLocalData('swiftly_shares', shares);
  }
}

export function buildShareUrl(token: string): string {
  const base = window.location.origin;
  const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  return `${base}${basePath}/shared/${token}`;
}
