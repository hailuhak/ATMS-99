import React, { useEffect, useState } from "react";
import { StatsCard } from "../../../components/Cards/StatsCard";
import { CourseCard } from "../../../components/courses/CourseCard";
import { RecentActivity } from "../../../components/Cards/RecentActivity";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Users, BookOpen, TrendingUp, Activity } from "lucide-react";
import { db, auth } from "../../../lib/firebase";
import { collection, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, getDocs, serverTimestamp, addDoc } from "firebase/firestore";
import { Course, ActivityLog } from "../../../types";

export const DashboardOverview: React.FC = () => {
  const [usersCount, setUsersCount] = useState(0);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [showAllCourses, setShowAllCourses] = useState(false);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [latestSession, setLatestSession] = useState<any>(null);
  const [rawCourses, setRawCourses] = useState<any[]>([]);

  // ✅ Standardized safe date converter
  const safeToDate = (v: any): Date => {
    if (!v) return new Date();
    if (typeof v.toDate === "function") return v.toDate();
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  // --- Standardized status calculation (matches CourseManagement.tsx) ---
  const computeStatus = (trainerExists: boolean, startDate: Date, endDate: Date, courseEndDate: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!trainerExists) return "draft";

    const s = safeToDate(startDate);
    const e = safeToDate(endDate);
    const ce = safeToDate(courseEndDate);
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    ce.setHours(0, 0, 0, 0);

    if (today > ce || today > e) return "completed";
    if (today < s) return "draft";
    return "active";
  };

  const logActivity = async (action: string, target: string, details?: string) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, "activityLogs"), {
        userName: auth.currentUser.displayName || "Admin",
        userId: auth.currentUser.uid,
        userRole: "admin",
        action,
        target,
        details: details || "",
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Dashboard log error:", err);
    }
  };

  useEffect(() => {
    // --- Users count listener ---
    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      setUsersCount(snapshot.size);
    });

    // --- Sessions listener for auto-completion ---
    const sessionsQuery = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
    const unsubscribeSessions = onSnapshot(sessionsQuery, async (snapshot) => {
      if (snapshot.empty) return;
      const sessionData = snapshot.docs[0].data();
      const sessionStart = safeToDate(sessionData.trainStart);
      const sessionEnd = safeToDate(sessionData.trainEnd);
      setLatestSession({ ...sessionData, trainStart: sessionStart, trainEnd: sessionEnd });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      try {
        const coursesRef = collection(db, "courses");
        const snap = await getDocs(coursesRef);

        for (const d of snap.docs) {
          const data = d.data();
          const courseEndDate = safeToDate(data.endDate);
          courseEndDate.setHours(0, 0, 0, 0);

          // Rule 1: Auto-complete if session ended OR course ended
          if ((today > sessionEnd || today > courseEndDate) && data.status !== "completed" && data.instructorId) {
            try {
              await updateDoc(doc(db, "courses", d.id), {
                status: "completed",
                updatedAt: serverTimestamp(),
              });
              await logActivity("auto-completed", `course: ${data.title}`, "End date passed.");
            } catch (err) { console.error("Auto-completion error:", err); }
          }
          // Rule 2: Auto-draft if session hasn't started yet
          else if (today < sessionStart && data.status === "active") {
            try {
              await updateDoc(doc(db, "courses", d.id), {
                status: "draft",
                updatedAt: serverTimestamp(),
              });
              await logActivity("auto-draft", `course: ${data.title}`, "Session hasn't started.");
            } catch (err) { console.error("Auto-draft error:", err); }
          }
        }
      } catch (err) {
        console.error("Failed to fetch courses for automation:", err);
      }
    });

    // --- Courses listener ---
    const coursesQuery = query(collection(db, "courses"), orderBy("createdAt", "desc"));
    const unsubscribeCourses = onSnapshot(coursesQuery, (snapshot) => {
      setRawCourses(snapshot.docs);
      setCoursesLoading(false);
    });

    // --- Activity logs listener ---
    const logsQuery = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const activityData: ActivityLog[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userName: data.userName || data.user || "Unknown User",
          userId: data.userId || "",
          userRole: data.userRole || "trainee",
          trainerId: data.trainerId || "",
          action: data.action || "",
          target: data.target || undefined,
          details: data.details || data.description || undefined,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
        } as ActivityLog;
      });

      setLogs(activityData.slice(0, 3));
      setLogsLoading(false);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeSessions();
      unsubscribeCourses();
      unsubscribeLogs();
    };
  }, []);

  // --- Process and Sync Courses Real-time ---
  useEffect(() => {
    if (!rawCourses.length) return;

    const formatted = rawCourses.map((docSnap) => {
      const data = docSnap.data();
      const startDate = safeToDate(data.startDate);
      const endDate = safeToDate(data.endDate);

      // Real-time Override: Use Session dates if available
      const computeStart = latestSession ? latestSession.trainStart : startDate;
      const computeEnd = latestSession ? latestSession.trainEnd : endDate;

      // COMPUTE STANDARDIZED STATUS (Includes course-specific endDate check)
      const status = computeStatus(!!data.instructorId, computeStart, computeEnd, endDate);

      return {
        id: docSnap.id,
        ...data,
        startDate,
        endDate,
        status, // Reactive status
        createdAt: safeToDate(data.createdAt),
        updatedAt: safeToDate(data.updatedAt),
      } as Course;
    });

    setCourses(formatted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rawCourses.map(d => ({ id: d.id, status: d.data().status }))), JSON.stringify(latestSession)]);

  // --- Derived stats ---
  const completionRate = courses.length
    ? Math.round((courses.filter((c) => c.status === "completed").length / courses.length) * 100)
    : 0;

  const monthlySessions = courses.filter((c) => {
    const courseDate = safeToDate(c.startDate);
    return courseDate.getMonth() === new Date().getMonth();
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Home Page</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your audit training system</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Users" value={usersCount.toString()} icon={Users} color="blue" />
        <StatsCard title="Total Courses" value={courses.length.toString()} icon={BookOpen} color="green" />
        <StatsCard title="Completion Rate" value={`${completionRate}%`} icon={TrendingUp} color="yellow" />
        <StatsCard title="Monthly Course" value={monthlySessions.toString()} icon={Activity} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={showAllCourses ? "lg:col-span-3" : "lg:col-span-2"}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {showAllCourses ? "All Courses" : "Recent Courses"}
                </h3>
                <Button variant="outline" size="sm" onClick={() => setShowAllCourses((prev) => !prev)}>
                  {showAllCourses ? "Show Less" : "View All"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`grid grid-cols-1 gap-6 ${showAllCourses ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "md:grid-cols-2"}`}>
                {coursesLoading
                  ? [...Array(4)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-48"></div>
                    </div>
                  ))
                  : (showAllCourses ? courses : courses.slice(0, 2)).map((course) => (
                    <CourseCard key={course.id} course={course} showActions={false} />
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {!showAllCourses && (
          <div>
            <RecentActivity logs={logs as any} loading={logsLoading} />
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
