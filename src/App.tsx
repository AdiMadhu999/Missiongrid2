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
import { ResponsiveLayoutProvider } from './components/ResponsiveLayoutProvider';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute';
import { UpdateChecker } from './components/UpdateChecker';

import Splash from './screens/Splash';
import Login from './screens/Login';
import MainLayout from './components/MainLayout';

import { AppSecurityWrapper } from './components/AppSecurityWrapper';
import { MaintenanceBanner } from './components/MaintenanceBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Route-level Resilient Lazy Loading to handle network hiccups or chunk updates smoothly
const Dashboard = lazyWithRetry(() => import('./screens/Dashboard'));
const CompleteProfile = lazyWithRetry(() => import('./screens/CompleteProfile'));
const ForgotPin = lazyWithRetry(() => import('./screens/ForgotPin'));
const RecoverAccount = lazyWithRetry(() => import('./screens/RecoverAccount'));
const DeveloperConsole = lazyWithRetry(() => import('./screens/DeveloperConsole'));
const PublicLiveTestLanding = lazyWithRetry(() => import('./screens/test/PublicLiveTestLanding'));
const TargetScreen = lazyWithRetry(() => import('./screens/targets/TargetScreen'));
const UserListScreen = lazyWithRetry(() => import('./screens/users/UserListScreen'));
const BatchListScreen = lazyWithRetry(() => import('./screens/admin/BatchListScreen'));
const BatchCreateScreen = lazyWithRetry(() => import('./screens/admin/BatchCreateScreen'));
const BatchDetailScreen = lazyWithRetry(() => import('./screens/admin/BatchDetailScreen'));
const ProfileScreen = lazyWithRetry(() => import('./screens/ProfileScreen'));
const MissionViewDistributor = lazyWithRetry(() => import('./screens/MissionViewDistributor'));
const MissionFeedScreen = lazyWithRetry(() => import('./screens/MissionFeedScreen'));
const MentorPostCreationScreen = lazyWithRetry(() => import('./screens/create/MentorPostCreationScreen'));
const MentorPlace = lazyWithRetry(() => import('./screens/mentor/MentorPlace'));
const CommunityManagementScreen = lazyWithRetry(() => import('./screens/mentor/CommunityManagementScreen'));
const StudyMaterialCreator = lazyWithRetry(() => import('./screens/mentor/StudyMaterialCreator'));
const StudentManagementScreen = lazyWithRetry(() => import('./screens/admin/StudentManagementScreen'));
const NotificationScreen = lazyWithRetry(() => import('./screens/NotificationScreen').then(m => ({ default: m.NotificationScreen })));
const TestDashboardScreen = lazyWithRetry(() => import('./screens/test/TestDashboardScreen'));
const TestAttemptSession = lazyWithRetry(() => import('./screens/test-v2/TestAttemptSession'));
const AIConfigScreen = lazyWithRetry(() => import('./screens/mentor/AIConfigScreen'));
const GenerationCenterPage = lazyWithRetry(() => import('./components/GenerationCenter').then(m => ({ default: m.GenerationCenter })));
const AttemptTestView = lazyWithRetry(() => import('./screens/test/AttemptTestView'));
const TestResultView = lazyWithRetry(() => import('./screens/test/TestResultView'));
const AITestCreator = lazyWithRetry(() => import('./screens/test/AITestCreator'));

const IndexRedirect = () => {
  const { userProfile } = useAuth();
  if (!userProfile) return null;
  return <Navigate to="home" replace />;
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
  React.useEffect(() => {
    const splash = document.querySelector('.initial-splash');
    if (splash) {
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 500); // match CSS duration
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <AuthProvider>
            <BrowserRouter>
              <ResponsiveLayoutProvider>
                <ServiceWorkerNavigationHandler />
                <AppSecurityWrapper>
                  <MaintenanceBanner />
                  <UpdateChecker />
                  <React.Suspense fallback={<LazyFallbackLoader />}>
                    <Routes>
                    <Route path="/" element={<Splash />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Navigate to="/login" replace />} />
                    <Route path="/developer" element={<DeveloperConsole />} />
                    <Route path="/complete-profile" element={<CompleteProfile />} />
                    <Route path="/forgot-pin" element={<ForgotPin />} />
                    <Route path="/recover-account" element={<RecoverAccount />} />
                    <Route path="/live/:shareableId" element={<PublicLiveTestLanding />} />
                    <Route path="/app" element={
                      <ProtectedRoute>
                        <MainLayout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<IndexRedirect />} />
                      <Route path="feed" element={<MissionFeedScreen feedType="all" />} />
                      <Route path="guide" element={<MissionFeedScreen feedType="guide" />} />
                      <Route path="create/:activityType" element={<MentorPostCreationScreen />} />
                      <Route path="home" element={<Dashboard />} />
                      <Route path="users" element={<UserListScreen />} />
                      <Route path="students" element={
                        <RoleRoute allowedRoles={['mentor', 'primary-mentor', 'staff', 'admin']}>
                          <StudentManagementScreen />
                        </RoleRoute>
                      } />
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
                      <Route path="study-material-creator" element={
                        <RoleRoute allowedRoles={['mentor', 'primary-mentor']}>
                          <StudyMaterialCreator />
                        </RoleRoute>
                      } />
                      <Route path="ai-config" element={
                        <RoleRoute allowedRoles={['mentor', 'primary-mentor', 'staff', 'admin']}>
                          <AIConfigScreen />
                        </RoleRoute>
                      } />
                      <Route path="generation-center" element={
                        <RoleRoute allowedRoles={['mentor', 'primary-mentor', 'staff', 'admin']}>
                          <GenerationCenterPage />
                        </RoleRoute>
                      } />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </React.Suspense>
              </AppSecurityWrapper>
            </ResponsiveLayoutProvider>
          </BrowserRouter>
        </AuthProvider>
      </AppProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

const ServiceWorkerNavigationHandler = () => {
    const navigate = useNavigate();
    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'NAVIGATE') {
                navigate(event.data.path);
            }
        };
        navigator.serviceWorker.addEventListener('message', handleMessage);
        return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }, [navigate]);
    return null;
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




