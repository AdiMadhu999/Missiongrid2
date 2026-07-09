import { collection, query, where, getDocs, doc, updateDoc, setDoc, getDoc, addDoc, orderBy, limit } from 'firebase/firestore';
import { db, auth } from './firebase';
import { apiFetch } from '../utils/api';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

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
  throw new Error(JSON.stringify(errInfo));
}

export interface PremiumHistoryLog {
  id?: string;
  studentId: string;
  status: 'active' | 'expired' | 'revoked';
  isPremium: boolean;
  premiumExpiryDate?: string;
  action: string;
  updatedBy: string;
  updatedByName: string;
  timestamp: string;
  details: string;
  date?: string;
  time?: string;
  previousStatus?: string;
  newStatus?: string;
  previousExpiryDate?: string;
  newExpiryDate?: string;
  reason?: string;
}

export interface SecurityHistoryLog {
  id?: string;
  studentId: string;
  type: 'login' | 'active_check' | 'registration' | 'manual_change';
  ipAddress: string;
  deviceInfo: string;
  timestamp: string;
  details: string;
}

export const PremiumService = {
  /**
   * Tracks a student login on the backend, capturing their request IP and user agent.
   */
  async trackLoginOnBackend(): Promise<{ success: boolean; ipAddress: string; userAgent: string }> {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, ipAddress: '', userAgent: '' };
    }

    try {
      let deviceId = localStorage.getItem('missiongrid_device_id');
      if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('missiongrid_device_id', deviceId);
      }

      const idToken = await user.getIdToken();
      const response = await apiFetch('/api/premium/track-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ deviceId })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return await response.json();
    } catch (err) {
      console.error('Failed to track login on backend:', err);
      return { success: false, ipAddress: '', userAgent: 'Local Client' };
    }
  },

  /**
   * Triggers the daily consistency compliance check on the backend.
   */
  async runDailyCheckOnBackend(): Promise<any> {
    const user = auth.currentUser;
    if (!user) throw new Error('Authentication required.');

    try {
      const idToken = await user.getIdToken();
      const response = await apiFetch('/api/premium/run-daily-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return await response.json();
    } catch (err) {
      console.error('Failed to trigger daily check:', err);
      throw err;
    }
  },

  /**
   * Fetch Premium History for a specific student. (Mentors Only)
   */
  async getPremiumHistory(studentId: string): Promise<PremiumHistoryLog[]> {
    const path = 'premium_history';
    try {
      const q = query(
        collection(db, path),
        where('studentId', '==', studentId),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PremiumHistoryLog));
    } catch (err) {
      // If ordering fails because indexing is not yet generated, fall back to unsorted fetch
      try {
        const qUnsorted = query(
          collection(db, path),
          where('studentId', '==', studentId)
        );
        const snap = await getDocs(qUnsorted);
        const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PremiumHistoryLog));
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return results;
      } catch (nestedErr) {
        handleFirestoreError(nestedErr, OperationType.LIST, path);
        return [];
      }
    }
  },

  /**
   * Fetch Security History for a specific student. (Mentors Only)
   */
  async getSecurityHistory(studentId: string): Promise<SecurityHistoryLog[]> {
    const path = 'security_history';
    try {
      const q = query(
        collection(db, path),
        where('studentId', '==', studentId),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SecurityHistoryLog));
    } catch (err) {
      // Fallback if index not ready
      try {
        const qUnsorted = query(
          collection(db, path),
          where('studentId', '==', studentId)
        );
        const snap = await getDocs(qUnsorted);
        const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SecurityHistoryLog));
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return results;
      } catch (nestedErr) {
        handleFirestoreError(nestedErr, OperationType.LIST, path);
        return [];
      }
    }
  },

  /**
   * Logs a mentor action in detail with all specified fields.
   */
  async logMentorAction(params: {
    studentId: string;
    studentName: string;
    mentorId: string;
    action: string;
    previousStatus: string;
    newStatus: string;
    previousExpiryDate: string;
    newExpiryDate: string;
    reason: string;
  }): Promise<void> {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0];
    const timestamp = now.toISOString();

    await addDoc(collection(db, 'premium_history'), {
      studentId: params.studentId,
      studentName: params.studentName,
      mentorId: params.mentorId,
      action: params.action,
      previousStatus: params.previousStatus || 'FREE',
      newStatus: params.newStatus,
      previousExpiryDate: params.previousExpiryDate || 'None',
      newExpiryDate: params.newExpiryDate || 'None',
      reason: params.reason || 'Manual Action',
      date,
      time,
      timestamp,
      // Backward compatibility fields
      status: params.newStatus === 'PREMIUM' ? 'active' : 'revoked',
      isPremium: params.newStatus === 'PREMIUM',
      premiumExpiryDate: params.newExpiryDate !== 'None' ? params.newExpiryDate : '',
      updatedBy: params.mentorId,
      updatedByName: 'Mentor',
      details: `${params.action}: ${params.reason || 'No reason provided'}. Status: ${params.previousStatus} -> ${params.newStatus}.`
    });
  },

  /**
   * Mentors can manually Grant/Activate Premium Access.
   */
  async mentorGrantPremium(
    studentId: string,
    studentName: string,
    days: number = 30,
    mentorId: string,
    mentorName: string,
    reason: string = 'Manual Premium Grant'
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const expiryDateString = expiryDate.toISOString().split('T')[0];

    const studentRef = doc(db, 'users', studentId);
    const studentSnap = await getDoc(studentRef);
    const previousStatus = studentSnap.exists() ? (studentSnap.data()?.premiumStatus || (studentSnap.data()?.isPremium ? 'PREMIUM' : 'FREE')) : 'FREE';
    const previousExpiry = studentSnap.exists() ? (studentSnap.data()?.premiumExpiryDate || 'None') : 'None';

    // 1. Update public student profile
    await updateDoc(studentRef, {
      isPremium: true,
      premiumStatus: 'PREMIUM',
      premiumType: 'FREE_TRIAL',
      premiumSource: 'Mentor Grant',
      premiumStartDate: timestamp.split('T')[0],
      premiumExpiryDate: expiryDateString,
      remainingPremiumDays: days,
      consecutiveMissedMissions: 0,
      consecutiveMissedDays: 0,
      updatedAt: timestamp
    });

    // 2. Log action with requested fields
    await this.logMentorAction({
      studentId,
      studentName,
      mentorId,
      action: 'Grant Premium',
      previousStatus,
      newStatus: 'PREMIUM',
      previousExpiryDate: previousExpiry,
      newExpiryDate: expiryDateString,
      reason
    });

    // 3. Add log to security_history
    await addDoc(collection(db, 'security_history'), {
      studentId,
      type: 'manual_change',
      ipAddress: 'client-app',
      deviceInfo: 'Mentor Dashboard',
      timestamp,
      details: `Premium access granted for ${days} days (Expires: ${expiryDateString}). Reason: ${reason}`
    });
  },

  /**
   * Mentors can manually Remove Premium Access.
   */
  async mentorRemovePremium(
    studentId: string,
    studentName: string,
    mentorId: string,
    mentorName: string,
    reason: string = 'Manual Premium Revocation'
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const studentRef = doc(db, 'users', studentId);
    const studentSnap = await getDoc(studentRef);
    const previousStatus = studentSnap.exists() ? (studentSnap.data()?.premiumStatus || (studentSnap.data()?.isPremium ? 'PREMIUM' : 'FREE')) : 'FREE';
    const previousExpiry = studentSnap.exists() ? (studentSnap.data()?.premiumExpiryDate || 'None') : 'None';

    // 1. Update public student profile
    await updateDoc(studentRef, {
      isPremium: false,
      premiumStatus: 'FREE',
      premiumType: '',
      premiumExpiryDate: '',
      remainingPremiumDays: 0,
      updatedAt: timestamp
    });

    // 2. Log action with requested fields
    await this.logMentorAction({
      studentId,
      studentName,
      mentorId,
      action: 'Remove Premium',
      previousStatus,
      newStatus: 'FREE',
      previousExpiryDate: previousExpiry,
      newExpiryDate: 'None',
      reason
    });

    // 3. Add log to security_history
    await addDoc(collection(db, 'security_history'), {
      studentId,
      type: 'manual_change',
      ipAddress: 'client-app',
      deviceInfo: 'Mentor Dashboard',
      timestamp,
      details: `Premium access manually removed. Reason: ${reason}`
    });
  },

  /**
   * Mentors can manually Extend Premium Access.
   */
  async mentorExtendPremium(
    studentId: string,
    studentName: string,
    daysToAdd: number,
    mentorId: string,
    mentorName: string,
    reason: string = 'Manual Premium Extension'
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const studentRef = doc(db, 'users', studentId);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) throw new Error('Student profile not found.');

    const data = studentSnap.data();
    const previousStatus = data.premiumStatus || (data.isPremium ? 'PREMIUM' : 'FREE');
    const previousExpiry = data.premiumExpiryDate || 'None';

    const currentExpiry = data.premiumExpiryDate ? new Date(data.premiumExpiryDate).getTime() : Date.now();
    const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
    const newExpiryDate = new Date(baseTime + daysToAdd * 24 * 60 * 60 * 1000);
    const newExpiryDateString = newExpiryDate.toISOString().split('T')[0];

    const diff = newExpiryDate.getTime() - Date.now();
    const remainingDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

    // 1. Update public profile
    await updateDoc(studentRef, {
      isPremium: true,
      premiumStatus: 'PREMIUM',
      premiumExpiryDate: newExpiryDateString,
      remainingPremiumDays: remainingDays,
      updatedAt: timestamp
    });

    // 2. Log action with requested fields
    await this.logMentorAction({
      studentId,
      studentName,
      mentorId,
      action: 'Extend Premium',
      previousStatus,
      newStatus: 'PREMIUM',
      previousExpiryDate: previousExpiry,
      newExpiryDate: newExpiryDateString,
      reason
    });

    // 3. Add log to security_history
    await addDoc(collection(db, 'security_history'), {
      studentId,
      type: 'manual_change',
      ipAddress: 'client-app',
      deviceInfo: 'Mentor Dashboard',
      timestamp,
      details: `Premium extended by ${daysToAdd} days (New expiry: ${newExpiryDateString}). Reason: ${reason}`
    });
  },

  /**
   * Mentors can manually Restore Premium Access.
   */
  async mentorRestorePremium(
    studentId: string,
    studentName: string,
    mentorId: string,
    mentorName: string,
    reason: string = 'Manual Premium Restoration'
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const studentRef = doc(db, 'users', studentId);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) throw new Error('Student profile not found.');

    const data = studentSnap.data();
    const previousStatus = data.premiumStatus || (data.isPremium ? 'PREMIUM' : 'FREE');
    const previousExpiry = data.premiumExpiryDate || 'None';

    // Restore standard 30 days if expired/empty, otherwise restore to previous future date
    let days = 30;
    let newExpiryDateString = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (data.premiumExpiryDate) {
      const expTime = new Date(data.premiumExpiryDate).getTime();
      if (expTime > Date.now()) {
        newExpiryDateString = data.premiumExpiryDate.split('T')[0];
        const diff = expTime - Date.now();
        days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      }
    }

    // 1. Update public profile
    await updateDoc(studentRef, {
      isPremium: true,
      premiumStatus: 'PREMIUM',
      premiumType: 'FREE_TRIAL',
      premiumSource: 'Registration Bonus',
      premiumStartDate: data.premiumStartDate || timestamp.split('T')[0],
      premiumExpiryDate: newExpiryDateString,
      remainingPremiumDays: days,
      consecutiveMissedMissions: 0,
      consecutiveMissedDays: 0,
      updatedAt: timestamp
    });

    // 2. Log action with requested fields
    await this.logMentorAction({
      studentId,
      studentName,
      mentorId,
      action: 'Restore Premium',
      previousStatus,
      newStatus: 'PREMIUM',
      previousExpiryDate: previousExpiry,
      newExpiryDate: newExpiryDateString,
      reason
    });

    // 3. Add log to security_history
    await addDoc(collection(db, 'security_history'), {
      studentId,
      type: 'manual_change',
      ipAddress: 'client-app',
      deviceInfo: 'Mentor Dashboard',
      timestamp,
      details: `Premium access manually restored with ${days} days remaining (Expires: ${newExpiryDateString}). Reason: ${reason}`
    });
  },

  /**
   * Mentors can convert Premium -> Free.
   */
  async mentorConvertPremiumToFree(
    studentId: string,
    studentName: string,
    mentorId: string,
    mentorName: string,
    reason: string = 'Convert Premium to Free'
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const studentRef = doc(db, 'users', studentId);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) throw new Error('Student profile not found.');

    const data = studentSnap.data();
    const previousStatus = data.premiumStatus || (data.isPremium ? 'PREMIUM' : 'FREE');
    const previousExpiry = data.premiumExpiryDate || 'None';

    // 1. Update public profile
    await updateDoc(studentRef, {
      isPremium: false,
      premiumStatus: 'FREE',
      premiumType: '',
      premiumExpiryDate: '',
      remainingPremiumDays: 0,
      updatedAt: timestamp
    });

    // 2. Log action with requested fields
    await this.logMentorAction({
      studentId,
      studentName,
      mentorId,
      action: 'Convert Premium -> Free',
      previousStatus,
      newStatus: 'FREE',
      previousExpiryDate: previousExpiry,
      newExpiryDate: 'None',
      reason
    });

    // 3. Add log to security_history
    await addDoc(collection(db, 'security_history'), {
      studentId,
      type: 'manual_change',
      ipAddress: 'client-app',
      deviceInfo: 'Mentor Dashboard',
      timestamp,
      details: `Premium converted to Free access. Reason: ${reason}`
    });
  },

  /**
   * Mentors can convert Free -> Premium.
   */
  async mentorConvertFreeToPremium(
    studentId: string,
    studentName: string,
    mentorId: string,
    mentorName: string,
    reason: string = 'Convert Free to Premium'
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const studentRef = doc(db, 'users', studentId);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) throw new Error('Student profile not found.');

    const data = studentSnap.data();
    const previousStatus = data.premiumStatus || (data.isPremium ? 'PREMIUM' : 'FREE');
    const previousExpiry = data.premiumExpiryDate || 'None';

    const days = 30;
    const expiryDateString = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 1. Update public profile
    await updateDoc(studentRef, {
      isPremium: true,
      premiumStatus: 'PREMIUM',
      premiumType: 'FREE_TRIAL',
      premiumSource: 'Mentor Upgrade',
      premiumStartDate: timestamp.split('T')[0],
      premiumExpiryDate: expiryDateString,
      remainingPremiumDays: days,
      consecutiveMissedMissions: 0,
      consecutiveMissedDays: 0,
      updatedAt: timestamp
    });

    // 2. Log action with requested fields
    await this.logMentorAction({
      studentId,
      studentName,
      mentorId,
      action: 'Convert Free -> Premium',
      previousStatus,
      newStatus: 'PREMIUM',
      previousExpiryDate: previousExpiry,
      newExpiryDate: expiryDateString,
      reason
    });

    // 3. Add log to security_history
    await addDoc(collection(db, 'security_history'), {
      studentId,
      type: 'manual_change',
      ipAddress: 'client-app',
      deviceInfo: 'Mentor Dashboard',
      timestamp,
      details: `Free converted to Premium access for ${days} days (Expires: ${expiryDateString}). Reason: ${reason}`
    });
  },

  /**
   * Mentors can manually enable/disable automatic premium checks override.
   */
  async mentorToggleOverride(
    studentId: string,
    manualOverride: boolean,
    mentorId: string,
    mentorName: string
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const publicPath = `users/${studentId}`;

    try {
      const studentRef = doc(db, 'users', studentId);
      await updateDoc(studentRef, {
        manualPremiumOverride: manualOverride,
        updatedAt: timestamp
      });

      // 2. Add log to premium_history
      await addDoc(collection(db, 'premium_history'), {
        studentId,
        status: manualOverride ? 'active' : 'revoked', // Log reference
        isPremium: true,
        action: manualOverride ? 'override_enabled' : 'override_disabled',
        updatedBy: mentorId,
        updatedByName: mentorName,
        timestamp,
        details: manualOverride 
          ? `Automatic premium management disabled (Manual Override enabled) by Mentor ${mentorName}.`
          : `Automatic premium management enabled (Manual Override disabled) by Mentor ${mentorName}.`
      });

      // 3. Add log to security_history
      await addDoc(collection(db, 'security_history'), {
        studentId,
        type: 'manual_change',
        ipAddress: 'client-app',
        deviceInfo: 'Mentor Dashboard',
        timestamp,
        details: manualOverride 
          ? `Automatic 10-day compliance checks disabled by Mentor ${mentorName}.`
          : `Automatic 10-day compliance checks enabled by Mentor ${mentorName}.`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, publicPath);
    }
  },

  /**
   * Reset consecutive missed days count for a student.
   */
  async mentorResetMissedDays(
    studentId: string,
    studentName: string,
    mentorId: string,
    mentorName: string,
    reason: string = 'Manual Reset of Missed Days'
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const studentRef = doc(db, 'users', studentId);
    
    try {
      const studentSnap = await getDoc(studentRef);
      const data = studentSnap.exists() ? studentSnap.data() : {};
      
      const updates: any = {
        consecutiveMissedMissions: 0,
        consecutiveMissedDays: 0,
        updatedAt: timestamp
      };

      const isCurrentlyPremium = !!data.isPremium || data.premiumStatus === 'active' || data.premiumStatus === 'PREMIUM';
      if (!isCurrentlyPremium) {
        const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        updates.isPremium = true;
        updates.premiumStatus = 'PREMIUM';
        updates.premiumType = 'FREE_TRIAL';
        updates.premiumSource = 'Registration Bonus';
        updates.premiumStartDate = data.premiumStartDate || timestamp.split('T')[0];
        updates.premiumExpiryDate = data.premiumExpiryDate || defaultExpiry;
        updates.remainingPremiumDays = data.remainingPremiumDays || 30;
      }

      // 1. Update public profile
      await updateDoc(studentRef, updates);

      // 2. Log action in premium_history
      await addDoc(collection(db, 'premium_history'), {
        studentId,
        status: 'active',
        isPremium: true,
        action: 'Reset Missed Days',
        updatedBy: mentorId,
        updatedByName: mentorName,
        timestamp,
        details: `${reason} by Mentor ${mentorName}.`
      });

      // 3. Add log to security_history
      await addDoc(collection(db, 'security_history'), {
        studentId,
        type: 'manual_change',
        ipAddress: 'client-app',
        deviceInfo: 'Mentor Dashboard',
        timestamp,
        details: `${reason} by Mentor ${mentorName}.`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${studentId}`);
    }
  }
};
