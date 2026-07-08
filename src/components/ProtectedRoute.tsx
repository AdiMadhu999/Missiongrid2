import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import appIcon from "../assets/images/app_logo_base_1783466372014.jpg";
import { useAuth } from '../providers/AuthProvider';
import PendingApprovalScreen from '../screens/PendingApproval';
import CompleteProfile from '../screens/CompleteProfile';
import { isDefaultPinValue } from '../utils/security';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-600 text-white">
        <div className="w-24 h-24 bg-white/10 border-2 border-white/30 rounded-[28px] p-1 mb-6 shadow-2xl shadow-indigo-950/40 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-[28px] border-4 border-white/20 border-t-white animate-spin"></div>
          <div className="w-full h-full rounded-[24px] overflow-hidden">
            <img 
              src={appIcon} 
              alt="Mission Logo" 
              className="w-full h-full object-cover opacity-50" 
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black tracking-tight drop-shadow-sm opacity-80">Syncing...</h1>
          <p className="text-indigo-200/50 text-[8px] font-bold tracking-[0.4em] uppercase mt-1">Adi Madhu Mentorship</p>
        </div>
      </div>
    );
  }

  if (!currentUser && !userProfile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!userProfile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (userProfile.status === 'suspended') {
    return <PendingApprovalScreen message="Your account has been suspended by a mentor." title="Account Suspended" />;
  }

  if (userProfile.status === 'removed') {
    return <PendingApprovalScreen message="Your account has been removed from the system." title="Account Removed" />;
  }

  if (userProfile.status === 'pending') {
    return <PendingApprovalScreen message="Your account is awaiting mentor approval." />;
  }

  if (userProfile.status === 'inactive') {
    return <PendingApprovalScreen message="Your account is currently inactive. Please contact your mentor." title="Account Inactive" />;
  }

  if (userProfile.status === 'blocked') {
    return <PendingApprovalScreen message="Your account has been blocked by the administration." title="Account Blocked" />;
  }

  // Force profile completion if profile not completed
  const needsProfileUpdate = userProfile.isProfileCompleted === false;
  
  if (needsProfileUpdate) {
    return <CompleteProfile />;
  }

  return <>{children}</>;
}

export function RoleRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-600 text-white">
        <div className="w-24 h-24 bg-white/10 border-2 border-white/30 rounded-[28px] p-1 mb-6 shadow-2xl shadow-indigo-950/40 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-[28px] border-4 border-white/20 border-t-white animate-spin"></div>
          <div className="w-full h-full rounded-[24px] overflow-hidden">
            <img 
              src={appIcon} 
              alt="Mission Logo" 
              className="w-full h-full object-cover opacity-50" 
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black tracking-tight drop-shadow-sm opacity-80">Validating...</h1>
          <p className="text-indigo-200/50 text-[8px] font-bold tracking-[0.4em] uppercase mt-1">Adi Madhu Mentorship</p>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return <Navigate to="/app" replace />;
  }

  if (userProfile.status !== 'active') {
    return <Navigate to="/app" replace />;
  }

  if (!allowedRoles.includes(userProfile.role)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
