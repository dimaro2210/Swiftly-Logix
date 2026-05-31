import { supabase } from "./supabase";

export interface ShareLink {
  token: string;
  shipmentId: string;
  senderEmail: string;
  recipientLabel?: string;
  createdAt: string;
  revoked: boolean;
}

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export async function createShareLink(shipmentId: string, senderEmail: string, recipientLabel?: string): Promise<string> {
  try {
    // Check if an active share already exists for this shipment & sender
    const { data: existing } = await supabase
      .from('share_links')
      .select('token')
      .eq('shipment_id', shipmentId)
      .ilike('sender_email', senderEmail)
      .eq('revoked', false)
      .limit(1)
      .maybeSingle();

    if (existing) return existing.token;

    const token = generateToken();
    const payload = {
      token,
      shipment_id: shipmentId,
      sender_email: senderEmail,
      recipient_label: recipientLabel,
      created_at: new Date().toISOString(),
      revoked: false,
    };

    await supabase.from('share_links').insert(payload);
    return token;
  } catch (err) {
    console.error("Error creating share link:", err);
    return "";
  }
}

export async function getShareByToken(token: string): Promise<ShareLink | null> {
  try {
    const { data, error } = await supabase
      .from('share_links')
      .select('*')
      .eq('token', token)
      .eq('revoked', false)
      .single();

    if (error || !data) return null;

    return {
      token: data.token,
      shipmentId: data.shipment_id,
      senderEmail: data.sender_email,
      recipientLabel: data.recipient_label,
      createdAt: data.created_at,
      revoked: data.revoked,
    };
  } catch (err) {
    console.error("Error fetching share link:", err);
    return null;
  }
}

export async function getSharesForShipment(shipmentId: string): Promise<ShareLink[]> {
  try {
    const { data, error } = await supabase
      .from('share_links')
      .select('*')
      .eq('shipment_id', shipmentId)
      .eq('revoked', false);

    if (error) throw error;
    
    return (data || []).map(d => ({
      token: d.token,
      shipmentId: d.shipment_id,
      senderEmail: d.sender_email,
      recipientLabel: d.recipient_label,
      createdAt: d.created_at,
      revoked: d.revoked,
    }));
  } catch (err) {
    console.error("Error fetching shipment shares:", err);
    return [];
  }
}

export async function getSharesBySender(senderEmail: string): Promise<ShareLink[]> {
  try {
    const { data, error } = await supabase
      .from('share_links')
      .select('*')
      .ilike('sender_email', senderEmail)
      .eq('revoked', false);

    if (error) throw error;
    
    return (data || []).map(d => ({
      token: d.token,
      shipmentId: d.shipment_id,
      senderEmail: d.sender_email,
      recipientLabel: d.recipient_label,
      createdAt: d.created_at,
      revoked: d.revoked,
    }));
  } catch (err) {
    console.error("Error fetching sender shares:", err);
    return [];
  }
}

export async function revokeShareLink(token: string): Promise<void> {
  try {
    await supabase
      .from('share_links')
      .update({ revoked: true })
      .eq('token', token);
  } catch (err) {
    console.error("Error revoking share link:", err);
  }
}

export function buildShareUrl(token: string): string {
  const base = window.location.origin;
  const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  return `${base}${basePath}/shared/${token}`;
}
