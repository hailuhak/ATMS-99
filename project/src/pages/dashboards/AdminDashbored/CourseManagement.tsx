import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Plus } from "lucide-react";
import { Course } from "../../../types";
import { CourseCard } from "../../../components/courses/CourseCard";
import { useFirestoreQuery } from "../../../hooks/useFirestoreQuery";
import { db, auth } from "../../../lib/firebase";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { safeToDate, computeStatus } from "../../../lib/courseUtils";

interface GlobalSession {
  id?: string;
  title: string;
  regStart: Date;
  regEnd: Date;
  trainStart: Date;
  trainEnd: Date;
  createdAt?: Date;
}

interface TrainerProfile {
  id: string;
  displayName: string;
}

const normalize = (s?: string) => (s || "").toString().trim().toLowerCase();

const defaultCourseData: Omit<Course, "id" | "createdAt" | "updatedAt"> = {
  title: "",
  instructorName: "",
  instructorId: "",
  category: "",
  duration: 0,
  hours: 0,
  level: "beginner",
  startDate: new Date(),
  endDate: new Date(),
  materials: [],
  status: "draft",
  students: [],
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-4 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:hover:text-white font-bold text-xl"
          aria-label="Close modal"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
};

export const CourseManagement: React.FC = () => {
  const { data: coursesFromDB, loading: coursesLoading } = useFirestoreQuery<Course>(
    "courses",
    [orderBy("createdAt", "desc"), limit(50)]
  );

  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<GlobalSession[]>([]);
  const [trainers, setTrainers] = useState<TrainerProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [newCourse, setNewCourse] = useState<Omit<Course, "id" | "createdAt" | "updatedAt">>(
    defaultCourseData
  );
  const [loading, setLoading] = useState(false);

  /* -------------------------
     Sessions (real-time)
  ------------------------- */
  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const loaded = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: data.title,
          regStart: safeToDate(data.regStart),
          regEnd: safeToDate(data.regEnd),
          trainStart: safeToDate(data.trainStart),
          trainEnd: safeToDate(data.trainEnd),
          createdAt: safeToDate(data.createdAt),
        } as GlobalSession;
      });
      setSessions(loaded);
    });

    return () => unsub();
  }, []);

  /* -------------------------
     Trainers (real-time)
  ------------------------- */
  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "trainer"));
    const unsub = onSnapshot(q, (snap) => {
      const loaded = snap.docs.map((d) => ({
        id: d.id,
        displayName: d.data().displayName || "Unnamed Trainer",
      }));
      setTrainers(loaded);
    });
    return () => unsub();
  }, []);

  /* -------------------------
     Normalize courses
  ------------------------- */
  useEffect(() => {
    if (!coursesFromDB) return;
    const latestSession = sessions[0];

    const formatted = coursesFromDB.map((course) => {
      const startDate = safeToDate((course as any).startDate);
      const endDate = safeToDate((course as any).endDate);

      // Priority Logic: Use Session dates if available for real-time status calculation
      const computeEnd = latestSession ? latestSession.trainEnd : endDate;

      // COMPUTE STANDARDIZED STATUS (Includes course-specific endDate check)
      const status = computeStatus(!!course.instructorId, computeEnd, endDate);

      return {
        ...course,
        startDate,
        endDate,
        createdAt: safeToDate((course as any).createdAt),
        updatedAt: safeToDate((course as any).updatedAt),
        materials: course.materials || [],
        status,
      } as Course;
    });
    setCourses(formatted);
  }, [coursesFromDB, sessions]);

  /* -------------------------
     Filtered view
  ------------------------- */
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const term = normalize(searchTerm);
      const matchesSearch =
        normalize(course.title).includes(term) ||
        normalize(course.instructorName).includes(term);
      const matchesFilter = filterStatus === "all" || course.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [courses, searchTerm, filterStatus]);

  /* -------------------------
     Date validation
  ------------------------- */
  const validateDatesWithSessions = (startDate: Date, endDate: Date) => {
    if (sessions.length === 0) return true;
    const session = sessions[0];
    if (startDate < session.trainStart) {
      alert(`Course start date cannot be before session start: ${session.trainStart.toDateString()}`);
      return false;
    }
    if (endDate > session.trainEnd) {
      alert(`Course end date cannot be after session end: ${session.trainEnd.toDateString()}`);
      return false;
    }
    if (endDate < startDate) {
      alert("Course end date cannot be before start date.");
      return false;
    }
    return true;
  };

  /* -------------------------
     Activity logging
  ------------------------- */
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
    } catch (err: any) {
      console.error("Failed to log activity:", err);
    }
  };

  /* -------------------------
     Add Course
  ------------------------- */
  const handleAddCourse = async () => {
    if (!newCourse.title.trim()) {
      alert("Please fill the course title.");
      return;
    }
    if (!validateDatesWithSessions(new Date(newCourse.startDate as any), new Date(newCourse.endDate as any))) return;

    setLoading(true);

    try {
      const status = computeStatus(
        !!newCourse.instructorId,
        new Date(newCourse.endDate as any),
        new Date(newCourse.endDate as any)
      );

      const coursePayload = {
        ...newCourse,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "courses"), coursePayload);

      await logActivity("added", `course: ${newCourse.title}`);
      setNewCourse({ ...defaultCourseData });
      setShowForm(false);
      alert("Course added successfully!");
    } catch (err: any) {
      console.error(err);
      alert(`Error adding course: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------
     Save Edited Course
  ------------------------- */
  const handleSaveEdit = async () => {
    if (!editingCourse) return;
    if (!validateDatesWithSessions(new Date(editingCourse.startDate as any), new Date(editingCourse.endDate as any))) return;

    setLoading(true);

    try {
      const status = computeStatus(
        !!editingCourse.instructorId,
        new Date(editingCourse.endDate as any),
        new Date(editingCourse.endDate as any)
      );

      await updateDoc(doc(db, "courses", editingCourse.id!), {
        ...editingCourse,
        status,
        updatedAt: serverTimestamp(),
      });

      await logActivity("edited", `course: ${editingCourse.title}`);
      setEditingCourse(null);
      setShowForm(false);
      alert("Course updated successfully!");
    } catch (err: any) {
      console.error(err);
      alert(`Error updating course: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------
     Delete Course
  ------------------------- */
  const handleDeleteCourse = async (course: Course) => {
    if (!window.confirm("Are you sure you want to delete this course?")) return;

    setLoading(true);

    try {
      await deleteDoc(doc(db, "courses", course.id!));
      await logActivity("deleted", `course: ${course.title}`);
      alert("Course deleted successfully!");
    } catch (err: any) {
      console.error(err);
      alert(`Error deleting course: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------
     Auto-update courses logic
  ------------------------- */
  useEffect(() => {
    if (sessions.length === 0 || courses.length === 0) return;

    const latestSession = sessions[0];

    const runAutomations = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const course of courses) {
        const ce = safeToDate(course.endDate);
        ce.setHours(0, 0, 0, 0);

        // 1. Completion logic (Session End OR Course End)
        const computeEnd = latestSession.trainEnd;
        const status = computeStatus(!!course.instructorId, computeEnd, ce);

        if (course.status !== status && course.instructorId) {
          try {
            await updateDoc(doc(db, "courses", course.id), {
              status,
              updatedAt: serverTimestamp()
            });
            await logActivity("auto-updated", `course: ${course.title}`, `Status changed to ${status}.`);
          } catch (err) { console.error(err); }
        }
      }
    };

    runAutomations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, JSON.stringify(courses.map(c => ({ id: c.id, status: c.status })))]);

  const datePickerClass = "border rounded p-2 w-full dark:bg-gray-700 dark:text-white dark:border-gray-600";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Course Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage all courses</p>
        </div>
        <Button
          disabled={loading}
          onClick={() => {
            setShowForm(true);
            setEditingCourse(null);
            setNewCourse({ ...defaultCourseData, startDate: new Date(), endDate: new Date() });
          }}
        >
          <Plus className="w-4 h-4 mr-2" /> Add Course
        </Button>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Input
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-96"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)}>
        <div className="p-6 w-full max-w-lg mx-auto">
          <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
            {editingCourse ? "Edit Course" : "Add New Course"}
          </h2>

          <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
            <Input
              placeholder="Course Title"
              value={editingCourse ? editingCourse.title : newCourse.title}
              onChange={(e) =>
                editingCourse
                  ? setEditingCourse({ ...editingCourse, title: e.target.value })
                  : setNewCourse({ ...newCourse, title: e.target.value })
              }
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Assigned Trainer
              </label>
              <select
                className="w-full border rounded p-2 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                value={editingCourse ? editingCourse.instructorId : newCourse.instructorId}
                onChange={(e) => {
                  const val = e.target.value;
                  const trainer = trainers.find(t => t.id === val);
                  if (editingCourse) {
                    setEditingCourse({
                      ...editingCourse,
                      instructorId: val,
                      instructorName: trainer?.displayName || ""
                    });
                  } else {
                    setNewCourse({
                      ...newCourse,
                      instructorId: val,
                      instructorName: trainer?.displayName || ""
                    });
                  }
                }}
              >
                <option value="">-- Select Trainer --</option>
                {trainers.map(t => (
                  <option key={t.id} value={t.id}>{t.displayName}</option>
                ))}
              </select>
            </div>

            <Input
              placeholder="Category"
              value={editingCourse ? editingCourse.category : newCourse.category}
              onChange={(e) =>
                editingCourse
                  ? setEditingCourse({ ...editingCourse, category: e.target.value })
                  : setNewCourse({ ...newCourse, category: e.target.value })
              }
            />
            <Input
              type="number"
              placeholder="Hours"
              value={editingCourse ? editingCourse.hours || "" : newCourse.hours || ""}
              onChange={(e) =>
                editingCourse
                  ? setEditingCourse({ ...editingCourse, hours: Number(e.target.value) })
                  : setNewCourse({ ...newCourse, hours: Number(e.target.value) })
              }
            />

            <div className="flex gap-2">
              <div className="flex flex-col w-full">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <DatePicker
                  selected={(editingCourse ? editingCourse.startDate : newCourse.startDate) as Date}
                  onChange={(date: Date | null) => {
                    if (!date) return;
                    editingCourse
                      ? setEditingCourse({ ...editingCourse, startDate: date })
                      : setNewCourse({ ...newCourse, startDate: date })
                  }}
                  className={datePickerClass}
                />
              </div>
              <div className="flex flex-col w-full">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <DatePicker
                  selected={(editingCourse ? editingCourse.endDate : newCourse.endDate) as Date}
                  onChange={(date: Date | null) => {
                    if (!date) return;
                    editingCourse
                      ? setEditingCourse({ ...editingCourse, endDate: date })
                      : setNewCourse({ ...newCourse, endDate: date })
                  }}
                  className={datePickerClass}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button onClick={editingCourse ? handleSaveEdit : handleAddCourse} disabled={loading}>
              {editingCourse ? "Save Changes" : "Add Course"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coursesLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-64"></div>
            </div>
          ))
        ) : filteredCourses.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400">No courses found.</p>
        ) : (
          filteredCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              showActions={true}
              onEdit={() => {
                setEditingCourse(course);
                setShowForm(true);
              }}
              onDelete={() => handleDeleteCourse(course)}
              className="rounded-3xl border-none shadow-md hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 bg-white dark:bg-gray-800/80 backdrop-blur-sm"
            />
          ))
        )}
      </div>
    </div>
  );
};

export default CourseManagement;
