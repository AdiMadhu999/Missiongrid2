/**
 * Mission Firestore Data Model
 * Represents basic mission objects stored in Firestore.
 */
export interface Mission {
  id?: string;          // Firestore document auto-generated identifier (optional)
  missionId: string;    // Unique reference/code for physical mission tracking
  title: string;        // Name/heading of the target mission selection
  description: string;  // Detailed explanation of goals and criteria
  status: 'draft' | 'published' | 'completed' | 'archived'; // Core lifecycle status
  createdAt?: string;   // ISO timestamp of creation
  updatedAt?: string;   // ISO timestamp of modification
}
