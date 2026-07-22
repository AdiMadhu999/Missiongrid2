const fs = require('fs');
let code = fs.readFileSync('src/services/users.ts', 'utf8');

// Replace the fallback logic
const target = `const privateDocsMap = new Map<string, any>();
  if (isMentorUser) {
    try {
      const privSnap = await getDocs(query(collection(db, 'users_private'), limit(50)));
      privSnap.forEach(d => {
        privateDocsMap.set(d.id, d.data());
      });
    } catch (e) {
      console.warn("Could not query all users_private in bulk, falling back:", e);
    }
  }

  const promises = snap.docs.map(async (d) => {
    const data = d.data();
    let privateData = privateDocsMap.get(d.id) || {};
    
    // Fallback if bulk query fails but caller is mentor
    if (isMentorUser && privateDocsMap.size === 0) {`;

const replacement = `const privateDocsMap = new Map<string, any>();
  let bulkPrivateFailed = false;
  if (isMentorUser) {
    try {
      const privSnap = await getDocs(query(collection(db, 'users_private'), limit(50)));
      privSnap.forEach(d => {
        privateDocsMap.set(d.id, d.data());
      });
    } catch (e) {
      console.warn("Could not query all users_private in bulk, falling back:", e);
      bulkPrivateFailed = true;
    }
  }

  const promises = snap.docs.map(async (d) => {
    const data = d.data();
    let privateData = privateDocsMap.get(d.id) || {};
    
    // Fallback if bulk query fails but caller is mentor
    if (isMentorUser && bulkPrivateFailed) {`;

code = code.replace(target, replacement);
fs.writeFileSync('src/services/users.ts', code);
console.log("Patched users.ts N+1 query issue");
