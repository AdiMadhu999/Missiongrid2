/**
 * Removes undefined values from an object to prevent Firestore errors.
 * Firestore does not support undefined values in fields.
 */
export function cleanObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => (typeof item === 'object' ? cleanObject(item) : item)) as any;
  }

  if (typeof obj === 'object') {
    const result = { ...obj } as any;
    Object.keys(result).forEach(key => {
      if (result[key] === undefined) {
        delete result[key];
      } else if (result[key] !== null && typeof result[key] === 'object') {
        result[key] = cleanObject(result[key]);
      }
    });
    return result;
  }

  return obj;
}
