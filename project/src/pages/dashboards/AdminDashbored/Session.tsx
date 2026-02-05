import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Pencil, Trash2 } from "lucide-react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";

interface SessionType {
  id?: string;
  title: string;
  regStart: string;
  regEnd: string;
  trainStart: string;
  trainEnd: string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function Session() {
  const [sessions, setSessions] = useState<SessionType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSession, setNewSession] = useState<SessionType>({
    title: "",
    regStart: "",
    regEnd: "",
    trainStart: "",
    trainEnd: "",
  });
  const [errors, setErrors] = useState({
    regEnd: "",
    trainStart: "",
    trainEnd: "",
  });

  // ✅ New loading state for disabling buttons
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const autoTitle = `Session ${currentYear}-${nextYear}`;

  const fetchSessions = async () => {
    const snapshot = await getDocs(collection(db, "sessions"));
    setSessions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SessionType)));
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const logActivity = async (action: string, target: string, details?: string) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, "activityLogs"), {
        userName: auth.currentUser.displayName || "Admin",
        userId: auth.currentUser.uid,
        userRole: "admin",
        action,
        target,
        details: details || "",
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  };

  const validateDates = () => {
    let newErrors = { regEnd: "", trainStart: "", trainEnd: "" };
    const regStartDate = new Date(newSession.regStart);
    const regEndDate = new Date(newSession.regEnd);
    const trainStartDate = new Date(newSession.trainStart);
    const trainEndDate = new Date(newSession.trainEnd);

    if (newSession.regEnd && regEndDate < regStartDate) {
      newErrors.regEnd = "❌ Registration end must be after start.";
    }
    if (newSession.trainStart && trainStartDate <= regEndDate) {
      newErrors.trainStart = "❌ Training must start after registration ends.";
    }
    if (newSession.trainEnd && trainEndDate < trainStartDate) {
      newErrors.trainEnd = "❌ Training end must be after training start.";
    }

    setErrors(newErrors);
    return !newErrors.regEnd && !newErrors.trainStart && !newErrors.trainEnd;
  };

  useEffect(() => {
    validateDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newSession]);

  const handleSaveSession = async () => {
    if (!validateDates()) return;

    setLoading(true); // ✅ Disable buttons during save/update
    try {
      if (editingId) {
        const sessionRef = doc(db, "sessions", editingId);
        await updateDoc(sessionRef, {
          ...newSession,
          title: autoTitle,
        });
        await logActivity("update", autoTitle, "Session updated successfully.");
        alert(`✅ ${autoTitle} updated!`);
      } else {
        await addDoc(collection(db, "sessions"), {
          ...newSession,
          title: autoTitle,
          createdAt: serverTimestamp(),
        });
        await logActivity("create", autoTitle, "New session created.");
        alert(`✅ ${autoTitle} created!`);
      }

      setNewSession({ title: "", regStart: "", regEnd: "", trainStart: "", trainEnd: "" });
      setEditingId(null);
      setShowForm(false);
      fetchSessions();
    } finally {
      setLoading(false); // ✅ Re-enable buttons after operation
    }
  };

  const handleDeleteSession = async (id: string, title: string) => {
    if (!window.confirm("⚠️ Are you sure you want to delete this session?")) return;

    setLoading(true); // ✅ Disable buttons during delete
    try {
      await deleteDoc(doc(db, "sessions", id));
      await logActivity("delete", title, "Session deleted.");
      fetchSessions();
    } finally {
      setLoading(false); // ✅ Re-enable buttons after operation
    }
  };

  const handleEditSession = (session: SessionType) => {
    setEditingId(session.id || null);
    setNewSession({
      title: session.title,
      regStart: session.regStart,
      regEnd: session.regEnd,
      trainStart: session.trainStart,
      trainEnd: session.trainEnd,
    });
    setShowForm(true);
  };

  return (
    <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="hidden sm:inline">📅</span> Session Management
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
              Set schedules and registration windows
            </p>
          </div>
          <Button
            disabled={loading}
            className={`w-full sm:w-auto shadow-lg transition-all ${showForm ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'}`}
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setNewSession({ title: "", regStart: "", regEnd: "", trainStart: "", trainEnd: "" });
            }}
          >
            {showForm ? "Close Form" : "➕ Create Session"}
          </Button>
        </div>

        {/* Create/Edit Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-6 rounded-2xl mb-8 border border-gray-100 dark:border-gray-700"
          >
            <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
              {editingId ? "✏️ Edit Session" : "🆕 New Session"}
              {!editingId && <span className="text-xs font-normal text-gray-400">(Auto-generated title)</span>}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Title (Read Only) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-black uppercase tracking-widest mb-2 text-gray-400">
                  Session Title
                </label>
                <div className="px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-bold">
                  {autoTitle}
                </div>
              </div>

              {/* Registration Period */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider">Registration Phase</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-gray-500 dark:text-gray-400">Opens On</label>
                    <Input
                      type="date"
                      value={newSession.regStart}
                      onChange={(e) => setNewSession({ ...newSession, regStart: e.target.value })}
                      className="bg-white dark:bg-gray-900 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-gray-500 dark:text-gray-400">Closes On</label>
                    <Input
                      type="date"
                      value={newSession.regEnd}
                      onChange={(e) => setNewSession({ ...newSession, regEnd: e.target.value })}
                      className={`bg-white dark:bg-gray-900 rounded-xl ${errors.regEnd ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {errors.regEnd && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.regEnd}</p>}
                  </div>
                </div>
              </div>

              {/* Training Period */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Training Phase</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-gray-500 dark:text-gray-400">Starts On</label>
                    <Input
                      type="date"
                      value={newSession.trainStart}
                      onChange={(e) => setNewSession({ ...newSession, trainStart: e.target.value })}
                      className={`bg-white dark:bg-gray-900 rounded-xl ${errors.trainStart ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {errors.trainStart && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.trainStart}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-gray-500 dark:text-gray-400">Ends On</label>
                    <Input
                      type="date"
                      value={newSession.trainEnd}
                      onChange={(e) => setNewSession({ ...newSession, trainEnd: e.target.value })}
                      className={`bg-white dark:bg-gray-900 rounded-xl ${errors.trainEnd ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {errors.trainEnd && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.trainEnd}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end mt-8 gap-3">
              <Button
                disabled={loading}
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="px-6 text-gray-500"
              >
                Cancel
              </Button>
              <Button
                disabled={loading}
                onClick={handleSaveSession}
                className="px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20"
              >
                {editingId ? "Update Session" : "Create Session"}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Sessions Content */}
        {sessions.length === 0 ? (
          <div className="text-center py-20 px-4 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <span className="text-2xl">📅</span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">No sessions scheduled</p>
            <p className="text-gray-500 text-sm mt-1">Start by creating your first training session window.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr className="text-xs uppercase font-black tracking-widest text-gray-400">
                    <th className="px-6 py-4 text-left ">Session Title</th>
                    <th className="px-6 py-4 text-left">Registration</th>
                    <th className="px-6 py-4 text-left">Training</th>
                    <th className="px-6 py-4 text-middel">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                      <td className="px-6 py-5 font-bold text-gray-900 dark:text-white">{s.title}</td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-blue-600 dark:text-gray-300 font-bold">{formatDate(s.regStart)}</span>
                          <span className="text-[13px] text-red-400 uppercase tracking-tighter font-bold">— {formatDate(s.regEnd)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-blue-600 dark:text-blue-400 font-bold">{formatDate(s.trainStart)}</span>
                          <span className="text-[13px] text-red-400 uppercase tracking-tighter font-bold">— {formatDate(s.trainEnd)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            disabled={loading}
                            className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            onClick={() => handleEditSession(s)}
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            disabled={loading}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            onClick={() => handleDeleteSession(s.id!, s.title)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden space-y-4">
              {sessions.map((s) => (
                <div key={s.id} className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm active:scale-[0.98] transition-transform">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-black text-gray-900 dark:text-white text-lg">{s.title}</h4>
                    <div className="flex gap-1">
                      <button
                        disabled={loading}
                        className="p-2 text-blue-500 bg-gray-50 dark:bg-gray-900 rounded-xl active:scale-90 transition-transform"
                        onClick={() => handleEditSession(s)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        disabled={loading}
                        className="p-2 text-red-500 bg-gray-50 dark:bg-gray-900 rounded-xl active:scale-90 transition-transform"
                        onClick={() => handleDeleteSession(s.id!, s.title)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Registration</p>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-900 dark:text-white font-bold">{formatDate(s.regStart)}</p>
                        <p className="text-[12px] text-red-600">- {formatDate(s.regEnd)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[12px] font-black uppercase tracking-widest text-emerald-500 mb-2">Training</p>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-900 dark:text-white font-bold">{formatDate(s.trainStart)}</p>
                        <p className="text-[12px] text-red-400">- {formatDate(s.trainEnd)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
