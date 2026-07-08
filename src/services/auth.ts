import { User } from '../models/user';
import { doc, getDoc, query, collection, where, getDocs, setDoc, deleteDoc, updateDoc, addDoc, limit } from 'firebase/firestore';
import { db, auth } from './firebase';
import { signInWithPhoneNumber, signInAnonymously, signInWithCustomToken, ConfirmationResult } from 'firebase/auth';
import { getStudentCode } from '../utils/privacy';
import { verifyPin, hashPin } from '../utils/security';
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
    await addDoc(collection(db, 'security_history'), {
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
          await logSecurityEvent(userId, 'login', ipAddress, userAgent, `Login from new IP/Device: IP: ${ipAddress}, Device: ${userAgent}`);
        }
      }
    }
  } catch (error) {
    console.warn("[AuthService] Non-fatal: Failed to update device audit info in users_private:", error);
  }
};

const logOtpAttempt = async (mobile: string, status: string, message: string, uid?: string) => {
  try {
    await addDoc(collection(db, 'otp_logs'), {
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
  loginWithMobileAndPassword: async (mobile: string, password: string, role: 'student' | 'mentor' | 'examiner', verificationMethod?: 'sms' | 'pin'): Promise<any> => {
    const sanitized = (mobile || '').replace(/\D/g, '');
    const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
    const sanitizedMobile = tenDigits;

    try {
      const loginPayload = { mobile: sanitizedMobile, pin: password, role, verificationMethod };
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
      if (role !== 'mentor' && role !== 'examiner') {
        await signInWithCustomToken(auth, data.customToken);
      }
      
      return { ...data.user, customToken: data.customToken };
    } catch (err: any) {
      console.error("Login Error:", err);
      throw err;
    }
  },

  verifyMentorSecurityPin: async (mobile: string, securityPin: string, tempUser?: any): Promise<any> => {
    console.log('[DEBUG-AUTH] Initiating verifyMentorSecurityPin');
    if (tempUser && tempUser.customToken) {
      console.log('[DEBUG-AUTH] tempUser found, calling signInWithCustomToken');
      try {
          await signInWithCustomToken(auth, tempUser.customToken);
          console.log('[DEBUG-AUTH] signInWithCustomToken successful');
          return tempUser;
      } catch (e) {
          console.error('[DEBUG-AUTH] signInWithCustomToken failed', e);
          throw e;
      }
    }
    console.error('[DEBUG-AUTH] Missing tempUser session');
    throw new Error("Missing temporary user session. Please restart login.");
  },
  
  sendOtp: async (mobile: string, recaptchaVerifier: any): Promise<void> => {
    try {
        const sanitized = mobile.replace(/\D/g, '');
        const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
        const formattedMobile = `+91${tenDigits}`;
        confirmationResult = await signInWithPhoneNumber(auth, formattedMobile, recaptchaVerifier);
        await logOtpAttempt(formattedMobile, 'success', 'OTP sent');
    } catch (err: any) {
        const sanitized = mobile.replace(/\D/g, '');
        const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
        const formattedMobile = `+91${tenDigits}`;
        await logOtpAttempt(formattedMobile, 'failed', err.message);
        throw err;
    }
  },
  
  verifyOnlyOtp: async (otp: string, tempUser?: any): Promise<string> => {
    try {
        if (!confirmationResult) {
            throw new Error('OTP not sent or expired');
        }
        const userCredential = await confirmationResult.confirm(otp);
        await logOtpAttempt(userCredential.user.phoneNumber || 'unknown', 'success', 'OTP verified');
        
        // Re-authenticate with custom token to get custom claims (overriding the basic phone auth session)
        if (tempUser && tempUser.customToken) {
            await signInWithCustomToken(auth, tempUser.customToken);
        }
        
        return userCredential.user.phoneNumber || '';
    } catch (err: any) {
        await logOtpAttempt('unknown', 'failed', err.message);
        throw err;
    }
  },
  
  verifyOtp: async (otp: string, mobile: string): Promise<{ user: User, isNew: boolean }> => {
    try {
        if (!confirmationResult) {
            throw new Error('OTP not sent or expired');
        }
        const userCredential = await confirmationResult.confirm(otp);
        await logOtpAttempt(mobile, 'success', 'OTP verified');
        const uid = userCredential.user.uid;
        
        // Force token refresh and wait briefly to ensure Firestore client picks up the new phone auth token
        // instead of using the old anonymous token which causes permission denied errors.
        await new Promise<void>((resolve) => {
            const unsubscribe = auth.onIdTokenChanged(async (user) => {
                if (user && user.uid === uid) {
                    unsubscribe();
                    await user.getIdToken(true);
                    setTimeout(resolve, 1000); // Give Firestore client time to reconnect
                }
            });
            // Fallback timeout in case it already fired synchronously
            setTimeout(() => {
                unsubscribe();
                resolve();
            }, 3000);
        });

        const sanitized = mobile.replace(/\D/g, '');
        const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
        const sanitizedMobile = tenDigits;
        let userId = '';
        let isNew = false;
    
        // Query private collection to find the user
        const privateRef = collection(db, 'users_private');
        let privateSnap;
        try {
            privateSnap = await getDocs(query(privateRef, where('mobile', '==', sanitizedMobile), limit(1)));
            if (privateSnap.empty && sanitized.length > 10) {
                privateSnap = await getDocs(query(privateRef, where('mobile', '==', sanitized), limit(1)));
            }
        } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'users_private');
        }
        
        if (privateSnap.empty) {
            // Create new user profile for new registration
            isNew = true;
            const newUser = await createUserProfile({
                mobile: sanitizedMobile,
                uid: uid,
                role: 'student',
                name: 'Student',
                status: 'active'
            });
            // Now get the new userId
            userId = newUser.id;
        } else {
            const pDoc = privateSnap.docs[0];
            userId = pDoc.id;
            // Link UID if it was missing or different
            try {
                await updateDoc(doc(db, 'users_private', userId), { uid: uid });
            } catch (error) {
                handleFirestoreError(error, OperationType.UPDATE, `users_private/${userId}`);
            }
        }
        
        // Fetch user profile to return
        let publicSnap;
        try {
            publicSnap = await getDoc(doc(db, 'users', userId));
        } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users/${userId}`);
        }

        if (!publicSnap.exists()) {
            throw new Error("User profile not found.");
        }
        const publicData = publicSnap.data();

        let privateSnapUpdated;
        try {
            privateSnapUpdated = await getDoc(doc(db, 'users_private', userId));
        } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users_private/${userId}`);
        }
        const privateData = privateSnapUpdated.data();
        
        await updateDeviceAudit(userId, sanitizedMobile);
        return {
            user: {
                ...publicData,
                ...privateData,
                id: userId,
                uid: uid
            } as User,
            isNew
        };
    } catch (err: any) {
        await logOtpAttempt(mobile, 'failed', err.message);
        throw err;
    }
  },

  registerWithMobileAndPassword: async (mobile: string, password: string, name: string): Promise<any> => {
    try {
        if (!auth.currentUser) {
            await signInAnonymously(auth);
        }
        const uid = auth.currentUser!.uid;
        const sanitized = mobile.replace(/\D/g, '');
        const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
        const sanitizedMobile = tenDigits;

        const privateRef = collection(db, 'users_private');
        let privateSnap = await getDocs(query(privateRef, where('mobile', '==', sanitizedMobile), limit(1)));
        if (!privateSnap.empty) {
            throw new Error("An account already exists with this mobile number.");
        }

        const newUser = await createUserProfile({
            mobile: sanitizedMobile,
            uid: uid,
            role: 'student',
            name: name || 'Student',
            pin: password,
            status: 'active'
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
        console.error("Direct registration failed:", err);
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
        const privateRef = collection(db, 'users_private');
        let privateSnap = await getDocs(query(privateRef, where('mobile', '==', sanitizedMobile), limit(1)));
        if (privateSnap.empty && sanitized.length > 10) {
          privateSnap = await getDocs(query(privateRef, where('mobile', '==', sanitized), limit(1)));
        }
        return !privateSnap.empty;
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
    const privateRef = collection(db, 'users_private');
    let privateSnap = await getDocs(query(privateRef, where('mobile', '==', sanitizedMobile), limit(1)));
    if (privateSnap.empty && sanitized.length > 10) {
      privateSnap = await getDocs(query(privateRef, where('mobile', '==', sanitized), limit(1)));
    }
    
    if (privateSnap.empty) {
        throw new Error("User not found.");
    }
    
    const pDoc = privateSnap.docs[0];
    const userId = pDoc.id;
    
    await updateDoc(doc(db, 'users_private', userId), {
        pin: pinHash
    });
  }
};
