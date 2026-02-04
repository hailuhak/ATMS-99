import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Users,
  Calendar,
  BarChart as BarChart3,
  FileText,
  UserCheck,
  GraduationCap,
  Menu,
  X,
  House,
  CheckSquare
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { clsx } from 'clsx';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange }) => {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Update on resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setIsOpen(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const allMenuItems = [
    { id: 'dashboard', label: 'Home', icon: House },
    { id: 'users', label: 'User Management', icon: Users, roles: ['admin'] },
    { id: 'pending-users', label: 'Pending Users', icon: UserCheck, roles: ['admin'] },
    { id: 'sessions', label: 'Sessions', icon: Calendar, roles: ['admin'] },
    { id: 'courses', label: 'Course Management', icon: BookOpen, roles: ['admin'] },
    { id: 'grades', label: 'Grades', icon: BarChart3, roles: ['admin'] },
    { id: 'activities', label: 'Activity Logs', icon: FileText, roles: ['admin'] },

    { id: 'courses', label: 'My Courses', icon: BookOpen, roles: ['trainer'] },
    { id: 'sessions', label: 'Training Sessions', icon: Calendar, roles: ['trainer'] },
    { id: 'materials', label: 'Materials', icon: FileText, roles: ['trainer'] },
    { id: 'grades', label: 'Trainee Grades', icon: BarChart3, roles: ['trainer'] },
    { id: 'feedback', label: 'Feedback', icon: CheckSquare, roles: ['trainer'] },

    { id: 'courses', label: 'My Courses', icon: GraduationCap, roles: ['trainee'] },
    { id: 'schedule', label: 'Schedule', icon: Calendar, roles: ['trainee'] },
    { id: 'resources', label: 'Resources', icon: FileText, roles: ['trainee'] },
    { id: 'grades', label: 'Grades', icon: BarChart3, roles: ['trainee'] },
    { id: 'feedback', label: 'Send Feedback', icon: CheckSquare, roles: ['trainee'] },

    { id: 'courses', label: 'Browse Courses', icon: BookOpen, roles: ['pending'] },
    { id: 'profile', label: 'Profile', icon: Users, roles: ['pending'] },
  ];

  const role = currentUser?.role || 'pending';
  const menuItems = allMenuItems.filter(item => !item.roles || item.roles.includes(role));

  return (
    <>
      {/* Mobile Hamburger Button */}
      {isMobile && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed left-4 top-20 z-30 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Sidebar container */}
      <AnimatePresence>
        {(isOpen || !isMobile) && (
          <>
            {/* Mobile overlay */}
            {isMobile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              />
            )}

            <motion.aside
              initial={{ x: isMobile ? -300 : 0 }}
              animate={{ x: 0 }}
              exit={{ x: isMobile ? -300 : 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={clsx(
                "fixed left-0 top-16 bottom-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-300",
                isMobile && "shadow-2xl"
              )}
            >
              {isMobile && (
                <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
                  <span className="font-bold text-blue-600 dark:text-blue-400">Navigation</span>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}

              <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                {menuItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSectionChange(item.id);
                      if (isMobile) setIsOpen(false);
                    }}
                    className={clsx(
                      'w-full flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative',
                      activeSection === item.id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50 hover:text-blue-600 dark:hover:text-blue-400'
                    )}
                  >
                    <item.icon className={clsx(
                      "w-5 h-5 mr-3 transition-transform duration-200 group-hover:scale-110",
                      activeSection === item.id ? "text-blue-600 dark:text-blue-400" : "text-gray-400 group-hover:text-blue-500"
                    )} />
                    <span>{item.label}</span>
                    {activeSection === item.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute left-0 w-1 h-6 bg-blue-600 dark:bg-blue-400 rounded-r-full"
                      />
                    )}
                  </button>
                ))}
              </nav>

              <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                <div className="px-4 py-2 bg-blue-600/10 rounded-lg text-blue-600 dark:text-blue-400 text-xs font-semibold text-center">
                  v3.0.1 Stable
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
