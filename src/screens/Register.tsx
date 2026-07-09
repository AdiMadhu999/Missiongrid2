import React from 'react';
import { Navigate } from 'react-router-dom';

// Deprecated component, redirecting to UnifiedRegistration
export default function Register() {
  return <Navigate to="/register" replace />;
}
