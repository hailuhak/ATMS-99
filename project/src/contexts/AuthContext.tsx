import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  sendPasswordResetEmail,
  confirmPasswordReset,
  reauthenticateWithCredential,
  EmailAuthProvider,
  verifyBeforeUpdateEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';
import { FieldValue } from 'firebase/firestore';

interface UserWithTimestamp extends User {
  timestamp?: FieldValue;
}

interface AuthContextType {
  currentUser: UserWithTimestamp | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    displayName: string,
    selectedRole: 'user' | 'trainer' | 'trainee'
  ) => Promise<void>;
  loginWithGoogle: (isLoginMode?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  sendPasswordReset: (email: string) => Promise<void>;
  confirmResetPassword: (oobCode: string, newPassword: string) => Promise<void>;
  reauthenticate: (password: string) => Promise<void>;
  verifyEmailUpdate: (newEmail: string) => Promise<void>;
  approveUser?: (userId: string) => Promise<void>;
  rejectUser?: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserWithTimestamp | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Signup ---
  const signup = async (
    email: string,
    password: string,
    displayName: string,
    selectedRole: 'user' | 'trainer' | 'trainee'
  ) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });

    const userData: UserWithTimestamp = {
      uid: result.user.uid,
      email,
      displayName,
      role: 'pending', // always pending in users collection
      photoURL: result.user.photoURL || '',
      createdAt: new Date(),
      lastLogin: new Date(),
      timestamp: serverTimestamp(), // server timestamp
    };

    // --- Store in users collection with pending role ---
    await setDoc(doc(db, 'users', result.user.uid), userData);

    // --- Store in pendingUsers collection with selected role ---
    await setDoc(doc(db, 'pendingUsers', result.user.uid), {
      uid: result.user.uid,
      email,
      displayName,
      role: selectedRole, // role chosen by user
      photoURL: result.user.photoURL || '',
      timestamp: serverTimestamp(),
    });

    setCurrentUser(userData); // allow dashboard render immediately
  };

  // --- Login ---
  const login = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const userRef = doc(db, 'users', result.user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      const newUser: UserWithTimestamp = {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || '',
        role: 'pending',
        photoURL: result.user.photoURL || '',
        createdAt: new Date(),
        lastLogin: new Date(),
        timestamp: serverTimestamp(),
      };
      await setDoc(userRef, newUser);
      setCurrentUser(newUser);
      return;
    }

    const userData = userDoc.data() as UserWithTimestamp;
    await setDoc(userRef, { ...userData, lastLogin: new Date() }, { merge: true });
    setCurrentUser(userData);
  };

  // --- Login with Google ---
  const loginWithGoogle = async (isLoginMode: boolean = true) => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (isLoginMode) {
      if (!userDoc.exists()) {
        const pendingRef = doc(db, 'pendingUsers', user.uid);
        const pendingDoc = await getDoc(pendingRef);

        if (pendingDoc.exists()) {
          // Found in pendingUsers but not users (shouldn't happen with latest logic, but good for healing)
          const pendingData = pendingDoc.data();
          const userData: UserWithTimestamp = {
            uid: user.uid,
            email: user.email || '',
            displayName: pendingData.displayName || user.displayName || '',
            role: 'pending',
            photoURL: user.photoURL || '',
            createdAt: pendingData.createdAt || new Date(),
            lastLogin: new Date(),
            timestamp: serverTimestamp(),
          };
          await setDoc(userRef, userData);
          setCurrentUser(userData);
          return;
        }

        // Truly not registered
        await signOut(auth);
        throw new Error('This account is not registered. Please sign up first.');
      }

      // Exists in users - normal login
      const userData = userDoc.data() as UserWithTimestamp;
      await setDoc(userRef, { ...userData, lastLogin: new Date() }, { merge: true });
      setCurrentUser(userData);
      return;
    }

    // --- Signup Mode ---
    if (!userDoc.exists()) {
      const newUser: UserWithTimestamp = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        role: 'pending',
        photoURL: user.photoURL || '',
        createdAt: new Date(),
        lastLogin: new Date(),
        timestamp: serverTimestamp(),
      };
      await setDoc(userRef, newUser);

      await setDoc(doc(db, 'pendingUsers', user.uid), {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        role: 'trainee',
        photoURL: user.photoURL || '',
        timestamp: serverTimestamp(),
      });

      setCurrentUser(newUser);
    } else {
      // Already exists, just log in
      const userData = userDoc.data() as UserWithTimestamp;
      setCurrentUser(userData);
    }
  };

  // --- Logout ---
  const logout = async () => await signOut(auth);

  // --- Password Reset ---
  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const confirmResetPassword = async (oobCode: string, newPassword: string) => {
    await confirmPasswordReset(auth, oobCode, newPassword);
  };

  // --- Re-authenticate ---
  const reauthenticate = async (password: string) => {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('No user signed in');
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  };

  // --- Verify & Update Email ---
  const verifyEmailUpdate = async (newEmail: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No user signed in');
    await verifyBeforeUpdateEmail(user, newEmail);
  };

  // --- Admin approves user ---
  const approveUser = async (userId: string) => {
    const pendingRef = doc(db, 'pendingUsers', userId);
    const pendingDoc = await getDoc(pendingRef);
    if (!pendingDoc.exists()) return;

    const pendingData = pendingDoc.data();
    if (pendingData) {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { ...pendingData, lastLogin: new Date() }, { merge: true });
      await deleteDoc(pendingRef); // remove from pendingUsers after approval
    }
  };

  // --- Admin rejects user ---
  const rejectUser = async (userId: string) => {
    await deleteDoc(doc(db, 'pendingUsers', userId));
    await deleteDoc(doc(db, 'users', userId)); // optionally remove from users collection too
  };

  // --- Auth state observer ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data() as UserWithTimestamp;

          // Sync email if verified and changed in Auth but not Firestore
          if (firebaseUser.email && firebaseUser.email !== userData.email) {
            await setDoc(userRef, { email: firebaseUser.email }, { merge: true });

            // Also sync in pendingUsers if it exists
            const pendingRef = doc(db, 'pendingUsers', firebaseUser.uid);
            const pendingDoc = await getDoc(pendingRef);
            if (pendingDoc.exists()) {
              await setDoc(pendingRef, { email: firebaseUser.email }, { merge: true });
            }

            userData.email = firebaseUser.email;
          }

          // Sync display name if changed in Auth but not Firestore
          if (firebaseUser.displayName && firebaseUser.displayName !== userData.displayName) {
            await setDoc(userRef, { displayName: firebaseUser.displayName }, { merge: true });

            // Also sync in pendingUsers if it exists
            const pendingRef = doc(db, 'pendingUsers', firebaseUser.uid);
            const pendingDoc = await getDoc(pendingRef);
            if (pendingDoc.exists()) {
              await setDoc(pendingRef, { displayName: firebaseUser.displayName }, { merge: true });
            }

            userData.displayName = firebaseUser.displayName;
          }

          setCurrentUser(userData);
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    login,
    signup,
    loginWithGoogle,
    logout,
    loading,
    sendPasswordReset,
    confirmResetPassword,
    reauthenticate,
    verifyEmailUpdate,
    approveUser,
    rejectUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
