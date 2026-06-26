import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api";
import { useAuth } from "../auth";

// Resize + compress an image file into a JPEG data URL (kept compact so it
// stores cleanly in the user record — no cloud bucket needed).
function fileToResizedDataURL(file, max = 512, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function StatCard({ label, value, accent = "text-primary" }) {
  return (
    <div className="p-4 bg-surface-container-high rounded-xl border border-outline-variant/30">
      <p className="text-label-md text-on-surface-variant mb-1">{label}</p>
      <p className={`text-headline-md font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? "bg-primary-container" : "bg-surface-container-highest"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

export default function Profile() {
  const { user, logout, patchUser } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const fileRef = useRef(null);

  const settings = user?.settings || { daily_report: true, at_risk_alerts: true };

  useEffect(() => {
    Promise.all([api.tasks(), api.habits()])
      .then(([t, h]) => {
        setTasks(t.tasks || []);
        setHabits(h.habits || []);
      })
      .catch(() => {});
  }, []);

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function saveName() {
    const name = nameDraft.trim();
    if (!name || name === user.name) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      const { user: updated } = await api.updateProfile({ name });
      patchUser(updated);
      flash("Profile updated");
    } catch {
      flash("Couldn't save name");
    } finally {
      setSaving(false);
      setEditingName(false);
    }
  }

  async function toggleSetting(key, value) {
    const next = { ...settings, [key]: value };
    patchUser({ settings: next }); // optimistic
    try {
      await api.updateProfile({ settings: next });
    } catch {
      patchUser({ settings }); // revert
      flash("Couldn't save setting");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  async function onPickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      flash("Please choose an image file");
      return;
    }
    setUploadingPhoto(true);
    try {
      const dataUrl = await fileToResizedDataURL(file);
      const { user: updated } = await api.updateProfile({ avatar_url: dataUrl });
      patchUser(updated);
      flash("Photo updated");
    } catch {
      flash("Couldn't update photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function removePhoto() {
    setUploadingPhoto(true);
    try {
      const { user: updated } = await api.updateProfile({ avatar_url: "" });
      patchUser({ ...updated, avatar_url: "" });
      flash("Photo removed");
    } catch {
      flash("Couldn't remove photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  // ---- real stats -----------------------------------------------------------
  const done = tasks.filter((t) => t.status === "done").length;
  const active = tasks.filter((t) => t.status !== "done").length;
  const bestStreak = habits.reduce((m, h) => Math.max(m, h.streak || 0), 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const habitsToday = habits.filter((h) => h.checks?.includes(todayStr)).length;
  const habitPct = habits.length ? Math.round((habitsToday / habits.length) * 100) : 0;

  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <main className="p-unit-lg md:p-margin-desktop pb-24 max-w-container-max mx-auto relative">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-primary text-on-primary-fixed px-4 py-2 rounded-xl shadow-lg text-body-md font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>
          {toast}
        </div>
      )}

      {/* Full-size photo viewer */}
      <AnimatePresence>
        {viewingPhoto && user?.avatar_url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewingPhoto(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.img
              src={user.avatar_url}
              alt="Profile"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-white/10"
            />
            <button
              onClick={() => setViewingPhoto(false)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors backdrop-blur-sm"
              title="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile header */}
      <header className="mb-unit-xl flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative group shrink-0">
            <div
              onClick={() => user?.avatar_url && setViewingPhoto(true)}
              title={user?.avatar_url ? "View photo" : undefined}
              className={`w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-primary/20 bg-primary-container flex items-center justify-center text-on-primary-container text-5xl font-black overflow-hidden ${
                user?.avatar_url ? "cursor-pointer" : ""
              }`}
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingPhoto}
              title="Change photo"
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-primary text-on-primary-fixed flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform border-2 border-surface disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">photo_camera</span>
            </button>
            {user?.avatar_url && !uploadingPhoto && (
              <button
                onClick={removePhoto}
                title="Remove photo"
                className="absolute top-0 right-0 w-7 h-7 rounded-full bg-surface-container-highest text-error flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity border-2 border-surface hover:bg-error/20"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onPickPhoto}
              className="hidden"
            />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              {editingName ? (
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  className="bg-surface-container-high border border-primary/40 rounded-lg px-3 py-1 text-headline-lg font-bold text-on-surface focus:outline-none"
                />
              ) : (
                <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight">
                  {user?.name || "Your Name"}
                </h1>
              )}
              <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full font-label-md text-label-md flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">bolt</span>
                Active
              </span>
            </div>
            <p className="text-on-surface-variant font-body-lg text-body-lg">
              {user?.role || "Member"} • Focus Mode: Active
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setNameDraft(user?.name || "");
              setEditingName(true);
            }}
            disabled={saving}
            className="px-6 py-2 bg-surface-container border border-outline-variant rounded-xl font-label-md text-label-md text-on-surface hover:bg-surface-bright transition-all active:scale-95"
          >
            Edit Profile
          </button>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-error/15 text-error border border-error/30 rounded-xl font-label-md text-label-md hover:bg-error/25 transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Sign Out
          </button>
        </div>
      </header>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Account settings */}
        <section className="lg:col-span-7 flex flex-col gap-gutter">
          <div className="glass-panel border border-outline-variant/40 p-unit-lg rounded-2xl">
            <h3 className="font-headline-md text-headline-md mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">settings</span>
              Account Settings
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-label-md font-label-md text-on-surface-variant mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    readOnly
                    value={user?.email || ""}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-body-md font-body-md text-on-surface-variant outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-label-md flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">lock</span>
                  </span>
                </div>
              </div>

              <hr className="border-outline-variant/30" />

              <div className="space-y-4">
                <h4 className="text-body-lg font-body-lg font-bold">Notifications</h4>

                <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant">mail</span>
                    <div>
                      <p className="text-body-md font-body-md">Daily Focus Report</p>
                      <p className="text-label-md text-on-surface-variant">
                        A morning summary of what's due and at risk.
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={!!settings.daily_report}
                    onChange={(v) => toggleSetting("daily_report", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant">
                      notifications_active
                    </span>
                    <div>
                      <p className="text-body-md font-body-md">At-Risk Deadlines</p>
                      <p className="text-label-md text-on-surface-variant">
                        Alerts when a task is about to slip.
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={!!settings.at_risk_alerts}
                    onChange={(v) => toggleSetting("at_risk_alerts", v)}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats + subscription */}
        <aside className="lg:col-span-5 flex flex-col gap-gutter">
          <div className="glass-panel border border-outline-variant/40 p-unit-lg rounded-2xl relative overflow-hidden">
            <h3 className="font-headline-md text-headline-md mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">analytics</span>
              Focus Statistics
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <StatCard label="Tasks Completed" value={done} />
              <StatCard label="Best Streak" value={`${bestStreak}d`} accent="text-secondary" />
              <StatCard label="Active Tasks" value={active} />
              <StatCard label="Habits Tracked" value={habits.length} accent="text-tertiary" />
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <p className="text-body-md font-body-md">Today's habits</p>
                  <span className="text-primary font-bold">
                    {habitsToday}/{habits.length || 0}
                  </span>
                </div>
                <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-700"
                    style={{ width: `${habitPct}%` }}
                  />
                </div>
              </div>

              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary">auto_awesome</span>
                </div>
                <div>
                  <p className="text-body-md font-bold text-primary">AI Insight</p>
                  <p className="text-label-md text-on-surface-variant">
                    {active > 0
                      ? `You have ${active} open task${active > 1 ? "s" : ""}. Knock out the highest-priority one first.`
                      : "Inbox zero on tasks — brain-dump what's next to stay ahead."}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </aside>
      </div>
    </main>
  );
}
