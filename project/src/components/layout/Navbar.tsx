import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, User, LogOut, Settings, Sun, Moon, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { collection, onSnapshot, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [pendingUsers, setPendingUsers] = useState(0);
  const [trainerNotifications, setTrainerNotifications] = useState<Set<string>>(new Set());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [userInfo, setUserInfo] = useState({ displayName: '', email: '' });
  const [loadingInfo, setLoadingInfo] = useState(true);

  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch pending users
  useEffect(() => {
    const q = query(collection(db, 'pendingUsers'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => setPendingUsers(snapshot.size));
    return () => unsubscribe();
  }, []);

  // Fetch trainer notifications
  useEffect(() => {
    const unsubscribeGrades = onSnapshot(collection(db, 'grades'), gradesSnapshot => {
      const unsubscribeFinal = onSnapshot(collection(db, 'finalGrade'), finalSnapshot => {
        const gradesByTrainee: { [key: string]: any } = {};
        const finalGradesByTrainee: { [key: string]: any } = {};

        gradesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const key = `${data.traineeId}_${data.courseId}`;
          gradesByTrainee[key] = data;
        });

        finalSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (Array.isArray(data.courses)) {
            data.courses.forEach((course: any) => {
              const key = `${data.traineeId}_${course.courseId}`;
              finalGradesByTrainee[key] = true;
            });
          }
        });

        const unsavedCount = Object.keys(gradesByTrainee).filter(key => !finalGradesByTrainee[key]).length;
        setTrainerNotifications(unsavedCount > 0 ? new Set(['admin']) : new Set());
      });
      return () => unsubscribeFinal();
    });
    return () => unsubscribeGrades();
  }, []);

  // Fetch user info
  useEffect(() => {
    if (!currentUser) return;

    const fetchUserInfo = async () => {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserInfo({ displayName: data.displayName || '', email: data.email || '' });
        if (data.profileImageBase64) setProfileImage(data.profileImageBase64);
      }
      setLoadingInfo(false);
    };

    fetchUserInfo();
  }, [currentUser]);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      setUploading(true);

      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise(resolve => (img.onload = resolve));

      const canvas = document.createElement('canvas');
      const maxSize = 300;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      // Compress to under 1 MB
      let quality = 0.8;
      let base64String = canvas.toDataURL('image/jpeg', quality);
      while (base64String.length > 950000 && quality > 0.1) {
        quality -= 0.05;
        base64String = canvas.toDataURL('image/jpeg', quality);
      }

      await updateDoc(doc(db, 'users', currentUser.uid), { profileImageBase64: base64String });
      setProfileImage(base64String);
      alert('✅ Profile image updated successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('❌ Failed to upload image. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateInfo = async () => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: userInfo.displayName,
        email: userInfo.email,
      });
      alert('✅ User info updated successfully!');
      setSettingsOpen(false);
    } catch (error) {
      console.error('Failed to update user info:', error);
      alert('❌ Failed to update info. Try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const gradeCount = trainerNotifications.size;

  return (
    <>
      <motion.nav
        className="fixed top-0 left-0 w-full z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <motion.h1
              whileHover={{ scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="text-2xl font-bold text-blue-600 dark:text-blue-400 cursor-pointer transition-colors duration-300 hover:text-blue-700 dark:hover:text-blue-300"
            >
              ATMS
            </motion.h1>

            {/* Desktop Menu */}
            <div className="hidden lg:flex items-center space-x-4">
              <motion.div whileHover={{ scale: 1.15 }}>
                <Button variant="ghost" size="sm" className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200" onClick={() => setSettingsOpen(!settingsOpen)}>
                  <Settings className="w-4 h-4 hover:text-blue-500 transition-colors duration-200" />
                </Button>
              </motion.div>

              <motion.div whileHover={{ scale: 1.15 }}>
                <Button variant="ghost" size="sm" className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200">
                  <div className="relative">
                    <Bell className="w-5 h-5 hover:text-blue-500 transition-colors duration-200" />
                    {pendingUsers > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                        {pendingUsers}
                      </span>
                    )}
                    {gradeCount > 0 && (
                      <span className="absolute -bottom-1 -right-1 bg-green-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                        {gradeCount}
                      </span>
                    )}
                  </div>
                </Button>
              </motion.div>

              <motion.div whileHover={{ rotate: 20 }} transition={{ type: 'spring', stiffness: 200 }}>
                <Button variant="ghost" size="sm" className="hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200" onClick={toggleTheme}>
                  {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </Button>
              </motion.div>

              {/* Profile Section */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{currentUser?.displayName || currentUser?.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{currentUser?.role}</p>
                </div>
                <motion.div whileHover={{ scale: 1.15 }}>
                  <label htmlFor="profile-upload" className="cursor-pointer transition-transform duration-300">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-8 h-8 rounded-full object-cover border-2 border-blue-500 hover:shadow-lg hover:shadow-blue-400/40 transition-shadow duration-300" />
                    ) : (
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors duration-300">
                        <User className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </label>
                  <input id="profile-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  {uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                      <span className="text-xs text-white">...</span>
                    </div>
                  )}
                </motion.div>
              </div>

              <motion.div whileHover={{ scale: 1.15 }}>
                <Button variant="ghost" size="sm" className="hover:bg-red-50 dark:hover:bg-red-900 transition-all duration-200" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 hover:text-red-500 transition-colors duration-200" />
                </Button>
              </motion.div>
            </div>

            {/* Mobile Menu */}
            <div className="lg:hidden flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                <Menu className="w-5 h-5 hover:text-blue-500 transition-colors duration-200" />
              </Button>
              <div className="relative">
                <label htmlFor="profile-upload-mobile" className="cursor-pointer hover:scale-110 transition-transform duration-300">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-8 h-8 rounded-full object-cover border-2 border-blue-500" />
                  ) : (
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors duration-300">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </label>
                <input id="profile-upload-mobile" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 hover:text-red-500 transition-colors duration-200" />
              </Button>
            </div>
          </div>
        </div>

        {/* Settings Dropdown */}
        {settingsOpen && (
          <div className="absolute right-4 top-16 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg p-4 z-50">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Your Info</h3>
            {loadingInfo ? (
              <p className="text-gray-500 dark:text-gray-400">Loading...</p>
            ) : (
              <>
                <div className="mb-2">
                  <label className="block text-sm text-gray-700 dark:text-gray-300">Display Name</label>
                  <input
                    type="text"
                    value={userInfo.displayName}
                    onChange={e => setUserInfo({ ...userInfo, displayName: e.target.value })}
                    className="w-full p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-sm text-gray-700 dark:text-gray-300">Email</label>
                  <input
                    type="email"
                    value={userInfo.email}
                    onChange={e => setUserInfo({ ...userInfo, email: e.target.value })}
                    className="w-full p-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200"
                  />
                </div>
                <Button variant="primary" size="sm" onClick={handleUpdateInfo} className="w-full mt-2">
                  Update Info
                </Button>
              </>
            )}
          </div>
        )}

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-md">
            <div className="flex flex-col p-4 space-y-2">
              <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(!settingsOpen)}>
                <Settings className="w-4 h-4 mr-2" /> Settings
              </Button>
              <Button variant="ghost" size="sm">
                <div className="relative flex items-center">
                  <Bell className="w-4 h-4 mr-2" /> Notifications
                  {pendingUsers > 0 && (
                    <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                      {pendingUsers}
                    </span>
                  )}
                  {gradeCount > 0 && (
                    <span className="absolute -bottom-1 -right-2 bg-green-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                      {gradeCount}
                    </span>
                  )}
                </div>
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleTheme}>
                {theme === 'light' ? <Moon className="w-4 h-4 mr-2" /> : <Sun className="w-4 h-4 mr-2" />} Theme
              </Button>
            </div>
          </div>
        )}
      </motion.nav>
      <div className="h-16" />
    </>
  );
};
