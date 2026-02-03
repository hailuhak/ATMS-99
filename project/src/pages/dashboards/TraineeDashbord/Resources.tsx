import React, { useEffect, useState } from "react";
import { Card, CardContent } from "../../../components/ui/Card";
import {
  Download,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  File,
  X,
} from "lucide-react";
import { db } from "../../../lib/firebase";
import { collection, query, where, onSnapshot, getDocs, doc, setDoc } from "firebase/firestore";
import { useAuth } from "../../../contexts/AuthContext";

interface Resource {
  id: string;
  name: string;
  type: string;
  content: string;
  description?: string;
  courseId?: string;
  courseName?: string;
  trainerId?: string;
  trainerName?: string;
}

export const Resources: React.FC = () => {
  const { currentUser } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [modalResource, setModalResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'document'>('all');
  const [selectedCourse, setSelectedCourse] = useState('all');

  const filteredResources = resources.filter(res => {
    const matchesCourse = selectedCourse === 'all' || (res.courseName && res.courseName.toLowerCase() === selectedCourse.toLowerCase());
    const matchesTab = activeTab === 'all'
      ? true
      : activeTab === 'video'
        ? (res.type === 'video-link' || res.type.includes('video'))
        : (!res.type.includes('video') && res.type !== 'video-link');
    return matchesCourse && matchesTab;
  });

  const uniqueCourses = React.useMemo(() => {
    const courseMap = new Map();
    resources.forEach(res => {
      if (res.courseName) {
        const normalized = res.courseName.toLowerCase();
        if (!courseMap.has(normalized)) {
          // Store first occurrence, capitalized
          courseMap.set(normalized, {
            name: normalized, // Value for select
            displayName: res.courseName.charAt(0).toUpperCase() + res.courseName.slice(1) // Label
          });
        }
      }
    });
    return Array.from(courseMap.values());
  }, [resources]);

  // Removed unused previewOpen state

  if (!currentUser) return <p>Loading user data...</p>;

  // Helper to log activity
  const logActivity = async (action: string, resource: Resource) => {
    try {
      const activityRef = doc(db, "activityLogs", `${currentUser.uid}_${Date.now()}`);
      await setDoc(activityRef, {
        userId: currentUser.uid,
        userName: currentUser.displayName || "User",
        action,
        target: resource.name,
        courseId: resource.courseId || null,
        courseName: resource.courseName || null,
        resourceId: resource.id,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  };

  // Fetch enrolled course resources
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubscribes: (() => void)[] = [];

    const fetchResources = async () => {
      try {
        const enrollmentRef = collection(db, "enrollments");
        const enrollmentSnapshot = await getDocs(
          query(enrollmentRef, where("userId", "==", currentUser.uid))
        );

        if (enrollmentSnapshot.empty) {
          setResources([]);
          setLoading(false);
          return;
        }

        const enrollmentData = enrollmentSnapshot.docs[0].data();
        const enrolledCourseIds =
          enrollmentData.courses?.map((c: any) => c.courseId) || [];

        if (!enrolledCourseIds.length) {
          setResources([]);
          setLoading(false);
          return;
        }

        const materialsRef = collection(db, "trainingMaterials");
        const batchSize = 10;

        for (let i = 0; i < enrolledCourseIds.length; i += batchSize) {
          const batch = enrolledCourseIds.slice(i, i + batchSize);
          const materialsQuery = query(materialsRef, where("courseId", "in", batch));

          const unsubscribe = onSnapshot(materialsQuery, (snapshot) => {
            setResources((prev) => {
              const map = new Map(prev.map((r) => [r.id, r]));
              snapshot.docChanges().forEach((change) => {
                const data = change.doc.data() as any;
                const resource: Resource = {
                  id: change.doc.id,
                  name: data.name || "Untitled Resource",
                  type: data.type || "file",
                  content: data.content || data.url || "",
                  description: data.description || "",
                  courseId: data.courseId,
                  courseName: data.courseName,
                  trainerId: data.trainerId,
                  trainerName: data.trainerName,
                };

                if (change.type === "added" || change.type === "modified") map.set(change.doc.id, resource);
                if (change.type === "removed") map.delete(change.doc.id);
              });
              return Array.from(map.values());
            });
            setLoading(false);
          });

          unsubscribes.push(unsubscribe);
        }
      } catch (error) {
        console.error("Error fetching resources:", error);
        setLoading(false);
      }
    };

    fetchResources();

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [currentUser]);

  // Helper to check if URL is YouTube
  const getEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1` : null;
  };

  const IconType = ({ type }: { type: string | undefined }) => {
    const safeType = type || 'file'; // Handle undefined/null
    const base = "w-10 h-10";
    if (safeType.includes("pdf")) return <FileText className={`${base} text-red-500`} />;
    if (safeType.includes("image")) return <ImageIcon className={`${base} text-green-500`} />;
    if (safeType === "video-link" || safeType.includes("video")) return <VideoIcon className={`${base} text-purple-600`} />;
    return <File className={`${base} text-blue-500`} />;
  };

  const performDownload = (res: Resource) => {
    if (res.type === 'video-link') {
      window.open(res.content, '_blank');
    } else {
      const link = document.createElement("a");
      link.href = res.content;
      link.download = res.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    logActivity("Downloaded/Opened Resource", res);
  };

  const handleOpen = async (res: Resource) => {
    setModalResource(res);
    await logActivity("Viewed Resource in Modal", res);
  };

  const handleDownload = async (res: Resource, e: React.MouseEvent) => {
    e.stopPropagation();
    performDownload(res);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Learning Resources</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Loading your course materials...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        Learning Resources & E-Learning
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mt-1">
        Access course materials, videos, and documents from your enrolled courses
      </p>

      {/* Controls: Tabs & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">

        {/* Tabs */}
        <div className="flex p-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
          {[
            { id: 'all', label: 'All' },
            { id: 'video', label: 'Videos' },
            { id: 'document', label: 'Documents' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab.id
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Course Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter Course:</span>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none capitalize"
          >
            <option value="all">All Courses</option>
            {uniqueCourses.map(c => (
              <option key={c.name} value={c.name}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredResources.length === 0 ? (
        <Card className="w-full">
          <CardContent className="text-center py-12">
            <Download className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No materials match your filters...
            </p>
            <button
              onClick={() => { setActiveTab('all'); setSelectedCourse('all'); }}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Clear Filters
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredResources.map((res) => (
            <Card
              key={res.id}
              className={`w-full relative rounded-lg shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 group overflow-hidden ${res.type === 'video-link' || res.type.includes('video') ? 'hover:border-purple-300 dark:hover:border-purple-800' : 'hover:border-blue-300 dark:hover:border-blue-800'}`}
              onClick={() => handleOpen(res)}
            >
              <div className="p-2.5 flex flex-col h-full gap-2">
                {/* Header: Icon + Actions */}
                <div className="flex justify-between items-start">
                  <div className={`p-1.5 rounded-md ${res.type === 'video-link' || res.type.includes('video') ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300'}`}>
                    <IconType type={res.type} />
                  </div>

                  <div className="flex gap-1">
                    {res.type !== 'video-link' && (
                      <button
                        onClick={(e) => handleDownload(res, e)}
                        title="Download"
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition dark:hover:bg-gray-700"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {res.type === 'video-link' && (
                      <button
                        onClick={(e) => handleDownload(res, e)}
                        title="Open in new tab"
                        className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition dark:hover:bg-gray-700"
                      >
                        <X className="w-3.5 h-3.5 rotate-45" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <h3 className="font-semibold text-xs text-gray-900 dark:text-white line-clamp-1 leading-snug mb-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" title={res.name}>
                    {res.name}
                  </h3>
                  {res.description ? (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">{res.description}</p>
                  ) : (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">No description</p>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-1.5 border-t border-gray-50 dark:border-gray-700/50 flex justify-between items-center text-[9px] text-gray-400 font-medium uppercase tracking-wide">
                  <span className="truncate max-w-[60%]">{res.trainerName ? `By ${res.trainerName}` : ''}</span>
                  <span className={`px-1 rounded ${res.type === 'video-link' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20' : 'bg-gray-100 text-gray-500 dark:bg-gray-700'}`}>
                    {res.type === 'video-link' ? 'Video' : 'File'}
                  </span>
                </div>
              </div>
            </Card>
          ))}
          {filteredResources.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400 text-sm">
              No resources found.
            </div>
          )}
        </div>
      )}

      {modalResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">

          {/* Conditional Rendering: Window for Videos, Minimal Button for Files */}
          {(modalResource.type === 'video-link' || modalResource.type.includes('video')) ? (
            /* VIDEO PLAYER WINDOW */
            <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-5xl relative flex flex-col max-h-[90vh] shadow-2xl overflow-hidden m-4">

              {/* Modal Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <IconType type={modalResource.type} /> {modalResource.name}
                  </h2>
                </div>
                <button
                  onClick={() => setModalResource(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Video Content */}
              <div className="flex-1 overflow-y-auto bg-black flex items-center justify-center relative min-h-[400px]">
                {!modalResource.type.includes("link") && modalResource.type.includes("video") && (
                  <video
                    src={modalResource.content}
                    controls
                    autoPlay
                    className="w-full max-h-[80vh] outline-none"
                  />
                )}
                {modalResource.type === 'video-link' && (
                  getEmbedUrl(modalResource.content) ? (
                    <iframe
                      src={getEmbedUrl(modalResource.content) || ''}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full aspect-video h-full max-h-[80vh]"
                    ></iframe>
                  ) : (
                    <div className="text-center p-10 text-white">
                      <p className="mb-4 text-lg">External Video Link</p>
                      <a
                        href={modalResource.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
                      >
                        Open Video <X className="w-4 h-4 rotate-45" />
                      </a>
                    </div>
                  )
                )}
              </div>

              {/* Description Footer */}
              {(modalResource.description || modalResource.courseName) && (
                <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-sm">
                  {modalResource.courseName && <span className="font-semibold text-blue-600 mr-2">{modalResource.courseName}</span>}
                  <p className="text-gray-600 dark:text-gray-300 mt-1">{modalResource.description}</p>
                </div>
              )}
            </div>
          ) : (
            /* FILE DOWNLOAD (COMPACT, LIGHT BACKGROUND) */
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md mx-4 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full mb-4">
                  <Download className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>

                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 max-w-sm leading-tight">
                  {modalResource.name}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Ready to download</p>

                <button
                  onClick={(e) => handleDownload(modalResource, e)}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition transform hover:scale-105 shadow-lg"
                >
                  <Download className="w-5 h-5" />
                  Download Now
                </button>

                <button
                  onClick={() => setModalResource(null)}
                  className="mt-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

