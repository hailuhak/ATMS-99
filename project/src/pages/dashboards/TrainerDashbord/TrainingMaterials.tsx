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
  serverTimestamp,
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

  // -------------------- Log Activity --------------------
  const logActivity = async (action: string, target: string, details?: string) => {
    if (!currentUser) return;
    await addDoc(collection(db, 'activityLogs'), {
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
      trainerId: currentUser.uid,
      action,
      target,
      details: details || '',
      timestamp: serverTimestamp(),
    });
  };

  // -------------------- Fetch Courses --------------------
  useEffect(() => {
    if (!currentUser) return;

    const fetchCourses = async () => {
      try {
        const q = query(collection(db, 'courses'), where('instructorId', '==', currentUser.uid));
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

    const q = query(collection(db, 'trainingMaterials'), where('trainerId', '==', currentUser.uid));
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
        const docRef = await addDoc(collection(db, 'trainingMaterials'), {
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
        await logActivity('Uploaded material', file.name, `Course: ${course.title}`);
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
  const handleDelete = async (material: Material) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await deleteDoc(doc(db, 'trainingMaterials', material.id));
      showToast('File deleted successfully!');
      await logActivity('Deleted material', material.name, `Course: ${material.courseName}`);
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

  // -------------------- Add Link --------------------
  const [isLinkMode, setIsLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');

  const handleAddLink = async () => {
    if (!selectedCourse) {
      showToast('Please select a course first', 'error');
      return;
    }
    if (!linkUrl.trim() || !linkTitle.trim()) {
      showToast('Title and URL are required', 'error');
      return;
    }

    if (!currentUser) return;

    try {
      const course = courses.find(c => c.id === selectedCourse);
      await addDoc(collection(db, 'trainingMaterials'), {
        name: linkTitle,
        type: 'video-link', // Special type for links
        content: linkUrl, // URL itself
        description: linkDescription,
        size: 0,
        uploadedAt: Timestamp.now(),
        courseId: selectedCourse,
        courseName: course?.title || 'Unknown Course',
        trainerId: currentUser.uid,
        trainerName: currentUser.displayName || currentUser.email,
      });

      showToast('Video link added successfully!');
      await logActivity('Added video link', linkTitle, `Course: ${course?.title}`);

      // Reset form
      setLinkUrl('');
      setLinkTitle('');
      setLinkDescription('');
      setIsLinkMode(false);

    } catch (error) {
      console.error('Error adding link:', error);
      showToast('Failed to add video link', 'error');
    }
  };


  // -------------------- Render --------------------
  return (
    <div className="space-y-6 relative p-4 dark:bg-gray-900 dark:text-gray-100 min-h-screen max-w-5xl mx-auto">
      {/* Toasts */}
      <div className="fixed top-5 right-5 flex flex-col gap-2 z-50">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded shadow-lg text-sm font-medium transition-colors duration-200 ${t.type === 'success'
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
        <div className="flex gap-2">
          <Button
            onClick={() => setIsLinkMode(!isLinkMode)}
            disabled={!selectedCourse}
            className={`flex items-center gap-2 ${isLinkMode ? 'bg-gray-500' : 'bg-purple-600 hover:bg-purple-700'}`}
          >
            <VideoIcon className="w-4 h-4" /> {isLinkMode ? 'Cancel Link' : 'Add Video Link'}
          </Button>
          <Button
            onClick={() => document.getElementById('materialUpload')?.click()}
            disabled={!selectedCourse}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Upload File
          </Button>
        </div>
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

      {/* Add Link Form */}
      {isLinkMode && (
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 border-purple-200 dark:border-purple-800 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <VideoIcon className="w-5 h-5 text-purple-600" /> Add Video Link (YouTube, Vimeo, etc.)
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Video Title (e.g., Intro to Safety)"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              className="w-full px-3 py-2 rounded border focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 dark:border-gray-600"
            />
            <input
              type="text"
              placeholder="Video URL (e.g., https://youtube.com/watch?v=...)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full px-3 py-2 rounded border focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 dark:border-gray-600"
            />
            <input
              type="text"
              placeholder="Description (Optional)"
              value={linkDescription}
              onChange={(e) => setLinkDescription(e.target.value)}
              className="w-full px-3 py-2 rounded border focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 dark:border-gray-600"
            />
            <Button onClick={handleAddLink} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
              Save Link
            </Button>
          </div>
        </div>
      )}

      {/* Drag & Drop Area */}
      {!isLinkMode && (
        <div
          ref={dropRef}
          className={`mt-4 p-8 border-2 border-dashed rounded-lg text-center transition-colors ${isDragging
            ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-gray-800'
            : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800'
            }`}
        >
          {selectedCourse
            ? 'Drag & drop files here or click "Upload File"'
            : 'Please select a course to upload files or add links'}
        </div>
      )}

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
                      {Math.round(uploadProgress[item.file.name] || 0)}%
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

      {/* Materials List (Grid Layout) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
        {materials.map(mat => (
          <div
            key={mat.id}
            className={`group relative flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 dark:border-gray-700 overflow-hidden ${mat.type === 'video-link' || mat.type.includes('video') ? 'hover:border-purple-300 dark:hover:border-purple-800' : 'hover:border-blue-300 dark:hover:border-blue-800'}`}
          >
            <div className="p-2.5 flex flex-col h-full gap-2">

              {/* Header: Icon + Actions */}
              <div className="flex justify-between items-start">
                {/* Icon with Color Indicator */}
                <div className={`p-1.5 rounded-md ${mat.type === 'video-link' || mat.type.includes('video') ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300'}`}>
                  {mat.type === 'video-link' ? <VideoIcon className="w-4 h-4" /> : <div className="scale-90">{getFileIcon(mat.type)}</div>}
                </div>

                {/* Hover Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <a
                    href={mat.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={mat.type !== 'video-link' ? mat.name : undefined}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md dark:text-gray-500 dark:hover:bg-gray-700 transition"
                    title={mat.type === 'video-link' ? 'Open' : 'Download'}
                  >
                    {mat.type === 'video-link' ? <Upload className="w-3.5 h-3.5 rotate-45" /> : <Download className="w-3.5 h-3.5" />}
                  </a>
                  <button
                    onClick={() => handleDelete(mat)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md dark:text-gray-500 dark:hover:bg-gray-700 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                <h3 className="font-semibold text-xs text-gray-900 dark:text-gray-100 line-clamp-1 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={mat.name}>
                  {mat.name}
                </h3>
                {mat.description ? (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                    {mat.description}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 italic">No description</p>
                )}
              </div>

              {/* Footer */}
              <div className="pt-1.5 border-t border-gray-50 dark:border-gray-700/50 flex justify-between items-center text-[9px] text-gray-400 font-medium uppercase tracking-wide">
                <span className="truncate max-w-[60%]">{mat.courseName}</span>
                <span>{mat.size > 0 ? `${(mat.size / 1024 / 1024).toFixed(1)}MB` : 'LINK'}</span>
              </div>
            </div>
          </div>
        ))}
        {materials.length === 0 && (
          <div className="col-span-full py-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 mb-2">
              <File className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">No materials yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
