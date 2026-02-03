import React, { useState, useEffect, useRef } from "react";
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
import { Trash2, Edit2, Search, Users } from "lucide-react";

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

  const [trainerName, setTrainerName] = useState("");
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [availableTrainers, setAvailableTrainers] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputWrapperRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
              .map((course: any) => course.courses)
              .flat()
              .map((c: any) => c.instructorId)
          ),
        ];

        if (trainerIds.length === 0) return;

        // Fetch each trainer individualy (getDoc is allowed if we update rules)
        // This avoids listing all users which is restricted
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

  // Search trainers
  useEffect(() => {
    if (!trainerName.trim()) {
      setSuggestions([]);
      setTrainerId(null);
      return;
    }

    const filtered = availableTrainers.filter((t: any) =>
      t.displayName?.toLowerCase().includes(trainerName.toLowerCase())
    );
    setSuggestions(filtered.slice(0, 5));

    const exactMatch = filtered.find(
      (t: any) => t.displayName?.toLowerCase() === trainerName.toLowerCase()
    );
    setTrainerId(exactMatch ? exactMatch.id : null);
  }, [trainerName, availableTrainers]);

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch feedbacks
  useEffect(() => {
    if (!traineeId || !trainerId) return;

    const feedbackQuery = query(
      collection(db, "feedbacks"),
      where("traineeId", "==", traineeId),
      where("trainerId", "==", trainerId),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(feedbackQuery, (snapshot) => {
      const data: Feedback[] = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Feedback)
      );
      setFeedbacks(data);
    });

    return () => unsubscribe();
  }, [traineeId, trainerId]);

  // Send or update feedback
  const handleSend = async () => {
    if (!message.trim() || !trainerId || !traineeId) return;

    if (editingMessageId) {
      // Update existing message
      try {
        await setDoc(
          doc(db, "feedbacks", editingMessageId),
          { message, timestamp: serverTimestamp() },
          { merge: true }
        );

        setFeedbacks((prev) =>
          prev.map((fb) =>
            fb.id === editingMessageId ? { ...fb, message, timestamp: new Date() } : fb
          )
        );

        setMessage("");
        setEditingMessageId(null);
        return;
      } catch (error) {
        console.error("Error updating message:", error);
        alert("Failed to update message. Please try again.");
        return;
      }
    }

    // Create new message
    const tempId = `temp-${Date.now()}`;
    const newFeedback: Feedback = {
      id: tempId,
      trainerId,
      traineeId,
      message,
      timestamp: new Date(),
      sender: "trainee",
    };

    setFeedbacks((prev) => [...prev, newFeedback]);
    setMessage("");

    try {
      await addDoc(collection(db, "feedbacks"), {
        trainerId,
        traineeId,
        message,
        timestamp: serverTimestamp(),
        sender: "trainee",
      });
    } catch (error) {
      console.error("Error sending feedback:", error);
    }
  };

  // Delete trainee message
  const handleDeleteTrainee = async (id: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this message?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "feedbacks", id));
      setFeedbacks((prev) => prev.filter((fb) => fb.id !== id));
      alert("Message deleted successfully!");
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message. Please try again.");
    }
  };

  // Hide trainer message
  const handleHideTrainer = async (fb: Feedback) => {
    const confirmHide = window.confirm("Do you want to hide this trainer message?");
    if (!confirmHide) return;

    try {
      // Add to hiddenMessages collection
      await setDoc(doc(db, "hiddenMessages", fb.id), fb);

      // Delete from feedbacks collection
      await deleteDoc(doc(db, "feedbacks", fb.id));

      // Remove from local state so UI updates immediately
      setFeedbacks((prev) => prev.filter((msg) => msg.id !== fb.id));

      alert("Trainer message hidden successfully!");
    } catch (error) {
      console.error("Error hiding trainer message:", error);
      alert("Failed to hide trainer message. Please try again.");
    }
  };

  // Edit trainee message
  const handleEdit = (fb: Feedback) => {
    setMessage(fb.message);
    setTrainerId(fb.trainerId);
    setEditingMessageId(fb.id);
  };

  const handleSelectTrainer = (trainer: any) => {
    setTrainerName(trainer.displayName);
    setTrainerId(trainer.id);
    setSuggestions([]);
  };

  return (
    <div className="flex flex-col h-[600px] w-full bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

      {/* Header / Trainer Selection */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">
            {trainerId ? (trainerName?.charAt(0) || "T") : <Users size={20} />}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              {trainerId ? trainerName : "Select a Trainer"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {trainerId ? "Trainer" : "Start a conversation"}
            </p>
          </div>
        </div>

        <div className="relative" ref={inputWrapperRef}>
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/50">
            <Search size={16} className="text-gray-400 mr-2" />
            <input
              type="text"
              value={trainerName}
              onChange={(e) => setTrainerName(e.target.value)}
              placeholder="Search trainer..."
              className="bg-transparent border-none focus:ring-0 text-sm text-gray-900 dark:text-gray-100 w-48 focus:outline-none"
            />
          </div>
          {suggestions.length > 0 && (
            <ul className="absolute right-0 top-full mt-2 z-20 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg w-64 overflow-hidden">
              {suggestions.map((trainer) => (
                <li
                  key={trainer.id}
                  onClick={() => handleSelectTrainer(trainer)}
                  className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer text-sm flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 text-xs font-bold">
                    {trainer.displayName?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{trainer.displayName}</p>
                    <p className="text-xs text-gray-500">Instructor</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
        {!trainerId && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Search for a trainer above to start chatting</p>
          </div>
        )}

        {feedbacks.map((fb) => {
          const isTrainee = fb.sender === "trainee";
          return (
            <div key={fb.id} className={`flex w-full ${isTrainee ? "justify-end" : "justify-start"}`}>
              <div
                className={`relative max-w-[75%] p-3 rounded-2xl break-words group shadow-sm ${isTrainee
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-none"
                  }`}
              >
                <p className="text-sm leading-relaxed">{fb.message}</p>

                {/* Actions */}
                <div className={`absolute top-0 ${isTrainee ? '-left-14' : '-right-14'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 h-full`}>
                  {isTrainee ? (
                    <>
                      <button
                        onClick={() => handleEdit(fb)}
                        className="p-1.5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition"
                        title="Edit"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteTrainee(fb.id)}
                        className="p-1.5 rounded-full bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleHideTrainer(fb)}
                      className="p-1.5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition"
                      title="Hide"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <div className={`text-[10px] mt-1 text-right ${isTrainee ? "text-blue-100" : "text-gray-400"}`}>
                  {fb.timestamp?.toDate ? fb.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-900 p-2 rounded-xl border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-all">
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
            placeholder={trainerId ? "Type your feedback..." : "Select a trainer to start typing..."}
            className="flex-1 bg-transparent border-none resize-none max-h-32 min-h-[24px] focus:ring-0 p-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-50"
            rows={1}
            style={{ height: 'auto', minHeight: '40px' }}
            disabled={!trainerId}
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || !trainerId}
            className={`p-2 rounded-lg transition-all ${message.trim() && trainerId
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:scale-105"
              : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
              }`}
          >
            {editingMessageId ? (
              <span className="text-xs font-semibold px-2">Update</span>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </Button>
        </div>
        <div className="text-xs text-gray-400 mt-2 text-center">
          {trainerId ? "Press Enter to send, Shift + Enter for new line" : "Find your assigned trainer above to send feedback"}
        </div>
      </div>
    </div>
  );
};
