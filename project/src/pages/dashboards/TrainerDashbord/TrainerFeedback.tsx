import React, { useEffect, useState, useRef, useMemo } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { Button } from "../../../components/ui/Button";
import { Edit2, Trash2 } from "lucide-react";

interface FeedbackMessage {
  id: string;
  traineeId: string;
  message: string;
  timestamp?: any;
  sender: "trainee" | "trainer";
}

interface TrainerFeedbackProps {
  trainerId: string;
}

export const TrainerFeedback: React.FC<TrainerFeedbackProps> = ({ trainerId }) => {
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [reply, setReply] = useState("");
  const [selectedTrainee, setSelectedTrainee] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [traineeNames, setTraineeNames] = useState<Record<string, string>>({});
  const [hiddenMessageIds, setHiddenMessageIds] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const prevMessagesRef = useRef<FeedbackMessage[]>([]); // for auto-scroll new message

  // Auto-scroll only when a new message is added
  useEffect(() => {
    if (messages.length > prevMessagesRef.current.length) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessagesRef.current = messages;
  }, [messages]);

  // Real-time hidden messages listener
  useEffect(() => {
    if (!trainerId) return;
    const q = query(
      collection(db, "hiddenMessages"),
      where("trainerId", "==", trainerId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHiddenMessageIds(snapshot.docs.map(doc => doc.data().messageId));
    });
    return () => unsubscribe();
  }, [trainerId]);

  // Real-time feedback listener
  useEffect(() => {
    if (!trainerId) return;

    const unsubscribe = onSnapshot(
      query(collection(db, "feedbacks"), where("trainerId", "==", trainerId)),
      (snapshot) => {
        const feedbacks: FeedbackMessage[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          traineeId: doc.data().traineeId,
          message: doc.data().message,
          timestamp: doc.data().timestamp,
          sender: doc.data().sender || "trainee",
        }));
        setMessages(feedbacks.filter((m) => !hiddenMessageIds.includes(m.id)));
      }
    );

    return () => unsubscribe();
  }, [trainerId, hiddenMessageIds]);

  // Fetch trainee names and auto-select most recent
  useEffect(() => {
    const fetchTraineeNames = async () => {
      const ids = [...new Set(messages.map((m) => m.traineeId))];
      const names: Record<string, string> = {};
      for (let id of ids) {
        try {
          const userDoc = await getDoc(doc(db, "users", id));
          names[id] = userDoc.exists() ? userDoc.data().displayName || "Unknown" : "Unknown";
        } catch {
          names[id] = "Unknown";
        }
      }
      setTraineeNames(names);

      // Auto-select the trainee with the most recent message if none selected
      if (!selectedTrainee && messages.length > 0) {
        const sortedMessages = [...messages].sort((a, b) =>
          (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
        );
        if (sortedMessages.length > 0) {
          setSelectedTrainee(sortedMessages[0].traineeId);
        }
      }
    };
    if (messages.length > 0) fetchTraineeNames();
  }, [messages, selectedTrainee]);

  // Send or update reply
  const handleReply = async () => {
    if (!reply.trim() || !selectedTrainee) return;

    if (editingMessageId) {
      await updateDoc(doc(db, "feedbacks", editingMessageId), {
        message: reply,
        timestamp: serverTimestamp(),
      });
      setEditingMessageId(null);
    } else {
      await addDoc(collection(db, "feedbacks"), {
        trainerId,
        traineeId: selectedTrainee,
        message: reply,
        sender: "trainer",
        timestamp: serverTimestamp(),
      });
    }
    setReply("");
  };

  // Edit message
  const handleEdit = (msg: FeedbackMessage) => {
    setEditingMessageId(msg.id);
    setReply(msg.message);
    textareaRef.current?.focus();
  };

  // Hide trainee message for this trainer
  const handleHideMessage = async (msg: FeedbackMessage) => {
    if (!window.confirm("Do you want to delete this message?")) return;

    if (msg.sender === "trainer") {
      await deleteDoc(doc(db, "feedbacks", msg.id));
    } else {
      await addDoc(collection(db, "hiddenMessages"), {
        trainerId,
        messageId: msg.id,
      });
      setHiddenMessageIds([...hiddenMessageIds, msg.id]);
    }
    setMessages(messages.filter((m) => m.id !== msg.id));
  };

  const trainees = useMemo(() => {
    const uniqueTrainees = [...new Set(messages.map((m) => m.traineeId))];
    return uniqueTrainees.sort((a, b) => {
      const msgsA = messages.filter((m) => m.traineeId === a);
      const msgsB = messages.filter((m) => m.traineeId === b);
      const lastTimeA = Math.max(...msgsA.map((m) => m.timestamp?.seconds || 0));
      const lastTimeB = Math.max(...msgsB.map((m) => m.timestamp?.seconds || 0));
      return lastTimeB - lastTimeA;
    });
  }, [messages]);

  return (
    <div className="p-2 sm:p-4">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100 px-2">
        Trainee Feedback
      </h2>

      <div className="flex flex-col lg:flex-row gap-4 lg:h-[600px]">
        {/* Trainee list */}
        <div className={`${selectedTrainee ? 'hidden lg:flex' : 'flex'} w-full lg:w-1/3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex-col h-[500px] lg:h-full`}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Messages</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select a trainee to chat</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {trainees.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <p>No messages yet.</p>
              </div>
            ) : (
              trainees.map((id) => (
                <div
                  key={id}
                  onClick={() => setSelectedTrainee(id)}
                  className={`p-3 cursor-pointer rounded-xl transition-all duration-200 flex items-center gap-3 ${selectedTrainee === id
                    ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 shadow-sm"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent"
                    }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm shrink-0 ${selectedTrainee === id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    }`}>
                    {traineeNames[id]?.charAt(0) || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${selectedTrainee === id ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-gray-100"}`}>
                      {traineeNames[id] || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      Click to view conversation
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={`${!selectedTrainee ? 'hidden lg:flex' : 'flex'} w-full lg:w-2/3 flex-col bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-2xl shadow-sm overflow-hidden h-[500px] lg:h-full`}>
          {selectedTrainee ? (
            <>
              {/* Chat Header */}
              <div className="p-3 sm:p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedTrainee(null)}
                    className="lg:hidden p-2 -ml-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold border border-white dark:border-gray-700">
                    {traineeNames[selectedTrainee]?.charAt(0) || "U"}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 leading-tight">
                      {traineeNames[selectedTrainee] || "Unknown Trainee"}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                      Trainee
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gray-50 dark:bg-gray-900/50 custom-scrollbar">
                {messages
                  .filter((m) => m.traineeId === selectedTrainee)
                  .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0))
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex w-full ${msg.sender === "trainer" ? "justify-end" : "justify-start"
                        }`}
                    >
                      <div
                        className={`relative max-w-[85%] sm:max-w-[75%] p-3 sm:p-4 rounded-3xl break-words group shadow-sm transition-all ${msg.sender === "trainer"
                          ? "bg-blue-600 text-white rounded-br-none"
                          : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-none"
                          }`}
                      >
                        <p className="text-sm font-medium leading-relaxed">{msg.message}</p>

                        {/* Message Actions */}
                        <div className={`absolute top-0 ${msg.sender === 'trainer' ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1.5 h-full pt-1`}>
                          {msg.sender === "trainer" && (
                            <button
                              onClick={() => handleEdit(msg)}
                              className="p-1.5 sm:p-2 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700 text-blue-600 dark:text-blue-400 hover:scale-110 active:scale-95 transition-all"
                              title="Edit"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => handleHideMessage(msg)}
                            className="p-1.5 sm:p-2 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-100 dark:border-gray-700 text-red-600 dark:text-red-400 hover:scale-110 active:scale-95 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Timestamp */}
                        <div className={`text-[10px] mt-1.5 font-semibold ${msg.sender === "trainer" ? "text-blue-100/80" : "text-gray-400"
                          }`}>
                          {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-inner">
                <div className="flex items-end gap-3 bg-gray-50 dark:bg-gray-900/50 p-2 sm:p-3 rounded-2xl border border-gray-200 dark:border-gray-700 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all">
                  <textarea
                    ref={textareaRef}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent border-none resize-none max-h-40 min-h-[24px] focus:ring-0 p-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 custom-scrollbar outline-none"
                    rows={1}
                    style={{ height: 'auto', minHeight: '40px' }}
                  />
                  <Button
                    onClick={handleReply}
                    disabled={!reply.trim()}
                    className={`p-3 rounded-xl transition-all shadow-lg active:scale-95 ${reply.trim()
                      ? "bg-gradient-to-tr from-blue-600 to-blue-500 text-white shadow-blue-500/20"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed grayscale"
                      }`}
                  >
                    {editingMessageId ? (
                      <span className="text-xs font-bold px-2">SAVE</span>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 sm:w-6 sm:h-6 rotate-45" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    )}
                  </Button>
                </div>
                <div className="hidden sm:flex justify-between items-center mt-3 px-1">
                  <span className="text-[10px] text-gray-400 font-medium tracking-tight">Shift + Enter for new line</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-100 dark:bg-gray-700/50 px-2 py-0.5 rounded">Secure Feedbacks</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-gray-50 dark:bg-gray-900/50">
              <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/10 border border-gray-100 dark:border-gray-700 rotate-3">
                <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Select a Conversation</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs font-medium leading-relaxed">
                Choose a trainee from the list on the left to view and reply to their feedback messages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
