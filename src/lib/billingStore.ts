import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────

export interface Bill {
  id: string;
  userEmail: string;
  receiverEmail?: string;
  title: string;
  amount: number;
  note: string;
  imageUrl?: string;
  imageFileName?: string;
  status: "unpaid" | "pending" | "paid";
  createdAt: string;
  paidAt?: string;
}

export interface Deposit {
  id: string;
  userEmail: string;
  amount: number;
  method: "bitcoin" | "usdt";
  receiptImage?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt?: string;
}

export interface Notification {
  id: string;
  userEmail: string;
  type: "bill_created" | "deposit_approved" | "deposit_rejected" | "bill_paid" | "account_update" | string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

// ── Bills ──────────────────────────────────────────────────────────

export async function getBills(email?: string, client = supabase): Promise<Bill[]> {
  let query = client.from('bills').select('*').order('created_at', { ascending: false });
  if (email) {
    query = query.eq('user_email', email);
  }
  const { data, error } = await query;
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).map(mapDbToBill);
}

export async function saveBill(bill: Bill, client = supabase): Promise<void> {
  const { error } = await client.from('bills').upsert(mapBillToDb(bill));
  if (error) console.error(error);
}

export async function deleteBill(id: string, client = supabase): Promise<void> {
  const { error } = await client.from('bills').delete().eq('id', id);
  if (error) console.error(error);
}

// ── Deposits ───────────────────────────────────────────────────────

export async function getDeposits(email?: string, client = supabase): Promise<Deposit[]> {
  let query = client.from('deposits').select('*').order('created_at', { ascending: false });
  if (email) {
    query = query.eq('user_email', email);
  }
  const { data, error } = await query;
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).map(mapDbToDeposit);
}

export async function saveDeposit(deposit: Deposit, client = supabase): Promise<void> {
  const { error } = await client.from('deposits').upsert(mapDepositToDb(deposit));
  if (error) console.error(error);
}

// ── Balance ────────────────────────────────────────────────────────

export async function getUserBalance(email: string, client = supabase): Promise<number> {
  const { data, error } = await client.from('users').select('wallet_balance').eq('email', email).single();
  if (error || !data) return 0;
  return Number(data.wallet_balance) || 0;
}

export async function setUserBalance(email: string, amount: number, client = supabase): Promise<void> {
  const { error } = await client.from('users').update({ wallet_balance: Math.max(0, amount) }).eq('email', email);
  if (error) console.error(error);
}

// ── Notifications ──────────────────────────────────────────────────

export async function getNotifications(email: string, client = supabase): Promise<Notification[]> {
  const { data, error } = await client.from('notifications').select('*').eq('user_email', email).order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(mapDbToNotification);
}

export async function getAllNotifications(client = supabase): Promise<Notification[]> {
  const { data, error } = await client.from('notifications').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(mapDbToNotification);
}

export async function saveNotification(notif: Notification, client = supabase): Promise<void> {
  const { error } = await client.from('notifications').upsert(mapNotificationToDb(notif));
  if (error) console.error(error);
}

export async function markAllNotificationsRead(email: string, client = supabase): Promise<void> {
  const { error } = await client.from('notifications').update({ read: true }).eq('user_email', email);
  if (error) console.error(error);
}

export async function getUnreadCount(email: string, client = supabase): Promise<number> {
  const { count, error } = await client.from('notifications').select('*', { count: 'exact', head: true }).eq('user_email', email).eq('read', false);
  if (error) return 0;
  return count || 0;
}

// ── Wallet Addresses ───────────────────────────────────────────────

export async function getWalletAddresses(client = supabase): Promise<{ bitcoin: string; usdt: string }> {
  const defaults = {
    bitcoin: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    usdt: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE"
  };
  const { data, error } = await client.from('settings').select('*').eq('key', 'crypto_wallets').maybeSingle();
  if (error || !data) return defaults;
  return data.value;
}

export async function saveWalletAddresses(wallets: { bitcoin: string; usdt: string }, client = supabase): Promise<void> {
  const { error } = await client.from('settings').upsert({ key: 'crypto_wallets', value: wallets });
  if (error) console.error(error);
}

// ── Helpers ────────────────────────────────────────────────────────

export function generateId(prefix = "id"): string {
  // Supabase tables (bills, deposits, notifications, shipments) use UUID primary keys.
  // We must return a valid UUID instead of a timestamp-based string.
  return crypto.randomUUID();
}

function mapDbToBill(db: any): Bill {
  return {
    id: db.id,
    userEmail: db.user_email,
    receiverEmail: db.receiver_email,
    title: db.title,
    amount: Number(db.amount),
    note: db.note,
    imageUrl: db.image_url,
    imageFileName: db.image_file_name,
    status: db.status,
    createdAt: db.created_at,
    paidAt: db.paid_at,
  };
}

function mapBillToDb(b: Bill): any {
  return {
    id: b.id,
    user_email: b.userEmail,
    receiver_email: b.receiverEmail,
    title: b.title,
    amount: b.amount,
    note: b.note,
    image_url: b.imageUrl,
    image_file_name: b.imageFileName,
    status: b.status,
    created_at: b.createdAt,
    paid_at: b.paidAt,
  };
}

function mapDbToDeposit(db: any): Deposit {
  return {
    id: db.id,
    userEmail: db.user_email,
    amount: Number(db.amount),
    method: db.method,
    receiptImage: db.receipt_image,
    status: db.status,
    createdAt: db.created_at,
    reviewedAt: db.reviewed_at,
  };
}

function mapDepositToDb(d: Deposit): any {
  return {
    id: d.id,
    user_email: d.userEmail,
    amount: d.amount,
    method: d.method,
    receipt_image: d.receiptImage,
    status: d.status,
    created_at: d.createdAt,
    reviewed_at: d.reviewedAt,
  };
}

function mapDbToNotification(db: any): Notification {
  return {
    id: db.id,
    userEmail: db.user_email,
    type: db.type,
    title: db.title,
    body: db.body,
    read: db.read,
    createdAt: db.created_at,
  };
}

function mapNotificationToDb(n: Notification): any {
  return {
    id: n.id,
    user_email: n.userEmail,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    created_at: n.createdAt,
  };
}
