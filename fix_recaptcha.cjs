const fs = require('fs');

function fixFile(filePath, isMentor) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (isMentor) {
    // MentorLoginForm doesn't use useEffect for recaptcha. Let's add it.
    if (!content.includes("useEffect(() => {")) {
       content = content.replace("import React, { useState } from 'react';", "import React, { useState, useEffect } from 'react';");
    }
    
    const useEffectBlock = `
  useEffect(() => {
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
    setRecaptchaVerifier(verifier);
    return () => {
      verifier.clear();
    };
  }, []);
`;
    // Add before handleResendOtp
    if (!content.includes("useEffect(() => {\n    const verifier = new RecaptchaVerifier")) {
       content = content.replace("const handleResendOtp", useEffectBlock + "\n  const handleResendOtp");
    }
    
    // Remove inline creation
    content = content.replace(/let verifier = recaptchaVerifier;[\s\S]*?setRecaptchaVerifier\(verifier\);\s*\}/g, "if (!recaptchaVerifier) return setError('ReCAPTCHA not initialized');");
    content = content.replace(/await AuthService.sendOtp\(mobile, verifier\)/g, "await AuthService.sendOtp(mobile, recaptchaVerifier)");
  } else {
    // For others, rewrite the useEffect and remove inline creation
    if (content.includes("useEffect(() => {")) {
       content = content.replace(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/m, `useEffect(() => {
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
    setRecaptchaVerifier(verifier);
    return () => {
      verifier.clear();
    };
  }, []);`);
    } else {
       const useEffectBlock = `
  useEffect(() => {
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
    setRecaptchaVerifier(verifier);
    return () => {
      verifier.clear();
    };
  }, []);
`;
       content = content.replace("const handleSendOtp", useEffectBlock + "\n  const handleSendOtp");
    }

    // Remove inline clear and creation
    content = content.replace(/\/\/ Cleanup previous verifier[\s\S]*?setRecaptchaVerifier\(verifier\);\s*\}/g, "if (!recaptchaVerifier) return setError('ReCAPTCHA not initialized');");
    content = content.replace(/let verifier = recaptchaVerifier;[\s\S]*?setRecaptchaVerifier\(verifier\);\s*\}/g, "if (!recaptchaVerifier) return setError('ReCAPTCHA not initialized');");
    content = content.replace(/await AuthService.sendOtp\(mobile, verifier\)/g, "await AuthService.sendOtp(mobile, recaptchaVerifier)");
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
}

fixFile('src/screens/Register.tsx', false);
fixFile('src/screens/ForgotPin.tsx', false);
fixFile('src/screens/RecoverAccount.tsx', false);
fixFile('src/components/MentorLoginForm.tsx', true);

