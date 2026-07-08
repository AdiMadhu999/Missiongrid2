/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { AppProvider, useAppConfig } from './providers/AppProvider';
import { PremiumModal } from './components/PremiumModal';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute';
import { UpdateChecker } from './components/UpdateChecker';
import { DebugConsole } from './components/DebugConsole';

import Splash from './screens/Splash';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import MainLayout from './components/MainLayout';

import CompleteProfile from './screens/CompleteProfile';
import ForgotPin from './screens/ForgotPin';
import Register from './screens/Register';
import RecoverAccount from './screens/RecoverAccount';
import DeveloperConsole from './screens/DeveloperConsole';
import PublicLiveTestLanding from './screens/test/PublicLiveTestLanding';
import TargetScreen from './screens/targets/TargetScreen';
import UserListScreen from './screens/users/UserListScreen';
import BatchListScreen from './screens/admin/BatchListScreen';
import BatchCreateScreen from './screens/admin/BatchCreateScreen';
import BatchDetailScreen from './screens/admin/BatchDetailScreen';
import ProfileScreen from './screens/ProfileScreen';
import MissionViewDistributor from './screens/MissionViewDistributor';
import MissionFeedScreen from './screens/MissionFeedScreen';
import MentorPostCreationScreen from './screens/create/MentorPostCreationScreen';
import MentorPlace from './screens/mentor/MentorPlace';
import CommunityManagementScreen from './screens/mentor/CommunityManagementScreen';
import { NotificationScreen } from './screens/NotificationScreen';
import TestDashboardScreen from './screens/test/TestDashboardScreen';
import TestAttemptSession from './screens/test-v2/TestAttemptSession';
import AIConfigScreen from './screens/mentor/AIConfigScreen';
import AttemptTestView from './screens/test/AttemptTestView';
import TestResultView from './screens/test/TestResultView';
import AITestCreator from './screens/test/AITestCreator';

import { AppSecurityWrapper } from './components/AppSecurityWrapper';
import { MaintenanceBanner } from './components/MaintenanceBanner';

const IndexRedirect = () => {
  const { userProfile } = useAuth();
  if (!userProfile) return null;
  const role = (userProfile.role || '').toLowerCase();
  const isMentor = role === 'mentor' || role === 'primary-mentor' || role === 'staff' || role === 'admin' || role === 'examiner';
  return <Navigate to={isMentor ? "home" : "feed"} replace />;
};

// Sleek, animated skeleton spinner for lazy-loaded route transitions
const LazyFallbackLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] w-full p-6 animate-in fade-in duration-300">
    <div className="relative w-12 h-12">
      <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-100 rounded-full" />
      <div className="absolute top-0 left-0 w-full h-full border-4 border-t-indigo-600 rounded-full animate-spin" />
    </div>
    <p className="text-slate-450 text-xs font-bold tracking-wide uppercase mt-4 animate-pulse">
      Securing content...
    </p>
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
      <AuthProvider>
          <BrowserRouter>
              <AppSecurityWrapper>
                <MaintenanceBanner />
                <GlobalLogoTapHandler />
                <PremiumModalWrapper />
                <UpdateChecker />
                <DebugConsole />
                <React.Suspense fallback={<LazyFallbackLoader />}>
                  <Routes>
                    <Route path="/" element={<Splash />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/developer" element={<DeveloperConsole />} />
                    <Route path="/complete-profile" element={<CompleteProfile />} />
                    <Route path="/forgot-pin" element={<ForgotPin />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/recover-account" element={<RecoverAccount />} />
                    <Route path="/live/:shareableId" element={<PublicLiveTestLanding />} />
                    <Route path="/app" element={
                      <ProtectedRoute>
                        <MainLayout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<IndexRedirect />} />
                      <Route path="feed" element={<MissionFeedScreen />} />
                      <Route path="create/:activityType" element={<MentorPostCreationScreen />} />
                      <Route path="home" element={<Dashboard />} />
                      <Route path="users" element={<UserListScreen />} />
                      <Route path="notifications" element={<NotificationScreen />} />
                      <Route path="batches" element={<BatchListScreen />} />
                      <Route path="batches/create" element={<BatchCreateScreen />} />
                      <Route path="batches/:batchId" element={<BatchDetailScreen />} />
                      <Route path="targets" element={<TargetScreen />} />
                      <Route path="tests" element={<TestDashboardScreen />} />
                      <Route path="tests/ai-gen" element={<AITestCreatorWrapperInline />} />
                      <Route path="tests/attempt/:testId" element={<AttemptTestWrapperInline />} />
                      <Route path="tests/attempt-v2/:testId" element={<TestAttemptSessionWrapperInline />} />
                      <Route path="tests/result/:attemptId" element={<TestResultWrapperInline />} />
                      <Route path="profile" element={<ProfileScreen />} />
                      <Route path="missions" element={<MissionViewDistributor />} />
                      <Route path="mentor-place" element={
                        <RoleRoute allowedRoles={['mentor', 'primary-mentor', 'staff', 'admin']}>
                          <MentorPlace />
                        </RoleRoute>
                      } />
                      <Route path="community-management" element={
                        <RoleRoute allowedRoles={['mentor', 'primary-mentor', 'staff', 'admin']}>
                          <CommunityManagementScreen />
                        </RoleRoute>
                      } />
                      <Route path="ai-config" element={
                        <RoleRoute allowedRoles={['mentor', 'primary-mentor', 'staff', 'admin']}>
                          <AIConfigScreen />
                        </RoleRoute>
                      } />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </React.Suspense>
              </AppSecurityWrapper>
          </BrowserRouter>
      </AuthProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}

const AttemptTestWrapperInline = () => {
  const { testId } = useParams<{ testId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const forceNew = searchParams.get('forceNew') === 'true';
  return <AttemptTestView 
    testId={testId!} 
    forceNewAttempt={forceNew} 
    onExit={(attemptId) => {
      if (attemptId) {
        navigate(`/app/tests/result/${attemptId}`);
      } else {
        navigate('/app/tests');
      }
    }} 
  />;
};

const TestAttemptSessionWrapperInline = () => {
  return <TestAttemptSession />;
};

const TestResultWrapperInline = () => {
    const { attemptId } = useParams<{ attemptId: string }>();
    const navigate = useNavigate();
    return <TestResultView 
        attemptId={attemptId!} 
        onBack={() => navigate('/app/tests')} 
        onPracticeIncorrect={(practiceTestId) => navigate(`/app/tests/attempt/${practiceTestId}`)}
    />;
};

const AITestCreatorWrapperInline = () => {
  const navigate = useNavigate();
  return <AITestCreator onClose={() => navigate('/app/tests')} onSaved={() => navigate('/app/tests')} />;
};

const PremiumModalWrapper = () => {
    const { isPremiumModalOpen, setIsPremiumModalOpen } = useAppConfig();
    return <PremiumModal isOpen={isPremiumModalOpen} onClose={() => setIsPremiumModalOpen(false)} />;
};

const GlobalLogoTapHandler = () => {
  const navigate = useNavigate();
  React.useEffect(() => {
    let clickCount = 0;
    let lastClickTime = 0;
    
    const handleLogoTap = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
      const isLogo = target.getAttribute('alt')?.toLowerCase().includes('logo') || 
                     target.textContent?.includes('MissionGrid') || 
                     target.closest('[alt*="Logo"]') || 
                     target.closest('[id*="logo"]') ||
                     target.id?.includes('logo') ||
                     (typeof target.className === 'string' && target.className.includes('logo'));
                     
      if (isLogo) {
        const now = Date.now();
        if (now - lastClickTime < 2000) {
          clickCount++;
        } else {
          clickCount = 1;
        }
        lastClickTime = now;
        
        if (clickCount >= 7) {
          clickCount = 0;
          navigate('/developer');
        }
      }
    };
    
    window.addEventListener('click', handleLogoTap);
    return () => window.removeEventListener('click', handleLogoTap);
  }, [navigate]);
  return null;
};
