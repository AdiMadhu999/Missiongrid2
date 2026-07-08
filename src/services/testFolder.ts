import { db } from './firebase';
import { collection, doc, getDoc, getDocs, query, updateDoc, addDoc, deleteDoc, orderBy, writeBatch } from 'firebase/firestore';
import { TestFolder } from '../models/testFolder';

const COLLECTION_NAME = 'test_folders';

export const TestFolderService = {
  createFolder: async (folderData: Omit<TestFolder, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...folderData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return docRef.id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  updateFolder: async (id: string, folderData: Partial<TestFolder>): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, { ...folderData, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  deleteFolder: async (id: string): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  getFolders: async (): Promise<TestFolder[]> => {
    try {
      const snap = await getDocs(collection(db, COLLECTION_NAME));
      const folders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TestFolder));
      return folders.sort((a, b) => {
        const orderA = a.sortOrder ?? 99999;
        const orderB = b.sortOrder ?? 99999;
        if (orderA !== orderB) return orderA - orderB;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  reorderFolders: async (folderIds: string[]): Promise<void> => {
    try {
      const batch = writeBatch(db);
      folderIds.forEach((id, index) => {
        const ref = doc(db, COLLECTION_NAME, id);
        batch.update(ref, { sortOrder: index, updatedAt: new Date().toISOString() });
      });
      await batch.commit();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
};
