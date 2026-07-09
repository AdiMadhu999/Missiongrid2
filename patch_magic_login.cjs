const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const magicLoginCode = `
app.post("/api/auth/magic-login", requireMentor, async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ error: "Missing mobile number" });
    }
    const sanitized = mobile.replace(/\\D/g, '');
    const sanitizedMobile = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
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
      return res.status(404).json({ error: \`No user found with mobile number \${sanitizedMobile}\` });
    }
    
    const privateDoc = querySnap.docs[0];
    const userId = privateDoc.id;
    const privateData = privateDoc.data();
    
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User public profile not found" });
    }
    const publicData = userDoc.data();
    
    let uid = privateData.uid || publicData.uid;
    if (!uid) {
        return res.status(400).json({ error: "User is missing Firebase Auth UID, cannot generate token" });
    }
    
    const dbRole = publicData.role || 'student';
    const batchId = publicData.batchId || 'unassigned';
    const accountStatus = publicData.status || 'active';
    const mentorAccess = (dbRole === 'mentor' || dbRole === 'admin');
    const premiumStatus = publicData.premiumStatus || (publicData.isPremium ? 'active' : 'inactive');
    const permissionLevel = publicData.permissionLevel || 1;

    const claims = {
      role: dbRole,
      batchId,
      accountStatus,
      mentorAccess,
      premiumStatus,
      permissionLevel,
      email: publicData.email
    };

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
    console.error("Magic login endpoint error:", err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});
`;

code = code.replace(
  /\/\/ Endpoint to force sync custom claims/g,
  magicLoginCode + '\n// Endpoint to force sync custom claims'
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with magic-login");
