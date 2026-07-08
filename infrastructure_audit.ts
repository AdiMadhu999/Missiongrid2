
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function audit() {
  console.log("--- Infrastructure Audit Report ---");
  console.log("Environment Variables:");
  console.log("  GCLOUD_PROJECT:", process.env.GCLOUD_PROJECT);
  console.log("  GOOGLE_CLOUD_PROJECT:", process.env.GOOGLE_CLOUD_PROJECT);
  console.log("  FIREBASE_CONFIG:", process.env.FIREBASE_CONFIG ? "Set (length " + process.env.FIREBASE_CONFIG.length + ")" : "Not Set");

  try {
    // Try to identify the runtime identity first
    try {
      const res = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email", {
        headers: { "Metadata-Flavor": "Google" }
      });
      const email = await res.text();
      console.log("Runtime Identity (Service Account):", email);
    } catch (e) {
      console.log("Could not fetch service account identity from metadata server.");
    }

    // Initialize to see what it picks up
    const app = initializeApp({
      credential: applicationDefault()
    });
    console.log("Admin SDK initialized using applicationDefault()");
    console.log("Project ID (from App):", app.options.projectId);
    console.log("Database ID: (default)");
    console.log("Apps initialized:", getApps().map(a => a.name));

  } catch (err: any) {
    console.error("Initialization error:", err.message);
  }
}
audit();
