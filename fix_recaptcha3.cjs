const fs = require('fs');

let content = fs.readFileSync('src/screens/RecoverAccount.tsx', 'utf8');

const regex = /useEffect\(\(\) => \{\s*\/\/ Pre-fill mobile from query string if available[\s\S]*?\}, \[searchParams\]\);/;

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

content = content.replace(regex, newStr);
fs.writeFileSync('src/screens/RecoverAccount.tsx', content, 'utf8');
