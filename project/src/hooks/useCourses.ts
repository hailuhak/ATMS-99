import { useEffect, useState, useCallback, useMemo } from "react";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { User, Course } from "../types";

export interface EnrollmentCourse {
  courseId: string;
  enrolledAt: Date;
  title: string;
  instructorId?: string;
  instructorName?: string;
  hours?: number;
  level?: "beginner" | "intermediate" | "advanced";
  category?: string;
  startDate?: Date;
  endDate?: Date;
  materials?: string[];
  status: "active" | "draft" | "completed" | "cancelled";
}

export interface Enrollment {
  userId: string;
  courses: EnrollmentCourse[];
}

export const useCourses = (currentUser: User | null, statusFilter?: string) => {
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment | null>(null);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all courses (real-time)
  useEffect(() => {
    const colRef = collection(db, "courses");
    const q = statusFilter ? query(colRef, where("status", "==", statusFilter)) : colRef;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const courses = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Course[];
      setAllCourses(courses);
    });

    return () => unsubscribe();
  }, [statusFilter]);

  // Fetch user enrollments (real-time)
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const enrollmentRef = doc(db, "enrollments", currentUser.uid);

    const unsubscribe = onSnapshot(enrollmentRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Enrollment;

        // Convert date fields
        let courses: EnrollmentCourse[] = data.courses.map((c) => ({
          ...c,
          enrolledAt: c.enrolledAt instanceof Date ? c.enrolledAt : new Date(c.enrolledAt),
          startDate: c.startDate ? new Date(c.startDate) : undefined,
          endDate: c.endDate ? new Date(c.endDate) : undefined,
        }));

        // Auto-update completed courses
        const now = new Date();
        let needsUpdate = false;
        courses = courses.map((c) => {
          if (c.endDate && c.endDate < now && c.status === "active") {
            needsUpdate = true;
            return { ...c, status: "completed" };
          }
          return c;
        });

        if (needsUpdate) {
          await updateDoc(enrollmentRef, { courses });
        }

        setEnrollments({ userId: data.userId, courses });
        setEnrolledCourseIds(courses.map((c) => c.courseId));
      } else {
        setEnrollments(null);
        setEnrolledCourseIds([]);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Enroll in a course
  const enrollCourse = useCallback(
    async (courseId: string) => {
      if (!currentUser) throw new Error("User not logged in");
      if (enrolledCourseIds.includes(courseId)) throw new Error("Already enrolled!");

      const course = allCourses.find((c) => c.id === courseId);
      if (!course) throw new Error("Course not found");

      const enrollmentRef = doc(db, "enrollments", currentUser.uid);

      const newEnrollment: EnrollmentCourse = {
        courseId,
        enrolledAt: new Date(),
        title: course.title,
        instructorId: String(course.instructorId),
        instructorName: course.instructorName,
        hours: course.hours,
        level: course.level,
        category: course.category,
        startDate: course.startDate,
        endDate: course.endDate,
        materials: course.materials || [],
        status: course.status,
      };

      const snap = await getDoc(enrollmentRef);

      if (snap.exists()) {
        const data = snap.data() as Enrollment;
        await updateDoc(enrollmentRef, { courses: [...data.courses, newEnrollment] });
      } else {
        const newData: Enrollment = { userId: currentUser.uid, courses: [newEnrollment] };
        await setDoc(enrollmentRef, newData);
      }
    },
    [currentUser, allCourses, enrolledCourseIds]
  );

  // Unenroll from a course
  const unenrollCourse = useCallback(
    async (courseId: string) => {
      if (!currentUser) throw new Error("User not logged in");

      const enrollmentRef = doc(db, "enrollments", currentUser.uid);
      const snap = await getDoc(enrollmentRef);
      if (!snap.exists()) return;

      const data = snap.data() as Enrollment;
      const updatedCourses = data.courses.filter((c) => c.courseId !== courseId);
      await updateDoc(enrollmentRef, { courses: updatedCourses });
    },
    [currentUser]
  );

  // Recent courses (last 2)
  const recentCourses = useMemo(() => {
    if (!enrollments) return [];
    return enrollments.courses
      .sort((a, b) => b.enrolledAt.getTime() - a.enrolledAt.getTime())
      .slice(0, 2);
  }, [enrollments]);

  return {
    allCourses,
    enrollments,
    enrolledCourseIds,
    enrollCourse,
    unenrollCourse,
    recentCourses,
    loading,
  };
};
