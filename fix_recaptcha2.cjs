const fs = require('fs');

let content = fs.readFileSync('src/screens/RecoverAccount.tsx', 'utf8');

const oldStr = `  useEffect(() => {
    // Pre-fill mobile from query string if available
    const mobileParam = searchParams.get('mobile');
    if (mobileParam) {
      setMobile(mobileParam.replace(/\\D/g, ''));
    }
    if (!recaptchaVerifier) return setError('ReCAPTCHA not initialized');
    return () => {
      verifier.clear();
    };
  }, [searchParams]);`;

const newStr = `  useEffect(() => {
    // Pre-fill mobile from query string if available
    const mobileParam = searchParams.get('mobile');
    if (mobileParam) {
      setMobile(mobileParam.replace(/\\D/g, ''));
    }
  }, [searchParams]);

  useEffect(() => {
    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
    setRecaptchaVerifier(verifier);
    return () => {
      verifier.clear();
    };
  }, []);`;

content = content.replace(oldStr, newStr);
fs.writeFileSync('src/screens/RecoverAccount.tsx', content, 'utf8');

