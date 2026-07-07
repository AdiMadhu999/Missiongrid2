/**
 * User Profile Firestore Data Model
 * Represents initial secure profile structures stored in Firestore.
 */
export interface UserProfile {
  id?: string;         // Firestore document auto-generated identifier (optional)
  uid: string;         // Firebase Auth unique identifier (mandatory)
  displayName: string; // User's standard display name
  email: string;       // Registered contact/account email address
  photoURL: string;    // URL pointing to the user's avatar image
  createdAt?: string;  // ISO timestamp string when the profile was generated
  updatedAt?: string;  // ISO timestamp string of the last modification
}
