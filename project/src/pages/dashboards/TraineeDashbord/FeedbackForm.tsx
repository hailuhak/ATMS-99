import React, { useState, useEffect, useRef } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../../contexts/AuthContext";
import { Trash2 } from "lucide-react";

export const FeedbackForm: React.FC = () => {
  const { currentUser } = useAuth();
  const traineeId = currentUser?.uid;

  const [trainerName, setTrainerName] = useState("");
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputWrapperRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll when messages update
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

  // Case-insensitive trainer search with suggestions
  useEffect(() => {
    const fetchTrainers = async () => {
      if (!trainerName.trim()) {
        setSuggestions([]);
        setTrainerId(null);
        return;
      }

      try {
        const snapshot = await getDocs(collection(db, "users"));
        const allTrainers = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((u: any) =>
            u.displayName?.toLowerCase().includes(trainerName.toLowerCase())
          );

        setSuggestions(allTrainers.slice(0, 5));

        const exactMatch = allTrainers.find(
          (u: any) =>
            u.displayName?.toLowerCase() === trainerName.toLowerCase()
        );
        setTrainerId(exactMatch ? exactMatch.id : null);
      } catch (error) {
        console.error("Error searching trainer:", error);
      }
    };

    fetchTrainers();
  }, [trainerName]);

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputWrapperRef.current &&
        !inputWrapperRef.current.contains(event.target as Node)
      ) {
        setSuggestions([]);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  // Send feedback
  const handleSend = async () => {
    if (!message.trim() || !traineeId || !trainerId) return;

    try {
      const docRef = await addDoc(collection(db, "feedbacks"), {
        trainerId,
        traineeId,
        message,
        timestamp: serverTimestamp(),
        sender: "trainee", // mark who sent it
      });

      setFeedbacks((prev) => [
        ...prev,
        {
          id: docRef.id,
          trainerId,
          traineeId,
          message,
          timestamp: new Date(),
          sender: "trainee",
        },
      ]);

      setMessage("");
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      console.error("Error sending feedback:", error);
    }
  };

  // Delete feedback (only trainee messages)
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "feedbacks", id));
      setFeedbacks((prev) => prev.filter((fb) => fb.id !== id));
    } catch (error) {
      console.error("Error deleting feedback:", error);
    }
  };

  const handleSelectTrainer = (trainer: any) => {
    setTrainerName(trainer.displayName);
    setTrainerId(trainer.id);
    setSuggestions([]);
  };

  return (
    <div className="flex flex-col p-4 bg-white dark:bg-gray-900 rounded-lg shadow-md h-full w-full relative">
      {/* Header + Trainer Input */}
      <div className="flex items-center mb-3 flex-wrap">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mr-2">
          Send Feedback to:
        </h2>

        <div className="relative" ref={inputWrapperRef}>
          <input
            type="text"
            value={trainerName}
            onChange={(e) => setTrainerName(e.target.value)}
            placeholder="Enter trainer name..."
            className="w-48 p-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:text-gray-100"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 bg-white dark:bg-gray-800 border rounded-md shadow-md mt-1 w-full max-h-40 overflow-y-auto">
              {suggestions.map((trainer) => (
                <li
                  key={trainer.id}
                  onClick={() => handleSelectTrainer(trainer)}
                  className="px-2 py-1 hover:bg-blue-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
                >
                  {trainer.displayName}
                </li>
              ))}
            </ul>
          )}
        </div>

        {!trainerId && trainerName.trim() && (
          <span className="text-red-500 text-sm ml-2">Trainer not found.</span>
        )}
      </div>

      {/* Message Input */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 w-full">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your feedback..."
          className="w-full sm:w-1/2 h-10 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-gray-800 dark:text-gray-100 resize-none overflow-hidden"
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || !trainerId}
          className={`w-full sm:w-auto mt-2 sm:mt-0 ${
            !message.trim() || !trainerId
              ? "opacity-50 cursor-not-allowed"
              : ""
          }`}
        >
          Send
        </Button>
      </div>

      {/* Feedback Messages */}
      <div className="flex flex-col gap-2 overflow-y-auto h-64 pr-2">
        {feedbacks.length > 0 ? (
          feedbacks.map((fb) => {
            const isTrainee = fb.sender === "trainee";
            return (
              <div
                key={fb.id}
                className={`flex items-start gap-1 max-w-full ${
                  isTrainee ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`relative p-2 rounded-lg break-words flex-1 ${
                    isTrainee
                      ? "bg-blue-500 dark:bg-black text-white"
                      : "bg-green-200 dark:bg-green-700 text-gray-900 dark:text-white"
                  }`}
                >
                  {fb.message}
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
          <p className="text-gray-500 text-center w-full mt-2">
            No feedback yet.
          </p>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
