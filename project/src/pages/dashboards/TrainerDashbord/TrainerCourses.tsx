import React, { useState, useEffect } from 'react';
import { CourseCard } from '../../../components/courses/CourseCard';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Plus, BookOpen } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';
import {
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit
} from 'firebase/firestore';
import { auth } from '../../../lib/firebase';

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

// Helper for logging activity
const logActivity = async (action: string, target: string, details?: string) => {
  if (!auth.currentUser) return;
  try {
    await addDoc(collection(db, 'activityLogs'), {
      userId: auth.currentUser.uid,
      userName: auth.currentUser.displayName || 'Trainer',
      userRole: 'trainer',
      trainerId: auth.currentUser.uid,
      action,
      target,
      details: details || '',
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
};

interface FormData {
  title: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  status: 'active' | 'draft' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string;
  hours: string;
}

export const TrainerCourses: React.FC = () => {
  const { currentUser } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [sessionDates, setSessionDates] = useState<{ trainStart: string; trainEnd: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    category: '',
    level: 'beginner',
    status: 'active',
    startDate: '',
    endDate: '',
    hours: '',
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});

  // Fetch session dates (real-time)
  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), limit(1));
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setSessionDates({
          trainStart: safeToDate(data.trainStart).toISOString().split('T')[0],
          trainEnd: safeToDate(data.trainEnd).toISOString().split('T')[0],
        });
      }
    });
  }, []);

  // Fetch trainer courses (real-time)
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'courses'), where('instructorId', '==', currentUser.uid));

    return onSnapshot(q, (snapshot) => {
      const loaded = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const startDate = safeToDate(data.startDate);
        const endDate = safeToDate(data.endDate);

        // Compute real-time status
        const computeStart = sessionDates ? safeToDate(sessionDates.trainStart) : startDate;
        const computeEnd = sessionDates ? safeToDate(sessionDates.trainEnd) : endDate;
        const status = computeStatus(true, computeStart, computeEnd, endDate);

        return {
          id: docSnap.id,
          ...data,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          status,
        };
      });
      setCourses(loaded);
      setCoursesLoading(false);
    });
  }, [currentUser, sessionDates]);

  // Validate field with session date checks
  const validateField = (name: string, value: string) => {
    if (!value) return 'This field is required';

    const start = name === 'startDate' ? new Date(value) : formData.startDate ? new Date(formData.startDate) : null;
    const end = name === 'endDate' ? new Date(value) : formData.endDate ? new Date(formData.endDate) : null;
    const sessionStart = sessionDates ? new Date(sessionDates.trainStart) : null;
    const sessionEnd = sessionDates ? new Date(sessionDates.trainEnd) : null;

    if (name === 'startDate') {
      if (end && start! > end) return 'Start date cannot be after end date';
      if (sessionStart && start! < sessionStart)
        return `Start date cannot be before session start (${sessionDates!.trainStart})`;
      if (sessionEnd && start! > sessionEnd)
        return `Start date cannot be after session end (${sessionDates!.trainEnd})`;
    }

    if (name === 'endDate') {
      if (start && end! < start) return 'End date cannot be before start date';
      if (sessionStart && end! < sessionStart)
        return `End date cannot be before session start (${sessionDates!.trainStart})`;
      if (sessionEnd && end! > sessionEnd)
        return `End date cannot be after session end (${sessionDates!.trainEnd})`;
    }

    if (name === 'hours' && Number(value) <= 0) return 'Hours must be greater than 0';
    if ((name === 'title' || name === 'category') && !value.trim()) return 'This field is required';

    return '';
  };

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = e.target;
    if (errors[name as keyof FormData]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Save new or edited course
  const saveCourse = async () => {
    if (!currentUser) return;
    setLoading(true);

    const newErrors: any = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, (formData as any)[key]);
      if (error) newErrors[key] = error;
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      if (editingCourseId) {
        await updateDoc(doc(db, 'courses', editingCourseId), {
          title: formData.title,
          category: formData.category,
          level: formData.level,
          status: formData.status,
          startDate: formData.startDate,
          endDate: formData.endDate,
          hours: Number(formData.hours),
          updatedAt: serverTimestamp(),
        });

        await logActivity('Updated Course', formData.title);

        setEditingCourseId(null);
      } else {
        const newCourseRef = await addDoc(collection(db, 'courses'), {
          title: formData.title,
          category: formData.category,
          level: formData.level,
          status: formData.status,
          startDate: formData.startDate,
          endDate: formData.endDate,
          hours: Number(formData.hours),
          instructorId: currentUser.uid,
          instructorName: currentUser.displayName,
          createdAt: serverTimestamp(),
          students: [],
        });

        await logActivity('Added Course', formData.title, `Course created with ID: ${newCourseRef.id}`);
      }

      setFormData({
        title: '',
        category: '',
        level: 'beginner',
        status: 'active',
        startDate: '',
        endDate: '',
        hours: '',
      });
      setErrors({});
      setShowForm(false);
    } catch (err) {
      console.error('Error saving course:', err);
    } finally {
      setLoading(false);
    }
  };

  // Edit a course
  const handleEditCourse = (course: any) => {
    setFormData({
      title: course.title,
      category: course.category,
      level: course.level,
      status: course.status,
      startDate: course.startDate,
      endDate: course.endDate,
      hours: String(course.hours),
    });
    setEditingCourseId(course.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Courses</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your training courses</p>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            setEditingCourseId(null);
            setFormData({
              title: '',
              category: '',
              level: 'beginner',
              status: 'active',
              startDate: '',
              endDate: '',
              hours: '',
            });
          }}
        >
          <Plus className="w-4 h-4 mr-2" /> Add Course
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg space-y-4">
          <Input
            name="title"
            label="Course Title"
            placeholder="Enter course title"
            value={formData.title}
            onChange={handleChange}
            onFocus={handleFocus}
            error={errors.title}
          />
          <Input
            name="category"
            label="Category"
            placeholder="Enter course category"
            value={formData.category}
            onChange={handleChange}
            onFocus={handleFocus}
            error={errors.category}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Level</label>
              <select
                name="level"
                value={formData.level}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              name="startDate"
              type="date"
              label="Start Date"
              value={formData.startDate}
              onChange={handleChange}
              onFocus={handleFocus}
              error={errors.startDate}
            />
            <Input
              name="endDate"
              type="date"
              label="End Date"
              value={formData.endDate}
              onChange={handleChange}
              onFocus={handleFocus}
              error={errors.endDate}
            />
          </div>
          <Input
            name="hours"
            type="number"
            label="Hours"
            placeholder="Enter course hours"
            value={formData.hours}
            onChange={handleChange}
            onFocus={handleFocus}
            error={errors.hours}
          />
          <div className="flex space-x-3">
            <Button onClick={saveCourse} disabled={loading}>
              {loading ? (editingCourseId ? 'Updating...' : 'Saving...') : editingCourseId ? 'Update Course' : 'Save Course'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setFormData({
                  title: '',
                  category: '',
                  level: 'beginner',
                  status: 'active',
                  startDate: '',
                  endDate: '',
                  hours: '',
                });
                setErrors({});
                setShowForm(false);
                setEditingCourseId(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coursesLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-64"></div>
            </div>
          ))
        ) : courses.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No courses assigned yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              You will see courses here once the admin assigns them to you.
            </p>
          </div>
        ) : (
          courses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              showActions={true}
              onEdit={() => handleEditCourse(course)}
              className="rounded-3xl border-none shadow-md hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 bg-white dark:bg-gray-800/80 backdrop-blur-sm"
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TrainerCourses;
