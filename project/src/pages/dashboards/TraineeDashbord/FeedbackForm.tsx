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
  serverTimestamp,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../../contexts/AuthContext";
import { Trash2, Edit2 } from "lucide-react";

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

        const usersSnapshot = await getDocs(collection(db, "users"));
        const trainers = usersSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((u: any) => trainerIds.includes(u.id));

        setAvailableTrainers(trainers);
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
      const data: Feedback[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Feedback));
      setFeedbacks(data);
    });

    return () => unsubscribe();
  }, [traineeId, trainerId]);

  // Send feedback
  const handleSend = async () => {
    if (!message.trim() || !trainerId || !traineeId) return;
    try {
      await addDoc(collection(db, "feedbacks"), {
        trainerId,
        traineeId,
        message,
        timestamp: serverTimestamp(),
        sender: "trainee",
      });
      setMessage("");
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      console.error("Error sending feedback:", error);
    }
  };

  // Delete trainee message permanently
  const handleDeleteTrainee = async (id: string) => {
    try {
      await deleteDoc(doc(db, "feedbacks", id));
    } catch (error) {
      console.error("Error deleting trainee message:", error);
    }
  };

  // Hide trainer message in hiddenMessages
  const handleHideTrainer = async (fb: Feedback) => {
    try {
      await setDoc(doc(db, "hiddenMessages", fb.id), fb);
      await deleteDoc(doc(db, "feedbacks", fb.id));
    } catch (error) {
      console.error("Error hiding trainer message:", error);
    }
  };

  // Edit trainee message
  const handleEdit = (fb: Feedback) => {
    setMessage(fb.message);
    setTrainerId(fb.trainerId);
  };

  const handleSelectTrainer = (trainer: any) => {
    setTrainerName(trainer.displayName);
    setTrainerId(trainer.id);
    setSuggestions([]);
  };

  return (
    <div className="flex flex-col p-4 bg-white dark:bg-gray-900 rounded-lg shadow-md h-full w-full relative">
      {/* Trainer input */}
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
          <span className="text-red-500 text-sm ml-2">
            Trainer not found or not assigned to you.
          </span>
        )}
      </div>

      {/* Message input */}
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
            !message.trim() || !trainerId ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          Send
        </Button>
      </div>

      {/* Feedback messages */}
<div className="flex flex-col gap-2 overflow-y-auto h-64 pr-2">
  {feedbacks.length > 0 ? (
    feedbacks.map((fb) => {
      const isTrainee = fb.sender === "trainee";
      return (
 <div
  key={fb.id}
  className="flex items-start max-w-full relative group"
>
  <div
    className={`relative break-words rounded-lg px-4 py-2 w-[75%] ${
      isTrainee
        ? "bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white ml-0" // flush left
        : "bg-blue-500 dark:bg-blue-600 text-white ml-8" // left with gap
    } pr-10`}
  >
    {fb.message}

    {isTrainee ? (
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={() => handleEdit(fb)}
          title="Edit message"
          className="text-white dark:text-gray-300 hover:text-yellow-400"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={() => handleDeleteTrainee(fb.id)}
          title="Delete message"
          className="text-white dark:text-gray-300 hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      </div>
    ) : (
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={() => handleHideTrainer(fb)}
          title="Hide trainer message"
          className="text-white dark:text-gray-300 hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      </div>
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
