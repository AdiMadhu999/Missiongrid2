const fs = require('fs');
let code = fs.readFileSync('src/screens/UnifiedRegistration.tsx', 'utf8');

// Replace OTP states with standard
code = code.replace(
  /const \[step, setStep\] = useState\(1\);[\s\S]*?const \[otp, setOtp\] = useState\(''\);/,
  "const [step, setStep] = useState(1);\n  const [acceptedTerms, setAcceptedTerms] = useState(false);"
);

// Remove OTP logic, update handleSendOtp to handleFinalSubmit equivalent for PIN
code = code.replace(
  /const handleSendOtp = async \(e: React.FormEvent\) => \{[\s\S]*?catch \(err: any\) \{[\s\S]*?setLoading\(false\);[\s\S]*?\}[\s\S]*?\};[\s\S]*?const handleVerifyOtp = async \(e: React.FormEvent\) => \{[\s\S]*?const handleFinalSubmit = \(\) => \{[\s\S]*?\};/m,
`const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("PINs do not match.");
      return;
    }
    if (password.length !== 6 || !/\\d{6}/.test(password)) {
      setError("Security PIN must be exactly 6 digits.");
      return;
    }
    if (!name.trim() || !mobile.trim() || !selectedBatchId) {
      setError("Please fill all required fields.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please accept the terms and conditions.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      let finalPhotoUrl = previewUrl || \`https://api.dicebear.com/7.x/avataaars/svg?seed=\${name}\`;
      const registeredUser = await AuthService.registerWithMobileAndPassword(mobile, password, name, selectedBatchId, finalPhotoUrl);
      const loginResponse = await AuthService.loginWithMobileAndPassword(mobile, password, 'student', 'pin');
      setUserProfile(loginResponse);
      navigate('/app/doubt', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };`
);

code = code.replace(/\{step === 1 && !showOtpInput && \(/g, "{step === 1 && (");
code = code.replace(/onSubmit=\{handleSendOtp\}/g, "onSubmit={(e) => { e.preventDefault(); setStep(2); }}");
code = code.replace(/<button type="submit".*?>\{loading \? 'Processing\.\.\.' : 'Send OTP'\}<\/button>/g, '<button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Next</button>');

// Modify step 2 view
code = code.replace(
  /<button onClick=\{handleFinalSubmit\}.*?Finish<\/button>/,
  '<button onClick={handleFinalSubmit} disabled={!acceptedTerms || loading} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">{loading ? "Registering..." : "Finish Registration"}</button>'
);

// Remove the showOtpInput section
code = code.replace(
  /\{showOtpInput && step === 1 && \([\s\S]*?<\/form>\s*\)}/m,
  ''
);

// Modify Password to Security PIN
code = code.replace(
  /placeholder="Password"/,
  'placeholder="6-Digit Security PIN" maxLength={6} pattern="\\\\d{6}" inputMode="numeric"'
);
code = code.replace(
  /placeholder="Confirm Password"/,
  'placeholder="Confirm 6-Digit PIN" maxLength={6} pattern="\\\\d{6}" inputMode="numeric"'
);
code = code.replace(/handlePasswordChange/g, 'setPassword');
code = code.replace(/<div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden">[\s\S]*?<\/div>/, ''); // Remove password strength

fs.writeFileSync('src/screens/UnifiedRegistration.tsx', code);
console.log("Patched UnifiedRegistration.tsx");
