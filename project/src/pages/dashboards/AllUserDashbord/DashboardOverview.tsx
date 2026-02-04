import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Users, Award } from "lucide-react";
import { StatsCard } from "../../../components/Cards/StatsCard";
import { CourseCard } from "../../../components/courses/CourseCard";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { User, Course } from "../../../types";
import { db } from "../../../lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

interface DashboardOverviewProps {
  currentUser: User | null;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ currentUser }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [trainersCount, setTrainersCount] = useState(0);
  const [successRate, setSuccessRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // 🔄 real-time courses
    const unsubscribeCourses = onSnapshot(collection(db, "courses"), (snapshot) => {
      const fetchedCourses: Course[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Course[];
      setCourses(fetchedCourses);
      setLoading(false);

      // calculate success rate from courses
      const completed = fetchedCourses.filter((c) => c.status === "completed").length;
      const active = fetchedCourses.filter((c) => c.status === "active").length;
      const total = completed + active;

      if (total > 0) {
        setSuccessRate(Math.round((completed / total) * 100));
      } else {
        setSuccessRate(null);
      }
    });

    // 🔄 real-time trainers
    const trainersQuery = query(collection(db, "users"), where("role", "==", "trainer"));
    const unsubscribeTrainers = onSnapshot(trainersQuery, (snapshot) => {
      setTrainersCount(snapshot.size);
    });

    return () => {
      unsubscribeCourses();
      unsubscribeTrainers();
    };
  }, []);

  const isApproved = currentUser?.role && currentUser.role !== "pending";
  const visibleCourses = showAll ? courses : courses.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <motion.div
        className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-3xl p-6 sm:p-10 text-white shadow-xl shadow-blue-500/20"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl sm:text-4xl font-black mb-3 tracking-tight">
          Welcome, {currentUser?.displayName?.split(" ")[0] || "User"}!
        </h1>
        <p className="text-blue-100 text-sm sm:text-xl font-medium opacity-90 max-w-2xl">
          Discover audit training courses to advance your career and master new skills.
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <StatsCard
          title="All Courses"
          value={courses.length.toString()}
          changeType="neutral"
          icon={BookOpen}
          color="blue"
        />
        <StatsCard
          title="Expert Trainers"
          value={trainersCount.toString()}
          changeType="neutral"
          icon={Users}
          color="green"
        />
        <StatsCard
          title="Success Rate"
          value={successRate !== null ? `${successRate}%` : "—"}
          changeType="increase"
          icon={Award}
          color="yellow"
        />
      </div>

      {/* Featured Courses */}
      <Card className="rounded-3xl border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 gap-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Featured Courses
          </h3>
          {courses.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowAll(!showAll)}
              className="w-full sm:w-auto rounded-xl font-bold border-2"
            >
              {showAll ? "Show Less" : "View All Courses"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <p className="text-center py-10 text-gray-500">Loading courses...</p>
          ) : courses.length === 0 ? (
            <p className="text-center py-10 text-gray-500">No courses available at the moment.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  showActions={isApproved}
                  onEnroll={() => console.log("Enroll in:", course.title)}
                  onView={() => console.log("View details:", course.title)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
