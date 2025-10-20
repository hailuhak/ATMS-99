// ✅ Common import for Firestore Timestamp support
import { Timestamp } from "firebase/firestore";

// -------------------- USER --------------------
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: "admin" | "trainer" | "trainee" | "user" | "pending";
  photoURL?: string;
  createdAt: Date | Timestamp; // ✅ Firestore-safe
  lastLogin: Date | Timestamp;
}

// -------------------- COURSE --------------------
export interface Course {
  id: string;
  title: string;
  instructorId: string[]; // ✅ keep array since multiple trainers may exist
  instructorName: string;
  hours?: number; // in hours
  duration?: number; // in days
  level: "beginner" | "intermediate" | "advanced";
  category: string;
  startDate: Date | Timestamp;
  endDate: Date | Timestamp;
  students: string[];
  materials: string[];
  status: "draft" | "active" | "completed" | "cancelled";
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  completionRate?: number;
}

// -------------------- TRAINING SESSION --------------------
export interface Session {
  id: string;
  courseId: string;
  courseName: string;
  createdAt: Date | Timestamp;
  date: Date | Timestamp;
  hours: number;
  trainerId: string;
  trainStart: Date;
  trainEnd: Date;
  topic: string;
  description?: string;
  location?: string
  attendees?: {
    studentId: string;
    studentName: string;
    status?: "present" | "absent";
    trainerName?: string;
  }[];
}

// -------------------- ACTIVITY LOG --------------------
export interface ActivityLog {
  id: string;
  userName: string;
  userId: string;
  userRole: "admin" | "trainer" | "trainee";
  trainerId?: string;
  action: string;
  target?: string;
  details?: string;
  timestamp: Date | Timestamp; // ✅ Firestore-safe
}

// -------------------- PROGRESS --------------------
export interface Progress {
  id: string;
  userId: string;
  courseId: string;
  completedSessions: string[];
  progress: number;
  lastAccessed: Date | Timestamp;
  certificateIssued: boolean;
}

// -------------------- NOTIFICATION --------------------
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: Date | Timestamp;
}

// -------------------- ATTENDANCE --------------------
export interface AttendanceRecord {
  id?: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  status: "present" | "absent";
  timestamp: Date | Timestamp;
}

// -------------------- FEEDBACK --------------------
export interface Feedback {
  id: string;
  userId: string;
  courseId: string;
  rating: number;
  comments: string;
  createdAt: Date | Timestamp;
}

// -------------------- MATERIALS --------------------
export interface Materials {
  id: string;
  title: string;
  type: "document" | "video" | "link" | "other";
  url: string;
  description?: string;
  uploadedBy: string;
  uploadedAt: Date | Timestamp;
}

// -------------------- CHAT --------------------
export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  timestamp: Date | Timestamp;
  read: boolean;
}

// -------------------- SUPPORT --------------------
export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// -------------------- REPORT --------------------
export interface Report {
  id: string;
  title: string;
  generatedBy: string;
  generatedAt: Date | Timestamp;
  type: "user-activity" | "course-completion" | "attendance" | "custom";
  url: string;
}

// -------------------- SETTINGS --------------------
export interface SystemSettings {
  id: string;
  key: string;
  value: string;
  description?: string;
  updatedAt: Date | Timestamp;
}

// -------------------- GENERIC RESPONSE --------------------
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// -------------------- PAGINATION --------------------
export interface Pagination {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
}

// -------------------- ENROLLMENT --------------------
export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: Date | Timestamp;
  title: string;
  instructorId?: string;
  instructorName?: string;
  hours?: number;
  level?: "beginner" | "intermediate" | "advanced";
  category?: string;
  startDate?: Date | Timestamp;
  endDate?: Date | Timestamp;
  materials?: string[];
  status: "active" | "draft" | "completed" | "cancelled";
}

export interface EnrollmentCourse {
  id: string;
  title: string;
  students?: number;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  status?: string;
}

export interface EnrollmentResponse {
  success: boolean;
  data?: EnrollmentCourse[];
  error?: string;
}
