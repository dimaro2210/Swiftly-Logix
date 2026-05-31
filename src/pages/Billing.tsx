import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import {
  CreditCard, Plus, ArrowLeft, Copy, Check, Upload, Loader2,
  AlertTriangle, Bitcoin, CheckCircle2, Clock, X, FileText,
  ChevronRight, DollarSign, Bell, Image as ImageIcon, Wallet, ShieldCheck, ArrowUpRight,
  Download, Paperclip, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getBills, saveBill, getDeposits, saveDeposit, getUserBalance,
  setUserBalance, getNotifications, markAllNotificationsRead,
  getUnreadCount, saveNotification, generateId, getWalletAddresses,
} from "@/lib/billingStore";
import type { Bill, Deposit } from "@/lib/billingStore";
import { sendBillPaidEmail } from "@/lib/emailService";

type DepositStep = 1 | 2 | 3 | 4 | 5;

export default function Billing() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // ── Data ──
  const [bills, setBills] = useState<Bill[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [balance, setBalance] = useState(0);
  const [walletAddresses, setWalletAddresses] = useState({ bitcoin: "", usdt: "" });

  // ── Deposit modal ──
  const [showDeposit, setShowDeposit] = useState(false);
  const [step, setStep] = useState<DepositStep>(1);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<"bitcoin" | "usdt">("bitcoin");
  const [receiptFile, setReceiptFile] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState("");
  const [copied, setCopied] = useState(false);
  const [depositId, setDepositId] = useState("");

  // ── Tab & Bill View ──
  const [tab, setTab] = useState<"bills" | "deposits">("bills");
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setBills(await getBills(user.email));
    setDeposits(await getDeposits(user.email));
    setBalance(await getUserBalance(user.email));
    setWalletAddresses(await getWalletAddresses());
  }, [user]);

  useEffect(() => { if (!isAuthenticated) navigate("/auth/login"); }, [isAuthenticated]);
  useEffect(() => { reload(); }, [reload]);

  if (!isAuthenticated || !user) return null;

  // ── Pay bill from balance ──
  const payBill = async (bill: Bill) => {
    setSelectedBill(null); // Close modal if open
    if (balance < bill.amount) {
      setShowDeposit(true);
      return;
    }
    const newBal = balance - bill.amount;
    await setUserBalance(user.email, newBal);
    await saveBill({ ...bill, status: "paid", paidAt: new Date().toISOString() });
    await saveNotification({
      id: generateId("notif"),
      userEmail: user.email,
      type: "bill_paid",
      title: "Bill Payment Confirmed",
      body: `Your bill of $${bill.amount.toFixed(2)} has been paid successfully.`,
      read: false,
      createdAt: new Date().toISOString(),
    });
    
    // Send email to user
    await sendBillPaidEmail(user.email, bill.title, bill.amount);
    
    // Reload UI
    reload();
  };

  // ── Deposit step helpers ──
  const resetDeposit = () => {
    setStep(1);
    setDepositAmount("");
    setDepositMethod("bitcoin");
    setReceiptFile(null);
    setReceiptName("");
    setCopied(false);
    setShowDeposit(false);
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setReceiptFile(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSentIt = async () => {
    const id = generateId("dep");
    setDepositId(id);
    const dep: Deposit = {
      id,
      userEmail: user.email,
      amount: parseFloat(depositAmount),
      method: depositMethod,
      receiptImage: receiptFile ?? undefined,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await saveDeposit(dep);
    setStep(4); // loading
    setTimeout(() => { setStep(5); reload(); }, 5000);
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const walletAddr = depositMethod === "bitcoin" ? walletAddresses.bitcoin : walletAddresses.usdt;
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(walletAddr);

  const unpaidBills = bills.filter(b => b.status === "unpaid");
  const paidBills = bills.filter(b => b.status === "paid");

  return (
    <div className="min-h-screen bg-swiftly-cream pb-24 font-inter">

      {/* ── CLEAN MINIMAL HEADER ── */}
      <div className="relative pt-24 pb-12 md:pt-32 md:pb-16 px-4 md:px-8 border-b border-gray-200 bg-white overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#F59A25] opacity-5 -mr-32 -mt-32 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#0B2B26] opacity-5 -ml-32 -mb-32 rounded-full blur-3xl"></div>
        
        <div className="max-w-5xl mx-auto relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[#F59A25] mb-3">Finance Center</p>
            <h1 className="text-[32px] md:text-[56px] font-bold text-[#0B2B26] leading-none font-outfit tracking-tight mb-4">Billing & Payments</h1>
            <p className="text-gray-500 text-[16px] md:text-[18px] max-w-xl leading-relaxed">Manage your shipping invoices, track deposits, and maintain your account balance securely.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-gray-50 rounded-[32px] p-8 border border-gray-100 flex flex-col sm:flex-row items-center gap-8 shadow-sm">
            <div className="text-center sm:text-left">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Available Balance</p>
              <p className="text-[36px] md:text-[44px] font-outfit font-bold text-[#0B2B26] leading-none tracking-tight">${balance.toFixed(2)}</p>
            </div>
            <button
              onClick={() => { setShowDeposit(true); setStep(1); }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-[#F59A25] hover:bg-[#E08A1B] text-white rounded-full font-bold text-[15px] transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
            >
              <Plus size={18} /> Add Funds
            </button>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-8 md:mt-12 relative z-20">

        {/* ── MINIMAL TABS ── */}
        <div className="flex bg-gray-100/50 p-1 rounded-2xl border border-gray-200/50 backdrop-blur-sm self-start mb-8">
          {(["bills", "deposits"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-8 py-3 rounded-xl text-[12px] font-bold uppercase tracking-widest transition-all ${tab === t ? "bg-white text-[#0B2B26] shadow-sm border border-gray-200/50" : "text-gray-400 hover:text-gray-600"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── Bills Tab ── */}
            {tab === "bills" && (
              <div>
                {/* ── UNPAID BILLS ONLY ── */}
                {unpaidBills.length > 0 && (
                  <div>
                    <div className="grid gap-4">
                      {unpaidBills.map(bill => (
                        <div key={bill.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-xl transition-all duration-300">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="text-[14px] font-bold text-[#0B2B26] mb-1">{bill.title}</p>
                              <p className="text-[12px] text-gray-500">Invoice: #{bill.id.split("-")[1]?.toUpperCase() || bill.id}</p>
                              <p className="text-[12px] text-gray-500">{new Date(bill.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[20px] font-bold font-outfit text-[#F59A25]">${bill.amount.toFixed(2)}</p>
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full mt-2">
                                <AlertTriangle size={12} /> Unpaid
                              </span>
                            </div>
                          </div>
                          {bill.note && <p className="text-[13px] text-gray-600 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">{bill.note}</p>}
                          
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setSelectedBill(bill)}
                              className="flex-1 bg-[#0B2B26] text-white py-3 rounded-xl font-bold text-[13px] hover:bg-[#123d36] transition-all flex items-center justify-center gap-2"
                            >
                              <CreditCard size={16} /> Pay Invoice
                            </button>
                            {bill.imageUrl && (
                              <button
                                onClick={() => window.open(bill.imageUrl, "_blank")}
                                className="flex items-center justify-center w-12 h-12 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-[#F59A25] transition-colors"
                                title="View Document"
                              >
                                <ExternalLink size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {bills.length === 0 && (
                  <div className="text-center py-20 bg-white border border-gray-100 rounded-3xl">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                      <FileText className="text-gray-400" size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">No Invoices</h3>
                    <p className="text-gray-500 text-sm">You have no billing records at this time.</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Deposits Tab ── */}
            {tab === "deposits" && (
              <div>
                {deposits.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <Wallet size={28} className="text-gray-300 mx-auto mb-3" />
                    <p className="font-outfit font-bold text-[#0B2B26] text-lg mb-1">No deposits yet</p>
                    <p className="text-gray-400 text-[14px] mb-5">Add funds to manage your shipments.</p>
                    <button onClick={() => { setShowDeposit(true); setStep(1); }} className="px-6 py-2.5 bg-[#0B2B26] text-white rounded-xl font-bold text-[13px]">Make a Deposit</button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                    {deposits.map(dep => (
                      <div key={dep.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/30 transition-colors">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${dep.method === "bitcoin" ? "bg-orange-50 border border-orange-100" : "bg-green-50 border border-green-100"}`}>
                          {dep.method === "bitcoin" ? <Bitcoin size={18} className="text-orange-500" /> : <DollarSign size={18} className="text-green-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[#0B2B26] text-[15px]">${dep.amount.toFixed(2)}</p>
                          <p className="text-[12px] text-gray-400 capitalize">{dep.method} · {new Date(dep.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${
                          dep.status === "approved" ? "bg-green-50 text-green-600 border-green-100"
                          : dep.status === "rejected" ? "bg-red-50 text-red-600 border-red-100"
                          : "bg-amber-50 text-amber-600 border-amber-100"
                        }`}>{dep.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── DEPOSIT MODAL ── */}
      {showDeposit && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[95vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              {step > 1 && step < 4 ? (
                <button onClick={() => setStep((step - 1) as DepositStep)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
                  <ArrowLeft size={18} className="text-gray-600" />
                </button>
              ) : <div className="w-9" />}
              <div className="flex gap-1.5">
                {[1,2,3].map(s => (
                  <div key={s} className={`h-1.5 rounded-full transition-all ${s <= Math.min(step, 3) ? "bg-[#F59A25] w-6" : "bg-gray-200 w-4"}`} />
                ))}
              </div>
              {step < 4 && (
                <button onClick={resetDeposit} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
                  <X size={18} className="text-gray-600" />
                </button>
              )}
              {step >= 4 && <div className="w-9" />}
            </div>

            {/* ── Step 1: Amount ── */}
            {step === 1 && (
              <div className="p-6">
                <h2 className="text-xl font-outfit font-bold text-[#0B2B26] mb-1">Deposit Funds</h2>
                <p className="text-sm text-gray-500 mb-6">Enter how much you want to deposit into your balance.</p>
                <div className="mb-6">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)}
                      className="w-full pl-9 pr-4 py-4 border-2 border-gray-200 rounded-xl text-lg font-bold text-[#0B2B26] outline-none focus:border-[#F59A25] transition-colors"
                    />
                  </div>
                </div>
                <button
                  disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                  onClick={() => setStep(2)}
                  className="w-full py-4 rounded-xl font-bold text-white text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#F59A25" }}
                >
                  Continue
                </button>
              </div>
            )}

            {/* ── Step 2: Method ── */}
            {step === 2 && (
              <div className="p-6">
                <h2 className="text-xl font-outfit font-bold text-[#0B2B26] mb-1">Payment Method</h2>
                <p className="text-sm text-gray-500 mb-6">Choose how you want to send <span className="font-bold text-[#0B2B26]">${parseFloat(depositAmount || "0").toFixed(2)}</span></p>
                <div className="space-y-3 mb-6">
                  {([
                    { id: "bitcoin", label: "Bitcoin", sub: "BTC network", icon: Bitcoin, color: "text-orange-500", bg: "bg-orange-50" },
                    { id: "usdt", label: "USDT (TRC-20)", sub: "Tron network", icon: DollarSign, color: "text-green-600", bg: "bg-green-50" },
                  ] as const).map(m => (
                    <button
                      key={m.id}
                      onClick={() => setDepositMethod(m.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${depositMethod === m.id ? "border-[#0B2B26] bg-[#0B2B26]/3" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${m.bg} shrink-0`}>
                        <m.icon size={20} className={m.color} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-[#0B2B26] text-sm">{m.label}</p>
                        <p className="text-xs text-gray-500">{m.sub}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${depositMethod === m.id ? "border-[#0B2B26] bg-[#0B2B26]" : "border-gray-300"}`}>
                        {depositMethod === m.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setStep(3)}
                  className="w-full py-4 rounded-xl font-bold text-white text-sm"
                  style={{ backgroundColor: "#F59A25" }}
                >
                  Continue
                </button>
              </div>
            )}

            {/* ── Step 3: QR + Address + Receipt ── */}
            {step === 3 && (
              <div className="p-6">
                <h2 className="text-xl font-outfit font-bold text-[#0B2B26] mb-1">Send Payment</h2>
                <p className="text-sm text-gray-500 mb-5">Send exactly <span className="font-bold text-[#0B2B26]">${parseFloat(depositAmount || "0").toFixed(2)}</span> worth of <span className="font-bold">{depositMethod === "bitcoin" ? "BTC" : "USDT (TRC-20)"}</span> to the address below.</p>

                {/* QR Code */}
                <div className="flex justify-center mb-4">
                  <div className="bg-white border-2 border-gray-100 rounded-xl p-3 shadow-sm">
                    <img src={qrUrl} alt="Wallet QR" className="w-44 h-44 rounded-lg" />
                  </div>
                </div>

                {/* Address */}
                <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2 mb-4">
                  <p className="flex-1 text-xs font-mono text-gray-700 break-all leading-relaxed">{walletAddr}</p>
                  <button
                    onClick={() => copyAddress(walletAddr)}
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-500" />}
                  </button>
                </div>

                {/* Warning */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex gap-3">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    <span className="font-bold">Important:</span> Only send <span className="font-bold">{depositMethod === "bitcoin" ? "Bitcoin (BTC)" : "USDT via TRC-20 network"}</span> to this address. Sending any other cryptocurrency or using a different network may result in <span className="font-bold">permanent loss of funds</span>.
                  </p>
                </div>

                {/* Receipt Upload */}
                <div className="mb-5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Upload Payment Receipt</label>
                  <label className={`flex items-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${receiptFile ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-gray-300 bg-gray-50"}`}>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleReceiptUpload} />
                    {receiptFile ? (
                      <><Check size={18} className="text-green-500 shrink-0" /><p className="text-sm font-medium text-green-700 truncate">{receiptName}</p></>
                    ) : (
                      <><Upload size={18} className="text-gray-400 shrink-0" /><p className="text-sm text-gray-500">Tap to upload receipt (image or PDF)</p></>
                    )}
                  </label>
                </div>

                <button
                  disabled={!receiptFile}
                  onClick={handleSentIt}
                  className="w-full py-4 rounded-xl font-bold text-white text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#0B2B26" }}
                >
                  I've Sent It
                </button>
              </div>
            )}

            {/* ── Step 4: Loading ── */}
            {step === 4 && (
              <div className="p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-[#F59A25]/10 flex items-center justify-center mx-auto mb-6">
                  <Loader2 size={28} className="text-[#F59A25] animate-spin" />
                </div>
                <h2 className="text-xl font-outfit font-bold text-[#0B2B26] mb-2">Processing...</h2>
                <p className="text-sm text-gray-500">Submitting your deposit request</p>
              </div>
            )}

            {/* ── Step 5: Pending confirmation ── */}
            {step === 5 && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-100 flex items-center justify-center mx-auto mb-5">
                  <Clock size={28} className="text-amber-500" />
                </div>
                <h2 className="text-xl font-outfit font-bold text-[#0B2B26] mb-2">Deposit Submitted!</h2>
                <p className="text-sm text-gray-600 mb-1">Your deposit is being reviewed.</p>
                <p className="text-sm font-bold text-amber-600 mb-6">This typically takes 5 to 30 minutes.</p>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-3 text-left">
                  <Bell size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">You will receive a notification once your deposit has been approved and the balance has been credited to your account.</p>
                </div>
                <button
                  onClick={() => { resetDeposit(); navigate("/dashboard"); }}
                  className="w-full py-4 rounded-xl font-bold text-white text-sm"
                  style={{ backgroundColor: "#0B2B26" }}
                >
                  Go to Dashboard
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── BILL DETAIL MODAL ── */}
      {selectedBill && (
        <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelectedBill(null)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#0B2B26] flex items-center justify-center shrink-0">
                  <img src="/swiftly_logo-removebg-preview.png" alt="S" className="h-4 w-auto brightness-0 invert" />
                </div>
                <div className="min-w-0">
                  <p className="font-outfit font-bold text-[#0B2B26] text-[15px] truncate">{selectedBill.title || "Invoice"}</p>
                  <p className="text-[11px] text-gray-400">{new Date(selectedBill.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${selectedBill.status === "paid" ? "bg-green-50 text-green-600 border border-green-100" : "bg-red-50 text-red-500 border border-red-100"}`}>{selectedBill.status}</span>
                <button onClick={() => setSelectedBill(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                  <X size={16} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              
              {/* Amount */}
              <div className="text-center py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{selectedBill.status === "paid" ? "Amount Paid" : "Amount Due"}</p>
                <p className="text-[36px] font-outfit font-bold text-[#0B2B26] leading-none tracking-tight">${selectedBill.amount.toFixed(2)}</p>
                <p className="text-[11px] text-gray-400 font-mono mt-2">#{selectedBill.id.slice(0, 12)}</p>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-100" />

              {/* Note */}
              {selectedBill.note && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Details</p>
                  <p className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedBill.note}</p>
                </div>
              )}

              {/* Attachment */}
              {selectedBill.imageUrl && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1">
                    <Paperclip size={10} /> Attachment
                  </p>
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                      <img src={selectedBill.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                    </div>
                    <p className="text-[13px] text-[#0B2B26] font-medium truncate flex-1">{selectedBill.imageFileName || "document.png"}</p>
                    <a href={selectedBill.imageUrl} download={selectedBill.imageFileName || "attachment.png"} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#0B2B26] hover:bg-white transition-all shrink-0">
                      <Download size={15} />
                    </a>
                  </div>
                </div>
              )}

              {/* Signature */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0B2B26] flex items-center justify-center shrink-0">
                    <img src="/swiftly_logo-removebg-preview.png" alt="S" className="h-4 w-auto brightness-0 invert" />
                  </div>
                  <div className="w-[2px] h-6 rounded-full bg-[#F59A25]" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-[#0B2B26] leading-tight">Swiftly Logix <span className="font-normal text-[#8EB69B]">|</span> <span className="font-normal text-gray-400 text-[11px]">Billing</span></p>
                    <p className="text-[10px] text-gray-400 truncate">billing@swiftlylogistics.com</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pay Footer */}
            {selectedBill.status === "unpaid" && (
              <div className="px-5 py-4 border-t border-gray-100 shrink-0">
                <button
                  onClick={() => payBill(selectedBill)}
                  className="w-full py-3.5 rounded-xl font-bold text-white text-[14px] transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 bg-[#0B2B26] hover:bg-[#235347] shadow-md"
                >
                  Pay ${selectedBill.amount.toFixed(2)} <ChevronRight size={15} />
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
