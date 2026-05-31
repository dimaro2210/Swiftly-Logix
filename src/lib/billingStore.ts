import { supabase } from "./supabase";

// ── Types ──────────────────────────────────────────────────────────

export interface Bill {
  id: string;
  userEmail: string;
  title: string;
  amount: number;
  note: string;
  imageUrl?: string;
  imageFileName?: string;
  status: "unpaid" | "paid";
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

export async function getBills(email?: string): Promise<Bill[]> {
  try {
    let query = supabase.from('bills').select('*').order('created_at', { ascending: false });
    if (email) {
      query = query.ilike('user_email', email);
    }
    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(mapDbToBill);
  } catch (err) {
    console.error("Error fetching bills:", err);
    return [];
  }
}

export async function saveBill(bill: Bill): Promise<void> {
  try {
    const payload = {
      id: bill.id,
      user_email: bill.userEmail,
      title: bill.title,
      amount: bill.amount,
      note: bill.note,
      image_url: bill.imageUrl,
      image_file_name: bill.imageFileName,
      status: bill.status,
      created_at: bill.createdAt,
      paid_at: bill.paidAt,
    };
    await supabase.from('bills').upsert(payload);
  } catch (err) {
    console.error("Error saving bill:", err);
  }
}

export async function deleteBill(id: string): Promise<void> {
  try {
    await supabase.from('bills').delete().eq('id', id);
  } catch (err) {
    console.error("Error deleting bill:", err);
  }
}

// ── Deposits ───────────────────────────────────────────────────────

export async function getDeposits(email?: string): Promise<Deposit[]> {
  try {
    let query = supabase.from('deposits').select('*').order('created_at', { ascending: false });
    if (email) {
      query = query.ilike('user_email', email);
    }
    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(mapDbToDeposit);
  } catch (err) {
    console.error("Error fetching deposits:", err);
    return [];
  }
}

export async function saveDeposit(deposit: Deposit): Promise<void> {
  try {
    const payload = {
      id: deposit.id,
      user_email: deposit.userEmail,
      amount: deposit.amount,
      method: deposit.method,
      receipt_image: deposit.receiptImage,
      status: deposit.status,
      created_at: deposit.createdAt,
      reviewed_at: deposit.reviewedAt,
    };
    await supabase.from('deposits').upsert(payload);
  } catch (err) {
    console.error("Error saving deposit:", err);
  }
}

// ── Balance ────────────────────────────────────────────────────────

export async function getUserBalance(email: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('balances')
      .select('balance')
      .ilike('user_email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? Number(data.balance) : 0;
  } catch (err) {
    console.error("Error fetching balance:", err);
    return 0;
  }
}

export async function setUserBalance(email: string, amount: number): Promise<void> {
  try {
    await supabase.from('balances').upsert({
      user_email: email,
      balance: Math.max(0, amount)
    });
  } catch (err) {
    console.error("Error setting balance:", err);
  }
}

// ── Notifications ──────────────────────────────────────────────────

export async function getNotifications(email: string): Promise<Notification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .ilike('user_email', email)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbToNotif);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    return [];
  }
}

export async function getAllNotifications(): Promise<Notification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbToNotif);
  } catch (err) {
    console.error("Error fetching all notifications:", err);
    return [];
  }
}

export async function saveNotification(notif: Notification): Promise<void> {
  try {
    const payload = {
      id: notif.id,
      user_email: notif.userEmail,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      read: notif.read,
      created_at: notif.createdAt,
    };
    await supabase.from('notifications').insert(payload);
  } catch (err) {
    console.error("Error saving notification:", err);
  }
}

export async function markAllNotificationsRead(email: string): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({ read: true })
      .ilike('user_email', email);
  } catch (err) {
    console.error("Error marking notifications read:", err);
  }
}

export async function getUnreadCount(email: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .ilike('user_email', email)
      .eq('read', false);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error("Error getting unread count:", err);
    return 0;
  }
}

// ── Wallet Addresses ───────────────────────────────────────────────

export async function getWalletAddresses(): Promise<{ bitcoin: string; usdt: string }> {
  const defaults = {
    bitcoin: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    usdt: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE"
  };

  try {
    const { data, error } = await supabase
      .from('wallet_addresses')
      .select('*')
      .eq('id', 1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (data) {
      return { bitcoin: data.bitcoin, usdt: data.usdt };
    }
    return defaults;
  } catch (err) {
    console.error("Error fetching wallet addresses:", err);
    return defaults;
  }
}

export async function saveWalletAddresses(wallets: { bitcoin: string; usdt: string }): Promise<void> {
  try {
    await supabase.from('wallet_addresses').upsert({
      id: 1,
      bitcoin: wallets.bitcoin,
      usdt: wallets.usdt
    });
  } catch (err) {
    console.error("Error saving wallet addresses:", err);
  }
}

// ── Helpers ────────────────────────────────────────────────────────

export function generateId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapDbToBill(db: any): Bill {
  return {
    id: db.id,
    userEmail: db.user_email,
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

function mapDbToNotif(db: any): Notification {
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
