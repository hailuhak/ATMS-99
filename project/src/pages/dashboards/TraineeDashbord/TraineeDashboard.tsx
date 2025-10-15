import React, { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { MyCourses } from "./MyCourses";
import { FeedbackForm } from "./FeedbackForm";
import { Schedule } from "./Schedule";
import { Resources } from "./Resources";
import { DashboardOverview } from "./DashboardOverview";
import TraineeGrades from "./TraineeGrade";

interface TraineeDashboardProps {
  activeSection: string;
}

export const TraineeDashboard: React.FC<TraineeDashboardProps> = ({ activeSection }) => {
  const { currentUser } = useAuth();
  const [trainerId, setTrainerId] = useState<string>("");

  if (!currentUser) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-300">
        Please log in to view your dashboard.
      </div>
    );
  }

  // Fetch instructorId from enrolments collection
  useEffect(() => {
    const fetchInstructorId = async () => {
      try {
        const enrolmentDoc = await getDoc(doc(db, "enrollments", currentUser.uid));
        if (enrolmentDoc.exists()) {
          const enrolmentData = enrolmentDoc.data();
          setTrainerId(enrolmentData.instructorId); // Use instructorId as trainerId
        }
      } catch (error) {
        console.error("Failed to fetch instructorId:", error);
      }
    };
    fetchInstructorId();
  }, [currentUser.uid]);

  switch (activeSection) {
    case "courses":
      return <MyCourses currentUser={currentUser} />;
    case "schedule":
      return <Schedule />;
    case "resources":
      return <Resources />;
    case "grades":
      return <TraineeGrades />;
    case "feedback":
      return (
        <FeedbackForm
          trainerId={trainerId} // ✅ dynamically fetched from enrolments
          traineeId={currentUser.uid}
        />
      );
    default:
      return <DashboardOverview currentUser={currentUser} />;
  }
};
