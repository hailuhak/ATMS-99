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
  const [previewOpen, setPreviewOpen] = useState<string | null>(null);

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

        const enrolledCourseIds =
          enrollmentSnapshot.docs[0].data().courses?.map((c: any) => c.courseId) || [];

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

  const getIcon = (type: string) => {
    const base = "w-8 h-8";
    if (type.includes("pdf")) return <FileText className={`${base} text-red-500`} />;
    if (type.includes("doc")) return <FileText className={`${base} text-orange-500`} />;
    if (type.includes("image")) return <ImageIcon className={`${base} text-green-500`} />;
    if (type.includes("video")) return <VideoIcon className={`${base} text-purple-500`} />;
    return <File className={`${base} text-blue-500`} />;
  };

  const handleOpen = async (res: Resource) => {
    setModalResource(res);
    await logActivity("Viewed Resource in Modal", res);
  };

  const handleDownload = async (res: Resource, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = res.content;
    link.download = res.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    await logActivity("Downloaded Resource", res);
  };

  const togglePreview = async (res: Resource) => {
    setPreviewOpen((prev) => (prev === res.id ? null : res.id));
    await logActivity("Previewed Resource Inline", res);
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

      {resources.length === 0 ? (
        <Card className="w-full">
          <CardContent className="text-center py-12">
            <Download className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No materials available for your enrolled courses yet...
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {resources.map((res) => (
            <Card
              key={res.id}
              className="w-full relative rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
            >
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3 flex-1">
                    <div onClick={() => togglePreview(res)}>{getIcon(res.type)}</div>
                    <div className="flex flex-col gap-1 flex-1" onClick={() => handleOpen(res)}>
                      <span className="font-medium text-gray-900 dark:text-white">{res.name}</span>
                      {res.courseName && <span className="text-sm text-blue-600 dark:text-blue-400">{res.courseName}</span>}
                      {res.trainerName && <span className="text-xs text-gray-500 dark:text-gray-400">By: {res.trainerName}</span>}
                      {res.description && <span className="text-sm text-gray-500 dark:text-gray-400">{res.description}</span>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDownload(res, e)}
                    className="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-700 dark:hover:bg-blue-600 text-blue-700 dark:text-blue-200 px-3 py-1 rounded-md shadow-sm transition"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>

                {previewOpen === res.id && res.type.includes("image") && <img src={res.content} alt={res.name} className="w-full h-40 object-contain rounded-md mt-2" />}
                {previewOpen === res.id && res.type.includes("video") && <video src={res.content} controls className="w-full h-40 rounded-md mt-2" />}
                {previewOpen === res.id && res.type.includes("pdf") && <iframe src={res.content} className="w-full h-60 rounded-md mt-2" title={res.name} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {modalResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl relative p-6 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalResource(null)}
              className="absolute top-4 right-4 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-2"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{modalResource.name}</h2>
            {modalResource.courseName && <p className="text-sm text-blue-600 dark:text-blue-400">{modalResource.courseName}</p>}
            {modalResource.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{modalResource.description}</p>}

            {modalResource.type.includes("pdf") && <iframe src={modalResource.content} className="w-full h-[600px] rounded-md" title={modalResource.name} />}
            {modalResource.type.includes("image") && <img src={modalResource.content} alt={modalResource.name} className="w-full max-h-[600px] object-contain rounded-md" />}
            {modalResource.type.includes("video") && <video src={modalResource.content} controls autoPlay className="w-full max-h-[600px] rounded-md" />}
          </div>
        </div>
      )}
    </div>
  );
};
