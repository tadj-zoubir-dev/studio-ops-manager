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
  Printer,
  Eye,
  Sparkles,
  ListPlus,
  Building,
  Mail,
  Lock,
} from "lucide-react";
import { supabase, FILES_BUCKET } from "./supabaseClient.js";

/* ============================================================
   STUDIO OPS — a job-ticket / traffic-sheet ERP for a creative
   agency. Single-manager build: there is exactly one login (the
   manager's — created directly in the Supabase dashboard, no
   self-service signup in this app). Everything else on the team
   works without an account. No billing, no per-account data
   isolation. The client portal still reads through narrow,
   curated RPC functions rather than touching the shared data
   directly. See supabase/schema.sql for exactly what each
   policy allows.
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
  invoiceNote: "Thank you for the opportunity — payment is due by the date above.",
};

const emptyData = () => ({
  clients: [],
  projects: [],
  tasks: [],
  invoices: [],
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
    ],
    jobCounter: 1004,
    settings: {
      studioName: "Studio Ops",
      tagline: "Creative agency, Algiers",
      address: "14 Rue des Frères Bouadou, Algiers, Algeria",
      email: "hello@studioops.dz",
      phone: "+213 21 44 55 66",
      taxId: "",
      invoiceNote: "Thank you for the opportunity — payment is due by the date above.",
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

const STATE_ROW_ID = "team";
// One shared erp_state row for the whole team. supabase/schema.sql
// restricts read/write on this row to signed-in (authenticated) users
// only — there's no per-user data split, because everyone on the team
// is meant to see the same clients, projects, tasks, and invoices.

function useStudioData(ready) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      setStatus("loading");
      try {
        const { data: row, error } = await supabase
          .from("erp_state")
          .select("data")
          .eq("id", STATE_ROW_ID)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (row?.data) {
          setData({ ...row.data, settings: { ...DEFAULT_SETTINGS, ...(row.data.settings || {}) } });
        } else {
          const seed = seedData();
          setData(seed);
          const { error: insertError } = await supabase.from("erp_state").insert({ id: STATE_ROW_ID, data: seed });
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
  }, [ready]);

  const persist = useCallback(async (next) => {
    setData(next);
    try {
      const { error } = await supabase
        .from("erp_state")
        .upsert({ id: STATE_ROW_ID, data: next, updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch (e) {
      console.error("Storage save failed", e);
    }
  }, []);

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

function ToastHost({ toasts, onDismiss }) {
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => onDismiss(t.id)}>
          {t.type === "error" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          <span>{t.message}</span>
        </div>
      ))}
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

function ConfirmDelete({ label, onConfirm, onCancel }) {
  return (
    <div className="confirm-row">
      <span>
        <AlertTriangle size={14} /> Delete {label}? This can't be undone.
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
   per project. Studio side reads/writes the project_files table
   directly (RLS restricts that to signed-in team members). The portal
   (readOnly) can't touch that table at all — it goes through the
   get_portal_files() RPC instead, the only file listing anonymous
   visitors are allowed to call. See supabase/schema.sql. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB per file

function FileManager({ projectId, onCountChange, readOnly, portalCode }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
        const storagePath = `${projectId}/${fileId}-${f.name}`;
        const { error: uploadError } = await supabase.storage
          .from(FILES_BUCKET)
          .upload(storagePath, f, { upsert: false, contentType: f.type || "application/octet-stream" });
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from("project_files").insert({
          id: fileId,
          project_id: projectId,
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
      {!readOnly && (
        <label className="upload-drop">
          <Upload size={16} />
          <span>{busy ? "Uploading…" : "Click to upload files"}</span>
          <em>Up to {fmtBytes(MAX_UPLOAD_BYTES)} per file</em>
          <input type="file" multiple hidden onChange={handleUpload} disabled={busy} />
        </label>
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
              {!readOnly && (
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
function StudioSettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState(settings);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title="Studio settings" onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
      >
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
        <Field label="Default invoice note">
          <textarea rows={2} value={form.invoiceNote} onChange={set("invoiceNote")} />
        </Field>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save settings</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------- auth screen ---------------------- */
function AuthScreen({ onOpenPortal }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
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
        <h1>Sign in</h1>
        <p>Welcome back to Studio Ops.</p>
        <form onSubmit={submit} className="portal-gate-form">
          <div className="auth-input-row">
            <Mail size={14} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" required autoFocus />
          </div>
          <div className="auth-input-row">
            <Lock size={14} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength={6} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {error && <p className="file-error"><AlertTriangle size={12} /> {error}</p>}
        <button className="link-btn portal-back" onClick={onOpenPortal}>
          <KeyRound size={13} /> I'm a client — open the project portal
        </button>
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
  { key: "invoices", label: "Invoices", icon: Receipt },
];

function Sidebar({ view, setView, counts, onOpenPortal, onOpenSettings, onSignOut, navOpen }) {
  return (
    <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
      <div className="brand">
        <div className="brand-mark">SO</div>
        <div className="brand-word">
          <strong>STUDIO OPS</strong>
          <span>traffic &amp; production</span>
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
    const openTasks = data.tasks.filter((t) => t.status !== "done").length;
    const overdueTasks = data.tasks.filter((t) => t.status !== "done" && isOverdue(t.dueDate)).length;
    const outstanding = data.invoices
      .filter((i) => i.status === "sent" || i.status === "overdue")
      .reduce((sum, i) => sum + i.items.reduce((s, it) => s + it.qty * it.rate, 0), 0);
    const paidThisPeriod = data.invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.items.reduce((s, it) => s + it.qty * it.rate, 0), 0);
    return { activeProjects, openTasks, overdueTasks, outstanding, paidThisPeriod };
  }, [data]);

  const clientName = (id) => data.clients.find((c) => c.id === id)?.company || "—";

  const upcoming = [...data.tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, 5);

  const recentInvoices = [...data.invoices]
    .sort((a, b) => b.number.localeCompare(a.number))
    .slice(0, 5);

  return (
    <div className="view">
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Active projects</span>
          <strong className="stat-value">{stats.activeProjects}</strong>
          <span className="stat-sub">of {data.projects.length} total</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Open tasks</span>
          <strong className="stat-value">{stats.openTasks}</strong>
          <span className={`stat-sub ${stats.overdueTasks ? "stat-sub-warn" : ""}`}>
            {stats.overdueTasks} overdue
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Outstanding</span>
          <strong className="stat-value">{fmtMoney(stats.outstanding)}</strong>
          <span className="stat-sub">across open invoices</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Collected</span>
          <strong className="stat-value">{fmtMoney(stats.paidThisPeriod)}</strong>
          <span className="stat-sub">marked paid</span>
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

  const projectCount = (clientId) => data.projects.filter((p) => p.clientId === clientId).length;
  const outstandingFor = (clientId) =>
    data.invoices
      .filter((i) => i.clientId === clientId && (i.status === "sent" || i.status === "overdue"))
      .reduce((sum, i) => sum + i.items.reduce((s, it) => s + it.qty * it.rate, 0), 0);

  const filtered = data.clients.filter((c) =>
    `${c.name} ${c.company} ${c.email}`.toLowerCase().includes(query.toLowerCase())
  );

  const saveClient = (form) => {
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
        <button className="btn btn-primary" onClick={() => setModal({ mode: "new" })}>
          <Plus size={15} /> New client
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={data.clients.length ? "No matches" : "No clients yet"}
          hint={data.clients.length ? "Try a different search." : "Add the first client to open a ledger for them."}
          actionLabel={data.clients.length ? null : "New client"}
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
                  <button className="icon-btn" onClick={() => setModal({ mode: "edit", client: c })}>
                    <Pencil size={14} />
                  </button>
                  <button className="icon-btn icon-btn-danger" onClick={() => setConfirmId(c.id)}>
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

function ProjectsView({ data, mutate }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [filesFor, setFilesFor] = useState(null);
  const toast = useToast();

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
        <button className="btn btn-primary" onClick={() => setModal({ mode: "new" })} disabled={data.clients.length === 0}>
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
          actionLabel={data.projects.length || data.clients.length === 0 ? null : "New project"}
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
                    <button className="icon-btn" onClick={() => setFilesFor(p)} title="Project files">
                      <FolderOpen size={14} />
                    </button>
                    <button className="icon-btn" onClick={() => setModal({ mode: "edit", project: p })}>
                      <Pencil size={14} />
                    </button>
                    <button className="icon-btn icon-btn-danger" onClick={() => setConfirmId(p.id)}>
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
            onCountChange={(count) =>
              mutate({
                ...data,
                projects: data.projects.map((pr) => (pr.id === filesFor.id ? { ...pr, fileCount: count } : pr)),
              })
            }
          />
        </Modal>
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

const TASK_COLUMNS = ["todo", "in-progress", "review", "done"];
const TASK_COLUMN_ICON = { todo: Circle, "in-progress": CircleDot, review: CircleDot, done: CircleCheck };

function TasksView({ data, mutate }) {
  const [modal, setModal] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [dragOverCol, setDragOverCol] = useState(null);
  const toast = useToast();

  const projectName = (id) => data.projects.find((p) => p.id === id)?.name || "Unassigned";

  const visibleTasks = data.tasks.filter((t) => projectFilter === "all" || t.projectId === projectFilter);

  const saveTask = (form) => {
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
    const t = data.tasks.find((x) => x.id === id);
    mutate({ ...data, tasks: data.tasks.filter((t) => t.id !== id) });
    setConfirmId(null);
    toast(`${t?.title || "Task"} deleted`);
  };

  const moveTask = (task, status) => {
    if (task.status === status) return;
    mutate({ ...data, tasks: data.tasks.map((t) => (t.id === task.id ? { ...t, status } : t)) });
    toast(`Moved to ${TASK_STATUS[status]?.label}`);
  };

  const handleDrop = (col) => (e) => {
    e.preventDefault();
    setDragOverCol(null);
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
        <button className="btn btn-primary" onClick={() => setModal({ mode: "new" })} disabled={data.projects.length === 0}>
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
          actionLabel={data.tasks.length || data.projects.length === 0 ? null : "New task"}
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
                      className="task-card"
                      key={t.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", t.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <div className="task-card-top">
                        <div className="task-card-top-left">
                          <GripVertical size={13} className="drag-handle" />
                          <Stamp label={TASK_PRIORITY[t.priority]?.label} color={TASK_PRIORITY[t.priority]?.color} size="sm" />
                        </div>
                        <div className="ticket-actions">
                          <button className="icon-btn" onClick={() => setModal({ mode: "edit", task: t })}>
                            <Pencil size={12} />
                          </button>
                          <button className="icon-btn icon-btn-danger" onClick={() => setConfirmId(t.id)}>
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
function InvoicePrintable({ invoice, client, project, settings }) {
  const total = invoice.items.reduce((s, it) => s + it.qty * it.rate, 0);
  return (
    <div className="invoice-print">
      <div className="invoice-print-head">
        <div>
          <h2>{settings.studioName}</h2>
          {settings.tagline && <p>{settings.tagline}</p>}
          {settings.address && <p>{settings.address}</p>}
          {(settings.email || settings.phone) && (
            <p>{[settings.email, settings.phone].filter(Boolean).join(" · ")}</p>
          )}
          {settings.taxId && <p>Tax ID: {settings.taxId}</p>}
        </div>
        <div className="invoice-print-meta">
          <h3>INVOICE</h3>
          <p className="mono-cell">#{invoice.number}</p>
          <Stamp label={INVOICE_STATUS[invoice.status]?.label || invoice.status} color={INVOICE_STATUS[invoice.status]?.color} />
        </div>
      </div>

      <div className="invoice-print-parties">
        <div>
          <span className="field-label">Billed to</span>
          <strong>{client?.company || "—"}</strong>
          {client?.name && <p>{client.name}</p>}
          {client?.email && <p>{client.email}</p>}
          {client?.phone && <p>{client.phone}</p>}
        </div>
        <div>
          <span className="field-label">Details</span>
          <p>Issued: {fmtDate(invoice.issueDate)}</p>
          <p>Due: {fmtDate(invoice.dueDate)}</p>
          {project && <p>Project: {project.name}</p>}
        </div>
      </div>

      <table className="invoice-print-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={i}>
              <td>{it.desc}</td>
              <td>{it.qty}</td>
              <td>{fmtMoney(it.rate)}</td>
              <td>{fmtMoney(it.qty * it.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-print-total">
        <span>Total due</span>
        <strong>{fmtMoney(total)}</strong>
      </div>

      {settings.invoiceNote && <p className="invoice-print-note">{settings.invoiceNote}</p>}
    </div>
  );
}

function InvoicePreviewModal({ invoice, client, project, settings, onClose }) {
  return (
    <Modal title={`Invoice #${invoice.number}`} onClose={onClose} wide>
      <div className="invoice-preview-actions no-print">
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={14} /> Download / Print PDF
        </button>
        <span className="field-hint">Opens your browser's print dialog — choose "Save as PDF" as the destination.</span>
      </div>
      <div className="invoice-print-frame">
        <InvoicePrintable invoice={invoice} client={client} project={project} settings={settings} />
      </div>
    </Modal>
  );
}

function InvoicesView({ data, mutate }) {
  const [modal, setModal] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [previewFor, setPreviewFor] = useState(null);
  const toast = useToast();

  const clientOf = (id) => data.clients.find((c) => c.id === id);
  const clientName = (id) => clientOf(id)?.company || "Unassigned";
  const invoiceTotal = (inv) => inv.items.reduce((s, it) => s + it.qty * it.rate, 0);

  const effectiveStatus = (inv) =>
    inv.status === "sent" && isOverdue(inv.dueDate) ? "overdue" : inv.status;

  const filtered = data.invoices.filter((inv) => statusFilter === "all" || effectiveStatus(inv) === statusFilter);

  const saveInvoice = (form) => {
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
    const inv = data.invoices.find((x) => x.id === id);
    mutate({ ...data, invoices: data.invoices.filter((i) => i.id !== id) });
    setConfirmId(null);
    toast(`Invoice #${inv?.number || ""} deleted`);
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
          disabled={data.clients.length === 0}
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
          actionLabel={data.invoices.length || data.clients.length === 0 ? null : "New invoice"}
          onAction={() => setModal({ mode: "new" })}
        />
      ) : (
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
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
                <tr key={inv.id}>
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
                      <button className="icon-btn" onClick={() => setModal({ mode: "edit", invoice: inv })}>
                        <Pencil size={14} />
                      </button>
                      <button className="icon-btn icon-btn-danger" onClick={() => setConfirmId(inv.id)}>
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
  invoices: { title: "Invoices", sub: "Billing and collections" },
};

export default function StudioOpsERP() {
  const session = useAuth(); // undefined = loading, null = signed out, object = signed in
  const [data, mutate, dataStatus] = useStudioData(!!session);

  const [view, setView] = useState("dashboard");
  const [mode, setMode] = useState("studio"); // "studio" | "portal-gate" | "portal-view"
  const [portalCode, setPortalCode] = useState(null);
  const [portalResult, setPortalResult] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [navOpen, setNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const pushToast = useCallback((message, type = "success") => {
    const id = uid("toast");
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

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

  return (
    <ToastContext.Provider value={pushToast}>
      <div className="studio-ops">
        <style>{CSS}</style>
        {navOpen && <div className="nav-veil" onClick={() => setNavOpen(false)} />}
        <Sidebar
          view={view}
          setView={goTo}
          counts={counts}
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
                <h1>{VIEW_TITLES[view].title}</h1>
                <p>{VIEW_TITLES[view].sub}</p>
              </div>
            </div>
            <div className="topbar-date">{fmtDate(todayISO())}</div>
          </header>

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
              {view === "projects" && <ProjectsView data={data} mutate={mutate} />}
              {view === "tasks" && <TasksView data={data} mutate={mutate} />}
              {view === "invoices" && <InvoicesView data={data} mutate={mutate} />}
            </div>
          </div>
        </main>
        {settingsOpen && (
          <StudioSettingsModal
            settings={data.settings || DEFAULT_SETTINGS}
            onClose={() => setSettingsOpen(false)}
            onSave={(settings) => {
              mutate({ ...data, settings });
              setSettingsOpen(false);
              pushToast("Studio settings saved");
            }}
          />
        )}
        <ToastHost toasts={toasts} onDismiss={dismissToast} />
      </div>
    </ToastContext.Provider>
  );
}

/* ============================================================
   styles — paper ledger + rubber-stamp system
   ============================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.studio-ops {
  --ink: #17181C;
  --paper: #F6F5F1;
  --paper-raised: #FFFFFF;
  --paper-dim: #ECEAE3;
  --rule: #DCD9CF;
  --muted: #7A7768;
  --red: #C4293C;
  --green: #2F6B4F;
  --amber: #B0721E;
  --blue: #3457A6;
  --violet: #6B4FA0;

  display: flex;
  width: 100%;
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Inter', sans-serif;
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
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  background: var(--paper-raised);
  border: 1.5px solid var(--rule);
  border-radius: 3px;
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
  width: 232px; flex-shrink: 0; background: var(--ink); color: var(--paper);
  display: flex; flex-direction: column; padding: 22px 16px;
  position: sticky; top: 0; height: 100vh;
}
.brand { display: flex; align-items: center; gap: 10px; padding: 0 6px 22px; border-bottom: 1px solid rgba(246,245,241,0.14); margin-bottom: 18px; }
.brand-mark {
  width: 34px; height: 34px; border: 2px solid var(--red); border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Fraunces', serif; font-weight: 700; font-size: 13px; color: #fff;
  flex-shrink: 0;
}
.brand-word { display: flex; flex-direction: column; line-height: 1.25; }
.brand-word strong { font-family: 'Fraunces', serif; font-size: 15px; letter-spacing: 0.02em; }
.brand-word span { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(246,245,241,0.5); }

.nav { display: flex; flex-direction: column; gap: 2px; }
.nav-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 5px;
  background: transparent; border: none; color: rgba(246,245,241,0.72); text-align: left; font-size: 13px;
  font-weight: 500;
}
.nav-item span { flex: 1; }
.nav-item em { font-style: normal; font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: rgba(246,245,241,0.45); }
.nav-item:hover { background: rgba(246,245,241,0.06); color: #fff; }
.nav-item-active { background: rgba(196,41,60,0.18); color: #fff; }
.nav-item-active em { color: var(--red); }

.sidebar-foot { margin-top: auto; padding-top: 16px; }
.ticket-mini {
  border: 1px dashed rgba(246,245,241,0.25); border-radius: 6px; padding: 12px;
}
.ticket-mini span { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.1em; color: var(--red); }
.ticket-mini p { margin: 6px 0 0; font-size: 11.5px; color: rgba(246,245,241,0.55); line-height: 1.5; }

/* main */
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100vh; overflow: hidden; }
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
.conn-warning {
  display: flex; align-items: center; gap: 8px; background: #FCEEEF; color: var(--red);
  border-bottom: 1px solid var(--red); font-size: 12px; padding: 8px 34px; flex-shrink: 0;
}
.conn-warning-soft { background: #FBF3E6; color: var(--amber); border-bottom-color: var(--amber); }
.conn-warning .link-btn { margin-left: auto; color: inherit; text-decoration: underline; font-weight: 700; flex-shrink: 0; }

/* auth screen */
.auth-input-row {
  display: flex; align-items: center; gap: 8px; border: 1.5px solid var(--rule); border-radius: 5px;
  padding: 0 10px; background: var(--paper-raised); color: var(--muted);
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
.panel { background: var(--paper-raised); border: 1px solid var(--rule); border-radius: 8px; padding: 16px 18px; }
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
  display: inline-flex; align-items: center; gap: 6px; border-radius: 5px; padding: 8px 14px;
  font-size: 13px; font-weight: 600; border: 1.5px solid transparent;
  transition: background 0.15s ease, transform 0.1s ease, border-color 0.15s ease;
}
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn-primary { background: var(--ink); color: var(--paper); }
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
.invoice-print-frame { background: #fff; border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; }
.invoice-print { padding: 32px 34px; background: #fff; color: var(--ink); font-family: 'Inter', sans-serif; }
.invoice-print-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding-bottom: 18px; border-bottom: 2px solid var(--ink); margin-bottom: 20px; }
.invoice-print-head h2 { font-size: 19px; }
.invoice-print-head p { margin: 2px 0 0; font-size: 11.5px; color: var(--muted); }
.invoice-print-meta { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.invoice-print-meta h3 { font-size: 15px; letter-spacing: 0.08em; }
.invoice-print-meta p { margin: 0; font-size: 12px; color: var(--muted); }
.invoice-print-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 22px; }
.invoice-print-parties .field-label { display: block; margin-bottom: 4px; }
.invoice-print-parties strong { font-size: 14px; }
.invoice-print-parties p { margin: 2px 0 0; font-size: 12.5px; color: var(--ink); }
.invoice-print-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
.invoice-print-table th {
  text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted);
  padding: 8px 6px; border-bottom: 1.5px solid var(--ink);
}
.invoice-print-table th:nth-child(2), .invoice-print-table th:nth-child(3), .invoice-print-table th:nth-child(4),
.invoice-print-table td:nth-child(2), .invoice-print-table td:nth-child(3), .invoice-print-table td:nth-child(4) { text-align: right; }
.invoice-print-table td { padding: 9px 6px; font-size: 13px; border-bottom: 1px solid var(--paper-dim); }
.invoice-print-total { display: flex; justify-content: flex-end; align-items: baseline; gap: 10px; padding: 14px 6px; border-top: 2px solid var(--ink); font-family: 'Fraunces', serif; }
.invoice-print-total strong { font-size: 20px; }
.invoice-print-note { margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--rule); font-size: 12px; color: var(--muted); line-height: 1.6; }

@media print {
  .no-print { display: none !important; }
  body * { visibility: hidden; }
  .invoice-print, .invoice-print * { visibility: visible; }
  .invoice-print { position: fixed; top: 0; left: 0; width: 100%; margin: 0; box-shadow: none; }
  @page { margin: 14mm; }
}

/* modal */
.modal-veil {
  position: fixed; inset: 0; background: rgba(23,24,28,0.5); display: flex; align-items: center; justify-content: center;
  padding: 20px; z-index: 50; animation: veilFadeIn 0.15s ease;
}
.modal-sheet { background: var(--paper); border-radius: 10px; width: 440px; max-width: 100%; max-height: 88vh; overflow-y: auto; box-shadow: 0 20px 50px rgba(0,0,0,0.25); animation: sheetPopIn 0.18s cubic-bezier(0.2, 0.8, 0.3, 1); }
.modal-wide { width: 620px; }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--rule); position: sticky; top: 0; background: var(--paper); }
.modal-head h3 { font-size: 16px; }
.modal-body { padding: 18px 20px 22px; }
@keyframes veilFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes sheetPopIn { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }

/* ledger table (invoices) */
.table-wrap { background: var(--paper-raised); border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; }
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
  }
  .sidebar-open { transform: translateX(0); }
  .nav-veil { position: fixed; inset: 0; background: rgba(23,24,28,0.45); z-index: 44; }
  .board { grid-template-columns: 1fr; }
  .field-row { flex-direction: column; }
  .stat-grid { grid-template-columns: 1fr 1fr; }
  .toolbar { flex-wrap: wrap; }
  .search-box { max-width: none; }
}

/* portal code + sidebar entry */
.mono-input { font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.04em; }
.portal-code-row { display: flex; gap: 8px; align-items: center; }
.portal-code-row input { flex: 1; }
.field-hint { font-size: 11px; color: var(--muted); }
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
  border-radius: 5px; border: 1px dashed rgba(246,245,241,0.3); background: transparent; color: rgba(246,245,241,0.85);
  font-size: 12.5px; font-weight: 600;
}
.portal-entry-btn:hover { background: rgba(246,245,241,0.08); border-style: solid; }

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
.file-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.file-list li {
  display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid var(--rule);
  border-radius: 6px; background: var(--paper-raised); color: var(--muted);
}
.file-list-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.file-list-info strong { font-size: 12.5px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-list-info span { font-size: 11px; font-family: 'IBM Plex Mono', monospace; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* client portal */
.portal-shell {
  width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: var(--paper); padding: 24px;
}
.portal-shell-view { align-items: flex-start; padding: 40px 20px; }
.portal-gate {
  background: var(--paper-raised); border: 1px solid var(--rule); border-radius: 12px; padding: 36px 32px;
  width: 380px; max-width: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.portal-badge {
  width: 46px; height: 46px; border-radius: 50%; border: 2px solid var(--red); color: var(--red);
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
@keyframes toastIn { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@media (max-width: 720px) {
  .toast-host { left: 16px; right: 16px; bottom: 16px; max-width: none; }
}

@media (prefers-reduced-motion: reduce) {
  .studio-ops * { transition: none !important; animation: none !important; }
}
`;
