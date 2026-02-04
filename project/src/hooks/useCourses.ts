import { useEffect, useState, useCallback, useMemo } from "react";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { User, Course } from "../types";
import { safeToDate, computeStatus } from "../lib/courseUtils";

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
  const [latestSession, setLatestSession] = useState<any>(null);

  // Fetch the latest session for status calculation
  useEffect(() => {
    const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setLatestSession(snapshot.docs[0].data());
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch all courses (real-time) and apply reactive status
  useEffect(() => {
    const colRef = collection(db, "courses");
    const q = query(colRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const courses = snapshot.docs.map((doc) => {
        const data = doc.data();
        const courseEndDate = safeToDate(data.endDate);
        const sessionEndDate = latestSession ? safeToDate(latestSession.trainEnd) : courseEndDate;

        const status = computeStatus(
          !!data.instructorId,
          sessionEndDate,
          courseEndDate
        );

        return {
          id: doc.id,
          ...data,
          status, // Reactive status override
        } as Course;
      });

      // Apply local status filter if provided
      const filtered = statusFilter
        ? courses.filter(c => c.status === statusFilter)
        : courses;

      setAllCourses(filtered);
    });

    return () => unsubscribe();
  }, [statusFilter, latestSession]);

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

        // Auto-update status for enrolled courses based on reactive logic
        let needsUpdate = false;
        const sessionEnd = latestSession ? safeToDate(latestSession.trainEnd) : null;

        courses = courses.map((c) => {
          const ce = safeToDate(c.endDate);
          const e = sessionEnd || ce;
          const status = computeStatus(!!c.instructorId, e, ce);

          if (c.status !== status) {
            needsUpdate = true;
            return { ...c, status };
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
  }, [currentUser, latestSession]);

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
        startDate: safeToDate(course.startDate),
        endDate: safeToDate(course.endDate),
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
