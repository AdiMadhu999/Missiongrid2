import { User } from '../models/user';
import { doc, getDoc, query, collection, where, getDocs, setDoc, deleteDoc, updateDoc, addDoc, limit } from 'firebase/firestore';
import { db, auth } from './firebase';
import { signInWithPhoneNumber, signInAnonymously, signInWithCustomToken, ConfirmationResult, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStudentCode } from '../utils/privacy';
import { verifyPin, hashPin } from '../utils/security';
import { isNativeAndroid } from '../utils/platform';
import { createUserProfile } from './users';
import { PremiumService } from './premium';
import bcrypt from 'bcryptjs';
import { OperationType } from './premium';
import { apiFetch } from '../utils/api';

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


let confirmationResult: ConfirmationResult | null = null;

const logSecurityEvent = async (studentId: string, type: 'login' | 'active_check' | 'registration' | 'manual_change', ip: string, deviceInfo: string, details: string) => {
  try {
    addDoc(collection(db, 'security_history'), {
      studentId,
      type,
      ipAddress: ip,
      deviceInfo,
      timestamp: new Date().toISOString(),
      details
    });
  } catch (e: any) {
    const isAlreadyExists = e && (
      e.code === 'already-exists' || 
      (e.message && (
        e.message.includes('already-exists') || 
        e.message.includes('already exists') ||
        e.message.includes('Document already exists')
      ))
    );
    if (isAlreadyExists) {
      console.log('[AuthService] Security event log already exists (synced from cache).');
    } else {
      console.error('Failed to log security event', e);
    }
  }
};

const updateDeviceAudit = async (userId: string, mobile: string) => {
  try {
    const { success, ipAddress, userAgent } = await PremiumService.trackLoginOnBackend();
    if (success) {
      const userPrivRef = doc(db, 'users_private', userId);
      const userPrivSnap = await getDoc(userPrivRef);
      if (userPrivSnap.exists()) {
        const data = userPrivSnap.data();
        const oldIP = data.currentIP || 'unknown';
        const oldDevice = data.deviceInfo || 'unknown';
        
        const updates: any = {
          lastLoginIP: oldIP,
          currentIP: ipAddress,
          deviceInfo: userAgent,
          lastLoginDateTime: new Date().toISOString(),
          lastActiveDate: new Date().toISOString(),
          loginCount: (data.loginCount || 0) + 1
        };
        
        await updateDoc(userPrivRef, updates);
        
        if (oldIP !== ipAddress || oldDevice !== userAgent) {
          logSecurityEvent(userId, 'login', ipAddress, userAgent, `Login from new IP/Device: IP: ${ipAddress}, Device: ${userAgent}`);
        }
      }
    }
  } catch (error) {
    console.warn("[AuthService] Non-fatal: Failed to update device audit info in users_private:", error);
  }
};

const logOtpAttempt =  (mobile: string, status: string, message: string, uid?: string) => {
  try {
    addDoc(collection(db, 'otp_logs'), {
      mobile,
      timestamp: new Date().toISOString(),
      status,
      message,
      uid: uid || null
    });
  } catch (e: any) {
    const isAlreadyExists = e && (
      e.code === 'already-exists' || 
      (e.message && (
        e.message.includes('already-exists') || 
        e.message.includes('already exists') ||
        e.message.includes('Document already exists')
      ))
    );
    if (isAlreadyExists) {
      console.log('[AuthService] OTP attempt log already exists (synced from cache).');
    } else {
      console.error('Failed to log OTP attempt', e);
    }
  }
};

/**
 * Auth Service Structure
 * Handles secure privacy-compliant login, logout, password reset, and user session state.
 */
export const AuthService = {

  magicLogin: async (mobile: string): Promise<any> => {
    const sanitized = (mobile || '').replace(/\D/g, '');
    const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
    const sanitizedMobile = tenDigits;
    try {
      const response = await apiFetch('/api/auth/magic-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: sanitizedMobile })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.customToken) {
        await setPersistence(auth, browserLocalPersistence);
        const userCredential = await signInWithCustomToken(auth, data.customToken);
        
        let sessionClaims = {};
        try {
           const idTokenResult = await userCredential.user.getIdTokenResult(true);
           sessionClaims = idTokenResult.claims;
        } catch(e) {
           console.warn('Failed to fetch claims after magic login:', e);
        }
        
        return {
          ...data.user,
          ...sessionClaims,
          sessionUid: userCredential.user.uid,
          sessionEmail: userCredential.user.email,
        };
      } else {
        throw new Error('Authentication failed: No token received.');
      }
    } catch (error: any) {
      console.error('Magic login error:', error);
      throw error;
    }
  },

  loginWithMobileAndPassword: async (mobile: string, password: string, role: 'student' | 'mentor' | 'examiner', verificationMethod?: 'sms' | 'pin'): Promise<any> => {
    const sanitized = (mobile || '').replace(/\D/g, '');
    const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
    const sanitizedMobile = tenDigits;

    try {
      const deviceId = localStorage.getItem('missiongrid_device_id') || 'unknown';
      const deviceType = isNativeAndroid() ? 'android' : 'desktop';
      const loginPayload = { mobile: sanitizedMobile, pin: password, role, verificationMethod, deviceId, deviceType };
      console.log('[DEBUG-AUTH] Initiating login request');
      console.log('[DEBUG-AUTH] URL: /api/auth/login');
      console.log('[DEBUG-AUTH] Method: POST');
      console.log('[DEBUG-AUTH] Payload:', JSON.stringify(loginPayload));

      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginPayload)
      });
      
      console.log('[DEBUG-AUTH] Request completed');
      console.log('[DEBUG-AUTH] Status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMsg = "Authentication failed.";
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
          console.log('[DEBUG-AUTH] Error response body:', JSON.stringify(errData));
        } catch(e) {
          errorMsg = await response.text();
          console.log('[DEBUG-AUTH] Error response text:', errorMsg);
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log('[DEBUG-AUTH] Success response:', JSON.stringify(data));
      
      // For student or if mentor doesn't need secondary verification, sign in immediately.
      // For mentors requiring OTP/PIN, we wait until the second step to sign them in so we don't bypass 2FA UI.
      if (role !== 'mentor' || verificationMethod === 'pin') {
        await signInWithCustomToken(auth, data.customToken);
        if (role === 'mentor') {
            data.user.mentorDirectLogin = true;
        }
      }
      
      return { ...data.user, customToken: data.customToken };
    } catch (err: any) {
      console.error("Login Error:", err.message || err);
      throw err;
    }
  },

  registerWithMobileAndPassword: async (mobile: string, password: string, name: string, batchId?: string, photoUrl?: string): Promise<any> => {
    try {
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }
        const uid = auth.currentUser!.uid;
        const sanitized = mobile.replace(/\D/g, '');
        const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
        const sanitizedMobile = tenDigits;

        const privateRef = collection(db, 'users_private');
        let privateSnap = await getDoc(doc(db, 'users_private', sanitizedMobile));
        if (!privateSnap.exists()) {
            let oldSnap = await getDocs(query(privateRef, where('mobile', '==', sanitizedMobile), limit(1)));
            if (oldSnap.empty && sanitized.length > 10) {
                oldSnap = await getDocs(query(privateRef, where('mobile', '==', sanitized), limit(1)));
            }
            if (!oldSnap.empty) {
                privateSnap = oldSnap.docs[0] as any;
            }
        }

        if (privateSnap.exists()) {
            const existingPrivateData = privateSnap.data();
            const isPinValid = verifyPin(password, existingPrivateData?.pin || '');
            if (isPinValid) {
                console.log(`[Idempotent Registration] Mobile ${sanitizedMobile} already exists and PIN matches. Returning existing profile.`);
                const publicSnap = await getDoc(doc(db, 'users', privateSnap.id));
                return {
                    ...publicSnap.data(),
                    ...existingPrivateData,
                    id: privateSnap.id,
                    uid: existingPrivateData?.uid || uid
                };
            }
            throw new Error("An account already exists with this mobile number.");
        }

        const newUser = await createUserProfile({
            mobile: sanitizedMobile,
            uid: uid,
            role: 'student',
            name: name || 'Student',
            pin: password,
            status: 'active',
            batchId: batchId || 'Aspirants',
            photoUrl: photoUrl || ''
        });

        const userId = newUser.id;
        const publicSnap = await getDoc(doc(db, 'users', userId));
        const privateSnapUpdated = await getDoc(doc(db, 'users_private', userId));

        await updateDeviceAudit(userId, sanitizedMobile);

        return {
            ...publicSnap.data(),
            ...privateSnapUpdated.data(),
            id: userId,
            uid: uid
        };
    } catch (err: any) {
        if (err.message !== "An account already exists with this mobile number.") {
            console.error("Direct registration failed:", err);
        } else {
            console.warn("Direct registration attempt for existing mobile number:", err.message);
        }
        throw err;
    }
  },
  
  checkMobileExists: async (mobile: string): Promise<boolean> => {
    try {
      const response = await apiFetch('/api/auth/check-mobile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mobile })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      return !!data.exists;
    } catch (err) {
      console.error("Error checking mobile existence via backend:", err);
      // Fallback if backend is not available or errors out
      try {
        const sanitized = mobile.replace(/\D/g, '');
        const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
        const sanitizedMobile = tenDigits;
        
        let privateSnap = await getDoc(doc(db, 'users_private', sanitizedMobile));
        if (!privateSnap.exists()) {
            const privateRef = collection(db, 'users_private');
            let oldSnap = await getDocs(query(privateRef, where('mobile', '==', sanitizedMobile), limit(1)));
            if (oldSnap.empty && sanitized.length > 10) {
                oldSnap = await getDocs(query(privateRef, where('mobile', '==', sanitized), limit(1)));
            }
            if (!oldSnap.empty) {
                privateSnap = oldSnap.docs[0] as any;
            }
        }
        return privateSnap.exists();
      } catch (fallbackErr) {
        return false;
      }
    }
  },

  logout: async (): Promise<void> => {
    if (auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        await apiFetch('/api/premium/track-logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          }
        });
      } catch (trackErr) {
        console.error("Failed to track logout on backend:", trackErr);
      }
      await auth.signOut();
    }
  },

  getCurrentUser: () => {
    return auth.currentUser;
  },

  resetPassword: async (mobile: string, newPassword: string): Promise<void> => {
    const pinHash = hashPin(newPassword);
    
    // Attempt secure server-side reset first if the user is authenticated
    if (auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        const response = await apiFetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ mobile, pinHash })
        });
        
        if (response.ok) {
          return; // Successfully reset on the server!
        }
        console.warn("Backend reset-password failed, trying client fallback:", await response.text());
      } catch (err) {
        console.error("Failed to reset password on backend:", err);
      }
    }
    
    // Fallback if not authenticated or backend call failed (unlikely, but safe)
    const sanitized = mobile.replace(/\D/g, '');
    const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
    const sanitizedMobile = tenDigits;
    
    let privateSnap = await getDoc(doc(db, 'users_private', sanitizedMobile));
    if (!privateSnap.exists()) {
      const privateRef = collection(db, 'users_private');
      let oldSnap = await getDocs(query(privateRef, where('mobile', '==', sanitizedMobile), limit(1)));
      if (oldSnap.empty && sanitized.length > 10) {
        oldSnap = await getDocs(query(privateRef, where('mobile', '==', sanitized), limit(1)));
      }
      if (!oldSnap.empty) {
        privateSnap = oldSnap.docs[0] as any;
      }
    }
    
    if (!privateSnap.exists()) {
        throw new Error("User not found.");
    }
    
    const userId = privateSnap.id;
    
    await updateDoc(doc(db, 'users_private', userId), {
        pin: pinHash
    });
  }
};
