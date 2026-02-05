import React, { useState } from "react";
import { Users, Eye, EyeOff } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { User as UserType } from "../../../types";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "../../../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useEffect } from "react";
import { db } from "../../../lib/firebase";

interface ProfileProps {
  currentUser: UserType | null;
}

export const Profile: React.FC<ProfileProps> = ({ currentUser }) => {
  const { reauthenticate, verifyEmailUpdate } = useAuth();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [role] = useState(
    currentUser?.role === "user" ? "General User" : currentUser?.role || "Unknown"
  );

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync local state when currentUser updates (e.g., after verification sync)
  useEffect(() => {
    if (!isEditing && currentUser) {
      setDisplayName(currentUser.displayName || "");
      setEmail(currentUser.email || "");
    }
  }, [currentUser, isEditing]);

  // Re-authentication
  const [showReauth, setShowReauth] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError("");

    try {
      const userRef = doc(db, "users", currentUser.uid);

      // 🔹 Update display name
      if (displayName !== currentUser.displayName) {
        await updateDoc(userRef, { displayName });
        toast.success("Display name updated!");
      }

      // 🔹 Email change flow (SECURE)
      if (email !== currentUser.email) {
        setShowReauth(true);
        setLoading(false);
        return;
      }

      setIsEditing(false);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError("");

    try {
      await reauthenticate(password);
      await verifyEmailUpdate(email);

      // Also update display name in Firestore if it changed
      if (displayName !== currentUser.displayName) {
        await updateDoc(doc(db, "users", currentUser.uid), { displayName });
      }

      toast.success("Verification email sent! Check your new email.");
      setShowReauth(false);
      setPassword("");
      setIsEditing(false);
    } catch (err: any) {
      console.error("Email change failed:", err);
      if (err.code === "auth/wrong-password") {
        setError("Incorrect password. Please try again.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="px-4">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
          My Profile
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          Manage your account information
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4">
        {/* Profile Card */}
        <Card className="lg:col-span-1 rounded-3xl border-gray-100 dark:border-gray-800 shadow-sm transition-all overflow-hidden">
          <CardContent className="flex flex-col items-center p-8">
            <div className="relative group">
              <div className="w-28 h-28 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/20 mb-6 transition-transform group-hover:scale-105">
                <Users className="w-14 h-14 text-white" />
              </div>
            </div>

            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight text-center">
              {displayName || "User"}
            </h3>

            <div className="mt-4 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-bold uppercase tracking-wider">
              {role}
            </div>

            <Button
              variant={isEditing ? "outline" : "primary"}
              className="w-full mt-8 rounded-2xl py-3 font-bold"
              onClick={() => {
                setIsEditing(!isEditing);
                if (isEditing) {
                  setDisplayName(currentUser?.displayName || "");
                  setEmail(currentUser?.email || "");
                }
              }}
            >
              {isEditing ? "Cancel" : "Edit Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="lg:col-span-2 rounded-3xl border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-gray-50 dark:border-gray-800/50 p-6">
            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
              Account Details
            </h3>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">
                  Full Name
                </label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={!isEditing}
                  placeholder="Your display name"
                  className="rounded-2xl h-12 bg-gray-50 dark:bg-gray-800/50 border-transparent focus:bg-white dark:focus:bg-gray-950 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isEditing}
                  placeholder="Your email address"
                  className="rounded-2xl h-12 bg-gray-50 dark:bg-gray-800/50 border-transparent focus:bg-white dark:focus:bg-gray-950 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] px-1">
                  Account Role
                </label>
                <Input
                  value={role}
                  disabled
                  className="rounded-2xl h-12 bg-gray-50/50 dark:bg-gray-800/20 border-transparent font-medium opacity-60"
                />
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end pt-4 border-t border-gray-50 dark:border-gray-800/50">
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-500/20"
                >
                  {loading ? "Processing..." : "Save Changes"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Re-authentication Modal (Sleek, Compact, Top-Right) */}
      <AnimatePresence>
        {showReauth && (
          <div className="fixed inset-0 z-[60] flex items-start justify-end p-4 pt-20 sm:pt-24 sm:pr-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowReauth(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 20 }}
              className="relative w-full max-w-[280px] bg-white dark:bg-gray-900 rounded-[2rem] p-5 sm:p-6 shadow-2xl border border-gray-100 dark:border-gray-800"
            >
              <h3 className="text-lg font-black mb-5 text-gray-900 dark:text-white tracking-tight text-center">
                Security Check
              </h3>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Verify password"
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 font-medium text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] text-red-500 font-bold bg-red-50 dark:bg-red-500/10 p-3 rounded-xl border border-red-100 dark:border-red-500/20 text-center"
                  >
                    {error}
                  </motion.div>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={handleConfirmEmailChange}
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl font-bold text-sm shadow-xl shadow-blue-500/25 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-95"
                  >
                    Confirm
                  </Button>
                  <button
                    onClick={() => setShowReauth(false)}
                    className="w-full py-2 text-[10px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};



