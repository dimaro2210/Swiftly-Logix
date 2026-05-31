import { useState, useEffect } from "react";
import { saveShipment, getShipments, deleteShipment, generateTrackingNumber, getRegisteredUsers, getShipmentsForUser, getFullUserAccount, LOGISTICS_CENTERS, updateRegisteredUser } from "@/lib/shipmentStore";
import type { Shipment, RegisteredUser } from "@/lib/shipmentStore";
import { getBills, saveBill, getDeposits, saveDeposit, getUserBalance, setUserBalance, saveNotification, generateId, getWalletAddresses, saveWalletAddresses } from "@/lib/billingStore";
import { sendShipmentEmail, sendBillEmail, sendDepositEmail, sendAccountEmail } from "@/lib/emailService";
import type { Bill, Deposit } from "@/lib/billingStore";
import { generateTransitWaypoints } from "@/lib/waypointEngine";
import { Link } from "wouter";
import { Package, MapPin, User, Save, CheckCircle, RefreshCw, Copy, Pencil, Trash2, X, AlertCircle, List, ArrowLeft, Menu, ChevronRight, Eye, EyeOff, CreditCard, DollarSign, FileText, Check, XCircle, Plane, Plus, Loader2, Route, Navigation, Settings, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";

const BLANK_FORM = {
  origin: "",
  destination: "",
  carrier: "SWIFTLY LOGIX",
  shipment_type: "Ground",
  sender_name: "",
  sender_email: "",
  sender_phone: "",
  sender_address: "",
  receiver_name: "",
  receiver_email: "",
  receiver_phone: "",
  receiver_address: "",
  contents: "",
  weight: "",
  departure_date: "",
  departure_time: "",
  expected_delivery_date: "",
  current_status: "Pending",
  current_location: "",
  notice: "",
};

// ── Shared Styles ─────────────────────────────────────────
const inp = "w-full bg-white border border-gray-200 shadow-sm rounded-xl px-4 py-3 text-swiftly-deep focus:outline-none focus:border-[#F59A25] transition-colors";
const sel = "w-full bg-white border border-gray-200 shadow-sm rounded-xl px-4 py-3 text-swiftly-deep focus:outline-none focus:border-[#F59A25] transition-colors";
const lbl = "block text-gray-500 text-[13px] font-bold uppercase tracking-wider mb-2";

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white shadow-xl border-gray-200 backdrop-blur-xl border border-gray-300 rounded-[20px] sm:rounded-[28px] md:rounded-[32px] p-4 sm:p-6 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden">
      <h2 className="text-[18px] sm:text-[20px] md:text-[22px] font-outfit font-bold text-swiftly-deep mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 border-b border-gray-200 pb-3 sm:pb-4 relative z-10">
        {icon} {title}
      </h2>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className={lbl}>{label}</label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Delivered": "bg-green-50 text-green-600 border-green-200",
    "In Transit": "bg-blue-50 text-blue-600 border-blue-200",
    "Out for Delivery": "bg-[#F59A25]/20 text-[#F59A25] border-[#F59A25]/30",
    "Exception": "bg-red-50 text-red-600 border-red-200",
    "Pending": "bg-white border-gray-200 text-swiftly-deep/60 border-gray-200",
    "Label Created": "bg-purple-50 text-purple-600 border-purple-200",
    "Picked Up": "bg-cyan-50 text-cyan-600 border-cyan-200",
  };
  const cls = map[status] || "bg-white border-gray-200 text-swiftly-deep/60 border-gray-200";
  return (
    <span className={`px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider border ${cls}`}>{status}</span>
  );
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | false>(false);

  const [tab, setTab] = useState<"create" | "manage" | "users" | "billing" | "deposits" | "settings" | "requests">("create");
  const [formData, setFormData] = useState({ ...BLANK_FORM });
  const [message, setMessage] = useState({ type: "", text: "" });
  const [lastCode, setLastCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Target User for new shipments
  const [targetUserEmail, setTargetUserEmail] = useState<string>("");

  // Manage tab state
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Shipment>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [manageMsg, setManageMsg] = useState({ type: "", text: "" });

  // Users tab state
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Billing tab state
  const [billAmount, setBillAmount] = useState("");
  const [billTitle, setBillTitle] = useState("");
  const [billNote, setBillNote] = useState("");
  const [billImage, setBillImage] = useState<string | null>(null);
  const [billImageName, setBillImageName] = useState("");
  const [billUserEmail, setBillUserEmail] = useState("");
  const [billMsg, setBillMsg] = useState({ type: "", text: "" });
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [allDeposits, setAllDeposits] = useState<Deposit[]>([]);

  // Waypoint generation state
  const [waypointLoading, setWaypointLoading] = useState(false);
  const [waypointMsg, setWaypointMsg] = useState({ type: "", text: "" });
  const [editingWaypoints, setEditingWaypoints] = useState<string | null>(null); // shipment ID
  const [newWpCenter, setNewWpCenter] = useState("");

  // Settings tab state
  const [wallets, setWallets] = useState({ bitcoin: "", usdt: "" });
  const [settingsMsg, setSettingsMsg] = useState({ type: "", text: "" });

  const refreshShipments = async () => setShipments(await getShipments());
  const refreshUsers = async () => setUsers(await getRegisteredUsers());
  const refreshBilling = async () => { setAllBills(await getBills()); setAllDeposits(await getDeposits()); setWallets(await getWalletAddresses()); };

  useEffect(() => {
    refreshShipments();
    refreshUsers();
    refreshBilling();
  }, [tab]);

  // ── Handlers: Create ────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const sSenderName = formData.sender_name.trim();
    const sSenderEmail = formData.sender_email.trim();
    const sReceiverName = formData.receiver_name.trim();
    const sReceiverEmail = formData.receiver_email.trim();
    
    if (!sSenderName || !sReceiverName || !sReceiverEmail) {
      setMessage({ type: "error", text: "Please fill in all required fields (Sender Name, Receiver Name, and Receiver Email)." });
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sReceiverEmail)) {
      setMessage({ type: "error", text: "Please enter a valid receiver email address." });
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
      return;
    }

    try {
      const generatedCode = generateTrackingNumber();
      const newShipment: Shipment = {
        id: `admin-${Date.now()}`,
        trackingNumber: generatedCode,
        tracking_code: generatedCode,
        status: formData.current_status,
        current_status: formData.current_status,
        service: formData.shipment_type,
        weight: formData.weight || "0",
        createdAt: new Date().toISOString(),
        events: [],
        origin: formData.sender_address.trim(),
        destination: formData.receiver_address.trim(),
        carrier: formData.carrier.trim(),
        shipment_type: formData.shipment_type,
        sender_name: sSenderName,
        sender_email: sSenderEmail,
        sender_phone: formData.sender_phone.trim(),
        sender_address: formData.sender_address.trim(),
        receiver_name: sReceiverName,
        receiver_email: sReceiverEmail,
        receiver_phone: formData.receiver_phone.trim(),
        receiver_address: formData.receiver_address.trim(),
        contents: formData.contents.trim(),
        departure_date: formData.departure_date,
        departure_time: formData.departure_time,
        expected_delivery_date: formData.expected_delivery_date,
        current_location: formData.sender_address,
        notice: formData.notice,
        userEmail: targetUserEmail || formData.receiver_email || undefined,
      };

      await saveShipment(newShipment);
      if (newShipment.receiver_email) sendShipmentEmail(newShipment);
      setLastCode(generatedCode);
      setMessage({ type: "success", text: "Shipment created successfully!" });
      setFormData({ ...BLANK_FORM });
      setTargetUserEmail("");
      setTimeout(() => setMessage({ type: "", text: "" }), 12000);

      // ── Auto-generate transit waypoints in background ──
      if (formData.sender_address && formData.receiver_address) {
        setWaypointLoading(true);
        setWaypointMsg({ type: "", text: "" });
        generateTransitWaypoints(formData.sender_address, formData.receiver_address)
          .then(async (result) => {
            if (result.error) {
              setWaypointMsg({ type: "error", text: `Route generation failed: ${result.error}. You can add waypoints manually.` });
            } else if (result.waypoints.length > 0) {
              newShipment.transit_waypoints = result.waypoints;
              await saveShipment(newShipment);
              refreshShipments();
              setWaypointMsg({ type: "success", text: `✅ Auto-generated ${result.waypoints.length} transit locations` });
            }
          })
          .catch(() => {
            setWaypointMsg({ type: "error", text: "Route generation failed. You can add waypoints manually from Manage Shipments." });
          })
          .finally(() => setWaypointLoading(false));
      }
    } catch {
      setMessage({ type: "error", text: "Failed to create shipment. Please try again." });
    }
  };

  // ── Handlers: Manage ────────────────────────────────────────────
  const startEdit = (s: Shipment) => {
    setEditingId(s.id);
    setEditData({
      origin: s.origin || s.from?.city || "",
      destination: s.destination || s.to?.city || "",
      carrier: s.carrier || "",
      shipment_type: s.shipment_type || s.service || "",
      sender_name: s.sender_name || s.from?.name || "",
      receiver_name: s.receiver_name || s.to?.name || "",
      receiver_email: s.receiver_email || "",
      receiver_phone: s.receiver_phone || "",
      contents: s.contents || "",
      weight: s.weight || "",
      expected_delivery_date: s.expected_delivery_date || s.estimatedDelivery || "",
      current_status: s.status || s.current_status || "",
      current_location: s.current_location || "",
      notice: s.notice || "",
      sender_address: s.sender_address || s.origin || "",
      receiver_address: s.receiver_address || s.destination || "",
    });
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const saveEdit = async (s: Shipment) => {
    const updated: Shipment = {
      ...s,
      ...editData,
      status: (editData.current_status as string) || s.status,
      current_status: (editData.current_status as string) || s.current_status,
      service: (editData.shipment_type as string) || s.service,
      userEmail: s.userEmail || (editData.receiver_email as string) || undefined,
      origin: editData.sender_address !== undefined ? (editData.sender_address as string) : s.origin,
      destination: editData.receiver_address !== undefined ? (editData.receiver_address as string) : s.destination,
      sender_address: editData.sender_address !== undefined ? (editData.sender_address as string) : s.sender_address,
      receiver_address: editData.receiver_address !== undefined ? (editData.receiver_address as string) : s.receiver_address,
    };

    const prevStatus = s.status || s.current_status || "";
    const newStatus = updated.status;
    const newLoc = (editData.current_location as string) || "";
    if ((newStatus !== prevStatus || newLoc) && newLoc) {
      const center = LOGISTICS_CENTERS.find(c => c.name === newLoc);
      updated.events = [
        {
          status: newStatus,
          location: newLoc,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          coordinates: center ? { lat: center.lat, lng: center.lng } : undefined,
        },
        ...(s.events || []),
      ];
    }

    await saveShipment(updated);
    setEditingId(null);
    refreshShipments();
    setManageMsg({ type: "success", text: "Shipment updated successfully!" });
    setTimeout(() => setManageMsg({ type: "", text: "" }), 5000);
  };

  const confirmDelete = async (id: string) => {
    await deleteShipment(id);
    setDeleteConfirm(null);
    refreshShipments();
    setManageMsg({ type: "success", text: "Shipment deleted." });
    setTimeout(() => setManageMsg({ type: "", text: "" }), 4000);
  };

  const selectUserForShipment = (u: RegisteredUser) => {
    setTargetUserEmail(u.email);
    setFormData({
      ...BLANK_FORM,
      sender_name: "SWIFTLY LOGIX Admin",
      receiver_name: `${u.firstName} ${u.lastName}`,
      receiver_email: u.email,
    });
    setTab("create");
    setSidebarOpen(false);
  };


  if (!isAuthenticated) {
    return (
      <div className="bg-[#FFF7E1] min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#F59A25]/10 rounded-full blur-[120px] pointer-events-none mix-blend-multiply" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-[#8EB69B]/20 rounded-full blur-[150px] pointer-events-none mix-blend-multiply" />

        <div className="bg-white border border-gray-200 rounded-[32px] p-8 max-w-md w-full shadow-2xl relative z-10 text-center">
          <img src={`${import.meta.env.BASE_URL}swiftly_logo-removebg-preview.png`} alt="Swiftly Logix" className="h-24 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-[#0B2B26] mb-2">Admin Access Required</h1>
          <p className="text-[#235347] mb-8">Please enter the administrator password to continue.</p>

          <form onSubmit={async (e) => {
            e.preventDefault();
            if (password === "Swiftly@768") { 
              // Authenticate as the master admin in the background so Supabase RLS allows fetching data
              const { error } = await supabase.auth.signInWithPassword({ email: 'admin@swiftlylogix.com', password: 'Swiftly@768' });
              if (error) {
                setAuthError(error.message);
              } else {
                setIsAuthenticated(true); 
                setAuthError(false); 
              }
            }
            else { setAuthError("Incorrect password."); }
          }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center text-[#0B2B26] focus:outline-none focus:border-[#F59A25] transition-colors mb-4"
            />
            {authError && <p className="text-red-500 text-sm mb-4">{authError}</p>}
            <button type="submit" className="w-full py-3 rounded-full bg-[#F59A25] text-white font-bold hover:bg-[#D38215] transition-colors">
              Access Dashboard
            </button>
          </form>
          <Link href="/">
            <p className="text-gray-500 text-sm mt-6 cursor-pointer hover:text-[#0B2B26] transition-colors">Return to public site</p>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-swiftly-cream min-h-screen relative overflow-hidden font-sans flex">
      {/* Liquid Glass Background Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#F59A25]/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-[#8EB69B]/10 rounded-full blur-[150px] pointer-events-none mix-blend-screen" />

      {/* ════════════════ NAVIGATION SIDEBAR ════════════════ */}
      <div className={`fixed inset-y-0 left-0 z-[100] w-64 md:w-72 border-r border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col ${sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0 lg:static"} lg:shadow-none`} style={{ background: 'linear-gradient(180deg, #0B2B26 0%, #123d36 50%, #0B2B26 100%)' }}>
        <div className="h-16 md:h-20 flex items-center justify-between px-4 md:px-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <img src={`${import.meta.env.BASE_URL}swiftly_logo-removebg-preview.png`} alt="Swiftly Logix" className="h-10 md:h-12 shrink-0" />
            <span className="text-white font-bold text-[13px] md:text-[14px] tracking-wide truncate">Swiftly Logix Admin</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50 hover:text-white transition-colors shrink-0 ml-2">
            <X size={22} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 md:p-4 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-4 pt-2 pb-3">Shipments</p>
          {[
            { id: "create" as const, label: "Create Shipment", icon: <Package size={18} /> },
            { id: "manage" as const, label: "Manage Shipments", icon: <List size={18} /> },
            { id: "requests" as const, label: "Delivery Requests", icon: <AlertCircle size={18} />, badge: shipments.filter(s => s.changeRequest?.status === "pending").length },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); setSidebarOpen(false); if (item.id === "manage") refreshShipments(); }}
              className={`w-full text-left flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl font-bold text-[13px] md:text-[14px] transition-all border ${tab === item.id ? "bg-[#F59A25]/20 border-[#F59A25]/40 text-white" : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"
                }`}
            >
              <span className={tab === item.id ? "text-[#F59A25]" : "text-white/40"}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-4 pt-6 pb-3">Users & Finance</p>
          {[
            { id: "users" as const, label: "Approvals & Users", icon: <User size={18} />, badge: users.filter(u => u.status === "pending").length },
            { id: "billing" as const, label: "Billing", icon: <CreditCard size={18} /> },
            { id: "deposits" as const, label: "Deposits", icon: <DollarSign size={18} />, badge: allDeposits.filter(d => d.status === "pending").length },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); setSidebarOpen(false); if (item.id === "billing" || item.id === "deposits") refreshBilling(); if (item.id === "users") refreshUsers(); }}
              className={`w-full text-left flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl font-bold text-[13px] md:text-[14px] transition-all border ${tab === item.id ? "bg-[#F59A25]/20 border-[#F59A25]/40 text-white" : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"
                }`}
            >
              <span className={tab === item.id ? "text-[#F59A25]" : "text-white/40"}>{item.icon}</span>
              {item.label}
              {item.badge ? <span className="ml-auto text-[11px] font-bold bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center">{item.badge}</span> : null}
            </button>
          ))}
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-4 pt-6 pb-3">System</p>
          {[
            { id: "settings" as const, label: "Settings", icon: <Settings size={18} /> },
          ].map(item => (
            <button
              key={item.id}
              onClick={async () => { setTab(item.id); setSidebarOpen(false); if (item.id === "settings") setWallets(await getWalletAddresses()); }}
              className={`w-full text-left flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl font-bold text-[13px] md:text-[14px] transition-all border ${tab === item.id ? "bg-[#F59A25]/20 border-[#F59A25]/40 text-white" : "border-transparent text-white/60 hover:bg-white/5 hover:text-white"
                }`}
            >
              <span className={tab === item.id ? "text-[#F59A25]" : "text-white/40"}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 md:p-4 border-t border-white/10 shrink-0">
          <Link href="/">
            <button className="w-full flex items-center justify-center gap-2 px-3 md:px-4 py-2.5 md:py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-[13px] md:text-[14px] transition-colors border border-white/10">
              <ArrowLeft size={16} /> Back to Site
            </button>
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 h-screen overflow-y-auto overflow-x-hidden">
        {/* Admin Header — Liquid Glass matching main site */}
        <header
          className="sticky top-0 z-50 transition-all duration-500 border-b h-14 md:h-20 shadow-[0_8px_32px_rgba(11,43,38,0.05)] shrink-0"
          style={{
            background: 'linear-gradient(180deg, rgba(255,247,225,0.95) 0%, rgba(255,247,225,0.98) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderColor: 'rgba(11,43,38,0.10)',
          }}
        >
          <div className="px-3 md:px-8 h-full flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center cursor-pointer group gap-2 md:gap-3">
                <img src={`${import.meta.env.BASE_URL}swiftly_logo-removebg-preview.png`} alt="Swiftly Logix" className="h-12 md:h-20 transition-all duration-300 group-hover:scale-105" />
                <span className="font-bold tracking-widest text-[12px] md:text-[18px] text-[#0B2B26]">
                  Swiftly Logix Admin
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              {/* Desktop: show a subtle status pill */}
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full border" style={{ background: 'rgba(11,43,38,0.05)', borderColor: 'rgba(11,43,38,0.10)' }}>
                <div className="w-2 h-2 rounded-full bg-[#F59A25] animate-pulse" />
                <span className="text-[#0B2B26]/80 text-[13px] font-medium">Control Panel Active</span>
              </div>
              {/* Mobile hamburger — right side */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2.5 rounded-xl transition-all"
                style={{ background: 'rgba(11,43,38,0.05)', border: '1px solid rgba(11,43,38,0.10)' }}
              >
                <Menu size={22} className="text-[#0B2B26]" />
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-6xl w-full mx-auto px-3 sm:px-4 md:px-8 pt-4 sm:pt-8 md:pt-12 pb-24">

          {/* ════════════════ USER LIST (no user selected) ════════════════ */}
          {tab === "users" && !selectedUser && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-widest text-[#F59A25] mb-2">User Management & Approvals</p>
                  <h2 className="text-[22px] sm:text-[28px] md:text-[36px] font-outfit font-bold text-swiftly-deep">All Users ({users.length})</h2>
                </div>
              </div>
              {users.length === 0 ? (
                <div className="bg-white shadow-sm border-gray-200 text-swiftly-deep border border-gray-200 rounded-[24px] p-16 text-center">
                  <User size={40} className="text-swiftly-deep/20 mx-auto mb-4" />
                  <p className="text-gray-500 font-bold text-lg">No registered users yet</p>
                  <p className="text-swiftly-deep/25 text-sm mt-1">Users will appear here once they sign up.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...users].sort((a, b) => (a.status === "pending" ? -1 : b.status === "pending" ? 1 : 0)).map(u => (
                    <button
                      key={u.email}
                      onClick={() => setSelectedUser(u)}
                      className="bg-white shadow-sm border-gray-200 text-swiftly-deep hover:bg-white shadow-xl border-gray-200 border border-gray-200 hover:border-[#F59A25]/30 rounded-[20px] p-5 text-left transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center font-bold text-[#F59A25] text-lg shrink-0 group-hover:scale-105 transition-transform">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-bold text-swiftly-deep text-[15px] truncate">{u.firstName} {u.lastName}</p>
                          <p className="text-gray-500 text-[12px] truncate">{u.email}</p>
                        </div>
                        <ChevronRight size={16} className="ml-auto text-swiftly-deep/20 group-hover:text-[#F59A25] transition-colors shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F59A25]/10 text-[#F59A25] border border-[#F59A25]/20">{u.accountType}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{u.userId}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${(u.status || 'pending') === 'approved' ? 'bg-green-50 text-green-600 border-green-200' : (u.status || 'pending') === 'declined' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-yellow-50 text-yellow-600 border-yellow-200'}`}>
                          {u.status || 'pending'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ USER DETAILS TAB ════════════════ */}
          {tab === "users" && selectedUser && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button onClick={() => setSelectedUser(null)} className="flex items-center gap-2 text-swiftly-deep/60 hover:text-swiftly-deep font-bold text-[14px] mb-6 transition-colors">
                <ArrowLeft size={16} /> Back to Users
              </button>
              <div className="bg-white shadow-sm border-gray-200 text-swiftly-deep backdrop-blur-xl border border-gray-200 rounded-[24px] md:rounded-[32px] overflow-hidden shadow-2xl relative">

                {/* Hero Header */}
                <div className="relative h-32 md:h-48 w-full bg-gradient-to-r from-[#0B2B26] via-[#123d36] to-[#0B2B26]">
                  <div className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at center, #F59A25 0%, transparent 70%)' }} />
                  {/* Avatar overlapping header */}
                  <div className="absolute -bottom-12 md:-bottom-16 left-6 md:left-12 flex items-end gap-4 md:gap-6">
                    <div className="relative">
                      {selectedUser.profilePicture ? (
                        <img src={selectedUser.profilePicture} alt="Profile" className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-[#0B2B26] shadow-xl bg-white shadow-sm border-gray-200 text-swiftly-deep" />
                      ) : (
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white shadow-sm border-gray-200 text-swiftly-deep border-4 border-[#0B2B26] shadow-xl flex items-center justify-center text-[36px] md:text-[48px] font-bold text-[#F59A25]">
                          {selectedUser.firstName[0]}{selectedUser.lastName[0]}
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 md:bottom-2 md:right-2 w-6 h-6 md:w-8 md:h-8 bg-[#DAF1DE] border-2 md:border-4 border-[#0B2B26] rounded-full flex items-center justify-center shadow-lg" title="Verified Account">
                        <CheckCircle className="text-[#235347] w-3 h-3 md:w-4 md:h-4" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile Content */}
                <div className="pt-16 md:pt-20 px-6 md:px-12 pb-8 md:pb-12">

                  {/* Name and Basic Info */}
                  <div className="mb-8">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="px-3 py-1 rounded-full text-[10px] md:text-[12px] font-bold uppercase tracking-widest bg-[#F59A25]/10 text-[#F59A25] border border-[#F59A25]/20">
                        {selectedUser.accountType} Account
                      </span>
                      <span className="px-3 py-1 rounded-full text-[10px] md:text-[12px] font-bold font-mono bg-white shadow-sm border-gray-200 text-swiftly-deep text-gray-500 border border-gray-200">
                        ID: {selectedUser.userId}
                      </span>
                    </div>
                    <h2 className="text-[28px] md:text-[42px] font-outfit font-bold text-swiftly-deep leading-tight mb-1">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </h2>
                    {selectedUser.company && (
                      <p className="text-[#F59A25] text-[16px] md:text-[18px] font-medium flex items-center gap-2">
                        <span className="opacity-70">🏢</span> {selectedUser.company}
                      </p>
                    )}
                  </div>

                  {/* Detailed Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {/* Contact Info */}
                    <div className="bg-white shadow-sm border-gray-200 text-swiftly-deep rounded-2xl p-5 border border-gray-200 sm:col-span-2 lg:col-span-1 flex flex-col justify-center">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2">
                        <span>✉️</span> Email Address
                      </p>
                      <p className="text-[15px] md:text-[16px] font-medium text-swiftly-deep truncate" title={selectedUser.email}>{selectedUser.email}</p>
                    </div>

                    {/* Address Info */}
                    <div className="bg-white shadow-sm border-gray-200 text-swiftly-deep rounded-2xl p-5 border border-gray-200 sm:col-span-2 lg:col-span-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2">
                            <span>🏠</span> Registered Address
                          </p>
                          <p className="text-[14px] md:text-[15px] font-medium text-swiftly-deep leading-snug">
                            {selectedUser.address || "No address provided"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1 flex items-center gap-2">
                            <span>📮</span> Postal Code
                          </p>
                          <p className="text-[14px] md:text-[15px] font-medium text-swiftly-deep">
                            {selectedUser.postalCode || "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Security Info (Password) */}
                    <div className="bg-white shadow-sm border-gray-200 text-swiftly-deep rounded-2xl p-5 border border-gray-200 sm:col-span-2 lg:col-span-3">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
                        <span>🔒</span> Account Password
                      </p>
                      <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-3 sm:px-4 py-3 border border-gray-200 w-full sm:w-fit overflow-x-auto">
                        <span className={`font-mono text-[16px] tracking-wider ${showPassword ? 'text-swiftly-deep' : 'text-gray-500 select-none'}`}>
                          {showPassword ? "Secured by Supabase" : "••••••••••••"}
                        </span>
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-500 hover:text-[#F59A25] transition-colors ml-4 focus:outline-none"
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stats & Action Row */}
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 lg:flex-row lg:items-end">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto flex-1">
                      <div className="bg-white/50 rounded-2xl p-5 border border-[#123d36] flex flex-col justify-center items-center text-center">
                        <p className="text-[11px] md:text-[12px] font-bold uppercase tracking-widest text-gray-500 mb-2">Total Shipments</p>
                        <p className="text-[32px] md:text-[40px] font-outfit font-bold text-swiftly-deep leading-none">
                            {shipments.filter(s => s.userEmail === selectedUser.email || s.receiver_email === selectedUser.email || s.sender_email === selectedUser.email).length}
                        </p>
                      </div>
                      <div className="bg-[#F59A25]/10 rounded-2xl p-5 border border-[#F59A25]/20 flex flex-col justify-center items-center text-center">
                        <p className="text-[11px] md:text-[12px] font-bold uppercase tracking-widest text-[#F59A25]/70 mb-2">Account Status</p>
                        <select 
                          value={selectedUser.status || "pending"} 
                          onChange={async (e) => {
                            const newStatus = e.target.value as "pending" | "approved" | "declined";
                            const updatedUser = { ...selectedUser, status: newStatus };
                            await updateRegisteredUser(updatedUser);
                            if (newStatus === "approved" || newStatus === "declined") {
                              sendAccountEmail(updatedUser.email, newStatus);
                            }
                            setSelectedUser(updatedUser);
                            refreshUsers();
                          }}
                          className={`mt-1 font-outfit font-bold text-[18px] md:text-[22px] bg-transparent outline-none cursor-pointer text-center ${(selectedUser.status || "pending") === 'approved' ? 'text-green-600' : (selectedUser.status || "pending") === 'declined' ? 'text-red-600' : 'text-[#F59A25]'}`}
                        >
                          <option value="pending" className="text-black">Pending</option>
                          <option value="approved" className="text-black">Approved</option>
                          <option value="declined" className="text-black">Declined</option>
                        </select>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => selectUserForShipment(selectedUser)}
                      className="w-full sm:w-auto h-auto py-4 sm:py-5 lg:py-0 lg:h-[120px] px-6 sm:px-8 rounded-2xl bg-[#F59A25] hover:bg-[#D38215] text-swiftly-deep font-bold text-[15px] md:text-[18px] shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 group transform hover:-translate-y-1"
                    >
                      <Package size={28} className="group-hover:scale-110 transition-transform duration-300" />
                      <span className="flex items-center gap-2">
                        Create Shipment <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </span>
                    </button>
                  </div>

                  {/* ── Pending Deposits ── */}
                  {(() => {
                    const userDeposits = allDeposits.filter(d => d.userEmail.toLowerCase() === selectedUser.email.toLowerCase());
                    const pending = userDeposits.filter(d => d.status === "pending");
                    if (userDeposits.length === 0) return null;
                    return (
                      <div className="mt-8 pt-8 border-t border-gray-200">
                        <h3 className="text-[16px] font-bold text-swiftly-deep mb-4 flex items-center gap-2"><DollarSign size={18} className="text-[#F59A25]" /> Deposits ({pending.length} pending)</h3>
                        <div className="space-y-3">
                          {userDeposits.map(dep => (
                            <div key={dep.id} className="bg-white shadow-sm border-gray-200 text-swiftly-deep border border-gray-200 rounded-xl p-3 sm:p-4 flex flex-col gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-swiftly-deep font-bold">${dep.amount.toFixed(2)} <span className="text-gray-500 text-xs font-normal capitalize">via {dep.method}</span></p>
                                <p className="text-gray-500 text-xs">{new Date(dep.createdAt).toLocaleString()}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {dep.receiptImage && <a href={dep.receiptImage} target="_blank" rel="noreferrer" className="text-[#F59A25] text-xs font-bold hover:underline shrink-0">View Receipt</a>}
                                {dep.status === "pending" ? (
                                  <div className="flex gap-2">
                                    <button onClick={async () => {
                                      await saveDeposit({ ...dep, status: "approved", reviewedAt: new Date().toISOString() });
                                      sendDepositEmail(dep.userEmail, dep.amount, "approved");
                                      const bal = await getUserBalance(dep.userEmail);
                                      await setUserBalance(dep.userEmail, bal + dep.amount);
                                      await saveNotification({ id: generateId("notif"), userEmail: dep.userEmail, type: "deposit_approved", title: "Deposit Approved", body: `Your deposit of $${dep.amount.toFixed(2)} has been approved and credited.`, read: false, createdAt: new Date().toISOString() });
                                      refreshBilling();
                                    }} className="px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-600 text-xs font-bold hover:bg-green-500/30 transition-colors flex items-center gap-1"><Check size={14} /> Approve</button>
                                    <button onClick={async () => {
                                      await saveDeposit({ ...dep, status: "rejected", reviewedAt: new Date().toISOString() });
                                      sendDepositEmail(dep.userEmail, dep.amount, "rejected");
                                      await saveNotification({ id: generateId("notif"), userEmail: dep.userEmail, type: "deposit_rejected", title: "Deposit Rejected", body: `Your deposit of $${dep.amount.toFixed(2)} was not approved.`, read: false, createdAt: new Date().toISOString() });
                                      refreshBilling();
                                    }} className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-bold hover:bg-red-500/30 transition-colors flex items-center gap-1"><XCircle size={14} /> Reject</button>
                                  </div>
                                ) : (
                                  <span className={`text-xs font-bold uppercase px-2 py-1 rounded-lg ${dep.status === "approved" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>{dep.status}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>
            </div>
          )}

          {/* ════════════════ BILLING TAB ════════════════ */}
          {tab === "billing" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">

              {billMsg.text && (
                <div className={`p-4 rounded-2xl border flex items-center gap-3 font-bold text-[15px] ${billMsg.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  <CheckCircle size={20} /> {billMsg.text}
                </div>
              )}

              {/* ── Gmail-Style Compose Window ── */}
              <div className="bg-white rounded-[24px] shadow-xl border border-gray-200 overflow-hidden">
                {/* Compose Header Bar — like Gmail dark header */}
                <div className="bg-swiftly-deep px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-swiftly-orange/20 flex items-center justify-center">
                      <Pencil size={14} className="text-swiftly-orange" />
                    </div>
                    <h2 className="text-white font-bold text-[16px] tracking-wide">New Bill</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-[11px] font-bold uppercase tracking-widest">Compose</span>
                  </div>
                </div>

                {/* To / Subject / Amount fields — Gmail style rows */}
                <div className="divide-y divide-gray-100">
                  {/* To Field */}
                  <div className="flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-3 gap-2 sm:gap-3">
                    <span className="text-gray-400 text-[14px] font-medium w-16 shrink-0">To</span>
                    <select value={billUserEmail} onChange={e => setBillUserEmail(e.target.value)} className="flex-1 bg-transparent text-swiftly-deep text-[15px] font-medium outline-none border-none cursor-pointer">
                      <option value="">Select recipient...</option>
                      {users.map(u => <option key={u.email} value={u.email}>{u.firstName} {u.lastName} ({u.email})</option>)}
                    </select>
                  </div>

                  {/* Subject Field */}
                  <div className="flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-3 gap-2 sm:gap-3">
                    <span className="text-gray-400 text-[14px] font-medium w-16 shrink-0">Subject</span>
                    <input
                      value={billTitle}
                      onChange={e => setBillTitle(e.target.value)}
                      placeholder="Bill title — e.g. Insurance Fee, Service Charge..."
                      className="flex-1 bg-transparent text-swiftly-deep text-[15px] font-medium outline-none placeholder:text-gray-300"
                    />
                  </div>

                  {/* Amount Field */}
                  <div className="flex flex-col sm:flex-row sm:items-center px-4 sm:px-6 py-3 gap-2 sm:gap-3">
                    <span className="text-gray-400 text-[14px] font-medium w-16 shrink-0">Amount</span>
                    <div className="flex items-center gap-2">
                      <span className="text-swiftly-deep font-bold text-[16px]">$</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={billAmount}
                        onChange={e => setBillAmount(e.target.value)}
                        placeholder="0.00"
                        className="bg-transparent text-swiftly-deep text-[16px] font-bold outline-none w-32 placeholder:text-gray-300 placeholder:font-normal"
                      />
                      {billAmount && parseFloat(billAmount) > 0 && (
                        <span className="px-3 py-1 rounded-full bg-swiftly-orange/10 text-swiftly-orange text-[12px] font-bold border border-swiftly-orange/20">
                          USD {parseFloat(billAmount).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Body / Note — the compose area */}
                <div className="px-4 sm:px-6 py-4 min-h-[140px] sm:min-h-[180px]">
                  <textarea
                    value={billNote}
                    onChange={e => setBillNote(e.target.value)}
                    rows={7}
                    placeholder="Compose your bill message here...

Describe the purpose of this bill, what services are being charged, and any relevant details for the recipient."
                    className="w-full bg-transparent text-swiftly-deep text-[15px] leading-relaxed outline-none resize-none placeholder:text-gray-300"
                  />
                </div>

                {/* Attachment Chip — shows after upload */}
                {billImage && (
                  <div className="px-4 sm:px-6 pb-4">
                    <div className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors group">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-swiftly-deep font-bold text-[13px] truncate max-w-[200px]">{billImageName || "bill-attachment.png"}</p>
                        <p className="text-gray-400 text-[11px]">Image Attachment</p>
                      </div>
                      <button
                        onClick={() => { setBillImage(null); setBillImageName(""); }}
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Bottom Toolbar — Send + Attach */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <button
                      disabled={!billUserEmail || !billAmount || !billNote || !billTitle}
                      onClick={async () => {
                        const bill: Bill = { id: generateId("bill"), userEmail: billUserEmail, title: billTitle, amount: parseFloat(billAmount), note: billNote, imageUrl: billImage || undefined, imageFileName: billImageName || undefined, status: "unpaid", createdAt: new Date().toISOString() };
                        await saveBill(bill);
                        sendBillEmail(billUserEmail, billTitle, parseFloat(billAmount), billNote);
                        await saveNotification({ id: generateId("notif"), userEmail: billUserEmail, type: "bill_created", title: "New Bill: " + billTitle, body: `A bill of $${parseFloat(billAmount).toFixed(2)} has been created: ${billNote}`, read: false, createdAt: new Date().toISOString() });
                        setBillAmount(""); setBillTitle(""); setBillNote(""); setBillImage(null); setBillImageName(""); setBillUserEmail("");
                        refreshBilling();
                        setBillMsg({ type: "success", text: "Bill created and user notified!" });
                        setTimeout(() => setBillMsg({ type: "", text: "" }), 5000);
                      }}
                      className="px-8 py-3 rounded-full bg-swiftly-deep text-white font-bold text-[14px] shadow-lg hover:bg-swiftly-forest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 hover:shadow-xl"
                    >
                      <Save size={16} /> Send Bill
                    </button>

                    {/* Attachment Button */}
                    <label className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-swiftly-deep hover:bg-gray-100 transition-all cursor-pointer" title="Attach file">
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setBillImageName(file.name);
                        const reader = new FileReader();
                        reader.onload = ev => setBillImage(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }} />
                      <Plus size={20} />
                    </label>
                  </div>

                  <div className="text-[11px] text-gray-400 font-medium hidden sm:block">
                    Press Send Bill to create and notify the user
                  </div>
                </div>
              </div>

              {/* ── Pending Deposits Quick View ── */}
              {allDeposits.filter(d => d.status === "pending").length > 0 && (
                <div className="bg-white rounded-[24px] shadow-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-100">
                      <DollarSign size={16} className="text-amber-600" />
                    </div>
                    <h3 className="font-bold text-swiftly-deep text-[16px]">Pending Deposits</h3>
                    <span className="ml-auto px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[11px] font-bold border border-amber-100">
                      {allDeposits.filter(d => d.status === "pending").length} awaiting review
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {allDeposits.filter(d => d.status === "pending").map(dep => (
                      <div key={dep.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-gray-50/50 transition-colors">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${dep.method === "bitcoin" ? "bg-orange-50 border border-orange-100" : "bg-green-50 border border-green-100"}`}>
                          {dep.method === "bitcoin" ? <span className="text-orange-500 text-sm font-bold">₿</span> : <DollarSign size={16} className="text-green-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-swiftly-deep font-bold text-[15px]">${dep.amount.toFixed(2)} <span className="text-gray-400 text-xs font-normal capitalize">via {dep.method}</span></p>
                          <p className="text-gray-400 text-[12px] truncate">{dep.userEmail} · {new Date(dep.createdAt).toLocaleString()}</p>
                        </div>
                        {dep.receiptImage && <a href={dep.receiptImage} target="_blank" rel="noreferrer" className="text-swiftly-orange text-xs font-bold hover:underline shrink-0 px-3 py-1.5 rounded-lg bg-swiftly-orange/5 border border-swiftly-orange/10">View Receipt</a>}
                        <div className="flex gap-2 shrink-0">
                          <button onClick={async () => {
                            await saveDeposit({ ...dep, status: "approved", reviewedAt: new Date().toISOString() });
                            sendDepositEmail(dep.userEmail, dep.amount, "approved");
                            const bal = await getUserBalance(dep.userEmail);
                            await setUserBalance(dep.userEmail, bal + dep.amount);
                            await saveNotification({ id: generateId("notif"), userEmail: dep.userEmail, type: "deposit_approved", title: "Deposit Approved", body: `Your deposit of $${dep.amount.toFixed(2)} has been approved and credited.`, read: false, createdAt: new Date().toISOString() });
                            refreshBilling();
                          }} className="px-4 py-2 rounded-xl bg-green-50 border border-green-200 text-green-600 text-sm font-bold hover:bg-green-100 transition-colors flex items-center gap-1.5"><Check size={14} /> Approve</button>
                          <button onClick={async () => {
                            await saveDeposit({ ...dep, status: "rejected", reviewedAt: new Date().toISOString() });
                            sendDepositEmail(dep.userEmail, dep.amount, "rejected");
                            await saveNotification({ id: generateId("notif"), userEmail: dep.userEmail, type: "deposit_rejected", title: "Deposit Rejected", body: `Your deposit of $${dep.amount.toFixed(2)} was not approved.`, read: false, createdAt: new Date().toISOString() });
                            refreshBilling();
                          }} className="px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5"><XCircle size={14} /> Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── All Bills — Gmail Inbox Style ── */}
              <div className="bg-white rounded-[24px] shadow-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                    <FileText size={16} className="text-blue-500" />
                  </div>
                  <h3 className="font-bold text-swiftly-deep text-[16px]">Sent Bills</h3>
                  <span className="ml-auto text-gray-400 text-[12px] font-medium">{allBills.length} total</span>
                </div>
                {allBills.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4 border border-gray-100">
                      <FileText size={24} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-bold text-[15px]">No bills created yet</p>
                    <p className="text-gray-400 text-[13px] mt-1">Use the compose window above to send your first bill.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {allBills.map(bill => (
                      <div key={bill.id} className="px-6 py-4 flex items-center gap-4 hover:bg-blue-50/30 transition-colors cursor-default group">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-swiftly-deep flex items-center justify-center text-white font-bold text-[12px] shrink-0 uppercase">
                          {bill.userEmail.slice(0, 2)}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-swiftly-deep text-[14px] truncate">{bill.userEmail.split("@")[0]}</p>
                            {bill.status === "unpaid" && <span className="w-2 h-2 rounded-full bg-swiftly-orange shrink-0" />}
                          </div>
                          <p className="text-swiftly-deep text-[13px] font-medium truncate">{bill.title}</p>
                          <p className="text-gray-400 text-[12px] truncate">{bill.note}</p>
                        </div>
                        {/* Attachment indicator */}
                        {bill.imageUrl && (
                          <div className="hidden sm:flex items-center gap-1 text-gray-400" title="Has attachment">
                            <FileText size={14} />
                          </div>
                        )}
                        {/* Amount + Status */}
                        <div className="text-right shrink-0">
                          <p className="font-bold text-swiftly-deep text-[15px]">${bill.amount.toFixed(2)}</p>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${bill.status === "paid" ? "bg-green-50 text-green-600 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"}`}>{bill.status}</span>
                        </div>
                        {/* Date */}
                        <p className="text-gray-400 text-[11px] font-medium shrink-0 hidden lg:block w-20 text-right">
                          {new Date(bill.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════ DEPOSITS TAB ════════════════ */}
          {tab === "deposits" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-widest text-[#F59A25] mb-2">Financial</p>
                  <h2 className="text-[22px] sm:text-[28px] md:text-[36px] font-outfit font-bold text-swiftly-deep">All Deposits</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 text-[12px] sm:text-[13px] font-bold">
                    {allDeposits.filter(d => d.status === "pending").length} Pending
                  </span>
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-[12px] sm:text-[13px] font-bold">
                    {allDeposits.length} Total
                  </span>
                </div>
              </div>

              {allDeposits.length === 0 ? (
                <div className="bg-white shadow-sm border-gray-200 text-swiftly-deep border border-gray-200 rounded-[24px] p-16 text-center">
                  <DollarSign size={40} className="text-swiftly-deep/20 mx-auto mb-4" />
                  <p className="text-gray-500 font-bold text-lg">No deposits yet</p>
                  <p className="text-swiftly-deep/25 text-sm mt-1">User deposits will appear here for review.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allDeposits.map(dep => (
                    <div key={dep.id} className={`bg-white shadow-sm border-gray-200 text-swiftly-deep backdrop-blur-xl border rounded-[20px] p-4 sm:p-5 flex flex-col gap-3 transition-all ${dep.status === "pending" ? "border-amber-500/30 bg-amber-500/5" : "border-gray-200"}`}>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${dep.method === "bitcoin" ? "bg-orange-500/20" : "bg-green-50"}`}>
                        {dep.method === "bitcoin" ? <span className="text-orange-400 text-lg font-bold">₿</span> : <DollarSign size={20} className="text-green-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-swiftly-deep font-bold text-[16px]">${dep.amount.toFixed(2)} <span className="text-gray-500 text-xs font-normal capitalize">via {dep.method}</span></p>
                        <p className="text-gray-500 text-[13px] truncate">{dep.userEmail}</p>
                        <p className="text-gray-400 text-[11px] mt-0.5">{new Date(dep.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {dep.receiptImage && <a href={dep.receiptImage} target="_blank" rel="noreferrer" className="text-[#F59A25] text-xs font-bold hover:underline shrink-0 px-3 py-1.5 rounded-lg bg-[#F59A25]/10 border border-[#F59A25]/20">View Receipt</a>}
                        {dep.status === "pending" ? (
                          <div className="flex gap-2">
                            <button onClick={async () => {
                              await saveDeposit({ ...dep, status: "approved", reviewedAt: new Date().toISOString() });
                              sendDepositEmail(dep.userEmail, dep.amount, "approved");
                              const bal = await getUserBalance(dep.userEmail);
                              await setUserBalance(dep.userEmail, bal + dep.amount);
                              await saveNotification({ id: generateId("notif"), userEmail: dep.userEmail, type: "deposit_approved", title: "Deposit Approved", body: `Your deposit of $${dep.amount.toFixed(2)} has been approved and credited.`, read: false, createdAt: new Date().toISOString() });
                              refreshBilling();
                            }} className="px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-600 text-sm font-bold hover:bg-green-500/30 transition-colors flex items-center gap-1.5"><Check size={14} /> Approve</button>
                            <button onClick={async () => {
                              await saveDeposit({ ...dep, status: "rejected", reviewedAt: new Date().toISOString() });
                              sendDepositEmail(dep.userEmail, dep.amount, "rejected");
                              await saveNotification({ id: generateId("notif"), userEmail: dep.userEmail, type: "deposit_rejected", title: "Deposit Rejected", body: `Your deposit of $${dep.amount.toFixed(2)} was not approved.`, read: false, createdAt: new Date().toISOString() });
                              refreshBilling();
                            }} className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-bold hover:bg-red-500/30 transition-colors flex items-center gap-1.5"><XCircle size={14} /> Reject</button>
                          </div>
                        ) : (
                          <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-xl shrink-0 ${dep.status === "approved" ? "bg-green-50 text-green-600 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>{dep.status}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ CREATE TAB ════════════════ */}
          {tab === "create" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {message.text && (
                <div className={`mb-8 p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-center gap-4 font-bold text-[16px] shadow-lg transition-all ${message.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  <div className="flex items-center gap-3">
                    {message.type === "success" ? <CheckCircle size={24} /> : <RefreshCw size={24} />}
                    <span>{message.text}</span>
                  </div>
                  {message.type === "success" && lastCode && (
                    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-5 py-2">
                      <span className="font-mono text-swiftly-deep text-[18px] tracking-widest">{lastCode}</span>
                      <button type="button" onClick={() => navigator.clipboard.writeText(lastCode)} className="text-[#F59A25] hover:text-swiftly-deep transition-colors" title="Copy tracking code">
                        <Copy size={18} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Waypoint Generation Status */}
              {waypointLoading && (
                <div className="mb-6 p-4 rounded-2xl border border-[#F59A25]/30 bg-[#F59A25]/10 flex items-center gap-3 backdrop-blur-md">
                  <Loader2 size={20} className="text-[#F59A25] animate-spin" />
                  <span className="text-[#F59A25] font-bold text-[14px]">Generating transit waypoints from route...</span>
                </div>
              )}
              {waypointMsg.text && !waypointLoading && (
                <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-3 font-bold text-[14px] ${waypointMsg.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  {waypointMsg.type === "success" ? <Route size={18} /> : <AlertCircle size={18} />}
                  {waypointMsg.text}
                </div>
              )}

              {targetUserEmail && (
                <div className="mb-8 p-6 rounded-2xl bg-blue-500/10 border border-blue-200 flex items-center justify-between backdrop-blur-md shadow-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center"><User size={24} className="text-blue-600" /></div>
                    <div>
                      <p className="text-blue-600 text-[13px] font-bold uppercase tracking-widest mb-1">Creating Shipment For</p>
                      <p className="text-swiftly-deep font-bold text-[18px]">{targetUserEmail}</p>
                    </div>
                  </div>
                  <button onClick={() => setTargetUserEmail("")} className="px-4 py-2 rounded-full bg-white shadow-xl border-gray-200 hover:bg-white/20 text-swiftly-deep text-[13px] font-bold transition-colors border border-gray-200">Clear User</button>
                </div>
              )}

              <form id="createShipmentForm" onSubmit={handleSubmit} className="space-y-8">
                {/* Package Basics */}
                <Section icon={<Package className="text-[#F59A25]" size={28} />} title="Package Basics">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Field label="Carrier"><input name="carrier" value={formData.carrier} onChange={handleChange} className={inp} /></Field>
                    <Field label="Shipment Type">
                      <select name="shipment_type" value={formData.shipment_type} onChange={handleChange} className={sel}>
                        <option>Ground</option>
                        <option>2nd Day Air</option>
                        <option>Next Day Air</option>
                        <option>International Priority</option>
                        <option>International Economy</option>
                        <option>Freight</option>
                      </select>
                    </Field>
                    <Field label="Weight (lbs)"><input type="number" step="0.01" name="weight" value={formData.weight} onChange={handleChange} className={inp} /></Field>
                    <Field label="Contents" className="md:col-span-2"><input name="contents" value={formData.contents} onChange={handleChange} className={inp} /></Field>
                  </div>
                </Section>

                {/* Logistics */}
                <Section icon={<MapPin className="text-[#F59A25]" size={28} />} title="Logistics & Status">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Current Status">
                      <select name="current_status" value={formData.current_status} onChange={handleChange} className={sel}>
                        <option>Pending</option>
                        <option>Label Created</option>
                        <option>Picked Up</option>
                        <option>In Transit</option>
                        <option>Out for Delivery</option>
                        <option>Delivered</option>
                        <option>Exception</option>
                      </select>
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:col-span-1">
                      <Field label="Departure Date"><input type="date" name="departure_date" value={formData.departure_date} onChange={handleChange} className={`${sel} [color-scheme:dark]`} /></Field>
                      <Field label="Departure Time"><input type="time" name="departure_time" value={formData.departure_time} onChange={handleChange} className={`${sel} [color-scheme:dark]`} /></Field>
                    </div>
                    <Field label="Expected Delivery Date"><input type="date" name="expected_delivery_date" value={formData.expected_delivery_date} onChange={handleChange} className={`${sel} [color-scheme:dark]`} /></Field>
                  </div>
                  <p className="text-gray-400 text-[12px] mt-4 flex items-center gap-2"><MapPin size={12} /> Origin & Destination will be set automatically from sender/receiver addresses.</p>
                </Section>

                {/* Sender / Receiver */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Section icon={<User className="text-gray-500" size={28} />} title="Sender Details">
                    <div className="space-y-4">
                      <Field label="Name"><input name="sender_name" value={formData.sender_name} onChange={handleChange} className={inp} /></Field>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Email"><input type="email" name="sender_email" value={formData.sender_email} onChange={handleChange} className={inp} /></Field>
                        <Field label="Phone"><input name="sender_phone" value={formData.sender_phone} onChange={handleChange} className={inp} /></Field>
                      </div>
                      <Field label="Address"><textarea name="sender_address" value={formData.sender_address} onChange={handleChange} rows={3} className={inp} /></Field>
                    </div>
                  </Section>
                  <Section icon={<User className="text-[#F59A25]" size={28} />} title="Receiver Details">
                    <div className="space-y-4">
                      <Field label="Name *"><input required name="receiver_name" value={formData.receiver_name} onChange={handleChange} className={inp} /></Field>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Email"><input type="email" name="receiver_email" value={formData.receiver_email} onChange={handleChange} className={inp} /></Field>
                        <Field label="Phone"><input name="receiver_phone" value={formData.receiver_phone} onChange={handleChange} className={inp} /></Field>
                      </div>
                      <Field label="Address"><textarea name="receiver_address" value={formData.receiver_address} onChange={handleChange} rows={3} className={inp} /></Field>
                    </div>
                  </Section>
                </div>

                {/* Notice */}
                <Section icon={<AlertCircle className="text-[#F59A25]" size={28} />} title="Notice (Optional)">
                  <p className="text-gray-500 text-[14px] mb-4">This message will be displayed as a highlighted alert on the public tracking page.</p>
                  <textarea name="notice" value={formData.notice} onChange={handleChange} rows={3} placeholder="e.g. Shipment delayed due to customs hold." className={`${inp} resize-none`} />
                </Section>

                <div className="flex flex-col sm:flex-row justify-end mt-8">
                  <button type="submit" className="w-full sm:w-auto px-6 sm:px-8 md:px-10 py-3.5 md:py-5 rounded-full bg-[#F59A25] text-white font-bold text-[15px] md:text-[18px] shadow-lg hover:bg-[#D38215] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center gap-3">
                    <Save size={24} /> Create Shipment
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ════════════════ MANAGE TAB ════════════════ */}
          {tab === "manage" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {manageMsg.text && (
                <div className={`p-4 rounded-2xl border flex items-center gap-3 font-bold text-[15px] ${manageMsg.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  <CheckCircle size={20} /> {manageMsg.text}
                </div>
              )}

              {shipments.length === 0 ? (
                <div className="bg-white shadow-sm border-gray-200 text-swiftly-deep border border-gray-200 rounded-[32px] p-16 text-center">
                  <Package size={64} className="text-swiftly-deep/20 mx-auto mb-6" />
                  <p className="text-gray-500 text-[18px] font-bold">No shipments yet. Create one first.</p>
                </div>
              ) : (
                shipments.map((s) => {
                  const code = s.trackingNumber || s.tracking_code || "N/A";
                  const isEditing = editingId === s.id;
                  return (
                    <div key={s.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 mb-4">

                      {/* ── Card Header ── */}
                      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package size={15} className="text-swiftly-orange shrink-0" />
                          <span className="font-mono font-bold text-swiftly-deep text-[15px] tracking-tight truncate">{code}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto flex-wrap">
                          <StatusBadge status={s.status || s.current_status || "Pending"} />
                          <span className="text-[11px] font-semibold bg-white border border-gray-200 text-gray-500 px-2.5 py-1 rounded-full">{s.service || s.shipment_type || "Standard"}</span>
                          {s.userEmail && (
                            <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[11px] font-bold">
                              <User size={11} /> {s.userEmail.split('@')[0]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ── Route Row ── */}
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-5 py-4 items-center">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">From</p>
                          <p className="text-swiftly-deep font-bold text-[13px] truncate">{s.sender_name || "—"}</p>
                          <p className="text-gray-400 text-[12px] truncate">{s.origin || s.sender_address || "—"}</p>
                        </div>
                        <div className="flex items-center justify-center">
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                            <ChevronRight size={14} className="text-swiftly-orange" />
                          </div>
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">To</p>
                          <p className="text-swiftly-deep font-bold text-[13px] truncate">{s.receiver_name || "—"}</p>
                          <p className="text-gray-400 text-[12px] truncate">{s.destination || s.receiver_address || s.to?.city || "—"}</p>
                        </div>
                      </div>

                      {/* ── Action Bar ── */}
                      <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/40">
                        {!isEditing ? (
                          <button onClick={() => startEdit(s)} className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-swiftly-deep text-white hover:bg-swiftly-forest font-bold text-[12px] transition-all">
                            <Pencil size={13} /> Edit
                          </button>
                        ) : (
                          <>
                            <button onClick={() => saveEdit(s)} className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-swiftly-orange hover:bg-[#D38215] text-white font-bold text-[12px] transition-all">
                              <Save size={13} /> Save Changes
                            </button>
                            <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-swiftly-deep font-bold text-[12px] transition-all">
                              <X size={13} /> Cancel
                            </button>
                          </>
                        )}
                        <div className="ml-auto">
                          {deleteConfirm === s.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => confirmDelete(s.id)} className="h-9 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[12px] transition-all">Confirm Delete</button>
                              <button onClick={() => setDeleteConfirm(null)} className="h-9 px-3 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-gray-600 font-bold text-[12px] transition-all">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(s.id)} className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 font-bold text-[12px] transition-all">
                              <Trash2 size={13} /> Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Edit Form */}
                      {isEditing && (
                        <div className="border-t border-gray-100 p-6 sm:p-8 space-y-8 bg-white">

                          {/* ── Group 1: Logistics & Status ── */}
                          <div>
                            <h4 className="text-[12px] font-bold uppercase tracking-widest text-swiftly-orange mb-4 flex items-center gap-2">
                              <Navigation size={14} /> Logistics & Status
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                              <Field label="Current Status">
                                <select name="current_status" value={(editData.current_status as string) || ""} onChange={handleEditChange} className={sel}>
                                  <option>Pending</option>
                                  <option>Label Created</option>
                                  <option>Picked Up</option>
                                  <option>In Transit</option>
                                  <option>Out for Delivery</option>
                                  <option>Delivered</option>
                                  <option>Exception</option>
                                </select>
                              </Field>
                              <Field label="Expected Delivery"><input type="date" name="expected_delivery_date" value={(editData.expected_delivery_date as string) || ""} onChange={handleEditChange} className={`${sel} [color-scheme:light]`} /></Field>
                              <Field label="Weight (lbs)"><input type="number" step="0.01" name="weight" value={(editData.weight as string) || ""} onChange={handleEditChange} className={inp} /></Field>
                            </div>
                          </div>

                          {/* ── Group 2: Shipment Details ── */}
                          <div>
                            <h4 className="text-[12px] font-bold uppercase tracking-widest text-swiftly-orange mb-4 flex items-center gap-2">
                              <Package size={14} /> Personnel & Contents
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                              <Field label="Sender Name"><input name="sender_name" value={(editData.sender_name as string) || ""} onChange={handleEditChange} className={inp} /></Field>
                              <Field label="Receiver Name"><input name="receiver_name" value={(editData.receiver_name as string) || ""} onChange={handleEditChange} className={inp} /></Field>
                              <Field label="Sender Address" className="md:col-span-2 lg:col-span-1"><textarea name="sender_address" value={(editData.sender_address as string) || ""} onChange={handleEditChange} rows={2} className={inp} /></Field>
                              <Field label="Receiver Address" className="md:col-span-2 lg:col-span-1"><textarea name="receiver_address" value={(editData.receiver_address as string) || ""} onChange={handleEditChange} rows={2} className={inp} /></Field>
                              <Field label="Receiver Email"><input type="email" name="receiver_email" value={(editData.receiver_email as string) || ""} onChange={handleEditChange} className={inp} /></Field>
                              <Field label="Carrier"><input name="carrier" value={(editData.carrier as string) || ""} onChange={handleEditChange} className={inp} /></Field>
                              <Field label="Shipment Type">
                                <select name="shipment_type" value={(editData.shipment_type as string) || ""} onChange={handleEditChange} className={sel}>
                                  <option>Ground</option>
                                  <option>2nd Day Air</option>
                                  <option>Next Day Air</option>
                                  <option>International Priority</option>
                                  <option>International Economy</option>
                                  <option>Freight</option>
                                </select>
                              </Field>
                              <Field label="Contents"><input name="contents" value={(editData.contents as string) || ""} onChange={handleEditChange} className={inp} /></Field>
                            </div>
                          </div>

                          {/* ── Group 3: Public Notice ── */}
                          <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                            <label className={lbl}><span className="flex items-center gap-2"><AlertCircle size={14} className="text-swiftly-orange" /> Public Notice (Highlighted)</span></label>
                            <textarea name="notice" value={(editData.notice as string) || ""} onChange={handleEditChange} rows={2} placeholder="Add a temporary alert for the customer..." className={`${inp} resize-none bg-white`} />
                          </div>

                          {/* ── Group 4: Tracking Locations ── */}
                          <div className="pt-8 border-t border-gray-100">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                              <div>
                                <h4 className="text-swiftly-deep font-bold text-[16px] flex items-center gap-2">
                                  <Route size={18} className="text-swiftly-orange" /> Journey Timeline
                                </h4>
                                <p className="text-[12px] text-gray-500 mt-1">Manage the detailed stops and current live position.</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => setEditingWaypoints(editingWaypoints === s.id ? null : s.id)}
                                  className={`px-4 py-2 rounded-xl text-[12px] font-bold transition-all flex items-center gap-2 ${editingWaypoints === s.id ? "bg-swiftly-orange text-white shadow-lg shadow-swiftly-orange/20" : "bg-white border border-gray-200 text-gray-500 hover:text-swiftly-deep hover:border-gray-300"}`}
                                >
                                  {editingWaypoints === s.id ? <><Check size={14} /> Finish Editing</> : <><Pencil size={14} /> Add/Remove Stops</>}
                                </button>
                                <button
                                  onClick={async () => {
                                    const originAddr = s.sender_address || s.origin;
                                    const destAddr = s.receiver_address || s.destination;
                                    if (!originAddr || !destAddr) {
                                      setManageMsg({ type: "error", text: "Sender and receiver addresses are required." });
                                      setTimeout(() => setManageMsg({ type: "", text: "" }), 4000);
                                      return;
                                    }
                                    setWaypointLoading(true);
                                    try {
                                      const result = await generateTransitWaypoints(originAddr, destAddr);
                                      if (result.error) {
                                        setManageMsg({ type: "error", text: result.error });
                                      } else if (result.waypoints && result.waypoints.length > 0) {
                                        await saveShipment({ ...s, transit_waypoints: result.waypoints });
                                        refreshShipments();
                                        setManageMsg({ type: "success", text: "Journey timeline regenerated!" });
                                      } else {
                                        setManageMsg({ type: "error", text: "Could not generate route." });
                                      }
                                    } catch {
                                      setManageMsg({ type: "error", text: "An error occurred during route generation." });
                                    }
                                    setWaypointLoading(false);
                                    setTimeout(() => setManageMsg({ type: "", text: "" }), 4000);
                                  }}
                                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 text-[12px] font-bold transition-all flex items-center gap-2"
                                >
                                  <RefreshCw size={14} className={waypointLoading ? "animate-spin" : ""} /> {waypointLoading ? "Working..." : "Auto-Generate Full Route"}
                                </button>
                              </div>
                            </div>

                            <div className="relative pl-8 space-y-6">
                              <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-gray-100" />

                              {s.transit_waypoints?.sort((a, b) => a.order - b.order).map((wp, wi) => {
                                const resolvedLoc = (editData.current_location as string) || s.current_location || s.transit_waypoints![0]?.name || "";
                                const isCurrent = resolvedLoc === wp.name;
                                const currentWpOrder = s.transit_waypoints!.find(w => w.name === resolvedLoc)?.order ?? -1;
                                const isPassed = wp.order <= currentWpOrder;

                                return (
                                  <div key={wi} className="relative flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                      {/* Dot */}
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all border-2 ${isCurrent ? "bg-swiftly-orange border-white scale-125 shadow-lg shadow-swiftly-orange/40" :
                                          isPassed ? "bg-green-500 border-white" :
                                            "bg-white border-gray-200"
                                        }`}>
                                        {isCurrent ? <Navigation size={12} className="text-white" /> :
                                          isPassed ? <Check size={12} className="text-white" /> :
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />}
                                      </div>

                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setEditData({ 
                                            ...editData, 
                                            current_location: wp.name,
                                            current_status: wp.type === "origin" ? "Picked Up" : wp.type === "destination" ? "Delivered" : "In Transit"
                                          });
                                        }}
                                        className="text-left group/btn"
                                      >
                                        <p className={`text-[14px] font-bold leading-none ${isCurrent ? "text-swiftly-orange" : "text-swiftly-deep group-hover/btn:text-swiftly-orange transition-colors"}`}>{wp.name}</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{wp.type}</p>
                                      </button>
                                    </div>

                                    {editingWaypoints === s.id && wp.type !== "origin" && wp.type !== "destination" && (
                                      <button
                                        onClick={async () => {
                                          const updated = { ...s, transit_waypoints: s.transit_waypoints!.filter((_, i) => i !== wi).map((w, i) => ({ ...w, order: i })) };
                                          await saveShipment(updated);
                                          refreshShipments();
                                        }}
                                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Add Center Inline */}
                              {editingWaypoints === s.id && (
                                <div className="pt-4 flex gap-2 ml-[-8px]">
                                  <div className="w-8 h-8 rounded-full bg-swiftly-orange/10 flex items-center justify-center border-2 border-dashed border-swiftly-orange/30 shrink-0">
                                    <Plus size={14} className="text-swiftly-orange" />
                                  </div>
                                  <div className="flex-1 flex gap-2">
                                    <select
                                      value={newWpCenter}
                                      onChange={e => setNewWpCenter(e.target.value)}
                                      className="flex-1 h-10 bg-white border border-gray-200 rounded-xl px-3 text-[13px] font-medium text-swiftly-deep focus:border-swiftly-orange outline-none shadow-sm"
                                    >
                                      <option value="">Add Distribution Hub Stop...</option>
                                      {LOGISTICS_CENTERS.filter(c => !s.transit_waypoints?.some(wp => wp.name === c.name)).map(c => (
                                        <option key={c.name} value={c.name}>{c.name}</option>
                                      ))}
                                    </select>
                                    <button
                                      disabled={!newWpCenter}
                                      onClick={async () => {
                                        const center = LOGISTICS_CENTERS.find(c => c.name === newWpCenter);
                                        if (!center) return;
                                        const wps = [...(s.transit_waypoints || [])];
                                        const destIdx = wps.findIndex(wp => wp.type === "destination");
                                        const insertIdx = destIdx >= 0 ? destIdx : wps.length;
                                        wps.splice(insertIdx, 0, { name: center.name, type: "center", lat: center.lat, lng: center.lng, order: 0 });
                                        wps.forEach((wp, i) => wp.order = i);
                                        await saveShipment({ ...s, transit_waypoints: wps });
                                        refreshShipments();
                                        setNewWpCenter("");
                                      }}
                                      className="h-10 px-4 rounded-xl bg-swiftly-deep text-white font-bold text-[12px] disabled:opacity-40 transition-all flex items-center gap-1 shadow-sm"
                                    >
                                      Add Stop
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ════════════════ DELIVERY REQUESTS TAB ════════════════ */}
          {tab === "requests" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {manageMsg.text && (
                <div className={`p-4 rounded-2xl border flex items-center gap-3 font-bold text-[15px] ${manageMsg.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  <CheckCircle size={20} /> {manageMsg.text}
                </div>
              )}
              {shipments.filter(s => s.changeRequest?.status === "pending").length === 0 ? (
                <div className="bg-white shadow-sm border-gray-200 text-swiftly-deep border border-gray-200 rounded-[32px] p-16 text-center">
                  <AlertCircle size={64} className="text-swiftly-deep/20 mx-auto mb-6" />
                  <p className="text-gray-500 text-[18px] font-bold">No pending delivery change requests.</p>
                </div>
              ) : (
                shipments.filter(s => s.changeRequest?.status === "pending").map(s => {
                  const req = s.changeRequest!;
                  return (
                    <div key={s.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-4">
                      <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
                        <div>
                          <p className="text-[12px] font-bold uppercase tracking-widest text-swiftly-orange mb-1">Request: {req.type.toUpperCase()}</p>
                          <p className="font-bold text-[18px] text-swiftly-deep tracking-tight">{s.trackingNumber}</p>
                        </div>
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[12px] font-bold uppercase">Pending Review</span>
                      </div>

                      <div className="mb-6">
                        <p className="text-[13px] font-bold text-gray-400 uppercase mb-2">Requested Changes</p>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 font-mono text-[13px]">
                          {req.type === "reroute" && <p><strong>New Address:</strong> {req.newData.address}, {req.newData.city}, {req.newData.state} {req.newData.zip}</p>}
                          {req.type === "reschedule" && <p><strong>New Date:</strong> {req.newData.date}</p>}
                          {req.type === "hold" && <p><strong>Hold Location:</strong> {req.newData.location}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={async () => {
                            let updated = { ...s };
                            updated.changeRequest = { ...req, status: "approved" };

                            let eventMsg = "Delivery Change Approved";
                            if (req.type === "reroute") {
                              updated.destination = `${req.newData.city}, ${req.newData.state} ${req.newData.zip}`;
                              updated.receiver_address = `${req.newData.address}, ${req.newData.city}, ${req.newData.state} ${req.newData.zip}`;
                              eventMsg = "Package Rerouted to New Address";
                            } else if (req.type === "reschedule") {
                              updated.expected_delivery_date = req.newData.date;
                              eventMsg = "Delivery Rescheduled";
                            } else if (req.type === "hold") {
                              updated.destination = req.newData.location;
                              updated.receiver_address = req.newData.location;
                              eventMsg = "Package Held at Location";
                            }

                            updated.events = [{ status: "Update", location: s.current_location || "System", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), date: new Date().toLocaleDateString() }, ...(updated.events || [])];

                            await saveShipment(updated);
                            refreshShipments();

                            // Auto-generate new routes if destination changed
                            if (req.type === "reroute" || req.type === "hold") {
                              setManageMsg({ type: "success", text: "Approved! Generating new map routes..." });
                              try {
                                const result = await generateTransitWaypoints(updated.origin || "", updated.destination || "");
                                if (result.waypoints.length > 0) {
                                  updated.transit_waypoints = result.waypoints;
                                  await saveShipment(updated);
                                  refreshShipments();
                                }
                              } catch { }
                            } else {
                              setManageMsg({ type: "success", text: "Request approved successfully." });
                            }
                            setTimeout(() => setManageMsg({ type: "", text: "" }), 4000);
                          }}
                          className="px-6 py-3 rounded-xl bg-swiftly-orange text-white font-bold text-[13px] hover:bg-swiftly-amber shadow-lg transition-all"
                        >
                          Approve & Update
                        </button>
                        <button
                          onClick={async () => {
                            let updated = { ...s };
                            updated.changeRequest = { ...req, status: "rejected" };
                            await saveShipment(updated);
                            refreshShipments();
                            setManageMsg({ type: "success", text: "Request rejected." });
                            setTimeout(() => setManageMsg({ type: "", text: "" }), 4000);
                          }}
                          className="px-6 py-3 rounded-xl bg-white border border-gray-200 text-red-500 font-bold text-[13px] hover:bg-red-50 transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ════════════════ SETTINGS TAB ════════════════ */}
          {tab === "settings" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              {settingsMsg.text && (
                <div className={`p-4 rounded-2xl border flex items-center gap-3 font-bold text-[15px] ${settingsMsg.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  <CheckCircle size={20} /> {settingsMsg.text}
                </div>
              )}

              <div className="bg-white shadow-xl border-gray-200 backdrop-blur-xl border border-gray-300 rounded-[20px] sm:rounded-[28px] md:rounded-[32px] p-4 sm:p-6 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <h2 className="text-[18px] sm:text-[20px] md:text-[22px] font-outfit font-bold text-swiftly-deep mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 border-b border-gray-200 pb-3 sm:pb-4">
                  <Settings className="text-[#F59A25]" size={28} /> Global Settings
                </h2>

                <div className="space-y-6 max-w-2xl">
                  <div className="bg-white shadow-sm border-gray-200 text-swiftly-deep border border-gray-200 rounded-2xl p-6">
                    <h3 className="text-[16px] font-bold text-swiftly-deep mb-4 flex items-center gap-2">
                      <Wallet size={18} className="text-gray-500" /> Crypto Wallet Addresses
                    </h3>
                    <p className="text-gray-500 text-sm mb-6">Update the wallet addresses used for user deposits. Changes apply instantly across the dashboard and shared views.</p>

                    <div className="space-y-4">
                      <div>
                        <label className={lbl}>Bitcoin (BTC) Address</label>
                        <input
                          value={wallets.bitcoin}
                          onChange={e => setWallets({ ...wallets, bitcoin: e.target.value })}
                          placeholder="bc1q..."
                          className={inp}
                        />
                      </div>
                      <div>
                        <label className={lbl}>USDT (TRC-20) Address</label>
                        <input
                          value={wallets.usdt}
                          onChange={e => setWallets({ ...wallets, usdt: e.target.value })}
                          placeholder="T..."
                          className={inp}
                        />
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        await saveWalletAddresses(wallets);
                        setSettingsMsg({ type: "success", text: "Wallet addresses updated successfully!" });
                        setTimeout(() => setSettingsMsg({ type: "", text: "" }), 5000);
                      }}
                      className="mt-6 px-6 py-3 rounded-xl bg-[#F59A25] text-white font-bold hover:bg-[#D38215] transition-all flex items-center gap-2 shadow-lg"
                    >
                      <Save size={18} /> Save Settings
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-[90] lg:hidden backdrop-blur-sm transition-opacity" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}

