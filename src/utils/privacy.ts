import { User } from '../models/user';

/**
 * Generates a stable unique Student Code based on user details.
 * Prevents exposing mobile numbers or primary UIDs.
 */
export function getStudentCode(user: Partial<User> | null | undefined): string {
  if (!user) return '';
  if (user.pin === 'mentor_bypass' || user.role === 'mentor' || user.role === 'primary-mentor') {
    return 'MENTOR-ADMIN';
  }
  // If user already has a student code stored, use it
  if ((user as any).studentCode) {
    return (user as any).studentCode;
  }
  if ((user as any).missionGridStudentId) {
    return (user as any).missionGridStudentId;
  }

  // Generate a deterministic unique code from seed (mobile or id)
  const seed = user.mobile || user.id || user.uid || 'guest';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const codeNum = Math.abs(hash) % 90000 + 10000; // 5 digits: 10000 to 99999
  return `MS-${codeNum}`;
}

/**
 * Sanitizes a student profile or user object before sending or rendering.
 * Enforces privacy rules so phone numbers, UIDs, and other sensitive details are hidden.
 * Only the mentor role is allowed to view private contact details.
 */
export function sanitizeUserForRole<T extends Partial<User>>(
  user: T | null | undefined,
  currentUserRole?: string,
  isSelf: boolean = false
): T | null {
  if (!user) return null;

  const code = getStudentCode(user);
  const sanitized = { ...user, studentCode: code };

  // If viewing user is mentor/staff/admin, they are allowed contact access (except PIN/auth credentials)
  const roleLower = (currentUserRole || '').toLowerCase();
  const isAuthorizedViewer = 
    roleLower === 'mentor' || 
    roleLower === 'primary-mentor' || 
    roleLower === 'primarymentor' || 
    roleLower === 'staff' || 
    roleLower === 'admin' ||
    roleLower === 'examiner';

  if (!isAuthorizedViewer) {
    // Hide mobile / phone completely
    if (!isSelf) {
      delete sanitized.mobile;
      delete sanitized.email;
      delete sanitized.address;
    } else {
      // For self, mask the mobile/phone so they don't display clearly in casual views
      if (sanitized.mobile) {
        sanitized.mobile = maskPhone(sanitized.mobile);
      }
      if (sanitized.email) {
        sanitized.email = maskEmail(sanitized.email);
      }
    }

    // Never expose internal IDs, UIDs or paths to anyone but the backend/mentors
    delete sanitized.uid;
    // We mask the id using studentCode so internal ID is not exposed
    if (sanitized.id && sanitized.id !== code) {
      sanitized.id = code;
    }
  }

  // Absolutely never expose authentication pin or credentials to other clients
  if (!isSelf) {
    delete sanitized.pin;
    delete sanitized.loginHistory;
  }

  return sanitized;
}

/**
 * Masks a phone number (e.g. +91 7407463884 -> ******3884)
 */
export function maskPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length <= 4) return '****';
  return '*'.repeat(clean.length - 4) + clean.substring(clean.length - 4);
}

/**
 * Masks an email address (e.g. hello@gmail.com -> h***o@gmail.com)
 */
export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '****';
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) return '*@' + domain;
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1] + '@' + domain;
}
