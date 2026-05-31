import { useAuth } from "@/context/AuthContext";
import { useLocation, Link } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { Bell, Plus, X, Package, Clock, MapPin, ShieldCheck, CreditCard, HelpCircle, Camera, User, ChevronRight, Settings, CheckCircle2, TrendingUp, Search, DollarSign, FileText, AlertCircle, Share2, Copy, Link2, Trash2 } from "lucide-react";
import { getShipments, deleteShipment, getShipmentsForUser } from "@/lib/shipmentStore";
import type { Shipment } from "@/lib/shipmentStore";
import { getNotifications, markAllNotificationsRead, getUnreadCount, getBills } from "@/lib/billingStore";
import type { Notification, Bill } from "@/lib/billingStore";
import { motion, AnimatePresence } from "framer-motion";
import { createShareLink, buildShareUrl, getSharesForShipment, revokeShareLink } from "@/lib/shareStore";


const statusColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  "Out for Delivery": { bg: "bg-swiftly-mint/40", text: "text-swiftly-forest", border: "border-swiftly-mint", icon: "text-swiftly-orange" },
  "In Transit":       { bg: "bg-blue-50/50", text: "text-blue-700", border: "border-blue-100", icon: "text-blue-500" },
  "Delivered":        { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", icon: "text-gray-400" },
  "Label Created":    { bg: "bg-swiftly-cream/50", text: "text-swiftly-amber", border: "border-swiftly-cream", icon: "text-swiftly-orange" },
  "Exception":        { bg: "bg-red-50/50", text: "text-red-700", border: "border-red-100", icon: "text-red-500" },
};

function StatusBadge({ status }: { status: Shipment["status"] }) {
  const config = statusColors[status] || statusColors["Delivered"];
  const isActive = status !== "Delivered" && status !== "Exception";
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border backdrop-blur-sm ${config.bg} ${config.text} ${config.border}`}>
      <span className={`relative flex h-2 w-2`}>
        {isActive && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current`}></span>}
        <span className={`relative inline-flex rounded-full h-2 w-2 bg-current`}></span>
      </span>
      {status}
    </div>
  );
}

function ShipmentTimeline({ status }: { status: Shipment["status"] }) {
  const steps = ["Label Created", "In Transit", "Out for Delivery", "Delivered"];
  const currentIndex = steps.indexOf(status) === -1 && status === "Exception" ? 1 : steps.indexOf(status);
  
  return (
    <div className="relative pt-6 pb-2">
      <div className="absolute top-8 left-0 w-full h-1 bg-gray-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(5, (currentIndex / (steps.length - 1)) * 100)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${status === 'Exception' ? 'bg-red-500' : 'bg-swiftly-orange'}`}
        />
      </div>
      
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const isException = status === "Exception" && index === 1;
          
          return (
            <div key={step} className="flex flex-col items-center">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.2 }}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white z-10
                  ${isException ? 'border-red-500' : 
                    isCompleted ? 'border-swiftly-orange' : 'border-gray-200'}`}
              >
                {isCompleted && !isException && <div className="w-2.5 h-2.5 rounded-full bg-swiftly-orange" />}
                {isException && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
              </motion.div>
              <span className={`text-[10px] font-bold uppercase tracking-wider mt-2 hidden sm:block
                ${isCurrent ? (isException ? 'text-red-500' : 'text-swiftly-deep') : 'text-gray-400'}`}>
                {step.replace("Out for ", "")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DashboardProps {
  /** When set, the dashboard operates in read-only shared mode showing only this shipment */
  sharedShipment?: Shipment;
  /** Display name shown in the header for shared mode */
  sharedRecipientName?: string;
  /** The sender's email — used to load their notifications for the shared recipient */
  sharedSenderEmail?: string;
}

export default function Dashboard({ sharedShipment, sharedRecipientName, sharedSenderEmail }: DashboardProps = {}) {
  const { user, updateProfilePicture, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const isSharedMode = !!sharedShipment;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSharedMode) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      if (updateProfilePicture) updateProfilePicture(dataUri);
      showToast("Profile picture updated");
    };
    reader.readAsDataURL(file);
  };

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [trackInput, setTrackInput] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "delivered">("all");
  const [showNotif, setShowNotif] = useState(false);
  const [currentView, setCurrentView] = useState<"main" | "billing">("main");
  const [toastMsg, setToastMsg] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unpaidBillsCount, setUnpaidBillsCount] = useState(0);
  const [shareModal, setShareModal] = useState<{ shipment: Shipment; url: string } | null>(null);

  const reload = useCallback(async () => { 
    if (isSharedMode) {
      setShipments([sharedShipment!]);
      if (sharedSenderEmail) {
        const notifs = await getNotifications(sharedSenderEmail);
        setNotifications(notifs);
        setUnreadCount(await getUnreadCount(sharedSenderEmail));
        const allBills = await getBills(sharedSenderEmail);
        setUnpaidBillsCount(allBills.filter(b => b.status === "unpaid").length);
      } else {
        setNotifications([]);
        setUnreadCount(0);
        setUnpaidBillsCount(0);
      }
      return;
    }
    if (user) {
      setShipments(await getShipmentsForUser(user.email));
      const notifs = await getNotifications(user.email);
      setNotifications(notifs);
      setUnreadCount(await getUnreadCount(user.email));
      const allBills = await getBills(user.email);
      setUnpaidBillsCount(allBills.filter(b => b.status === "unpaid").length);
    }
  }, [user, isSharedMode, sharedShipment, sharedSenderEmail]);
  
  useEffect(() => { if (!isSharedMode && !isAuthenticated) navigate("/auth/login"); }, [isAuthenticated, navigate, isSharedMode]);
  useEffect(() => { reload(); const h = () => reload(); window.addEventListener("storage", h); return () => window.removeEventListener("storage", h); }, [reload]);
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedShipment(null); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // In shared mode we don't need auth — use a virtual user object for display
  const displayUser = isSharedMode
    ? { firstName: sharedRecipientName || "Recipient", lastName: "", email: sharedShipment!.receiver_email || "", accountType: "Personal" as const, userId: "", profilePicture: undefined }
    : user;

  if (!isSharedMode && (!isAuthenticated || !user)) return null;
  if (!displayUser) return null;
  const activeCount = shipments.filter((s) => !["Delivered", "Exception"].includes(s.status)).length;
  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3000); };

  const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } };
  const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

  return (
    <div className="min-h-screen bg-swiftly-cream font-sans overflow-x-hidden selection:bg-swiftly-orange selection:text-white pb-32">
      {/* ── TOAST ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: -50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }} className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full shadow-2xl text-[14px] font-bold text-white flex items-center gap-3 backdrop-blur-md bg-swiftly-deep/90 border border-white/10">
            <CheckCircle2 size={18} className="text-swiftly-orange" /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LIQUID GLASS HEADER ── */}
      <div className="relative pt-20 pb-24 md:pt-24 md:pb-32 px-4 md:px-8 overflow-hidden border-b border-white/10" style={{ background: 'transparent' }}>
        {/* Glass Layer 1: SVG Distortion + Blur */}
        <div
          className="absolute inset-0 z-0 overflow-hidden"
          style={{
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            filter: 'url(#glass-distortion)',
            isolation: 'isolate',
          }}
        />
        {/* Glass Layer 2: Dark tinted overlay */}
        <div
          className="absolute inset-0 z-[1]"
          style={{ background: 'linear-gradient(135deg, rgba(11,43,38,0.88) 0%, rgba(35,83,71,0.82) 50%, rgba(11,43,38,0.90) 100%)' }}
        />
        {/* Glass Layer 3: White frosted tint */}
        <div
          className="absolute inset-0 z-[2]"
          style={{ background: 'rgba(255, 255, 255, 0.06)' }}
        />
        {/* Glass Layer 4: Inner glow / specular edges */}
        <div
          className="absolute inset-0 z-[3] overflow-hidden"
          style={{
            boxShadow: 'inset 0 2px 2px 0 rgba(255,255,255,0.15), inset 0 -1px 1px 0 rgba(255,255,255,0.08)',
          }}
        />
        {/* Glass Layer 5: Top edge highlight for glass rim */}
        <div className="absolute top-0 left-0 right-0 h-px z-[4] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        {/* Frosted glass noise texture overlay */}
        <div className="absolute inset-0 z-[5] opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27noise%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23noise)%27/%3E%3C/svg%3E")', backgroundRepeat: 'repeat' }}></div>
        
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row justify-between items-center md:items-end gap-6 md:gap-8" data-aos="fade-up">
          <div className="flex flex-col items-center md:flex-row md:items-end text-center md:text-left gap-4 md:gap-6 w-full md:w-auto min-w-0">
            {/* Profile Picture / Avatar */}
            <div className="relative group cursor-pointer shrink-0">
              {!isSharedMode && <input type="file" accept="image/*" className="hidden" id="profile-upload" onChange={handleImageUpload} />}
              <label htmlFor={isSharedMode ? undefined : "profile-upload"} className={`w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center overflow-hidden border-2 border-white/20 transition-all shadow-lg ${isSharedMode ? '' : 'cursor-pointer group-hover:border-swiftly-orange group-hover:shadow-xl'}`}>
                {!isSharedMode && displayUser?.profilePicture ? (
                  <img src={displayUser.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Package size={32} className="text-white" />
                )}
                {!isSharedMode && (
                  <div className="absolute inset-0 bg-swiftly-deep/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    <Camera size={20} className="text-white" />
                  </div>
                )}
              </label>
            </div>
            
            <div className="flex flex-col min-w-0 w-full md:w-auto">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex items-center gap-2 justify-center md:justify-start mb-2">
                <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-widest text-swiftly-orange border border-white/10 backdrop-blur-md">{isSharedMode ? '🔗 Shared Shipment View' : 'Account Portal'}</span>
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-[24px] md:text-[48px] font-bold text-white mb-2 leading-none font-outfit tracking-tight">
                {isSharedMode ? `Hello, ${displayUser!.firstName}` : `Welcome back, ${displayUser!.firstName}`}
              </motion.h1>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-1 sm:gap-3">
                {isSharedMode ? (
                  <span className="text-swiftly-sage font-medium text-[13px] md:text-[16px] flex items-center gap-1"><ShieldCheck size={14} /> Secure shared view — only your shipment is visible</span>
                ) : (
                  <>
                    <span className="text-swiftly-sage font-medium text-[13px] md:text-[16px] flex items-center gap-1"><ShieldCheck size={14} /> {displayUser!.accountType} Plan</span>
                    <span className="hidden sm:block w-1 h-1 rounded-full bg-swiftly-sage/50"></span>
                    <span className="text-swiftly-sage/70 font-medium text-[12px] md:text-[15px] truncate max-w-[220px] sm:max-w-none">{displayUser!.email}</span>
                  </>
                )}
              </motion.div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="flex w-full md:w-auto items-center justify-center gap-3">
            <button onClick={() => setShowNotif(!showNotif)} className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-swiftly-orange transition-all relative group shadow-xl shrink-0">
              <Bell size={20} className="group-hover:rotate-12 transition-transform" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-swiftly-orange rounded-full border-2 border-swiftly-deep flex items-center justify-center px-1">
                  <span className="text-[10px] font-bold text-white leading-none">{unreadCount > 9 ? "9+" : unreadCount}</span>
                </div>
              )}
            </button>
            {isSharedMode && (
              <Link href="/tracking">
                <button className="flex-1 md:flex-none px-6 py-3.5 md:px-8 md:py-4 rounded-full font-bold text-[14px] md:text-[16px] shadow-lg transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 whitespace-nowrap bg-swiftly-orange text-white">
                  <Search size={18} /> Track Another
                </button>
              </Link>
            )}
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-16 md:-mt-20 relative z-20" data-aos="fade-up">
        
        {/* ── BENTO GRID STATS ── */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-10">
          {[
            { label: "Active", val: activeCount, icon: Package, color: "text-[#0B2B26]", bg: "bg-white", border: "border-gray-100", trend: "+2 this week" },
            { label: "Pending", val: shipments.filter(s => s.status === "Label Created").length, icon: Clock, color: "text-[#F59A25]", bg: "bg-white", border: "border-gray-100", trend: "Needs attention" },
            { label: "Delivered", val: shipments.filter(s => s.status === "Delivered").length, icon: MapPin, color: "text-blue-500", bg: "bg-white", border: "border-gray-100", trend: "Lifetime" },
            { label: "Exceptions", val: shipments.filter(s => s.status === "Exception").length, icon: AlertCircle, color: "text-red-500", bg: "bg-white", border: "border-gray-100", trend: "Action required" },
            { label: "Unpaid Bills", val: unpaidBillsCount, icon: DollarSign, color: "text-amber-500", bg: "bg-white", border: "border-gray-100", trend: "Attention required", action: () => navigate("/billing") },
          ].map((s, i) => (
            <motion.div key={i} variants={fadeUp} onClick={(s as any).action} className={`bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${(s as any).action ? 'cursor-pointer' : ''}`}>
              <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gray-50 border border-gray-100 shrink-0 group-hover:scale-110 transition-transform`}>
                  <s.icon size={22} className={s.color} />
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-100">
                  {s.trend}
                </div>
              </div>
              <div>
                <p className="text-[36px] md:text-[44px] font-outfit font-bold text-[#0B2B26] leading-none mb-1 tracking-tight">{s.val}</p>
                <p className="text-[12px] font-bold uppercase tracking-widest text-gray-400 font-inter">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── MAIN CONTENT AREA ── */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          <div className="flex-1 space-y-8">
            
            {/* Premium Main / Billing View Switcher */}
            {currentView === "main" ? (
              <>
                {/* Supercharged Search/Track Bar */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white/80 backdrop-blur-md rounded-[28px] p-2.5 pl-6 flex items-center gap-3 shadow-lg shadow-gray-200/40 border border-white/60 group focus-within:border-swiftly-orange/50 focus-within:ring-4 focus-within:ring-swiftly-orange/5 transition-all">
                  <Search className="text-gray-400 group-focus-within:text-swiftly-orange transition-colors" size={20} />
                  <input type="text" placeholder="Track package or enter reference..." value={trackInput} onChange={(e) => setTrackInput(e.target.value)} className="flex-1 bg-transparent text-[15px] md:text-[16px] font-bold outline-none text-swiftly-deep placeholder:text-gray-400 py-3 min-w-0 font-inter" />
                  <button onClick={() => trackInput && navigate(`/tracking?tn=${encodeURIComponent(trackInput)}`)} className="px-6 md:px-10 py-4 rounded-[22px] font-bold text-[14px] text-white transition-all bg-swiftly-deep hover:bg-swiftly-forest whitespace-nowrap shadow-md active:scale-95">
                    Track Now
                  </button>
                </motion.div>

                {/* Premium Shipments List */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-white rounded-[32px] p-6 md:p-8 shadow-sm border border-gray-100">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                      <h2 className="text-[24px] font-outfit font-bold text-[#0B2B26] tracking-tight">Recent Shipments</h2>
                      <p className="text-gray-400 text-[14px]">Your active logistics journey.</p>
                    </div>
                    <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 self-start">
                      {["all", "active", "delivered"].map((t) => (
                        <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === t ? "bg-white text-[#0B2B26] shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-600"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">
                    {shipments.length === 0 ? (
                      <div className="py-28 text-center">
                        <div className="w-24 h-24 rounded-full bg-gray-50/80 flex items-center justify-center mx-auto mb-8 shadow-inner border border-gray-100">
                          <Package size={40} className="text-gray-300" />
                        </div>
                        <p className="text-[22px] font-outfit font-bold text-swiftly-deep mb-2 tracking-tight">No shipments found</p>
                        <p className="text-gray-500 font-medium text-[15px]">Create your first shipment to see it appear here.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-5">
                        <AnimatePresence mode="popLayout">
                          {shipments.filter(s => activeTab === "all" || (activeTab === "active" && !["Delivered", "Exception"].includes(s.status)) || (activeTab === "delivered" && s.status === "Delivered")).map((s) => (
                            <motion.div 
                              key={s.id} 
                              layout 
                              initial={{ opacity: 0, y: 10 }} 
                              animate={{ opacity: 1, y: 0 }} 
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="bg-white rounded-2xl p-5 cursor-pointer border border-gray-100 hover:border-[#F59A25] transition-all shadow-sm flex flex-col sm:flex-row items-center gap-6 group"
                              onClick={() => setSelectedShipment(s)}
                            >
                              <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 group-hover:bg-[#F59A25]/5 transition-colors">
                                <Package size={24} className="text-[#0B2B26] group-hover:text-[#F59A25] transition-colors" />
                              </div>
                              
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                                <div className="flex flex-col justify-center text-center sm:text-left">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#F59A25] mb-1">{s.trackingNumber || s.tracking_code}</p>
                                  <p className="text-[16px] font-bold text-[#0B2B26] truncate">{s.to?.name || s.receiver_name || "Recipient"}</p>
                                </div>
                                
                                <div className="flex flex-col justify-center items-center">
                                  <StatusBadge status={s.status || s.current_status || "Pending"} />
                                </div>
                                
                                <div className="flex flex-col justify-center items-center sm:items-end">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Delivery</p>
                                  <p className="text-[14px] font-bold text-[#0B2B26]">{(s.estimatedDelivery || s.expected_delivery_date || "TBD").split(" by ")[0]}</p>
                                </div>
                              </div>
                              
                              <ChevronRight size={18} className="text-gray-300 group-hover:text-[#F59A25] group-hover:translate-x-1 transition-all hidden sm:block" />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            ) : (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white/90 backdrop-blur-md rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-xl border border-white/80">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                  <div>
                    <h2 className="text-[28px] font-outfit font-bold text-swiftly-deep tracking-tight">Billing & Invoices</h2>
                    <p className="text-gray-400 text-sm">Review your shipping charges and payments.</p>
                  </div>
                  <button onClick={() => setCurrentView("main")} className="px-5 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-swiftly-deep font-bold text-xs flex items-center gap-2 transition-all">
                    <ArrowLeft size={14} /> Back to Dashboard
                  </button>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const filteredBills = isSharedMode 
                      ? allBills.filter(b => b.title?.includes(sharedShipment!.trackingNumber || "") || b.note?.includes(sharedShipment!.trackingNumber || ""))
                      : allBills;

                    if (filteredBills.length === 0) {
                      return (
                        <div className="py-20 text-center">
                          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FileText size={32} className="text-gray-300" />
                          </div>
                          <p className="font-bold text-swiftly-deep text-lg">No bills found</p>
                          <p className="text-gray-400 text-sm mt-1">When a bill is issued for your shipment, it will appear here.</p>
                        </div>
                      );
                    }

                    return filteredBills.map(bill => (
                      <div key={bill.id} className="p-6 rounded-[24px] border border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                            <DollarSign size={20} className="text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-swiftly-deep text-[16px] truncate">{bill.title}</p>
                            <p className="text-[12px] text-gray-400 font-medium">{new Date(bill.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-right">
                            <p className="font-bold text-swiftly-deep text-[18px]">${bill.amount.toFixed(2)}</p>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${bill.status === "paid" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>{bill.status}</span>
                          </div>
                          {!isSharedMode && (
                            <Link href="/billing">
                              <button className="px-4 py-2 rounded-lg bg-swiftly-deep text-white text-xs font-bold hover:bg-swiftly-forest transition-all">Pay Now</button>
                            </Link>
                          )}
                          {isSharedMode && bill.status === "unpaid" && (
                            <div className="px-4 py-2 rounded-lg bg-swiftly-orange/10 text-swiftly-orange text-[10px] font-bold border border-swiftly-orange/20">
                              Contact Sender to Pay
                            </div>
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </motion.div>
            )}
          </div>

          {/* ── PREMIUM SIDEBAR ── */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="lg:w-[360px] flex flex-col gap-6">
            
            {/* Quick Actions Bento */}
            <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100">
              <h3 className="text-[13px] font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                <Settings size={16} className="text-[#F59A25]" /> Dashboard Actions
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Overview", icon: Package, action: () => setCurrentView("main"), active: currentView === "main", color: "text-[#0B2B26]", bg: "bg-gray-50" },
                  { label: "Billing", icon: CreditCard, link: "/billing", color: "text-blue-500", bg: "bg-blue-50" },
                  { label: "Help Center", icon: HelpCircle, link: "/support/help-center", color: "text-[#F59A25]", bg: "bg-orange-50" },
                  { label: "Find Us", icon: MapPin, link: "/support/help-center", color: "text-purple-500", bg: "bg-purple-50" },
                ].map((a, i) => (
                  <div key={i} onClick={a.action ? a.action : undefined} className="h-full">
                    {a.link ? (
                      <Link href={a.link}>
                        <div className="rounded-[24px] p-5 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 hover:shadow-lg h-full">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${a.bg}`}>
                            <a.icon size={20} className={a.color} />
                          </div>
                          <p className="text-[12px] font-bold text-[#0B2B26] text-center">{a.label}</p>
                        </div>
                      </Link>
                    ) : (
                      <div className={`rounded-[24px] p-5 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group border ${a.active ? "bg-white border-[#F59A25] shadow-lg" : "bg-gray-50 border-transparent hover:bg-white hover:border-gray-200 hover:shadow-lg"} h-full`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${a.bg}`}>
                          <a.icon size={20} className={a.color} />
                        </div>
                        <p className="text-[12px] font-bold text-[#0B2B26] text-center">{a.label}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>



          </motion.div>
        </div>
      </div>

      {/* ── PREMIUM SLIDE-OVER DRAWER (SHIPMENT DETAILS) ── */}
      <AnimatePresence>
        {selectedShipment && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-[300] bg-swiftly-deep/60 backdrop-blur-sm"
              onClick={() => setSelectedShipment(null)}
            />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }} 
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 md:left-1/2 md:-translate-x-1/2 z-[400] w-full md:max-w-3xl h-[90vh] md:h-[85vh] bg-white shadow-2xl flex flex-col rounded-t-[40px] overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-8 border-b border-gray-100 bg-gray-50/80 backdrop-blur-md flex items-start justify-between relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-swiftly-mint opacity-50 blur-[40px] rounded-full pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Package size={16} className="text-swiftly-orange" />
                    <p className="text-[12px] font-bold uppercase tracking-widest text-swiftly-orange font-mono">{selectedShipment.trackingNumber}</p>
                  </div>
                  <h2 className="text-[28px] font-outfit font-bold text-swiftly-deep">Shipment Details</h2>
                </div>
                <button onClick={() => setSelectedShipment(null)} className="w-12 h-12 rounded-full flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-100 hover:rotate-90 transition-all shadow-sm relative z-10">
                  <X size={20} className="text-swiftly-deep" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                
                {/* Visual Timeline */}
                <div className="bg-white rounded-[24px] p-6 border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Progress</p>
                    <StatusBadge status={selectedShipment.status} />
                  </div>
                  <ShipmentTimeline status={selectedShipment.status} />
                  
                  <div className="mt-8 pt-6 border-t border-gray-100 flex items-center gap-4 bg-gray-50 p-4 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-swiftly-orange">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">Estimated Delivery</p>
                      <p className="text-[16px] font-bold text-swiftly-deep">{selectedShipment.estimatedDelivery || selectedShipment.expected_delivery_date || "TBD"}</p>
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 border border-gray-100 rounded-[20px] p-5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2"><Settings size={14}/> Service</p>
                    <p className="text-[15px] font-bold text-swiftly-deep">{selectedShipment.service}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-[20px] p-5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2"><Package size={14}/> Weight</p>
                    <p className="text-[15px] font-bold text-swiftly-deep">{selectedShipment.weight}</p>
                  </div>
                </div>

                {/* Routing info */}
                <div className="relative">
                  {/* Connection Line */}
                  <div className="absolute left-6 top-16 bottom-16 w-0.5 bg-gray-200 border-dashed border-l-2 border-gray-200"></div>
                  
                  <div className="space-y-6 relative z-10">
                    {/* Origin */}
                    <div className="bg-white border border-gray-200 rounded-[24px] p-6 shadow-sm flex items-start gap-5 hover:border-gray-300 transition-colors">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200">
                        <Package size={20} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">Origin</p>
                        <p className="text-[16px] font-bold text-swiftly-deep mb-1">{selectedShipment.from?.name || selectedShipment.sender_name || "Sender"}</p>
                        <p className="text-[14px] text-gray-500 font-medium leading-relaxed">
                          {selectedShipment.from ? (<>{selectedShipment.from.address}<br />{selectedShipment.from.city}, {selectedShipment.from.state} {selectedShipment.from.zip}</>) : (selectedShipment.origin || selectedShipment.sender_address || "—")}
                        </p>
                      </div>
                    </div>

                    {/* Destination */}
                    <div className="bg-white border border-swiftly-mint rounded-[24px] p-6 shadow-md shadow-swiftly-mint/20 flex items-start gap-5">
                      <div className="w-12 h-12 rounded-xl bg-swiftly-mint/50 flex items-center justify-center shrink-0 border border-swiftly-mint">
                        <MapPin size={20} className="text-swiftly-forest" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-swiftly-forest mb-1">Destination</p>
                        <p className="text-[16px] font-bold text-swiftly-deep mb-1">{selectedShipment.to?.name || selectedShipment.receiver_name || "Recipient"}</p>
                        <p className="text-[14px] text-gray-500 font-medium leading-relaxed">
                          {selectedShipment.to ? (<>{selectedShipment.to.address}<br />{selectedShipment.to.city}, {selectedShipment.to.state} {selectedShipment.to.zip}</>) : (selectedShipment.destination || selectedShipment.receiver_address || "—")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 md:p-8 border-t border-gray-100 bg-white space-y-3">
                {!isSharedMode && (
                  <>
                    {/* Share Row */}
                    <button
                      onClick={async () => {
                        if (!user) return;
                        const url = buildShareUrl(await createShareLink(selectedShipment.id, user.email, selectedShipment.to?.name || selectedShipment.receiver_name));
                        setShareModal({ shipment: selectedShipment, url });
                      }}
                      className="w-full py-3.5 rounded-[18px] font-bold text-[14px] border-2 border-swiftly-orange/30 text-swiftly-orange bg-swiftly-orange/5 hover:bg-swiftly-orange/10 transition-all flex items-center justify-center gap-2"
                    >
                      <Share2 size={16} /> Share with Recipient
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={async () => {
                          if(confirm("Archive this shipment? It will be hidden from your dashboard.")) {
                            await deleteShipment(selectedShipment.id);
                            reload();
                            setSelectedShipment(null);
                            showToast("Shipment archived successfully.");
                          }
                        }}
                        className="w-full py-4 rounded-[18px] border-2 border-gray-200 font-bold text-[14px] text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center gap-2"
                      >
                        <X size={16} /> Archive
                      </button>
                      <button
                        onClick={() => navigate(`/tracking?tn=${selectedShipment.trackingNumber}`)}
                        className="w-full py-4 rounded-[18px] font-bold text-[14px] text-white shadow-lg shadow-swiftly-orange/30 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 bg-swiftly-orange hover:bg-swiftly-amber"
                      >
                        Track Full <ChevronRight size={16} />
                      </button>
                    </div>
                  </>
                )}
                {isSharedMode && (
                  <button
                    onClick={() => navigate(`/tracking?tn=${selectedShipment.trackingNumber}`)}
                    className="w-full py-4 rounded-[18px] font-bold text-[14px] text-white shadow-lg shadow-swiftly-orange/30 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 bg-swiftly-orange hover:bg-swiftly-amber"
                  >
                    Track Full <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── NOTIFICATIONS PANEL ── */}
      <AnimatePresence>
        {showNotif && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[500] bg-swiftly-deep/60 backdrop-blur-sm"
              onClick={() => setShowNotif(false)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 z-[600] w-full max-w-sm bg-white shadow-2xl flex flex-col"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50 shrink-0">
                <div>
                  <h3 className="font-outfit font-bold text-lg text-swiftly-deep">Notifications</h3>
                  {unreadCount > 0 && <p className="text-xs text-gray-500">{unreadCount} unread</p>}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={async () => { await markAllNotificationsRead(isSharedMode ? sharedSenderEmail! : user!.email); reload(); }}
                      className="text-xs font-bold text-swiftly-orange hover:underline px-2 py-1"
                    >Mark all read</button>
                  )}
                  <button onClick={() => setShowNotif(false)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-200 transition-colors">
                    <X size={18} className="text-swiftly-deep" />
                  </button>
                </div>
              </div>

              {/* Panel Body */}
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                      <Bell size={22} className="text-gray-300" />
                    </div>
                    <p className="font-bold text-gray-400 text-sm">No notifications yet</p>
                    <p className="text-gray-300 text-xs mt-1">Billing and deposit updates will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.map(notif => {
                      const icons: Record<string, { icon: React.ReactNode; bg: string }> = {
                        bill_created: { icon: <FileText size={16} className="text-blue-500" />, bg: "bg-blue-50" },
                        deposit_approved: { icon: <CheckCircle2 size={16} className="text-green-500" />, bg: "bg-green-50" },
                        deposit_rejected: { icon: <AlertCircle size={16} className="text-red-500" />, bg: "bg-red-50" },
                        bill_paid: { icon: <DollarSign size={16} className="text-swiftly-orange" />, bg: "bg-swiftly-cream" },
                      };
                      const cfg = icons[notif.type] || icons.bill_created;
                      return (
                        <div key={notif.id} 
                             onClick={() => {
                               if (notif.type === "bill_created") {
                                 setShowNotif(false);
                                 navigate("/billing");
                               }
                             }}
                             className={`flex items-start gap-3 px-5 py-4 transition-colors hover:bg-gray-50 ${!notif.read ? "bg-blue-50/40" : ""} ${notif.type === "bill_created" ? "cursor-pointer" : ""}`}>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-sm text-swiftly-deep leading-snug">{notif.title}</p>
                              {!notif.read && <div className="w-2 h-2 bg-swiftly-orange rounded-full shrink-0 mt-1.5" />}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{notif.body}</p>
                            <p className="text-[10px] text-gray-400 mt-1.5">
                              {new Date(notif.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Panel Footer */}
              <div className="px-5 py-4 border-t border-gray-100 shrink-0">
                <Link href="/billing">
                  <button onClick={() => setShowNotif(false)} className="w-full py-3 rounded-xl bg-swiftly-deep text-white font-bold text-sm hover:bg-swiftly-forest transition-colors flex items-center justify-center gap-2">
                    <CreditCard size={16} /> View Billing & Payments
                  </button>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── SHARE MODAL ── */}
      <AnimatePresence>
        {shareModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] bg-black/60 backdrop-blur-sm" onClick={() => setShareModal(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed z-[800] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4 bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-8 pb-6 bg-gradient-to-br from-swiftly-deep to-swiftly-forest relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
                <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-swiftly-orange/20 rounded-full" />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-swiftly-orange flex items-center justify-center">
                        <Share2 size={17} className="text-white" />
                      </div>
                      <span className="text-white/60 text-xs font-bold uppercase tracking-widest">Share Shipment</span>
                    </div>
                    <h2 className="text-2xl font-outfit font-bold text-white mb-1">Share with Recipient</h2>
                    <p className="text-white/50 text-sm">They'll see only this shipment — nothing else.</p>
                  </div>
                  <button onClick={() => setShareModal(null)} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                    <X size={18} className="text-white" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-8 space-y-5">
                {/* Shipment Info */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-swiftly-orange/10 flex items-center justify-center">
                      <Package size={18} className="text-swiftly-orange" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-swiftly-orange font-mono">{shareModal.shipment.trackingNumber}</p>
                      <p className="text-swiftly-deep font-bold text-sm">{shareModal.shipment.to?.name || shareModal.shipment.receiver_name || "Recipient"}</p>
                      <p className="text-gray-400 text-xs">{shareModal.shipment.to ? `${shareModal.shipment.to.city}, ${shareModal.shipment.to.state}` : shareModal.shipment.destination || ""}</p>
                    </div>
                  </div>
                </div>

                {/* Link Box */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-1"><Link2 size={12} /> Shareable Link</p>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="flex-1 text-xs text-gray-600 font-mono truncate">{shareModal.url}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareModal.url);
                        showToast("Link copied to clipboard!");
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-swiftly-orange text-white text-xs font-bold hover:brightness-110 transition-all shrink-0"
                    >
                      <Copy size={13} /> Copy
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">Anyone with this link can view the shipment status. You can revoke it anytime.</p>
                </div>

                {/* Active shares for this shipment */}
                {(() => {
                  const existingShares = getSharesForShipment(shareModal.shipment.id);
                  if (existingShares.length === 0) return null;
                  return (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Active Share Links ({existingShares.length})</p>
                      {existingShares.map(share => (
                        <div key={share.token} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-gray-500 truncate">...{share.token.slice(-8)}</p>
                            <p className="text-[10px] text-gray-400">{new Date(share.createdAt).toLocaleDateString()}</p>
                          </div>
                          <button
                            onClick={async () => {
                              await revokeShareLink(share.token);
                              const newUrl = buildShareUrl(await createShareLink(shareModal.shipment.id, user!.email));
                              setShareModal(prev => prev ? { ...prev, url: newUrl } : null);
                              showToast("Share link revoked.");
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-bold hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={12} /> Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Share Actions */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: `Track your SWIFTLY LOGIX package`, text: `Here's a link to track your shipment (${shareModal.shipment.trackingNumber}):`, url: shareModal.url });
                      } else {
                        navigator.clipboard.writeText(shareModal.url);
                        showToast("Link copied!");
                      }
                    }}
                    className="py-3.5 rounded-2xl font-bold text-sm bg-swiftly-deep text-white hover:bg-swiftly-forest transition-all flex items-center justify-center gap-2"
                  >
                    <Share2 size={16} /> Share
                  </button>
                  <button onClick={() => setShareModal(null)} className="py-3.5 rounded-2xl font-bold text-sm border-2 border-gray-200 text-gray-500 hover:bg-gray-50 transition-all">
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
