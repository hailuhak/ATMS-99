import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  File,
  Download,
  Image as ImageIcon,
  Video as VideoIcon,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { db } from '../../../lib/firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import { Course } from '../../../types';

interface Material {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  description?: string;
  content: string;
  courseId?: string;
  courseName?: string;
  trainerName?: string;
  trainerId?: string;
}

interface FileWithDescription {
  file: File;
  description: string;
  courseId: string;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

export const TrainingMaterials: React.FC = () => {
  const { currentUser } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [uploadQueue, setUploadQueue] = useState<FileWithDescription[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // -------------------- Toast --------------------
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  // -------------------- Fetch Courses --------------------
  useEffect(() => {
    if (!currentUser) return;

    const fetchCourses = async () => {
      try {
        const q = query(
          collection(db, 'courses'),
          where('instructorId', '==', currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Course[];
        setCourses(data);
      } catch (error) {
        console.error('Error fetching courses:', error);
        showToast('Failed to load courses', 'error');
      }
    };

    fetchCourses();
  }, [currentUser]);

  // -------------------- Real-Time Materials --------------------
  useEffect(() => {
    if (!currentUser) return;

    const materialsRef = collection(db, 'trainingMaterials');
    const q = query(materialsRef, where('trainerId', '==', currentUser.uid));

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const data: Material[] = snapshot.docs.map(doc => {
          const mat = doc.data() as Omit<Material, 'id'>;
          return {
            id: doc.id,
            ...mat,
            uploadedAt: mat.uploadedAt instanceof Timestamp ? mat.uploadedAt.toDate() : new Date(mat.uploadedAt),
          };
        });
        data.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
        setMaterials(data);
      },
      err => {
        console.error('Error fetching materials:', err);
        showToast('Failed to fetch materials', 'error');
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // -------------------- File Upload --------------------
  const handleFiles = (files: FileList | File[]) => {
    if (!selectedCourse) {
      showToast('Please select a course first', 'error');
      return;
    }
    const filesArray = Array.from(files).map(file => ({
      file,
      description: '',
      courseId: selectedCourse,
    }));
    setUploadQueue(prev => [...prev, ...filesArray]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    handleFiles(e.target.files);
  };

  const updateDescription = (index: number, desc: string) => {
    setUploadQueue(prev => {
      const newQueue = [...prev];
      newQueue[index].description = desc;
      return newQueue;
    });
  };

  const startUpload = (fileWithDesc: FileWithDescription) => {
    const { file, description, courseId } = fileWithDesc;
    if (!currentUser) return;

    const course = courses.find(c => c.id === courseId);
    if (!course) {
      showToast('Course not found', 'error');
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    setUploadingFiles(prev => ({ ...prev, [file.name]: true }));

    reader.onprogress = event => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
      }
    };

    reader.onload = async () => {
      const base64Content = reader.result as string;
      try {
        await addDoc(collection(db, 'trainingMaterials'), {
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: Timestamp.now(),
          description,
          content: base64Content,
          courseId,
          courseName: course.title,
          trainerId: currentUser.uid,
          trainerName: currentUser.displayName || currentUser.email,
        });
        setUploadQueue(prev => prev.filter(f => f.file.name !== file.name));
        showToast(`"${file.name}" uploaded successfully!`);
      } catch (error) {
        console.error('Upload error:', error);
        showToast(`Error uploading "${file.name}"`, 'error');
      } finally {
        setUploadProgress(prev => {
          const updated = { ...prev };
          delete updated[file.name];
          return updated;
        });
        setUploadingFiles(prev => {
          const updated = { ...prev };
          delete updated[file.name];
          return updated;
        });
      }
    };

    reader.onerror = () => {
      showToast(`Error reading "${file.name}"`, 'error');
      setUploadingFiles(prev => {
        const updated = { ...prev };
        delete updated[file.name];
        return updated;
      });
    };
  };

  // -------------------- Delete --------------------
  const handleDelete = async (materialId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await deleteDoc(doc(db, 'trainingMaterials', materialId));
      showToast('File deleted successfully!');
    } catch (error) {
      console.error('Error deleting file:', error);
      showToast('Error deleting file', 'error');
    }
  };

  // -------------------- File Icon --------------------
  const getFileIcon = (type: string) => {
    const baseStyle = 'w-10 h-10';
    if (type.includes('pdf')) return <FileText className={`${baseStyle} text-red-500 dark:text-red-400`} />;
    if (type.includes('image')) return <ImageIcon className={`${baseStyle} text-green-500 dark:text-green-400`} />;
    if (type.includes('video')) return <VideoIcon className={`${baseStyle} text-purple-500 dark:text-purple-400`} />;
    return <File className={`${baseStyle} text-blue-500 dark:text-blue-400`} />;
  };

  // -------------------- Drag & Drop --------------------
  useEffect(() => {
    const div = dropRef.current;
    if (!div) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
    };

    div.addEventListener('dragover', handleDragOver);
    div.addEventListener('dragleave', handleDragLeave);
    div.addEventListener('drop', handleDrop);

    return () => {
      div.removeEventListener('dragover', handleDragOver);
      div.removeEventListener('dragleave', handleDragLeave);
      div.removeEventListener('drop', handleDrop);
    };
  }, [selectedCourse]);

  // -------------------- Render --------------------
  return (
    <div className="space-y-6 relative p-4 dark:bg-gray-900 dark:text-gray-100 min-h-screen">
      {/* Toasts */}
      <div className="fixed top-5 right-5 flex flex-col gap-2 z-50">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded shadow-lg text-sm font-medium transition-colors duration-200 ${
              t.type === 'success'
                ? 'bg-green-500 text-white dark:bg-green-600'
                : 'bg-red-500 text-white dark:bg-red-600'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Training Materials</h1>
        <Button
          onClick={() => document.getElementById('materialUpload')?.click()}
          disabled={!selectedCourse}
          className="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" /> Upload File
        </Button>
        <input
          type="file"
          id="materialUpload"
          className="hidden"
          multiple
          onChange={handleFileSelect}
        />
      </div>

      {/* Course Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Select Course:</label>
        <select
          value={selectedCourse}
          onChange={e => setSelectedCourse(e.target.value)}
          className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 transition"
        >
          <option value="">-- Select a course --</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>

      {/* Drag & Drop Area */}
      <div
        ref={dropRef}
        className={`mt-4 p-8 border-2 border-dashed rounded-lg text-center transition-colors ${
          isDragging
            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-gray-800'
            : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800'
        }`}
      >
        {selectedCourse
          ? 'Drag & drop files here or click "Upload File"'
          : 'Please select a course to upload files'}
      </div>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="space-y-4 mt-4">
          {uploadQueue.map((item, idx) => {
            const isUploading = !!uploadingFiles[item.file.name];
            return (
              <div
                key={item.file.name}
                className="flex items-center gap-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm transition hover:shadow-md"
              >
                <div className="relative">{getFileIcon(item.file.type)}
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900 dark:text-gray-100">
                      {Math.round(uploadProgress[item.file.name])}%
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col gap-1">
                  <span className="font-medium">{item.file.name}</span>
                  <input
                    type="text"
                    placeholder="Add a description..."
                    value={item.description}
                    onChange={e => updateDescription(idx, e.target.value)}
                    className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500 transition"
                    disabled={isUploading}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {(item.file.size / 1024).toFixed(2)} KB
                  </span>
                </div>

                <Button
                  onClick={() => startUpload(item)}
                  disabled={isUploading}
                  className="flex items-center gap-2"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Materials List */}
      <div className="mt-6 space-y-3">
        {materials.map(mat => (
          <div
            key={mat.id}
            className="flex items-center gap-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm transition hover:shadow-md"
          >
            {getFileIcon(mat.type)}
            <div className="flex-1 flex flex-col gap-1">
              <span className="font-medium">{mat.name}</span>
              {mat.description && <span className="text-sm text-gray-600 dark:text-gray-300">{mat.description}</span>}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {mat.courseName} - {mat.uploadedAt.toLocaleString()}
              </span>
            </div>
            <div className="flex gap-2">
              <a
                href={mat.content}
                download={mat.name}
                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition"
              >
                <Download className="w-5 h-5" />
              </a>
              <button
                onClick={() => handleDelete(mat.id)}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
