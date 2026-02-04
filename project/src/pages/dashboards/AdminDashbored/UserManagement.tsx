import React, { useState, useEffect } from "react";
import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Users, Plus, Edit2, Trash2, Eye, EyeOff } from "lucide-react";
import { db, auth } from "../../../lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit,
  query,
  onSnapshot,
  where,
  getDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, updateEmail } from "firebase/auth";

interface User {
  id?: string;
  uid: string;
  displayName: string;
  email: string;
  role: "trainee" | "trainer" | "admin" | "pending";
  createdAt?: Date;
  isSuperAdmin?: boolean;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [newUser, setNewUser] = useState({
    displayName: "",
    email: "",
    password: "",
    role: "trainee" as "trainee" | "trainer" | "admin",
  });

  const currentUser = auth.currentUser;

  // 🔹 Check if current user is Super Admin
  useEffect(() => {
    const fetchSuperAdminStatus = async () => {
      if (!currentUser) return;
      const userRef = doc(db, "users", currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setIsSuperAdmin(data.isSuperAdmin === true);
      }
    };
    fetchSuperAdminStatus();
  }, [currentUser]);

  // 🔹 Real-time Firestore subscription
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate
          ? doc.data().createdAt.toDate()
          : new Date(),
      })) as User[];
      setUsers(usersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 🔹 Log admin actions
  const addActivityLog = async (
    userName: string,
    action: string,
    target: string,
    details?: string
  ) => {
    try {
      await setDoc(doc(collection(db, "activityLogs")), {
        userName,
        action,
        target,
        details: details || "",
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error logging activity:", err);
    }
  };

  // 🔹 Add User
  const handleAddUser = async () => {
    const { displayName, email, password, role } = newUser;
    if (!displayName || !email || !password) {
      alert("Please fill all fields.");
      return;
    }

    try {
      // Prevent duplicate users
      const userRef = collection(db, "users");
      const q = query(userRef, where("email", "==", email));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        alert("User with this email already exists!");
        return;
      }

      // Prevent non-super admins from creating admins
      if (role === "admin" && !isSuperAdmin) {
        alert("Only Super Admins can create new admins!");
        return;
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      const userData: User = {
        uid,
        displayName,
        email,
        role: "pending",
        createdAt: new Date(),
      };

      await setDoc(doc(db, "users", uid), {
        ...userData,
        lastLogin: new Date(),
        timestamp: serverTimestamp(),
      });

      await setDoc(doc(db, "pendingUsers", uid), {
        uid,
        displayName,
        email,
        role,
        timestamp: serverTimestamp(),
      });

      await addActivityLog(
        currentUser?.displayName || "Admin",
        "added",
        displayName,
        `Requested role: ${role}`
      );

      setNewUser({ displayName: "", email: "", password: "", role: "trainee" });
      setShowAddUserForm(false);
      alert("User added successfully (pending approval)!");
    } catch (err: any) {
      console.error("Error adding user:", err);
      alert(`Error: ${err.message}`);
    }
  };

  // 🔹 Edit User
  const handleSaveEdit = async () => {
    if (!editingUser || !editingUser.id) return;

    try {
      // Only super admins can edit other admins
      if (
        editingUser.role === "admin" &&
        editingUser.uid !== currentUser?.uid &&
        !isSuperAdmin
      ) {
        alert("You cannot edit another admin!");
        return;
      }

      await updateDoc(doc(db, "users", editingUser.id), {
        displayName: editingUser.displayName,
        email: editingUser.email,
        role: editingUser.role,
      });

      if (
        currentUser &&
        currentUser.uid === editingUser.uid &&
        currentUser.email !== editingUser.email
      ) {
        await updateEmail(currentUser, editingUser.email);
      }

      await addActivityLog(
        currentUser?.displayName || "Admin",
        "edited",
        editingUser.displayName,
        `Role changed to: ${editingUser.role}`
      );

      setEditingUser(null);
      alert("User updated successfully!");
    } catch (err: any) {
      console.error("Error updating user:", err);
      alert(`Error: ${err.message}`);
    }
  };

  // 🔹 Delete User
  const handleDeleteUser = async (user: User) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    // Prevent deleting super admin
    if (user.isSuperAdmin) {
      alert("You cannot delete the Super Admin!");
      return;
    }

    if (
      (user.role === "admin" && !isSuperAdmin) ||
      user.uid === currentUser?.uid
    ) {
      alert("You cannot delete this user!");
      return;
    }

    try {
      if (!user.id) return;
      await deleteDoc(doc(db, "users", user.id));

      await addActivityLog(
        currentUser?.displayName || "Admin",
        "deleted",
        user.displayName
      );

      alert("User deleted successfully!");
    } catch (err: any) {
      console.error("Error deleting user:", err);
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            User Management
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Manage users and their roles
          </p>
        </div>
        <Button onClick={() => setShowAddUserForm(true)} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      {/* Add User Form */}
      {showAddUserForm && (
        <Card className="rounded-2xl overflow-hidden border-none shadow-lg">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Create New User</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                placeholder="Full Name"
                value={newUser.displayName}
                onChange={(e) =>
                  setNewUser({ ...newUser, displayName: e.target.value })
                }
              />
              <Input
                placeholder="Email"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
              />
              <div className="relative">
                <Input
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser({
                    ...newUser,
                    role: e.target.value as "trainee" | "trainer" | "admin",
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="trainee">Trainee</option>
                <option value="trainer">Trainer</option>
                {isSuperAdmin && <option value="admin">Admin</option>}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowAddUserForm(false)} className="px-6">
                Cancel
              </Button>
              <Button onClick={handleAddUser} className="px-6 shadow-lg shadow-blue-500/20">
                Save User
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit User Form */}
      {editingUser && (
        <Card className="rounded-2xl overflow-hidden border-none shadow-lg">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Edit User Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                placeholder="Full Name"
                value={editingUser.displayName}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, displayName: e.target.value })
                }
              />
              <Input
                placeholder="Email"
                value={editingUser.email}
                onChange={(e) =>
                  setEditingUser({ ...editingUser, email: e.target.value })
                }
              />
              <select
                value={editingUser.role}
                onChange={(e) =>
                  setEditingUser({
                    ...editingUser,
                    role: e.target.value as "trainee" | "trainer" | "admin",
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="trainee">Trainee</option>
                <option value="trainer">Trainer</option>
                {(isSuperAdmin || editingUser.uid === currentUser?.uid) && (
                  <option value="admin">Admin</option>
                )}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditingUser(null)} className="px-6">
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} className="px-6 shadow-lg shadow-blue-500/20">
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Content */}
      <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
        <CardContent className="p-0 sm:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-xl font-semibold text-gray-500 dark:text-gray-400">No users found</p>
              <p className="text-gray-400 mt-2">Try adding a new user to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Email Address</th>
                      <th className="px-6 py-4">Access Role</th>
                      <th className="px-6 py-4">Created On</th>
                      <th className="px-6 py-4 text-right">Settings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {users.map((user) => {
                      const disableEdit = user.isSuperAdmin && !isSuperAdmin;
                      const disableDelete = user.isSuperAdmin && !isSuperAdmin;

                      return (
                        <tr key={user.id || user.uid} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold mr-3 shrink-0">
                                {user.displayName?.charAt(0) || "U"}
                              </div>
                              <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[150px]">
                                {user.displayName || "N/A"}
                                {user.isSuperAdmin && (
                                  <span className="block text-[10px] text-yellow-600 uppercase tracking-tighter">Super Admin</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 truncate max-w-[200px]">{user.email}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide
                              ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                user.role === 'trainer' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-400">
                            {user.createdAt instanceof Date
                              ? user.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : "-"}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                disabled={disableEdit}
                                className={`p-2 rounded-lg transition-colors ${disableEdit ? "text-gray-300 dark:text-gray-700 cursor-not-allowed" : "text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"}`}
                                onClick={() => !disableEdit && setEditingUser(user)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                disabled={disableDelete}
                                className={`p-2 rounded-lg transition-colors ${disableDelete ? "text-gray-300 dark:text-gray-700 cursor-not-allowed" : "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"}`}
                                onClick={() => !disableDelete && handleDeleteUser(user)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700 px-4">
                {users.map((user) => (
                  <div key={user.id || user.uid} className="py-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 shrink-0">
                          {user.displayName?.charAt(0) || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white truncate">{user.displayName || "N/A"}</p>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'text-purple-500' : user.role === 'trainer' ? 'text-blue-500' : 'text-emerald-500'}`}>
                            {user.role}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-blue-500 active:scale-90 transition-transform"
                          onClick={() => setEditingUser(user)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-red-500 active:scale-90 transition-transform"
                          onClick={() => handleDeleteUser(user)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-gray-400 mb-1">Email</p>
                        <p className="text-gray-900 dark:text-white font-medium break-all">{user.email}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 mb-1">Joined</p>
                        <p className="text-gray-900 dark:text-white font-medium">
                          {user.createdAt instanceof Date
                            ? user.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
