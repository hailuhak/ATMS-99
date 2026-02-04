import React, { useEffect, useState } from "react";
import { StatsCard } from "../../../components/Cards/StatsCard";
import { RecentActivity, ActivityLog } from "../../../components/Cards/RecentActivity";
import { BookOpen, Calendar, Users, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../../contexts/AuthContext";
import { CourseCard } from "../../../components/courses/CourseCard";
import { useCourses, EnrollmentCourse } from "../../../hooks/useCourses";
import { Course } from "../../../types";
import { db } from "../../../lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";

// ✅ Standardized safe date converter
const safeToDate = (v: any): Date => {
  if (!v) return new Date();
  if (typeof v.toDate === "function") return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
};

// ✅ Standardized status calculation
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

// Extend ActivityLog to include trainerId
export interface ActivityLogExtended extends ActivityLog {
  trainerId?: string;
}

export const TrainerOverview: React.FC = () => {
  const { currentUser } = useAuth();
  const { allCourses, loading } = useCourses(currentUser);

  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({
    courses: 0,
    activeSessions: 0,
    totalStudents: 0,
    completionRate: 0,
  });

  const [recentActivities, setRecentActivities] = useState<ActivityLogExtended[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [latestSession, setLatestSession] = useState<any>(null);
  const [rawCourses, setRawCourses] = useState<Course[]>([]);

  // Fetch sessions for real-time training dates
  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(1));
    return onSnapshot(q, (snap) => {
      if (snap.empty) return;
      const data = snap.docs[0].data();
      setLatestSession({
        ...data,
        trainStart: safeToDate(data.trainStart),
        trainEnd: safeToDate(data.trainEnd)
      });
    });
  }, []);

  // Fetch all courses for real-time status calculation
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "courses"), where("instructorId", "==", currentUser.uid));
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
      setRawCourses(docs);
    });
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    // Map raw courses to finalized status
    const trainerCourses = rawCourses.map(course => {
      const startDate = safeToDate(course.startDate);
      const endDate = safeToDate(course.endDate);
      const computeStart = latestSession ? latestSession.trainStart : startDate;
      const computeEnd = latestSession ? latestSession.trainEnd : endDate;
      const status = computeStatus(true, computeStart, computeEnd, endDate);

      return { ...course, startDate, endDate, status } as Course;
    });

    setMyCourses(trainerCourses);

    // Active sessions
    const activeCount = trainerCourses.filter((c) => c.status === "active").length;

    // Completion rate
    const completedCourses = trainerCourses.filter((c) => c.status === "completed").length;
    const completionRate = trainerCourses.length
      ? +((completedCourses / trainerCourses.length) * 100).toFixed(1)
      : 0;

    setStats(prev => ({
      ...prev,
      courses: trainerCourses.length,
      activeSessions: activeCount,
      completionRate,
    }));

    // Fetch enrollments logic... (keep as is but update to use trainerCourses)
    if (trainerCourses.length === 0) {
      setStats(prev => ({ ...prev, totalStudents: 0 }));
      return;
    }

    const courseIds = trainerCourses.map((c) => c.id);
    const enrollmentCol = collection(db, "enrollments");
    const q = query(enrollmentCol, where("courses", "!=", [])); // Firestore array check

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentsSet = new Set<string>();

      snapshot.forEach((doc) => {
        const data = doc.data() as { courses: EnrollmentCourse[]; userId: string };
        if (data.courses) {
          data.courses.forEach((enrolledCourse) => {
            if (courseIds.includes(enrolledCourse.courseId)) {
              studentsSet.add(data.userId);
            }
          });
        }
      });

      setStats((prev) => ({ ...prev, totalStudents: studentsSet.size }));
    });

    return () => unsubscribe();
  }, [allCourses, currentUser]);

  // Fetch recent activities (trainer + trainees assigned to this trainer)
  useEffect(() => {
    if (!currentUser?.uid) return;

    const activityCol = collection(db, "activityLogs");

    const q = query(
      activityCol,
      where("trainerId", "==", currentUser.uid),
      orderBy("timestamp", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activities: ActivityLogExtended[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userName: data.userName || currentUser.displayName || "Trainer",
          action: data.action || "",
          target: data.target || "",
          details: data.details || "",
          timestamp: data.timestamp?.toDate() || new Date(),
          trainerId: data.trainerId || undefined,
        };
      });

      setRecentActivities(activities);
      setLoadingActivities(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const [showAllCourses, setShowAllCourses] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Trainer Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Welcome back, {currentUser?.displayName || "Trainer"}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="My Courses" value={stats.courses.toString()} icon={BookOpen} color="blue" />
        <StatsCard title="Active Sessions" value={stats.activeSessions.toString()} icon={Calendar} color="green" />
        <StatsCard title="Total Students" value={stats.totalStudents.toString()} icon={Users} color="yellow" />
        <StatsCard title="Completion Rate" value={`${stats.completionRate}%`} icon={TrendingUp} color="purple" />
      </div>

      {/* Courses and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Courses */}
        <div className={showAllCourses ? "lg:col-span-3" : "lg:col-span-2"}>
          <Card className="h-full">
            <CardHeader>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {showAllCourses ? "All My Courses" : "Recent Courses"}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllCourses(!showAllCourses)}
                >
                  {showAllCourses ? "Show Less" : "View All"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`grid grid-cols-1 gap-6 ${showAllCourses ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "md:grid-cols-2"}`}>
                {loading
                  ? [...Array(4)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-48"></div>
                    </div>
                  ))
                  : myCourses.length === 0
                    ? (
                      <div className="col-span-full text-center py-8">
                        <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">
                          You haven't created any courses yet.
                        </p>
                      </div>
                    )
                    : myCourses
                      .sort((a, b) => safeToDate(b.startDate).getTime() - safeToDate(a.startDate).getTime())
                      .slice(0, showAllCourses ? myCourses.length : 2)
                      .map((course) => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          className="rounded-3xl border-none shadow-md hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 bg-white dark:bg-gray-800/80 backdrop-blur-sm"
                        />
                      ))
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        {!showAllCourses && (
          <div>
            <RecentActivity logs={recentActivities} loading={loadingActivities} limitCount={4} />
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainerOverview;
