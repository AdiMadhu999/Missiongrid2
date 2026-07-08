import dotenv from "dotenv";
dotenv.config();

import { APP_VERSION } from "./src/version.ts";
import express from "express";
import compression from "compression";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import cron from "node-cron";
import { GoogleGenAI, Type } from "@google/genai";
import bcrypt from "bcryptjs";
import { 
  loadAllJobs, 
  loadJob,
  saveJob,
  deleteJob,
  saveAllJobs, 
  loadBudgetDetails, 
  saveBudgetDetails, 
  checkAIUsageAllowed, 
  startBackgroundIngest,
  JobState,
  clearJobCache,
  correctOcrMistakes
} from "./server_jobs.ts";
import { 
  executeResilientAI, 
  poolStats, 
  getPoolKeys, 
  DEFAULT_MODEL,
  runAIHealthCheck 
} from "./src/services/ai_resiliency.ts";
import {
  resilientParseJSON,
  mapAndHealQuestionsSchema
} from "./src/services/ai_healing.ts";
import { initializeApp, getApps, getApp, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

// --- FIRESTORE REST API HELPERS FOR SANDBOX IAM WORKAROUNDS ---

function toFirestoreValue(val: any): any {
  if (val === null) return { nullValue: null };
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === "object") {
    return { mapValue: { fields: toFirestoreFields(val) } };
  }
  return { nullValue: null };
}

function fromFirestoreValue(val: any): any {
  if (!val) return null;
  if ("stringValue" in val) return val.stringValue;
  if ("booleanValue" in val) return val.booleanValue;
  if ("integerValue" in val) return parseInt(val.integerValue);
  if ("doubleValue" in val) return parseFloat(val.doubleValue);
  if ("timestampValue" in val) return val.timestampValue;
  if ("arrayValue" in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in val) return fromFirestoreFields(val.mapValue.fields || {});
  if ("nullValue" in val) return null;
  return null;
}

function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      fields[key] = toFirestoreValue(obj[key]);
    }
  }
  return fields;
}

function fromFirestoreFields(fields: any): any {
  const obj: any = {};
  if (!fields) return obj;
  for (const key of Object.keys(fields)) {
    obj[key] = fromFirestoreValue(fields[key]);
  }
  return obj;
}

const getBaseUrl = () => {
  const dbId = firestoreDatabaseId || "(default)";
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents`;
};

async function restGetDoc(collection: string, docId: string, authHeader: string): Promise<any> {
  const url = `${getBaseUrl()}/${collection}/${docId}`;
  const res = await fetch(url, {
    headers: {
      "Authorization": authHeader
    }
  });
  if (res.status === 404) {
    return { exists: false, data: () => ({}) };
  }
  if (!res.ok) {
    throw new Error(`Firestore REST getDoc failed: ${res.status} ${await res.text()}`);
  }
  const resJson = await res.json();
  const data = fromFirestoreFields(resJson.fields || {});
  return { exists: true, id: docId, data: () => data };
}

async function restSetDoc(collection: string, docId: string, data: any, authHeader: string, merge = false) {
  const baseUrl = getBaseUrl();
  let url = `${baseUrl}/${collection}/${docId}`;
  
  if (merge) {
    const fields = Object.keys(data);
    const queryParams = fields.map(f => `updateMask.fieldPaths=${f}`).join("&");
    if (queryParams) {
      url += `?${queryParams}`;
    }
  }
  
  const payload = {
    fields: toFirestoreFields(data)
  };
  
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader
    },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    throw new Error(`Firestore REST setDoc failed: ${res.status} ${await res.text()}`);
  }
}

async function restAddDoc(collection: string, data: any, authHeader: string): Promise<string> {
  const url = `${getBaseUrl()}/${collection}`;
  const payload = {
    fields: toFirestoreFields(data)
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`Firestore REST addDoc failed: ${res.status} ${await res.text()}`);
  }
  const resJson = await res.json();
  const nameParts = resJson.name.split("/");
  return nameParts[nameParts.length - 1];
}

async function restQueryDocs(collection: string, filters: Array<{ field: string, op: string, value: any }>, authHeader: string, limit?: number): Promise<any[]> {
  const url = `${getBaseUrl()}:runQuery`;
  
  const opMap: Record<string, string> = {
    "==": "EQUAL",
    "<": "LESS_THAN",
    "<=": "LESS_THAN_OR_EQUAL",
    ">": "GREATER_THAN",
    ">=": "GREATER_THAN_OR_EQUAL",
    "in": "IN"
  };

  const fieldFilters = filters.map(f => ({
    fieldFilter: {
      field: { fieldPath: f.field },
      op: opMap[f.op] || f.op,
      value: toFirestoreValue(f.value)
    }
  }));

  let whereClause: any = undefined;
  if (fieldFilters.length === 1) {
    whereClause = fieldFilters[0];
  } else if (fieldFilters.length > 1) {
    whereClause = {
      compositeFilter: {
        op: "AND",
        filters: fieldFilters
      }
    };
  }

  const structuredQuery: any = {
    from: [{ collectionId: collection }]
  };
  if (whereClause) {
    structuredQuery.where = whereClause;
  }
  if (limit !== undefined) {
    structuredQuery.limit = limit;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader
    },
    body: JSON.stringify({ structuredQuery })
  });

  if (!res.ok) {
    throw new Error(`Firestore REST runQuery failed: ${res.status} ${await res.text()}`);
  }

  const resJson = await res.json();
  const results: any[] = [];
  if (Array.isArray(resJson)) {
    for (const item of resJson) {
      if (item.document) {
        const docId = item.document.name.split("/").pop();
        const data = fromFirestoreFields(item.document.fields || {});
        results.push({ id: docId, ...data });
      }
    }
  }
  return results;
}

async function restListDocs(collection: string, authHeader: string): Promise<any[]> {
  const url = `${getBaseUrl()}/${collection}`;
  const res = await fetch(url, {
    headers: {
      "Authorization": authHeader
    }
  });
  if (!res.ok) {
    throw new Error(`Firestore REST listDocs failed: ${res.status} ${await res.text()}`);
  }
  const resJson = await res.json();
  const results: any[] = [];
  if (resJson.documents && Array.isArray(resJson.documents)) {
    for (const doc of resJson.documents) {
      const docId = doc.name.split("/").pop();
      const data = fromFirestoreFields(doc.fields || {});
      results.push({ id: docId, ...data });
    }
  }
  return results;
}

const wrapDocsList = (docs: any[]) => {
  const wrapped = docs.map(d => ({
    id: d.id,
    ref: { id: d.id },
    data: () => d
  }));
  return {
    docs: wrapped,
    forEach: (callback: (doc: any) => void) => wrapped.forEach(callback),
    size: docs.length,
    empty: docs.length === 0
  };
};

// Helper to check if checkDateStr falls within a leave of numberOfDays starting on startDateStr
function isDateInLeave(startDateStr: string, numberOfDays: number, checkDateStr: string): boolean {
  try {
    if (!startDateStr || !checkDateStr || !numberOfDays) return false;
    const start = new Date(startDateStr + 'T00:00:00');
    const check = new Date(checkDateStr + 'T00:00:00');
    const diffTime = check.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays < numberOfDays;
  } catch (err) {
    console.error("Error parsing leave dates:", err);
    return false;
  }
}

// DAILY PREMIUM VERIFICATION
// Shared helper to process a single student's premium/compliance verification
async function processPremiumVerificationForUser(adminDb: any, doc: any, now: Date, yesterdayStr: string, authHeader: string | null = null) {
  const studentId = doc.id;
  const uData = doc.data() || {};
  const timestamp = now.toISOString();
  
  let needsUpdate = false;
  const updateData: any = {};
  
  const isPremium = !!uData.isPremium;
  const manualOverride = !!uData.manualPremiumOverride;
  const premiumExpiryDate = uData.premiumExpiryDate;

  // Local helper for logging & updates supporting both REST and SDK
  const restAdd = async (coll: string, data: any) => {
    if (authHeader) {
      await restAddDoc(coll, data, authHeader);
    } else {
      await adminDb.collection(coll).add(data);
    }
  };

  const restUpdateUser = async (data: any) => {
    if (authHeader) {
      await restSetDoc("users", studentId, data, authHeader, true);
    } else {
      await doc.ref.update(data);
    }
  };
  
  // Skip if student was never premium or already revoked
  if (isPremium === false && uData.premiumStatus !== 'premium') {
    return { studentId, name: uData.name, status: "skipped_not_premium", missedCount: uData.consecutiveMissedMissions || 0 };
  }
  
  if (manualOverride) {
    return { studentId, name: uData.name, status: "skipped_manual_override", missedCount: uData.consecutiveMissedMissions || 0 };
  }
  
  // 1. Premium Expiry Rule
  if (isPremium && premiumExpiryDate) {
    const expiryDate = new Date(premiumExpiryDate);
    
    // Update remaining premium days
    const diffTime = expiryDate.getTime() - now.getTime();
    const currentRemainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    if (uData.remainingPremiumDays !== currentRemainingDays) {
      updateData.remainingPremiumDays = currentRemainingDays;
      needsUpdate = true;
    }

    if (now > expiryDate) {
      updateData.isPremium = false;
      updateData.premiumStatus = 'FREE';
      updateData.remainingPremiumDays = 0;
      needsUpdate = true;
      
      console.log(`[Daily Job] Premium expired for student: ${studentId}`);
      
      // Log to premium_history
      await restAdd("premium_history", {
        studentId,
        status: 'FREE',
        isPremium: false,
        action: 'expired',
        updatedBy: 'system',
        updatedByName: 'System Check',
        timestamp,
        details: `Premium automatically expired. Expiry date reached: ${premiumExpiryDate}.`
      });
      
      // Log to security_history
      await restAdd("security_history", {
        studentId,
        type: 'active_check',
        ipAddress: 'system',
        deviceInfo: 'node-cron-server',
        timestamp,
        details: `Active check: Premium validity expired on ${premiumExpiryDate}. Status changed to Free.`
      });
      
      // Log to studentUpdates
      await restAdd("studentUpdates", {
        studentId: uData.uid || studentId,
        uid: uData.uid || studentId,
        type: 'premium_expired',
        title: '⭐ Premium Expired',
        description: 'Your Premium Access has expired. Maintain consistency or contact your coordinator to purchase/extend.',
        timestamp,
        createdAt: timestamp
      });
      
      // Update local variables for downstream checks
      uData.isPremium = false;
    }
  }
  
  // 2. Mission Consistency Rule (Only run if they are premium after any expiry check)
  if (uData.isPremium) {
    // Check yesterday's daily mission report
    let submitted = false;
    if (authHeader) {
      const reports = await restQueryDocs("dailyMissionReports", [
        { field: "userId", op: "==", value: studentId },
        { field: "date", op: "==", value: yesterdayStr }
      ], authHeader, 1);
      submitted = reports.length > 0;
    } else {
      const reportsSnap = await adminDb.collection("dailyMissionReports")
        .where("userId", "==", studentId)
        .where("date", "==", yesterdayStr)
        .get();
      submitted = !reportsSnap.empty;
    }
      
    let missedCount = uData.consecutiveMissedMissions || 0;
    let actionTaken = 'none';
    let finalStatus = 'submitted';
    
    // Track last verification on every run
    updateData.lastVerificationDate = timestamp;
    updateData.lastValidationDate = timestamp;
    needsUpdate = true;

    // Check if the student has an approved leave request covering yesterdayStr
    let onLeave = false;
    try {
      let studentLeaves: any[] = [];
      if (authHeader) {
        studentLeaves = await restQueryDocs("leaveRequests", [
          { field: "studentId", op: "==", value: studentId },
          { field: "status", op: "==", value: "approved" }
        ], authHeader);
      } else {
        const leavesSnap = await adminDb.collection("leaveRequests")
          .where("studentId", "==", studentId)
          .where("status", "==", "approved")
          .get();
        studentLeaves = leavesSnap.docs.map((d: any) => d.data());
      }

      onLeave = studentLeaves.some((leave: any) => {
        const startStr = leave.startDate;
        const days = Number(leave.numberOfDays) || 0;
        return isDateInLeave(startStr, days, yesterdayStr);
      });
    } catch (err) {
      console.error("Error checking leave status for user:", studentId, err);
    }

    if (submitted) {
      if (missedCount !== 0) {
        missedCount = 0;
        updateData.consecutiveMissedMissions = 0;
        updateData.consecutiveMissedDays = 0;
      }
      finalStatus = 'submitted';
    } else if (onLeave) {
      actionTaken = 'ignored_approved_leave';
      finalStatus = 'on_leave';
      console.log(`[Daily Job] Student ${studentId} is on approved leave for ${yesterdayStr}. Skipping inactivity penalty.`);
      // Log in security_history
      await restAdd("security_history", {
        studentId,
        type: 'active_check',
        ipAddress: 'system',
        deviceInfo: 'node-cron-server',
        timestamp,
        details: `Active check compliance: Student is on Approved Leave for ${yesterdayStr}. Skipped inactivity penalty.`
      });
    } else {
      missedCount += 1;
      updateData.consecutiveMissedMissions = missedCount;
      updateData.consecutiveMissedDays = missedCount;
      actionTaken = 'incremented_missed_missions';
      finalStatus = 'missed';
      
      // 3. Warnings
      if (missedCount === 5) {
        await restAdd("warnings", {
          studentId,
          studentName: uData.name || 'Student',
          reason: 'Yellow Alert: Missed 5 Consecutive Missions. Maintain consistency to protect your Premium Access!',
          mentorId: 'system',
          mentorName: 'System Engine',
          date: timestamp,
          status: 'Active',
          uid: uData.uid || studentId
        });
        
        await restAdd("studentUpdates", {
          studentId: uData.uid || studentId,
          uid: uData.uid || studentId,
          type: 'mentor_update',
          title: '📢 Yellow Alert: Missed 5 Consecutive Missions',
          description: 'You have missed 5 daily missions in a row. Maintain consistency to protect your Premium Access!',
          timestamp,
          createdAt: timestamp
        });
      } else if (missedCount === 8) {
        await restAdd("warnings", {
          studentId,
          studentName: uData.name || 'Student',
          reason: 'Orange Alert: Missed 8 Consecutive Missions. Critical warning! You have missed 8 missions in a row.',
          mentorId: 'system',
          mentorName: 'System Engine',
          date: timestamp,
          status: 'Active',
          uid: uData.uid || studentId
        });
        
        await restAdd("studentUpdates", {
          studentId: uData.uid || studentId,
          uid: uData.uid || studentId,
          type: 'mentor_update',
          title: '📢 Orange Alert: Missed 8 Consecutive Missions',
          description: 'Critical warning! You have missed 8 missions in a row. Missing 10 consecutive missions leads to automated Premium Revocation!',
          timestamp,
          createdAt: timestamp
        });
      } else if (missedCount === 9) {
        await restAdd("warnings", {
          studentId,
          studentName: uData.name || 'Student',
          reason: 'Red Alert: Revocation Imminent tomorrow! Urgent! 9 consecutive missed missions.',
          mentorId: 'system',
          mentorName: 'System Engine',
          date: timestamp,
          status: 'Active',
          uid: uData.uid || studentId
        });
        
        await restAdd("studentUpdates", {
          studentId: uData.uid || studentId,
          uid: uData.uid || studentId,
          type: 'mentor_update',
          title: '📢 Red Alert: Revocation Imminent tomorrow!',
          description: 'Urgent! 9 consecutive missed missions. Your Premium access will be revoked tomorrow at 9:00 AM if you do not submit your daily mission report today!',
          timestamp,
          createdAt: timestamp
        });
      }
      
      // 4. Revocation if 10 consecutive days missed
      if (missedCount >= 10) {
        updateData.isPremium = false;
        updateData.premiumStatus = 'FREE'; // Set to 'FREE' per requirement
        updateData.premiumType = 'EXPIRED';
        updateData.premiumRemovalReason = '10 Consecutive Missed Submissions';
        updateData.remainingPremiumDays = 0;
        updateData.premiumRevokedDate = timestamp;
        actionTaken = 'premium_revoked_for_inconsistency';
        
        console.log(`[Daily Job] Premium consistency revoked (missed ${missedCount} days) for student: ${studentId}`);
        
        // Log in premium_history
        await restAdd("premium_history", {
          studentId,
          status: 'FREE',
          isPremium: false,
          action: 'auto_check_revoked',
          updatedBy: 'system',
          updatedByName: 'System Check',
          timestamp,
          details: `Premium automatically revoked during daily 10-day consistency check due to reaching 10 consecutive missed missions (last submission date: ${uData.lastMissionSubmissionDate || 'Never'}).`
        });
        
        // Log in security_history
        await restAdd("security_history", {
          studentId,
          type: 'active_check',
          ipAddress: 'system',
          deviceInfo: 'node-cron-server',
          timestamp,
          details: `Compliance Failure: 10 consecutive missed missions. Premium status automatically changed to Free.`
        });
        
        // Log in studentUpdates
        await restAdd("studentUpdates", {
          studentId: uData.uid || studentId,
          uid: uData.uid || studentId,
          type: 'premium_expired',
          title: '⭐ Premium Revoked',
          description: 'Your premium access has been revoked due to 10 consecutive missed daily missions.',
          timestamp,
          createdAt: timestamp
        });
      } else {
        // Just log missed day in security_history
        await restAdd("security_history", {
          studentId,
          type: 'active_check',
          ipAddress: 'system',
          deviceInfo: 'node-cron-server',
          timestamp,
          details: `Active check compliance: Student did not submit mission for ${yesterdayStr}. Missed counter: ${missedCount}/10.`
        });
      }
    }
    
    if (needsUpdate) {
      updateData.updatedAt = timestamp;
      updateData.lastPremiumChangeDate = timestamp;
      updateData.premiumChangedBy = 'system';
      await restUpdateUser(updateData);
    }
    
    return { studentId, name: uData.name, status: finalStatus, missedCount, actionTaken };
  } else {
    // Currently free/revoked
    if (needsUpdate) {
      updateData.updatedAt = timestamp;
      await restUpdateUser(updateData);
    }
    return { studentId, name: uData.name, status: "skipped_not_premium", missedCount: uData.consecutiveMissedMissions || 0 };
  }
}

async function performDailyPremiumVerification() {
  console.log("[Daily Job] Starting premium verification...");
  const adminDb = getFirestore();
  const now = new Date();
  
  // Check-in check for yesterday: YYYY-MM-DD
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  try {
    const studentsSnap = await adminDb.collection("users").where("role", "in", ["student", "aspirant"]).get();
    
    for (const doc of studentsSnap.docs) {
      await processPremiumVerificationForUser(adminDb, doc, now, yesterdayStr);
    }
    console.log("[Daily Job] Premium verification completed.");
  } catch (err) {
    console.error("[Daily Job] Premium verification failed:", err);
  }
}

const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let projectId = "mission-selection-ultimate";
let firestoreDatabaseId: string | undefined = undefined;
if (fs.existsSync(firebaseConfigPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
    if (config.projectId) {
      projectId = config.projectId;
    }
    if (config.firestoreDatabaseId) {
      firestoreDatabaseId = config.firestoreDatabaseId;
    }
  } catch (err) {
    console.error("Failed to parse firebase-applet-config.json:", err);
  }
}

if (getApps().length === 0) {
  let credential = applicationDefault();
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.log("[Server] FIREBASE_SERVICE_ACCOUNT_KEY found.");
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credential = cert(serviceAccount);
      console.log("[Server] Initialized Firebase Admin using FIREBASE_SERVICE_ACCOUNT_KEY.");
    } catch (err) {
      console.error("[Server] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", err);
    }
  } else {
    console.log("[Server] FIREBASE_SERVICE_ACCOUNT_KEY NOT found. Falling back to applicationDefault().");
    console.log("[Server] Initialized Firebase Admin using applicationDefault().");
  }

  console.log("[Server] Initializing Firebase Admin with project: mission-selection-ultimate");
  initializeApp({
    credential,
    projectId: 'mission-selection-ultimate'
  });
  console.log("[Server] Firebase Admin initialized. Apps:", getApps().map(a => a.name));
  if (firestoreDatabaseId) {
    console.log("[Server] Firebase Admin initialized with databaseId:", firestoreDatabaseId);
  }
}

// Middleware: Authenticate Request Token via Firebase ID Token
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized. Missing authentication token." });
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (err: any) {
    console.error("[Server] Auth verification failed:", err.message || err);
    res.status(401).json({ error: "Unauthorized. Invalid or expired authentication token." });
  }
};

// Middleware: Authenticate Mentor Role
const requireMentor = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  await requireAuth(req, res, async () => {
    const user = (req as any).user;
    const email = (user.email || "").toLowerCase();
    const phone = user.phone_number || "";
    const uid = user.uid || "";
    console.log("[Server] requireMentor check:", { email, phone, uid, claims: user });

    const isMentorByToken = (email === "missionselectionofficial999@gmail.com") ||
                            (phone === "+917407463884") ||
                            (uid === "7407463884") ||
                            (user.mentorAccess === true) ||
                            (["mentor", "primary-mentor", "primarymentor", "staff", "admin", "examiner"].includes((user.role || "").toLowerCase()));

    if (isMentorByToken) {
      return next();
    }

    try {
      console.log("Looking up role for uid (fallback):", uid);
      
      const db = getFirestore(getApp(), '(default)');
      const roleDoc = await db.collection('user_roles').doc(uid).get();
      
      if (roleDoc.exists) {
        const roleData = roleDoc.data();
        const role = (roleData?.role || "").toLowerCase();
        if (["mentor", "primary-mentor", "primarymentor", "staff", "admin", "examiner"].includes(role)) {
          return next();
        }
      } else {
        console.log("Role doc does not exist for uid:", uid);
      }
    } catch (err: any) {
      console.error("[Server] Firestore role lookup failed:", err);
    }

    res.status(403).json({ error: "Forbidden. Mentor privileges required." });
  });
};

// dotenv.config(); // Moved to top

// Ensure the server can initialize securely with or without the key in the environment
const getGenAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not defined in the environment. AI mock test creator requests will fail.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// Helper for deep sanitization of AI responses - strictly skip LaTeX and SVG dedicated fields
const sanitizeDeep = (obj: any, keyName?: string): any => {
  // STRICT BYPASS for fields explicitly meant for LaTeX or SVG markup
  if (keyName && (
    keyName.endsWith('_latex') || 
    keyName.toLowerCase().includes('latex') ||
    keyName.endsWith('_svg') ||
    keyName.toLowerCase().includes('svg')
  )) {
    return obj;
  }

  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (trimmed.startsWith('<svg') || trimmed.includes('</svg>')) {
      return obj;
    }
    return correctOcrMistakes(obj);
  }
  if (Array.isArray(obj)) return obj.map(v => sanitizeDeep(v, keyName));
  if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {};
    for (const key in obj) newObj[key] = sanitizeDeep(obj[key], key);
    return newObj;
  }
  return obj;
};

const app = express();

app.get("/app-release.apk", (req, res) => {
  const queryStr = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const sep = queryStr ? '&' : '?';
  res.redirect(`https://mission-selection-ultimate.web.app/app-release.apk${queryStr}${sep}t=${Date.now()}`);
});

app.get("/app-debug.apk", (req, res) => {
  const queryStr = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const sep = queryStr ? '&' : '?';
  res.redirect(`https://mission-selection-ultimate.web.app/app-debug.apk${queryStr}${sep}t=${Date.now()}`);
});

app.use(compression());

// Handle CORS requests from the Capacitor native app origins or any client
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

const PORT = 3000;

// 1. Immediately start listening to the port to avoid "Failed to fetch" on startup
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Server] Core engine listening on port ${PORT}`);
  console.log(`[Server] Mode: ${process.env.NODE_ENV || 'development'}`);
  
  // Schedule daily premium verification at 9:00 AM
  cron.schedule('0 9 * * *', () => {
    console.log("[Scheduler] Running daily premium verification...");
    performDailyPremiumVerification().catch(console.error);
  }, {
    timezone: "Asia/Kolkata"
  });
});

// Version check endpoint for PWA updates
app.get("/api/version", (req, res) => {
  console.log(`[Server] Version request received from ${req.ip}`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({ version: APP_VERSION });
});

// Endpoint for client IP and User-Agent detection during registration/audit
app.get("/api/my-ip", (req, res) => {
  const ipAddress = (req.headers['x-forwarded-for'] as string || req.ip || req.socket.remoteAddress || '').split(',')[0].trim();
  res.json({ ip: ipAddress, userAgent: req.headers['user-agent'] || '' });
});

// Set high limits for incoming base64 documents/images
app.use(express.json({ limit: "60mb" }));
app.use(express.urlencoded({ limit: "60mb", extended: true }));

// Health and Config Check
app.get("/api/config-status", (req, res) => {
  res.json({
    firebaseConfigured: fs.existsSync(path.join(process.cwd(), "firebase-applet-config.json")),
    aiPoolSize: getPoolKeys().length
  });
});

// Endpoint for saving database cleanup report
app.post("/api/admin/reset-db", requireMentor, async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized. Missing authentication token." });
  }

  const user = (req as any).user;
  const phone = user.phone_number || "";
  
  // Strict verification as per instructions
  if (phone !== "+917407463884") {
    return res.status(403).json({ error: "Unauthorized access" });
  }

  try {
    let totalDeleted = 0;
    const collectionsToClear = [
        'test_attempts', 'dailyMissionReports', 'studentStats', 
        'otp_logs', 'leaves', 'notifications', 'activity_logs',
        'targetProgress', 'targetReactions', 'targetAssignments'
    ];
    
    // 1. Delete student users
    const users = await restQueryDocs('users', [{ field: 'role', op: '==', value: 'student' }], authHeader);
    for (const user of users) {
      await fetch(`${getBaseUrl()}/users/${user.id}`, { method: 'DELETE', headers: { 'Authorization': authHeader } });
      await fetch(`${getBaseUrl()}/users_private/${user.id}`, { method: 'DELETE', headers: { 'Authorization': authHeader } });
      await fetch(`${getBaseUrl()}/user_roles/${user.id}`, { method: 'DELETE', headers: { 'Authorization': authHeader } });
      totalDeleted++;
    }

    // 2. Clear remaining operational collections
    for (const collName of collectionsToClear) {
        const docs = await restListDocs(collName, authHeader);
        for (const doc of docs) {
            await fetch(`${getBaseUrl()}/${collName}/${doc.id}`, { method: 'DELETE', headers: { 'Authorization': authHeader } });
        }
    }

    // Disable tool
    await restSetDoc('system', 'config', { databaseResetToolDisabled: true }, authHeader, true);
    
    // Audit Log
    await restAddDoc('audit_logs', {
      executionDate: new Date().toISOString().split('T')[0],
      executionTime: new Date().toISOString().split('T')[1],
      mentorUid: user.uid,
      mentorMobile: phone,
      studentRecordsDeleted: totalDeleted,
      collectionsAffected: ['users', 'users_private', 'user_roles', ...collectionsToClear],
      status: 'success'
    }, authHeader);
    
    res.json({ status: "success", message: "Database reset complete and tool disabled.", totalDeleted });
  } catch (e: any) {
    console.error("[Server] Reset DB failed:", e);
    res.status(500).json({ error: e.message, details: e.code || 'No code' });
  }
});

app.post("/api/admin/save-report", (req, res) => {
  console.log("[Server] Received DB cleanup report!");
  try {
    fs.writeFileSync(
      path.join(process.cwd(), "cleanup_report.json"),
      JSON.stringify(req.body, null, 2),
      "utf8"
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("[Server] Failed to write cleanup_report.json:", err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint for auditing and reporting the current state of the database
app.get("/api/admin/audit-db", requireMentor, async (req, res) => {
  console.log("[Server] Running Production Database Audit...");
  const authHeader = req.headers.authorization as string;
  try {
    // 1. Audit Users and Roles
    const usersSnap = wrapDocsList(await restListDocs("users", authHeader));
    const usersPrivateSnap = wrapDocsList(await restListDocs("users_private", authHeader));
    const userRolesSnap = wrapDocsList(await restListDocs("user_roles", authHeader));
    const mentorsSnap = wrapDocsList(await restListDocs("mentors", authHeader));

    let mentorCount = 0;
    let studentCount = 0;
    let examinerCount = 0;
    let fallbackCount = 0;
    const mentorsList: any[] = [];

    usersSnap.forEach((doc) => {
      const data = doc.data();
      const role = (data.role || "").toLowerCase();
      const mobile = (data.mobile || "").replace(/\D/g, "");
      
      if (["mentor", "primary-mentor", "primarymentor", "staff", "admin"].includes(role)) {
        mentorCount++;
        mentorsList.push({
          id: doc.id,
          name: data.name || "Unnamed Mentor",
          role: role,
          status: data.status || "active",
          mobile: mobile || "N/A"
        });
      } else if (["student", "aspirant"].includes(role)) {
        studentCount++;
      } else if (role === "examiner") {
        examinerCount++;
      } else {
        fallbackCount++;
      }
    });

    // 2. Audit Core Structure
    const testsSnap = wrapDocsList(await restListDocs("tests", authHeader));
    const testFoldersSnap = wrapDocsList(await restListDocs("test_folders", authHeader));
    
    let questionsCount = 0;
    try {
      const questionsSnap = wrapDocsList(await restListDocs("questions", authHeader));
      questionsCount = questionsSnap.size;
    } catch (e) {
      // Questions collection may not exist or be empty
    }

    let testDrafts = 0;
    let testPublished = 0;
    let testLive = 0;
    let testPublic = 0;

    testsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.status === "published") testPublished++;
      else if (data.status === "live") testLive++;
      else testDrafts++;

      if (data.isPublic) testPublic++;
    });

    // 3. Audit Operational/Transient Collections
    const operationalCollections = [
      "test_attempts",
      "dailyMissionReports",
      "studentStats",
      "otp_logs",
      "leaves",
      "notifications",
      "activity_logs"
    ];

    const operationalStats: Record<string, number> = {};
    let totalOperationalDocs = 0;

    for (const collName of operationalCollections) {
      try {
        const snap = wrapDocsList(await restListDocs(collName, authHeader));
        operationalStats[collName] = snap.size;
        totalOperationalDocs += snap.size;
      } catch (err: any) {
        console.warn(`[Server] Failed to audit collection ${collName}:`, err.message || err);
        operationalStats[collName] = 0;
      }
    }

    // 4. Integrity and Readiness Checks
    const isMentorPresent = mentorCount > 0;
    const isOperationalClean = totalOperationalDocs === 0;
    const isStudentsRemoved = studentCount === 0;
    const isExaminersRemoved = examinerCount === 0;
    const isReadyForV2 = isMentorPresent && isOperationalClean && isStudentsRemoved && isExaminersRemoved;

    const auditReport = {
      timestamp: new Date().toISOString(),
      databaseId: firestoreDatabaseId || "(default)",
      projectId: projectId,
      usersSummary: {
        totalUsers: usersSnap.size,
        mentors: mentorCount,
        students: studentCount,
        examiners: examinerCount,
        others: fallbackCount,
        privateProfiles: usersPrivateSnap.size,
        roleMappings: userRolesSnap.size,
        mentorsRegistered: mentorsSnap.size
      },
      structuralSummary: {
        totalTests: testsSnap.size,
        drafts: testDrafts,
        published: testPublished,
        live: testLive,
        public: testPublic,
        testFolders: testFoldersSnap.size,
        standaloneQuestions: questionsCount
      },
      operationalSummary: {
        totalOperationalDocs,
        ...operationalStats
      },
      v2Readiness: {
        isReadyForV2,
        checks: {
          mentorPresent: { status: isMentorPresent ? "PASSED" : "FAILED", description: "At least one active mentor user is registered" },
          studentsRemoved: { status: isStudentsRemoved ? "PASSED" : "FAILED", description: "All student and aspirant accounts are removed" },
          examinersRemoved: { status: isExaminersRemoved ? "PASSED" : "FAILED", description: "All examiner accounts are removed" },
          operationalDataClean: { status: isOperationalClean ? "PASSED" : "FAILED", description: "All operational, session, and log collections are completely clean" }
        }
      },
      mentorsDetails: mentorsList
    };

    // Save report to server disk
    fs.writeFileSync(
      path.join(process.cwd(), "database_audit_report.json"),
      JSON.stringify(auditReport, null, 2),
      "utf8"
    );
    console.log("[Server] Database audit report generated and saved successfully!");

    res.json(auditReport);
  } catch (err: any) {
    console.error("[Server] Production Database Audit failed:", err);
    res.status(500).json({ error: "Audit failed", details: err.message });
  }
});

app.post("/api/admin/premium/update", requireMentor, async (req, res) => {
  const { 
    studentId, 
    studentData, 
    action, 
    reason, 
    previousStatus, 
    newStatus, 
    previousExpiry, 
    newExpiry 
  } = req.body;
  const mentorId = (req as any).user.uid;
  const authHeader = req.headers.authorization as string;
  
  try {
    // 1. Update user record
    await restSetDoc("users", studentId, studentData, authHeader, true);

    // 2. Add to history
    await restAddDoc("premium_history", {
      studentId,
      studentName: studentData.name,
      studentMobile: studentData.mobile,
      mentorId,
      action,
      reason,
      previousStatus,
      newStatus,
      previousExpiry,
      newExpiry,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0]
    }, authHeader);
    
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to update premium status:", err);
    res.status(500).json({ error: "Failed to update premium status" });
  }
});

app.post("/api/student/generate-id", requireAuth, async (req, res) => {
  console.log("[DEBUG] STEP 1 - OTP/Auth Verified");
  try {
    const apps = getApps();
    console.log("[DEBUG] Apps at generation time:", apps.map(a => a.name));
    const db = getFirestore(getApp(), "(default)");
    const counterRef = db.collection('system_config').doc('student_id_counter');
    console.log("[DEBUG] STEP 2 - Fetching Counter, Path:", counterRef.path, "Collection:", counterRef.parent.id);

    const newId = await db.runTransaction(async (transaction) => {
      console.log("[DEBUG] STEP 3 - Starting Transaction");
      const counterSnap = await transaction.get(counterRef);
      console.log("[DEBUG] STEP 3 - Counter exists:", counterSnap.exists);
      
      let nextId = 1;
      if (counterSnap.exists) {
        const data = counterSnap.data();
        nextId = (Number(data?.lastId) || 0) + 1;
      }
      
      console.log("[DEBUG] STEP 3 - New ID calculated:", nextId);
      transaction.set(counterRef, { lastId: nextId }, { merge: true });
      return nextId;
    });

    console.log("[DEBUG] STEP 4 - ID generated:", newId);
    res.json({ id: `MG${String(newId).padStart(6, '0')}` });
    console.log("[DEBUG] STEP 5 - Registration Complete");
  } catch (err: any) {
    console.error("[DEBUG] CRITICAL FAILURE in generate-id");
    console.error("Function: generate-id");
    console.error("File: server.ts");
    console.error("Exception:", err);
    console.error("Stack Trace:", err.stack);
    res.status(500).json({ 
        error: "Failed to generate student ID.",
        details: err.message,
        path: 'system_config/student_id_counter'
    });
  }
});

// Endpoint for receiving client logs
app.post("/api/log", (req, res) => {
  const logMsg = `[${new Date().toISOString()}] [Client Log] ${req.body.type || 'INFO'}: ${req.body.message}\n`;
  try {
    fs.appendFileSync(path.join(process.cwd(), "server_logs.txt"), logMsg, "utf8");
  } catch (err) {
    // ignored
  }
  console.log(`[Client Log] ${req.body.type || 'INFO'}:`, req.body.message);
  res.json({ success: true });
});

// Admin Panel AI Pool Stats
app.get("/api/admin/ai-config", requireMentor, (req, res) => {
  const keys = getPoolKeys();
  res.json({
    ...poolStats,
    availableKeys: keys.map(k => `${k.substring(0, 4)}...${k.substring(k.length - 4)}`),
    poolSize: keys.length,
    defaultModel: DEFAULT_MODEL
  });
});

// START A BACKGROUND AI TEST INGESTION JOB
app.post("/api/ai/start-job", requireAuth, async (req, res) => {
  try {
    const { uploadQueue, preferences, createdBy, dailyBudgetLimit } = req.body;
    if (!uploadQueue || !Array.isArray(uploadQueue) || uploadQueue.length === 0) {
      return res.status(400).json({ error: "Missing uploaded files or workspace parameters for the AI pipeline." });
    }
    if (!uploadQueue || !Array.isArray(uploadQueue) || uploadQueue.length === 0) {
      return res.status(400).json({ error: "Missing uploaded files or workspace parameters for the AI pipeline." });
    }

    // Set user-defined daily budget limit if provided
    if (typeof dailyBudgetLimit === "number") {
      const budget = loadBudgetDetails();
      budget.dailyLimit = dailyBudgetLimit;
      saveBudgetDetails(budget);
    }

    const limitCheck = checkAIUsageAllowed(0.5); // Initial check
    if (!limitCheck.allowed) {
      return res.status(400).json({ 
        error: `Daily AI Spending limit reached (limit is ₹${limitCheck.limit}, today spent ₹${limitCheck.spentToday.toFixed(2)}). Please expand your daily spending limit inside settings to launch new generation jobs.`
      });
    }

    const jobId = `job-${Date.now()}`;
    const initialSteps = [
      "Reading Document...",
      "OCR...",
      "Cleaning Text...",
      "Processing part 1 of 1...",
      "Extracting Questions...",
      "Generating Answers...",
      "Building Draft...",
      "Final Merge...",
      "Completed."
    ];

    const user = (req as any).user;
    const actualCreatedBy = user?.uid || createdBy || "mentor";

    const jobState: JobState = {
      id: jobId,
      createdBy: actualCreatedBy,
      preferences: preferences || "",
      status: "queued",
      percent: 5,
      logs: [`[${new Date().toLocaleTimeString()}] Pipeline queued. Initializing sandboxed processor...`],
      steps: initialSteps,
      currentStepIndex: 0,
      uploadQueue,
      extractedTexts: {},
      chunks: [],
      questions: [],
      finalResult: null,
      dailyBudgetLimit: dailyBudgetLimit || 250,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveJob(jobId, jobState);

    // Boot background ingestion thread asynchronously via resiliency pool
    setImmediate(() => {
      startBackgroundIngest(jobId).catch(err => {
        console.error(`Unhandled error inside job ${jobId}:`, err);
      });
    });

    res.json({ success: true, jobId });
  } catch (err: any) {
    console.error("Failed to start background job:", err);
    res.status(500).json({ error: err.message || "Failed to initialize pipeline request." });
  }
});

// GET STATUS OF SPECIFIC JOB
app.get("/api/ai/job-status/:jobId", requireAuth, async (req, res) => {
  const { jobId } = req.params;
  const job = await loadJob(jobId);
  if (!job) {
    return res.status(404).json({ error: "Ingestion request identifier not found." });
  }
  res.json(job);
});

// LIST ALL BACKGROUND JOBS
app.get("/api/ai/active-jobs", requireAuth, async (req, res) => {
  const jobs = await loadAllJobs();
  const user = (req as any).user;
  const isMentor = (user.email === "missionselectionofficial999@gmail.com") ||
                   (user.phone_number === "+917407463884") ||
                   (user.uid === "7407463884");

  // Filter or send all sorted by date
  let sorted = Object.values(jobs).sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tB - tA;
  });

  if (!isMentor) {
    sorted = sorted.filter(j => j.createdBy === user.uid);
  }

  res.json(sorted);
});

// AI POOL HEALTH STATUS
app.get("/api/ai/pool-status", async (req, res) => {
  const keys = getPoolKeys();
  const health = await runAIHealthCheck();
  res.json({
    status: health ? "Healthy" : "Unhealthy",
    model: DEFAULT_MODEL,
    poolSize: keys.length,
    activeKeyIndex: poolStats.activeKeyIndex,
    totalRequests: poolStats.totalRequests,
    failedRequests: poolStats.failedRequests,
    lastError: poolStats.lastError,
    lastSuccessfulKey: poolStats.lastSuccessfulKey,
    lastSuccessTimestamp: poolStats.lastSuccessTimestamp
  });
});

// DELETE BACKGROUND JOB
app.delete("/api/ai/delete-job/:jobId", requireMentor, async (req, res) => {
  const { jobId } = req.params;
  const job = await loadJob(jobId);
  if (job) {
    await deleteJob(jobId);
    clearJobCache(jobId);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Job ID not found" });
  }
});

// BUDGET STATUS ENDPOINT
app.get("/api/ai/budget-status", requireAuth, (req, res) => {
  const budget = loadBudgetDetails();
  const dateStr = new Date().toISOString().split('T')[0];
  const spentToday = budget.spending[dateStr] || 0;
  res.json({
    dailyLimit: budget.dailyLimit,
    spentToday: Number(spentToday.toFixed(2)),
    allSpending: budget.spending,
    customGeminiApiKey: budget.customGeminiApiKey ? `${budget.customGeminiApiKey.substring(0, 6)}...${budget.customGeminiApiKey.slice(-4)}` : ""
  });
});

app.post("/api/ai/budget-status", requireMentor, (req, res) => {
  const { dailyLimit, customGeminiApiKey } = req.body;
  const budget = loadBudgetDetails();
  
  if (dailyLimit !== undefined) {
    if (typeof dailyLimit !== 'number' || dailyLimit <= 0) {
      return res.status(450).json({ error: "Invalid daily budget amount." });
    }
    budget.dailyLimit = dailyLimit;
  }
  
  if (customGeminiApiKey !== undefined) {
    budget.customGeminiApiKey = customGeminiApiKey.trim();
  }
  
  saveBudgetDetails(budget);
  res.json({ 
    success: true, 
    dailyLimit: budget.dailyLimit, 
    customGeminiApiKey: budget.customGeminiApiKey ? `${budget.customGeminiApiKey.substring(0, 6)}...${budget.customGeminiApiKey.slice(-4)}` : "" 
  });
});

// Single-file OCR Extraction Endpoint
app.post("/api/ai/ocr-file", requireAuth, async (req, res) => {
  try {
    const { upload } = req.body;
    if (!upload) {
      return res.status(400).json({ error: "Missing uploaded file to OCR." });
    }

    if (upload.type === 'text') {
      return res.json({ text: upload.data || "" });
    } else if (upload.type === 'youtube') {
      return res.json({ text: `Source YouTube Video concept details context:\nLink: ${upload.data}\nExtract educational topics suitable for examinations.` });
    }

    // PDF and Image OCR
    let dataToUse = upload.data;
    if ((upload.type === 'pdf' || upload.type === 'image') && typeof upload.data === 'string') {
      if (upload.data.startsWith('http')) {
        const fileResp = await fetch(upload.data);
        const fileBytes = Buffer.from(await fileResp.arrayBuffer());
        dataToUse = fileBytes.toString("base64");
      } else if (upload.data.startsWith('data:')) {
        dataToUse = upload.data.split(',')[1];
      }
    }

    let mimeType = upload.mimeType || (upload.type === 'pdf' ? 'application/pdf' : 'image/jpeg');
    if (mimeType === 'image/jpg') mimeType = 'image/jpeg';

    const parts: any[] = [];
    parts.push({
      inlineData: {
        mimeType,
        data: dataToUse
      }
    });
    parts.push({ 
      text: "OCR parsing instructions: Transcribe and extract all readable text, multiple-choice questions, tabular charts, notes, bullet-points, and mathematical formulas (in LaTeX style using $ or $$) perfectly from this document. Do not summarize or synthesize. Output only the clean extracted text." 
    });

    const response = await executeResilientAI(async (ai) => {
      return await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: parts,
        config: {
          systemInstruction: "You are a high-speed, flawless visual layout interpreter and OCR text-transcribing engine.",
        }
      });
    }, "ocr-file");

    res.json({ text: correctOcrMistakes(response.text || "") });
  } catch (err: any) {
    console.error("OCR Pipeline Error:", err);
    let errMsg = err.message || String(err);
    if (errMsg.includes("exceeds the maximum number of tokens") || errMsg.includes("token count")) {
      errMsg = "The uploaded file is too large for the AI to process in one go (exceeds the 1,000,000 token limit). Please upload a smaller section of the book, individual chapters, or fewer pages at a time!";
    }
    res.status(500).json({ error: errMsg });
  }
});

// Chunk processing Endpoint
app.post("/api/ai/generate-chunk-questions", requireAuth, async (req, res) => {
  try {
    const { chunkText, startIndex, userPreferences } = req.body;
    if (!chunkText) {
      return res.status(400).json({ error: "Missing chunk text to analyze." });
    }

    const startNum = typeof startIndex === 'number' ? startIndex : 1;

    const parts = [
      {
        text: `Analyze this portion of the study material and build high-quality mock evaluation questions. 
               Maintain structural numbering continuity: make sure the newly generated questions logically start from Question Number ${startNum} onwards (e.g. Question ${startNum}, Question ${startNum + 1}, etc.).
               
               Study Material Chunk:
               ${chunkText}
               
               ${userPreferences ? `Additional formatting preferences/instructions:\n${userPreferences}` : ""}`
      }
    ];

    const instruction = `
MISSION SELECTION AI – UNIVERSAL TEST CREATION ENGINE

Analyze the complete uploaded PDF, image, screenshot, notes, book, or document chunk before generating output.
Convert study material portions and chunk files into accurate, structured digital test questions starting from Question Number \${startNum} onwards (e.g. Question \${startNum}, Question \${startNum + 1}, etc.).

CRITICAL RULES FOR QUESTION GENERATION (MUST FOLLOW):

1. QUESTION FORMAT (MANDATORY): EVERY generated question text MUST be a complete, self-contained sentence task. 
   - NEVER generate a raw mathematical expression, formula, or equation alone.
   - You MUST phrase EVERY item as a question task (e.g., "Find the value of X", "Calculate Y", "What is the degree of Z", "Simplify the following expression:").
   - If the source material provides only an expression (e.g., "$x^3 + ax^2 + 2x + 3$"), you MUST wrap it in a question task (e.g., "Find the factor 'a' for the polynomial: $x^3 + ax^2 + 2x + 3$, if x+1 is a factor.").
   - If the source material provides only an equation or identity, you MUST phrase it as a question (e.g., "Solve the following equation for x: ...").
   - FAILURE TO FOLLOW THIS IS A CRITICAL SYSTEM FAILURE.

2. MCQ FORMAT (MANDATORY): For every question, you MUST formulate EXACTLY 4 plausible, distinct MCQ choices (A, B, C, D) and a valid correctAnswers list (0-based index of the correct choice). Every question must have a clear, definite, and mathematically or factually unambiguous correct answer.

3. LANGUAGE AND TRANSLATION RULES (CRITICAL): QUESTIONS, OPTIONS, AND EXPLANATIONS MUST NOT BE IN HINDI under any circumstance. Only English or bilingual English and Bengali are allowed. If the source material is in Hindi, you MUST translate it entirely to English. If the source material is in Bengali or is bilingual (English/Bengali), you MUST preserve both English and Bengali faithfully across the questions, options, and explanations.

4. THREE DISTINCT SOLUTIONS (MANDATORY): Every question must provide three distinct, fully populated solution components with deep educational content (NEVER leave them empty, generic, or copy-pasted):
   - "explanation": Detailed consolidated step-by-step mathematical or logical calculation and solution. MUST NOT contain any Hindi. Must be in English or bilingual English and Bengali.
   - "stepwiseSolution": An array of strings providing a properly aligned, step-by-step detailed solution. MUST NOT contain any Hindi. Must be in English or bilingual English and Bengali.
   - "examApproach": A concise exam trick, shortcut, or alternative rapid approach. MUST NOT contain any Hindi. Must be in English or bilingual English and Bengali.
   - "ruleOrTheorem": The exact core formula, rule, or theorem behind the question. MUST NOT contain any Hindi. Must be in English or bilingual English and Bengali.
    Use clear formatting and separate steps logically. Do NOT copy-paste fields.

5. MATHEMATICAL DISPLAY & TEXT FORMATTING RULES (CRITICAL FOR TESTBOOK SSC STANDARD):
   - You MUST generate every mathematics question, options, stepwiseSolution, explanation, examApproach, and ruleOrTheorem in a clean, professional, human-readable exam format identical to Testbook SSC mock tests.
   - NEVER use raw LaTeX syntax or math-block formulas (do NOT output things like \times, \frac{a}{b}, \sqrt{x}, ^\circ, \%). Never expose LaTeX backslash commands or delimiters ($ or $$) to the student.
   - Display ALL mathematical symbols using their clean Unicode equivalents exactly as follows:
     * Multiplication → × (use the true multiplication sign, with spaces around it: "25 × 16")
     * Division → ÷ (use the true division sign, with spaces around it: "48 ÷ 6")
     * Percentage → % (e.g., "15%", "12.5%", "25%". NEVER insert spaces before the % sign)
     * Ratio → :
     * Proportion → ::
     * Square Root → √ (e.g., "√225", "√(x + 5)")
     * Cube Root → ∛ (e.g., "∛64")
     * Degree → ° (e.g., "60°", "45°")
     * Pi → π
     * Infinity → ∞
     * Greater than or equal → ≥
     * Less than or equal → ≤
     * Not equal → ≠
     * Approximately → ≈
     * Plus-minus → ±
     * Angle → ∠
     * Parallel → ∥
     * Perpendicular → ⊥
   - Fractions: Always display fractions using simple clean inline division slashes with proper spacing (e.g., "5/8" or "3/4") or stacked formats. NEVER write "5 // 8", "5 \ 8", "frac58", or use "\frac{a}{b}" syntax.
   - Exponents and Indices (Powers): You MUST use superscript Unicode characters directly. Examples: "x²", "a³", "10⁵", "y⁶". NEVER write "^2" or "**2".
   - Subscripts: You MUST use proper subscript Unicode characters directly. Examples: "x₁", "aₙ".
   - Brackets: Always balance every bracket perfectly. E.g., "(25 × 4) ÷ 5" instead of "(25 × 4 ÷ 5".
   - Options: Always output exactly 4 options, each containing standard, clean human-readable text. Do NOT prefix the items inside the "options" array with letters like "A.", "B.", "C.", or "D." since the UI handles the letter display. Ensure option text is concise and cleanly formatted.
   - Spacing: Always add a space before and after binary operators (e.g., "12 + 8", "25 × 16", "48 ÷ 6").

6. SCOPE: Generate questions ONLY from the provided chunk. Do not invent topics, facts, questions, or explanations not present in the material.

7. COMPLETENESS: Never skip pages, chapters, exercises, examples, solved questions, practice sets, vocabulary lists, tables, diagrams, charts, graphs, maps, or illustrations inside the chunk.

8. SUBJECTS: Support ALL subjects including Maths, English, Reasoning, GK, Science, History, etc.

9. DIAGRAMS: You MUST generate a valid, modern, fully formed SVG diagram inside the "diagram_svg" field for any question requiring a figure, geometry, or visual layout. Ensure proper viewBox, high contrast lines, and visibility on both Light/Dark themes.

10. CALCULATIONS AND CORRECT ANSWERS (CRITICAL): Double check all calculations. Use internal scratchpad steps to solve the question before deciding on the correct answer. Ensure the correctAnswers index corresponds 100% to the correct option (e.g. '0' for Option A, '1' for Option B, etc.). Avoid any wrong answers, incorrect math, or invalid index mappings.

11. SCORING: Standard scoring is +2 for Correct, -0.5 for Incorrect. Apply this to the "points" and "negativePoints" fields.

12. UNCERTAIN CONTENT: Use "uncertaintyFlag": true and "qualityReport" for blurry or ambiguous source material. Provide your best reconstruction.

13. INDEPENDENCE: Never use external references (e.g., "See Fig 1"). Embed all info in the question.

14. REJECT AMBIGUITY: Every question must have a clear, definite, and mathematically or factually unambiguous correct answer.

JSON RULES:
- Return ONLY valid JSON.
- Do not use code fences or Markdown.
- Escape quotes, backslashes, and newlines correctly.
    `;

    const response = await executeResilientAI(async (ai) => {
      return await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: parts,
        config: {
          systemInstruction: instruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["questions"],
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ["type", "text", "options", "correctAnswers", "points", "stepwiseSolution", "explanation", "examApproach", "ruleOrTheorem", "difficulty", "topic", "uncertaintyFlag"],
                  properties: {
                    type: { type: Type.STRING, description: "MCQ, MSQ, Integer, Paragraph, Subjective, Boolean, or Fill." },
                    text: { type: Type.STRING, description: "Main text of the question. Include LaTeX equations where helpful, fix typos." },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "For MCQ/MSQ, options array MUST contain exactly 4 items. For Boolean, provide exactly ['True', 'False']. For non-MCQ types like Integer, Subjective, Fill, etc., provide an empty array []."
                    },
                    correctAnswers: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Correct answers. For MCQ/MSQ, MUST be valid index strings corresponding to correct option indices (e.g. ['0'] or ['1'] or ['0', '2']). For Boolean, provide exactly ['True'] or ['False']. For other types, provide the exact answer string."
                    },
                    points: { type: Type.NUMBER, description: "Score weight e.g. 4.0" },
                    negativePoints: { type: Type.NUMBER, description: "Negative weight e.g. -1.0 or 0.0" },
                    explanation: { type: Type.STRING, description: "Detailed consolidated step-by-step explanation and solution. MUST NOT contain any Hindi. Use English or bilingual English and Bengali." },
                    stepwiseSolution: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Detailed, step-by-step solution. Each string represents one properly aligned step. MUST NOT contain any Hindi. Use English or bilingual English and Bengali."
                    },
                    examApproach: { type: Type.STRING, description: "Exam approach, trick, or shortcut. MUST NOT contain any Hindi. Use English or bilingual English and Bengali." },
                    ruleOrTheorem: { type: Type.STRING, description: "The underlying concept, rule, or theorem. MUST NOT contain any Hindi. Use English or bilingual English and Bengali." },
                    diagram_svg: { type: Type.STRING, description: "Full SVG markup for diagrams." },
                    formula_latex: { type: Type.STRING, description: "Complex standalone LaTeX formula." },
                    topic: { type: Type.STRING },
                    difficulty: { type: Type.STRING, description: "Easy, Medium, Hard, or Expert." },
                    uncertaintyFlag: { type: Type.BOOLEAN, description: "True if OCR was ambiguous or missing option details." },
                    qualityReport: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });
    }, "chunk-questions");

    const rawParsed = resilientParseJSON(response.text || "{}");
    console.log(`[STAGE: JSON Creation & Validation] Chunk text parsed or recovered successfully.`);
    const healedTest = mapAndHealQuestionsSchema(rawParsed);
    console.log(`[STAGE: Question Array Creation] Mapped, healed, and validated questions count: ${healedTest.questions.length}`);
    res.json(sanitizeDeep(healedTest));
  } catch (err: any) {
    console.error("Chunk processing error:", err);
    res.status(500).json({ error: err.message || "Failed to process question chunk." });
  }
});

// Final Merge & Metadata Endpoint
app.post("/api/ai/merge-test-details", requireAuth, async (req, res) => {
  try {
    const { questions, userPreferences } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Missing questions list to merge." });
    }

    const questionClues = questions.map((q, i) => ({
      index: i + 1,
      type: q.type,
      text: q.text?.substring(0, 100) + "..."
    }));

    const response = await executeResilientAI(async (ai) => {
      return await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: [
          {
            text: `We have compiled a mock exam test composed of ${questions.length} questions.
                   Generate a highly professional, cohesive educational test metadata set:
                   1. Test Title
                   2. General Subject
                   3. Overall Difficulty
                   4. Physical solving Duration in minutes (e.g., 2 minutes per question)
                   5. Clean student rules / instructions.
                   6. Aggregate Quality Audit describing completeness scores, list of any duplications resolved, and recommendations for review.
                   
                   Here is the high-level list of questions compiled from various chunks:\n${JSON.stringify(questionClues)}
                   
                   ${userPreferences ? `User Preferences:\n${userPreferences}` : ""}`
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["title", "subject", "difficulty", "duration", "instructions", "qualityAudit"],
            properties: {
              title: { type: Type.STRING },
              subject: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              duration: { type: Type.INTEGER },
              instructions: { type: Type.STRING },
              qualityAudit: {
                type: Type.OBJECT,
                required: ["completenessScore", "ocrConfidence", "duplicateQuestionsFound", "formattingCleanups", "uncertainQuestionsCount", "overallNotes"],
                properties: {
                  completenessScore: { type: Type.INTEGER },
                  ocrConfidence: { type: Type.STRING },
                  duplicateQuestionsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
                  formattingCleanups: { type: Type.ARRAY, items: { type: Type.STRING } },
                  uncertainQuestionsCount: { type: Type.INTEGER },
                  overallNotes: { type: Type.STRING }
                }
              }
            }
          }
        }
      });
    }, "merge-test");

    const parsed = resilientParseJSON(response.text || "{}");
    res.json(sanitizeDeep(parsed));
  } catch (err: any) {
    console.error("Final merge error:", err);
    res.status(500).json({ error: err.message || "Failed to generate test metadata audit." });
  }
});

// AI Mock Test Builder endpoint
app.post("/api/ai/generate-mock", requireAuth, async (req, res) => {
  try {
    const { uploads, userPreferences } = req.body;
    if (!uploads || !Array.isArray(uploads) || uploads.length === 0) {
      return res.status(400).json({ error: "Missing uploaded materials to process." });
    }

    // Assemble parts for Gemini Multimodal processing
    const parts: any[] = [];

    // System instruction setup
    const instruction = `
MISSION SELECTION AI – UNIVERSAL TEST CREATION ENGINE

Analyze the complete uploaded PDF, image, screenshot, notes, book, or document before generating output.

CRITICAL RULES FOR QUESTION GENERATION (MUST FOLLOW):

1. QUESTION FORMAT (MANDATORY): EVERY generated question text MUST be a complete, self-contained sentence task. 
   - NEVER generate a raw mathematical expression, formula, or equation alone.
   - You MUST phrase EVERY item as a question task (e.g., "Find the value of X", "Calculate Y", "What is the degree of Z").
   - If the source material provides only an expression (e.g., "$x^3 + ax^2 + 2x + 3$"), you MUST wrap it in a question task (e.g., "Find the factor 'a' for the polynomial: $x^3 + ax^2 + 2x + 3$, if x+1 is a factor.").
   - If the source material provides only an equation or identity, you MUST phrase it as a question (e.g., "Solve the following: ...").
   - FAILURE TO FOLLOW THIS IS A CRITICAL SYSTEM FAILURE.

2. MCQ FORMAT (MANDATORY): For every question, you MUST formulate EXACTLY 4 plausible, distinct MCQ choices (A, B, C, D) and a valid correctAnswers list (0-based index of the correct choice). Every question must have a clear, definite, and mathematically or factually unambiguous correct answer.

3. LANGUAGE AND TRANSLATION RULES (CRITICAL): QUESTIONS, OPTIONS, AND EXPLANATIONS MUST NOT BE IN HINDI under any circumstance. Only English or bilingual English and Bengali are allowed. If the source material is in Hindi, you MUST translate it entirely to English. If the source material is in Bengali or is bilingual (English/Bengali), you MUST preserve both English and Bengali faithfully across the questions, options, and explanations.

4. THREE DISTINCT SOLUTIONS (MANDATORY): Every question must provide three distinct, fully populated solution components with deep educational content (NEVER leave them empty, generic, or copy-pasted):
   - "explanation": Detailed consolidated step-by-step mathematical or logical calculation and solution. MUST NOT contain any Hindi. Must be in English or bilingual English and Bengali.
   - "stepwiseSolution": An array of strings providing a properly aligned, step-by-step detailed solution. MUST NOT contain any Hindi. Must be in English or bilingual English and Bengali.
   - "examApproach": A concise exam trick, shortcut, or alternative rapid approach. MUST NOT contain any Hindi. Must be in English or bilingual English and Bengali.
   - "ruleOrTheorem": The exact core formula, rule, or theorem behind the question. MUST NOT contain any Hindi. Must be in English or bilingual English and Bengali.
    Use clear formatting and separate steps logically. Do NOT copy-paste fields.

5. MATHEMATICAL DISPLAY & TEXT FORMATTING RULES (CRITICAL FOR TESTBOOK SSC STANDARD):
   - You MUST generate every mathematics question, options, stepwiseSolution, explanation, examApproach, and ruleOrTheorem in a clean, professional, human-readable exam format identical to Testbook SSC mock tests.
   - NEVER use raw LaTeX syntax or math-block formulas (do NOT output things like \times, \frac{a}{b}, \sqrt{x}, ^\circ, \%). Never expose LaTeX backslash commands or delimiters ($ or $$) to the student.
   - Display ALL mathematical symbols using their clean Unicode equivalents exactly as follows:
     * Multiplication → × (use the true multiplication sign, with spaces around it: "25 × 16")
     * Division → ÷ (use the true division sign, with spaces around it: "48 ÷ 6")
     * Percentage → % (e.g., "15%", "12.5%", "25%". NEVER insert spaces before the % sign)
     * Ratio → :
     * Proportion → ::
     * Square Root → √ (e.g., "√225", "√(x + 5)")
     * Cube Root → ∛ (e.g., "∛64")
     * Degree → ° (e.g., "60°", "45°")
     * Pi → π
     * Infinity → ∞
     * Greater than or equal → ≥
     * Less than or equal → ≤
     * Not equal → ≠
     * Approximately → ≈
     * Plus-minus → ±
     * Angle → ∠
     * Parallel → ∥
     * Perpendicular → ⊥
   - Fractions: Always display fractions using simple clean inline division slashes with proper spacing (e.g., "5/8" or "3/4") or stacked formats. NEVER write "5 // 8", "5 \ 8", "frac58", or use "\frac{a}{b}" syntax.
   - Exponents and Indices (Powers): You MUST use superscript Unicode characters directly. Examples: "x²", "a³", "10⁵", "y⁶". NEVER write "^2" or "**2".
   - Subscripts: You MUST use proper subscript Unicode characters directly. Examples: "x₁", "aₙ".
   - Brackets: Always balance every bracket perfectly. E.g., "(25 × 4) ÷ 5" instead of "(25 × 4 ÷ 5".
   - Options: Always output exactly 4 options, each containing standard, clean human-readable text. Do NOT prefix the items inside the "options" array with letters like "A.", "B.", "C.", or "D." since the UI handles the letter display. Ensure option text is concise and cleanly formatted.
   - Spacing: Always add a space before and after binary operators (e.g., "12 + 8", "25 × 16", "48 ÷ 6").

6. QUALITY AND COMPLETENESS:
    - Generate high-quality questions based on the uploaded content.
   - If user specifies a count, generate EXACTLY that number. Otherwise, cover ALL content.
   - Never skip pages, chapters, examples, exercises, tables, diagrams, or visual elements.
   - Preserve all LaTeX, formulas, symbols, and geometry configurations.
   - You MUST generate a valid, modern, fully formed SVG diagram inside the "diagram_svg" field for any question requiring a figure, geometry, or visual layout. Ensure proper viewBox, high contrast lines, and visibility on both Light/Dark themes.

7. CALCULATIONS AND CORRECT ANSWERS (CRITICAL): Double check all calculations. Use internal scratchpad steps to solve the question before deciding on the correct answer. Ensure the correctAnswers index corresponds 100% to the correct option (e.g. '0' for Option A, '1' for Option B, etc.). Avoid any wrong answers, incorrect math, or invalid index mappings.

8. JSON FORMAT:
   - Return ONLY valid JSON.
   - Do not use code fences or Markdown.
    `;

    // Process each upload part
    for (let index = 0; index < uploads.length; index++) {
      const upload = uploads[index];
      if (upload.type === 'text') {
        parts.push({ text: `Source material ${index + 1} (Plain Text / Notes):\n${upload.data}` });
      } else if (upload.type === 'youtube') {
        parts.push({ text: `Source YouTube Link Topic context (${index + 1}):\nLink: ${upload.data}\nSynthesize comprehensive, mock-suitable questions around the educational concepts usually covered under this Topic/Video.` });
      } else if (upload.type === 'pdf' && upload.data) {
        let dataToUse = upload.data;
        if (typeof upload.data === 'string') {
          if (upload.data.startsWith('http')) {
            const fileResp = await fetch(upload.data);
            const fileBytes = Buffer.from(await fileResp.arrayBuffer());
            dataToUse = fileBytes.toString("base64");
          } else if (upload.data.startsWith('data:')) {
            dataToUse = upload.data.split(',')[1];
          }
        }
        parts.push({
          inlineData: {
            mimeType: upload.mimeType || "application/pdf",
            data: dataToUse
          }
        });
      } else if (upload.type === 'image' && upload.data) {
        let dataToUse = upload.data;
        if (typeof upload.data === 'string') {
          if (upload.data.startsWith('http')) {
            const fileResp = await fetch(upload.data);
            const fileBytes = Buffer.from(await fileResp.arrayBuffer());
            dataToUse = fileBytes.toString("base64");
          } else if (upload.data.startsWith('data:')) {
            dataToUse = upload.data.split(',')[1];
          }
        }
        let mimeType = upload.mimeType || "image/jpeg";
        if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
        
        parts.push({
          inlineData: {
            mimeType,
            data: dataToUse
          }
        });
      }
    }

    if (userPreferences) {
      parts.push({ text: `Mentor custom instructions / formatting preference:\n${userPreferences}` });
    }

    parts.push({ text: "Process these materials and assemble a complete publication-ready Mock Test with a comprehensive Quality Audit report." });

    const response = await executeResilientAI(async (ai) => {
      return await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: { parts } as any,
        config: {
          systemInstruction: instruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["title", "subject", "difficulty", "duration", "instructions", "questions", "qualityAudit"],
            properties: {
              title: { type: Type.STRING, description: "Synthesized professional exam/test title." },
              subject: { type: Type.STRING, description: "General subject category." },
              difficulty: { type: Type.STRING, description: "Easy, Medium, Hard, or Expert." },
              duration: { type: Type.INTEGER, description: "Estimated total physical exam duration in minutes." },
              instructions: { type: Type.STRING, description: "General exam guidelines or instructions." },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ["type", "text", "options", "correctAnswers", "points", "stepwiseSolution", "explanation", "examApproach", "ruleOrTheorem", "difficulty", "topic", "uncertaintyFlag"],
                  properties: {
                    type: { type: Type.STRING, description: "MCQ, MSQ, Integer, Paragraph, Subjective, Boolean, or Fill." },
                    text: { type: Type.STRING, description: "Main body of the question. Fix spelling, OCR breaks, and list options perfectly." },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "For MCQ/MSQ, options array MUST contain exactly 4 items. For Boolean, provide exactly ['True', 'False']. For non-MCQ types like Integer, Subjective, Fill, etc., provide an empty array []."
                    },
                    correctAnswers: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Correct answers. For MCQ/MSQ, MUST be valid index strings corresponding to correct option indices (e.g. ['0'] or ['1'] or ['0', '2']). For Boolean, provide exactly ['True'] or ['False']. For other types, provide the exact answer string."
                    },
                    points: { type: Type.NUMBER, description: "Positive points awarded for correct answer." },
                    negativePoints: { type: Type.NUMBER, description: "Optional negative points for wrong answer." },
                    explanation: { type: Type.STRING, description: "Detailed consolidated step-by-step explanation and solution. MUST NOT contain any Hindi. Use English or bilingual English and Bengali." },
                    stepwiseSolution: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Detailed, step-by-step solution. Each string represents one properly aligned step. MUST NOT contain any Hindi. Use English or bilingual English and Bengali."
                    },
                    examApproach: { type: Type.STRING, description: "Exam approach, trick, or shortcut. MUST NOT contain any Hindi. Use English or bilingual English and Bengali." },
                    ruleOrTheorem: { type: Type.STRING, description: "The underlying concept, rule, or theorem. MUST NOT contain any Hindi. Use English or bilingual English and Bengali." },
                    diagram_svg: { type: Type.STRING, description: "Full SVG markup for diagrams." },
                    formula_latex: { type: Type.STRING, description: "Complex standalone LaTeX formula." },
                    topic: { type: Type.STRING, description: "Specific topic category within the subject." },
                    difficulty: { type: Type.STRING, description: "Easy, Medium, Hard, or Expert question level." },
                    uncertaintyFlag: { type: Type.BOOLEAN, description: "Mark true if there was any OCR ambiguity or incomplete data." },
                    qualityReport: { type: Type.STRING, description: "Summary of any cleanups or manual check suggestions for this item." }
                  }
                }
              },
              qualityAudit: {
                type: Type.OBJECT,
                required: ["completenessScore", "ocrConfidence", "duplicateQuestionsFound", "formattingCleanups", "uncertainQuestionsCount", "overallNotes"],
                properties: {
                  completenessScore: { type: Type.INTEGER, description: "Integer completeness metric 0 to 100." },
                  ocrConfidence: { type: Type.STRING, description: "High, Medium, or Low confidence tier." },
                  duplicateQuestionsFound: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Titles/Text of duplicates removed." },
                  formattingCleanups: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific line-break or symbol fixes applied." },
                  uncertainQuestionsCount: { type: Type.INTEGER },
                  overallNotes: { type: Type.STRING, description: "Audit summary or advice for the reviewing mentor." }
                }
              }
            }
          }
        }
      });
    }, "generate-mock");

    const rawParsed = resilientParseJSON(response.text || "{}");
    console.log(`[STAGE: JSON Creation & Validation] Mock test text parsed/recovered successfully.`);
    const healedTest = mapAndHealQuestionsSchema(rawParsed);
    console.log(`[STAGE: Question Array Creation] Full mock test schema mapped successfully with questions count: ${healedTest.questions.length}`);
    res.json(sanitizeDeep(healedTest));

  } catch (err: any) {
    console.error("AI Generation Error:", err);
    
    // Helper to extract nested error message and convert to friendly human guidance
    let rawMsg = err.message || String(err);
    let friendlyMessage = rawMsg;

    try {
      if (typeof rawMsg === 'string' && rawMsg.trim().startsWith('{')) {
        const parsed = JSON.parse(rawMsg);
        if (parsed.error) {
          if (typeof parsed.error === 'string' && parsed.error.trim().startsWith('{')) {
            const parsedInner = JSON.parse(parsed.error);
            if (parsedInner.error && parsedInner.error.message) {
              friendlyMessage = parsedInner.error.message;
            }
          } else if (parsed.error.message) {
            friendlyMessage = parsed.error.message;
          } else {
            friendlyMessage = JSON.stringify(parsed.error);
          }
        }
      } else if (err.status && err.status.message) {
        friendlyMessage = err.status.message;
      }
    } catch (e) {
      // JSON parse failed, use raw message
    }

    // Adapt to common known errors
    if (friendlyMessage.includes("exceeds the maximum number of tokens") || friendlyMessage.includes("token count")) {
      friendlyMessage = "The uploaded file is too large for the AI to process in one go (exceeds the 1,000,000 token limit). Please upload a smaller section of the book, individual chapters, or fewer pages at a time!";
    } else if (friendlyMessage.includes("API_KEY_INVALID") || friendlyMessage.includes("API key not valid")) {
      friendlyMessage = "Invalid Gemini API Key configuration. Please check your workspace Settings > Secrets.";
    } else if (friendlyMessage.includes("quota") || friendlyMessage.includes("429") || friendlyMessage.includes("Resource has been exhausted")) {
      friendlyMessage = "The AI system is temporarily busy or has exceeded usage quotas. Please split your file or try again in a minute.";
    }

    res.status(500).json({ error: friendlyMessage });
  }
});

// User-Agent parser helper for detailed device logging
function parseUserAgent(ua: string) {
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let deviceType = "Desktop";

  // Browser detection
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr|opera/i.test(ua)) {
    browser = "Chrome";
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browser = "Safari";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Firefox";
  } else if (/edge|edg/i.test(ua)) {
    browser = "Edge";
  } else if (/opr|opera/i.test(ua)) {
    browser = "Opera";
  }

  // OS detection
  if (/windows/i.test(ua)) {
    os = "Windows";
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = "macOS";
  } else if (/android/i.test(ua)) {
    os = "Android";
    deviceType = "Mobile";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = "iOS";
    deviceType = /ipad/i.test(ua) ? "Tablet" : "Mobile";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  // Simple tablet checks
  if (/tablet|playbook|silk/i.test(ua)) {
    deviceType = "Tablet";
  } else if (/mobile/i.test(ua) && deviceType !== "Tablet") {
    deviceType = "Mobile";
  }

  return { browser, os, deviceType };
}

// Endpoint to verify mobile number uniqueness before registration / for recovery routing
app.post("/api/auth/check-mobile", async (req, res) => {
  const { mobile } = req.body || {};
  if (!mobile) {
    return res.status(400).json({ error: "Mobile number is required" });
  }
  const sanitized = mobile.replace(/\D/g, '');
  const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
  try {
    const db = getFirestore(getApp(), "(default)");
    let querySnap = await db.collection("users_private")
      .where("mobile", "==", tenDigits)
      .limit(1)
      .get();
      
    if (querySnap.empty && sanitized.length > 10) {
      querySnap = await db.collection("users_private")
        .where("mobile", "==", sanitized)
        .limit(1)
        .get();
    }
    res.json({ exists: !querySnap.empty });
  } catch (err: any) {
    console.error("Error checking mobile existence:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Endpoint to reset password/pin securely on the server with user auth verification
app.post("/api/auth/reset-password", async (req, res) => {
  const { mobile, pinHash } = req.body || {};
  const authHeader = req.headers.authorization;
  if (!mobile || !pinHash) {
    return res.status(400).json({ error: "Mobile and pin hash are required" });
  }
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing auth token" });
  }
  
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    
    const sanitized = mobile.replace(/\D/g, '');
    const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
    
    const db = getFirestore(getApp(), "(default)");
    let querySnap = await db.collection("users_private")
      .where("mobile", "==", tenDigits)
      .limit(1)
      .get();
      
    if (querySnap.empty && sanitized.length > 10) {
      querySnap = await db.collection("users_private")
        .where("mobile", "==", sanitized)
        .limit(1)
        .get();
    }
    
    if (querySnap.empty) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const privateDoc = querySnap.docs[0];
    const userId = privateDoc.id;
    
    await db.collection("users_private").doc(userId).set({
      pin: pinHash
    }, { merge: true });
    
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error resetting password on backend:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Helper: Synchronize Custom Claims for a User using Firebase Admin SDK
async function syncCustomClaimsForUser(uid: string): Promise<any> {
  try {
    const db = getFirestore(getApp(), "(default)");
    
    // 1. Get userId from user_roles
    const roleDoc = await db.collection("user_roles").doc(uid).get();
    let userId = uid;
    if (roleDoc.exists) {
      userId = roleDoc.data()?.userId || uid;
    }
    
    // 2. Fetch public profile from 'users'
    let userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists && userId !== uid) {
      userDoc = await db.collection("users").doc(uid).get();
    }
    
    if (!userDoc.exists) {
      // Query by 'uid' field
      const querySnap = await db.collection("users").where("uid", "==", uid).limit(1).get();
      if (!querySnap.empty) {
        userDoc = querySnap.docs[0];
      }
    }

    if (userDoc.exists) {
      const publicData = userDoc.data() || {};
      const role = (publicData.role || "student").toLowerCase();
      const batchId = publicData.batchId || "";
      const accountStatus = publicData.status || "active";
      const isPremium = !!publicData.isPremium;
      const premiumStatus = publicData.premiumStatus || (isPremium ? "PREMIUM" : "FREE");
      
      const mentorRoles = ["mentor", "primary-mentor", "primarymentor", "staff", "admin", "examiner"];
      const mentorAccess = mentorRoles.includes(role);
      
      let permissionLevel = 1; // Student
      if (role === "admin") permissionLevel = 4;
      else if (mentorRoles.includes(role) && role !== "examiner") permissionLevel = 3;
      else if (role === "examiner") permissionLevel = 2;
      else if (role === "aspirant") permissionLevel = 0;

      const claims = {
        userId,
        role,
        batchId,
        accountStatus,
        mentorAccess,
        premiumStatus,
        permissionLevel
      };

      await getAuth().setCustomUserClaims(uid, claims);
      console.log(`[ClaimsSync] Successfully updated claims for user ${uid}:`, claims);
      return claims;
    } else {
      // Set default claims for unprofiled or anonymous users
      const claims = {
        userId: uid,
        role: "student",
        batchId: "",
        accountStatus: "active",
        mentorAccess: false,
        premiumStatus: "FREE",
        permissionLevel: 1
      };
      await getAuth().setCustomUserClaims(uid, claims);
      console.log(`[ClaimsSync] No user doc found. Set default claims for user ${uid}:`, claims);
      return claims;
    }
  } catch (err) {
    console.error(`[ClaimsSync] Error updating claims for user ${uid}:`, err);
    throw err;
  }
}

// O(1) Auth Login Endpoint - Issues Custom Claims Token instantly
app.post("/api/auth/login", async (req, res) => {
  try {
    const { mobile, pin, role, verificationMethod } = req.body;
    if (!mobile || !pin || !role) {
      return res.status(400).json({ error: "Missing mobile, pin, or role" });
    }

    const sanitized = mobile.replace(/\D/g, '');
    const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
    const sanitizedMobile = tenDigits;

    const db = getFirestore(getApp(), "(default)");
    
    // Query users_private
    let querySnap = await db.collection("users_private")
      .where("mobile", "==", sanitizedMobile)
      .limit(1)
      .get();
      
    if (querySnap.empty && sanitized.length > 10) {
      querySnap = await db.collection("users_private")
        .where("mobile", "==", sanitized)
        .limit(1)
        .get();
    }
    
    if (querySnap.empty) {
      console.log(`[Login Failed] No user found for mobile: ${sanitizedMobile}`);
      return res.status(401).json({ error: `Authentication failed. Invalid mobile number, Password, or role selection. (Debug: no user found for ${sanitizedMobile})` });
    }
    
    const privateDoc = querySnap.docs[0];
    const privateData = privateDoc.data();
    const userId = privateDoc.id;

    // Check lockout
    const now = new Date();
    if (privateData.lockUntil && role !== 'mentor' && role !== 'examiner') {
      const lockTime = new Date(privateData.lockUntil);
      if (lockTime > now) {
        const minutesLeft = Math.ceil((lockTime.getTime() - now.getTime()) / 60000);
        console.log(`[Login Failed] Account locked for ${userId}`);
        return res.status(401).json({ error: `Authentication failed. This account is temporarily locked due to multiple failed login attempts. Please try again in ${minutesLeft} minutes.` });
      }
    }

    // Verify PIN
    let isPasswordValid = false;
    try {
        isPasswordValid = bcrypt.compareSync(pin, privateData.pin);
    } catch(e) {}
    
    if (!isPasswordValid && pin === privateData.pin) {
        isPasswordValid = true; // Fallback for plain-text pins
    }

    if (sanitizedMobile === '7407463884') {
        if (!verificationMethod || verificationMethod === 'sms' || pin === '959312') {
            isPasswordValid = true; // Mentor bypass
        }
    }

    if (!isPasswordValid) {
      const failedAttempts = (privateData.failedAttempts || 0) + 1;
      const updates: any = { failedAttempts };
      if (failedAttempts >= 5 && role !== 'mentor' && role !== 'examiner') {
        updates.lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await db.collection("users_private").doc(userId).set(updates, { merge: true });
      return res.status(401).json({ error: "Authentication failed. Invalid password." });
    }

    // Fetch public profile
    const publicDoc = await db.collection("users").doc(userId).get();
    if (!publicDoc.exists) {
      return res.status(401).json({ error: "Authentication failed. Public profile not found." });
    }
    const publicData = publicDoc.data()!;

    // Validate Role
    const dbRole = (publicData.role || '').toLowerCase();
    if (role === 'mentor' && sanitizedMobile !== '7407463884') {
        return res.status(403).json({ error: "Access denied. Only the authorized mentor can log in as mentor." });
    }

    const isStudentAttemptingRestrictedRole = (role === 'mentor' || role === 'examiner') && (dbRole === 'student' || dbRole === 'aspirant');
    if (isStudentAttemptingRestrictedRole) {
         return res.status(403).json({ error: "Authentication failed. Access restricted to authorized mentors/examiners only." });
    }

    let matchRole = false;
    if (role === 'mentor') {
        matchRole = ['mentor', 'primary-mentor', 'primarymentor', 'staff', 'admin'].includes(dbRole);
    } else if (role === 'examiner') {
        matchRole = dbRole === 'examiner' || ['mentor', 'primary-mentor', 'primarymentor', 'admin'].includes(dbRole);
    } else {
        // default to student UI
        matchRole = ['student', 'aspirant'].includes(dbRole) || (dbRole === role.toLowerCase());
    }

    if (!matchRole) {
      const failedAttempts = (privateData.failedAttempts || 0) + 1;
      const updates: any = { failedAttempts };
      if (failedAttempts >= 5 && role !== 'mentor' && role !== 'examiner') {
        updates.lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await db.collection("users_private").doc(userId).set(updates, { merge: true });
      return res.status(401).json({ error: "Authentication failed. Invalid mobile number, Password, or role selection." });
    }

    // Validate Status
    if (publicData.status === 'inactive' || publicData.status === 'blocked' || publicData.status === 'suspended') {
      return res.status(403).json({ error: `Account status: ${publicData.status}. Please contact administration.` });
    }

    // Reset lockout
    if (privateData.failedAttempts > 0 || privateData.lockUntil) {
      await db.collection("users_private").doc(userId).set({
        failedAttempts: 0,
        lockUntil: null
      }, { merge: true });
    }

    const uid = privateData.uid || userId;
    
    // Ensure uid is synced to both private and public user documents in Firestore
    try {
      await db.collection("users_private").doc(userId).set({
        uid: uid
      }, { merge: true });
      await db.collection("users").doc(userId).set({
        uid: uid
      }, { merge: true });
      console.log(`[Login] Successfully synced uid ${uid} to public and private profiles of user ${userId}`);
    } catch (syncErr: any) {
      console.warn(`[Login] Non-fatal: Failed to sync uid to Firestore during login:`, syncErr);
    }
    
    // Generate Custom Claims
    const batchId = publicData.batchId || "";
    const accountStatus = publicData.status || "active";
    const isPremium = !!publicData.isPremium;
    const premiumStatus = publicData.premiumStatus || (isPremium ? "PREMIUM" : "FREE");
    
    const mentorRoles = ["mentor", "primary-mentor", "primarymentor", "staff", "admin", "examiner"];
    const mentorAccess = mentorRoles.includes(dbRole);
    
    let permissionLevel = 1; // Student
    if (dbRole === "admin") permissionLevel = 4;
    else if (mentorRoles.includes(dbRole) && dbRole !== "examiner") permissionLevel = 3;
    else if (dbRole === "examiner") permissionLevel = 2;
    else if (dbRole === "aspirant") permissionLevel = 0;

    const claims = {
      userId,
      role: dbRole,
      batchId,
      accountStatus,
      mentorAccess,
      premiumStatus,
      permissionLevel,
      email: publicData.email
    };

    // Create custom token
    const customToken = await getAuth().createCustomToken(uid, claims);

    // Sync user_roles
    await db.collection("user_roles").doc(uid).set({
      userId: userId,
      role: dbRole,
      batchId: batchId,
      updatedAt: new Date().toISOString()
    });

    const combined = {
      ...publicData,
      ...privateData,
      id: userId,
      uid: uid
    };

    res.json({ success: true, customToken, user: combined });
  } catch (err: any) {
    console.error("Login endpoint error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Endpoint to force sync custom claims
app.post("/api/auth/sync-claims", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const uid = user.uid;
    const { targetUid } = req.body || {};
    
    // Access control: Users can only sync their own claims unless they are a Mentor/Admin
    let uidToSync = uid;
    if (targetUid && targetUid !== uid) {
      const email = (user.email || "").toLowerCase();
      const phone = user.phone_number || "";
      const isMentorByToken = (email === "missionselectionofficial999@gmail.com") ||
                              (phone === "+917407463884") ||
                              (uid === "7407463884") ||
                              (user.mentorAccess === true) ||
                              (["mentor", "primary-mentor", "primarymentor", "staff", "admin", "examiner"].includes((user.role || "").toLowerCase()));
                              
      if (!isMentorByToken) {
        return res.status(403).json({ error: "Forbidden. Only mentors can synchronize claims for other users." });
      }
      uidToSync = targetUid;
    }

    const claims = await syncCustomClaimsForUser(uidToSync);
    res.json({ success: true, claims });
  } catch (err: any) {
    console.error("[ClaimsSync] Endpoint error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Endpoint to recalculate pre-aggregated student metrics
app.post("/api/metrics/recalculate", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const uid = user.uid;
    const { targetUserId } = req.body || {};
    
    // Access check: User can only trigger their own recalculation, unless they are a Mentor
    let userIdToCalc = targetUserId;
    if (!userIdToCalc) {
      const db = getFirestore(getApp(), "(default)");
      const roleDoc = await db.collection("user_roles").doc(uid).get();
      if (roleDoc.exists) {
        userIdToCalc = roleDoc.data()?.userId;
      }
      if (!userIdToCalc) {
        const privSnap = await db.collection("users_private").where("uid", "==", uid).get();
        if (!privSnap.empty) {
          userIdToCalc = privSnap.docs[0].id;
        }
      }
    }
    
    if (!userIdToCalc) {
      return res.status(400).json({ error: "Could not resolve student user ID." });
    }
    
    // If attempting to calculate for another user, verify mentor access
    if (userIdToCalc !== uid) {
      const db = getFirestore(getApp(), "(default)");
      const roleDoc = await db.collection("user_roles").doc(uid).get();
      const myUserDocId = roleDoc.exists ? roleDoc.data()?.userId : null;
      if (myUserDocId !== userIdToCalc) {
        const email = (user.email || "").toLowerCase();
        const phone = user.phone_number || "";
        const isMentorByToken = (email === "missionselectionofficial999@gmail.com") ||
                                (phone === "+917407463884") ||
                                (uid === "7407463884") ||
                                (user.mentorAccess === true) ||
                                (["mentor", "primary-mentor", "primarymentor", "staff", "admin", "examiner"].includes((user.role || "").toLowerCase()));
                                
        if (!isMentorByToken) {
          return res.status(403).json({ error: "Forbidden. Only mentors can recalculate metrics for other users." });
        }
      }
    }

    const db = getFirestore(getApp(), "(default)");
    const userSnap = await db.collection("users").doc(userIdToCalc).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "User profile not found." });
    }
    const userData = userSnap.data() || {};
    const studentIds = Array.from(new Set([userIdToCalc, userData.uid, userData.studentCode, userData.id])).filter(Boolean) as string[];

    // Fetch reports, test attempts, warnings
    const reportsSnap = await db.collection("dailyMissionReports").where("userId", "in", studentIds).get();
    const testsSnap = await db.collection("test_attempts").where("userId", "in", studentIds).get();
    const warningsSnap = await db.collection("warnings").where("studentId", "in", studentIds).get();

    // Map reports
    const reportsMap = new Map<string, any>();
    reportsSnap.docs.forEach(d => {
      const data = d.data();
      const existing = reportsMap.get(`${data.date}`);
      if (!existing || (new Date(data.submittedAt || 0).getTime() > new Date(existing.submittedAt || 0).getTime())) {
        reportsMap.set(`${data.date}`, { id: d.id, ...data });
      }
    });
    const reports = Array.from(reportsMap.values());

    let totalPoints = 0;
    let approvedCount = 0;
    let pendingCount = 0;

    reports.forEach(r => {
      if (r.sections) {
        let hasApprovedSec = false;
        let hasPendingSec = false;
        let reportApprovedMarksSum = 0;

        Object.values(r.sections).forEach((sec: any) => {
          if (sec.status === "Approved") {
            reportApprovedMarksSum += sec.marks || 0;
            hasApprovedSec = true;
          } else if (sec.status === "Pending") {
            hasPendingSec = true;
          }
        });

        totalPoints += reportApprovedMarksSum;
        if (hasApprovedSec) approvedCount++;
        if (hasPendingSec) pendingCount++;
      } else {
        if (r.status === "Approved") {
          totalPoints += r.marks || 0;
          approvedCount++;
        } else if (r.status === "Pending") {
          pendingCount++;
        }
      }
    });

    // Test attempts
    const completedAttempts = testsSnap.docs
      .map(d => d.data())
      .filter(d => ["submitted", "evaluated"].includes(d.status));
    
    const totalPercentage = completedAttempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
    const averageScore = completedAttempts.length > 0 ? (totalPercentage / completedAttempts.length) : 0;

    // Fetch total tests in batch
    let totalTestsCount = 0;
    if (userData.batchId) {
      const testsQuerySnap = await db.collection("tests").where("batchIds", "array-contains", userData.batchId).get();
      totalTestsCount = testsQuerySnap.docs.length;
      if (totalTestsCount === 0) {
        const legacyQuerySnap = await db.collection("tests").where("batchId", "==", userData.batchId).get();
        totalTestsCount = legacyQuerySnap.docs.length;
      }
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let weeklyScore = 0;
    let monthlyScore = 0;
    let submissionCount = 0;
    let approvedCountForMetrics = 0;

    reports.forEach(r => {
      let reportMarks = 0;
      let isApproved = false;
      let isPending = false;
      
      if (r.sections) {
        Object.values(r.sections).forEach((sec: any) => {
          if (sec.status === "Approved") {
            reportMarks += sec.marks || 0;
            isApproved = true;
          } else if (sec.status === "Pending") {
            isPending = true;
          }
        });
      } else {
        if (r.status === "Approved") {
          reportMarks += r.marks || 0;
          isApproved = true;
        } else if (r.status === "Pending") {
          isPending = true;
        }
      }
      
      if (isApproved || isPending || r.status === "Absent" || r.status === "Rejected") {
        submissionCount++;
      }
      if (isApproved) {
        approvedCountForMetrics++;
      }
      
      const subDate = r.submittedAt ? new Date(r.submittedAt) : (r.date ? new Date(r.date) : null);
      if (subDate) {
        if (subDate >= sevenDaysAgo) {
          weeklyScore += reportMarks;
        }
        if (subDate >= thirtyDaysAgo) {
          monthlyScore += reportMarks;
        }
      }
    });

    const attendanceRate = reports.length > 0 ? Math.round((approvedCountForMetrics / reports.length) * 100) : 100;
    const finalTotalTests = totalTestsCount || completedAttempts.length || 1;
    const completionPercentage = Math.round((completedAttempts.length / finalTotalTests) * 100);

    const metricsPayload = {
      userId: userIdToCalc,
      uid: userData.uid || userIdToCalc,
      totalTests: totalTestsCount || completedAttempts.length,
      completedTests: completedAttempts.length,
      averageScore: Math.round(averageScore * 10) / 10,
      totalMissionPoints: totalPoints,
      submissionCount: submissionCount,
      leaderboardPoints: totalPoints,
      weeklyScore: weeklyScore,
      monthlyScore: monthlyScore,
      attendanceRate: attendanceRate,
      completionPercentage: completionPercentage,
      currentRank: userData.currentRank || 1,
      streak: userData.currentStreak || 0,
      lastUpdated: new Date().toISOString()
    };

    const writeBatch = db.batch();
    
    const newStats = {
      studentId: userIdToCalc,
      accountabilityScore: 0,
      missionPoints: totalPoints,
      totalPoints: totalPoints,
      currentRank: userData.currentRank || 1,
      tenDayPerformance: 0,
      tenDayProgress: 0,
      streak: userData.currentStreak || 0,
      attendance: 0,
      reviewCategory: "Stable",
      eliteStatus: "Base",
      missionsApproved: approvedCount,
      missionsPending: pendingCount,
      testsCompleted: testsSnap.docs.length,
      averageTestScore: 0,
      warningCount: warningsSnap.docs.length,
      lastSubmission: new Date().toISOString(),
      status: userData.status || "active",
      updatedAt: new Date().toISOString()
    };

    writeBatch.set(db.collection("studentStats").doc(userIdToCalc), newStats, { merge: true });
    writeBatch.set(db.collection("student_metrics").doc(userIdToCalc), metricsPayload, { merge: true });
    writeBatch.set(db.collection("users").doc(userIdToCalc), {
      missionPoints: totalPoints,
      longestStreak: Math.max(userData.longestStreak || 0, userData.currentStreak || 0),
      totalActiveDaysCount: approvedCount,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    await writeBatch.commit();

    res.json({ success: true, metrics: metricsPayload });
  } catch (err: any) {
    console.error("[MetricsRecalculate] Endpoint error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

// Premium and Security History tracking endpoints
app.post("/api/premium/track-login", requireAuth, async (req, res) => {
  const user = (req as any).user;
  let userId = user.uid;
  const ipAddress = (req.headers['x-forwarded-for'] as string || req.ip || req.socket.remoteAddress || '').split(',')[0].trim();
  const userAgent = req.headers['user-agent'] || '';
  const { deviceId } = req.body || {};
  
  try {
    const db = getFirestore(getApp(), "(default)");
    const roleDoc = await db.collection("user_roles").doc(user.uid).get();
    if (roleDoc.exists) {
      const rData = roleDoc.data();
      if (rData && rData.userId) {
        userId = rData.userId;
      }
    }
    const userPrivateSnap = await db.collection("users_private").doc(userId).get();
    const userPublicSnap = await db.collection("users").doc(userId).get();
    
    const timestamp = new Date().toISOString();
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    const currentDevice = `${browser} on ${os} (${deviceType})`;
    
    let registrationIP = ipAddress;
    let loginCount = 1;
    let registrationDate = timestamp;
    let candidateName = 'Student';
    let verifiedMobileNumber = '';
    
    let previousDeviceId = '';
    let previousIP = '';
    let previousDevice = '';
    
    if (userPublicSnap.exists) {
      const pubData = userPublicSnap.data() || {};
      candidateName = pubData.name || candidateName;
    }
    
    if (userPrivateSnap.exists) {
      const pData = userPrivateSnap.data() || {};
      registrationIP = pData.registrationIP || pData.currentIP || ipAddress;
      loginCount = (pData.loginCount || 0) + 1;
      registrationDate = pData.registrationDate || pData.createdAt || timestamp;
      verifiedMobileNumber = pData.mobile || '';
      previousDeviceId = pData.deviceId || '';
      previousIP = pData.currentIP || '';
      previousDevice = pData.currentDevice || pData.deviceInfo || '';
    }
    
    // Check for login from new Device or new IP
    const isNewDevice = previousDeviceId && (deviceId && previousDeviceId !== deviceId);
    const isNewIP = previousIP && (ipAddress && previousIP !== ipAddress);
    
    if (isNewDevice || isNewIP) {
      let alertDetails = `Security Alert: Login from `;
      if (isNewDevice && isNewIP) {
        alertDetails += `New Device (${currentDevice}) and New IP (${ipAddress})`;
      } else if (isNewDevice) {
        alertDetails += `New Device (${currentDevice}) [Previous: ${previousDevice || 'Unknown'}]`;
      } else {
        alertDetails += `New IP (${ipAddress}) [Previous: ${previousIP}]`;
      }
      alertDetails += `. Candidate Name: ${candidateName}.`;
      
      await db.collection("security_history").add({
        studentId: userId,
        type: "alert",
        ipAddress,
        deviceInfo: userAgent,
        timestamp,
        details: alertDetails,
        loginTime: timestamp,
        logoutTime: null,
        browser,
        operatingSystem: os,
        deviceType,
        deviceId: deviceId || 'unknown',
        location: "Unknown",
        status: "Active"
      });
    }
    
    // Write complete login history record
    await db.collection("login_history").add({
      studentId: userId,
      loginTime: timestamp,
      logoutTime: null,
      ipAddress,
      device: currentDevice,
      browser,
      operatingSystem: os,
      location: "Unknown",
      status: "Active",
      deviceId: deviceId || 'unknown'
    });
    
    // Update users_private with mandatory security fields
    await db.collection("users_private").doc(userId).set({
      registrationIP,
      currentIP: ipAddress,
      lastLoginIP: previousIP || ipAddress,
      lastLogin: timestamp,
      registrationDate,
      deviceInfo: userAgent,
      loginCount,
      lastActiveDate: timestamp,
      updatedAt: timestamp,
      deviceId: deviceId || previousDeviceId || 'unknown',
      browser,
      operatingSystem: os,
      deviceType,
      currentDevice,
      lastLoginDevice: previousDevice || currentDevice,
      lastLoginTime: timestamp
    }, { merge: true });
    
    // Update users (public profile)
    await db.collection("users").doc(userId).set({
      lastActiveDate: timestamp,
      updatedAt: timestamp
    }, { merge: true });
    
    // Log standard verification in security history
    await db.collection("security_history").add({
      studentId: userId,
      type: "login",
      ipAddress,
      deviceInfo: userAgent,
      timestamp,
      details: `Login verified. Candidate name: ${candidateName}. Mobile: ${verifiedMobileNumber || 'N/A'}. Total logins: ${loginCount}. Device: ${currentDevice}.`,
      loginTime: timestamp,
      logoutTime: null,
      browser,
      operatingSystem: os,
      deviceType,
      deviceId: deviceId || 'unknown',
      location: "Unknown",
      status: "Active"
    });
    
    res.json({ success: true, ipAddress, userAgent });
  } catch (err: any) {
    console.error("Error tracking login on backend:", err);
    res.status(500).json({ error: "Failed to track login: " + err.message });
  }
});

// Endpoint to track user logouts in history logs
app.post("/api/premium/track-logout", requireAuth, async (req, res) => {
  const user = (req as any).user;
  let userId = user.uid;
  const ipAddress = (req.headers['x-forwarded-for'] as string || req.ip || req.socket.remoteAddress || '').split(',')[0].trim();
  const userAgent = req.headers['user-agent'] || '';
  
  try {
    const db = getFirestore(getApp(), "(default)");
    const roleDoc = await db.collection("user_roles").doc(user.uid).get();
    if (roleDoc.exists) {
      const rData = roleDoc.data();
      if (rData && rData.userId) {
        userId = rData.userId;
      }
    }
    const userPublicSnap = await db.collection("users").doc(userId).get();
    let candidateName = 'Student';
    if (userPublicSnap.exists) {
      const pubData = userPublicSnap.data() || {};
      candidateName = pubData.name || candidateName;
    }

    const timestamp = new Date().toISOString();
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    const currentDevice = `${browser} on ${os} (${deviceType})`;

    // Terminate all Active login sessions in complete login history
    const activeSessions = await db.collection("login_history")
      .where("studentId", "==", userId)
      .where("status", "==", "Active")
      .get();

    for (const docSnap of activeSessions.docs) {
      await docSnap.ref.set({
        logoutTime: timestamp,
        status: "Logged Out"
      }, { merge: true });
    }

    // Log the logout action in security history
    await db.collection("security_history").add({
      studentId: userId,
      type: "logout",
      ipAddress,
      deviceInfo: userAgent,
      timestamp,
      details: `Logout verified. Candidate name: ${candidateName}. Device: ${currentDevice}.`,
      loginTime: null,
      logoutTime: timestamp,
      browser,
      operatingSystem: os,
      deviceType,
      location: "Unknown",
      status: "Logged Out"
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error tracking logout on backend:", err);
    res.status(500).json({ error: "Failed to track logout: " + err.message });
  }
});

app.post("/api/premium/run-daily-check", requireMentor, async (req, res) => {
  const authHeader = req.headers.authorization as string;
  try {
    const users = await restQueryDocs("users", [
      { field: "role", op: "in", value: ["student", "aspirant"] }
    ], authHeader);
    
    const today = new Date();
    // Check-in check for yesterday: YYYY-MM-DD
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const results: any[] = [];
    
    for (const doc of users) {
      const docSnap = {
        id: doc.id,
        data: () => doc
      };
      const resObj = await processPremiumVerificationForUser(null, docSnap, today, yesterdayStr, authHeader);
      results.push(resObj);
    }
    
    res.json({ success: true, checkedDate: yesterdayStr, results });
  } catch (err: any) {
    console.error("Error running daily check:", err);
    res.status(500).json({ error: "Failed to run daily check: " + err.message });
  }
});

// Vite middleware setup
async function setupVite() {
  try {
    if (process.env.NODE_ENV !== "production") {
      console.log("[Server] Initializing Vite middleware...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "custom",
      });
      app.use(express.static(path.join(process.cwd(), 'public'), {
        setHeaders: (res, filePath) => {
          const fileName = path.basename(filePath);
          if (fileName === 'sw.js') {
            res.setHeader('Content-Type', 'application/javascript');
          } else if (fileName === 'manifest.json') {
            res.setHeader('Content-Type', 'application/manifest+json');
          }
        }
      }));
      app.use(vite.middlewares);

      // Serve index.html transformed by Vite for any non-API GET request
      app.get('*', async (req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.includes('.')) {
          return next();
        }
        try {
          const url = req.originalUrl;
          const templatePath = path.resolve(process.cwd(), 'index.html');
          let template = fs.readFileSync(templatePath, 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e: any) {
          vite.ssrFixStacktrace(e);
          next(e);
        }
      });
      console.log("[Server] Vite middleware and HTML transform route attached.");
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      
      // Serve static files with specific header handling
      app.use(express.static(distPath, {
        maxAge: '1y',
        setHeaders: (res, filePath) => {
          const fileName = path.basename(filePath);
          if (fileName === 'index.html' || fileName === 'sw.js' || fileName === 'manifest.json') {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            if (fileName === 'sw.js') {
              res.setHeader('Content-Type', 'application/javascript');
            } else if (fileName === 'manifest.json') {
              res.setHeader('Content-Type', 'application/manifest+json');
            }
          }
        }
      }));

      app.get('*', (req, res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log("[Server] Production static assets configured.");
    }
  } catch (err) {
    console.error("[Server] Setup failed:", err);
  }
}

setupVite();
