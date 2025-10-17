import React, { useEffect, useState, useRef } from "react";
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
  getDocs,
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

  // Fetch hidden messages
  const fetchHiddenMessages = async () => {
    const hiddenSnapshot = await getDocs(
      query(collection(db, "hiddenMessages"), where("trainerId", "==", trainerId))
    );
    setHiddenMessageIds(hiddenSnapshot.docs.map((doc) => doc.data().messageId));
  };

  // Real-time feedback listener
  useEffect(() => {
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

    fetchHiddenMessages();
    return () => unsubscribe();
  }, [trainerId, hiddenMessageIds]);

  // Fetch trainee names
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
    };
    if (messages.length > 0) fetchTraineeNames();
  }, [messages]);

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

  const trainees = [...new Set(messages.map((m) => m.traineeId))];

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Trainee Feedback Messages
      </h2>

      <div className="flex gap-4">
        {/* Trainee list */}
        <div className="w-1/3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg p-2">
          <h3 className="font-medium mb-2">Trainees</h3>
          {trainees.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No messages yet.</p>
          ) : (
            trainees.map((id) => (
              <div
                key={id}
                onClick={() => setSelectedTrainee(id)}
                className={`p-2 cursor-pointer rounded ${
                  selectedTrainee === id
                    ? "bg-blue-200 dark:bg-blue-700 font-semibold"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {traineeNames[id] || "Unknown"}
              </div>
            ))
          )}
        </div>

        {/* Chat area */}
        <div className="w-2/3 flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg p-4">
          {selectedTrainee ? (
            <>
              <div className="flex-1 overflow-y-auto mb-3 space-y-2">
                {messages
                  .filter((m) => m.traineeId === selectedTrainee)
                  .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0))
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className={`relative p-2 rounded-xl max-w-xs break-words group ${
                        msg.sender === "trainer"
                          ? "bg-blue-500 text-white self-end ml-auto mr-2"
                          : "bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100 self-start ml-2"
                      }`}
                    >
                      {msg.message}

                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        {msg.sender === "trainer" && (
                          <button onClick={() => handleEdit(msg)}>
                            <Edit2 size={16} className="text-white dark:text-gray-200" />
                          </button>
                        )}
                        <button onClick={() => handleHideMessage(msg)}>
                          <Trash2
                            size={16}
                            className={`${
                              msg.sender === "trainer"
                                ? "text-white dark:text-gray-200"
                                : "text-gray-900 dark:text-gray-100"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                <div ref={chatEndRef} />
              </div>

              {/* Reply box */}
              <div className="flex flex-col items-center gap-2 mt-4">
                <textarea
                  ref={textareaRef}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply..."
                  className="w-full max-w-[80%] resize-none min-h-[80px] max-h-44 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
                <Button
                  onClick={handleReply}
                  className="px-6 py-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition"
                >
                  {editingMessageId ? "Update" : "Send"}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center mt-10">
              Select a trainee to view messages.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
