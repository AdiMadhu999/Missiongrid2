import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { TargetService } from '../../services/target';
import { DailyTarget } from '../../models/mission';
import { BatchService } from '../../services/batch';
import { updateUserProfile } from '../../services/users';
import { Batch } from '../../models/mission';
import MentorTargetView from './MentorTargetView';
import StudentTargetView from './StudentTargetView';
import { Shield, ChevronDown } from 'lucide-react';
import { useCachedQuery } from '../../hooks/useCachedQuery';

export default function TargetScreen() {
  const { userProfile, currentUser } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [resolvedBatchId, setResolvedBatchId] = useState<string | undefined>(userProfile?.batchId);
  const [isBatchValid, setIsBatchValid] = useState<boolean | null>(null);

  // Synchronous cache-first state initialization using useCachedQuery
  const lowerRole = userProfile?.role?.toLowerCase() || '';
  const isMentor = lowerRole.includes('mentor') || lowerRole === 'staff';
  const queryEnabled = !!currentUser && !!userProfile && (isMentor || (isBatchValid !== false && resolvedBatchId !== undefined));

  const targetsQuery = useCachedQuery<DailyTarget[]>({
    queryKey: ['targets', userProfile?.role || '', resolvedBatchId || '', userProfile?.id || ''],
    queryFn: async () => [],
    enabled: queryEnabled,
    persistKey: userProfile?.uid ? `targets_cache_${userProfile.uid}` : undefined,
    subscribeFn: (callback) => {
      return TargetService.subscribeTargetsForUser(
        userProfile!.role,
        resolvedBatchId,
        userProfile!.id,
        (data) => {
          callback(data || []);
          setError(null);
        },
        (err) => {
          console.error("DEBUG: subscribeTargets error", err);
          setError("Failed to load targets. Please try again.");
        }
      );
    }
  });

  const targets = targetsQuery.data || [];
  const loading = targetsQuery.isLoading && targets.length === 0;

  useEffect(() => {
    const fetchBatches = async () => {
        const data = await BatchService.getBatches();
        setBatches(data);
    };
    fetchBatches();
  }, []);

  useEffect(() => {
    if (batches.length === 0) return;
    
    if (!userProfile?.batchId) {
      setIsBatchValid(false);
      setResolvedBatchId(undefined);
      return;
    }

    const currentBatch = batches.find(b => b.id === userProfile.batchId || b.batchCode === userProfile.batchId);
    
    if (currentBatch && currentBatch.status === 'active') {
      setIsBatchValid(true);
      setResolvedBatchId(currentBatch.id);
    } else {
      setIsBatchValid(false);
      setResolvedBatchId(undefined);
    }
  }, [userProfile?.batchId, batches]);

  const handleBatchChange = async (batchId: string) => {
    if (!userProfile) return;
    try {
      await updateUserProfile(userProfile.id, {
        batchId: batchId,
        batchChangedDate: new Date().toISOString(),
        batchChangedBy: 'Student'
      });
      // Reload will happen via AuthProvider
    } catch (e) {
      console.error("Failed to change batch:", e);
      setError("Failed to change batch. Please try again.");
    }
  };

  if (loading && targets.length === 0) {
    return (
      <div className="p-4 space-y-6 max-w-lg mx-auto animate-pulse">
        {/* Skeleton Date Picker */}
        <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-150">
          <div className="h-4 w-24 bg-slate-200 rounded"></div>
          <div className="h-4 w-12 bg-slate-200 rounded"></div>
        </div>

        {/* Skeleton Targets Coordinates */}
        {[1, 2].map(i => (
          <div key={`skeleton-${i}`} className="bg-white/80 p-5 rounded-[2.5rem] border border-slate-200/50 space-y-4">
            <div className="flex gap-3">
              <div className="w-12 h-12 bg-slate-200 rounded-2xl"></div>
              <div className="space-y-2 flex-1">
                <div className="h-3 w-16 bg-slate-300 rounded"></div>
                <div className="h-4 w-36 bg-slate-200 rounded"></div>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="h-3 w-full bg-slate-200 rounded"></div>
              <div className="h-3 w-4/5 bg-slate-200 rounded"></div>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3">
              <div className="h-3 w-16 bg-slate-200 rounded"></div>
              <div className="h-3 w-16 bg-slate-350 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-64 items-center justify-center space-y-4">
        <p className="text-red-500">{error}</p>
        <button onClick={() => window.location.reload()} className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold">Retry</button>
      </div>
    );
  }

  if (!isMentor && isBatchValid === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
        <div className="w-16 h-16 bg-white rounded-3xl shadow-sm border border-slate-200 flex items-center justify-center mb-4 text-amber-500">
          <Shield size={32}/>
        </div>
        <h3 className="font-bold text-slate-900 mb-1">
          {userProfile?.batchId ? "Batch Not Available" : "No Batch Selected"}
        </h3>
        <p className="text-slate-500 text-sm max-w-xs mb-6">
          {userProfile?.batchId 
            ? "Your previous Batch is no longer available. Please select a new Batch to continue your preparation."
            : "Please select an active Batch to continue."
          }
        </p>
        <div className="w-full max-w-xs">
          <select 
            onChange={(e) => handleBatchChange(e.target.value)}
            className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm"
            defaultValue=""
          >
            <option value="" disabled>Select an Active Batch</option>
            {batches.filter(b => b.status === 'active').map(b => <option key={b.id} value={b.id}>{b.batchName || b.batchCode}</option>)}
          </select>
        </div>
      </div>
    );
  }

  const batchSelector = (
      <div className="p-4 bg-white border-b border-slate-100">
        <label className="text-xs font-bold text-slate-500 mb-1 block">Current Batch</label>
        <div className="relative">
          <select 
            value={resolvedBatchId || ''} 
            onChange={(e) => handleBatchChange(e.target.value)}
            className="w-full p-3 bg-slate-50 rounded-xl font-bold text-sm appearance-none"
          >
            {batches.map(b => <option key={b.id} value={b.id}>{b.batchName || b.batchCode}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-4 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>
  );

  if (isMentor) {
    return (
      <div className='flex flex-col h-full'>
        {batchSelector}
        <MentorTargetView targets={targets} />
      </div>
    );
  }

  if (userProfile?.role === 'examiner') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
        <div className="w-16 h-16 bg-white rounded-3xl shadow-sm border border-slate-200 flex items-center justify-center mb-4 text-amber-500">
          <Shield size={32}/>
        </div>
        <h3 className="font-bold text-slate-900 mb-1">Access Resticted</h3>
        <p className="text-slate-500 text-sm max-w-xs">Examiners do not have permission to view or manage daily targets.</p>
      </div>
    );
  }

  const currentBatchObj = batches.find(b => b.id === resolvedBatchId);
  const currentBatchName = currentBatchObj?.batchName || userProfile?.batchId || 'Aspirants';

  return (
    <div className='flex flex-col h-full'>
        <StudentTargetView 
          targets={targets} 
          currentBatchName={currentBatchName} 
          batches={batches}
          currentBatchId={resolvedBatchId}
          onBatchChange={handleBatchChange}
        />
    </div>
  );
}
