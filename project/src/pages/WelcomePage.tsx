import React from 'react';
import { motion } from 'framer-motion';
import { GraduationCap, Users, BookOpen, Award } from 'lucide-react';
import { Button } from '../components/ui/Button';
import welcomeBg from '../logo/unnamed.webp';
import atmsLogo from '../logo/atms1.png';

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
        {/* Hero Section - Split Layout */}
        <motion.div
          className="relative max-w-md mx-auto lg:max-w-none mb-8 sm:mb-16 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-gray-800"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="grid lg:grid-cols-2 min-h-[300px] sm:min-h-[400px] lg:min-h-[600px]">
            {/* Left Side - Content */}
            <div className="relative z-10 flex flex-col justify-center items-center lg:items-start text-center lg:text-left p-6 sm:p-10 lg:p-16 bg-gradient-to-br from-blue-50 via-white to-blue-50/50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
              {/* Content Wrapper - Slightly wider for a more balanced look */}
              <div className="relative z-20 w-full max-w-[18rem] sm:max-w-none flex flex-col items-center lg:items-start text-center lg:text-left">
                {/* Logo */}
                <motion.div
                  className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-xl mb-6 sm:mb-8"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  whileHover={{ scale: 1.05, rotate: 3 }}
                >
                  <img
                    src={atmsLogo}
                    alt="ATMS Logo"
                    className="w-16 h-16 object-contain"
                  />
                </motion.div>

                {/* Heading */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                >
                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-gray-900 dark:text-white mb-4 sm:mb-6 leading-tight">
                    Audit Training
                    <span className="block bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent mt-2">
                      Management System
                    </span>
                  </h1>

                  <p className="text-base sm:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
                    Streamline your audit training programs with our comprehensive management system.
                    <span className="block mt-3 text-gray-500 dark:text-gray-400 font-medium opacity-75">
                      Create, manage, and track training sessions with ease.
                    </span>
                  </p>
                </motion.div>

                {/* Features List */}
                <motion.div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8 w-full"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  {[
                    { icon: GraduationCap, text: 'Expert Training' },
                    { icon: Users, text: 'Certified Instructors' },
                  ].map((item, index) => (
                    <motion.div
                      key={item.text}
                      className="flex items-center gap-3 justify-center lg:justify-start"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                    >
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {item.text}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>

                {/* CTA Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    size="lg"
                    onClick={onGetStarted}
                    className="px-8 py-4 text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-none shadow-xl shadow-blue-500/30 rounded-2xl"
                  >
                    Get Started Today
                  </Button>
                </motion.div>

                {/* Trust Badge */}
                <motion.div
                  className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 w-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                    Trusted by
                  </p>
                  <p className="text-base font-bold text-gray-700 dark:text-gray-300 mt-1 uppercase tracking-wider">
                    Office of the Federal Auditor General
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Right Side - Background Image */}
            <motion.div
              className="relative hidden lg:block"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              {/* Background Image */}
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${welcomeBg})`,
                }}
              />

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/80 via-blue-700/70 to-indigo-800/80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

              {/* Decorative Elements */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="text-center text-white p-8"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl mb-6 border border-white/20">
                    <GraduationCap className="w-12 h-12 text-white" />
                  </div>
                  <h3 className="text-3xl font-black mb-3">Excellence in Training</h3>
                  <p className="text-lg text-blue-100 max-w-md">
                    Professional development programs designed for audit excellence
                  </p>
                </motion.div>
              </div>

              {/* Floating Stats */}
              <motion.div
                className="absolute bottom-8 left-8 right-8 grid grid-cols-3 gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
              >
                {[
                  { value: '500+', label: 'Trainees' },
                  { value: '50+', label: 'Trainers' },
                  { value: '95%', label: 'Success' },
                ].map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center"
                    whileHover={{ y: -5, scale: 1.05 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.3 + index * 0.1 }}
                  >
                    <p className="text-2xl font-black text-white">{stat.value}</p>
                    <p className="text-xs text-blue-200 font-medium mt-1">{stat.label}</p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8 sm:mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="relative group bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 text-center overflow-hidden min-h-[140px] flex flex-col justify-center items-center max-w-[300px] mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
              whileHover={{ y: -10 }}
            >
              <div className="relative z-10 flex flex-col items-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl mb-6 shadow-lg transform transition-transform group-hover:scale-110 group-hover:rotate-3">
                  <feature.icon className="w-7 h-7" />
                </div>

                <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 leading-tight">
                  {feature.title}
                </h3>

                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          className="relative max-w-2xl mx-auto rounded-[3rem] overflow-hidden shadow-2xl bg-gradient-to-br from-blue-600 to-emerald-600"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <div className="relative z-10 px-8 py-6 sm:py-8 text-center text-white">
            <h2 className="text-3xl sm:text-4xl font-black mb-6 leading-tight">
              Ready to Transform
              <span className="block mt-2 opacity-90">Your Training?</span>
            </h2>
            <p className="text-base sm:text-lg opacity-90 mb-10 max-w-md mx-auto font-medium leading-relaxed">
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
                className="bg-white text-blue-600 hover:bg-gray-100 px-10 py-4 text-lg font-black rounded-2xl shadow-xl transition-all"
              >
                Start Your Journey
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Location Section */}
        <motion.div
          className="mt-12 bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
        >
          <div className="p-6 sm:p-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Visit Us
            </h2>
            <p className="text-base text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
              Find us at our training center and start your journey with expert instructors.
            </p>
          </div>

          {/* Google Maps Embed */}
          <div className="relative w-full h-56">
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