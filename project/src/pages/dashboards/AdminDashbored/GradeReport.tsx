import React, { useState, useEffect } from "react";
import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { FileText, Save, CheckCircle2 } from "lucide-react";

// Convert numeric grade to letter grade
const getGradeLetter = (grade: number) => {
  if (grade >= 90) return "A+";
  if (grade >= 85) return "A";
  if (grade >= 80) return "A-";
  if (grade >= 75) return "B+";
  if (grade >= 70) return "B";
  if (grade >= 65) return "B-";
  if (grade >= 60) return "C+";
  if (grade >= 55) return "C";
  if (grade >= 50) return "D";
  return "F";
};

// Determine color based on grade
const getLetterGradeColor = (grade: number) => {
  if (grade >= 80)
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (grade >= 60)
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold";
};

interface GradeItem {
  courseId: string;
  courseTitle: string;
  grade: number;
  letterGrade: string;
}

interface GradeRecord {
  traineeId: string;
  traineeName: string;
  courses: GradeItem[];
  total: number;
  average: number;
}

export default function GradeReport() {
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Real-time listener
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "grades"), (snapshot) => {
      const data: any[] = snapshot.docs.map((doc) => doc.data());
      const traineeMap: { [key: string]: GradeRecord } = {};

      data.forEach((g) => {
        if (!traineeMap[g.traineeId]) {
          traineeMap[g.traineeId] = {
            traineeId: g.traineeId,
            traineeName: g.traineeName,
            courses: [],
            total: 0,
            average: 0,
          };
        }

        traineeMap[g.traineeId].courses.push({
          courseId: g.courseId,
          courseTitle: g.courseTitle,
          grade: g.grade,
          letterGrade: getGradeLetter(g.grade),
        });
      });

      Object.values(traineeMap).forEach((t) => {
        const total = t.courses.reduce((sum, c) => sum + c.grade, 0);
        const maxTotal = t.courses.length * 100;
        t.total = total;
        t.average = (total / maxTotal) * 100;
      });

      setGrades(Object.values(traineeMap));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Log activity
  const logActivity = async (
    userName: string,
    action: string,
    target: string,
    details?: string
  ) => {
    try {
      await addDoc(collection(db, "activityLogs"), {
        userName,
        action,
        target,
        details: details || "",
        timestamp: serverTimestamp(),
      });
    } catch (err: any) {
      console.error("Failed to log activity:", err.message);
    }
  };

  // Save all grades
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      for (const t of grades) {
        const q = query(
          collection(db, "finalGrade"),
          where("traineeId", "==", t.traineeId)
        );
        const existingDocs = await getDocs(q);

        if (!existingDocs.empty) {
          const existingDoc = existingDocs.docs[0];
          await setDoc(
            doc(db, "finalGrade", existingDoc.id),
            {
              traineeId: t.traineeId,
              traineeName: t.traineeName,
              courses: t.courses,
              total: t.total,
              average: t.average,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          await setDoc(doc(collection(db, "finalGrade")), {
            traineeId: t.traineeId,
            traineeName: t.traineeName,
            courses: t.courses,
            total: t.total,
            average: t.average,
            createdAt: serverTimestamp(),
          });
        }
      }

      await logActivity("Admin", "Finalized", "all grade reports", "Generated certificates and summaries");
      alert("✅ All grade records finalized and published successfully!");
    } catch (error) {
      console.error("Error saving grades:", error);
      alert("❌ Failed to save grades. Check console for details.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        <span className="ml-3 font-bold text-gray-500">Loading grade data...</span>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-transparent p-6 space-y-8 rounded-3xl transition-colors duration-300">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Comprehensive Grade Report
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">Manage and finalize trainee performance metrics</p>
        </div>
        <Button
          onClick={handleSaveAll}
          disabled={isSaving || grades.length === 0}
          className="px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 py-6 transition-all active:scale-95"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
          ) : (
            <CheckCircle2 className="w-5 h-5 mr-2" />
          )}
          Finalize All Records
        </Button>
      </div>

      {grades.length === 0 ? (
        <Card className="p-16 text-center border-dashed border-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-3xl">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-900 dark:text-white">No grades reported yet</p>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Waiting for trainers to submit course results.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-none shadow-xl shadow-gray-200/50 dark:shadow-none bg-white dark:bg-gray-800 rounded-3xl">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Trainee Profile</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Enrolled Courses</th>
                    <th className="px-6 py-5 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Performance</th>
                    <th className="px-6 py-5 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Standing</th>
                    <th className="px-6 py-5 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest font-black">Average (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {grades.map((t) => (
                    <tr
                      key={t.traineeId}
                      className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all"
                    >
                      <td className="px-6 py-6 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                            {t.traineeName.charAt(0)}
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white">{t.traineeName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="space-y-4">
                          {t.courses.map((c) => (
                            <div key={c.courseId} className="text-gray-700 dark:text-gray-300 font-semibold truncate max-w-[250px]">
                              {c.courseTitle}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <div className="space-y-4">
                          {t.courses.map((c) => (
                            <div key={c.courseId}>
                              <span className="inline-flex items-center justify-center min-w-[50px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 font-black text-gray-900 dark:text-white">
                                {c.grade}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <div className="space-y-4">
                          {t.courses.map((c) => (
                            <div key={c.courseId} className="flex justify-center">
                              <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getLetterGradeColor(c.grade)}`}>
                                {c.letterGrade}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                            {t.average.toFixed(1)}%
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Weighted Mean</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
