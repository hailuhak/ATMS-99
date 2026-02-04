import React, { useState, useEffect, useRef, useMemo } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  addDoc,
  doc,
  getDocs,
  getDoc,
  serverTimestamp,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../../contexts/AuthContext";
import { Trash2, Edit2, Search, Users, Send } from "lucide-react";

interface Feedback {
  id: string;
  traineeId: string;
  trainerId: string;
  message: string;
  timestamp: any;
  sender: "trainee" | "trainer";
}

export const FeedbackForm: React.FC = () => {
  const { currentUser } = useAuth();
  const traineeId = currentUser?.uid;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
  const [availableTrainers, setAvailableTrainers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logic
  const prevFeedbacksLen = useRef(0);
  useEffect(() => {
    if (feedbacks.length > prevFeedbacksLen.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevFeedbacksLen.current = feedbacks.length;
  }, [feedbacks]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  // Fetch assigned trainers
  useEffect(() => {
    const fetchAssignedTrainers = async () => {
      if (!traineeId) return;
      try {
        const enrollmentsQuery = query(
          collection(db, "enrollments"),
          where("userId", "==", traineeId)
        );
        const enrollmentSnapshot = await getDocs(enrollmentsQuery);
        const enrolledCourses = enrollmentSnapshot.docs.map((doc) => doc.data());

        const trainerIds = [
          ...new Set(
            enrolledCourses
              .map((course: any) => course.courses || [])
              .flat()
              .map((c: any) => c.instructorId)
              .filter(Boolean)
          ),
        ];

        if (trainerIds.length === 0) return;

        const trainers = await Promise.all(
          trainerIds.map(async (id: string) => {
            try {
              const userDoc = await getDoc(doc(db, "users", id));
              if (userDoc.exists()) {
                return { id: userDoc.id, ...userDoc.data() };
              }
            } catch (e) {
              console.error(`Failed to fetch trainer ${id}`, e);
            }
            return null;
          })
        );
        setAvailableTrainers(trainers.filter(Boolean));
      } catch (error) {
        console.error("Error fetching assigned trainers:", error);
      }
    };
    fetchAssignedTrainers();
  }, [traineeId]);

  // Global feedback listener for sidebar sorting & real-time chat
  useEffect(() => {
    if (!traineeId) return;
    const feedbackQuery = query(
      collection(db, "feedbacks"),
      where("traineeId", "==", traineeId),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(feedbackQuery, (snapshot) => {
      const data: Feedback[] = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Feedback)
      );
      setFeedbacks(data);
    });
    return () => unsubscribe();
  }, [traineeId]);

  // Hidden messages listener
  useEffect(() => {
    if (!traineeId) return;
    const q = query(
      collection(db, "hiddenMessages"),
      where("traineeId", "==", traineeId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHiddenMessageIds(snapshot.docs.map(docSnap => docSnap.data().messageId));
    });
    return () => unsubscribe();
  }, [traineeId]);

  // Sorting logic for sidebar
  const sortedTrainers = useMemo(() => {
    let trainers = availableTrainers.filter((t) =>
      t.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return trainers.sort((a, b) => {
      const getLatestTime = (tId: string) => {
        const trainerMsgs = feedbacks.filter((f) => f.trainerId === tId && !hiddenMessageIds.includes(f.id));
        if (trainerMsgs.length === 0) return 0;
        return Math.max(...trainerMsgs.map((f) => f.timestamp?.seconds || 0));
      };
      return getLatestTime(b.id) - getLatestTime(a.id);
    });
  }, [availableTrainers, feedbacks, searchTerm, hiddenMessageIds]);

  // Default selection
  useEffect(() => {
    if (!selectedTrainerId && sortedTrainers.length > 0) {
      setSelectedTrainerId(sortedTrainers[0].id);
    }
  }, [sortedTrainers, selectedTrainerId]);

  const handleSend = async () => {
    if (!message.trim() || !selectedTrainerId || !traineeId) return;
    if (editingMessageId) {
      try {
        await setDoc(doc(db, "feedbacks", editingMessageId), { message, timestamp: serverTimestamp() }, { merge: true });
        setMessage("");
        setEditingMessageId(null);
      } catch (error) {
        console.error("Error updating message:", error);
      }
      return;
    }
    try {
      await addDoc(collection(db, "feedbacks"), {
        trainerId: selectedTrainerId,
        traineeId,
        message,
        timestamp: serverTimestamp(),
        sender: "trainee",
      });
      setMessage("");
    } catch (error) {
      console.error("Error sending feedback:", error);
    }
  };

  const handleDeleteTrainee = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete your message?")) return;
    try {
      await deleteDoc(doc(db, "feedbacks", id));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleHideTrainer = async (fb: Feedback) => {
    if (!window.confirm("Do you want to hide this message from your view?")) return;
    try {
      await addDoc(collection(db, "hiddenMessages"), {
        traineeId,
        trainerId: fb.trainerId, // Include both for rule consistency
        messageId: fb.id,
        hiddenAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error hiding trainee message:", error);
    }
  };

  const handleEdit = (fb: Feedback) => {
    setMessage(fb.message);
    setSelectedTrainerId(fb.trainerId);
    setEditingMessageId(fb.id);
    textareaRef.current?.focus();
  };

  const activeTrainer = availableTrainers.find(t => t.id === selectedTrainerId);

  return (
    <div className="flex h-[700px] w-full bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden transition-all duration-300">

      {/* Sidebar: Trainer List */}
      <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-[#0f172a]" ref={sidebarRef}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-transparent backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 tracking-tight">Messages</h3>
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              {availableTrainers.length} Trainers
            </span>
          </div>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Filter trainers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {sortedTrainers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={24} className="text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No assigned trainers found.</p>
            </div>
          ) : (
            sortedTrainers.map((trainer) => {
              const isActive = selectedTrainerId === trainer.id;
              const lastMsg = feedbacks
                .filter(f => f.trainerId === trainer.id && !hiddenMessageIds.includes(f.id))
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))[0];

              return (
                <div
                  key={trainer.id}
                  onClick={() => setSelectedTrainerId(trainer.id)}
                  className={`relative p-4 cursor-pointer rounded-2xl transition-all duration-300 flex items-center gap-4 ${isActive
                    ? "bg-white dark:bg-gray-800 shadow-md translate-x-1 border-l-4 border-l-blue-600 dark:border-l-blue-500"
                    : "hover:bg-white/60 dark:hover:bg-gray-800/60 border-l-4 border-l-transparent"
                    }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold shadow-inner shrink-0 ${isActive
                    ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    }`}>
                    {trainer.displayName?.charAt(0) || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <p className={`text-sm font-bold truncate ${isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-200"}`}>
                        {trainer.displayName}
                      </p>
                      {lastMsg?.timestamp && (
                        <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap ml-2">
                          {lastMsg.timestamp?.toDate ? lastMsg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently"}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs truncate ${isActive ? "text-gray-600 dark:text-gray-400" : "text-gray-500 dark:text-gray-500"}`}>
                      {lastMsg ? lastMsg.message : "Click to start conversation"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-[#020617]">
        {selectedTrainerId ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shadow-sm z-10 backdrop-blur-md bg-white/90 dark:bg-gray-800/90">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-100 to-blue-50 dark:from-blue-900 dark:to-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold border-2 border-white dark:border-gray-700 shadow-sm leading-none text-lg">
                    {activeTrainer?.displayName?.charAt(0) || "T"}
                  </div>
  
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 tracking-tight leading-none mb-1">
                    {activeTrainer?.displayName || "Trainer"}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider">Trainer</p>
                  
                  
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {feedbacks
                .filter(f => f.trainerId === selectedTrainerId && !hiddenMessageIds.includes(f.id))
                .map((fb) => {
                  const isTrainee = fb.sender === "trainee";
                  return (
                    <div key={fb.id} className={`flex w-full group ${isTrainee ? "justify-end" : "justify-start"}`}>
                      <div className={`relative max-w-[80%] flex items-end gap-2`}>
                        {!isTrainee && (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold shrink-0 mb-1">
                            {activeTrainer?.displayName?.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className={`relative p-4 rounded-3xl break-words shadow-sm transition-all duration-200 hover:shadow-md ${isTrainee
                            ? "bg-blue-600 text-white rounded-br-none shadow-md"
                            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-none shadow-sm"
                            }`}>
                            <p className="text-sm leading-relaxed font-medium">{fb.message}</p>

                            {/* Actions */}
                            <div className={`absolute top-0 ${isTrainee ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-all flex flex-col gap-1.5 h-full pt-1`}>
                              {isTrainee ? (
                                <>
                                  <button onClick={() => handleEdit(fb)} className="p-2 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700 text-blue-600 dark:text-blue-400 hover:scale-110 active:scale-95 transition-all">
                                    <Edit2 size={12} />
                                  </button>
                                  <button onClick={() => handleDeleteTrainee(fb.id)} className="p-2 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400 hover:scale-110 active:scale-95 transition-all">
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => handleHideTrainer(fb)} className="p-2 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:scale-110 active:scale-95 transition-all">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className={`text-[10px] mt-1.5 px-2 flex items-center gap-1 ${isTrainee ? "justify-end text-blue-500 dark:text-blue-400" : "text-gray-400"}`}>
                            <span className="font-semibold px-1">{fb.timestamp?.toDate ? fb.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}</span>
                            {isTrainee && (
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              <div ref={messagesEndRef} />
            </div>

            {/* Premium Input Section */}
            <div className="p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <div className="flex items-end gap-3 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all shadow-inner">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Share your thoughts with the trainer..."
                  className="flex-1 bg-transparent border-none resize-none max-h-40 min-h-[24px] focus:ring-0 p-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 leading-relaxed custom-scrollbar outline-none"
                  rows={1}
                  style={{ height: 'auto', minHeight: '40px' }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!message.trim()}
                  className={`p-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 ${message.trim() ? "bg-gradient-to-tr from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-400 grayscale"}`}
                >
                  {editingMessageId ? <span className="text-xs font-bold px-3">SAVE CHANGES</span> : (
                    <Send className="w-6 h-6 rotate-45" />
                  )}
                </Button>
              </div>
              <div className="flex justify-between items-center mt-3 px-1">
                <span className="text-[10px] text-gray-400 font-medium tracking-tight">Shift + Enter for new line</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded">Secure Feedbacks</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50/50 dark:bg-[#020617]/50">
            <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/10 rotate-3 border border-gray-100 dark:border-gray-700">
              <Users size={40} className="text-blue-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3 tracking-tight">Select a Conversation</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed font-medium">Pick a trainer from the sidebar to view your message history and send new feedbacks.</p>
          </div>
        )}
      </div>
    </div>
  );
};
