import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Users,
  Calendar,
  BarChart as BarChart3,
  FileText,
  UserCheck,
  GraduationCap,
  Monitor,
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [navbarHeight, setNavbarHeight] = useState(64); // default navbar height
  const navbarRef = useRef<HTMLDivElement>(null);

  // Update on resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);

    if (navbarRef.current) {
      setNavbarHeight(navbarRef.current.offsetHeight);
    }

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
    {id:'feedback', label: 'Feedback', icon: CheckSquare, roles: ['trainer']},

    { id: 'courses', label: 'My Courses', icon: GraduationCap, roles: ['trainee'] },
    { id: 'schedule', label: 'Schedule', icon: Calendar, roles: ['trainee'] },
    { id: 'resources', label: 'Resources', icon: FileText, roles: ['trainee'] },
  {id:'grades', label: 'Grades', icon: BarChart3, roles: ['trainee']},
    { id: 'courses-pending', label: 'Browse Courses', icon: BookOpen, roles: ['pending'] },
    { id: 'profile', label: 'Profile', icon: Users, roles: ['pending'] },
    { id: 'feedback', label: 'Send Feedback', icon: CheckSquare, roles: ['trainee'] },
  ];

  const role = currentUser?.role || 'pending';
  const menuItems = allMenuItems.filter(item => !item.roles || item.roles.includes(role));

  return (
    <div className="flex">
      {/* Navbar placeholder */}
      <div ref={navbarRef} className="hidden lg:block h-16 w-full" />

      {/* Fixed Sidebar */}
      <AnimatePresence>
        {(isOpen || !isMobile) && (
          <motion.aside
            className="fixed top-0 left-0 z-20 w-48 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700 min-h-screen flex flex-col"
            style={{ paddingTop: navbarHeight }}
            initial={{ x: isMobile ? -300 : 0 }}
            animate={{ x: 0 }}
            exit={{ x: isMobile ? -300 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {isMobile && (
              <div className="flex justify-end mb-4">
                <button onClick={() => setIsOpen(false)} className="text-gray-700 dark:text-gray-200">
                  <X size={24} />
                </button>
              </div>
            )}

            <nav className="flex-1 space-y-2 overflow-y-auto">
              {menuItems.map(item => (
                <motion.button
                  key={item.id}
                  onClick={() => {
                    onSectionChange(item.id);
                    if (isMobile) setIsOpen(false);
                  }}
                  className={clsx(
                    'w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors',
                    activeSection === item.id
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <item.icon className="w-5 h-5 mr-2" />
                  {(!isMobile || isOpen) && <span>{item.label}</span>}
                </motion.button>
              ))}
            </nav>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main
        className={clsx(
          'flex-1 min-h-screen p-6 bg-gray-50 dark:bg-gray-900 transition-all',
          !isMobile && 'ml-40'
        )}
      >
        {/* Scrollable content */}
      </main>

      {/* Mobile Hamburger Button */}
      {isMobile && (
        <div
          className="fixed left-4 z-40" // higher than sidebar (z-20) and overlay (z-10)
          style={{ top: navbarHeight + 8 }} // 8px gap below navbar
        >
          <button
            onClick={() => setIsOpen(true)}
            className="text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 p-2 rounded shadow"
          >
            <Menu size={24} />
          </button>
        </div>
      )}

      {/* Mobile overlay */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
