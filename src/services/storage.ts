import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export const uploadProfileImage = async (userId: string, targetFile: File): Promise<string> => {
  const extension = targetFile.name.split('.').pop() || 'jpg';
  const filePath = `profiles/${userId}.${extension}`;
  const fileRef = ref(storage, filePath);
  
  await uploadBytesResumable(fileRef, targetFile);
  const downloadUrl = await getDownloadURL(fileRef);
  return downloadUrl;
};

export const deleteProfileImage = async (photoUrl: string) => {
  if (!photoUrl || !photoUrl.includes('firebasestorage')) return;
  // Try deleting from URL (note: might require refFromURL pattern, but we can do a simpler ref if we know structure)
  try {
     const fileRef = ref(storage, photoUrl);
     await deleteObject(fileRef);
  } catch (err) {
     console.warn("Could not delete image object", err);
  }
};

export const uploadFile = async (path: string, file: File): Promise<{ url: string; path: string }> => {
  // Extract and sanitize filename while keeping path directory structure intact
  const pathParts = path.split('/');
  const fileName = pathParts.pop() || 'file';
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const sanitizedPath = [...pathParts, sanitizedName].join('/');

  const fileRef = ref(storage, sanitizedPath);
  await uploadBytesResumable(fileRef, file);
  const url = await getDownloadURL(fileRef);
  return { url, path: sanitizedPath };
};

export const getFreshUrlFromPathOrUrl = async (pathOrUrl: string): Promise<string> => {
  if (!pathOrUrl) return '';
  let path = pathOrUrl;
  
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    if (pathOrUrl.includes('/o/')) {
      try {
        const parts = pathOrUrl.split('/o/');
        if (parts.length > 1) {
          const encodedPath = parts[1].split('?')[0];
          path = decodeURIComponent(encodedPath);
        }
      } catch (err) {
        console.warn("Failed to parse storage path from URL:", pathOrUrl, err);
      }
    } else {
      // Not a Firebase Storage URL standard format
      return pathOrUrl;
    }
  }

  try {
    const fileRef = ref(storage, path);
    const freshUrl = await getDownloadURL(fileRef);
    return freshUrl;
  } catch (error) {
    console.warn("Failed to get fresh download URL for path:", path, error);
    // Return the original pathOrUrl only if it is a valid HTTP(S) URL, otherwise empty string
    return (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) ? pathOrUrl : '';
  }
};

