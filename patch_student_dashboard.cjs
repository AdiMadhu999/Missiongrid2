const fs = require('fs');
let code = fs.readFileSync('src/screens/StudentDashboard.tsx', 'utf8');

// Replace warnings or()
code = code.replace(
  /const qWarnings = query\(\s*collection\(db, 'warnings'\),\s*or\(\s*where\('uid', '==', uId\),\s*where\('studentId', '==', uId\)\s*\),\s*limit\(50\)\s*\);/m,
  "const qWarnings = query(collection(db, 'warnings'), where('studentId', '==', uId), limit(50));"
);

// Replace leaves or()
code = code.replace(
  /const qLeaves = query\(\s*collection\(db, 'leaveRequests'\),\s*or\(\s*where\('uid', '==', uId\),\s*where\('studentId', '==', uId\)\s*\),\s*limit\(50\)\s*\);/m,
  "const qLeaves = query(collection(db, 'leaveRequests'), where('studentId', '==', uId), limit(50));"
);

fs.writeFileSync('src/screens/StudentDashboard.tsx', code);
console.log("Patched StudentDashboard");
