import React, { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../../../contexts/AuthContext";
import { Card, CardContent } from "../../../components/ui/Card";
import { User } from "lucide-react";

interface CourseGrade {
  courseId: string;
  courseTitle: string;
  grade: number;
  letterGrade: string;
}

interface FinalGrade {
  id: string;
  traineeId: string;
  traineeName: string;
  total: number;
  average: number;
  cgpa: string;
  courses: CourseGrade[];
  createdAt: any;
}

const TraineeGrades: React.FC = () => {
  const { currentUser } = useAuth();
  const [grades, setGrades] = useState<FinalGrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "finalGrade"),
      where("traineeId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setGrades([]);
        setLoading(false);
        return;
      }

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as FinalGrade[];

      setGrades(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  if (loading)
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        <span className="ml-3 font-bold text-gray-500">Loading grades...</span>
      </div>
    );

  if (grades.length === 0)
    return (
      <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
        <p className="text-gray-500 dark:text-gray-400 font-medium whitespace-pre-wrap">
          No grades found for your enrolled courses yet.{"\n"}Please check back later once your trainer has finalized the assessment.
        </p>
      </div>
    );

  return (
    <div className="p-6 bg-gray-50/50 dark:bg-transparent min-h-full transition-colors duration-300">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Performance Records
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
          A detailed breakdown of your academic progress and final grades
        </p>
      </div>

      {grades.map((finalGrade) => (
        <Card
          key={finalGrade.id}
          className="mb-8 overflow-hidden bg-white dark:bg-gray-800 border-none shadow-xl shadow-gray-200/50 dark:shadow-none rounded-3xl"
        >
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <User size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                   Trainee
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {finalGrade.traineeName}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Final Average
                </p>
                <div className="flex items-baseline gap-1 justify-end">
                  <span className="text-4xl font-black text-blue-600 dark:text-blue-400">
                    {finalGrade.average.toFixed(1)}
                  </span>
                  <span className="text-xl font-bold text-blue-600/60">%</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                      Course
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                      Grade(100%)
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                      L/grade
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                      Total Points
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {finalGrade.courses.map((course, index) => (
                    <tr
                      key={course.courseId}
                      className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-5">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {course.courseTitle}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-base font-black text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-lg">
                          {course.grade}%
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${course.grade >= 80
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : course.grade >= 60
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                        >
                          {course.letterGrade || (course.grade >= 50 ? 'PASS' : 'FAIL')}
                        </span>
                      </td>
                      {index === 0 && (
                        <td
                          className="px-6 py-5 text-center border-l border-gray-100 dark:border-gray-700"
                          rowSpan={finalGrade.courses.length}
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-2xl font-black text-gray-900 dark:text-white">
                              {finalGrade.total}
                            </span>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default TraineeGrades;
