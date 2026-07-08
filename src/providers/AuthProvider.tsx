import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut, signInAnonymously } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, setDoc, deleteDoc, getDoc, limit } from 'firebase/firestore';
import { User } from '../models/user';
import { getStudentCode } from '../utils/privacy';
import { safeStorage } from '../lib/storage';
import { apiFetch } from '../utils/api';
import { debugLogger } from '../utils/debugLogger';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  setUserProfile: (profile: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  logout: async () => {},
  setUserProfile: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const lastSyncedRoleRef = useRef<string | null>(null);
  const uidSyncAttemptedRef = useRef<boolean>(false);
  const claimsSyncAttemptedRef = useRef<Record<string, boolean>>({});
  const userProfileRef = useRef<User | null>(null);

  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  // Clear all sensitive user caches upon logout
  const logout = async () => {
    try {
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
        await signOut(auth);
      }
    } catch (e) {
      console.error("Sign out error", e);
    }
    setCurrentUser(null);
    handleSetUserProfile(null);
    uidSyncAttemptedRef.current = false;
    claimsSyncAttemptedRef.current = {};

    // Clear sensitive cached data
    const keysToRemove: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('bookmarks_') || key.startsWith('recents_') || key === 'user_profile')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        safeStorage.removeItem(key);
      });
    } catch (e) {
      console.warn("Storage cleanup failed:", e);
      try {
        safeStorage.removeItem('user_profile');
      } catch {}
    }
  };

  const handleSetUserProfile = React.useCallback((profile: User | null) => {
    const current = userProfileRef.current;
    if (current?.id === profile?.id && current?.updatedAt === profile?.updatedAt) {
      return;
    }
    userProfileRef.current = profile;
    setUserProfile(profile);
    if (profile) {
      safeStorage.setItem('user_profile', JSON.stringify(profile));
    } else {
      safeStorage.removeItem('user_profile');
    }
  }, []);

  useEffect(() => {
    console.log("DEBUG: AuthProvider initialized and setting up listeners");
    
    // Step 1: Pre-load the user profile from local storage immediately to eliminate route rendering gaps
    const savedProfile = safeStorage.getItem('user_profile');
    if (savedProfile) {
      try {
        setUserProfile(JSON.parse(savedProfile));
        setLoading(false); // Enable immediate UI rendering for returning users
      } catch (e) {
        console.error("Failed to parse saved profile", e);
        safeStorage.removeItem('user_profile');
      }
    }

    let unsubProfile: (() => void) | null = null;
    let unsubPublicDoc: (() => void) | null = null;
    let initialTimer: NodeJS.Timeout | null = null;

    // Step 2: Establish connection listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log("DEBUG: AuthProvider onAuthStateChanged triggered", { user });
      
      if (initialTimer) {
        clearTimeout(initialTimer);
        initialTimer = null;
      }

      if (user) {
        setCurrentUser(user);
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        if (unsubPublicDoc) {
          unsubPublicDoc();
          unsubPublicDoc = null;
        }

        // Establish real-time tracking of the user's private credentials
        let savedUserId = '';
        let cachedProfileData: any = null;
        try {
          const cached = safeStorage.getItem('user_profile');
          if (cached) {
            cachedProfileData = JSON.parse(cached);
            if (cachedProfileData && cachedProfileData.id) {
              savedUserId = cachedProfileData.id;
            }
          }
        } catch (e) {
          console.warn("DEBUG: Failed to check cached user profile during auth state change:", e);
        }
        console.log("DEBUG: AuthProvider savedUserId:", savedUserId);

        // Fetch custom claims from Firebase Auth ID Token
        let tokenResult = await user.getIdTokenResult();
        let claims = tokenResult.claims;

        // Force-sync if claims are missing or incomplete (for new register or migrated users)
        const syncKey = user.uid;
        if (user && !user.isAnonymous && (!claims.role || (claims.role === 'student' && !claims.batchId && claims.permissionLevel === undefined))) {
          if (!claimsSyncAttemptedRef.current[syncKey]) {
            claimsSyncAttemptedRef.current[syncKey] = true;
            console.log("[AuthProvider] Custom claims missing or incomplete. Refreshing token...");
            try {
              tokenResult = await user.getIdTokenResult(true);
              claims = tokenResult.claims;
            } catch (err) {
              console.warn("[AuthProvider] Token refresh error:", err);
            }

            if (!claims.role) {
              console.log("[AuthProvider] Claims still missing after refresh. Syncing with backend...");
              try {
                const idToken = await user.getIdToken();
                const response = await apiFetch('/api/auth/sync-claims', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                  }
                });
                if (response.ok) {
                  console.log("[AuthProvider] Claims successfully synced on backend. Force refreshing token...");
                  tokenResult = await user.getIdTokenResult(true);
                  claims = tokenResult.claims;
                }
              } catch (err) {
                console.error("[AuthProvider] Backend claims sync error:", err);
              }
            }
          } else {
            console.log("[AuthProvider] Custom claims sync check already run for user during session. Skipping refresh to prevent loops.");
          }
        }

        console.log("[AuthProvider] Custom claims resolved:", claims);

        // Use cache-first loading by merging JWT Claims with local cached profile, completely skipping Firestore reads
        if (cachedProfileData && cachedProfileData.id && (claims.role || user.isAnonymous)) {
          const combined = {
            ...cachedProfileData,
            role: (claims.role as string) || cachedProfileData.role || 'student',
            batchId: (claims.batchId as string) || cachedProfileData.batchId || '',
            status: (claims.accountStatus as string) || cachedProfileData.status || 'active',
            premiumStatus: (claims.premiumStatus as string) || cachedProfileData.premiumStatus || 'FREE',
            isPremium: claims.premiumStatus === 'PREMIUM',
            uid: user.uid,
          };
          handleSetUserProfile(combined);
          console.log("[AuthProvider] Loaded profile instantly from Cache + JWT Custom Claims. Reads avoided: true!");
          setLoading(false);
          
          // Background sync to ensure claims and UID mappings are kept in perfect order
          if (!user.isAnonymous && (!claims.role || !claims.batchId) && !uidSyncAttemptedRef.current) {
            uidSyncAttemptedRef.current = true;
            user.getIdToken().then(idToken => {
              apiFetch('/api/auth/sync-claims', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${idToken}`
                }
              }).catch(err => console.warn("[AuthProvider] Background sync claims error:", err));
            });
          }
          return;
        }

        let firstSnapReceived = false;
        const profileFetchTimeout = setTimeout(() => {
          if (!firstSnapReceived) {
            console.log("DEBUG: Profile sync timeout reached (possibly offline). Restoring local session.");
            firstSnapReceived = true;
            setLoading(false);
          }
        }, 5000); // Increased from 1200

        const handleCombinedProfile = (pubData: any, privData: any, userId: string) => {
          const combinedProfile = {
            ...pubData,
            ...privData,
            id: userId,
            uid: (user.isAnonymous && (privData?.uid || pubData?.uid)) ? (privData.uid || pubData.uid) : (user.uid || privData?.uid || userId),
          } as User;

          // Ensure studentCode is ready
          if (!combinedProfile.studentCode) {
            combinedProfile.studentCode = getStudentCode(combinedProfile);
          }

          // Centralized Automatic Premium Validation Engine
          const now = new Date();
          const todayISTStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now); // 'YYYY-MM-DD'
          
          let expiryStr = combinedProfile.premiumExpiryDate || '';
          let isPremium = !!combinedProfile.isPremium;
          let premiumStatus = combinedProfile.premiumStatus || (isPremium ? 'PREMIUM' : 'FREE');

          // Force 30-day limit for all premium users based on start date
          if (isPremium && combinedProfile.premiumStartDate) {
            const startDateStr = combinedProfile.premiumStartDate;
            const startDate = new Date(startDateStr);
            // Cap at 30 days
            const expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
            expiryStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(expiryDate);
          }
          
          // If user is set to premium but has no expiry date, assign 30 days from today
          if (isPremium && !expiryStr) {
            const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            expiryStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(expiryDate);
          }

          let calculatedIsPremium = isPremium;
          let calculatedPremiumStatus = premiumStatus;
          let calculatedRemainingDays = combinedProfile.remainingPremiumDays !== undefined ? combinedProfile.remainingPremiumDays : 0;

          if (expiryStr) {
            // Rule 1: If Current Date <= Premium Expiry Date, Premium Status = PREMIUM
            // Rule 2: If Current Date > Premium Expiry Date, Premium Status = FREE
            const isExpiryISO = expiryStr.includes('T');
            const cleanExpiryStr = isExpiryISO ? expiryStr.split('T')[0] : expiryStr;

            const active = todayISTStr <= cleanExpiryStr;
            calculatedIsPremium = active;
            calculatedPremiumStatus = active 
              ? (['PREMIUM', 'active'].includes(premiumStatus) ? premiumStatus : 'PREMIUM') 
              : 'FREE';

            if (active) {
              const todayMidnight = new Date(todayISTStr + 'T00:00:00Z');
              const expiryMidnight = new Date(cleanExpiryStr + 'T00:00:00Z');
              const diffTime = expiryMidnight.getTime() - todayMidnight.getTime();
              calculatedRemainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            } else {
              calculatedRemainingDays = 0;
            }
          } else {
            calculatedIsPremium = false;
            calculatedPremiumStatus = 'FREE';
            calculatedRemainingDays = 0;
          }

          const needsDbUpdate = 
            combinedProfile.isPremium !== calculatedIsPremium ||
            combinedProfile.premiumStatus !== calculatedPremiumStatus ||
            combinedProfile.remainingPremiumDays !== calculatedRemainingDays ||
            (expiryStr && combinedProfile.premiumExpiryDate !== expiryStr);

          if (needsDbUpdate) {
            const updateObj: any = {
              isPremium: calculatedIsPremium,
              premiumStatus: calculatedPremiumStatus,
              remainingPremiumDays: calculatedRemainingDays,
              testAccess: calculatedIsPremium ? 'premium' : 'free',
              updatedAt: now.toISOString()
            };

            // If automatically expiring, ensure it has premiumType = 'EXPIRED' to comply with rule option B
            if (!calculatedIsPremium) {
              updateObj.premiumType = 'EXPIRED';
            }

            // ONLY update if fields other than updatedAt actually changed.
            // This prevents infinite loops caused by onSnapshot triggering on update.
            const hasEssentialChanges = 
              combinedProfile.isPremium !== calculatedIsPremium ||
              combinedProfile.premiumStatus !== calculatedPremiumStatus ||
              combinedProfile.remainingPremiumDays !== calculatedRemainingDays ||
              combinedProfile.testAccess !== (calculatedIsPremium ? 'premium' : 'free') ||
              (combinedProfile.premiumType !== 'EXPIRED' && !calculatedIsPremium);

            if (hasEssentialChanges && !user.isAnonymous) {
              console.log(`[Premium Validation Engine] Auto-syncing status for ${userId}:`, updateObj);
              updateDoc(doc(db, 'users', userId), updateObj)
                .catch(e => {
                    console.error("[Premium Validation Engine] FAILED to update premium info in Firestore for " + userId + ":", e);
                    debugLogger.add('ERROR', '[Premium Validation Engine] FAILED update', { userId, error: e });
                });
            }
          }

          combinedProfile.isPremium = calculatedIsPremium;
          combinedProfile.premiumStatus = calculatedPremiumStatus;
          combinedProfile.remainingPremiumDays = calculatedRemainingDays;
          if (expiryStr) combinedProfile.premiumExpiryDate = expiryStr;
          combinedProfile.testAccess = calculatedIsPremium ? 'premium' : 'free';
          if (!calculatedIsPremium) combinedProfile.premiumType = 'EXPIRED';

          const isCurrentAnonymous = user.isAnonymous;
          const isMentor = ['mentor', 'primary-mentor', 'primarymentor', 'staff', 'admin', 'examiner'].includes((pubData.role || '').toLowerCase());
          const needsStudentIdMigration = !isMentor && (!pubData.missionGridStudentId || !pubData.missionGridStudentId.startsWith('MG') || pubData.studentCode !== pubData.missionGridStudentId);
          if (needsStudentIdMigration && !isCurrentAnonymous) {
            import('../services/users').then(({ generateNextStudentId }) => {
              generateNextStudentId().then(newId => {
                console.log(`[Migration] Backfilling studentId for user ${userId}: ${newId}`);
                updateDoc(doc(db, 'users', userId), {
                  missionGridStudentId: newId,
                  studentCode: newId,
                  updatedAt: new Date().toISOString()
                }).catch(e => console.warn("Failed backfilling student ID", e));
              });
            }).catch(err => console.warn("Failed importing generateNextStudentId", err));
          }

          // Link/sync current Firebase UID to users_private and users if missing or mismatched (skip if current Firebase user is anonymous)
          if (!isCurrentAnonymous && (privData.uid !== user.uid || pubData.uid !== user.uid) && !uidSyncAttemptedRef.current) {
            uidSyncAttemptedRef.current = true;
            console.log(`[AuthProvider DEBUG] Syncing UID mismatch/missing for userId ${userId}: database uid is ${privData.uid}, current uid is ${user.uid}`);
            updateDoc(doc(db, 'users_private', userId), { uid: user.uid }).catch(e => console.warn("Failed to sync UID to private profile", e));
            updateDoc(doc(db, 'users', userId), { uid: user.uid }).catch(e => console.warn("Failed to sync UID to public profile", e));
          }

          const roleToSync = combinedProfile.role || 'student';
          const batchIdToSync = combinedProfile.batchId || '';
          const syncKey = `${userId}_${roleToSync}_${batchIdToSync}_${user.uid}`;
          if (lastSyncedRoleRef.current !== syncKey) {
            setDoc(doc(db, 'user_roles', user.uid), {
              userId: userId,
              role: roleToSync,
              batchId: batchIdToSync,
              updatedAt: new Date().toISOString()
            }).then(() => {
              lastSyncedRoleRef.current = syncKey;
            }).catch(err => {
              console.warn("Failed to write to user_roles mapping:", err);
            });
          }

          // handleSetUserProfile(combinedProfile);
          handleSetUserProfile(combinedProfile);
        };

        const fetchUserData = async (userId: string, privData: any) => {
          try {
            const pubSnap = await getDoc(doc(db, 'users', userId));
            if (!firstSnapReceived) {
              firstSnapReceived = true;
              clearTimeout(profileFetchTimeout);
              setLoading(false);
            }
            if (pubSnap.exists()) {
              handleCombinedProfile(pubSnap.data(), privData, userId);
            }
          } catch (err) {
            console.error("AuthProvider fetchUserData error:", err);
            if (!firstSnapReceived) {
              firstSnapReceived = true;
              setLoading(false);
            }
          }
        };

        const executeQueryByUid = async () => {
          debugLogger.add('INFO', 'Executing query by UID');
          try {
            const qPriv = query(collection(db, 'users_private'), where('uid', '==', user.uid), limit(1));
            const privSnap = await getDocs(qPriv);
            if (!privSnap.empty) {
              const privDoc = privSnap.docs[0];
              await fetchUserData(privDoc.id, privDoc.data());
            } else {
              // Document query empty or user has a traditional/legacy structure
              const qLegacy = query(collection(db, 'users'), where('uid', '==', user.uid), limit(1));
              const legacySnap = await getDocs(qLegacy);
              if (!legacySnap.empty) {
                const legDoc = legacySnap.docs[0];
                const legData = legDoc.data();
                const legId = legDoc.id;

                // Migrate legacy formatting to split schema - KEEP original ID (mobile number or UID) to preserve all historical references
                const cleanId = legId;
                const publicData = {
                  ...legData,
                  uid: user.uid, // Ensure UID is in public profile
                  studentCode: getStudentCode({ ...legData, id: cleanId }),
                  createdAt: legData.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                delete (publicData as any).mobile;
                delete (publicData as any).pin;
                delete (publicData as any).email;
                delete (publicData as any).uid;
                delete (publicData as any).address;
                delete (publicData as any).loginHistory;

                const privateData = {
                  mobile: legData.mobile || (/^\d{10}$/.test(legId) ? legId : ''),
                  pin: legData.pin || '123456',
                  uid: user.uid,
                  email: legData.email || '',
                  address: legData.address || '',
                  loginHistory: legData.loginHistory || [],
                  userId: cleanId,
                  createdAt: legData.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };

                await setDoc(doc(db, 'users', cleanId), publicData);
                await setDoc(doc(db, 'users_private', cleanId), privateData);
                await setDoc(doc(db, 'user_roles', user.uid), {
                  userId: cleanId,
                  role: (publicData as any).role || 'student',
                  batchId: (publicData as any).batchId || '',
                  updatedAt: new Date().toISOString()
                });

                if (cleanId !== legId) {
                  await deleteDoc(doc(db, 'users', legId));
                }

                // Now load the combined profile
                handleCombinedProfile(publicData, privateData, cleanId);
                if (!firstSnapReceived) {
                  firstSnapReceived = true;
                  clearTimeout(profileFetchTimeout);
                  setLoading(false);
                }
              } else {
                const cached = safeStorage.getItem('user_profile');
                if (cached) {
                  try {
                    const parsed = JSON.parse(cached);
                    const isAnonymousUser = auth.currentUser?.isAnonymous;
                    if (parsed.mobile === '7407463884') {
                        console.log("DEBUG: Skipping force logout for mentor during 2FA flow.");
                    } else if (isAnonymousUser) {
                        console.log("DEBUG: Skipping force logout because the active Firebase user is anonymous (valid PIN/Password local session).");
                    } else {
                        console.log("DEBUG: Force logout triggered: Session was unlinked or deleted on the database.");
                        logout();
                    }
                  } catch (e) {
                     console.log("DEBUG: Force logout triggered: Session was unlinked or deleted on the database.");
                     logout();
                  }
                }
                if (!firstSnapReceived) {
                  firstSnapReceived = true;
                  clearTimeout(profileFetchTimeout);
                  setLoading(false);
                }
              }
            }
          } catch (err) {
            console.warn("User private profile snapshot query failed (likely offline):", err);
            if (!firstSnapReceived) {
              firstSnapReceived = true;
              clearTimeout(profileFetchTimeout);
              setLoading(false);
            }
          }
        };

        const loadProfile = async () => {
          const userIdFromClaims = claims.userId as string;
          let effectiveUserId = savedUserId || userIdFromClaims;
          
          if (!effectiveUserId && user.phoneNumber) {
             const sanitized = user.phoneNumber.replace(/\D/g, '');
             effectiveUserId = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
          }
          
          if (effectiveUserId) {
            try {
              const privSnap = await getDoc(doc(db, 'users_private', effectiveUserId));
              if (privSnap.exists()) {
                await fetchUserData(effectiveUserId, privSnap.data());
              } else {
                console.log("Direct private doc not found, falling back to UID query.");
                await executeQueryByUid();
              }
            } catch (err) {
              console.warn("Direct document fetch failed, falling back to UID query:", err);
              await executeQueryByUid();
            }
          } else {
            await executeQueryByUid();
          }
        };

        loadProfile();

        // Run user profile uid migration/sync check as backup (only for non-anonymous users)
        if (!user.isAnonymous) {
          try {
            const qPriv = query(collection(db, 'users_private'), where('uid', '==', user.uid));
            const snap = await getDocs(qPriv);
            if (snap.empty) {
              const savedProfileStr = safeStorage.getItem('user_profile');
              if (savedProfileStr) {
                const savedProfile = JSON.parse(savedProfileStr);
                if (savedProfile.mobile) {
                  // Perform simple lookup/linking on users_private
                  const mobileId = savedProfile.mobile.replace(/\D/g, '');
                  const tenDigitsId = mobileId.length > 10 ? mobileId.slice(-10) : mobileId;
                  
                  const targetDoc = await getDoc(doc(db, 'users_private', tenDigitsId));
                  if (targetDoc.exists()) {
                    await updateDoc(doc(db, 'users_private', targetDoc.id), { 
                      uid: user.uid
                    });
                  } else {
                      const qByMobile = query(collection(db, 'users_private'), where('mobile', '==', mobileId));
                      const mSnap = await getDocs(qByMobile);
                      if (!mSnap.empty) {
                        const tDoc = mSnap.docs[0];
                        await updateDoc(doc(db, 'users_private', tDoc.id), { 
                          uid: user.uid
                        });
                      }
                  }
                }
              }
            }
          } catch (error) {
            console.warn("Could not check/link profile UID (likely offline):", error);
          }
        }

      } else {
        // user is null: not authenticated with Firebase Auth
        setCurrentUser(null);
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        if (unsubPublicDoc) {
          unsubPublicDoc();
          unsubPublicDoc = null;
        }
        
        // Ensure there is always an active anonymous UID so PIN/Mobile logins can register ownership
        const attemptSignIn = async (retries = 3) => {
          try {
            await signInAnonymously(auth);
          } catch (e: any) {
            if (e.code === 'auth/admin-restricted-operation' || e.code === 'auth/operation-not-allowed') {
              console.warn("Anonymous sign-in is disabled in Firebase project configuration. Continuing as unauthenticated user.", e);
              setLoading(false);
              return;
            }
            
            if (retries > 0 && e.code === 'auth/network-request-failed') {
              console.warn(`Anonymous sign-in failed due to network. Retrying in 2s (Retries left: ${retries}):`, e.message);
              setTimeout(() => attemptSignIn(retries - 1), 2000);
            } else {
              console.warn("Anonymous sign-in failed. Continuing as unauthenticated user.", e.message || e);
              setLoading(false);
            }
          }
        };
        attemptSignIn();
      }
    });

    // Master startup guard in case auth registration remains sluggish
    initialTimer = setTimeout(() => {
      console.log("Auth state stream initial resolve timeout. Restoring cached local state.");
      setLoading(false);
    }, 500);

    return () => {
      unsubscribeAuth();
      if (initialTimer) clearTimeout(initialTimer);
      if (unsubProfile) unsubProfile();
      if (unsubPublicDoc) unsubPublicDoc();
    };
  }, []);

  const authContextValue = React.useMemo(() => ({
    currentUser,
    userProfile,
    loading,
    logout,
    setUserProfile: handleSetUserProfile
  }), [currentUser, userProfile, loading, logout, handleSetUserProfile]);

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};
