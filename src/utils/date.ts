/**
 * Safe, robust date parsing functions that gracefully handle
 * ISO strings, standard JS Date objects, and Firestore Timestamp objects.
 */

export function safeDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        return val.toDate();
      } catch (e) {
        // Fallback
      }
    }
    if (typeof val.seconds === 'number') {
      return new Date(val.seconds * 1000 + (val.nanoseconds ? val.nanoseconds / 1000000 : 0));
    }
    if (typeof val._seconds === 'number') {
      return new Date(val._seconds * 1000 + (val._nanoseconds ? val._nanoseconds / 1000000 : 0));
    }
    // If it's any other object, passing it directly to new Date() causes a TypeError: Cannot convert object to primitive value
    return new Date();
  }

  if (typeof val === 'string' || typeof val === 'number') {
    try {
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        const [y, m, d] = val.split('-').map(Number);
        return new Date(y, m - 1, d, 0, 0, 0, 0);
      }
      const date = new Date(val);
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (e) {
      return new Date();
    }
  }

  return new Date();
}

export function safeISOString(val: any): string {
  return safeDate(val).toISOString();
}

export function safeSplitDate(val: any): string {
  const isoStr = safeISOString(val);
  return isoStr.split('T')[0];
}

export function formatIST(date: any): string {
  const d = safeDate(date);
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatTimeIST(date: any): string {
  const d = safeDate(date);
  return d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit' });
}

export function calculatePreparationDay(registrationDate: any): number {
  const reg = safeDate(registrationDate);
  const now = new Date();
  
  // Set to midnight to avoid time zone issues when calculating full days
  const start = new Date(reg.getFullYear(), reg.getMonth(), reg.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(1, diffDays + 1); // Assuming Day 1 is the registration day
}
