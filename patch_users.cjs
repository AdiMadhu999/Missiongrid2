const fs = require('fs');
let code = fs.readFileSync('src/services/users.ts', 'utf8');

const replacement = `
  const privateDocsMap = new Map<string, any>();
  let privateDocsQueried = false;
  if (isMentorUser) {
    try {
      const privSnap = await getDocs(query(collection(db, 'users_private'), limit(50)));
      privSnap.forEach(d => {
        privateDocsMap.set(d.id, d.data());
      });
      privateDocsQueried = true;
    } catch (e) {
      console.warn("Could not query all users_private in bulk, falling back:", e);
    }
  }

  const promises = snap.docs.map(async (d) => {
    const data = d.data();
    let privateData = privateDocsMap.get(d.id) || {};
    
    // Fallback if bulk query fails but caller is mentor
    if (isMentorUser && !privateDocsQueried) {
      try {
        const privSnap = await getDoc(doc(db, 'users_private', d.id));
        if (privSnap.exists()) {
          privateData = privSnap.data();
        }
      } catch (e) {
        // Ignored
      }
    }

    const finalProfile = { ...data, ...privateData, id: d.id } as User;
    if (!finalProfile.studentCode) {
      finalProfile.studentCode = getStudentCode(finalProfile);
    }
    return finalProfile;
  });
`;

code = code.replace(
  /const privateDocsMap = new Map<string, any>\(\);\s*if \(isMentorUser\) \{[\s\S]*?return finalProfile;\s*\}\);/m,
  replacement.trim()
);

fs.writeFileSync('src/services/users.ts', code);
console.log("Patched users.ts");
