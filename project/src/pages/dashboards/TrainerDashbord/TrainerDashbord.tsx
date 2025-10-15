import React from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { TrainerOverview } from "./TrainerOverview";
import { TrainerCourses } from "./TrainerCourses";
import { TrainingSessions } from "./TrainingSessions";
import { TrainerFeedback } from "./TrainerFeedback";
import { TrainingMaterials } from "./TrainingMaterials";
import { TrainerGrades } from "./TrainerGrades";

interface TrainerDashboardProps {
  activeSection: string;
}

export const TrainerDashboard: React.FC<TrainerDashboardProps> = ({ activeSection }) => {
  const { currentUser } = useAuth();

  // Handle null user (trainer not logged in)
  if (!currentUser) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-300">
        Please log in to view your trainer dashboard.
      </div>
    );
  }

  // The trainer ID will come from Firebase Auth
  const trainerId = currentUser.uid;

  switch (activeSection) {
    case "courses":
      return <TrainerCourses />;
    case "sessions":
      return <TrainingSessions />;
    case "feedback":
      return <TrainerFeedback trainerId={trainerId} />;
    case "materials":
      return <TrainingMaterials />;
    case "grades":
      return <TrainerGrades />;
    default:
      return <TrainerOverview />;
  }
};
