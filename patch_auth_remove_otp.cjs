const fs = require('fs');
let code = fs.readFileSync('src/services/auth.ts', 'utf8');

// Strip out OTP related methods
const patternsToRemove = [
  /sendOtp:\s*async\s*\([^)]*\)\s*(?::\s*Promise<any>)?\s*=>\s*\{[\s\S]*?(?:(?=verifyOtp:)|(?=verifyOnlyOtp:)|(?=verifyMentorSecurityPin:)|(?=registerWithMobileAndPassword:))/g,
  /verifyOtp:\s*async\s*\([^)]*\)\s*(?::\s*Promise<any>)?\s*=>\s*\{[\s\S]*?(?:(?=verifyOnlyOtp:)|(?=verifyMentorSecurityPin:)|(?=registerWithMobileAndPassword:))/g,
  /verifyOnlyOtp:\s*async\s*\([^)]*\)\s*(?::\s*Promise<any>)?\s*=>\s*\{[\s\S]*?(?:(?=verifyMentorSecurityPin:)|(?=registerWithMobileAndPassword:))/g,
  /verifyMentorSecurityPin:\s*async\s*\([^)]*\)\s*(?::\s*Promise<any>)?\s*=>\s*\{[\s\S]*?(?:(?=registerWithMobileAndPassword:))/g,
  /updatePassword:\s*async\s*\([^)]*\)\s*(?::\s*Promise<any>)?\s*=>\s*\{[\s\S]*?(?:(?=resetPassword:)|(?=logout:))/g
];

patternsToRemove.forEach(pattern => {
  code = code.replace(pattern, '');
});

fs.writeFileSync('src/services/auth.ts', code);
console.log("Patched auth.ts completely");
