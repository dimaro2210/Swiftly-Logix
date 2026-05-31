// Removed Supabase import

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

// ── Bills ──────────────────────────────────────────────────────────

export async function getBills(email?: string): Promise<Bill[]> {
  const bills = getLocalData<Bill>('swiftly_bills');
  const filtered = email ? bills.filter(b => b.userEmail?.toLowerCase() === email.toLowerCase()) : bills;
  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function saveBill(bill: Bill): Promise<void> {
  const bills = getLocalData<Bill>('swiftly_bills');
  const index = bills.findIndex(b => b.id === bill.id);
  if (index >= 0) {
    bills[index] = bill;
  } else {
    bills.push(bill);
  }
  setLocalData('swiftly_bills', bills);
}

export async function deleteBill(id: string): Promise<void> {
  let bills = getLocalData<Bill>('swiftly_bills');
  bills = bills.filter(b => b.id !== id);
  setLocalData('swiftly_bills', bills);
}

// ── Deposits ───────────────────────────────────────────────────────

export async function getDeposits(email?: string): Promise<Deposit[]> {
  const deposits = getLocalData<Deposit>('swiftly_deposits');
  const filtered = email ? deposits.filter(d => d.userEmail?.toLowerCase() === email.toLowerCase()) : deposits;
  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function saveDeposit(deposit: Deposit): Promise<void> {
  const deposits = getLocalData<Deposit>('swiftly_deposits');
  const index = deposits.findIndex(d => d.id === deposit.id);
  if (index >= 0) {
    deposits[index] = deposit;
  } else {
    deposits.push(deposit);
  }
  setLocalData('swiftly_deposits', deposits);
}

// ── Balance ────────────────────────────────────────────────────────

export async function getUserBalance(email: string): Promise<number> {
  try {
    const data = localStorage.getItem(`swiftly_balance_${email.toLowerCase()}`);
    return data ? Number(data) : 0;
  } catch {
    return 0;
  }
}

export async function setUserBalance(email: string, amount: number): Promise<void> {
  localStorage.setItem(`swiftly_balance_${email.toLowerCase()}`, String(Math.max(0, amount)));
}

// ── Notifications ──────────────────────────────────────────────────

export async function getNotifications(email: string): Promise<Notification[]> {
  const notifs = getLocalData<Notification>('swiftly_notifications');
  return notifs
    .filter(n => n.userEmail?.toLowerCase() === email.toLowerCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAllNotifications(): Promise<Notification[]> {
  const notifs = getLocalData<Notification>('swiftly_notifications');
  return notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function saveNotification(notif: Notification): Promise<void> {
  const notifs = getLocalData<Notification>('swiftly_notifications');
  const index = notifs.findIndex(n => n.id === notif.id);
  if (index >= 0) {
    notifs[index] = notif;
  } else {
    notifs.push(notif);
  }
  setLocalData('swiftly_notifications', notifs);
}

export async function markAllNotificationsRead(email: string): Promise<void> {
  const notifs = getLocalData<Notification>('swiftly_notifications');
  notifs.forEach(n => {
    if (n.userEmail?.toLowerCase() === email.toLowerCase()) {
      n.read = true;
    }
  });
  setLocalData('swiftly_notifications', notifs);
}

export async function getUnreadCount(email: string): Promise<number> {
  const notifs = getLocalData<Notification>('swiftly_notifications');
  return notifs.filter(n => n.userEmail?.toLowerCase() === email.toLowerCase() && !n.read).length;
}

// ── Wallet Addresses ───────────────────────────────────────────────

export async function getWalletAddresses(): Promise<{ bitcoin: string; usdt: string }> {
  const defaults = {
    bitcoin: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    usdt: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE"
  };
  
  try {
    const data = localStorage.getItem('swiftly_wallets');
    if (data) {
      return JSON.parse(data);
    }
    return defaults;
  } catch {
    return defaults;
  }
}

export async function saveWalletAddresses(wallets: { bitcoin: string; usdt: string }): Promise<void> {
  localStorage.setItem('swiftly_wallets', JSON.stringify(wallets));
}

// ── Helpers ────────────────────────────────────────────────────────

export function generateId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
