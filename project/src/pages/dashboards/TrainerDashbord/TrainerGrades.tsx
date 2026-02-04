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
import { User, GraduationCap, Save, Search } from "lucide-react";
import { Input } from "../../../components/ui/Input";

interface Course {
  courseId: string;
  title: string;
}

interface Enrollment {
  userId: string;
  courses: Course[];
}

interface UserProfile {
  displayName: string;
}

export const TrainerGrades: React.FC = () => {
  const { currentUser } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [grades, setGrades] = useState<{ [key: string]: number }>({});
  const [userNames, setUserNames] = useState<{ [key: string]: string }>({});
  const [trainerCourseIds, setTrainerCourseIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
            if (trainerCourseIds.has(course.courseId)) {
              if (!data[userId]) data[userId] = { userId, courses: [] };
              data[userId].courses.push({ courseId: course.courseId, title: course.title });
              userIdsToFetch.add(userId);
            }
          });
        }
      });

      setEnrollments(Object.values(data));

      const names: { [key: string]: string } = {};
      await Promise.all(
        Array.from(userIdsToFetch).map(async (uid) => {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
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

  const handleInputChange = (userId: string, courseId: string, value: number) => {
    const key = `${userId}_${courseId}`;
    setGrades({ ...grades, [key]: value });
  };

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

  const handleSaveAll = async () => {
    if (!currentUser) return;
    setIsSaving(true);

    try {
      const trainerDoc = await getDoc(doc(db, "users", currentUser.uid));
      const trainerName = trainerDoc.exists()
        ? (trainerDoc.data() as UserProfile).displayName || "Trainer"
        : "Trainer";

      for (const trainee of enrollments) {
        for (const course of trainee.courses) {
          if (!trainerCourseIds.has(course.courseId)) continue;

          const key = `${trainee.userId}_${course.courseId}`;
          const gradeValue = grades[key];
          if (gradeValue == null) continue;

          // Check if already exists to update or create
          const q = query(
            collection(db, "grades"),
            where("trainerId", "==", currentUser.uid),
            where("traineeId", "==", trainee.userId),
            where("courseId", "==", course.courseId)
          );

          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            await updateDoc(snapshot.docs[0].ref, { grade: gradeValue, updatedAt: Timestamp.now() });
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

          await notifyAdminOnGradeChange(trainerName, userNames[trainee.userId] || "Unknown", course.title, gradeValue);

          await addDoc(collection(db, "activityLogs"), {
            userName: trainerName,
            trainerId: currentUser.uid,
            action: "Updated Grade",
            target: userNames[trainee.userId] || "Unknown",
            details: `Set grade to ${gradeValue}% for ${course.title}`,
            timestamp: serverTimestamp(),
          });
        }
      }
      alert("✅ All grades saved successfully!");
    } catch (err) {
      console.error("Save all error:", err);
      alert("❌ Failed to save some grades. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredEnrollments = enrollments.filter(trainee => {
    const name = userNames[trainee.userId]?.toLowerCase() || "";
    return name.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="p-6 space-y-6 bg-gray-50/50 dark:bg-transparent min-h-full rounded-3xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trainee Grades</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 font-medium">Manage student performance from one place</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-10 h-10 border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button
            onClick={handleSaveAll}
            disabled={isSaving || enrollments.length === 0}
            className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save All Changes
          </Button>
        </div>
      </div>

      {filteredEnrollments.length === 0 ? (
        <Card className="p-12 text-center bg-white dark:bg-gray-800/50 border-dashed border-2 border-gray-200 dark:border-gray-700 rounded-2xl">
          <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No trainees found under your supervision.</p>
        </Card>
      ) : (
        filteredEnrollments.map((trainee) => (
          <Card
            key={trainee.userId}
            className="bg-white dark:bg-gray-800 shadow-xl shadow-gray-200/50 dark:shadow-none rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700"
          >
            <CardHeader className="bg-gray-100/50 dark:bg-gray-900/50 py-4 px-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
                  <User className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {userNames[trainee.userId] || "Unknown Student"}
                </h3>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-[11px]">Course Title</th>
                      <th className="px-6 py-4 text-center font-bold uppercase tracking-wider text-[11px]">Current Grade</th>
                      <th className="px-6 py-4 text-right font-bold uppercase tracking-wider text-[11px]">Update (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {trainee.courses.map((course) => {
                      const key = `${trainee.userId}_${course.courseId}`;
                      const currentGrade = grades[key];

                      return (
                        <tr key={course.courseId} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/20 transition-colors">
                          <td className="px-6 py-4 text-gray-900 dark:text-white font-semibold">
                            {course.title}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-base font-black ${currentGrade >= 50 ? 'text-green-600 dark:text-green-500' : 'text-blue-600 dark:text-blue-400'}`}>
                              {currentGrade !== undefined ? `${currentGrade}%` : '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="0"
                              className="w-20 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl p-2 text-center font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
                              value={grades[key] === undefined ? "" : grades[key]}
                              onChange={(e) =>
                                handleInputChange(
                                  trainee.userId,
                                  course.courseId,
                                  e.target.value === "" ? 0 : Number(e.target.value)
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

export default TrainerGrades;
