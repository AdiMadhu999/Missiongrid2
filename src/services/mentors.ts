import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { User } from '../models/user';
import { updateUserProfile } from './users';

enum OperationType {
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
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error("DEBUG: Error in verifyPrimaryMentor", JSON.stringify(errInfo));
}

export const verifyPrimaryMentor = async () => {
  const path = 'mentors';
  const mentorsRef = collection(db, path);
  
  let querySnapshot;
  try {
    const q = query(mentorsRef, where('mobile', '==', '7407463884'));
    querySnapshot = await getDocs(q);
    console.log("Primary mentor query successful, empty:", querySnapshot.empty);
  } catch (error) {
    console.error("DEBUG: verifyPrimaryMentor query failed");
    handleFirestoreError(error, OperationType.LIST, path);
    return;
  }
  
  if (querySnapshot.empty) {
    try {
      await addDoc(mentorsRef, {
        name: 'Adi Madhu',
        mobile: '7407463884',
        pin: '959312',
        role: 'mentor',
        status: 'active'
      });
      console.log("Primary mentor created.");
    } catch (error) {
      console.error("DEBUG: verifyPrimaryMentor addDoc failed");
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    console.log("Primary mentor exists.");
  }
};

export const addUser = async (userData: Partial<User>) => {
  const usersRef = collection(db, 'users');
  return await addDoc(usersRef, {
    ...userData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};

export const updateUserStatus = async (userId: string, status: 'active' | 'suspended' | 'removed') => {
  await updateUserProfile(userId, { status });
};

export const resetUserPin = async (userId: string, newPin: string) => {
  await updateUserProfile(userId, { pin: newPin });
};
