import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { CourseCard } from "../../../components/courses/CourseCard";
import { Input } from "../../../components/ui/Input";
import { Card, CardContent } from "../../../components/ui/Card";
import { User, Course } from "../../../types";
import { safeToDate, computeStatus } from "../../../lib/courseUtils";
interface BrowseCoursesProps {
  currentUser?: User | null;
}

export const BrowseCourses: React.FC<BrowseCoursesProps> = ({ currentUser }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Courses");
  const [selectedLevel, setSelectedLevel] = useState("All Levels");
  const [latestSession, setLatestSession] = useState<any>(null);

  // Fetch session dates for real-time status
  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(1));
    return onSnapshot(q, (snap) => {
      if (!snap.empty) setLatestSession(snap.docs[0].data());
    });
  }, []);

  // Fetch courses from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "courses"), (snapshot) => {
      const fetchedCourses = snapshot.docs.map((doc) => {
        const data = doc.data();
        const courseEndDate = safeToDate(data.endDate);
        const sessionEndDate = latestSession ? safeToDate(latestSession.trainEnd) : courseEndDate;
        const status = computeStatus(!!data.instructorId, sessionEndDate, courseEndDate);

        return {
          id: doc.id,
          ...data,
          status, // Reactive override
        } as Course;
      });
      setCourses(fetchedCourses);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [latestSession]);

  // Extract unique categories & levels
  const categories = useMemo(() => {
    const unique = new Set(courses.map((c) => c.category).filter(Boolean));
    return ["All Courses", ...unique];
  }, [courses]);

  const levels = useMemo(() => {
    const unique = new Set(courses.map((c) => c.level).filter(Boolean));
    return ["All Levels", ...unique];
  }, [courses]);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const title = course.title?.toLowerCase() || "";
      const instructor = course.instructorName?.toLowerCase() || "";
      const queryStr = searchTerm.toLowerCase();

      const matchesSearch =
        title.includes(queryStr) ||
        instructor.includes(queryStr);

      const matchesCategory =
        selectedCategory === "All Courses" ||
        course.category === selectedCategory;

      const matchesLevel =
        selectedLevel === "All Levels" || course.level === selectedLevel;

      return matchesSearch && matchesCategory && matchesLevel;
    });
  }, [courses, searchTerm, selectedCategory, selectedLevel]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">
          Browse Courses
        </h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          Find the right course for you — updated in real time
        </p>
      </div>

      <Card className="shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-200 dark:border-gray-700 rounded-3xl overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 w-full">
            {/* Search Bar */}
            <div className="flex-1">
              <Input
                placeholder="Search for courses, trainers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-12 rounded-2xl border-gray-200 focus:ring-blue-500 shadow-sm"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-12 px-4 border border-gray-200 rounded-2xl dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer shadow-sm font-medium"
              >
                {categories.map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>

              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="h-12 px-4 border border-gray-200 rounded-2xl dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer shadow-sm font-medium"
              >
                {levels.map((lvl) => (
                  <option key={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Course Grid */}
      {loading ? (
        <p className="text-gray-500 text-center">Loading courses...</p>
      ) : filteredCourses.length === 0 ? (
        <p className="text-gray-500 text-center">No courses found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} showActions={false} />
          ))}
        </div>
      )}
    </div>
  );
};
