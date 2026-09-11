import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CheckSquare,
  Receipt,
  Plus,
  X,
  Pencil,
  Trash2,
  Search,
  ChevronRight,
  Circle,
  CircleDot,
  CircleCheck,
  AlertTriangle,
  Building2,
  KeyRound,
  FolderOpen,
  Download,
  Upload,
  LogOut,
  ShieldCheck,
  FileText,
  Loader2,
  CheckCircle2,
  Menu,
  Copy,
  GripVertical,
  Settings,
  Eye,
  Sparkles,
  ListPlus,
  Building,
  Mail,
  Lock,
  Clock,
  Wallet,
  Clock3,
  TrendingUp,
  BarChart3,
  Command,
  ArrowRight,
  Calendar,
  User,
  CreditCard,
  Facebook,
  Instagram,
  Phone,
  MessageCircle,
  Bell,
} from "lucide-react";
import { supabase, FILES_BUCKET } from "./supabaseClient.js";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/* ============================================================
   STUDIO OPS — a job-ticket / traffic-sheet ERP for a creative
   agency. Multi-tenant: anyone can create an account from the
   sign-in screen, and each account gets its own private
   workspace (clients, projects, tasks, invoices, files) — no
   account can see another's data. The client portal still reads
   through narrow, curated RPC functions rather than touching any
   account's data directly. See supabase/schema.sql for exactly
   what each policy allows.
   ============================================================ */

const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const todayISO = () => new Date().toISOString().slice(0, 10);

const PORTAL_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generatePortalCode(company) {
  // Codes just need to be unique within this one team's projects (the
  // portal RPC looks up a single shared erp_state row), so collisions
  // are effectively a non-issue here — this is generous on purpose.
  const prefix = (company || "JOB").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "JOB";
  let suffix = "";
  for (let i = 0; i < 7; i++) suffix += PORTAL_CODE_CHARS[Math.floor(Math.random() * PORTAL_CODE_CHARS.length)];
  return `${prefix}-${suffix}`;
}

function fmtBytes(n) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const DEFAULT_SETTINGS = {
  studioName: "Studio Ops",
  tagline: "Creative agency",
  address: "",
  email: "",
  phone: "",
  taxId: "",
  paymentMethod: "",
  logoDataUrl: "",
  invoiceNote: "Thank you for the opportunity — payment is due by the date above.",
  primaryColor: "#16294D",
  accentColor: "#D64550",
};

const emptyData = () => ({
  clients: [],
  projects: [],
  tasks: [],
  invoices: [],
  expenses: [],
  timeEntries: [],
  jobCounter: 1001,
  settings: { ...DEFAULT_SETTINGS },
});

/* ---------- seed content, so the ERP never opens empty ---------- */
function seedData() {
  const c1 = uid("cli");
  const c2 = uid("cli");
  const c3 = uid("cli");
  const p1 = uid("prj");
  const p2 = uid("prj");
  const p3 = uid("prj");
  return {
    clients: [
      { id: c1, name: "Amina Belkacem", company: "Sable & Co.", email: "amina@sableco.dz", phone: "+213 555 0142", notes: "Rebrand + packaging retainer.", createdAt: "2026-02-04" },
      { id: c2, name: "Yacine Meziane", company: "Nordine Freight", email: "yacine@nordinefreight.com", phone: "+213 661 2290", notes: "Annual site refresh, invoices net-30.", createdAt: "2026-03-11" },
      { id: c3, name: "Lina Haddad", company: "Atelier Warda", email: "lina@atelierwarda.com", phone: "+213 770 4418", notes: "Small studio, quick-turn social work.", createdAt: "2026-05-22" },
    ],
    projects: [
      { id: p1, clientId: c1, name: "Sable & Co. Rebrand", status: "active", budget: 480000, deadline: "2026-09-15", description: "Full identity system: mark, type, packaging templates.", portalCode: "SAB-7F2K4" },
      { id: p2, clientId: c2, name: "Nordine Freight — Site Refresh", status: "review", budget: 260000, deadline: "2026-08-20", description: "12-page marketing site on the existing design system.", portalCode: "NOR-9XQ2M" },
      { id: p3, clientId: c3, name: "Atelier Warda — Autumn Campaign", status: "planning", budget: 90000, deadline: "2026-08-30", description: "6-piece social campaign, product-led.", portalCode: "ATE-3LR8P" },
    ],
    tasks: [
      { id: uid("tsk"), projectId: p1, title: "Finalize wordmark options", assignee: "Nabil", status: "in-progress", priority: "high", dueDate: "2026-08-10" },
      { id: uid("tsk"), projectId: p1, title: "Build packaging die-line templates", assignee: "Sara", status: "todo", priority: "medium", dueDate: "2026-08-18" },
      { id: uid("tsk"), projectId: p2, title: "Client review pass — homepage", assignee: "Yasmine", status: "review", priority: "high", dueDate: "2026-08-09" },
      { id: uid("tsk"), projectId: p2, title: "Optimize hero imagery", assignee: "Nabil", status: "done", priority: "low", dueDate: "2026-08-01" },
      { id: uid("tsk"), projectId: p3, title: "Draft campaign concepts", assignee: "Sara", status: "todo", priority: "medium", dueDate: "2026-08-14" },
    ],
    invoices: [
      { id: uid("inv"), number: "1001", clientId: c1, projectId: p1, status: "sent", issueDate: "2026-07-15", dueDate: "2026-08-14", items: [{ desc: "Brand strategy & discovery", qty: 1, rate: 120000 }, { desc: "Identity design — phase 1", qty: 1, rate: 160000 }] },
      { id: uid("inv"), number: "1002", clientId: c2, projectId: p2, status: "paid", issueDate: "2026-06-20", dueDate: "2026-07-20", items: [{ desc: "Site design — 12 pages", qty: 1, rate: 180000 }, { desc: "CMS integration", qty: 1, rate: 60000 }] },
      { id: uid("inv"), number: "1003", clientId: c3, projectId: p3, status: "draft", issueDate: todayISO(), dueDate: "2026-09-05", items: [{ desc: "Campaign concept & direction", qty: 1, rate: 45000 }] },
      { id: uid("inv"), number: "1004", clientId: c1, projectId: p1, status: "paid", issueDate: "2026-04-10", dueDate: "2026-05-10", items: [{ desc: "Discovery workshop", qty: 1, rate: 60000 }] },
      { id: uid("inv"), number: "1005", clientId: c2, projectId: p2, status: "paid", issueDate: "2026-05-18", dueDate: "2026-06-18", items: [{ desc: "Homepage design", qty: 1, rate: 95000 }] },
      { id: uid("inv"), number: "1006", clientId: c3, projectId: p3, status: "paid", issueDate: "2026-03-22", dueDate: "2026-04-22", items: [{ desc: "Social templates — batch 1", qty: 1, rate: 40000 }] },
    ],
    expenses: [
      { id: uid("exp"), projectId: p1, description: "Stock photography license", amount: 8000, date: "2026-07-05", category: "Assets" },
      { id: uid("exp"), projectId: p1, description: "Print proof run", amount: 12500, date: "2026-07-20", category: "Production" },
      { id: uid("exp"), projectId: p2, description: "Font license (webfont)", amount: 4500, date: "2026-06-02", category: "Assets" },
      { id: uid("exp"), projectId: p3, description: "Freelance illustrator — 2 pieces", amount: 25000, date: "2026-06-15", category: "Contractor" },
    ],
    timeEntries: [
      { id: uid("time"), projectId: p1, hours: 4, date: todayISO(), note: "Wordmark exploration" },
      { id: uid("time"), projectId: p1, hours: 2.5, date: todayISO(), note: "Client call + notes" },
      { id: uid("time"), projectId: p2, hours: 5, date: addDays(todayISO(), -1), note: "Homepage build" },
      { id: uid("time"), projectId: p3, hours: 3, date: addDays(todayISO(), -2), note: "Concept sketches" },
      { id: uid("time"), projectId: p2, hours: 1.5, date: addDays(todayISO(), -3), note: "Review pass" },
    ],
    jobCounter: 1004,
    settings: {
      studioName: "Studio Ops",
      tagline: "Creative agency, Algiers",
      address: "14 Rue des Frères Bouadou, Algiers, Algeria",
      email: "hello@studioops.dz",
      phone: "+213 21 44 55 66",
      taxId: "",
      paymentMethod: "Espèces - Virement - CCP",
      invoiceNote: "Nous vous remercions pour votre confiance et restons à votre disposition.",
    },
  };
}

/* ---------------------- auth ---------------------- */
function useAuth() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}

function useStudioData(userId) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setStatus("loading");
      try {
        const { data: row, error } = await supabase
          .from("erp_state")
          .select("data")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (row?.data) {
          setData({
            ...row.data,
            expenses: row.data.expenses || [],
            timeEntries: row.data.timeEntries || [],
            settings: { ...DEFAULT_SETTINGS, ...(row.data.settings || {}) },
          });
        } else {
          // First time this account has signed in — give them their own
          // seeded workspace rather than someone else's data.
          const seed = seedData();
          setData(seed);
          const { error: insertError } = await supabase.from("erp_state").insert({ id: userId, data: seed });
          if (insertError) console.error("Seed insert failed", insertError);
        }
        setStatus("ready");
      } catch (e) {
        console.error("Loading ERP data failed", e);
        if (!cancelled) {
          setData(seedData());
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persist = useCallback(
    async (next) => {
      setData(next);
      if (!userId) return;
      try {
        const { error } = await supabase
          .from("erp_state")
          .upsert({ id: userId, data: next, updated_at: new Date().toISOString() });
        if (error) throw error;
      } catch (e) {
        console.error("Storage save failed", e);
      }
    },
    [userId]
  );

  return [data, persist, status];
}

/* ---------------------- formatting ---------------------- */
const fmtMoney = (n) =>
  `${Number(n || 0).toLocaleString("en-US")} DZD`;

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const isOverdue = (iso, doneStates = []) => {
  if (!iso) return false;
  return new Date(iso + "T00:00:00") < new Date(new Date().toDateString());
};

const addDays = (iso, days) => {
  const d = new Date((iso || todayISO()) + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// Monday-start week range containing `iso` (defaults to today), offset by
// `weekOffset` whole weeks (negative = past weeks).
const weekRange = (weekOffset = 0, iso) => {
  const base = new Date((iso || todayISO()) + "T00:00:00");
  const day = base.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + mondayOffset + weekOffset * 7);
  const start = base.toISOString().slice(0, 10);
  const end = addDays(start, 6);
  return { start, end };
};

const monthKey = (iso) => (iso || "").slice(0, 7); // "2026-07"
const monthLabel = (key) => {
  const d = new Date(`${key}-01T00:00:00`);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
};

// Last `n` month keys ending with the current month, oldest first.
const lastMonths = (n) => {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d);
    m.setMonth(m.getMonth() - i);
    out.push(m.toISOString().slice(0, 7));
  }
  return out;
};

/* ---------------------- status config ---------------------- */
const PROJECT_STATUS = {
  planning: { label: "Planning", color: "var(--amber)" },
  active: { label: "Active", color: "var(--blue)" },
  review: { label: "In Review", color: "var(--violet)" },
  completed: { label: "Completed", color: "var(--green)" },
  "on-hold": { label: "On Hold", color: "var(--muted)" },
};

const TASK_STATUS = {
  todo: { label: "To Do", color: "var(--muted)" },
  "in-progress": { label: "In Progress", color: "var(--blue)" },
  review: { label: "Review", color: "var(--violet)" },
  done: { label: "Done", color: "var(--green)" },
};

const TASK_PRIORITY = {
  low: { label: "Low", color: "var(--muted)" },
  medium: { label: "Medium", color: "var(--amber)" },
  high: { label: "High", color: "var(--red)" },
};

const INVOICE_STATUS = {
  draft: { label: "Draft", color: "var(--muted)" },
  sent: { label: "Sent", color: "var(--blue)" },
  paid: { label: "Paid", color: "var(--green)" },
  overdue: { label: "Overdue", color: "var(--red)" },
};

/* ---------------------- stamp — the signature element ---------------------- */
/* ---------------------- toast notifications ---------------------- */
const ToastContext = React.createContext(() => {});
const useToast = () => useContext(ToastContext);

/* ---------------------- trial period ---------------------- */
const TRIAL_DAYS = 7;
function getTrialInfo(session) {
  const createdAt = session?.user?.created_at;
  if (!createdAt) return { active: false, readOnly: false, daysLeft: TRIAL_DAYS };
  const startedMs = new Date(createdAt).getTime();
  if (Number.isNaN(startedMs)) return { active: false, readOnly: false, daysLeft: TRIAL_DAYS };
  const elapsedDays = Math.floor((Date.now() - startedMs) / 86400000);
  const daysLeft = Math.max(0, TRIAL_DAYS - elapsedDays);
  return { active: true, readOnly: elapsedDays >= TRIAL_DAYS, daysLeft, startedAt: createdAt };
}
const TrialContext = React.createContext({ active: false, readOnly: false, daysLeft: TRIAL_DAYS });
const useTrial = () => useContext(TrialContext);

function ToastHost({ toasts, onDismiss }) {
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => onDismiss(t.id)}>
          {t.type === "error" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          <span>{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="toast-action"
              onClick={(e) => {
                e.stopPropagation();
                t.action.onClick();
                onDismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------------- mini bar chart (no chart library) ---------------------- */
function MiniBarChart({ data, valueFormat, color = "var(--ink)", height = 140 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / data.length;
  return (
    <div className="mini-chart" style={{ height }}>
      <div className="mini-chart-bars">
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * 100);
          return (
            <div className="mini-chart-col" key={i} style={{ width: `${barW}%` }}>
              <span className="mini-chart-value">{d.value > 0 ? (valueFormat ? valueFormat(d.value) : d.value) : ""}</span>
              <div className="mini-chart-bar" style={{ height: `${h}%`, background: color }} />
              <span className="mini-chart-label">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DonutChart({ segments, size = 148, thickness = 20 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-chart" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--paper-dim)" strokeWidth={thickness} />
        {segments.map((seg, i) => {
          const frac = seg.value / total;
          const dash = frac * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="donut-chart-center">
        <strong>{total}</strong>
        <span>total</span>
      </div>
    </div>
  );
}

function Stamp({ label, color = "var(--ink)", size = "md" }) {
  return (
    <span
      className={`stamp stamp-${size}`}
      style={{ "--stamp-color": color }}
    >
      {label}
    </span>
  );
}

/* ---------------------- shared bits ---------------------- */
function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-veil" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-sheet ${wide ? "modal-wide" : ""}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ icon: Icon, title, hint, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <Icon size={28} strokeWidth={1.5} />
      <h3>{title}</h3>
      <p>{hint}</p>
      {actionLabel && (
        <button className="btn btn-primary" onClick={onAction}>
          <Plus size={15} /> {actionLabel}
        </button>
      )}
    </div>
  );
}

function ConfirmDelete({ label, onConfirm, onCancel, undoable }) {
  return (
    <div className="confirm-row">
      <span>
        <AlertTriangle size={14} /> Delete {label}? {undoable ? "You can undo this for a few seconds after." : "This can't be undone."}
      </span>
      <div className="confirm-actions">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger btn-sm" onClick={onConfirm}>Delete</button>
      </div>
    </div>
  );
}

/* ---------------------- project files ----------------------
   Real files in Supabase Storage (bucket "project-files"), one folder
   per account then per project. Studio side reads/writes the
   project_files table directly (RLS restricts each account to its own
   rows). The portal (readOnly) can't touch that table at all — it goes
   through the get_portal_files() RPC instead, the only file listing
   anonymous visitors are allowed to call. See supabase/schema.sql. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB per file

function FileManager({ projectId, userId, onCountChange, readOnly, portalCode }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { readOnly: trialLocked } = useTrial();
  const canWrite = !readOnly && !trialLocked;
  const toast = readOnly ? () => {} : useToast();

  const loadFiles = useCallback(async () => {
    setLoading(true);
    if (readOnly) {
      const { data, error: rpcError } = await supabase.rpc("get_portal_files", { p_code: portalCode });
      if (rpcError) {
        setError("Couldn't load files for this project.");
        setFiles([]);
      } else {
        setFiles(data || []);
      }
    } else {
      const { data, error: fetchError } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", projectId)
        .order("uploaded_at", { ascending: false });
      if (fetchError) {
        setError("Couldn't load files for this project.");
        setFiles([]);
      } else {
        setFiles(data || []);
        onCountChange && onCountChange((data || []).length);
      }
    }
    setLoading(false);
  }, [projectId, readOnly, portalCode]);

  useEffect(() => {
    let cancelled = false;
    loadFiles().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadFiles]);

  const publicUrlFor = (path) => supabase.storage.from(FILES_BUCKET).getPublicUrl(path).data.publicUrl;

  const handleUpload = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (picked.length === 0) return;
    if (trialLocked) {
      toast("Your 7-day trial has ended — this workspace is now read-only.", "error", { duration: 4200 });
      return;
    }
    setBusy(true);
    setError("");
    const oversized = picked.filter((f) => f.size > MAX_UPLOAD_BYTES);
    const accepted = picked.filter((f) => f.size <= MAX_UPLOAD_BYTES);
    if (oversized.length) {
      setError(`Skipped ${oversized.length} file(s) over ${fmtBytes(MAX_UPLOAD_BYTES)}.`);
    }
    try {
      for (const f of accepted) {
        const fileId = uid("file");
        // Path is prefixed with the owner's user id so the storage bucket's
        // RLS policies can enforce that one account can't touch another
        // account's files (see supabase/schema.sql).
        const storagePath = `${userId}/${projectId}/${fileId}-${f.name}`;
        const { error: uploadError } = await supabase.storage
          .from(FILES_BUCKET)
          .upload(storagePath, f, { upsert: false, contentType: f.type || "application/octet-stream" });
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from("project_files").insert({
          id: fileId,
          project_id: projectId,
          user_id: userId,
          name: f.name,
          size: f.size,
          type: f.type || "application/octet-stream",
          storage_path: storagePath,
          uploaded_at: todayISO(),
        });
        if (insertError) throw insertError;
      }
      await loadFiles();
      toast(`${accepted.length} file(s) uploaded`);
    } catch (err) {
      console.error(err);
      setError("Upload failed. Check your Supabase bucket/policies and try again.");
    }
    setBusy(false);
  };

  const deleteFile = async (file) => {
    if (trialLocked) {
      toast("Your 7-day trial has ended — this workspace is now read-only.", "error", { duration: 4200 });
      return;
    }
    setError("");
    const { error: removeError } = await supabase.storage.from(FILES_BUCKET).remove([file.storage_path]);
    if (removeError) {
      setError("Couldn't remove the file from storage.");
      return;
    }
    const { error: deleteError } = await supabase.from("project_files").delete().eq("id", file.id);
    if (deleteError) {
      setError("File removed from storage but the record didn't clear — refresh to check.");
      return;
    }
    toast(`${file.name} removed`);
    await loadFiles();
  };

  return (
    <div className="file-manager">
      {canWrite && (
        <label className="upload-drop">
          <Upload size={16} />
          <span>{busy ? "Uploading…" : "Click to upload files"}</span>
          <em>Up to {fmtBytes(MAX_UPLOAD_BYTES)} per file</em>
          <input type="file" multiple hidden onChange={handleUpload} disabled={busy} />
        </label>
      )}
      {!readOnly && trialLocked && (
        <p className="muted-note inline-warn"><Lock size={12} /> Read-only — your 7-day trial has ended.</p>
      )}
      {error && <p className="file-error"><AlertTriangle size={12} /> {error}</p>}

      {loading ? (
        <p className="muted-note"><Loader2 size={13} className="spin" /> Loading files…</p>
      ) : files.length === 0 ? (
        <p className="muted-note">No files uploaded for this project yet.</p>
      ) : (
        <ul className="file-list">
          {files.map((f) => (
            <li key={f.id}>
              <FileText size={15} />
              <div className="file-list-info">
                <strong>{f.name}</strong>
                <span>{fmtBytes(f.size)} · {fmtDate(f.uploaded_at)}</span>
              </div>
              <a className="icon-btn" href={publicUrlFor(f.storage_path)} download={f.name} target="_blank" rel="noreferrer" title="Download">
                <Download size={14} />
              </a>
              {canWrite && (
                <button className="icon-btn icon-btn-danger" onClick={() => deleteFile(f)} title="Delete">
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------- studio settings ---------------------- */
/* ---------------------- expense tracking ----------------------
   Expenses live inside the same erp_state JSON document as everything
   else (no new table needed) — kept per-project so profit can be
   computed as invoiced revenue minus what it actually cost to deliver. */
function ExpenseManager({ project, data, mutate, onClose }) {
  const toast = useToast();
  const { readOnly: locked } = useTrial();
  const [form, setForm] = useState({ description: "", amount: "", date: todayISO(), category: "" });
  const [confirmId, setConfirmId] = useState(null);

  const expenses = data.expenses.filter((e) => e.projectId === project.id);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const invoicedTotal = data.invoices
    .filter((i) => i.projectId === project.id)
    .reduce((s, i) => s + i.items.reduce((s2, it) => s2 + it.qty * it.rate, 0), 0);
  const profit = invoicedTotal - totalExpenses;

  const addExpense = (e) => {
    e.preventDefault();
    if (locked) {
      toast("Your 7-day trial has ended — this workspace is now read-only.", "error", { duration: 4200 });
      return;
    }
    if (!form.description.trim() || !form.amount) return;
    mutate({
      ...data,
      expenses: [
        ...data.expenses,
        { id: uid("exp"), projectId: project.id, description: form.description, amount: Number(form.amount) || 0, date: form.date, category: form.category },
      ],
    });
    toast(`${form.description} added`);
    setForm({ description: "", amount: "", date: todayISO(), category: "" });
  };

  const deleteExpense = (id) => {
    if (locked) {
      toast("Your 7-day trial has ended — this workspace is now read-only.", "error", { duration: 4200 });
      setConfirmId(null);
      return;
    }
    const exp = data.expenses.find((e) => e.id === id);
    mutate({ ...data, expenses: data.expenses.filter((e) => e.id !== id) });
    setConfirmId(null);
    toast(`${exp?.description || "Expense"} removed`);
  };

  return (
    <Modal title={`Expenses — ${project.name}`} onClose={onClose} wide>
      <div className="expense-summary">
        <div>
          <span className="field-label">Invoiced</span>
          <strong>{fmtMoney(invoicedTotal)}</strong>
        </div>
        <div>
          <span className="field-label">Expenses</span>
          <strong className="amount-warn">{fmtMoney(totalExpenses)}</strong>
        </div>
        <div>
          <span className="field-label">Profit</span>
          <strong className={profit >= 0 ? "amount-good" : "amount-warn"}>{fmtMoney(profit)}</strong>
        </div>
      </div>

      {locked && (
        <p className="muted-note inline-warn"><Lock size={12} /> Read-only — your 7-day trial has ended.</p>
      )}

      <form className="line-item-row expense-add-row" onSubmit={addExpense}>
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          disabled={locked}
        />
        <input
          type="number"
          min="0"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          disabled={locked}
        />
        <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} disabled={locked} />
        <button type="submit" className="icon-btn" disabled={locked}><Plus size={14} /></button>
      </form>

      {expenses.length === 0 ? (
        <p className="muted-note">No expenses logged for this project yet.</p>
      ) : (
        <ul className="file-list">
          {expenses.map((e) => (
            <li key={e.id}>
              <Wallet size={15} />
              <div className="file-list-info">
                <strong>{e.description}</strong>
                <span>{fmtMoney(e.amount)} · {fmtDate(e.date)}{e.category ? ` · ${e.category}` : ""}</span>
              </div>
              {!locked && (
                <button className="icon-btn icon-btn-danger" onClick={() => setConfirmId(e.id)} title="Delete">
                  <Trash2 size={14} />
                </button>
              )}
              {confirmId === e.id && (
                <div className="confirm-floating">
                  <ConfirmDelete label={e.description} onConfirm={() => deleteExpense(e.id)} onCancel={() => setConfirmId(null)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function StudioSettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState(settings);
  const [logoError, setLogoError] = useState("");
  const { readOnly: locked } = useTrial();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onLogoPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError("");
    if (!file.type.startsWith("image/")) {
      setLogoError("Please choose an image file (PNG, JPG, SVG…).");
      return;
    }
    if (file.size > 800 * 1024) {
      setLogoError("Keep the logo under 800 KB — export a smaller PNG/SVG.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logoDataUrl: reader.result }));
    reader.onerror = () => setLogoError("Couldn't read that file — try again.");
    reader.readAsDataURL(file);
  };

  const setColor = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const resetColors = () => setForm((f) => ({ ...f, primaryColor: DEFAULT_SETTINGS.primaryColor, accentColor: DEFAULT_SETTINGS.accentColor }));

  return (
    <Modal title="Studio settings" onClose={onClose} wide>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          if (locked) return;
          onSave(form);
        }}
      >
        {locked && (
          <p className="field-hint field-hint-error"><Lock size={12} /> Your 7-day trial has ended — settings are read-only.</p>
        )}
        <fieldset className="form-fieldset" disabled={locked}>

        <h4 className="settings-section-title">Appearance</h4>
        <p className="field-hint">Controls how the dashboard looks — the sidebar mark, and the accent colors used across the app.</p>

        <Field label="Logo">
          <div className="logo-upload-row">
            <div className="logo-upload-preview">
              {form.logoDataUrl ? (
                <img src={form.logoDataUrl} alt="Studio logo" />
              ) : (
                <span className="logo-upload-placeholder">No logo</span>
              )}
            </div>
            <div className="logo-upload-actions">
              <label className="btn btn-ghost btn-sm logo-upload-btn">
                <Upload size={13} /> {form.logoDataUrl ? "Replace logo" : "Upload logo"}
                <input type="file" accept="image/*" onChange={onLogoPick} hidden />
              </label>
              {form.logoDataUrl && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setForm((f) => ({ ...f, logoDataUrl: "" }))}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          {logoError && <p className="field-hint field-hint-error">{logoError}</p>}
          {!logoError && <p className="field-hint">PNG, JPG or SVG, under 800 KB. Shown in the sidebar and at the top of every invoice — falls back to the studio's initials if left empty.</p>}
        </Field>

        <div className="field-row">
          <Field label="Primary color">
            <div className="color-field-row">
              <input type="color" className="color-swatch-input" value={form.primaryColor || DEFAULT_SETTINGS.primaryColor} onChange={setColor("primaryColor")} />
              <input className="mono-input" value={form.primaryColor || DEFAULT_SETTINGS.primaryColor} onChange={setColor("primaryColor")} placeholder="#16294D" />
            </div>
          </Field>
          <Field label="Accent color">
            <div className="color-field-row">
              <input type="color" className="color-swatch-input" value={form.accentColor || DEFAULT_SETTINGS.accentColor} onChange={setColor("accentColor")} />
              <input className="mono-input" value={form.accentColor || DEFAULT_SETTINGS.accentColor} onChange={setColor("accentColor")} placeholder="#D64550" />
            </div>
          </Field>
        </div>
        <p className="field-hint">Primary sets the sidebar and headings; accent highlights active items, badges and stamps.</p>
        <button type="button" className="link-btn appearance-reset-btn" onClick={resetColors}>Reset to default colors</button>

        <h4 className="settings-section-title settings-section-title-spaced">Branding &amp; invoices</h4>
        <p className="field-hint">This appears on the letterhead of every invoice you generate.</p>

        <Field label="Studio name">
          <input value={form.studioName} onChange={set("studioName")} placeholder="Studio Ops" required />
        </Field>
        <Field label="Tagline">
          <input value={form.tagline} onChange={set("tagline")} placeholder="Creative agency, Algiers" />
        </Field>
        <Field label="Address">
          <input value={form.address} onChange={set("address")} placeholder="Street, city, country" />
        </Field>
        <div className="field-row">
          <Field label="Email">
            <input type="email" value={form.email} onChange={set("email")} placeholder="hello@studio.com" />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={set("phone")} placeholder="+213 …" />
          </Field>
        </div>
        <Field label="Tax / registration ID (optional)">
          <input value={form.taxId} onChange={set("taxId")} placeholder="NIF / RC number" />
        </Field>
        <Field label="Payment method (shown on invoice)">
          <input value={form.paymentMethod || ""} onChange={set("paymentMethod")} placeholder="Espèces - CCP - BaridiMob" />
        </Field>
        <Field label="Default invoice note">
          <textarea rows={2} value={form.invoiceNote} onChange={set("invoiceNote")} />
        </Field>
        </fieldset>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={locked}>Save settings</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------- auth screen ---------------------- */
function AuthScreen({ onOpenPortal }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setNotice("");
    setConfirmPassword("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (signUpData?.session) {
          // Email confirmation is off on this project — signed in immediately.
        } else {
          setNotice("Account created — check your email to confirm it, then sign in.");
          setMode("signin");
          setPassword("");
          setConfirmPassword("");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    }
    setBusy(false);
  };

  return (
    <div className="portal-shell">
      <div className="portal-gate">
        <div className="portal-badge">
          <Building size={20} />
        </div>
        <h1>{mode === "signup" ? "Create your account" : "Sign in"}</h1>
        <p>{mode === "signup" ? "Set up access to the studio dashboard." : "Welcome back to Studio Ops."}</p>
        <p className="field-hint auth-shared-note">
          <ShieldCheck size={12} /> Your workspace is private — only you can see your clients, projects and invoices.
        </p>
        <form onSubmit={submit} className="portal-gate-form">
          <div className="auth-input-row">
            <Mail size={14} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" required autoFocus />
          </div>
          <div className="auth-input-row">
            <Lock size={14} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={6} required />
          </div>
          {mode === "signup" && (
            <div className="auth-input-row">
              <Lock size={14} />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" minLength={6} required />
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? (mode === "signup" ? "Creating account…" : "Signing in…") : (mode === "signup" ? "Create account" : "Sign in")}
          </button>
        </form>
        {notice && <p className="file-success"><CheckCircle2 size={12} /> {notice}</p>}
        {error && <p className="file-error"><AlertTriangle size={12} /> {error}</p>}
        <button className="link-btn portal-back" onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
        <button className="link-btn portal-back" onClick={onOpenPortal}>
          <KeyRound size={13} /> I'm a client — open the project portal
        </button>
      </div>
    </div>
  );
}

/* ---------------------- global search ---------------------- */
function GlobalSearchModal({ data, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const clientName = (id) => data.clients.find((c) => c.id === id)?.company || "";

  const results = useMemo(() => {
    if (q.length < 1) return { clients: [], projects: [], tasks: [], invoices: [] };
    return {
      clients: data.clients.filter((c) => `${c.name} ${c.company} ${c.email}`.toLowerCase().includes(q)).slice(0, 6),
      projects: data.projects.filter((p) => `${p.name} ${clientName(p.clientId)}`.toLowerCase().includes(q)).slice(0, 6),
      tasks: data.tasks.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 6),
      invoices: data.invoices.filter((i) => `#${i.number} ${clientName(i.clientId)}`.toLowerCase().includes(q)).slice(0, 6),
    };
  }, [q, data]);

  const totalResults = results.clients.length + results.projects.length + results.tasks.length + results.invoices.length;

  const go = (view) => {
    onNavigate(view);
    onClose();
  };

  return (
    <div className="modal-veil" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet search-sheet">
        <div className="search-input-row">
          <Search size={16} />
          <input
            autoFocus
            placeholder="Search clients, projects, tasks, invoices…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
          />
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="search-results">
          {q.length < 1 ? (
            <p className="muted-note search-hint">Start typing to search across everything…</p>
          ) : totalResults === 0 ? (
            <p className="muted-note search-hint">No matches for "{query}".</p>
          ) : (
            <>
              {results.clients.length > 0 && (
                <div className="search-group">
                  <span className="search-group-label"><Users size={12} /> Clients</span>
                  {results.clients.map((c) => (
                    <button key={c.id} className="search-result-row" onClick={() => go("clients")}>
                      <span>{c.company}</span><span className="muted-note">{c.name}</span><ArrowRight size={13} />
                    </button>
                  ))}
                </div>
              )}
              {results.projects.length > 0 && (
                <div className="search-group">
                  <span className="search-group-label"><Briefcase size={12} /> Projects</span>
                  {results.projects.map((p) => (
                    <button key={p.id} className="search-result-row" onClick={() => go("projects")}>
                      <span>{p.name}</span><span className="muted-note">{clientName(p.clientId)}</span><ArrowRight size={13} />
                    </button>
                  ))}
                </div>
              )}
              {results.tasks.length > 0 && (
                <div className="search-group">
                  <span className="search-group-label"><CheckSquare size={12} /> Tasks</span>
                  {results.tasks.map((t) => (
                    <button key={t.id} className="search-result-row" onClick={() => go("tasks")}>
                      <span>{t.title}</span><span className="muted-note">{data.projects.find((p) => p.id === t.projectId)?.name || ""}</span><ArrowRight size={13} />
                    </button>
                  ))}
                </div>
              )}
              {results.invoices.length > 0 && (
                <div className="search-group">
                  <span className="search-group-label"><Receipt size={12} /> Invoices</span>
                  {results.invoices.map((i) => (
                    <button key={i.id} className="search-result-row" onClick={() => go("invoices")}>
                      <span>#{i.number}</span><span className="muted-note">{clientName(i.clientId)}</span><ArrowRight size={13} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------- sidebar ---------------------- */
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "clients", label: "Clients", icon: Users },
  { key: "projects", label: "Projects", icon: Briefcase },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "time", label: "Time", icon: Clock3 },
  { key: "invoices", label: "Invoices", icon: Receipt },
];

function Sidebar({ view, setView, counts, onOpenPortal, onOpenSettings, onSignOut, navOpen, settings = DEFAULT_SETTINGS }) {
  const initials = (settings.studioName || "Studio Ops")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "SO";
  return (
    <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
      <div className="brand">
        <div className={`brand-mark ${settings.logoDataUrl ? "brand-mark-logo" : ""}`}>
          {settings.logoDataUrl ? <img src={settings.logoDataUrl} alt={settings.studioName || "Logo"} /> : initials}
        </div>
        <div className="brand-word">
          <strong>{(settings.studioName || "Studio Ops").toUpperCase()}</strong>
          <span>{settings.tagline || "traffic & production"}</span>
        </div>
      </div>
      <nav className="nav">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`nav-item ${view === key ? "nav-item-active" : ""}`}
            onClick={() => setView(key)}
          >
            <Icon size={16} />
            <span>{label}</span>
            {counts[key] != null && <em>{counts[key]}</em>}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button className="portal-entry-btn" onClick={onOpenPortal}>
          <KeyRound size={14} />
          <span>Client portal</span>
        </button>
        <button className="portal-entry-btn" onClick={onOpenSettings}>
          <Settings size={14} />
          <span>Studio settings</span>
        </button>
        <button className="portal-entry-btn" onClick={onSignOut}>
          <LogOut size={14} />
          <span>Sign out</span>
        </button>
        <div className="ticket-mini">
          <span>JOB LOG</span>
          <p>Every record here is a ticket routed through the studio — proof it, move it, close it.</p>
        </div>
      </div>
    </aside>
  );
}

/* ---------------------- dashboard ---------------------- */
function Dashboard({ data, setView }) {
  const stats = useMemo(() => {
    const activeProjects = data.projects.filter((p) => p.status !== "completed").length;
    const completedProjects = data.projects.filter((p) => p.status === "completed").length;
    const openTasks = data.tasks.filter((t) => t.status !== "done").length;
    const overdueTasks = data.tasks.filter((t) => t.status !== "done" && isOverdue(t.dueDate)).length;
    const outstanding = data.invoices
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .reduce((sum, i) => sum + i.items.reduce((s, it) => s + it.qty * it.rate, 0), 0);
    const paidThisPeriod = data.invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.items.reduce((s, it) => s + it.qty * it.rate, 0), 0);
    return { activeProjects, completedProjects, openTasks, overdueTasks, outstanding, paidThisPeriod };
  }, [data]);

  const clientName = (id) => data.clients.find((c) => c.id === id)?.company || "—";

  const upcoming = [...data.tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, 5);

  const recentInvoices = [...data.invoices]
    .sort((a, b) => b.number.localeCompare(a.number))
    .slice(0, 5);

  const months = lastMonths(6);
  const revenueByMonth = useMemo(() => {
    const map = {};
    months.forEach((m) => (map[m] = 0));
    data.invoices
      .filter((i) => i.status === "paid")
      .forEach((i) => {
        const key = monthKey(i.issueDate);
        if (key in map) map[key] += i.items.reduce((s, it) => s + it.qty * it.rate, 0);
      });
    return months.map((m) => ({ label: monthLabel(m), value: map[m] }));
  }, [data.invoices]);

  const projectStatusSegments = useMemo(() => {
    const byStatus = { active: 0, review: 0, completed: 0, overdue: 0 };
    data.projects.forEach((p) => {
      if (p.status === "completed") byStatus.completed += 1;
      else if (p.deadline && isOverdue(p.deadline)) byStatus.overdue += 1;
      else if (p.status === "review") byStatus.review += 1;
      else byStatus.active += 1;
    });
    return [
      { label: "Active", value: byStatus.active, color: "var(--blue)" },
      { label: "In review", value: byStatus.review, color: "var(--amber)" },
      { label: "Completed", value: byStatus.completed, color: "var(--green)" },
      { label: "Overdue", value: byStatus.overdue, color: "var(--red)" },
    ].filter((s) => s.value > 0);
  }, [data.projects]);

  const topClients = useMemo(() => {
    const totals = {};
    data.invoices.forEach((i) => {
      const total = i.items.reduce((s, it) => s + it.qty * it.rate, 0);
      totals[i.clientId] = (totals[i.clientId] || 0) + total;
    });
    return Object.entries(totals)
      .map(([clientId, total]) => ({ client: data.clients.find((c) => c.id === clientId), total }))
      .filter((row) => row.client)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [data.invoices, data.clients]);

  const statCards = [
    {
      key: "active",
      label: "Active projects",
      value: stats.activeProjects,
      sub: `of ${data.projects.length} total`,
      icon: <Briefcase size={17} />,
      tone: "peach",
    },
    {
      key: "tasks",
      label: "Open tasks",
      value: stats.openTasks,
      sub: `${stats.overdueTasks} overdue`,
      subWarn: stats.overdueTasks > 0,
      icon: <CheckSquare size={17} />,
      tone: "lavender",
    },
    {
      key: "outstanding",
      label: "Outstanding",
      value: fmtMoney(stats.outstanding),
      sub: "across open invoices",
      icon: <Wallet size={17} />,
      tone: "rose",
    },
    {
      key: "collected",
      label: "Collected",
      value: fmtMoney(stats.paidThisPeriod),
      sub: "marked paid",
      icon: <TrendingUp size={17} />,
      tone: "mint",
    },
  ];

  return (
    <div className="view">
      <div className="stat-grid stat-grid-v2">
        {statCards.map((c) => (
          <div className={`stat-card-v2 stat-card-${c.tone}`} key={c.key}>
            <div className="stat-card-v2-icon">{c.icon}</div>
            <span className="stat-label">{c.label}</span>
            <strong className="stat-value">{c.value}</strong>
            <span className={`stat-sub ${c.subWarn ? "stat-sub-warn" : ""}`}>{c.sub}</span>
          </div>
        ))}
      </div>

      <div className="panel-grid panel-grid-uneven">
        <div className="panel">
          <div className="panel-head">
            <h3><TrendingUp size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Monthly revenue</h3>
            <span className="muted-note">last 6 months, paid invoices</span>
          </div>
          <MiniBarChart data={revenueByMonth} color="var(--green)" valueFormat={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
        </div>
        <div className="panel">
          <div className="panel-head">
            <h3>Project mix</h3>
            <span className="muted-note">{data.projects.length} total</span>
          </div>
          {projectStatusSegments.length === 0 ? (
            <p className="muted-note">No projects yet.</p>
          ) : (
            <div className="donut-panel-body">
              <DonutChart segments={projectStatusSegments} />
              <ul className="donut-legend">
                {projectStatusSegments.map((s) => (
                  <li key={s.label}>
                    <span className="donut-legend-dot" style={{ background: s.color }} />
                    <span className="donut-legend-label">{s.label}</span>
                    <span className="donut-legend-value">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <div className="panel-head">
            <h3>Due soon</h3>
            <button className="link-btn" onClick={() => setView("tasks")}>
              All tasks <ChevronRight size={13} />
            </button>
          </div>
          {upcoming.length === 0 ? (
            <p className="muted-note">Nothing on the board — add a task to get started.</p>
          ) : (
            <ul className="mini-list">
              {upcoming.map((t) => (
                <li key={t.id}>
                  <div>
                    <strong>{t.title}</strong>
                    <span>{data.projects.find((p) => p.id === t.projectId)?.name || "—"}</span>
                  </div>
                  <Stamp
                    label={fmtDate(t.dueDate)}
                    color={isOverdue(t.dueDate) ? "var(--red)" : "var(--muted)"}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Recent invoices</h3>
            <button className="link-btn" onClick={() => setView("invoices")}>
              All invoices <ChevronRight size={13} />
            </button>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="muted-note">No invoices yet.</p>
          ) : (
            <ul className="mini-list">
              {recentInvoices.map((inv) => (
                <li key={inv.id}>
                  <div>
                    <strong>#{inv.number} — {clientName(inv.clientId)}</strong>
                    <span>{fmtMoney(inv.items.reduce((s, it) => s + it.qty * it.rate, 0))}</span>
                  </div>
                  <Stamp
                    label={INVOICE_STATUS[inv.status]?.label || inv.status}
                    color={INVOICE_STATUS[inv.status]?.color}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Top clients</h3>
          <button className="link-btn" onClick={() => setView("clients")}>
            All clients <ChevronRight size={13} />
          </button>
        </div>
        {topClients.length === 0 ? (
          <p className="muted-note">No invoiced revenue yet.</p>
        ) : (
          <ul className="top-client-list">
            {topClients.map((row, i) => (
              <li key={row.client.id}>
                <span className={`top-client-avatar top-client-avatar-${i % 4}`}>
                  {(row.client.company || "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="top-client-info">
                  <strong>{row.client.company}</strong>
                  <span>{data.projects.filter((p) => p.clientId === row.client.id).length} project(s)</span>
                </div>
                <span className="top-client-total">{fmtMoney(row.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------------- clients ---------------------- */
function ClientForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial || { name: "", company: "", email: "", phone: "", notes: "" }
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canSave = form.name.trim() && form.company.trim();
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSave(form);
      }}
    >
      <Field label="Contact name">
        <input value={form.name} onChange={set("name")} placeholder="Amina Belkacem" required />
      </Field>
      <Field label="Company">
        <input value={form.company} onChange={set("company")} placeholder="Sable & Co." required />
      </Field>
      <Field label="Email">
        <input type="email" value={form.email} onChange={set("email")} placeholder="name@company.com" />
      </Field>
      <Field label="Phone">
        <input value={form.phone} onChange={set("phone")} placeholder="+213 5xx xxx xxx" />
      </Field>
      <Field label="Notes">
        <textarea rows={3} value={form.notes} onChange={set("notes")} placeholder="Retainer terms, quirks, preferences…" />
      </Field>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!canSave}>Save client</button>
      </div>
    </form>
  );
}

function ClientsView({ data, mutate }) {
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null); // { mode: 'new'|'edit', client }
  const [confirmId, setConfirmId] = useState(null);
  const toast = useToast();
  const { readOnly } = useTrial();

  const projectCount = (clientId) => data.projects.filter((p) => p.clientId === clientId).length;
  const outstandingFor = (clientId) =>
    data.invoices
      .filter((i) => i.clientId === clientId && (i.status === "sent" || i.status === "overdue"))
      .reduce((sum, i) => sum + i.items.reduce((s, it) => s + it.qty * it.rate, 0), 0);

  const filtered = data.clients.filter((c) =>
    `${c.name} ${c.company} ${c.email}`.toLowerCase().includes(query.toLowerCase())
  );

  const saveClient = (form) => {
    if (readOnly) return;
    if (modal.mode === "edit") {
      mutate({
        ...data,
        clients: data.clients.map((c) => (c.id === modal.client.id ? { ...c, ...form } : c)),
      });
      toast(`${form.company} updated`);
    } else {
      mutate({
        ...data,
        clients: [...data.clients, { id: uid("cli"), createdAt: todayISO(), ...form }],
      });
      toast(`${form.company} added`);
    }
    setModal(null);
  };

  const deleteClient = (id) => {
    if (readOnly) return;
    const c = data.clients.find((x) => x.id === id);
    mutate({
      ...data,
      clients: data.clients.filter((c) => c.id !== id),
    });
    setConfirmId(null);
    toast(`${c?.company || "Client"} deleted`);
  };

  return (
    <div className="view">
      <div className="toolbar">
        <div className="search-box">
          <Search size={14} />
          <input
            placeholder="Search clients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ mode: "new" })} disabled={readOnly} title={readOnly ? "Read-only — trial has ended" : undefined}>
          <Plus size={15} /> New client
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={data.clients.length ? "No matches" : "No clients yet"}
          hint={data.clients.length ? "Try a different search." : "Add the first client to open a ledger for them."}
          actionLabel={data.clients.length || readOnly ? null : "New client"}
          onAction={() => setModal({ mode: "new" })}
        />
      ) : (
        <div className="ticket-grid">
          {filtered.map((c) => (
            <div className="ticket" key={c.id}>
              <div className="ticket-top">
                <span className="ticket-id">CLI-{c.id.slice(-5).toUpperCase()}</span>
                <Stamp label={`${projectCount(c.id)} projects`} color="var(--blue)" size="sm" />
              </div>
              <div className="ticket-body">
                <div className="ticket-icon"><Building2 size={16} /></div>
                <h4>{c.company}</h4>
                <p className="ticket-sub">{c.name}</p>
                {c.email && <p className="ticket-line">{c.email}</p>}
                {c.phone && <p className="ticket-line">{c.phone}</p>}
                {c.notes && <p className="ticket-notes">{c.notes}</p>}
              </div>
              <div className="ticket-foot">
                <span className={outstandingFor(c.id) ? "amount-warn" : "amount-quiet"}>
                  {outstandingFor(c.id) ? `${fmtMoney(outstandingFor(c.id))} due` : "No balance due"}
                </span>
                <div className="ticket-actions">
                  <button className="icon-btn" onClick={() => setModal({ mode: "edit", client: c })} disabled={readOnly} title={readOnly ? "Read-only — trial has ended" : undefined}>
                    <Pencil size={14} />
                  </button>
                  <button className="icon-btn icon-btn-danger" onClick={() => setConfirmId(c.id)} disabled={readOnly} title={readOnly ? "Read-only — trial has ended" : undefined}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {confirmId === c.id && (
                <ConfirmDelete
                  label={c.company}
                  onConfirm={() => deleteClient(c.id)}
                  onCancel={() => setConfirmId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === "edit" ? "Edit client" : "New client"} onClose={() => setModal(null)}>
          <ClientForm
            initial={modal.client}
            onSave={saveClient}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

/* ---------------------- projects ---------------------- */
function ProjectForm({ initial, clients, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial || {
      clientId: clients[0]?.id || "",
      name: "",
      status: "planning",
      budget: "",
      deadline: "",
      description: "",
      portalCode: generatePortalCode(clients[0]?.company),
    }
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canSave = form.name.trim() && form.clientId;
  const clientCompany = clients.find((c) => c.id === form.clientId)?.company;
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSave({ ...form, budget: Number(form.budget) || 0 });
      }}
    >
      <Field label="Project name">
        <input value={form.name} onChange={set("name")} placeholder="Sable & Co. Rebrand" required />
      </Field>
      <Field label="Client portal code">
        <div className="portal-code-row">
          <input value={form.portalCode || ""} readOnly className="mono-input" />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setForm((f) => ({ ...f, portalCode: generatePortalCode(clientCompany) }))}
          >
            Regenerate
          </button>
        </div>
        <span className="field-hint">Share this code with the client so they can check progress and download files.</span>
      </Field>
      <Field label="Client">
        <select value={form.clientId} onChange={set("clientId")} required>
          {clients.length === 0 && <option value="">Add a client first</option>}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.company}</option>
          ))}
        </select>
      </Field>
      <div className="field-row">
        <Field label="Status">
          <select value={form.status} onChange={set("status")}>
            {Object.entries(PROJECT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Deadline">
          <input type="date" value={form.deadline} onChange={set("deadline")} />
        </Field>
      </div>
      <Field label="Budget (DZD)">
        <input type="number" min="0" value={form.budget} onChange={set("budget")} placeholder="480000" />
      </Field>
      <Field label="Description">
        <textarea rows={3} value={form.description} onChange={set("description")} placeholder="Scope, deliverables, phases…" />
      </Field>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!canSave}>Save project</button>
      </div>
    </form>
  );
}

function ProjectsView({ data, mutate, userId }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [filesFor, setFilesFor] = useState(null);
  const [expensesFor, setExpensesFor] = useState(null);
  const toast = useToast();
  const { readOnly: locked } = useTrial();

  const clientName = (id) => data.clients.find((c) => c.id === id)?.company || "Unassigned";

  const filtered = data.projects.filter((p) => {
    const matchesQuery = `${p.name} ${clientName(p.clientId)}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const taskProgress = (projectId) => {
    const ts = data.tasks.filter((t) => t.projectId === projectId);
    if (ts.length === 0) return null;
    const done = ts.filter((t) => t.status === "done").length;
    return { done, total: ts.length };
  };

  const saveProject = (form) => {
    if (locked) return;
    if (modal.mode === "edit") {
      mutate({ ...data, projects: data.projects.map((p) => (p.id === modal.project.id ? { ...p, ...form } : p)) });
      toast(`${form.name} updated`);
    } else {
      mutate({ ...data, projects: [...data.projects, { id: uid("prj"), ...form }] });
      toast(`${form.name} created`);
    }
    setModal(null);
  };

  const deleteProject = (id) => {
    if (locked) return;
    const p = data.projects.find((x) => x.id === id);
    mutate({
      ...data,
      projects: data.projects.filter((p) => p.id !== id),
      tasks: data.tasks.filter((t) => t.projectId !== id),
    });
    setConfirmId(null);
    toast(`${p?.name || "Project"} deleted`);
  };

  const copyPortalCode = (code) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(
        () => toast("Portal code copied"),
        () => toast("Couldn't copy — copy it manually", "error")
      );
    }
  };

  return (
    <div className="view">
      <div className="toolbar">
        <div className="search-box">
          <Search size={14} />
          <input placeholder="Search projects…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(PROJECT_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => setModal({ mode: "new" })} disabled={data.clients.length === 0 || locked} title={locked ? "Read-only — trial has ended" : undefined}>
          <Plus size={15} /> New project
        </button>
      </div>

      {data.clients.length === 0 && (
        <p className="muted-note inline-warn"><AlertTriangle size={13} /> Add a client before creating a project.</p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={data.projects.length ? "No matches" : "No projects yet"}
          hint={data.projects.length ? "Try a different search or filter." : "Open a job ticket for a client to start tracking work."}
          actionLabel={data.projects.length || data.clients.length === 0 || locked ? null : "New project"}
          onAction={() => setModal({ mode: "new" })}
        />
      ) : (
        <div className="ticket-grid">
          {filtered.map((p) => {
            const prog = taskProgress(p.id);
            return (
              <div className="ticket" key={p.id}>
                <div className="ticket-top">
                  <span className="ticket-id">PRJ-{p.id.slice(-5).toUpperCase()}</span>
                  <Stamp label={PROJECT_STATUS[p.status]?.label || p.status} color={PROJECT_STATUS[p.status]?.color} />
                </div>
                <div className="ticket-body">
                  <h4>{p.name}</h4>
                  <p className="ticket-sub">{clientName(p.clientId)}</p>
                  {p.description && <p className="ticket-notes">{p.description}</p>}
                  <div className="ticket-meta-row">
                    <span>Budget: {fmtMoney(p.budget)}</span>
                    <span>Due: {fmtDate(p.deadline)}</span>
                  </div>
                  {prog && (
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${(prog.done / prog.total) * 100}%` }} />
                      <span>{prog.done}/{prog.total} tasks done</span>
                    </div>
                  )}
                </div>
                <div className="ticket-foot">
                  <button
                    className="portal-code-chip"
                    onClick={() => p.portalCode && copyPortalCode(p.portalCode)}
                    title="Copy portal code"
                    disabled={!p.portalCode}
                  >
                    <KeyRound size={11} /> {p.portalCode || "no code"} <Copy size={10} />
                  </button>
                  <div className="ticket-actions">
                    <button className="icon-btn" onClick={() => setExpensesFor(p)} title="Expenses & profit">
                      <Wallet size={14} />
                    </button>
                    <button className="icon-btn" onClick={() => setFilesFor(p)} title="Project files">
                      <FolderOpen size={14} />
                    </button>
                    <button className="icon-btn" onClick={() => setModal({ mode: "edit", project: p })} disabled={locked} title={locked ? "Read-only — trial has ended" : undefined}>
                      <Pencil size={14} />
                    </button>
                    <button className="icon-btn icon-btn-danger" onClick={() => setConfirmId(p.id)} disabled={locked} title={locked ? "Read-only — trial has ended" : undefined}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {confirmId === p.id && (
                  <ConfirmDelete label={p.name} onConfirm={() => deleteProject(p.id)} onCancel={() => setConfirmId(null)} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {filesFor && (
        <Modal title={`Files — ${filesFor.name}`} onClose={() => setFilesFor(null)} wide>
          <FileManager
            projectId={filesFor.id}
            userId={userId}
            onCountChange={(count) =>
              mutate({
                ...data,
                projects: data.projects.map((pr) => (pr.id === filesFor.id ? { ...pr, fileCount: count } : pr)),
              })
            }
          />
        </Modal>
      )}

      {expensesFor && (
        <ExpenseManager project={expensesFor} data={data} mutate={mutate} onClose={() => setExpensesFor(null)} />
      )}

      {modal && (
        <Modal title={modal.mode === "edit" ? "Edit project" : "New project"} onClose={() => setModal(null)}>
          <ProjectForm
            initial={modal.project}
            clients={data.clients}
            onSave={saveProject}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

/* ---------------------- tasks ---------------------- */
function TaskForm({ initial, projects, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial || {
      projectId: projects[0]?.id || "",
      title: "",
      assignee: "",
      status: "todo",
      priority: "medium",
      dueDate: "",
    }
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const canSave = form.title.trim() && form.projectId;
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSave(form);
      }}
    >
      <Field label="Task">
        <input value={form.title} onChange={set("title")} placeholder="Finalize wordmark options" required />
      </Field>
      <Field label="Project">
        <select value={form.projectId} onChange={set("projectId")} required>
          {projects.length === 0 && <option value="">Add a project first</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </Field>
      <div className="field-row">
        <Field label="Assignee">
          <input value={form.assignee} onChange={set("assignee")} placeholder="Sara" />
        </Field>
        <Field label="Due date">
          <input type="date" value={form.dueDate} onChange={set("dueDate")} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="Status">
          <select value={form.status} onChange={set("status")}>
            {Object.entries(TASK_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select value={form.priority} onChange={set("priority")}>
            {Object.entries(TASK_PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!canSave}>Save task</button>
      </div>
    </form>
  );
}

/* ---------------------- weekly time view ---------------------- */
function TimeView({ data, mutate }) {
  const toast = useToast();
  const { readOnly: locked } = useTrial();
  const [weekOffset, setWeekOffset] = useState(0);
  const [confirmId, setConfirmId] = useState(null);
  const [form, setForm] = useState({ projectId: data.projects[0]?.id || "", hours: "", date: todayISO(), note: "" });

  const { start, end } = weekRange(weekOffset);
  const weekEntries = data.timeEntries.filter((t) => t.date >= start && t.date <= end);

  const projectName = (id) => data.projects.find((p) => p.id === id)?.name || "Unassigned";

  const byProject = useMemo(() => {
    const map = {};
    weekEntries.forEach((t) => {
      map[t.projectId] = (map[t.projectId] || 0) + (Number(t.hours) || 0);
    });
    return Object.entries(map)
      .map(([projectId, hours]) => ({ projectId, hours }))
      .sort((a, b) => b.hours - a.hours);
  }, [weekEntries]);

  const totalHours = weekEntries.reduce((s, t) => s + (Number(t.hours) || 0), 0);

  const logTime = (e) => {
    e.preventDefault();
    if (locked) return;
    if (!form.projectId || !form.hours) return;
    mutate({
      ...data,
      timeEntries: [...data.timeEntries, { id: uid("time"), projectId: form.projectId, hours: Number(form.hours) || 0, date: form.date, note: form.note }],
    });
    toast(`${form.hours}h logged`);
    setForm((f) => ({ ...f, hours: "", note: "" }));
  };

  const deleteEntry = (id) => {
    if (locked) return;
    mutate({ ...data, timeEntries: data.timeEntries.filter((t) => t.id !== id) });
    setConfirmId(null);
    toast("Time entry removed");
  };

  return (
    <div className="view">
      <div className="toolbar">
        <div className="week-nav">
          <button className="icon-btn" onClick={() => setWeekOffset((w) => w - 1)} title="Previous week">
            <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} />
          </button>
          <span className="week-range">{fmtDate(start)} – {fmtDate(end)}</span>
          <button className="icon-btn" onClick={() => setWeekOffset((w) => w + 1)} title="Next week">
            <ChevronRight size={14} />
          </button>
          {weekOffset !== 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>This week</button>
          )}
        </div>
        <span className="week-total"><Clock3 size={13} /> {totalHours}h logged</span>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Log time</h3></div>
        {locked && (
          <p className="muted-note inline-warn"><Lock size={12} /> Read-only — your 7-day trial has ended.</p>
        )}
        <form className="field-row time-log-form" onSubmit={logTime}>
          <select value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))} required disabled={locked}>
            {data.projects.length === 0 && <option value="">Add a project first</option>}
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input type="number" min="0" step="0.5" placeholder="Hours" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} required disabled={locked} />
          <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} disabled={locked} />
          <input placeholder="Note (optional)" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} disabled={locked} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={data.projects.length === 0 || locked}><Plus size={13} /> Log</button>
        </form>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <div className="panel-head"><h3>Hours by project this week</h3></div>
          {byProject.length === 0 ? (
            <p className="muted-note">No time logged for this week yet.</p>
          ) : (
            <ul className="mini-list">
              {byProject.map((row) => (
                <li key={row.projectId}>
                  <div><strong>{projectName(row.projectId)}</strong></div>
                  <Stamp label={`${row.hours}h`} color="var(--blue)" size="sm" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Entries this week</h3></div>
          {weekEntries.length === 0 ? (
            <p className="muted-note">Nothing logged yet — add an entry above.</p>
          ) : (
            <ul className="mini-list">
              {[...weekEntries].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                <li key={t.id} style={{ position: "relative" }}>
                  <div>
                    <strong>{projectName(t.projectId)} — {t.hours}h</strong>
                    <span>{fmtDate(t.date)}{t.note ? ` · ${t.note}` : ""}</span>
                  </div>
                  {!locked && (
                    <button className="icon-btn icon-btn-danger" onClick={() => setConfirmId(t.id)}><Trash2 size={12} /></button>
                  )}
                  {confirmId === t.id && (
                    <div className="confirm-floating">
                      <ConfirmDelete label={`${t.hours}h entry`} onConfirm={() => deleteEntry(t.id)} onCancel={() => setConfirmId(null)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const TASK_COLUMNS = ["todo", "in-progress", "review", "done"];
const TASK_COLUMN_ICON = { todo: Circle, "in-progress": CircleDot, review: CircleDot, done: CircleCheck };

function TasksView({ data, mutate }) {
  const [modal, setModal] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [dragOverCol, setDragOverCol] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const toast = useToast();
  const { readOnly: locked } = useTrial();

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const projectName = (id) => data.projects.find((p) => p.id === id)?.name || "Unassigned";

  const visibleTasks = data.tasks.filter((t) => projectFilter === "all" || t.projectId === projectFilter);
  const visibleIds = useMemo(() => new Set(visibleTasks.map((t) => t.id)), [visibleTasks]);

  // Drop any selected ids that scrolled out of the current filter, so the
  // bulk bar's count always matches what's actually selectable on screen.
  useEffect(() => {
    setSelected((s) => {
      const next = new Set([...s].filter((id) => visibleIds.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [visibleIds]);

  const toggleSelect = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  const saveTask = (form) => {
    if (locked) return;
    if (modal.mode === "edit") {
      mutate({ ...data, tasks: data.tasks.map((t) => (t.id === modal.task.id ? { ...t, ...form } : t)) });
      toast(`${form.title} updated`);
    } else {
      mutate({ ...data, tasks: [...data.tasks, { id: uid("tsk"), ...form }] });
      toast(`${form.title} added`);
    }
    setModal(null);
  };

  const deleteTask = (id) => {
    if (locked) return;
    const t = data.tasks.find((x) => x.id === id);
    mutate({ ...data, tasks: data.tasks.filter((t) => t.id !== id) });
    setConfirmId(null);
    toast(`${t?.title || "Task"} deleted`);
  };

  const moveTask = (task, status) => {
    if (locked) return;
    if (task.status === status) return;
    mutate({ ...data, tasks: data.tasks.map((t) => (t.id === task.id ? { ...t, status } : t)) });
    toast(`Moved to ${TASK_STATUS[status]?.label}`);
  };

  const bulkMove = (status) => {
    if (locked) return;
    const ids = [...selected];
    if (ids.length === 0 || !status) return;
    mutate({ ...data, tasks: data.tasks.map((t) => (ids.includes(t.id) ? { ...t, status } : t)) });
    toast(`${ids.length} task${ids.length === 1 ? "" : "s"} moved to ${TASK_STATUS[status]?.label}`);
    clearSelection();
  };

  const bulkDelete = () => {
    if (locked) return;
    const ids = [...selected];
    if (ids.length === 0) return;
    const removed = data.tasks.filter((t) => ids.includes(t.id));
    mutate({ ...data, tasks: data.tasks.filter((t) => !ids.includes(t.id)) });
    clearSelection();
    setBulkConfirm(false);
    toast(`${removed.length} task${removed.length === 1 ? "" : "s"} deleted`, "success", {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () => {
          const current = dataRef.current;
          const stillMissing = removed.filter((t) => !current.tasks.some((x) => x.id === t.id));
          if (stillMissing.length === 0) return;
          mutate({ ...current, tasks: [...current.tasks, ...stillMissing] });
          toast(`Restored ${stillMissing.length} task${stillMissing.length === 1 ? "" : "s"}`);
        },
      },
    });
  };

  const handleDrop = (col) => (e) => {
    e.preventDefault();
    setDragOverCol(null);
    if (locked) return;
    const taskId = e.dataTransfer.getData("text/plain");
    const task = data.tasks.find((t) => t.id === taskId);
    if (task) moveTask(task, col);
  };

  return (
    <div className="view">
      <div className="toolbar">
        <select className="filter-select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="all">All projects</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => setModal({ mode: "new" })} disabled={data.projects.length === 0 || locked} title={locked ? "Read-only — trial has ended" : undefined}>
          <Plus size={15} /> New task
        </button>
      </div>

      {data.projects.length === 0 && (
        <p className="muted-note inline-warn"><AlertTriangle size={13} /> Add a project before creating tasks.</p>
      )}

      {visibleTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={data.tasks.length ? "No matches" : "No tasks yet"}
          hint={data.tasks.length ? "Try a different project filter." : "Break a project into tasks to route work across the team."}
          actionLabel={data.tasks.length || data.projects.length === 0 || locked ? null : "New task"}
          onAction={() => setModal({ mode: "new" })}
        />
      ) : (
        <div className="board">
          {TASK_COLUMNS.map((col) => {
            const ColIcon = TASK_COLUMN_ICON[col];
            const colTasks = visibleTasks.filter((t) => t.status === col);
            return (
              <div
                className={`board-col ${dragOverCol === col ? "board-col-drag" : ""}`}
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverCol !== col) setDragOverCol(col);
                }}
                onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
                onDrop={handleDrop(col)}
              >
                <div className="board-col-head">
                  <ColIcon size={14} />
                  <span>{TASK_STATUS[col].label}</span>
                  <em>{colTasks.length}</em>
                </div>
                <div className="board-col-body">
                  {colTasks.map((t) => (
                    <div
                      className={`task-card ${selected.has(t.id) ? "task-card-selected" : ""}`}
                      key={t.id}
                      draggable={!locked}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", t.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <div className="task-card-top">
                        <div className="task-card-top-left">
                          <input
                            type="checkbox"
                            className="bulk-checkbox"
                            checked={selected.has(t.id)}
                            onChange={() => toggleSelect(t.id)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${t.title}`}
                          />
                          <GripVertical size={13} className="drag-handle" />
                          <Stamp label={TASK_PRIORITY[t.priority]?.label} color={TASK_PRIORITY[t.priority]?.color} size="sm" />
                        </div>
                        <div className="ticket-actions">
                          <button className="icon-btn" onClick={() => setModal({ mode: "edit", task: t })} disabled={locked} title={locked ? "Read-only — trial has ended" : undefined}>
                            <Pencil size={12} />
                          </button>
                          <button className="icon-btn icon-btn-danger" onClick={() => setConfirmId(t.id)} disabled={locked} title={locked ? "Read-only — trial has ended" : undefined}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <strong>{t.title}</strong>
                      <span className="task-card-project">{projectName(t.projectId)}</span>
                      <div className="task-card-foot">
                        <span>{t.assignee || "Unassigned"}</span>
                        <span className={isOverdue(t.dueDate) && t.status !== "done" ? "amount-warn" : ""}>
                          {fmtDate(t.dueDate)}
                        </span>
                      </div>
                      <select
                        className="mini-select"
                        value={t.status}
                        onChange={(e) => moveTask(t, e.target.value)}
                        disabled={locked}
                      >
                        {Object.entries(TASK_STATUS).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                      {confirmId === t.id && (
                        <ConfirmDelete label={t.title} onConfirm={() => deleteTask(t.id)} onCancel={() => setConfirmId(null)} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-bar-count">{selected.size} selected</span>
          <select
            className="mini-select"
            value=""
            onChange={(e) => bulkMove(e.target.value)}
            disabled={locked}
          >
            <option value="">Move to…</option>
            {Object.entries(TASK_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setBulkConfirm(true)} disabled={locked}>
            <Trash2 size={13} /> Delete
          </button>
          <button className="icon-btn" onClick={clearSelection} aria-label="Clear selection">
            <X size={14} />
          </button>
          {bulkConfirm && (
            <div className="bulk-bar-confirm">
              <ConfirmDelete
                label={`${selected.size} task${selected.size === 1 ? "" : "s"}`}
                onConfirm={bulkDelete}
                onCancel={() => setBulkConfirm(false)}
                undoable
              />
            </div>
          )}
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === "edit" ? "Edit task" : "New task"} onClose={() => setModal(null)}>
          <TaskForm initial={modal.task} projects={data.projects} onSave={saveTask} onCancel={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ---------------------- invoices ---------------------- */
function InvoiceForm({ initial, clients, projects, tasks, invoices, nextNumber, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial || {
      number: String(nextNumber),
      clientId: clients[0]?.id || "",
      projectId: "",
      status: "draft",
      issueDate: todayISO(),
      dueDate: addDays(todayISO(), 14),
      items: [{ desc: "", qty: 1, rate: 0 }],
    }
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const setItem = (idx, k, v) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)),
    }));

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { desc: "", qty: 1, rate: 0 }] }));
  const removeItem = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const total = form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const projectsForClient = projects.filter((p) => p.clientId === form.clientId);
  const selectedProject = projects.find((p) => p.id === form.projectId);
  const canSave = form.clientId && form.number.trim() && form.items.some((it) => it.desc.trim());

  const alreadyInvoicedForProject = (projectId) =>
    invoices
      .filter((i) => i.projectId === projectId && i.id !== initial?.id)
      .reduce((sum, i) => sum + i.items.reduce((s, it) => s + it.qty * it.rate, 0), 0);

  const autofillFromProject = () => {
    if (!selectedProject) return;
    const billed = alreadyInvoicedForProject(selectedProject.id);
    const remaining = Math.max(selectedProject.budget - billed, 0);
    setForm((f) => ({
      ...f,
      items: [
        ...f.items.filter((it) => it.desc.trim()),
        { desc: `${selectedProject.name} — project fee`, qty: 1, rate: remaining || selectedProject.budget || 0 },
      ],
      dueDate: f.dueDate || addDays(f.issueDate, 14),
    }));
  };

  const addTasksAsLines = () => {
    if (!selectedProject) return;
    const projectTasks = tasks.filter((t) => t.projectId === selectedProject.id);
    const existing = new Set(form.items.map((it) => it.desc.trim().toLowerCase()));
    const newLines = projectTasks
      .filter((t) => !existing.has(t.title.trim().toLowerCase()))
      .map((t) => ({ desc: t.title, qty: 1, rate: 0 }));
    if (newLines.length === 0) return;
    setForm((f) => ({ ...f, items: [...f.items.filter((it) => it.desc.trim()), ...newLines] }));
  };

  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) return;
        onSave({
          ...form,
          items: form.items
            .filter((it) => it.desc.trim())
            .map((it) => ({ desc: it.desc, qty: Number(it.qty) || 0, rate: Number(it.rate) || 0 })),
        });
      }}
    >
      <div className="field-row">
        <Field label="Invoice number">
          <input value={form.number} onChange={set("number")} required />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={set("status")}>
            {Object.entries(INVOICE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="field-row">
        <Field label="Client">
          <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value, projectId: "" }))} required>
            {clients.length === 0 && <option value="">Add a client first</option>}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company}</option>
            ))}
          </select>
        </Field>
        <Field label="Project (optional)">
          <select value={form.projectId} onChange={set("projectId")}>
            <option value="">— none —</option>
            {projectsForClient.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="field-row">
        <Field label="Issue date">
          <input type="date" value={form.issueDate} onChange={set("issueDate")} />
        </Field>
        <Field label="Due date">
          <input type="date" value={form.dueDate} onChange={set("dueDate")} />
        </Field>
      </div>

      {selectedProject && (
        <div className="autofill-row">
          <span className="field-hint"><Sparkles size={12} /> Generate from {selectedProject.name}:</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={autofillFromProject}>
            <Sparkles size={13} /> Remaining budget as a line
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={addTasksAsLines}>
            <ListPlus size={13} /> Add tasks as lines
          </button>
        </div>
      )}

      <div className="line-items">
        <span className="field-label">Line items</span>
        <div className="line-items-head">
          <span>Description</span>
          <span>Qty</span>
          <span>Rate (DZD)</span>
          <span />
        </div>
        {form.items.map((it, idx) => (
          <div className="line-item-row" key={idx}>
            <input
              value={it.desc}
              onChange={(e) => setItem(idx, "desc", e.target.value)}
              placeholder="Brand strategy & discovery"
            />
            <input type="number" min="0" value={it.qty} onChange={(e) => setItem(idx, "qty", e.target.value)} />
            <input type="number" min="0" value={it.rate} onChange={(e) => setItem(idx, "rate", e.target.value)} />
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              onClick={() => removeItem(idx)}
              disabled={form.items.length === 1}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
          <Plus size={13} /> Add line
        </button>
      </div>

      <div className="invoice-total-row">
        <span>Total</span>
        <strong>{fmtMoney(total)}</strong>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!canSave}>Save invoice</button>
      </div>
    </form>
  );
}

/* ---------------------- printable invoice ---------------------- */
const INVOICE_STATUS_FR = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  overdue: "En retard",
};

function InvoicePrintable({ invoice, client, project, settings }) {
  const total = invoice.items.reduce((s, it) => s + it.qty * it.rate, 0);
  const invoiceYear = (invoice.issueDate || "").slice(0, 4) || String(new Date().getFullYear());
  const displayNumber = /^\d+$/.test(String(invoice.number))
    ? `INV-${invoiceYear}-${invoice.number}`
    : invoice.number;

  return (
    <div className="invoice-print">
      <div className="invoice-print-head">
        <div className="invoice-print-brand">
          {settings.logoDataUrl ? (
            <img className="invoice-print-logo" src={settings.logoDataUrl} alt={settings.studioName} />
          ) : (
            <h2>{settings.studioName}</h2>
          )}
          {settings.tagline && <p className="invoice-print-tagline">{settings.tagline}</p>}
        </div>
        <div className="invoice-print-divider" />
        <div className="invoice-print-meta">
          <h3>FACTURE</h3>
          <p className="mono-cell">N° {displayNumber}</p>
          <div className="invoice-print-meta-row">
            <Calendar size={13} />
            <span>Date de Facturation<br /><strong>{fmtDate(invoice.issueDate)}</strong></span>
          </div>
          <div className="invoice-print-meta-row">
            <Calendar size={13} />
            <span>Date d'échéance<br /><strong>{fmtDate(invoice.dueDate)}</strong></span>
          </div>
          <Stamp label={INVOICE_STATUS_FR[invoice.status] || invoice.status} color={INVOICE_STATUS[invoice.status]?.color} />
        </div>
      </div>

      <div className="invoice-print-billto">
        <span className="invoice-print-billto-icon"><User size={16} /></span>
        <div>
          <strong>FACTURE À</strong>
          <p>Client : <strong>{client?.company || "—"}</strong></p>
          {client?.name && <p>{client.name}</p>}
          {(client?.email || client?.phone) && (
            <p>{[client.email, client.phone].filter(Boolean).join(" · ")}</p>
          )}
          {project && <p>Projet : {project.name}</p>}
        </div>
      </div>

      <table className="invoice-print-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantité</th>
            <th>Prix unitaire</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={i}>
              <td>{it.desc}</td>
              <td>{String(it.qty).padStart(2, "0")}</td>
              <td>{fmtMoney(it.rate)}</td>
              <td>{fmtMoney(it.qty * it.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-print-totals">
        <div className="invoice-print-totals-row">
          <span>SOUS-TOTAL</span>
          <span>{fmtMoney(total)}</span>
        </div>
        <div className="invoice-print-totals-row">
          <span>TVA (0%)</span>
          <span>00 %</span>
        </div>
        <div className="invoice-print-totals-row invoice-print-totals-final">
          <span>TOTAL À PAYER</span>
          <span>{fmtMoney(total)}</span>
        </div>
      </div>

      {settings.paymentMethod && (
        <div className="invoice-print-payment">
          <span className="invoice-print-payment-icon"><CreditCard size={16} /></span>
          <div>
            <strong>Méthode de paiement</strong>
            <p>{settings.paymentMethod}</p>
          </div>
        </div>
      )}

      <div className="invoice-print-thanks">
        <h4>Merci d'avoir choisi {settings.studioName}</h4>
        {settings.invoiceNote && <p>{settings.invoiceNote}</p>}
      </div>

      {(settings.phone || settings.email || settings.address || settings.taxId) && (
        <div className="invoice-print-footer">
          {settings.phone && (
            <span><Phone size={13} /><MessageCircle size={13} />{settings.phone}</span>
          )}
          {settings.email && (
            <span><Mail size={13} />{settings.email}</span>
          )}
          <span><Facebook size={13} /><Instagram size={13} />{settings.studioName}</span>
        </div>
      )}
      {(settings.address || settings.taxId) && (
        <p className="invoice-print-fineprint">
          {[settings.address, settings.taxId && `NIF/RC : ${settings.taxId}`].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

const INVOICE_NATURAL_WIDTH = 700;

function InvoicePreviewModal({ invoice, client, project, settings, onClose }) {
  const frameRef = useRef(null);
  const pdfRef = useRef(null); // hidden, fixed-width copy — always captured whole, used for the PDF and for height measurement
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  useEffect(() => {
    const measure = () => {
      const frameW = frameRef.current?.clientWidth || INVOICE_NATURAL_WIDTH;
      setScale(Math.min(1, frameW / INVOICE_NATURAL_WIDTH));
      setNaturalHeight(pdfRef.current?.offsetHeight || 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (frameRef.current) ro.observe(frameRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [invoice, client, project, settings]);

  const downloadPdf = async () => {
    const node = pdfRef.current;
    if (!node || busy) return;
    setBusy(true);
    setError("");
    try {
      const width = node.scrollWidth;
      const height = node.scrollHeight;
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        width,
        height,
        windowWidth: width,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: height >= width ? "portrait" : "landscape",
        unit: "px",
        format: [width, height],
        hotfixes: ["px_scaling"],
      });
      pdf.addImage(imgData, "PNG", 0, 0, width, height);
      pdf.save(`Invoice-${invoice.number}.pdf`);
      toast?.("PDF downloaded");
    } catch (err) {
      setError("Couldn't generate the PDF — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Invoice #${invoice.number}`} onClose={onClose} wide>
      <div className="invoice-preview-actions no-print">
        <button className="btn btn-primary" onClick={downloadPdf} disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
          {busy ? "Preparing PDF…" : "Download PDF"}
        </button>
        {error && <span className="field-hint field-hint-error">{error}</span>}
      </div>

      {/* Visible preview — the real invoice, rendered at a fixed "page" width and
          scaled down (never up) to fit whatever space is available, so nothing
          ever gets cropped or needs horizontal scrolling. */}
      <div className="invoice-print-frame" ref={frameRef} style={{ height: naturalHeight * scale || undefined }}>
        <div className="invoice-print-scale" style={{ width: INVOICE_NATURAL_WIDTH, transform: `scale(${scale})` }}>
          <InvoicePrintable invoice={invoice} client={client} project={project} settings={settings} />
        </div>
      </div>

      {/* Hidden, always full-size copy — the PDF is captured from this one so the
          download is identical and complete regardless of screen size. */}
      <div className="invoice-print-offscreen" aria-hidden="true">
        <div ref={pdfRef} style={{ width: INVOICE_NATURAL_WIDTH }}>
          <InvoicePrintable invoice={invoice} client={client} project={project} settings={settings} />
        </div>
      </div>
    </Modal>
  );
}

function InvoicesView({ data, mutate }) {
  const [modal, setModal] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [previewFor, setPreviewFor] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const toast = useToast();
  const { readOnly: locked } = useTrial();

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const clientOf = (id) => data.clients.find((c) => c.id === id);
  const clientName = (id) => clientOf(id)?.company || "Unassigned";
  const invoiceTotal = (inv) => inv.items.reduce((s, it) => s + it.qty * it.rate, 0);

  const effectiveStatus = (inv) =>
    inv.status === "sent" && isOverdue(inv.dueDate) ? "overdue" : inv.status;

  const filtered = data.invoices.filter((inv) => statusFilter === "all" || effectiveStatus(inv) === statusFilter);
  const filteredIds = useMemo(() => new Set(filtered.map((i) => i.id)), [filtered]);

  useEffect(() => {
    setSelected((s) => {
      const next = new Set([...s].filter((id) => filteredIds.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [filteredIds]);

  const toggleSelect = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());
  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((s) => new Set([...s].filter((id) => !filteredIds.has(id))));
    } else {
      setSelected((s) => new Set([...s, ...filtered.map((i) => i.id)]));
    }
  };

  const saveInvoice = (form) => {
    if (locked) return;
    if (modal.mode === "edit") {
      mutate({ ...data, invoices: data.invoices.map((i) => (i.id === modal.invoice.id ? { ...i, ...form } : i)) });
      toast(`Invoice #${form.number} updated`);
    } else {
      mutate({
        ...data,
        invoices: [...data.invoices, { id: uid("inv"), ...form }],
        jobCounter: data.jobCounter + 1,
      });
      toast(`Invoice #${form.number} created`);
    }
    setModal(null);
  };

  const deleteInvoice = (id) => {
    if (locked) return;
    const inv = data.invoices.find((x) => x.id === id);
    mutate({ ...data, invoices: data.invoices.filter((i) => i.id !== id) });
    setConfirmId(null);
    toast(`Invoice #${inv?.number || ""} deleted`);
  };

  const bulkSetStatus = (status) => {
    if (locked) return;
    const ids = [...selected];
    if (ids.length === 0 || !status) return;
    mutate({ ...data, invoices: data.invoices.map((i) => (ids.includes(i.id) ? { ...i, status } : i)) });
    toast(`${ids.length} invoice${ids.length === 1 ? "" : "s"} marked ${INVOICE_STATUS[status]?.label.toLowerCase()}`);
    clearSelection();
  };

  const bulkDelete = () => {
    if (locked) return;
    const ids = [...selected];
    if (ids.length === 0) return;
    const removed = data.invoices.filter((i) => ids.includes(i.id));
    mutate({ ...data, invoices: data.invoices.filter((i) => !ids.includes(i.id)) });
    clearSelection();
    setBulkConfirm(false);
    toast(`${removed.length} invoice${removed.length === 1 ? "" : "s"} deleted`, "success", {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () => {
          const current = dataRef.current;
          const stillMissing = removed.filter((i) => !current.invoices.some((x) => x.id === i.id));
          if (stillMissing.length === 0) return;
          mutate({ ...current, invoices: [...current.invoices, ...stillMissing] });
          toast(`Restored ${stillMissing.length} invoice${stillMissing.length === 1 ? "" : "s"}`);
        },
      },
    });
  };

  return (
    <div className="view">
      <div className="toolbar">
        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(INVOICE_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <button
          className="btn btn-primary"
          onClick={() => setModal({ mode: "new" })}
          disabled={data.clients.length === 0 || locked}
          title={locked ? "Read-only — trial has ended" : undefined}
        >
          <Plus size={15} /> New invoice
        </button>
      </div>

      {data.clients.length === 0 && (
        <p className="muted-note inline-warn"><AlertTriangle size={13} /> Add a client before creating an invoice.</p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={data.invoices.length ? "No matches" : "No invoices yet"}
          hint={data.invoices.length ? "Try a different status filter." : "Bill a client once work is ready to go out the door."}
          actionLabel={data.invoices.length || data.clients.length === 0 || locked ? null : "New invoice"}
          onAction={() => setModal({ mode: "new" })}
        />
      ) : (
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th className="ledger-check-col">
                  <input
                    type="checkbox"
                    className="bulk-checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all invoices"
                  />
                </th>
                <th>Invoice</th>
                <th>Client</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className={selected.has(inv.id) ? "row-selected" : ""}>
                  <td className="ledger-check-col">
                    <input
                      type="checkbox"
                      className="bulk-checkbox"
                      checked={selected.has(inv.id)}
                      onChange={() => toggleSelect(inv.id)}
                      aria-label={`Select invoice #${inv.number}`}
                    />
                  </td>
                  <td className="mono-cell">#{inv.number}</td>
                  <td>{clientName(inv.clientId)}</td>
                  <td>{fmtDate(inv.issueDate)}</td>
                  <td>{fmtDate(inv.dueDate)}</td>
                  <td className="mono-cell">{fmtMoney(invoiceTotal(inv))}</td>
                  <td>
                    <Stamp
                      label={INVOICE_STATUS[effectiveStatus(inv)]?.label}
                      color={INVOICE_STATUS[effectiveStatus(inv)]?.color}
                      size="sm"
                    />
                  </td>
                  <td>
                    <div className="ticket-actions">
                      <button className="icon-btn" onClick={() => setPreviewFor(inv)} title="Preview & download">
                        <Eye size={14} />
                      </button>
                      <button className="icon-btn" onClick={() => setModal({ mode: "edit", invoice: inv })} disabled={locked} title={locked ? "Read-only — trial has ended" : undefined}>
                        <Pencil size={14} />
                      </button>
                      <button className="icon-btn icon-btn-danger" onClick={() => setConfirmId(inv.id)} disabled={locked} title={locked ? "Read-only — trial has ended" : undefined}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {confirmId === inv.id && (
                      <div className="confirm-floating">
                        <ConfirmDelete label={`#${inv.number}`} onConfirm={() => deleteInvoice(inv.id)} onCancel={() => setConfirmId(null)} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-bar-count">{selected.size} selected</span>
          <button className="btn btn-ghost btn-sm" onClick={() => bulkSetStatus("paid")} disabled={locked}>
            <CheckCircle2 size={13} /> Mark paid
          </button>
          <select
            className="mini-select"
            value=""
            onChange={(e) => bulkSetStatus(e.target.value)}
            disabled={locked}
          >
            <option value="">Set status…</option>
            {Object.entries(INVOICE_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setBulkConfirm(true)} disabled={locked}>
            <Trash2 size={13} /> Delete
          </button>
          <button className="icon-btn" onClick={clearSelection} aria-label="Clear selection">
            <X size={14} />
          </button>
          {bulkConfirm && (
            <div className="bulk-bar-confirm">
              <ConfirmDelete
                label={`${selected.size} invoice${selected.size === 1 ? "" : "s"}`}
                onConfirm={bulkDelete}
                onCancel={() => setBulkConfirm(false)}
                undoable
              />
            </div>
          )}
        </div>
      )}

      {modal && (
        <Modal
          title={modal.mode === "edit" ? `Edit invoice #${modal.invoice.number}` : "New invoice"}
          onClose={() => setModal(null)}
          wide
        >
          <InvoiceForm
            initial={modal.invoice}
            clients={data.clients}
            projects={data.projects}
            tasks={data.tasks}
            invoices={data.invoices}
            nextNumber={data.jobCounter}
            onSave={saveInvoice}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {previewFor && (
        <InvoicePreviewModal
          invoice={previewFor}
          client={clientOf(previewFor.clientId)}
          project={data.projects.find((p) => p.id === previewFor.projectId)}
          settings={data.settings || DEFAULT_SETTINGS}
          onClose={() => setPreviewFor(null)}
        />
      )}
    </div>
  );
}

/* ---------------------- client portal ----------------------
   A code-gated, read-only view. The code is per-project (see
   Projects → Files/portal chip), not a real authentication
   system — anyone with the code and the artifact link can view
   that project. Don't put anything client-sensitive elsewhere
   in the shared ERP data. */
function ClientPortalGate({ onFound, onExit }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || checking) return;
    setChecking(true);
    setError("");
    const { data: result, error: rpcError } = await supabase.rpc("get_portal_project", { p_code: trimmed });
    setChecking(false);
    if (rpcError || !result) {
      setError("No project matches that code. Check with your studio contact.");
      return;
    }
    onFound(trimmed, result);
  };

  return (
    <div className="portal-shell">
      <div className="portal-gate">
        <div className="portal-badge">
          <ShieldCheck size={20} />
        </div>
        <h1>Project portal</h1>
        <p>Enter the access code your studio contact shared with you to view progress and download files.</p>
        <form onSubmit={submit} className="portal-gate-form">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError("");
            }}
            placeholder="e.g. SAB-7F2K4"
            className="mono-input portal-code-input"
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={checking}>
            {checking ? "Checking…" : "View project"}
          </button>
        </form>
        {error && <p className="file-error"><AlertTriangle size={12} /> {error}</p>}
        <button className="link-btn portal-back" onClick={onExit}>
          <LogOut size={13} /> Back to studio
        </button>
      </div>
    </div>
  );
}

/* The portal never touches the studio's loaded `data` — even though
   there's only one team here, a client with a portal code should still
   only ever see that one project's safe fields, not the whole shared
   dataset. It fetches through get_portal_project(), a Postgres function
   that runs with elevated privileges but only ever returns the handful
   of safe fields defined in supabase/schema.sql (no budgets, no other
   projects, no other clients). */
function ClientPortalView({ code, initialResult, onExit }) {
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(!initialResult);

  useEffect(() => {
    if (initialResult) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_portal_project", { p_code: code });
      if (!cancelled) {
        setResult(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, initialResult]);

  if (loading || !result) {
    return (
      <div className="portal-shell">
        <p className="muted-note"><Loader2 size={13} className="spin" /> Loading project…</p>
      </div>
    );
  }

  const { project, client, tasks = [] } = result;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div className="portal-shell portal-shell-view">
      <div className="portal-view">
        <header className="portal-view-head">
          <div>
            <span className="portal-eyebrow">{client?.company}</span>
            <h1>{project.name}</h1>
          </div>
          <button className="link-btn portal-back" onClick={onExit}>
            <LogOut size={13} /> Exit portal
          </button>
        </header>

        <div className="portal-status-row">
          <Stamp label={PROJECT_STATUS[project.status]?.label || project.status} color={PROJECT_STATUS[project.status]?.color} />
          <span className="portal-deadline">Target completion: {fmtDate(project.deadline)}</span>
        </div>

        {project.description && <p className="portal-desc">{project.description}</p>}

        <div className="portal-progress-card">
          <div className="portal-progress-head">
            <span>Overall progress</span>
            <strong>{pct}%</strong>
          </div>
          <div className="progress-track portal-progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="muted-note">{done} of {tasks.length} milestones complete</span>
        </div>

        {tasks.length > 0 && (
          <div className="portal-milestones">
            <h3>Milestones</h3>
            <ul className="mini-list">
              {tasks.map((t, i) => (
                <li key={i}>
                  <div>
                    <strong>{t.title}</strong>
                    <span>{t.dueDate ? `Due ${fmtDate(t.dueDate)}` : "No date set"}</span>
                  </div>
                  <Stamp label={TASK_STATUS[t.status]?.label} color={TASK_STATUS[t.status]?.color} size="sm" />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="portal-files">
          <h3>Files</h3>
          <FileManager readOnly portalCode={code} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------- app shell ---------------------- */
const VIEW_TITLES = {
  dashboard: { title: "Dashboard", sub: "Studio-wide overview" },
  clients: { title: "Clients", sub: "Every account on the books" },
  projects: { title: "Projects", sub: "Active and past job tickets" },
  tasks: { title: "Tasks", sub: "Work in motion across projects" },
  time: { title: "Time", sub: "Hours logged by project, week by week" },
  invoices: { title: "Invoices", sub: "Billing and collections" },
};

export default function StudioOpsERP() {
  const session = useAuth(); // undefined = loading, null = signed out, object = signed in
  const [data, rawMutate, dataStatus] = useStudioData(session?.user?.id);
  const trial = useMemo(() => getTrialInfo(session), [session]);

  const [view, setView] = useState("dashboard");
  const [mode, setMode] = useState("studio"); // "studio" | "portal-gate" | "portal-view"
  const [portalCode, setPortalCode] = useState(null);
  const [portalResult, setPortalResult] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [navOpen, setNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const pushToast = useCallback((message, type = "success", opts = {}) => {
    const id = uid("toast");
    setToasts((t) => [...t, { id, message, type, action: opts.action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 3200);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const mutate = useCallback(
    (next) => {
      if (trial.readOnly) {
        pushToast("Your 7-day trial has ended — this workspace is now read-only.", "error", { duration: 4200 });
        return Promise.resolve();
      }
      return rawMutate(next);
    },
    [trial.readOnly, rawMutate, pushToast]
  );

  const counts = useMemo(() => {
    if (!data) return {};
    return {
      clients: data.clients.length,
      projects: data.projects.length,
      tasks: data.tasks.filter((t) => t.status !== "done").length,
      invoices: data.invoices.length,
    };
  }, [data]);

  const goTo = (v) => {
    setView(v);
    setNavOpen(false);
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Portal routes are public and must work whether or not anyone is signed
  // in on this device, so they're checked before the auth gate below.
  if (mode === "portal-gate") {
    return (
      <div className="studio-ops">
        <style>{CSS}</style>
        <ClientPortalGate
          onFound={(code, result) => {
            setPortalCode(code);
            setPortalResult(result);
            setMode("portal-view");
          }}
          onExit={() => setMode("studio")}
        />
      </div>
    );
  }
  if (mode === "portal-view" && portalCode) {
    return (
      <div className="studio-ops">
        <style>{CSS}</style>
        <ClientPortalView
          code={portalCode}
          initialResult={portalResult}
          onExit={() => {
            setMode("studio");
            setPortalCode(null);
            setPortalResult(null);
          }}
        />
      </div>
    );
  }

  if (session === undefined) {
    return (
      <div className="studio-ops">
        <style>{CSS}</style>
        <div className="boot-screen">
          <div className="boot-stamp">SO</div>
          <p>Opening the job log…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="studio-ops">
        <style>{CSS}</style>
        <AuthScreen onOpenPortal={() => setMode("portal-gate")} />
      </div>
    );
  }

  if (dataStatus === "loading" || !data) {
    return (
      <div className="studio-ops">
        <style>{CSS}</style>
        <div className="boot-screen">
          <div className="boot-stamp">SO</div>
          <p>Opening the job log…</p>
        </div>
      </div>
    );
  }

  const displayName = (session.user.email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  const greetingName = displayName ? displayName.charAt(0).toUpperCase() + displayName.slice(1) : "there";
  const urgentCount =
    data.tasks.filter((t) => t.status !== "done" && isOverdue(t.dueDate)).length +
    data.invoices.filter((i) => i.status === "overdue").length;

  return (
    <ToastContext.Provider value={pushToast}>
    <TrialContext.Provider value={trial}>
      <div
        className="studio-ops"
        style={{
          "--ink": (data.settings || DEFAULT_SETTINGS).primaryColor || DEFAULT_SETTINGS.primaryColor,
          "--red": (data.settings || DEFAULT_SETTINGS).accentColor || DEFAULT_SETTINGS.accentColor,
        }}
      >
        <style>{CSS}</style>
        {navOpen && <div className="nav-veil" onClick={() => setNavOpen(false)} />}
        <Sidebar
          view={view}
          setView={goTo}
          counts={counts}
          settings={data.settings || DEFAULT_SETTINGS}
          onOpenPortal={() => {
            setMode("portal-gate");
            setNavOpen(false);
          }}
          onOpenSettings={() => {
            setSettingsOpen(true);
            setNavOpen(false);
          }}
          onSignOut={() => supabase.auth.signOut()}
          navOpen={navOpen}
        />
        <main className="main">
          <header className="topbar">
            <div className="topbar-left">
              <button className="hamburger-btn" onClick={() => setNavOpen((o) => !o)} aria-label="Toggle menu">
                <Menu size={19} />
              </button>
              <div>
                {view === "dashboard" ? (
                  <>
                    <h1>Welcome, {greetingName} <span className="wave-emoji">👋</span></h1>
                    <p>Here's what's happening in your studio.</p>
                  </>
                ) : (
                  <>
                    <h1>{VIEW_TITLES[view].title}</h1>
                    <p>{VIEW_TITLES[view].sub}</p>
                  </>
                )}
              </div>
            </div>
            <div className="topbar-right">
              <button className="search-trigger" onClick={() => setSearchOpen(true)}>
                <Search size={14} />
                <span>Search…</span>
                <em>Ctrl K</em>
              </button>
              <button
                className="topbar-icon-btn"
                onClick={() => setView(urgentCount > 0 ? "tasks" : view)}
                title={urgentCount > 0 ? `${urgentCount} overdue item(s)` : "No overdue items"}
              >
                <Bell size={15} />
                {urgentCount > 0 && <span className="topbar-icon-badge">{urgentCount > 9 ? "9+" : urgentCount}</span>}
              </button>
              <button className="topbar-avatar" onClick={() => setSettingsOpen(true)} title={session.user.email}>
                {greetingName.charAt(0).toUpperCase()}
              </button>
              <span className="topbar-date">{fmtDate(todayISO())}</span>
            </div>
          </header>

          {trial.active && (
            trial.readOnly ? (
              <div className="trial-banner trial-banner-expired">
                <Lock size={13} />
                <span>Your 7-day trial has ended. The workspace is now <strong>read-only</strong> — you can browse, but adding, editing, or deleting is disabled.</span>
              </div>
            ) : trial.daysLeft <= 3 ? (
              <div className="trial-banner trial-banner-warn">
                <Clock size={13} />
                <span>{trial.daysLeft === 0 ? "Your trial ends today." : `${trial.daysLeft} day${trial.daysLeft === 1 ? "" : "s"} left in your trial.`} It'll switch to read-only once it ends.</span>
              </div>
            ) : null
          )}

          {dataStatus === "error" && (
            <div className="conn-warning">
              <AlertTriangle size={13} />
              Couldn't reach Supabase — showing local sample data only. Check your .env values and reload.
            </div>
          )}

          <div className="main-scroll">
            <div className="view-fade" key={view}>
              {view === "dashboard" && <Dashboard data={data} setView={setView} />}
              {view === "clients" && <ClientsView data={data} mutate={mutate} />}
              {view === "projects" && <ProjectsView data={data} mutate={mutate} userId={session.user.id} />}
              {view === "tasks" && <TasksView data={data} mutate={mutate} />}
              {view === "time" && <TimeView data={data} mutate={mutate} />}
              {view === "invoices" && <InvoicesView data={data} mutate={mutate} />}
            </div>
          </div>
        </main>
        {settingsOpen && (
          <StudioSettingsModal
            settings={data.settings || DEFAULT_SETTINGS}
            onClose={() => setSettingsOpen(false)}
            onSave={(settings) => {
              if (trial.readOnly) return;
              mutate({ ...data, settings });
              setSettingsOpen(false);
              pushToast("Studio settings saved");
            }}
          />
        )}
        {searchOpen && (
          <GlobalSearchModal data={data} onClose={() => setSearchOpen(false)} onNavigate={goTo} />
        )}
        <ToastHost toasts={toasts} onDismiss={dismissToast} />
      </div>
    </TrialContext.Provider>
    </ToastContext.Provider>
  );
}

/* ============================================================
   styles — paper ledger + rubber-stamp system
   ============================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.studio-ops {
  --ink: #16294D;
  --paper: #F3F5FA;
  --paper-raised: #FFFFFF;
  --paper-dim: #E8ECF5;
  --rule: #DCE3EF;
  --muted: #6B7686;
  --red: #D64550;
  --green: #22A06B;
  --amber: #D9A441;
  --blue: #2E6FF2;
  --violet: #6B4FA0;
  --page-bg: #EAE8E4;
  --sidebar-bg: #FFFFFF;
  --nav-active-bg: #E3F57E;
  --nav-active-ink: #45560E;

  display: flex;
  gap: 10px;
  width: 100%;
  min-height: 100vh;
  padding: 10px;
  box-sizing: border-box;
  background: var(--page-bg);
  color: var(--ink);
  font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
  font-size: 14px;
  line-height: 1.45;
}

.studio-ops * { box-sizing: border-box; }
.studio-ops h1, .studio-ops h2, .studio-ops h3, .studio-ops h4 {
  font-family: 'Fraunces', serif;
  margin: 0;
  letter-spacing: -0.01em;
}
.studio-ops button { font-family: inherit; cursor: pointer; }
.studio-ops input, .studio-ops select, .studio-ops textarea {
  font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
  font-size: 13px;
  background: var(--paper-raised);
  border: 1.5px solid var(--rule);
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--ink);
  width: 100%;
  outline: none;
}
.studio-ops input:focus, .studio-ops select:focus, .studio-ops textarea:focus {
  border-color: var(--ink);
}
.studio-ops textarea { resize: vertical; }
.studio-ops :focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }

/* boot */
.boot-screen {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 100%; gap: 12px; color: var(--muted);
}
.boot-stamp {
  width: 52px; height: 52px; border: 2.5px solid var(--red); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Fraunces', serif; font-weight: 700; color: var(--red);
  transform: rotate(-8deg);
}

/* sidebar */
.sidebar {
  width: 232px; flex-shrink: 0; background: var(--sidebar-bg); color: var(--ink);
  display: flex; flex-direction: column; padding: 22px 16px;
  position: sticky; top: 10px; height: calc(100vh - 20px);
  border-radius: 24px;
  box-shadow: 0 1px 2px rgba(20,20,25,0.05);
}
.brand { display: flex; align-items: center; gap: 10px; padding: 0 6px 22px; border-bottom: 1px solid var(--rule); margin-bottom: 18px; }
.brand-mark {
  width: 34px; height: 34px; border: 2px solid var(--red); border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Fraunces', serif; font-weight: 700; font-size: 13px; color: #fff;
  flex-shrink: 0; overflow: hidden; background: var(--ink);
}
.brand-mark-logo { padding: 3px; background: var(--paper-dim); }
.brand-mark img { width: 100%; height: 100%; object-fit: contain; }
.brand-word { display: flex; flex-direction: column; line-height: 1.25; }
.brand-word strong { font-family: 'Fraunces', serif; font-size: 15px; letter-spacing: 0.02em; }
.brand-word span { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }

.nav { display: flex; flex-direction: column; gap: 2px; }
.nav-item {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px;
  background: transparent; border: none; color: var(--muted); text-align: left; font-size: 13.5px;
  font-weight: 500;
}
.nav-item span { flex: 1; }
.nav-item em { font-style: normal; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); opacity: 0.7; }
.nav-item:hover { background: var(--paper-dim); color: var(--ink); }
.nav-item-active { background: var(--nav-active-bg); color: var(--nav-active-ink); font-weight: 600; }
.nav-item-active em { color: var(--nav-active-ink); opacity: 0.6; }

.sidebar-foot { margin-top: auto; padding-top: 16px; }
.ticket-mini {
  border: 1px dashed var(--rule); border-radius: 10px; padding: 12px;
}
.ticket-mini span { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.1em; color: var(--red); }
.ticket-mini p { margin: 6px 0 0; font-size: 11.5px; color: var(--muted); line-height: 1.5; }

/* main */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; height: calc(100vh - 20px); overflow: hidden; background: var(--paper-raised); border-radius: 24px; box-shadow: 0 1px 2px rgba(20,20,25,0.05); }
.topbar {
  display: flex; align-items: flex-end; justify-content: space-between;
  padding: 26px 34px 18px; border-bottom: 1px solid var(--rule); flex-shrink: 0;
}
.topbar-left { display: flex; align-items: flex-end; gap: 12px; }
.hamburger-btn {
  display: none; align-items: center; justify-content: center; width: 34px; height: 34px;
  border-radius: 6px; border: 1px solid var(--rule); background: var(--paper-raised); color: var(--ink);
  margin-bottom: 2px; flex-shrink: 0;
}
.hamburger-btn:hover { background: var(--paper-dim); }
.topbar h1 { font-size: 25px; }
.topbar p { margin: 4px 0 0; color: var(--muted); font-size: 12.5px; }
.topbar-date { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--muted); }
.topbar-right { display: flex; align-items: center; gap: 14px; }
.search-trigger {
  display: flex; align-items: center; gap: 7px; background: var(--paper-raised); border: 1.5px solid var(--rule);
  border-radius: 999px; padding: 7px 12px; color: var(--muted); font-size: 12.5px; transition: border-color 0.15s ease, color 0.15s ease;
}
.search-trigger:hover { border-color: var(--ink); color: var(--ink); }
.search-trigger em { font-style: normal; font-family: 'IBM Plex Mono', monospace; font-size: 10px; border: 1px solid var(--rule); border-radius: 3px; padding: 1px 5px; margin-left: 4px; }
.wave-emoji { display: inline-block; animation: wave 1.8s ease-in-out infinite; transform-origin: 70% 70%; }
@keyframes wave { 0%, 60%, 100% { transform: rotate(0deg); } 15% { transform: rotate(14deg); } 30% { transform: rotate(-8deg); } 45% { transform: rotate(10deg); } }
.topbar-icon-btn {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid var(--rule);
  background: var(--paper-raised); color: var(--ink); flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.topbar-icon-btn:hover { background: var(--paper-dim); border-color: var(--ink); }
.topbar-icon-badge {
  position: absolute; top: -3px; right: -3px; min-width: 15px; height: 15px; padding: 0 3px;
  border-radius: 999px; background: var(--red); color: #fff; font-size: 9px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; border: 2px solid var(--paper-raised);
}
.topbar-avatar {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; border: none;
  background: var(--ink); color: #fff; font-family: 'Fraunces', serif; font-weight: 700; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
}
.topbar-avatar:hover { opacity: 0.88; }
.conn-warning {
  display: flex; align-items: center; gap: 8px; background: #FCEEEF; color: var(--red);
  border-bottom: 1px solid var(--red); font-size: 12px; padding: 8px 34px; flex-shrink: 0;
}
.conn-warning-soft { background: #FBF3E6; color: var(--amber); border-bottom-color: var(--amber); }
.conn-warning .link-btn { margin-left: auto; color: inherit; text-decoration: underline; font-weight: 700; flex-shrink: 0; }

.trial-banner {
  display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600;
  padding: 8px 34px; flex-shrink: 0; border-bottom: 1px solid transparent;
}
.trial-banner svg { flex-shrink: 0; }
.trial-banner-warn { background: #FBF3E6; color: var(--amber); border-bottom-color: var(--amber); }
.trial-banner-expired { background: #FCEEEF; color: var(--red); border-bottom-color: var(--red); }

/* auth screen */
.auth-input-row {
  display: flex; align-items: center; gap: 8px; border: 1.5px solid var(--rule); border-radius: 12px;
  padding: 0 12px; background: var(--paper-raised); color: var(--muted);
}
.auth-input-row input { border: none; padding: 9px 0; background: transparent; }
.auth-input-row input:focus { border: none; }
.auth-input-row:focus-within { border-color: var(--ink); color: var(--ink); }
.auth-notice { display: flex; align-items: center; gap: 6px; color: var(--green); font-size: 12px; margin: 0; }

.main-scroll { flex: 1; overflow-y: auto; padding: 26px 34px 60px; }

.view { display: flex; flex-direction: column; gap: 22px; }
.view-fade { animation: viewFadeIn 0.22s ease; }
@keyframes viewFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

/* stat grid (dashboard) */
.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.stat-card {
  background: var(--paper-raised); border: 1px solid var(--rule); border-radius: 8px; padding: 16px 16px 14px;
  display: flex; flex-direction: column; gap: 4px;
}
.stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.stat-value { font-family: 'Fraunces', serif; font-size: 26px; }
.stat-sub { font-size: 11.5px; color: var(--muted); }
.stat-sub-warn { color: var(--red); font-weight: 600; }

.panel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.panel {
  background: var(--paper-raised); border: 1px solid var(--rule); border-radius: 20px; padding: 18px 20px;
  box-shadow: 0 10px 24px -20px rgba(22,41,77,0.3);
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}
.panel:hover { box-shadow: 0 14px 30px -18px rgba(22,41,77,0.35); transform: translateY(-1px); }

/* pastel dashboard cards, in the style of a warm SaaS admin UI */
.stat-grid-v2 { gap: 16px; }
.stat-card-v2 {
  border: none; border-radius: 20px; padding: 18px 18px 16px;
  display: flex; flex-direction: column; gap: 5px; position: relative;
  box-shadow: 0 10px 24px -18px rgba(22,41,77,0.35);
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}
.stat-card-v2:hover { box-shadow: 0 16px 30px -16px rgba(22,41,77,0.4); transform: translateY(-2px); }
.stat-card-v2-icon {
  width: 34px; height: 34px; border-radius: 11px; display: flex; align-items: center; justify-content: center;
  margin-bottom: 6px;
}
.stat-card-peach { background: #FCEEE1; }
.stat-card-peach .stat-card-v2-icon { background: #F6D9AE; color: #A86315; }
.stat-card-lavender { background: #ECE7FB; }
.stat-card-lavender .stat-card-v2-icon { background: #D6CDFA; color: #5541C9; }
.stat-card-rose { background: #FBE7EA; }
.stat-card-rose .stat-card-v2-icon { background: #F5CBD3; color: #B23A55; }
.stat-card-mint { background: #E1F5EC; }
.stat-card-mint .stat-card-v2-icon { background: #BFE9DD; color: #1C8467; }

.panel-grid-uneven { grid-template-columns: 1.5fr 1fr; }

.donut-panel-body { display: flex; align-items: center; gap: 22px; padding-top: 6px; }
.donut-chart { position: relative; flex-shrink: 0; }
.donut-chart-center {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.donut-chart-center strong { font-family: 'Fraunces', serif; font-size: 22px; line-height: 1; }
.donut-chart-center span { font-size: 10.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.donut-legend { display: flex; flex-direction: column; gap: 10px; flex: 1; min-width: 0; }
.donut-legend li { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
.donut-legend-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.donut-legend-label { flex: 1; color: var(--ink); }
.donut-legend-value { font-weight: 700; }

.top-client-list { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; }
.top-client-list li { display: flex; align-items: center; gap: 12px; }
.top-client-avatar {
  width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; color: #fff; flex-shrink: 0;
}
.top-client-avatar-0 { background: var(--blue); }
.top-client-avatar-1 { background: var(--violet); }
.top-client-avatar-2 { background: #F0A45E; }
.top-client-avatar-3 { background: var(--green); }
.top-client-info { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.top-client-info strong { font-size: 13px; }
.top-client-info span { font-size: 11.5px; color: var(--muted); }
.top-client-total { font-weight: 700; font-size: 13px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.panel-head h3 { font-size: 15px; }
.link-btn { background: none; border: none; color: var(--blue); font-size: 12px; display: flex; align-items: center; gap: 2px; font-weight: 500; }
.mini-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.mini-list li { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--paper-dim); }
.mini-list li:last-child { border-bottom: none; }
.mini-list li > div { display: flex; flex-direction: column; gap: 1px; }
.mini-list li strong { font-size: 13px; }
.mini-list li span { font-size: 11.5px; color: var(--muted); }
.muted-note { color: var(--muted); font-size: 12.5px; }
.inline-warn { display: flex; align-items: center; gap: 6px; color: var(--amber); }

/* toolbar */
.toolbar { display: flex; align-items: center; gap: 10px; }
.search-box {
  display: flex; align-items: center; gap: 7px; background: var(--paper-raised);
  border: 1.5px solid var(--rule); border-radius: 5px; padding: 7px 10px; flex: 1; max-width: 280px; color: var(--muted);
}
.search-box input { border: none; padding: 0; background: transparent; }
.search-box input:focus { border: none; }
.filter-select { max-width: 190px; }

/* buttons */
.btn {
  display: inline-flex; align-items: center; gap: 6px; border-radius: 12px; padding: 8px 15px;
  font-size: 13px; font-weight: 600; border: 1.5px solid transparent;
  transition: background 0.15s ease, transform 0.1s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn-primary { background: var(--ink); color: var(--paper); box-shadow: 0 8px 18px -10px rgba(22,41,77,0.55); }
.btn-primary:hover { background: #000; }
.btn-primary:disabled { background: var(--rule); color: var(--muted); cursor: not-allowed; }
.btn-ghost { background: transparent; border-color: var(--rule); color: var(--ink); }
.btn-ghost:hover { background: var(--paper-dim); }
.btn-danger { background: var(--red); color: #fff; }
.btn-sm { padding: 6px 10px; font-size: 12px; }

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px;
  border-radius: 5px; border: 1px solid var(--rule); background: var(--paper-raised); color: var(--ink);
  transition: background 0.15s ease, transform 0.1s ease, color 0.15s ease, border-color 0.15s ease;
}
.icon-btn:hover { background: var(--paper-dim); }
.icon-btn:active:not(:disabled) { transform: scale(0.93); }
.icon-btn-danger:hover { background: rgba(196,41,60,0.1); border-color: var(--red); color: var(--red); }
.icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* stamp — signature element */
.stamp {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; font-weight: 600;
  letter-spacing: 0.06em; border: 1.5px solid var(--stamp-color); color: var(--stamp-color);
  border-radius: 3px; padding: 3px 8px; transform: rotate(-2.5deg); background: rgba(255,255,255,0.4);
  white-space: nowrap;
}
.stamp-md { font-size: 10.5px; }
.stamp-sm { font-size: 9.5px; padding: 2px 6px; }

/* tickets (clients/projects grid) */
.ticket-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 14px; }
.ticket {
  background: var(--paper-raised); border: 1px solid var(--rule); border-radius: 8px; padding: 14px 16px 12px;
  position: relative; display: flex; flex-direction: column; gap: 10px;
  transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
}
.ticket:hover { box-shadow: 0 8px 20px rgba(23,24,28,0.08); transform: translateY(-2px); border-color: #C9C6BB; }
.ticket::before {
  content: ""; position: absolute; top: 0; left: 16px; right: 16px; height: 0;
  border-top: 1.5px dashed var(--rule);
}
.ticket-top { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
.ticket-id { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--muted); letter-spacing: 0.05em; }
.ticket-icon { color: var(--muted); margin-bottom: 2px; }
.ticket-body h4 { font-size: 16px; margin-bottom: 2px; }
.ticket-sub { color: var(--muted); font-size: 12.5px; margin: 0 0 6px; }
.ticket-line { font-size: 12px; margin: 0; color: var(--ink); }
.ticket-notes { font-size: 12px; color: var(--muted); margin: 8px 0 0; line-height: 1.5; }
.ticket-meta-row { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--muted); margin-top: 8px; font-family: 'IBM Plex Mono', monospace; }
.ticket-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--paper-dim); }
.ticket-actions { display: flex; gap: 6px; }
.amount-warn { color: var(--red); font-weight: 600; font-size: 12px; }
.amount-good { color: var(--green); font-weight: 600; font-size: 12px; }
.amount-quiet { color: var(--muted); font-size: 12px; }

.progress-track { position: relative; height: 6px; background: var(--paper-dim); border-radius: 4px; margin-top: 10px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--green); border-radius: 4px; }
.progress-track span { position: absolute; top: 9px; left: 0; font-size: 10.5px; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }

.confirm-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: #FCEEEF; border: 1px solid var(--red); border-radius: 6px; padding: 8px 10px; font-size: 11.5px; color: var(--red);
}
.confirm-row span { display: flex; align-items: center; gap: 6px; }
.confirm-actions { display: flex; gap: 6px; flex-shrink: 0; }
.confirm-floating { position: absolute; right: 10px; top: 44px; z-index: 5; width: 230px; box-shadow: 0 6px 18px rgba(0,0,0,0.12); }

/* bulk actions */
.bulk-checkbox { width: 15px; height: 15px; accent-color: var(--ink); cursor: pointer; flex-shrink: 0; }
.ledger-check-col { width: 34px; padding-right: 0 !important; }
.row-selected { background: var(--paper-dim); }
.task-card-selected { border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink); }
.bulk-bar {
  position: sticky; bottom: 14px; left: 0; z-index: 20; margin-top: 14px;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  background: var(--ink); color: var(--paper); border-radius: 9px; padding: 9px 12px;
  box-shadow: 0 10px 24px rgba(0,0,0,0.22); animation: toastIn 0.15s ease;
}
.bulk-bar-count { font-size: 12.5px; font-weight: 600; margin-right: 4px; white-space: nowrap; }
.bulk-bar .btn-ghost { border-color: rgba(255,255,255,0.3); color: var(--paper); }
.bulk-bar .btn-ghost:hover { background: rgba(255,255,255,0.12); }
.bulk-bar .mini-select { background: transparent; border-color: rgba(255,255,255,0.3); color: var(--paper); }
.bulk-bar .icon-btn { color: var(--paper); }
.bulk-bar .icon-btn:hover { background: rgba(255,255,255,0.12); }
.bulk-bar-confirm { position: absolute; right: 0; bottom: 46px; width: 260px; box-shadow: 0 10px 24px rgba(0,0,0,0.25); }

/* empty state */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 56px 20px; color: var(--muted); border: 1.5px dashed var(--rule); border-radius: 10px; text-align: center;
}
.empty-state h3 { font-size: 16px; color: var(--ink); margin-top: 4px; }
.empty-state p { margin: 0; font-size: 12.5px; max-width: 320px; }
.empty-state .btn { margin-top: 8px; }

/* board (tasks) */
.board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; align-items: start; }
.board-col { background: var(--paper-dim); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 120px; border: 1.5px solid transparent; transition: background 0.15s ease, border-color 0.15s ease; }
.board-col-drag { background: #EFEEE8; border-color: var(--ink); border-style: dashed; }
.board-col-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 2px 4px 4px; color: var(--ink); }
.board-col-head em { font-style: normal; margin-left: auto; color: var(--muted); font-family: 'IBM Plex Mono', monospace; font-size: 11px; }
.board-col-body { display: flex; flex-direction: column; gap: 8px; }
.task-card { background: var(--paper-raised); border: 1px solid var(--rule); border-radius: 7px; padding: 10px 11px; position: relative; display: flex; flex-direction: column; gap: 6px; cursor: grab; transition: box-shadow 0.15s ease, transform 0.15s ease; }
.task-card:hover { box-shadow: 0 4px 12px rgba(23,24,28,0.08); }
.task-card:active { cursor: grabbing; }
.drag-handle { color: var(--rule); flex-shrink: 0; }
.task-card-top { display: flex; align-items: center; justify-content: space-between; }
.task-card-top-left { display: flex; align-items: center; gap: 6px; }
.task-card strong { font-size: 12.5px; line-height: 1.35; }
.task-card-project { font-size: 11px; color: var(--muted); }
.task-card-foot { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }
.mini-select { margin-top: 2px; font-size: 11px; padding: 5px 7px; }

/* forms */
.form-grid { display: flex; flex-direction: column; gap: 14px; }
.form-fieldset { display: flex; flex-direction: column; gap: 14px; border: none; margin: 0; padding: 0; min-width: 0; }
.form-fieldset:disabled { opacity: 0.6; }
.field { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.field-label { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.field-row { display: flex; gap: 12px; }
.field-row .field { flex: 1; }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 6px; border-top: 1px solid var(--rule); margin-top: 4px; }

.line-items { display: flex; flex-direction: column; gap: 6px; }
.line-items-head, .line-item-row { display: grid; grid-template-columns: 1fr 64px 100px 30px; gap: 8px; align-items: center; }
.line-items-head span { font-size: 10.5px; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; }
.invoice-total-row { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 2px; border-top: 1.5px solid var(--ink); font-family: 'Fraunces', serif; }
.invoice-total-row strong { font-size: 20px; }

.autofill-row {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px; background: var(--paper-dim);
  border: 1px dashed var(--rule); border-radius: 6px; padding: 8px 10px;
}
.autofill-row .field-hint { display: flex; align-items: center; gap: 5px; font-weight: 600; color: var(--ink); }

/* printable invoice */
.invoice-preview-actions { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.invoice-print-frame { background: #fff; border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; position: relative; }
.invoice-print-scale { transform-origin: top left; }
.invoice-print-offscreen { position: fixed; top: 0; left: -99999px; pointer-events: none; }

.invoice-print {
  --inv-navy: #0B1130;
  --inv-blue: #2AA1F2;
  --inv-blue-soft: #E9F5FE;
  --inv-muted: #6B7280;
  padding: 36px 38px 30px;
  background: #F4F7FB;
  color: var(--inv-navy);
  font-family: 'Inter', sans-serif;
}

.invoice-print-head { display: flex; align-items: flex-start; gap: 22px; margin-bottom: 30px; }
.invoice-print-brand { flex: 1; }
.invoice-print-brand h2 { font-size: 24px; font-weight: 800; letter-spacing: -0.01em; margin: 0; text-transform: uppercase; }
.invoice-print-logo { max-height: 64px; max-width: 240px; width: auto; height: auto; object-fit: contain; display: block; }
.invoice-print-tagline { margin: 6px 0 0; font-size: 12px; font-weight: 600; color: var(--inv-muted); letter-spacing: 0.02em; }
.invoice-print-divider { width: 1px; align-self: stretch; background: var(--inv-navy); opacity: 0.15; }
.invoice-print-meta { flex: 1; text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.invoice-print-meta h3 { font-size: 26px; font-weight: 800; letter-spacing: 0.02em; margin: 0; }
.invoice-print-meta > p.mono-cell { margin: 0 0 4px; font-size: 12.5px; color: var(--inv-blue); font-weight: 700; }
.invoice-print-meta-row {
  display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--inv-muted);
  line-height: 1.5;
}
.invoice-print-meta-row svg { flex-shrink: 0; color: var(--inv-navy); }
.invoice-print-meta-row strong { color: var(--inv-navy); font-size: 12px; }
.invoice-print-meta .stamp { margin-top: 4px; }

.invoice-print-billto { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 20px; }
.invoice-print-billto-icon {
  width: 30px; height: 30px; border-radius: 50%; background: var(--inv-navy); color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.invoice-print-billto strong { font-size: 13px; letter-spacing: 0.03em; display: block; }
.invoice-print-billto p { margin: 3px 0 0; font-size: 13px; color: var(--inv-navy); }

.invoice-print-table { width: 100%; border-collapse: collapse; margin-bottom: 0; border-radius: 10px 10px 0 0; overflow: hidden; }
.invoice-print-table th {
  text-align: left; font-size: 12px; font-weight: 700; color: #fff; background: var(--inv-blue);
  padding: 12px 14px;
}
.invoice-print-table th:nth-child(2), .invoice-print-table th:nth-child(3), .invoice-print-table th:nth-child(4),
.invoice-print-table td:nth-child(2), .invoice-print-table td:nth-child(3), .invoice-print-table td:nth-child(4) { text-align: right; }
.invoice-print-table td { padding: 14px; font-size: 13px; background: var(--inv-navy); color: #fff; border-bottom: 1px solid rgba(255,255,255,0.12); }
.invoice-print-table tbody tr:last-child td { border-bottom: none; }

.invoice-print-totals { margin-left: auto; width: 62%; min-width: 260px; border-radius: 0 0 10px 10px; overflow: hidden; margin-bottom: 20px; }
.invoice-print-totals-row {
  display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;
  font-size: 13px; font-weight: 700; background: var(--inv-blue); color: #fff;
  border-bottom: 1px solid rgba(255,255,255,0.25);
}
.invoice-print-totals-final { background: var(--inv-navy); font-size: 14px; border-bottom: none; }

.invoice-print-payment { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 22px; }
.invoice-print-payment-icon {
  width: 30px; height: 30px; border-radius: 50%; background: var(--inv-navy); color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.invoice-print-payment strong { font-size: 13px; display: block; }
.invoice-print-payment p { margin: 3px 0 0; font-size: 12.5px; color: var(--inv-blue); font-weight: 600; }

.invoice-print-thanks { margin: 26px 0 18px; }
.invoice-print-thanks h4 { font-size: 19px; font-weight: 800; margin: 0; }
.invoice-print-thanks p { margin: 6px 0 0; font-size: 12.5px; font-weight: 600; color: var(--inv-blue); }

.invoice-print-footer {
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px;
  padding-top: 14px; border-top: 1px solid rgba(11,17,48,0.15); font-size: 11.5px; font-weight: 700;
}
.invoice-print-footer span { display: flex; align-items: center; gap: 5px; }
.invoice-print-fineprint { margin: 10px 0 0; font-size: 10.5px; color: var(--inv-muted); text-align: center; }

/* modal */
.modal-veil {
  position: fixed; inset: 0; background: rgba(23,24,28,0.5); display: flex; align-items: center; justify-content: center;
  padding: 20px; z-index: 50; animation: veilFadeIn 0.15s ease;
}
.modal-sheet { background: var(--paper); border-radius: 10px; width: 440px; max-width: 100%; max-height: 88vh; overflow-y: auto; overflow-x: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.25); animation: sheetPopIn 0.18s cubic-bezier(0.2, 0.8, 0.3, 1); }
.modal-wide { width: 620px; }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--rule); position: sticky; top: 0; background: var(--paper); }
.modal-head h3 { font-size: 16px; }
.modal-body { padding: 18px 20px 22px; }
@keyframes veilFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes sheetPopIn { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }

/* ledger table (invoices) */
.table-wrap { background: var(--paper-raised); border: 1px solid var(--rule); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 24px -20px rgba(22,41,77,0.3); }
.ledger { width: 100%; border-collapse: collapse; }
.ledger th {
  text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted);
  padding: 10px 14px; border-bottom: 1px solid var(--rule); background: var(--paper-dim);
}
.ledger td { padding: 11px 14px; border-bottom: 1px solid var(--paper-dim); font-size: 13px; position: relative; }
.ledger tr:last-child td { border-bottom: none; }
.mono-cell { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }

@media (max-width: 980px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
  .panel-grid { grid-template-columns: 1fr; }
  .board { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .hamburger-btn { display: inline-flex; }
  .sidebar {
    position: fixed; top: 0; left: 0; height: 100vh; z-index: 45;
    transform: translateX(-104%); transition: transform 0.22s ease;
    box-shadow: 12px 0 30px rgba(0,0,0,0.18);
    width: 232px;
    border-radius: 0 20px 20px 0;
  }
  .main { border-radius: 0; height: 100vh; }
  .studio-ops { padding: 0; gap: 0; }
  .sidebar-open { transform: translateX(0); }
  .nav-veil { position: fixed; inset: 0; background: rgba(23,24,28,0.45); z-index: 44; }
  .board { grid-template-columns: 1fr; }
  .field-row { flex-direction: column; gap: 14px; }
  .stat-grid { grid-template-columns: 1fr 1fr; }
  .toolbar { flex-wrap: wrap; }
  .search-box { max-width: none; }

  /* topbar + page padding */
  .topbar { padding: 16px 16px 14px; flex-wrap: wrap; row-gap: 10px; }
  .topbar h1 { font-size: 19px; }
  .topbar p { font-size: 12px; }
  .topbar-right { width: 100%; justify-content: space-between; }
  .main-scroll { padding: 18px 16px 44px; }
  .conn-warning, .trial-banner { padding: 8px 16px; }
  .view { gap: 16px; }

  /* tickets */
  .ticket-grid { grid-template-columns: 1fr; }
  .ticket-foot { flex-wrap: wrap; gap: 8px; }

  /* tables scroll horizontally instead of squeezing */
  .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .ledger { min-width: 620px; }

  /* invoice line items + summary strips */
  .line-items-head, .line-item-row { grid-template-columns: 1fr 52px 82px 26px; gap: 6px; }
  .expense-summary { flex-wrap: wrap; row-gap: 10px; column-gap: 20px; }
  .expense-add-row { grid-template-columns: 1fr; }

  /* modal + printable invoice */
  .modal-sheet { max-height: 92vh; }
  .modal-head { padding: 14px 16px; }
  .modal-body { padding: 14px 16px 18px; }
  .invoice-preview-actions { gap: 8px; }

  /* client portal */
  .portal-view-head { flex-direction: column; }
  .portal-shell-view { padding: 24px 14px; }
}

@media (max-width: 420px) {
  .stat-grid { grid-template-columns: 1fr; }
  .stat-value { font-size: 22px; }
  .line-items-head, .line-item-row { grid-template-columns: 1fr 46px 68px 24px; }
}

/* portal code + sidebar entry */
.mono-input { font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.04em; }
.portal-code-row { display: flex; gap: 8px; align-items: center; }
.portal-code-row input { flex: 1; }
.field-hint { font-size: 11px; color: var(--muted); }
.field-hint-error { color: var(--red); }

.settings-section-title { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.settings-section-title-spaced { margin-top: 6px; padding-top: 16px; border-top: 1px solid var(--rule); }
.color-field-row { display: flex; align-items: center; gap: 8px; }
.color-swatch-input {
  -webkit-appearance: none; appearance: none; width: 34px; height: 34px; flex-shrink: 0;
  padding: 0; border: 1.5px solid var(--rule); border-radius: 6px; background: none; cursor: pointer;
}
.color-swatch-input::-webkit-color-swatch-wrapper { padding: 2px; }
.color-swatch-input::-webkit-color-swatch { border: none; border-radius: 4px; }
.color-swatch-input::-moz-color-swatch { border: none; border-radius: 4px; }
.appearance-reset-btn { align-self: flex-start; margin-top: -6px; }
.logo-upload-row { display: flex; align-items: center; gap: 12px; }
.logo-upload-preview {
  width: 72px; height: 72px; border-radius: 8px; border: 1.5px dashed var(--rule); background: var(--paper-raised);
  display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;
}
.logo-upload-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
.logo-upload-placeholder { font-size: 10px; color: var(--muted); text-align: center; }
.logo-upload-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.logo-upload-btn { cursor: pointer; }
.portal-code-chip {
  display: inline-flex; align-items: center; gap: 4px; font-family: 'IBM Plex Mono', monospace;
  font-size: 10.5px; color: var(--muted); letter-spacing: 0.03em;
  background: transparent; border: none; padding: 3px 0; cursor: pointer; transition: color 0.15s ease;
}
.portal-code-chip:hover:not(:disabled) { color: var(--ink); }
.portal-code-chip:disabled { cursor: default; opacity: 0.6; }
.portal-code-chip svg:last-child { opacity: 0.5; }
.portal-entry-btn {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 10px; margin-bottom: 10px;
  border-radius: 10px; border: 1px dashed var(--rule); background: transparent; color: var(--muted);
  font-size: 12.5px; font-weight: 600;
}
.portal-entry-btn:hover { background: var(--paper-dim); border-style: solid; color: var(--ink); }

/* file manager */
.file-manager { display: flex; flex-direction: column; gap: 12px; }
.upload-drop {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  border: 1.5px dashed var(--rule); border-radius: 8px; padding: 22px; text-align: center; color: var(--muted);
  cursor: pointer; background: var(--paper-raised);
}
.upload-drop:hover { border-color: var(--ink); color: var(--ink); }
.upload-drop span { font-size: 13px; font-weight: 600; }
.upload-drop em { font-style: normal; font-size: 11px; }
.file-error { display: flex; align-items: center; gap: 6px; color: var(--red); font-size: 12px; margin: 0; }
.file-success { display: flex; align-items: center; gap: 6px; color: var(--green); font-size: 12px; margin: 0; }
.auth-shared-note { display: flex; align-items: center; gap: 6px; text-align: left; }
.file-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.file-list li {
  display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid var(--rule);
  border-radius: 6px; background: var(--paper-raised); color: var(--muted); position: relative;
}
.file-list-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.file-list-info strong { font-size: 12.5px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-list-info span { font-size: 11px; font-family: 'IBM Plex Mono', monospace; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* client portal */
.portal-shell {
  width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 24px; position: relative; overflow: hidden;
  background: linear-gradient(160deg, #FCEEE1 0%, #F4F7FB 32%, #ECE7FB 68%, #E1F5EC 100%);
}
.portal-shell::before, .portal-shell::after {
  content: ""; position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.55; z-index: 0;
}
.portal-shell::before { width: 360px; height: 360px; background: #F6D9AE; top: -120px; left: -100px; }
.portal-shell::after { width: 320px; height: 320px; background: #BFE9DD; bottom: -110px; right: -90px; }
.portal-shell-view { align-items: flex-start; padding: 40px 20px; }
.portal-gate {
  background: var(--paper-raised); border: none; border-radius: 26px; padding: 38px 32px;
  box-shadow: 0 24px 60px -24px rgba(22,41,77,0.35);
  width: 380px; max-width: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px;
  position: relative; z-index: 1;
}
.portal-badge {
  width: 52px; height: 52px; border-radius: 50%; border: none; color: var(--red); background: #FBE7EA;
  display: flex; align-items: center; justify-content: center; transform: rotate(-4deg); margin-bottom: 4px;
}
.portal-gate h1 { font-size: 21px; }
.portal-gate p { font-size: 12.5px; color: var(--muted); margin: 0 0 6px; line-height: 1.5; }
.portal-gate-form { display: flex; flex-direction: column; gap: 10px; width: 100%; }
.portal-code-input { text-align: center; font-size: 15px; padding: 11px; }
.portal-back { margin-top: 6px; }

.portal-view { width: 100%; max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
.portal-view-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.portal-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
.portal-view-head h1 { font-size: 24px; margin-top: 2px; }
.portal-status-row { display: flex; align-items: center; gap: 12px; }
.portal-deadline { font-size: 12.5px; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }
.portal-desc { font-size: 13px; color: var(--ink); line-height: 1.6; background: var(--paper-raised); border: 1px solid var(--rule); border-radius: 8px; padding: 14px 16px; }
.portal-progress-card { background: var(--paper-raised); border: 1px solid var(--rule); border-radius: 8px; padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
.portal-progress-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; font-weight: 600; }
.portal-progress-head strong { font-family: 'Fraunces', serif; font-size: 20px; }
.portal-progress-track { margin-top: 2px; height: 8px; }
.portal-milestones h3, .portal-files h3 { font-size: 15px; margin-bottom: 8px; }
.portal-milestones, .portal-files { background: var(--paper-raised); border: 1px solid var(--rule); border-radius: 8px; padding: 16px 18px; }

/* toast notifications */
.toast-host {
  position: fixed; bottom: 20px; right: 20px; z-index: 80;
  display: flex; flex-direction: column-reverse; gap: 8px; max-width: 320px;
}
.toast {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 7px;
  font-size: 12.5px; font-weight: 500; background: var(--ink); color: var(--paper);
  box-shadow: 0 10px 24px rgba(0,0,0,0.2); cursor: pointer; animation: toastIn 0.2s ease;
}
.toast-error { background: var(--red); color: #fff; }
.toast svg { flex-shrink: 0; }
.toast-action {
  margin-left: 4px; padding: 3px 9px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.35);
  background: transparent; color: inherit; font-size: 11.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.03em; cursor: pointer; flex-shrink: 0;
}
.toast-action:hover { background: rgba(255,255,255,0.15); }
@keyframes toastIn { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@media (max-width: 720px) {
  .toast-host { left: 16px; right: 16px; bottom: 16px; max-width: none; }
}

/* mini bar chart */
.mini-chart { width: 100%; }
.mini-chart-bars { display: flex; align-items: flex-end; height: 100%; gap: 6px; padding-top: 18px; }
.mini-chart-col { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 4px; }
.mini-chart-value { font-size: 10px; font-family: 'IBM Plex Mono', monospace; color: var(--muted); }
.mini-chart-bar { width: 60%; border-radius: 3px 3px 0 0; min-height: 2px; transition: height 0.3s ease; }
.mini-chart-label { font-size: 10px; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }

/* expense manager */
.expense-summary { display: flex; gap: 22px; padding: 12px 14px; background: var(--paper-dim); border-radius: 7px; margin-bottom: 16px; }
.expense-summary > div { display: flex; flex-direction: column; gap: 2px; }
.expense-summary strong { font-family: 'Fraunces', serif; font-size: 17px; }
.expense-add-row { grid-template-columns: 1fr 110px 140px 34px; margin-bottom: 14px; }

/* time view */
.week-nav { display: flex; align-items: center; gap: 8px; }
.week-range { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--ink); min-width: 170px; text-align: center; }
.week-total { display: flex; align-items: center; gap: 6px; margin-left: auto; font-size: 12.5px; color: var(--muted); font-weight: 600; }
.time-log-form { align-items: center; }
.time-log-form select, .time-log-form input { flex: 1; }
.time-log-form input[type="number"] { max-width: 90px; }
.time-log-form input[type="date"] { max-width: 150px; }

/* global search */
.search-sheet { width: 560px; max-width: 100%; max-height: 70vh; display: flex; flex-direction: column; }
.search-input-row { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--rule); color: var(--muted); flex-shrink: 0; }
.search-input-row input { border: none; background: transparent; font-size: 15px; padding: 4px 0; }
.search-input-row input:focus { border: none; }
.search-results { overflow-y: auto; padding: 10px 8px 16px; }
.search-hint { padding: 20px 16px; text-align: center; }
.search-group { margin-bottom: 10px; }
.search-group-label {
  display: flex; align-items: center; gap: 6px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--muted); padding: 6px 10px 4px;
}
.search-result-row {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 6px;
  background: transparent; border: none; text-align: left; font-size: 13px; color: var(--ink);
}
.search-result-row:hover { background: var(--paper-dim); }
.search-result-row span:first-child { font-weight: 600; }
.search-result-row span:nth-child(2) { flex: 1; }
.search-result-row svg { color: var(--muted); flex-shrink: 0; }

@media (max-width: 720px) {
  .expense-add-row { grid-template-columns: 1fr; gap: 6px; }
  .time-log-form { flex-direction: column; align-items: stretch; }
  .time-log-form input[type="number"], .time-log-form input[type="date"] { max-width: none; }
  .week-total { margin-left: 0; }
  .search-sheet { width: 100%; }
  .topbar-right { gap: 8px; }
  .search-trigger span { display: none; }
  .search-trigger em { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .studio-ops * { transition: none !important; animation: none !important; }
}
`;
