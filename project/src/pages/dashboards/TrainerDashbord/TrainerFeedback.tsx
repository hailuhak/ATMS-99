import React, { useEffect, useState, useRef } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { Button } from "../../../components/ui/Button";

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
  const [traineeNames, setTraineeNames] = useState<Record<string, string>>({});

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll chat to bottom when messages or selected trainee changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedTrainee]);

  // Real-time listener for feedback messages
  useEffect(() => {
    const q = query(collection(db, "feedbacks"), where("trainerId", "==", trainerId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const feedbacks: FeedbackMessage[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        traineeId: doc.data().traineeId,
        message: doc.data().message,
        timestamp: doc.data().timestamp,
        sender: doc.data().sender || "trainee",
      }));
      setMessages(feedbacks);
    });
    return () => unsubscribe();
  }, [trainerId]);

  // Fetch trainee names based on IDs
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

  // Send reply to selected trainee
  const handleReply = async () => {
    if (!reply.trim() || !selectedTrainee) return;

    await addDoc(collection(db, "feedbacks"), {
      trainerId,
      traineeId: selectedTrainee,
      message: reply,
      sender: "trainer",
      timestamp: serverTimestamp(),
    });

    setReply("");
  };

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [reply]);

  const trainees = [...new Set(messages.map((m) => m.traineeId))];

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-xl shadow-md">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
        Trainee Feedback Messages
      </h2>

      <div className="flex gap-6">
        {/* Trainees list */}
        <div className="w-1/3 flex flex-col gap-2">
          <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Trainees</h3>
          {trainees.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No messages yet.</p>
          ) : (
            trainees.map((id) => (
              <div
                key={id}
                onClick={() => setSelectedTrainee(id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors duration-200 ${
                  selectedTrainee === id
                    ? "bg-blue-200 dark:bg-blue-700 font-semibold"
                    : "hover:bg-gray-200 dark:hover:bg-gray-800"
                }`}
              >
                {traineeNames[id] || id}
              </div>
            ))
          )}
        </div>

        {/* Chat area */}
        <div className="w-2/3 flex flex-col gap-4 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-inner">
          {selectedTrainee ? (
            <>
              <div className="flex-1 overflow-y-auto space-y-3">
                {messages
                  .filter((m) => m.traineeId === selectedTrainee)
                  .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0))
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className={`px-4 py-2 rounded-2xl max-w-xl break-words ${
                        msg.sender === "trainer"
                          ? "bg-blue-500 text-white self-end"
                          : "bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100 self-start"
                      }`}
                    >
                      {msg.message}
                    </div>
                  ))}
                <div ref={chatEndRef} />
              </div>

              {/* Reply box */}
              <div className="flex flex-col items-center gap-3 mt-4">
                <textarea
                  ref={textareaRef}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply..."
                  className="w-full resize-none min-h-[80px] max-h-44 p-3 rounded-xl border-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
                <Button
                  onClick={handleReply}
                  className="px-6 py-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition"
                >
                  Send
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
