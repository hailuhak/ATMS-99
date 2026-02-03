import React, { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../../../contexts/AuthContext";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";

interface Course {
  courseId: string;
  title: string;
}

interface Enrollment {
  userId: string;
  courses: Course[];
}

interface User {
  displayName: string;
}

export const TrainerGrades: React.FC = () => {
  const { currentUser } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [grades, setGrades] = useState<{ [key: string]: number }>({});
  const [userNames, setUserNames] = useState<{ [key: string]: string }>({});
  const [trainerCourseIds, setTrainerCourseIds] = useState<Set<string>>(new Set());

  // ✅ Step 1: Fetch trainer's courses first
  useEffect(() => {
    if (!currentUser) return;

    const fetchTrainerCourses = async () => {
      try {
        const q = query(collection(db, 'courses'), where('instructorId', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        const courseIds = new Set(snapshot.docs.map(doc => doc.id));
        setTrainerCourseIds(courseIds);
      } catch (error) {
        console.error('Error fetching trainer courses:', error);
      }
    };

    fetchTrainerCourses();
  }, [currentUser]);

  // ✅ Step 2: Fetch enrollments only for trainer's courses
  useEffect(() => {
    if (!currentUser || trainerCourseIds.size === 0) return;

    const unsubscribe = onSnapshot(collection(db, "enrollments"), async (snapshot) => {
      const data: { [userId: string]: Enrollment } = {};
      const userIdsToFetch: Set<string> = new Set();

      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data() as any;
        const userId = d.userId;

        if (Array.isArray(d.courses)) {
          d.courses.forEach((course: any) => {
            // ✅ Only include courses that belong to this trainer
            if (trainerCourseIds.has(course.courseId)) {
              if (!data[userId]) data[userId] = { userId, courses: [] };
              data[userId].courses.push({ courseId: course.courseId, title: course.title });
              userIdsToFetch.add(userId);
            }
          });
        }
      });

      setEnrollments(Object.values(data));

      // Fetch user names from "users" collection
      const names: { [key: string]: string } = {};
      await Promise.all(
        Array.from(userIdsToFetch).map(async (uid) => {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            names[uid] = userData.displayName || "Unknown";
          } else {
            names[uid] = "Unknown";
          }
        })
      );

      setUserNames(names);
    });

    return () => unsubscribe();
  }, [currentUser, trainerCourseIds]);

  // ✅ Step 3: Fetch existing grades for this trainer
  useEffect(() => {
    if (!currentUser) return;

    const fetchGrades = async () => {
      try {
        const q = query(collection(db, 'grades'), where('trainerId', '==', currentUser.uid));
        const snapshot = await getDocs(q);

        const fetchedGrades: { [key: string]: number } = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const key = `${data.traineeId}_${data.courseId}`;
          fetchedGrades[key] = data.grade;
        });
        setGrades(fetchedGrades);
      } catch (error) {
        console.error("Error fetching grades:", error);
      }
    };
    fetchGrades();
  }, [currentUser]);

  // ✅ Handle input change
  const handleInputChange = (userId: string, courseId: string, value: number) => {
    const key = `${userId}_${courseId}`;
    setGrades({ ...grades, [key]: value });
  };

  // ✅ Function to notify admin when grades change
  const notifyAdminOnGradeChange = async (
    trainerName: string,
    traineeName: string,
    courseTitle: string,
    gradeValue: number
  ) => {
    try {
      await addDoc(collection(db, "Notifications"), {
        type: "grade_update",
        message: `${trainerName} submitted ${gradeValue}% for ${traineeName} in ${courseTitle}`,
        createdAt: serverTimestamp(),
        isRead: false,
      });
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  };

  // ✅ Save grades with ownership validation
  const handleSave = async (trainee: Enrollment) => {
    if (!currentUser) return;

    const trainerDoc = await getDoc(doc(db, "users", currentUser.uid));
    const trainerName = trainerDoc.exists()
      ? (trainerDoc.data() as User).displayName || "Trainer"
      : "Trainer";

    for (const course of trainee.courses) {
      // ✅ Ownership validation: Only save grades for courses this trainer owns
      if (!trainerCourseIds.has(course.courseId)) {
        console.warn(`Trainer ${currentUser.uid} attempted to grade course ${course.courseId} they don't own`);
        continue;
      }

      const key = `${trainee.userId}_${course.courseId}`;
      const gradeValue = grades[key];
      if (gradeValue == null) continue;

      const q = query(
        collection(db, "grades"),
        where("trainerId", "==", currentUser.uid),
        where("traineeId", "==", trainee.userId),
        where("courseId", "==", course.courseId)
      );

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        await updateDoc(docRef, { grade: gradeValue, updatedAt: Timestamp.now() });
      } else {
        await addDoc(collection(db, "grades"), {
          traineeId: trainee.userId,
          traineeName: userNames[trainee.userId] || "Unknown",
          courseId: course.courseId,
          courseTitle: course.title,
          trainerId: currentUser.uid,
          grade: gradeValue,
          createdAt: Timestamp.now(),
        });
      }

      // ✅ Send notification to admin
      await notifyAdminOnGradeChange(
        trainerName,
        userNames[trainee.userId] || "Unknown",
        course.title,
        gradeValue
      );

      // ✅ Add activity log for trainer (this is new)
      try {
        await addDoc(collection(db, "activityLogs"), {
          userName: trainerName,
          trainerId: currentUser.uid,
          action: "Updated Grade",
          target: userNames[trainee.userId] || "Unknown",
          details: `Set grade to ${gradeValue}% for ${course.title}`,
          timestamp: serverTimestamp(),
        });
      } catch (err) {
        console.error("Error adding activity log:", err);
      }
    }

    alert(`✅ Grades saved for ${userNames[trainee.userId] || "Unknown"}`);
  };


  // ✅ UI
  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Trainee Grades
      </h2>

      {enrollments.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">
          No trainees found under your supervision.
        </p>
      ) : (
        enrollments.map((trainee) => (
          <Card
            key={trainee.userId}
            className="mb-6 bg-white dark:bg-gray-900 shadow-lg rounded-2xl border border-gray-200 dark:border-gray-700"
          >
            <CardHeader className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {userNames[trainee.userId] || "Unknown"}
              </h3>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded-lg transition"
                onClick={() => handleSave(trainee)}
              >
                Save
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                      <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left">
                        Course
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center">
                        Grade
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center">
                        Add / Edit Grade (0-100)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainee.courses.map((course) => {
                      const key = `${trainee.userId}_${course.courseId}`;
                      const currentGrade = grades[key];

                      return (
                        <tr
                          key={course.courseId}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-gray-700 dark:text-gray-200">
                            {course.title}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center font-bold text-blue-600 dark:text-blue-400">
                            {currentGrade !== undefined ? `${currentGrade}%` : '-'}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg p-1 w-20 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={grades[key] || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  trainee.userId,
                                  course.courseId,
                                  Number(e.target.value)
                                )
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
