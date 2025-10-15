import React, { useEffect, useState, useRef } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
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

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll chat to bottom when messages update
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
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Trainee Feedback Messages
      </h2>

      <div className="flex gap-4">
        {/* Left panel: list of trainees */}
        <div className="w-1/3 border rounded-lg p-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
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
                {id}
              </div>
            ))
          )}
        </div>

        {/* Right panel: chat area */}
        <div className="w-2/3 border rounded-lg p-4 flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          {selectedTrainee ? (
            <>
              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto mb-3 space-y-2">
                {messages
                  .filter((m) => m.traineeId === selectedTrainee)
                  .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0))
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-lg max-w-xs break-words ${
                        msg.sender === "trainer"
                          ? "bg-blue-500 text-white ml-auto"
                          : "bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {msg.message}
                    </div>
                  ))}
                <div ref={chatEndRef} />
              </div>

              {/* Reply box */}
              <div className="flex gap-2 flex-col md:flex-row">
                <textarea
                  ref={textareaRef}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 resize-none h-24 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
                />
                <Button onClick={handleReply} className="self-end md:self-auto">
                  Send
                </Button>
              </div>
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">
              Select a trainee to view messages.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
