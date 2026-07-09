const fs = require('fs');

const code = `import React from 'react';
import { Navigate } from 'react-router-dom';

// Deprecated component, redirecting to UnifiedRegistration
export default function Register() {
  return <Navigate to="/register" replace />;
}
`;

fs.writeFileSync('src/screens/Register.tsx', code);
console.log("Replaced Register.tsx with redirect stub");
