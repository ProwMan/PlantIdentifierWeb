import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Camera,
  Leaf,
  Trophy,
  Shield,
  ChevronLeft,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  User as UserIcon,
  GraduationCap,
  Heart,
  Info,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  XCircle,
  Sparkles,
} from "lucide-react";
import { identifyPlant, loginUser, upsertUser, type PlantSuggestion } from "@/lib/api/identify.functions";
import { supabase, type User, type Discovery, type LeaderboardEntry, type UserStats } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "ACS(I) Plant Spotter" }],
  }),
  component: Index,
});

type Phase =
  | "login"
  | "menu"
  | "camera"
  | "identifying"
  | "results"
  | "leaderboard"
  | "badges"
  | "credits"
  | "error";

const ACSI_LAT = 1.3001;
const ACSI_LNG = 103.7812;

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// --- Sub-components ---

function PageContainer({
  children,
  phase,
  setPhase,
  showHeader = true,
  backTo,
  studentName,
  userPoints,
  title,
  isVerified,
  onLogout,
}: {
  children: React.ReactNode;
  phase: Phase;
  setPhase: (p: Phase) => void;
  showHeader?: boolean;
  backTo?: Phase;
  studentName: string;
  userPoints: number;
  title?: string;
  isVerified: boolean;
  onLogout?: () => void;
}) {
  return (
    <div className="min-h-screen triangle-bg flex flex-col items-center overflow-hidden font-sans">
      {showHeader && (
        <header className="w-full max-w-md px-6 pt-10 pb-6 bg-transparent sticky top-0 z-20">
          <div className="flex items-center justify-between mb-4">
            {backTo ? (
              <button
                onClick={() => setPhase(backTo)}
                className="text-white bg-black/20 backdrop-blur-lg p-1.5 rounded-full active:scale-95 transition-transform border border-white/10 hover:scale-105"
                aria-label="Go back"
              >
                <ChevronLeft className="h-6 w-6 stroke-[3]" />
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <img
                  src="/efg-logo.png"
                  className="h-16 w-16 object-contain drop-shadow-xl transition-transform hover:scale-105"
                  alt="EFG Logo"
                />
                <div className="flex flex-col">
                  <h1 className="text-[10px] font-bold text-[color:var(--acs-gold)] tracking-[0.2em] uppercase">
                    EFG App
                  </h1>
                  <h2 className="text-2xl font-black text-white leading-tight">ACS Independent</h2>
                </div>
              </div>
            )}
            {studentName && (
              <div className="text-right flex flex-col items-end">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{studentName}</span>
                  <button
                    onClick={onLogout}
                    className="text-white/40 hover:text-white transition-colors active:scale-90"
                    aria-label="Log out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className={`flex items-center gap-1 text-[8px] font-bold px-2 py-0.5 rounded-full border ${isVerified ? "text-emerald-400 border-emerald-400 bg-emerald-400/10" : "text-red-400 border-red-400 bg-red-400/10"}`}
                  >
                    {isVerified ? "Area Verified" : "Outside Area"}
                  </div>
                  <div className="text-[10px] font-bold text-[color:var(--acs-gold)] flex items-center gap-1">
                    {userPoints} <Trophy className="h-3 w-3 fill-current" />
                  </div>
                </div>
              </div>
            )}
          </div>
          {title && (
            <h2 className="text-3xl font-black text-white drop-shadow-md">{title}</h2>
          )}
        </header>
      )}
      <div className="w-full max-w-md flex-1 flex flex-col relative px-6 overflow-y-auto no-scrollbar">
        {children}
      </div>
    </div>
  );
}

function GlassCard({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div
      className={`liquid-glass p-6 rounded-[2rem] border-white/10 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "accent" | "danger" }) {
  const variants = {
    primary: "bg-gradient-to-br from-[color:var(--acs-gold)] to-[#e5a500] text-[color:var(--acs-blue-dark)] font-black border-b-4 border-black/20",
    secondary: "liquid-glass-beige border-white/20 text-white font-black",
    accent: "liquid-glass-gold border-white/20 text-white font-black",
    danger: "bg-gradient-to-br from-red-500 to-red-600 text-white font-black border-b-4 border-red-700/50",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-4.5 rounded-2xl shadow-xl active:scale-95 transition-all text-sm ${variants[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  onClick,
  className = "",
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "ghost" }) {
  const variants = {
    default: "text-white bg-black/40 backdrop-blur-lg p-2 rounded-full border border-white/10 active:scale-90 hover:scale-105 transition-transform",
    ghost: "text-white/40 hover:text-white transition-colors active:scale-90",
  };

  return (
    <button
      onClick={onClick}
      className={`${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Toast({
  message,
  type = "info",
  onClose,
}: { message: string; type?: "info" | "success" | "error" | "warning"; onClose: () => void }) {
  const icons = {
    info: <Info className="h-5 w-5" />,
    success: <CheckCircle className="h-5 w-5" />,
    error: <AlertCircle className="h-5 w-5" />,
    warning: <XCircle className="h-5 w-5" />,
  };
  const colors = {
    info: "border-[color:var(--efg-grey-blue)] bg-[color:var(--efg-grey-blue)]/10 text-[color:var(--efg-grey-blue)]",
    success: "border-emerald-400 bg-emerald-400/10 text-emerald-400",
    error: "border-red-400 bg-red-400/10 text-red-400",
    warning: "border-amber-400 bg-amber-400/10 text-amber-400",
  };

  return (
    <div
      className={`liquid-glass-dark fixed bottom-6 left-6 right-6 max-w-md mx-auto z-[100] animate-in slide-up-100 duration-300 ${colors[type]} border-2 p-4 rounded-[1.5rem] flex items-center gap-3 shadow-2xl`}
      role="alert"
    >
      <div className="flex-shrink-0">{icons[type]}</div>
      <p className="font-medium text-sm">{message}</p>
      <button onClick={onClose} className="ml-auto text-white/60 hover:text-white transition-colors">
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
}

function LoadingOverlay({ message = "Analyzing Flora..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="liquid-glass-dark border-4 border-[color:var(--acs-gold)]/30 rounded-[3.5rem] p-12 w-full flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="relative mb-8">
          <div className="h-24 w-24 border-[6px] border-white/5 border-t-[color:var(--acs-gold)] rounded-full animate-spin" />
          <Leaf className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-[color:var(--acs-gold)] animate-pulse" />
        </div>
        <p className="font-bold tracking-[0.2em] text-[12px] text-white/40">{message}</p>
      </div>
    </div>
  );
}

function ResultCard({
  suggestion,
  onConfirm,
  user,
  discoveries,
}: {
  suggestion: PlantSuggestion;
  onConfirm: (s: PlantSuggestion) => void;
  user: User | null;
  discoveries: Discovery[];
}) {
  if (!suggestion) return null;
  const foundBefore = user && discoveries.some(
    (d) => d.user_id === user.id && d.scientific_name?.toLowerCase() === suggestion.name?.toLowerCase(),
  );

  return (
    <button
      onClick={() => onConfirm(suggestion)}
      className="liquid-glass p-5 text-left flex items-center gap-5 transition-all rounded-[2rem] border-white/10 group hover:border-[color:var(--acs-gold)]/30 shadow-xl active:scale-[0.98]"
    >
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-bold italic text-lg leading-tight group-hover:text-[color:var(--acs-gold)] transition-colors truncate">
          {suggestion.name}
        </h3>
        <p className="text-[color:var(--efg-grey-olive)] text-[11px] font-semibold mt-1.5 truncate">
          {suggestion.commonNames[0] || "Unknown"}
        </p>
        <div className="h-1.5 w-24 bg-black/40 rounded-full mt-4 overflow-hidden border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-[color:var(--sage-green)] to-[color:var(--emerald-green)] transition-all duration-500"
            style={{ width: `${suggestion.probability * 100}%` }}
          />
        </div>
        {foundBefore && (
          <span className="mt-2 inline-block text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
            Already discovered • 1 pt
          </span>
        )}
      </div>
      {suggestion.thumbnail && (
        <div className="relative h-20 w-20 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl flex-shrink-0">
          <img
            src={suggestion.thumbnail}
            className="h-full w-full object-cover transform group-hover:scale-110 transition-transform duration-500"
            alt={suggestion.name}
          />
        </div>
      )}
    </button>
  );
}

function NoResultsCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="liquid-glass p-8 rounded-[2rem] border-white/10 text-center flex flex-col items-center gap-6">
      <div className="bg-red-500/20 p-4 rounded-full">
        <XCircle className="h-10 w-10 text-red-400 mx-auto" />
      </div>
      <div>
        <h3 className="text-xl font-black text-white mb-2">Plant Not Found</h3>
        <p className="text-white/60 text-sm leading-relaxed max-w-xs">
          We couldn't identify this plant with enough confidence. Try taking a clearer photo with good lighting, focusing on leaves or flowers.
        </p>
      </div>
      <ActionButton variant="primary" onClick={onRetry}>
        Try Again
      </ActionButton>
    </div>
  );
}

function SuccessOverlay({
  isNewDiscovery,
  points,
  onContinue,
}: { isNewDiscovery: boolean; points: number; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="liquid-glass-dark border-4 border-[color:var(--acs-gold)]/30 rounded-[3.5rem] p-12 w-full flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-br from-[color:var(--acs-gold)] to-[#e5a500] p-6 rounded-full mb-8 shadow-2xl">
          {isNewDiscovery ? (
            <Sparkles className="h-12 w-12 text-[color:var(--acs-blue-dark)]" />
          ) : (
            <CheckCircle className="h-12 w-12 text-[color:var(--acs-blue-dark)]" />
          )}
        </div>
        <h2 className="text-4xl font-black text-white mb-2 tracking-tighter drop-shadow-lg">
          {isNewDiscovery ? "New Discovery!" : "Logged"}
        </h2>
        <p className="text-[color:var(--acs-gold)] font-bold text-sm">+{points} Points Earned</p>
        <ActionButton variant="primary" onClick={onContinue} className="mt-12 w-full">
          Continue
        </ActionButton>
      </div>
    </div>
  );
}

function BadgeCard({ badge }: { badge: Discovery }) {
  if (!badge) return null;
  return (
    <div className="flex flex-col items-center gap-4 text-center group">
      <div className="shield-badge shadow-2xl transition-transform group-active:scale-95">
        <Shield className="h-10 w-10 text-[color:var(--acs-gold)] drop-shadow-lg" />
      </div>
      <div className="px-2">
        <span className="text-[11px] font-bold text-white leading-tight block truncate max-w-[80px]">
          {badge.scientific_name || "Unknown"}
        </span>
        <span className="text-[9px] font-medium text-[color:var(--efg-grey-olive)] mt-1.5 block truncate max-w-[80px]">
          {badge.common_name || "Unknown"}
        </span>
      </div>
    </div>
  );
}

// --- Main Component ---

function Index() {
  const identify = useServerFn(identifyPlant);
  const login = useServerFn(loginUser);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<Phase>("login");
  const [isLoading, setIsLoading] = useState(false);

  // Auth Form State
  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState("");
  const [authError, setAuthError] = useState("");

  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlantSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [successOverlay, setSuccessOverlay] = useState<{ isNew: boolean; points: number } | null>(null);

  const [locationState, setLocationState] = useState<"unknown" | "verified" | "outside">("unknown");
  const isVerified = locationState === "verified";
  const isOutside = locationState === "outside";

  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: "info" | "success" | "error" | "warning" }>>([]);

  const showToast = useCallback((message: string, type: "info" | "success" | "error" | "warning" = "info", duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  // Custom auth: Check localStorage for existing session on load
  useEffect(() => {
    const storedUid = localStorage.getItem("plant_spotter_uid");
    if (storedUid) {
      // Fetch user profile from database
      supabase
        .from("users")
        .select("*")
        .eq("id", storedUid)
        .single()
        .then(({ data: profile }) => {
          if (profile) {
            setUser(profile);
            setPhase("menu");
          } else {
            localStorage.removeItem("plant_spotter_uid");
          }
        })
        .catch(() => {
          localStorage.removeItem("plant_spotter_uid");
        });
    }
  }, []);

  // Subscribe to discoveries
  useEffect(() => {
    const channel = supabase
      .channel("discoveries_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "discoveries" },
        () => fetchDiscoveries()
      )
      .subscribe();

    fetchDiscoveries();
    fetchLeaderboard();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchDiscoveries = async () => {
    const { data, error } = await supabase
      .from("discoveries")
      .select("*")
      .order("found_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      setDiscoveries(data as Discovery[]);
      if (user) {
        fetchUserStats();
      }
    }
  };

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase.rpc("get_leaderboard");
    if (!error && data) {
      setLeaderboard(data as LeaderboardEntry[]);
    }
  };

  const fetchUserStats = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("get_user_stats", { p_user_id: user.id });
    if (!error && data?.[0]) {
      setUserStats(data[0] as UserStats);
    }
  };

  async function handleAuth() {
    setAuthError("");
    setIsLoading(true);

    if (!fullName.trim() || !className.trim()) {
      setAuthError("Please fill in both fields");
      setIsLoading(false);
      return;
    }

    try {
      const { uid, displayName } = await login({ data: { fullName, className } });

      // Use server function to upsert user (bypasses RLS with service role)
      await upsertUser({ data: { uid, fullName, className } });

      // Store session in localStorage
      localStorage.setItem("plant_spotter_uid", uid);
      setUser({ id: uid, full_name: fullName.trim(), class_name: className.trim(), display_name: displayName, last_login: new Date().toISOString(), created_at: new Date().toISOString() });
      setPhase("menu");
      showToast("Welcome to Plant Spotter!", "success");
    } catch (err: any) {
      setAuthError(err.message);
      showToast(err.message, "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    localStorage.removeItem("plant_spotter_uid");
    setUser(null);
    setPhase("login");
    showToast("Logged out successfully", "info");
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    setError(null);

    if (typeof window === "undefined") return;
    if (!navigator.geolocation) {
      showToast("Location access is required to identify plants.", "error");
      return;
    }

    const locationOk = await new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = getDistance(pos.coords.latitude, pos.coords.longitude, ACSI_LAT, ACSI_LNG);
          const ok = dist <= 0.5;
          if (!ok) {
            showToast(`Action Blocked: You must be within 0.5km of ACS Independent. Current distance: ${dist.toFixed(2)}km`, "error");
            setLocationState("outside");
          } else {
            showToast("Location verified!", "success");
            setLocationState("verified");
          }
          resolve(ok);
        },
        () => {
          showToast("Action Blocked: Location access is required to verify you are in school.", "error");
          setLocationState("outside");
          resolve(false);
        },
        { timeout: 5000, enableHighAccuracy: true },
      );
    });

    if (locationState !== "verified") {
      return;
    }

    setPhase("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
        videoRef.current?.play();
      }, 200);
    } catch {
      setPhase("error");
      showToast("Camera access denied", "error");
    }
  }

  async function checkVerification() {
    if (typeof window === "undefined") return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = getDistance(pos.coords.latitude, pos.coords.longitude, ACSI_LAT, ACSI_LNG);
          const ok = dist <= 0.5;
          if (!ok) {
            showToast(`Outside Area: You are ${dist.toFixed(2)}km away. Please be within 0.5km of ACS Independent.`, "error");
            setLocationState("outside");
          } else {
            showToast("Location Verified! You are within the school area.", "success");
            setLocationState("verified");
          }
        },
        () => {
          setLocationState("outside");
          showToast("Location Error: Please enable GPS/Location access to verify you are in school.", "error");
        },
        { timeout: 5000, enableHighAccuracy: true },
      );
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;

    if (typeof window === "undefined") return;

    // ALWAYS verify location on EVERY capture attempt
    const checkLoc = () =>
      new Promise<boolean>((resolve) => {
        if (!navigator.geolocation) return resolve(false);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const dist = getDistance(pos.coords.latitude, pos.coords.longitude, ACSI_LAT, ACSI_LNG);
            const ok = dist <= 0.5;
            if (!ok) {
              showToast(`Action Blocked: You must be within 0.5km of ACS Independent. Current distance: ${dist.toFixed(2)}km`, "error");
            }
            resolve(ok);
          },
          () => {
            showToast("Action Blocked: Location access is required to verify you are in school.", "error");
            resolve(false);
          },
          { timeout: 5000, enableHighAccuracy: true },
        );
      });

    const isLocOk = await checkLoc();
    if (!isLocOk) {
      setLocationState("outside");
      setPhase("menu");
      stopCamera();
      return;
    }
    setLocationState("verified");

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    canvas
      .getContext("2d")
      ?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, 1024, 1024);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setSnapshot(dataUrl);
    stopCamera();
    setPhase("identifying");

    try {
      const result = await identify({ data: { imageDataUrl: dataUrl } });
      setSuggestions(result.suggestions);

      if (result.suggestions.length === 0) {
        setPhase("error");
        setError("No plant found with sufficient confidence. Please try again with a clearer photo.");
      } else {
        setPhase("results");
      }
    } catch (err: any) {
      setPhase("error");
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  async function confirmDiscovery(suggestion: PlantSuggestion) {
    if (!user) return;

    const foundBefore = discoveries.some(
      (d) => d.user_id === user.id && d.scientific_name.toLowerCase() === suggestion.name.toLowerCase(),
    );

    const points = foundBefore ? 1 : 10;

    // Check daily limits via RPC
    const { data: limitCheck, error: limitError } = await supabase.rpc("check_daily_limits", {
      p_user_id: user.id,
      p_points: points,
    });

    if (limitError || !limitCheck?.[0]?.allowed) {
      const message = limitCheck?.[0]?.message || "Daily limit reached";
      setError(message);
      showToast(message, "error");
      setPhase("menu");
      return;
    }

    // Insert discovery
    const { error: insertError } = await supabase.from("discoveries").insert({
      user_id: user.id,
      student: user.display_name,
      scientific_name: suggestion.name,
      common_name: suggestion.commonNames[0] || "Unknown",
      points,
      confidence: suggestion.probability,
      found_at: new Date().toISOString(),
    });

    if (insertError) {
      showToast("Failed to save discovery", "error");
      return;
    }

    setSuccessOverlay({ isNew: !foundBefore, points });
    showToast(foundBefore ? "Rediscovery logged!" : "New discovery!", "success");
  }

  if (phase === "login") {
    return (
      <PageContainer
        phase={phase}
        setPhase={setPhase}
        showHeader={false}
        studentName=""
        userPoints={0}
        isVerified={false}
      >
        <div className="flex-1 flex flex-col justify-center items-center gap-8 py-10">
          <div className="flex flex-col items-center text-center animate-in fade-in duration-500">
            <img
              src="/efg-logo.png"
              className="h-64 w-64 object-contain mb-8 drop-shadow-2xl animate-bounce-slow"
              alt="EFG Logo"
            />
            <h1 className="text-4xl font-black tracking-tight text-white mb-1 drop-shadow-lg">EFG App</h1>
            <h2 className="text-sm font-bold text-[color:var(--acs-gold)] tracking-widest uppercase">
              Environment Focus Group
            </h2>
          </div>

          <GlassCard className="w-full space-y-4">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4 text-center">
              Student Registration
            </div>

            <div className="relative group">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-[color:var(--acs-gold)] transition-colors" />
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white font-semibold placeholder:text-white/20 outline-none focus:border-[color:var(--acs-gold)]/50 transition-all shadow-inner"
                autoComplete="name"
              />
            </div>

            <div className="relative group">
              <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 group-focus-within:text-[color:var(--acs-gold)] transition-colors" />
              <input
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Class (e.g. 1.01)"
                className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-white font-semibold placeholder:text-white/20 outline-none focus:border-[color:var(--acs-gold)]/50 transition-all shadow-inner"
                autoComplete="off"
              />
            </div>

            {authError && (
              <p className="text-center text-[10px] font-bold text-red-400 bg-red-400/10 py-2 rounded-lg border border-red-400/20 animate-in slide-up-50 duration-200">
                {authError}
              </p>
            )}

            <ActionButton onClick={handleAuth} disabled={isLoading} variant="primary">
              {isLoading ? "Registering..." : "Register & Start"}
            </ActionButton>
          </GlassCard>
        </div>
      </PageContainer>
    );
  }

  if (phase === "menu") {
    const userPoints = userStats?.total_points || 0;

    return (
      <PageContainer
        phase={phase}
        setPhase={setPhase}
        studentName={user?.display_name || ""}
        userPoints={userPoints}
        isVerified={isVerified}
        onLogout={handleLogout}
      >
        <div className="flex-1 flex flex-col justify-center gap-6 py-6">
          {/* Location Verification Card - Three states: unknown, verified, outside */}
          {locationState === "unknown" ? (
            <div className="liquid-glass-blue p-6 rounded-[2rem] border-[color:var(--efg-grey-blue)]/30 animate-in slide-up-100 duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-[color:var(--efg-grey-blue)]/20 p-3 rounded-xl">
                  <Shield className="h-6 w-6 text-[color:var(--efg-grey-blue)]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black text-white mb-1">Location Unknown</h3>
                  <p className="text-white/60 text-sm">Tap to verify you are within ACS Independent</p>
                </div>
              </div>
              <ActionButton variant="secondary" onClick={checkVerification} className="w-full">
                <span className="flex items-center justify-center gap-2">
                  <Shield className="h-4 w-4" />
                  Verify Location
                </span>
              </ActionButton>
            </div>
          ) : locationState === "outside" ? (
            <div className="liquid-glass-red p-6 rounded-[2rem] border-red-500/30 animate-in slide-up-100 duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-red-500/20 p-3 rounded-xl">
                  <ShieldAlert className="h-6 w-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black text-white mb-1">Not in School Area</h3>
                  <p className="text-white/60 text-sm">You must be within 0.5km of ACS Independent to identify plants</p>
                </div>
              </div>
              <ActionButton variant="danger" onClick={checkVerification} className="w-full">
                <span className="flex items-center justify-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Verify Location Now
                </span>
              </ActionButton>
              <p className="text-[10px] text-white/40 text-center mt-3">
                Tap the button above to check your GPS location
              </p>
            </div>
          ) : (
            <button
              onClick={checkVerification}
              className="liquid-glass p-6 rounded-[2rem] text-left active:scale-95 transition-all group border-l-4 border-emerald-500/50 hover:border-opacity-75"
            >
              <div className="flex items-center gap-3 mb-1 text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-bold uppercase text-xs tracking-widest">Location Verified</span>
              </div>
              <p className="text-[9px] font-medium text-white/40 uppercase leading-relaxed tracking-wider">
                You are within ACS Independent
              </p>
            </button>
          )}

          <button
            onClick={startCamera}
            disabled={locationState !== "verified"}
            className={`liquid-glass-beige border-white/20 text-white font-black py-12 rounded-[3rem] flex flex-col items-center gap-4 active:scale-95 transition-all group relative overflow-hidden hover:shadow-2xl ${
              locationState !== "verified" ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <div className="absolute inset-0 bg-black/10 pointer-events-none" />
            <div className="bg-black/40 p-6 rounded-full group-hover:scale-110 transition-transform shadow-xl border border-white/10 relative z-10">
              <Camera className="h-10 w-10 text-[color:var(--efg-beige)]" />
            </div>
            <span className="tracking-[0.1em] text-sm drop-shadow-lg font-black text-white relative z-10">Identify Plant</span>
          </button>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setPhase("leaderboard")}
              className="liquid-glass-olive p-8 rounded-[2.5rem] flex flex-col items-center gap-3 active:scale-95 transition-all border-white/20 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-black/10 pointer-events-none" />
              <Trophy className="h-6 w-6 text-[color:var(--efg-grey-olive)] group-hover:scale-110 transition-transform relative z-10" />
              <span className="text-[10px] font-black text-white relative z-10">Leaderboard</span>
            </button>
            <button
              onClick={() => setPhase("badges")}
              className="liquid-glass-gold p-8 rounded-[2.5rem] flex flex-col items-center gap-3 active:scale-95 transition-all border-white/20 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-black/10 pointer-events-none" />
              <Shield className="h-6 w-6 text-[color:var(--acs-gold)] group-hover:scale-110 transition-transform relative z-10" />
              <span className="text-[10px] font-black text-white relative z-10">Collection</span>
            </button>
          </div>

          <button
            onClick={() => setPhase("credits")}
            className="mt-4 liquid-glass-blue p-5 rounded-[2rem] flex items-center justify-center gap-4 active:scale-95 transition-all border-white/10 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-black/10 pointer-events-none" />
            <div className="bg-black/40 p-2.5 rounded-full group-hover:scale-110 transition-transform shadow-lg border border-white/10 relative z-10">
              <Info className="h-5 w-5 text-[color:var(--efg-grey-blue)]" />
            </div>
            <span className="text-[11px] font-black text-white tracking-widest relative z-10">App Credits & Feedback</span>
          </button>
        </div>
      </PageContainer>
    );
  }

  if (phase === "camera") {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
        <IconButton
          onClick={() => {
            stopCamera();
            setPhase("menu");
          }}
          className="absolute top-10 left-8"
          aria-label="Back to menu"
        >
          <ChevronLeft className="h-8 w-8 stroke-[3]" />
        </IconButton>
        <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center">
          <button
            onClick={capture}
            className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 shadow-2xl bg-white/20 backdrop-blur-sm transition-transform hover:scale-105"
            aria-label="Capture photo"
          >
            <div className="h-16 w-16 rounded-full bg-white shadow-inner" />
          </button>
        </div>
        <p className="absolute bottom-28 left-1/2 -translate-x-1/2 text-white/60 text-sm text-center px-4">
          Position the plant in the frame and tap the shutter
        </p>
      </div>
    );
  }

  if (phase === "identifying") {
    return (
      <PageContainer
        phase={phase}
        setPhase={setPhase}
        studentName={user?.display_name || ""}
        userPoints={userStats?.total_points || 0}
        isVerified={isVerified}
      >
        <LoadingOverlay />
      </PageContainer>
    );
  }

  if (phase === "results") {
    return (
      <PageContainer
        phase={phase}
        setPhase={setPhase}
        backTo="menu"
        studentName={user?.display_name || ""}
        userPoints={userStats?.total_points || 0}
        isVerified={isVerified}
        title="Matches"
      >
        <div className="flex-1 py-6 grid gap-4">
          {suggestions.length === 0 ? (
            <NoResultsCard onRetry={() => { setPhase("menu"); stopCamera(); }} />
          ) : (
            suggestions.map((s) => (
              <ResultCard
                key={s.name}
                suggestion={s}
                onConfirm={confirmDiscovery}
                user={user}
                discoveries={discoveries}
              />
            ))
          )}
        </div>
        {successOverlay && (
          <SuccessOverlay
            isNewDiscovery={successOverlay.isNew}
            points={successOverlay.points}
            onContinue={() => {
              setSuccessOverlay(null);
              setPhase("menu");
            }}
          />
        )}
      </PageContainer>
    );
  }

  if (phase === "badges") {
    const userBadges = useMemo(() => {
      if (!user || !discoveries?.length) return [];
      const unique = new Map<string, Discovery>();
      discoveries
        .filter((d) => d.user_id === user.id)
        .forEach((d) => {
          if (d.scientific_name && !unique.has(d.scientific_name)) unique.set(d.scientific_name, d);
        });
      return Array.from(unique.values());
    }, [discoveries, user]);

    return (
      <PageContainer
        phase={phase}
        setPhase={setPhase}
        backTo="menu"
        studentName={user?.display_name || ""}
        userPoints={userStats?.total_points || 0}
        isVerified={isVerified}
        title="Collection"
      >
        <div className="flex-1 py-8 grid grid-cols-2 gap-x-8 gap-y-12 justify-items-center">
          {userBadges.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center justify-center py-12 text-center">
              <Shield className="h-16 w-16 text-white/20 mb-4" />
              <p className="text-white/60 text-sm">No discoveries yet</p>
              <p className="text-[11px] text-white/40 mt-1">Start identifying plants to build your collection</p>
            </div>
          ) : (
            userBadges.filter(Boolean).map((b) => <BadgeCard key={b.id} badge={b} />)
          )}
        </div>
      </PageContainer>
    );
  }

  if (phase === "leaderboard") {
    return (
      <PageContainer
        phase={phase}
        setPhase={setPhase}
        backTo="menu"
        studentName={user?.display_name || ""}
        userPoints={userStats?.total_points || 0}
        isVerified={isVerified}
        title="Standing"
      >
        <div className="flex-1 flex flex-col gap-4 py-8">
          {leaderboard.map((e, idx) => (
            <div
              key={e.student}
              className={`liquid-glass px-8 py-6 rounded-[2.5rem] flex items-center justify-between group border-l-4 ${idx === 0 ? "border-[color:var(--acs-gold)]" : "border-white/5"}`}
            >
              <div className="flex items-center gap-6">
                <span className={`text-2xl font-black ${idx === 0 ? "text-[color:var(--acs-gold)]" : "text-white/10"}`}>
                  #{idx + 1}
                </span>
                <span className="font-bold text-lg text-white group-hover:text-[color:var(--acs-gold)] transition-colors tracking-tight">
                  {e.student}
                </span>
              </div>
              <span className="font-bold text-sm text-[color:var(--acs-gold)] bg-black/20 px-4 py-1.5 rounded-full border border-white/5">
                {e.total_points} <span className="text-[10px] ml-0.5 font-bold">pts</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mb-14 mt-auto p-8 liquid-glass-dark border-t-4 border-[color:var(--acs-gold)]/40 rounded-[3rem] shadow-2xl flex justify-between items-center bg-gradient-to-br from-black/60 to-transparent">
          <div className="flex items-center gap-5">
            <span className="text-2xl font-black text-[color:var(--acs-gold)] drop-shadow-lg">
              #{userStats?.rank || "-"}
            </span>
            <span className="font-bold text-lg text-white tracking-tighter drop-shadow-md">
              {user?.display_name}
            </span>
          </div>
          <span className="font-bold text-lg text-white bg-[color:var(--acs-gold)]/10 px-6 py-2 rounded-2xl border border-[color:var(--acs-gold)]/20 shadow-inner">
            {userStats?.total_points || 0} <span className="text-xs font-bold">pts</span>
          </span>
        </div>
      </PageContainer>
    );
  }

  if (phase === "credits") {
    return (
      <PageContainer
        phase={phase}
        setPhase={setPhase}
        backTo={user ? "menu" : "login"}
        studentName={user?.display_name || ""}
        userPoints={userStats?.total_points || 0}
        isVerified={isVerified}
        title="Credits"
      >
        <div className="flex-1 flex flex-col items-center justify-center py-10 gap-8">
          <GlassCard className="w-full text-center">
            <div className="bg-gradient-to-br from-[color:var(--acs-gold)] to-[#e5a500] p-6 rounded-full inline-block mb-6 shadow-xl">
              <Heart className="h-10 w-10 text-[color:var(--acs-blue-dark)]" />
            </div>

            <h3 className="text-2xl font-black text-white tracking-tighter mb-4">
              Done by Environment Focus Group
            </h3>

            <p className="text-sm font-medium text-white/60 leading-relaxed mb-8 px-4">
              This application was designed and developed by the Environment Focus Group (EFG) CCA at ACS Independent.
            </p>

            <div className="liquid-glass-dark p-6 rounded-2xl border-white/10">
              <div className="flex items-center justify-center gap-3 mb-2">
                <MessageSquare className="h-4 w-4 text-[color:var(--acs-gold)]" />
                <span className="text-[11px] font-bold text-white uppercase tracking-widest">Feedback</span>
              </div>
              <p className="text-sm font-semibold text-[color:var(--acs-gold)]">
                Contact Selvakumar Madhan via MS Teams
              </p>
            </div>
          </GlassCard>

          <div className="text-center space-y-2 opacity-30">
            <p className="text-[10px] font-bold tracking-widest uppercase">ACS Independent • 2026</p>
            <img src="/efg-logo.png" className="h-10 w-10 grayscale mx-auto" alt="Logo" />
          </div>
        </div>
      </PageContainer>
    );
  }

  return null;
}

export default Index;