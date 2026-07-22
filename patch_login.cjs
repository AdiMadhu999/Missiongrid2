const fs = require('fs');
let code = fs.readFileSync('src/screens/Login.tsx', 'utf8');

code = code.replace(/>\s*Password\s*<\/label>/g, '> 6-Digit Security PIN </label>');
code = code.replace(/placeholder="Enter password"/g, 'placeholder="Enter 6-digit PIN"');
code = code.replace(/>Register with OTP<\/Link>/g, '>Register Account</Link>');
code = code.replace(/type="password"/g, 'type="password" maxLength={6} pattern="\\\\d{6}" inputMode="numeric"');
code = code.replace(/>Forgot Password\?</g, '>Forgot PIN?<');

fs.writeFileSync('src/screens/Login.tsx', code);
console.log("Patched Login.tsx carefully");
