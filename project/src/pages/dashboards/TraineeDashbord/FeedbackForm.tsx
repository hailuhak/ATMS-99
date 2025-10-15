import React, { useState, useEffect, useRef } from "react";
import { db } from "../../../lib/firebase";
import {
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  deleteDoc,
} from "firebase/firestore";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../../contexts/AuthContext";
import { Trash2 } from "lucide-react";

export const FeedbackForm: React.FC = () => {
  const { currentUser } = useAuth();
  const traineeId = currentUser?.uid;

  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [instructorName, setInstructorName] = useState<string>("Instructor");
  const [message, setMessage] = useState("");
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom when feedbacks change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feedbacks]);

  // Fetch trainer info
  useEffect(() => {
    const fetchTrainerInfo = async () => {
      if (!traineeId) return;
      try {
        const enrolDoc = await getDoc(doc(db, "enrollments", traineeId));
        if (enrolDoc.exists()) {
          const data = enrolDoc.data();
          const activeCourse = data.courses?.find(
            (c: any) => c.status.toLowerCase() === "active"
          );
          if (activeCourse) {
            setTrainerId(activeCourse.instructorId);
            setInstructorName(activeCourse.instructorName);
          }
        }
      } catch (error) {
        console.error("Error fetching trainer info:", error);
      }
    };
    fetchTrainerInfo();
  }, [traineeId]);

  // Fetch feedbacks in real-time
  useEffect(() => {
    if (!traineeId || !trainerId) return;

    const feedbackQuery = query(
      collection(db, "feedbacks"),
      where("traineeId", "==", traineeId),
      where("trainerId", "==", trainerId),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(feedbackQuery, (snapshot) => {
      const feedbackData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFeedbacks(feedbackData);
    });

    return () => unsubscribe();
  }, [traineeId, trainerId]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  // Send feedback
  const handleSend = async () => {
    if (!message.trim() || !traineeId || !trainerId) return;

    try {
      const docRef = await addDoc(collection(db, "feedbacks"), {
        trainerId,
        traineeId,
        message,
        timestamp: serverTimestamp(),
        status: "sent",
      });

      setFeedbacks((prev) => [
        ...prev,
        {
          id: docRef.id,
          trainerId,
          traineeId,
          message,
          timestamp: new Date(),
          status: "sent",
        },
      ]);

      setMessage("");
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      console.error("Error sending feedback:", error);
    }
  };

  // Delete feedback
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "feedbacks", id));
      setFeedbacks((prev) => prev.filter((fb) => fb.id !== id));
    } catch (error) {
      console.error("Error deleting feedback:", error);
    }
  };

  return (
    <div className="flex flex-col p-4 bg-white dark:bg-gray-900 rounded-lg shadow-md h-full w-full">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
        Feedback to {instructorName}
      </h2>

      {/* Input Section */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 w-full">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your feedback..."
          className="w-full sm:w-1/2 h-12 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:text-gray-100 resize-none overflow-hidden transition-colors duration-200"
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim()}
          className={`w-full sm:w-auto mt-2 sm:mt-0 ${
            !message.trim() ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          Send
        </Button>
      </div>

      {/* Feedback Messages */}
      <div className="flex flex-col gap-2 overflow-y-auto h-64 pr-2">
        {feedbacks.length > 0 ? (
          feedbacks.map((fb) => {
            const isTrainee = fb.traineeId === traineeId;
            return (
              <div
                key={fb.id}
                className={`flex items-start gap-1 max-w-full ${
                  isTrainee ? "justify-start" : "justify-end"
                }`}
              >
                {/* Name */}
                <div
                  className={`font-semibold w-28 flex-shrink-0 ${
                    isTrainee
                      ? "text-blue-800 dark:text-white"
                      : "text-green-700 dark:text-green-300"
                  }`}
                >
                  {isTrainee ? currentUser?.displayName || "You" : instructorName}:
                </div>

                {/* Message Bubble */}
                <div
                  className={`relative p-2 rounded-lg break-words flex-1 ${
                    isTrainee
                      ? "bg-blue-500 dark:bg-black text-white"
                      : "bg-green-200 dark:bg-green-700 text-gray-900 dark:text-white"
                  }`}
                >
                  {fb.message}

                  {/* Delete Button (only for trainee's messages) */}
                  {isTrainee && (
                    <button
                      onClick={() => handleDelete(fb.id)}
                      className="absolute top-1 right-1 text-white dark:text-gray-300 hover:text-red-500 transition"
                      title="Delete message"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-gray-500 text-center w-full mt-2">No feedback yet.</p>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
