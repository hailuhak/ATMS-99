import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    if (!currentUser || currentUser.role !== 'admin') return;
    const q = query(collection(db, 'pendingUsers'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => setPendingUsers(snapshot.size));
    return () => unsubscribe();
  }, [currentUser]);

  // Fetch trainer notifications
  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'trainer')) return;
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
  }, [currentUser]);

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
        className="fixed top-0 left-0 w-full z-50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-700"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side: Logo */}
            <div className="flex items-center">
              <motion.h1
                whileHover={{ scale: 1.05 }}
                className="text-xl sm:text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent cursor-pointer"
              >
                ATMS
              </motion.h1>
            </div>

            {/* Right side cluster: Hamburger, Tools, Profile, Logout */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* 1. Hamburger (Mobile Only) */}
              <div className="lg:hidden">
                <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 sm:h-10 sm:w-10 p-0 flex items-center justify-center" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                  <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-300" />
                </Button>
              </div>

              {/* Desktop Additional Tools (Settings, Bell, Theme) */}
              <div className="hidden lg:flex items-center space-x-1 sm:space-x-2">
                <Button variant="ghost" size="sm" className="relative hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full h-10 w-10 flex items-center justify-center p-0" onClick={() => setSettingsOpen(!settingsOpen)}>
                  <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </Button>

                <Button variant="ghost" size="sm" className="relative hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full h-10 w-10 flex items-center justify-center p-0">
                  <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  {(pendingUsers > 0 || gradeCount > 0) && (
                    <span className="absolute top-2 right-2 bg-red-500 w-2 h-2 rounded-full border-2 border-white dark:border-gray-800"></span>
                  )}
                </Button>

                <Button variant="ghost" size="sm" className="hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full h-10 w-10 flex items-center justify-center p-0" onClick={toggleTheme}>
                  {theme === 'light' ? <Moon className="w-5 h-5 text-gray-600" /> : <Sun className="w-5 h-5 text-yellow-400" />}
                </Button>

                <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1" />
              </div>

              {/* 2. Profile Image (All Devices) */}
              <div className="relative group shrink-0">
                <label htmlFor="profile-upload-nav" className="cursor-pointer block transition-transform active:scale-95">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-blue-500/20 hover:ring-blue-500/40 transition-all" />
                  ) : (
                    <div className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                    </div>
                  )}
                </label>
                <input id="profile-upload-nav" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </div>

              {/* 3. Logout (All Devices) */}
              <Button variant="ghost" size="sm" className="hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-full h-8 w-8 sm:h-10 sm:w-10 p-0 flex items-center justify-center" onClick={handleLogout}>
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Settings Dropdown */}
        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-4 top-16 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-2xl p-6 z-50"
            >
              <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Profile Settings</h3>
              {loadingInfo ? (
                <div className="py-8 text-center text-gray-500">Loading profile...</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Display Name</label>
                    <input
                      type="text"
                      value={userInfo.displayName}
                      onChange={e => setUserInfo({ ...userInfo, displayName: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email Address</label>
                    <input
                      type="email"
                      value={userInfo.email}
                      onChange={e => setUserInfo({ ...userInfo, email: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                  <Button variant="primary" size="sm" onClick={handleUpdateInfo} className="w-full py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20">
                    Save Changes
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl"
            >
              <div className="p-4 space-y-4">
                <div className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-12 h-12 rounded-full object-cover border-2 border-blue-500" />
                  ) : (
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{currentUser?.displayName || "User"}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">{currentUser?.role}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-xl py-3"
                    onClick={() => { setSettingsOpen(!settingsOpen); setMobileMenuOpen(false); }}
                  >
                    <Settings className="w-4 h-4 mr-2 text-blue-500" /> Settings
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-xl py-3"
                    onClick={toggleTheme}
                  >
                    {theme === 'light' ? <Moon className="w-4 h-4 mr-2 text-indigo-500" /> : <Sun className="w-4 h-4 mr-2 text-yellow-500" />} Theme
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full flex items-center justify-center py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
      <div className="h-16" />
    </>
  );
};