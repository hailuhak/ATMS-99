import React from "react";
import { motion } from "framer-motion";
import { Clock, Calendar, BookOpen, Edit2, Trash2 } from "lucide-react";
import { Course } from "../../types";
import { Card, CardContent, CardFooter, CardHeader } from "../ui/Card";
import { Button } from "../ui/Button";

// ==== Color Configurations ====
const levelColors: Record<string, string> = {
  beginner: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  advanced: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

// ==== Utility Function to Format Date ====
export const formatDate = (value: any): string => {
  if (!value) return "N/A";

  try {
    // Handle Firestore Timestamp
    if (value?.seconds) {
      return new Date(value.seconds * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    // Handle JS Date object
    if (value instanceof Date) {
      return value.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    // Handle string or numeric date
    const parsedDate = new Date(value);
    return isNaN(parsedDate.getTime())
      ? "Invalid Date"
      : parsedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  } catch {
    return "Invalid Date";
  }
};

// ==== Props ====
interface CourseCardProps {
  course: Course;
  onEnroll?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  showActions?: boolean;
  className?: string;
  onUnenroll?: () => Promise<void>;
  onLessonComplete?: (lessonName: string) => Promise<void>;
  onCourseComplete?: () => Promise<void>;
}

// ==== Main Component ====
export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  onEnroll,
  onEdit,
  onDelete,
  onView,
  showActions = true,
  className = "",
}) => {
  const levelColor = levelColors[course.level ?? "default"];
  const statusColor = statusColors[course.status ?? "default"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={`group relative hover:shadow-2xl transition-all duration-500 rounded-[2rem] border border-gray-100 dark:border-gray-800 flex flex-col h-full min-h-[260px] overflow-hidden ${className}`}
      >
        {/* Decorative Top Accent */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${levelColor.split(' ')[0]}`} />

        {/* ===== Header ===== */}
        <CardHeader className="pt-6 pb-2">
          <div className="flex justify-between items-start mb-2">
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-0.5 rounded-xl text-[10px] uppercase tracking-wider font-bold shadow-sm ${levelColor}`}>
                {course.level || "Beginner"}
              </span>
              <span className={`px-3 py-0.5 rounded-xl text-[10px] uppercase tracking-wider font-bold shadow-sm ${statusColor}`}>
                {course.status || "Active"}
              </span>
            </div>
          </div>

          <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
            {course.title || "Untitled Course"}
          </h3>

          <div className="mt-2 flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-[10px] uppercase">
              {(course.instructorName || 'U').charAt(0)}
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {course.instructorName || "Unknown Instructor"}
            </p>
          </div>
        </CardHeader>

        {/* ===== Content ===== */}
        <CardContent className="flex-1 flex flex-col justify-center py-2">
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400">
              <div className="p-1.5 rounded-xl bg-blue-50/50 dark:bg-blue-900/20">
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-[12px] font-bold tracking-tight">{course.hours ? `${course.hours} hrs` : "N/A"}</span>
            </div>
            <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400">
              <div className="p-1.5 rounded-xl bg-purple-50/50 dark:bg-purple-900/20">
                <BookOpen className="w-4 h-4 text-purple-500" />
              </div>
              <span className="text-[12px] font-bold tracking-tight truncate">{course.category || "General"}</span>
            </div>
            <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400">
              <div className="p-1.5 rounded-xl bg-green-50/50 dark:bg-green-900/20">
                <Calendar className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400">Starts</span>
                <span className="text-[11px] font-bold tracking-tight">{formatDate(course.startDate)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-gray-600 dark:text-gray-400">
              <div className="p-1.5 rounded-xl bg-red-50/50 dark:bg-red-900/20">
                <Calendar className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400">Ends</span>
                <span className="text-[11px] font-bold tracking-tight">{course.endDate ? formatDate(course.endDate) : "N/A"}</span>
              </div>
            </div>
          </div>
        </CardContent>

        {/* ===== Footer (Actions) ===== */}
        {showActions && (
          <CardFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-between mt-4">
            <div className="flex flex-1 gap-2 flex-wrap">
              {onView && (
                <Button variant="outline" size="sm" onClick={onView} className="flex-1">
                  View Details
                </Button>
              )}
            </div>

            {onEnroll && course.status === "active" && (
              <div className="mt-2 sm:mt-0">
                <Button size="sm" onClick={onEnroll}>
                  Enroll Now
                </Button>
              </div>
            )}

            <div className="flex gap-2 flex-wrap pb-2">
              {onEdit && (
                <button
                  onClick={onEdit}
                  title="Edit Course"
                  className="group/btn bg-blue-50/80 dark:bg-blue-900/20 hover:bg-blue-500 text-blue-600 dark:text-blue-400 hover:text-white p-2 rounded-xl flex items-center justify-center w-9 h-9 transition-all duration-300 shadow-sm hover:shadow-blue-200 dark:hover:shadow-none border border-blue-100 dark:border-blue-800 hover:border-blue-500 transform hover:scale-110 active:scale-95"
                >
                  <Edit2 className="w-4 h-4 transition-transform group-hover/btn:rotate-12" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  title="Delete Course"
                  className="group/btn bg-red-50/80 dark:bg-red-900/20 hover:bg-red-500 text-red-600 dark:text-red-400 hover:text-white p-2 rounded-xl flex items-center justify-center w-9 h-9 transition-all duration-300 shadow-sm hover:shadow-red-200 dark:hover:shadow-none border border-red-100 dark:border-red-800 hover:border-red-500 transform hover:scale-110 active:scale-95"
                >
                  <Trash2 className="w-4 h-4 transition-transform group-hover/btn:-rotate-12" />
                </button>
              )}
            </div>
          </CardFooter>
        )}
      </Card>
    </motion.div>
  );
};
