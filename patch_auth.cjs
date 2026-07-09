const fs = require('fs');
let code = fs.readFileSync('src/services/auth.ts', 'utf8');

const magicLoginMethod = `
  magicLogin: async (mobile: string): Promise<any> => {
    const sanitized = (mobile || '').replace(/\\D/g, '');
    const tenDigits = sanitized.length > 10 ? sanitized.slice(-10) : sanitized;
    const sanitizedMobile = tenDigits;
    try {
      const response = await apiFetch('/api/auth/magic-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: sanitizedMobile })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || \`HTTP error! status: \${response.status}\`);
      }
      const data = await response.json();
      if (data.customToken) {
        await setPersistence(auth, browserLocalPersistence);
        const userCredential = await signInWithCustomToken(auth, data.customToken);
        
        let sessionClaims = {};
        try {
           const idTokenResult = await userCredential.user.getIdTokenResult(true);
           sessionClaims = idTokenResult.claims;
        } catch(e) {
           console.warn('Failed to fetch claims after magic login:', e);
        }
        
        return {
          ...data.user,
          ...sessionClaims,
          sessionUid: userCredential.user.uid,
          sessionEmail: userCredential.user.email,
        };
      } else {
        throw new Error('Authentication failed: No token received.');
      }
    } catch (error: any) {
      console.error('Magic login error:', error);
      throw error;
    }
  },
`;

code = code.replace(
  /  loginWithMobileAndPassword:/g,
  magicLoginMethod + '\n  loginWithMobileAndPassword:'
);

fs.writeFileSync('src/services/auth.ts', code);
console.log("Patched auth.ts");
