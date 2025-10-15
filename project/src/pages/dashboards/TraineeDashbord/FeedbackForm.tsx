import React, { useState, useRef, useEffect } from "react";
import { db } from "../../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "../../../components/ui/Button";

interface FeedbackFormProps {
  trainerId: string;
  traineeId: string;
}
export const FeedbackForm: React.FC<FeedbackFormProps> = ({ trainerId, traineeId }) => {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const handleSend = async () => {
    if (!message.trim()) return;
    await addDoc(collection(db, "feedbacks"), {
      trainerId,
      traineeId,
      message,
      timestamp: serverTimestamp(),
      status: "sent",
    });

    setMessage("");
  };

  // Auto-expand textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  return (
    <div className="mt-4 flex flex-col gap-2 w-full">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your feedback..."
        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 resize-none overflow-hidden"
      />
      <Button onClick={handleSend} className="self-end">
        Send
      </Button>
    </div>
  );
};
