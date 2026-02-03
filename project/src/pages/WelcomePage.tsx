import React from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Users, BookOpen, Award } from 'lucide-react';
import { Button } from '../components/ui/Button';
import welcomeBg from '../logo/unnamed.webp'; // Import local image

interface WelcomePageProps {
  onGetStarted: () => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onGetStarted }) => {
  const features = [
    {
      icon: GraduationCap,
      title: 'Professional Training',
      description: 'Access high-quality audit training programs designed by industry experts.',
    },
    {
      icon: Users,
      title: 'Expert Instructors',
      description: 'Learn from certified professionals with years of real-world experience.',
    },
    {
      icon: BookOpen,
      title: 'Comprehensive Resources',
      description: 'Get access to extensive learning materials and practice exercises.',
    },
    {
      icon: Award,
      title: 'Easy to Use',
      description: 'Our platform is designed with simplicity in mind, making it effortless for anyone to navigate and get started quickly.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section with Background Image */}
        <motion.div
          className="relative text-center mb-16 rounded-3xl overflow-hidden shadow-2xl min-h-[600px] flex flex-col justify-between"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Background Image Overlay */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${welcomeBg})`,
              filter: 'brightness(0.6)'
            }}
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/40 via-transparent to-blue-900/40 mix-blend-overlay" />

          {/* Content */}
        <div className="relative z-10 py-12 px-4 flex flex-col items-center h-screen justify-between">

  {/* Top Content: Logo & Text */}
  <div className="flex flex-col items-center">
    <motion.div
      className="inline-flex items-center justify-center w-20 h-20 bg-blue-200 rounded-2xl mb-8"
      whileHover={{ scale: 1.1, rotate: 1 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <img
        src="../src/logo/atms1.png"
        alt="Graduation Cap"
        className="w-18 h-18 object-contain"
      />
    </motion.div>

    <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 drop-shadow-lg text-center">
      Audit Training
      <span className="block text-blue-300">
        Management System
      </span>
    </h1>

    <p className="text-xl text-gray-100 max-w-3xl mx-auto drop-shadow-md text-center">
      Streamline your audit training programs with our comprehensive management system.
      Create, manage, and track training sessions with ease while ensuring compliance and excellence.
    </p>
  </div>

  {/* Bottom Content: Button */}
  <div>
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button
        size="lg"
        onClick={onGetStarted}
        className="px-10 py-5 text-xl bg-blue-600 hover:bg-blue-700 text-white border-none shadow-xl"
      >
        Get Started Today
      </Button>
    </motion.div>
  </div>

</div>
        </motion.div> 

        {/* Features Grid */}
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl mb-4">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          className="bg-gradient-to-r from-blue-600 to-emerald-600 rounded-3xl p-8 sm:p-12 text-center text-white"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Transform Your Training?
          </h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            ATMS is designed to help you manage your audit training programs efficiently and effectively.
          </p>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              variant="secondary"
              size="lg"
              onClick={onGetStarted}
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg"
            >
              Start Your Journey
            </Button>
          </motion.div>
        </motion.div>

        {/* Location Section */}
        <motion.div
          className="mt-16 bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
        >
          <div className="p-8 sm:p-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Visit Us
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Find us at our training center and start your journey with expert instructors.
            </p>
          </div>

          {/* Google Maps Embed */}
          <div className="relative w-full h-64">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15761.594732155783!2d38.7526157871582!3d9.006405200000001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x164b85b753401acd%3A0xd80163a7f29a62ba!2sOffice%20Of%20The%20Federal%20Auditor%20General%20Ethiopia!5e0!3m2!1sen!2set!4v1707054321000!5m2!1sen!2set"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-full"
            />
          </div>

          <div className="p-6 bg-gray-50 dark:bg-gray-900 text-center">
            <a
              href="https://maps.app.goo.gl/yQmkFQuLmJU6D1oRA"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Open in Google Maps
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};