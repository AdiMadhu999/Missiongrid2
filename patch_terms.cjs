const fs = require('fs');
let code = fs.readFileSync('src/screens/UnifiedRegistration.tsx', 'utf8');

code = code.replace("  const [acceptedTerms, setAcceptedTerms] = useState(false);\n", "");

fs.writeFileSync('src/screens/UnifiedRegistration.tsx', code);
console.log("Patched double acceptedTerms");
