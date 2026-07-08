import { collection, query, limit, getDocs, doc, setDoc, updateDoc, deleteDoc, where, increment, getDoc, addDoc, runTransaction } from 'firebase/firestore';
import { db, auth } from './firebase';
import { OperationType } from './premium';
import { apiFetch } from '../utils/api';
import { Capacitor } from '@capacitor/core';

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(`Firestore Error [${operationType} on ${path}]: ${error instanceof Error ? error.message : String(error)}`);
}

import { User } from '../models/user';
import { getStudentCode, sanitizeUserForRole } from '../utils/privacy';
import { StudentUpdatesService } from './studentUpdates';
import { hashPin } from '../utils/security';
import { safeStorage } from '../lib/storage';

// Cache to store resolved user references to avoid duplicate Firestore lookups
const resolveUserDocCache = new Map<string, { publicRef: any; privateRef: any; userId: string; legacy: boolean }>();

/**
 * Resolves a given key (which can be a random ID, a studentCode, a mobile, or a uid)
 * to both the primary public userId (doc ID in 'users') and the private user data.
 */
export const resolveUserDoc = async (idOrMobile: string): Promise<{ publicRef: any; privateRef: any; userId: string; legacy: boolean }> => {
  if (!idOrMobile) {
    return {
      publicRef: doc(db, 'users', 'unknown'),
      privateRef: doc(db, 'users_private', 'unknown'),
      userId: 'unknown',
      legacy: false
    };
  }

  // Return cached result if available
  if (resolveUserDocCache.has(idOrMobile)) {
    return resolveUserDocCache.get(idOrMobile)!;
  }

  const performResolve = async (): Promise<{ publicRef: any; privateRef: any; userId: string; legacy: boolean }> => {
    // 1. Try directly as document ID in primary 'users'
    const directRef = doc(db, 'users', idOrMobile);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      const isMobileId = /^\d{10}$/.test(idOrMobile);
      return {
        publicRef: directRef,
        privateRef: doc(db, 'users_private', idOrMobile),
        userId: idOrMobile,
        legacy: isMobileId
      };
    }

    // 2. Query 'users_private' by mobile
    const sanitized = idOrMobile.replace(/\D/g, '');
    const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
    let snapPrivMobile = await getDocs(query(collection(db, 'users_private'), where('mobile', '==', tenDigits), limit(1)));
    if (snapPrivMobile.empty && sanitized.length > 10) {
      snapPrivMobile = await getDocs(query(collection(db, 'users_private'), where('mobile', '==', sanitized), limit(1)));
    }
    if (!snapPrivMobile.empty) {
      const parentId = snapPrivMobile.docs[0].id;
      return {
        publicRef: doc(db, 'users', parentId),
        privateRef: doc(db, 'users_private', parentId),
        userId: parentId,
        legacy: false
      };
    }

    // 3. Query 'users' by studentCode
    const qCode = query(collection(db, 'users'), where('studentCode', '==', idOrMobile), limit(1));
    const snapCode = await getDocs(qCode);
    if (!snapCode.empty) {
      const parentId = snapCode.docs[0].id;
      return {
        publicRef: doc(db, 'users', parentId),
        privateRef: doc(db, 'users_private', parentId),
        userId: parentId,
        legacy: false
      };
    }

    // 4. Query 'users_private' by uid
    const qPrivUid = query(collection(db, 'users_private'), where('uid', '==', idOrMobile), limit(1));
    const snapPrivUid = await getDocs(qPrivUid);
    if (!snapPrivUid.empty) {
      const parentId = snapPrivUid.docs[0].id;
      return {
        publicRef: doc(db, 'users', parentId),
        privateRef: doc(db, 'users_private', parentId),
        userId: parentId,
        legacy: false
      };
    }

    // Fallback default
    return {
      publicRef: directRef,
      privateRef: doc(db, 'users_private', idOrMobile),
      userId: idOrMobile,
      legacy: false
    };
  };

  const resolved = await performResolve();
  
  // Store resolved mappings in cache
  resolveUserDocCache.set(idOrMobile, resolved);
  if (resolved.userId && resolved.userId !== idOrMobile) {
    resolveUserDocCache.set(resolved.userId, resolved);
  }
  
  return resolved;
};

export const generateNextStudentId = async (): Promise<string> => {
  try {
    const token = await auth.currentUser?.getIdToken();
    const res = await apiFetch('/api/student/generate-id', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.warn("[Client] API generate-id failed, will try direct client-side fallback. Status:", res.status, errorText);
      throw new Error(`Failed to generate student ID. Server responded: ${res.status} ${errorText}`);
    }
    const data = await res.json();
    return data.id;
  } catch (err) {
    console.warn("[Client] generateNextStudentId API failed, falling back to direct client-side Firestore transaction:", err);
    try {
      const counterRef = doc(db, 'system_config', 'student_id_counter');
      const newId = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let nextId = 1;
        if (counterSnap.exists()) {
          const data = counterSnap.data();
          nextId = (Number(data?.lastId) || 0) + 1;
        }
        transaction.set(counterRef, { lastId: nextId }, { merge: true });
        return nextId;
      });
      return `MG${String(newId).padStart(6, '0')}`;
    } catch (fallbackErr: any) {
      console.error("[Client] Direct client-side student ID generation failed:", fallbackErr);
      throw fallbackErr;
    }
  }
};


const userCache: Record<string, { timestamp: number, data: any }> = {};
const USER_CACHE_DURATION = 60000; // 60 seconds

/**
 * Resolves and fetches full user data (public + private) by any identifier.
 */
export const resolveUserData = async (idOrMobile: string): Promise<{ publicData: any; privateData: any; userId: string; publicRef: any }> => {
  const now = Date.now();
  if (userCache[idOrMobile] && (now - userCache[idOrMobile].timestamp < USER_CACHE_DURATION)) {
    return userCache[idOrMobile].data;
  }

  try {
    const { publicRef, privateRef, userId } = await resolveUserDoc(idOrMobile);
    const [pubSnap, privSnap] = await Promise.all([
      getDoc(publicRef),
      getDoc(privateRef)
    ]);
    
    const publicData = pubSnap.exists() ? pubSnap.data() : {};
    const privateData = privSnap.exists() ? privSnap.data() : {};
    
    const data = { publicData, privateData, userId, publicRef };
    userCache[idOrMobile] = { timestamp: now, data };
    return data;
  } catch (e) {
    console.warn(`Error resolving user data for ${idOrMobile}, returning cached or empty:`, e);
    if (userCache[idOrMobile]) return userCache[idOrMobile].data;
    return { publicData: {}, privateData: {}, userId: idOrMobile, publicRef: null };
  }
};

export const getCachedCurrentUserProfile = (): any => {
  try {
    const serialized = safeStorage.getItem('user_profile');
    if (serialized) {
      return JSON.parse(serialized);
    }
  } catch (e) {
    console.error(e);
  }
  return null;
};

/**
 * Dynamic API Response Sanitizer at the service layer boundary.
 * Completely strips highly sensitive fields like PII and raw IDs before they reach UI layers.
 */
export const getSanitizedUsersList = async (users: User[]): Promise<User[]> => {
  const cachedProfile = getCachedCurrentUserProfile();
  let currentUserRole = cachedProfile?.role || 'student';
  let currentUserId = cachedProfile?.id || '';

  if (!cachedProfile && auth.currentUser) {
    try {
      const currentUid = auth.currentUser.uid;
      const privQ = query(collection(db, 'users_private'), where('uid', '==', currentUid), limit(1));
      const privSnap = await getDocs(privQ);
      if (!privSnap.empty) {
        currentUserId = privSnap.docs[0].id;
        const pubSnap = await getDoc(doc(db, 'users', currentUserId));
        if (pubSnap.exists()) {
          currentUserRole = pubSnap.data()?.role || 'student';
        }
      }
    } catch (e) {
      // Ignored fallback
    }
  }

  return users.map(u => {
    const isSelf = currentUserId === u.id;
    return sanitizeUserForRole(u, currentUserRole, isSelf) as User;
  });
};

export const incrementPoints = async (idOrMobile: string, amount: number, maxPoints: number) => {
  const { publicRef, userId } = await resolveUserDoc(idOrMobile);
  const snap = await getDoc(publicRef);
  if (!snap.exists()) return;
  const data = snap.data() as any;
  
  // Track daily history
  const today = new Date().toISOString().split('T')[0];
  let dailyScores: any[] = data.dailyScores || [];
  
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString().split('T')[0];
  dailyScores = dailyScores.filter(d => d.date >= tenDaysAgoStr);

  const todayIndex = dailyScores.findIndex(d => d.date === today);
  const isEmergency = maxPoints === 0;

  if (todayIndex >= 0) {
      dailyScores[todayIndex].obtained += amount;
      if (isEmergency) dailyScores[todayIndex].emergency = true;
  } else {
      dailyScores.push({ date: today, obtained: amount, emergency: isEmergency });
  }

  // Calculate 10-day active rolling percentage
  const holidaysQ = query(collection(db, 'holidays'), where('batchId', 'in', [data.batchId || null, null]));
  const holidaysSnap = await getDocs(holidaysQ);
  const holidays = holidaysSnap.docs.map(d => d.data());

  // Fetch student approved leaves
  let approvedLeaves: any[] = [];
  try {
    const leavesQ = query(collection(db, 'leaves'), where('userId', '==', userId), where('status', '==', 'Approved'));
    const leavesSnap = await getDocs(leavesQ);
    approvedLeaves = leavesSnap.docs.map(d => d.data());
  } catch (err) {
    console.warn("Could not query approved leaves during incrementPoints calculation", err);
  }

  let checkDate = new Date();
  let maxPossibleOver10Days = 0;

  for (let i = 0; i < 10; i++) {
     const dateStr = checkDate.toISOString().split('T')[0];
     const isHoliday = holidays.some(h => h.status !== 'deleted' && dateStr >= h.startDate && dateStr <= h.endDate);
     const isLeaveDay = approvedLeaves.some(l => dateStr >= l.startDate && dateStr <= l.endDate);
     const dailyRecord = dailyScores.find(d => d.date === dateStr);
     const isEmergencyDay = dailyRecord?.emergency === true;

     if (!isHoliday && !isLeaveDay && !isEmergencyDay) {
          maxPossibleOver10Days += 70;
     }
     checkDate.setDate(checkDate.getDate() - 1);
  }

  let totalObtained = 0;
  for (const s of dailyScores) {
      totalObtained += s.obtained;
  }

  const percentage = maxPossibleOver10Days > 0 ? (totalObtained / maxPossibleOver10Days) * 100 : 100;
  
  let category = 'Review Category';
  if (percentage >= 95) category = 'Elite';
  else if (percentage >= 70) category = 'Base';

  const pubSnap = await getDoc(publicRef);
  if (pubSnap.exists()) {
    await updateDoc(publicRef, { 
      dailyScores,
      consistencyIndex: percentage, 
      updatedAt: new Date().toISOString() 
    });
  } else {
    await setDoc(publicRef, { 
      dailyScores,
      consistencyIndex: percentage, 
      updatedAt: new Date().toISOString() 
    }, { merge: true });
  }
  clearUsersCache();
};

let usersCache: { data: User[]; timestamp: number } | null = null;
let usersByRoleCache: Record<string, { data: User[]; timestamp: number }> = {};
let publicUsersCache: { data: User[]; timestamp: number } | null = null;
const CACHE_DURATION_MS = Capacitor.isNativePlatform() ? 30000 : 2000; // 30-second cache on mobile, 2-second short cache on web

export const clearUsersCache = () => {
  usersCache = null;
  usersByRoleCache = {};
  publicUsersCache = null;
};

export const getUsers = async (): Promise<User[]> => {
  const now = Date.now();
  if (usersCache && (now - usersCache.timestamp < CACHE_DURATION_MS)) {
    return usersCache.data;
  }

  const q = query(collection(db, 'users'), limit(50));
  const snap = await getDocs(q);

  const cachedProfile = getCachedCurrentUserProfile();
  const roleLower = (cachedProfile?.role || '').toLowerCase();
  const isMentorUser = 
    roleLower === 'mentor' || 
    roleLower === 'primary-mentor' || 
    roleLower === 'primarymentor' || 
    roleLower === 'staff' || 
    roleLower === 'admin' ||
    roleLower === 'examiner';

  const privateDocsMap = new Map<string, any>();
  let privateDocsQueried = false;
  if (isMentorUser) {
    try {
      const privSnap = await getDocs(query(collection(db, 'users_private'), limit(50)));
      privSnap.forEach(d => {
        privateDocsMap.set(d.id, d.data());
      });
      privateDocsQueried = true;
    } catch (e) {
      console.warn("Could not query all users_private in bulk, falling back:", e);
    }
  }

  const promises = snap.docs.map(async (d) => {
    const data = d.data();
    let privateData = privateDocsMap.get(d.id) || {};
    
    // Fallback if bulk query fails but caller is mentor
    if (isMentorUser && !privateDocsQueried) {
      try {
        const privSnap = await getDoc(doc(db, 'users_private', d.id));
        if (privSnap.exists()) {
          privateData = privSnap.data();
        }
      } catch (e) {
        // Ignored
      }
    }

    const finalProfile = { ...data, ...privateData, id: d.id } as User;
    if (!finalProfile.studentCode) {
      finalProfile.studentCode = getStudentCode(finalProfile);
    }
    return finalProfile;
  });

  const list = await Promise.all(promises);
  const sanitized = await getSanitizedUsersList(list);

  usersCache = { data: sanitized, timestamp: Date.now() };
  return sanitized;
};

export const getPublicUsers = async (): Promise<User[]> => {
  const now = Date.now();
  if (publicUsersCache && (now - publicUsersCache.timestamp < CACHE_DURATION_MS)) {
    return publicUsersCache.data;
  }

  const q = query(collection(db, 'users'), limit(50));
  const snap = await getDocs(q);
  const list: User[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const finalProfile = { ...data, id: d.id } as User;
    if (!finalProfile.studentCode) {
      finalProfile.studentCode = getStudentCode(finalProfile);
    }
    list.push(finalProfile);
  }

  publicUsersCache = { data: list, timestamp: Date.now() };
  return list;
};

export const getUsersByRole = async (role: string): Promise<User[]> => {
  const now = Date.now();
  if (usersByRoleCache[role] && (now - usersByRoleCache[role].timestamp < CACHE_DURATION_MS)) {
    return usersByRoleCache[role].data;
  }

  const q = query(collection(db, 'users'), where('role', '==', role), limit(50));
  const snap = await getDocs(q);

  const cachedProfile = getCachedCurrentUserProfile();
  const roleLower = (cachedProfile?.role || '').toLowerCase();
  const isMentorUser = 
    roleLower === 'mentor' || 
    roleLower === 'primary-mentor' || 
    roleLower === 'primarymentor' || 
    roleLower === 'staff' || 
    roleLower === 'admin' ||
    roleLower === 'examiner';

  const privateDocsMap = new Map<string, any>();
  let bulkPrivateFailed = false;
  if (isMentorUser) {
    try {
      const privSnap = await getDocs(query(collection(db, 'users_private'), limit(50)));
      privSnap.forEach(d => {
        privateDocsMap.set(d.id, d.data());
      });
    } catch (e) {
      console.warn("Could not query all users_private in bulk, falling back:", e);
      bulkPrivateFailed = true;
    }
  }

  const promises = snap.docs.map(async (d) => {
    const data = d.data();
    let privateData = privateDocsMap.get(d.id) || {};
    
    // Fallback if bulk query fails but caller is mentor
    if (isMentorUser && bulkPrivateFailed) {
      try {
        const privSnap = await getDoc(doc(db, 'users_private', d.id));
        if (privSnap.exists()) {
          privateData = privSnap.data();
        }
      } catch (e) {
        // Ignored
      }
    }
    const finalProfile = { ...data, ...privateData, id: d.id } as User;
    if (!finalProfile.studentCode) {
      finalProfile.studentCode = getStudentCode(finalProfile);
    }
    return finalProfile;
  });

  const list = await Promise.all(promises);
  const sanitized = await getSanitizedUsersList(list);

  usersByRoleCache[role] = { data: sanitized, timestamp: Date.now() };
  return sanitized;
};

export const getUsersByBatch = async (batchId: string): Promise<User[]> => {
  if (!batchId) return [];
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'student'),
    where('batchId', '==', batchId),
    limit(50)
  );
  const snap = await getDocs(q);
  const list: User[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const finalProfile = { ...data, id: d.id } as User;
    if (!finalProfile.studentCode) {
      finalProfile.studentCode = getStudentCode(finalProfile);
    }
    list.push(finalProfile);
  }
  return list;
};

export const createUserProfile = async (userData: Partial<User>) => {
  if (!userData.mobile) throw new Error("Mobile number is required to enroll a user.");
  if (!userData.uid) throw new Error("UID is required to enroll a user.");
  const sanitizedMobile = userData.mobile.replace(/\D/g, '');

  const userId = sanitizedMobile; // Use verified mobile number as document ID
  const missionGridStudentId = await generateNextStudentId();

  // Try to fetch current IP and user agent from our own endpoint
  let fetchedIp = 'unknown';
  let fetchedUA = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  try {
    const res = await apiFetch('/api/my-ip');
    if (res.ok) {
      const json = await res.json();
      fetchedIp = json.ip || 'unknown';
      if (json.userAgent) {
        fetchedUA = json.userAgent;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch IP and User-Agent from backend:", err);
  }

  // Parse OS and Browser details on the client side
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let deviceType = "Desktop";

  if (/chrome|crios/i.test(fetchedUA) && !/edge|edg/i.test(fetchedUA) && !/opr|opera/i.test(fetchedUA)) {
    browser = "Chrome";
  } else if (/safari/i.test(fetchedUA) && !/chrome|crios/i.test(fetchedUA)) {
    browser = "Safari";
  } else if (/firefox|fxios/i.test(fetchedUA)) {
    browser = "Firefox";
  } else if (/edge|edg/i.test(fetchedUA)) {
    browser = "Edge";
  } else if (/opr|opera/i.test(fetchedUA)) {
    browser = "Opera";
  }

  if (/windows/i.test(fetchedUA)) {
    os = "Windows";
  } else if (/macintosh|mac os x/i.test(fetchedUA)) {
    os = "macOS";
  } else if (/android/i.test(fetchedUA)) {
    os = "Android";
    deviceType = "Mobile";
  } else if (/iphone|ipad|ipod/i.test(fetchedUA)) {
    os = "iOS";
    deviceType = /ipad/i.test(fetchedUA) ? "Tablet" : "Mobile";
  } else if (/linux/i.test(fetchedUA)) {
    os = "Linux";
  }

  // Get device ID
  let deviceId = typeof localStorage !== 'undefined' ? localStorage.getItem('missiongrid_device_id') : null;
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('missiongrid_device_id', deviceId);
    }
  }

  const currentDevice = `${browser} on ${os} (${deviceType})`;
  const deviceName = `${os} Device (${browser})`;
  const deviceModel = deviceType;
  const registrationSource = 'web';
  const currentBatch = userData.batchId || 'Aspirants';

  const now = new Date();
  const registrationDate = now.toISOString().split('T')[0];
  const registrationTime = now.toTimeString().split(' ')[0];
  const registrationTimestamp = now.toISOString();

  const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const premiumExpiryDate = expiryDate.toISOString().split('T')[0];

  const publicData = {
    name: userData.name || 'Student',
    photoUrl: userData.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name || 'Student'}`,
    role: 'student' as any, // Every newly registered user MUST ALWAYS be created as a STUDENT
    isPremium: true, // Default to 30 days active premium access for new signups
    premium: true, // Automatically activate Premium
    premiumStatus: 'active' as any, // Required: "active"
    premiumPlan: 'Mission Selection Premium', // Required field
    premiumSource: 'Auto Registration', // Required field
    premiumStartDate: registrationTimestamp, // Required: server timestamp (ISO)
    premiumExpiryDate: expiryDate.toISOString(), // Required: 30 days from registration
    premiumDays: 30, // Required field
    premiumType: 'FREE_TRIAL',
    trialDays: 30,
    remainingPremiumDays: 30,
    consecutiveMissedMissions: 0,
    lastMissionSubmissionDate: null as string | null,
    manualPremiumOverride: false,
    lastPremiumChangeDate: registrationTimestamp,
    premiumChangedBy: 'system',
    
    // Automatic Data Capture - Permanent Identity
    missionGridStudentId: missionGridStudentId,
    studentCode: missionGridStudentId,
    uid: userData.uid,
    mobile: sanitizedMobile,
    
    registrationDate,
    registrationTime,
    registrationTimestamp,
    registrationDateTime: registrationTimestamp,
    
    // Device & Location info captured on public and private documents
    deviceId,
    deviceName,
    deviceModel,
    operatingSystem: os,
    browser,
    browserInfo: fetchedUA,
    deviceInfo: fetchedUA,
    currentDevice,
    registrationIP: fetchedIp,
    currentIP: fetchedIp,
    lastLoginIP: fetchedIp,
    
    registrationSource,
    batchId: currentBatch,
    currentBatch,
    status: userData.status || 'active',
    
    category: userData.category || 'Review Category',
    missionPoints: userData.missionPoints || 0,
    currentRank: userData.currentRank || 0,
    previousRank: userData.previousRank || 0,
    currentStreak: userData.currentStreak || 0,
    streakUpdatedAt: userData.streakUpdatedAt || registrationTimestamp,
    reputationScore: userData.reputationScore || 100,
    consistencyIndex: userData.consistencyIndex || 100,
    achievements: userData.achievements || [],
    themePreference: userData.themePreference || 'light',
    createdAt: registrationTimestamp,
    updatedAt: registrationTimestamp,
    isProfileCompleted: false
  };

  const privateData = {
    mobile: sanitizedMobile,
    email: userData.email || '',
    pin: hashPin(userData.pin || '123456'),
    uid: userData.uid,
    address: userData.address || '',
    
    registrationDateTime: registrationTimestamp,
    registrationDate,
    registrationTime,
    registrationTimestamp,
    
    browser,
    operatingSystem: os,
    deviceType,
    deviceId,
    deviceName,
    deviceModel,
    registrationIP: fetchedIp,
    currentIP: fetchedIp,
    lastLoginIP: fetchedIp,
    lastLoginDateTime: registrationTimestamp,
    deviceInfo: fetchedUA,
    currentDevice,
    loginCount: 1,
    lastActiveDate: registrationTimestamp,
    loginHistory: userData.loginHistory || [],
    userId: userId,
    createdAt: registrationTimestamp,
    updatedAt: registrationTimestamp
  };

  try {
    await setDoc(doc(db, 'users', userId), publicData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${userId}`);
  }

  try {
    await setDoc(doc(db, 'users_private', userId), privateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users_private/${userId}`);
  }

  try {
    await setDoc(doc(db, 'user_roles', userData.uid), {
      userId: userId,
      role: 'student',
      updatedAt: registrationTimestamp
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `user_roles/${userData.uid}`);
  }

  // Create a document in premium_history containing user's exact required fields
  try {
    await addDoc(collection(db, 'premium_history'), {
      uid: userId,
      studentId: userId,
      mobile: sanitizedMobile,
      planName: "Mission Selection Premium",
      source: "Auto Registration",
      activatedAt: registrationTimestamp,
      expiryDate: expiryDate.toISOString(),
      status: "active",
      // Standard system audit fields for compatibility
      studentName: userData.name || 'Student',
      action: 'Auto Premium Activation',
      details: 'Premium automatically activated on registration.',
      timestamp: registrationTimestamp,
      date: registrationDate,
      time: registrationTime
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'premium_history');
  }

  clearUsersCache();
  return { ...publicData, ...privateData, id: userId };
};

export const updateUserProfile = async (idOrMobile: string, data: Partial<User>) => {
  const { publicRef, privateRef } = await resolveUserDoc(idOrMobile);

  const pubSnap = await getDoc(publicRef);
  const isPreviouslyCompleted = pubSnap.exists() && !!(pubSnap.data() as any)?.isProfileCompleted;

  // Enforce Student Permanent Identity constraint:
  // Firebase Auth UID and OTP Verified Mobile Number are permanent and unmodifiable by students.
  const currentUserProfile = getCachedCurrentUserProfile();
  const isMentor = currentUserProfile && [
    'mentor', 'primary-mentor', 'primarymentor', 'staff', 'admin', 'examiner'
  ].includes((currentUserProfile.role || '').toLowerCase());

  // Enforce Student Permanent Identity and Premium constraints at all times
  if (!isMentor) {
    const restrictedFields = [
      'role', 'uid', 'mobile', 'missionGridStudentId', 'studentCode',
      'registrationDate', 'registrationTime', 'registrationTimestamp', 'registrationDateTime',
      'deviceId', 'deviceName', 'deviceModel', 'operatingSystem', 'browser', 'browserInfo', 'deviceInfo', 'currentDevice',
      'registrationIP', 'currentIP', 'lastLoginIP', 'registrationSource',
      'isPremium', 'premiumStatus', 'premiumType', 'premiumDuration', 'premiumStartDate', 'premiumExpiryDate', 'remainingPremiumDays', 'premiumSource', 'trialDays', 'manualPremiumOverride'
    ];
    for (const field of restrictedFields) {
      if ((data as any)[field] !== undefined) {
        delete (data as any)[field];
      }
    }

    // Once profile is completed, batch selection is also locked permanently
    if (isPreviouslyCompleted) {
      if ((data as any).batchId !== undefined) delete (data as any).batchId;
      if ((data as any).currentBatch !== undefined) delete (data as any).currentBatch;
    }
  }

  const publicFields = [
    'name', 'photoUrl', 'role', 'status', 'batchId', 'batchChangedDate', 'batchChangedBy', 'category', 
    'currentRank', 'previousRank', 'currentStreak', 
    'streakUpdatedAt', 'reputationScore', 'consistencyIndex', 'achievements', 
    'themePreference', 'restrictedFromSubmitting', 'restrictedFromPosting', 
    'restrictedFromInteractions', 'exemptFromPenalty', 'excusedFromAttendance', 'isPremium', 'testAccess', 'isProfileCompleted',
    'membership', 'isEnrolled', 'joinedMissionGridAt',
    'premiumStatus', 'premiumType', 'premiumStartDate', 'premiumExpiryDate', 'remainingPremiumDays', 'premiumSource', 'trialDays',
    'registrationDate', 'registrationTime', 'registrationTimestamp', 'missionGridStudentId', 'studentCode',
    'deviceId', 'deviceName', 'deviceModel', 'operatingSystem', 'browser', 'browserInfo', 'deviceInfo', 'registrationIP', 'currentIP', 'lastLoginIP', 'registrationSource', 'currentBatch'
  ];
  const privateFields = [
    'mobile', 'email', 'pin', 'uid', 'address', 'loginHistory',
    'registrationDateTime', 'registrationDate', 'registrationTime', 'registrationTimestamp',
    'browser', 'operatingSystem', 'deviceType', 'deviceId', 'deviceName', 'deviceModel',
    'registrationIP', 'currentIP', 'lastLoginIP', 'lastLoginDateTime', 'deviceInfo', 'currentDevice', 'loginCount', 'lastActiveDate'
  ];

  const publicUpdate: any = {};
  const privateUpdate: any = {};
  let numPub = 0;
  let numPriv = 0;

  for (const k of Object.keys(data)) {
    if (publicFields.includes(k)) {
      publicUpdate[k] = (data as any)[k];
      numPub++;
    } else if (privateFields.includes(k)) {
      if (k === 'pin') {
        privateUpdate[k] = hashPin((data as any)[k]);
      } else {
        privateUpdate[k] = (data as any)[k];
      }
      numPriv++;
    }
  }

  // 1. Commit the actual profile changes to the database first
  if (numPub > 0) {
    publicUpdate.updatedAt = new Date().toISOString();
    console.log(`[UserTrace] updateUserProfile updating publicFields:`, publicUpdate);
    if (pubSnap.exists()) {
      await updateDoc(publicRef, publicUpdate);
    } else {
      await setDoc(publicRef, publicUpdate, { merge: true });
    }
  }

  if (numPriv > 0) {
    privateUpdate.updatedAt = new Date().toISOString();
    await setDoc(privateRef, privateUpdate, { merge: true });
  }

  // Update user_roles mapping if role was modified (only mentors can do this due to restrictedFields)
  if (data.role) {
    try {
       const uidToUpdate = pubSnap.exists() ? (pubSnap.data() as any).uid : null;
       if (uidToUpdate) {
          await setDoc(doc(db, 'user_roles', uidToUpdate), { role: data.role }, { merge: true });
          console.log(`[UserTrace] Synced role ${data.role} to user_roles/${uidToUpdate}`);
       }
    } catch (e) {
       console.warn('Failed to sync role to user_roles:', e);
    }
  }

  // 2. Clear caches to ensure subsequent queries see updated state
  clearUsersCache();

  // Trigger Custom Claims sync on backend if role, batch, status, or premium status changes
  if (data.role !== undefined || data.batchId !== undefined || data.status !== undefined || data.isPremium !== undefined || data.premiumStatus !== undefined) {
    try {
      const { userId } = await resolveUserDoc(idOrMobile);
      const privSnap = await getDoc(privateRef);
      let studentUid = (data as any).uid || (privSnap.exists() ? (privSnap.data() as any).uid : '');
      if (!studentUid && privSnap.exists()) {
        studentUid = (privSnap.data() as any)?.uid;
      }
      
      if (studentUid) {
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
        if (idToken) {
          await apiFetch('/api/auth/sync-claims', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ targetUid: studentUid })
          });
          console.log(`[ClaimsSync] Triggered claim sync for user UID: ${studentUid}`);
          
          if (auth.currentUser && studentUid === auth.currentUser.uid) {
            await auth.currentUser.getIdToken(true);
          }
        }
      }
    } catch (claimsErr) {
      console.warn("[ClaimsSync] Non-fatal: Failed to sync claims on profile update:", claimsErr);
    }
  }

  // 3. Generate audited student activity updates safely now that UID linkage exists
  if (data.isPremium !== undefined) {
    const { userId } = await resolveUserDoc(idOrMobile);
    const isPremium = data.isPremium;
    try {
      await StudentUpdatesService.createUpdate({
        studentId: userId,
        type: isPremium ? 'premium_activated' : 'premium_expired',
        title: isPremium ? '⭐ Premium Activated' : '⭐ Premium Expired',
        description: isPremium 
          ? 'Your mentor has activated SSC Mentorship Premium for your profile!' 
          : 'Your SSC Mentorship Premium has expired. Please contact your coordinator.'
      });
    } catch (err) {
      console.error('Error logging premium status student update:', err);
    }
  }

  // Log status changes
  if (data.status !== undefined) {
    const { userId } = await resolveUserDoc(idOrMobile);
    try {
      await StudentUpdatesService.createUpdate({
        studentId: userId,
        type: 'mentor_update',
        title: '📢 Profile Status Updated',
        description: `Your profile status has been changed to: ${data.status.toUpperCase()}.`
      });
    } catch (err) {
      console.error('Error logging status update:', err);
    }
  }

  // Log restrictions
  if (data.restrictedFromSubmitting !== undefined) {
    const { userId } = await resolveUserDoc(idOrMobile);
    try {
      await StudentUpdatesService.createUpdate({
        studentId: userId,
        type: 'mentor_update',
        title: data.restrictedFromSubmitting ? '⚠️ Submission Restricted' : '✅ Submission Enabled',
        description: data.restrictedFromSubmitting 
          ? 'Your mentor has restricted your mission submission access. Contact support for details.' 
          : 'Your mission submission access has been restored!'
      });
    } catch (err) {
      console.error('Error logging restriction update:', err);
    }
  }

  // Log level/category changes
  if (data.category !== undefined) {
    const { userId } = await resolveUserDoc(idOrMobile);
    try {
      await StudentUpdatesService.createUpdate({
        studentId: userId,
        type: 'mentor_update',
        title: '📈 Level Adjusted',
        description: `Your performance category has been set to "${data.category}" based on mentor review.`
      });
    } catch (err) {
      console.error('Error logging category update:', err);
    }
  }

  // Log batch changes
  if (data.batchId !== undefined) {
    const { userId } = await resolveUserDoc(idOrMobile);
    try {
      await StudentUpdatesService.createUpdate({
        studentId: userId,
        type: 'mentor_update',
        title: '🤝 Batch Re-assigned',
        description: `Your coordinating batch has been updated to "${data.batchId}". Refresh your dashboard to see batch-specific updates.`
      });
    } catch (err) {
      console.error('Error logging batch update:', err);
    }
  }

  // Log PIN resets
  if (data.pin !== undefined) {
    const { userId } = await resolveUserDoc(idOrMobile);
    try {
      await StudentUpdatesService.createUpdate({
        studentId: userId,
        type: 'mentor_update',
        title: '🔐 Security Update',
        description: 'Your login PIN has been updated by your mentor. Keep it secure!'
      });
    } catch (err) {
      console.error('Error logging PIN update:', err);
    }
  }
};

export const deleteUserProfile = async (idOrMobile: string) => {
  const { publicRef, privateRef } = await resolveUserDoc(idOrMobile);
  await deleteDoc(publicRef);
  await deleteDoc(privateRef);
  clearUsersCache();
};
