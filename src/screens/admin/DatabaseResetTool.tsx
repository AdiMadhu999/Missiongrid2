import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { auth } from '../../services/firebase';
import { getIdToken } from 'firebase/auth';
import { apiFetch } from '../../utils/api';

export default function DatabaseResetTool({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleExecute = async () => {
    if (confirmation !== 'DELETE ALL STUDENTS') return;
    setLoading(true);
    setStatus('Executing reset...');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in.');
      const token = await getIdToken(user);
      
      const response = await apiFetch('/api/admin/reset-db', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Server returned HTML/Non-JSON: ${text.substring(0, 100)}...`);
      }
      if (!response.ok) throw new Error(data.error || 'Server error');
      setStatus(`Reset complete: ${JSON.stringify(data)}`);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ShieldAlert className="text-red-600" /> Database Reset Tool
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">WARNING: This action is irreversible. All student data will be removed. Mentor data will be preserved.</p>
            <button onClick={() => setStep(2)} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl">Proceed to Confirmation</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Type "DELETE ALL STUDENTS" to confirm.</p>
            <input 
              type="text" 
              value={confirmation} 
              onChange={e => setConfirmation(e.target.value)}
              className="w-full p-3 border rounded-xl"
              placeholder="DELETE ALL STUDENTS"
            />
            <button 
                onClick={() => setStep(3)} 
                disabled={confirmation !== 'DELETE ALL STUDENTS'}
                className="w-full py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50"
            >
              Verify
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-red-600 font-bold">FINAL CONFIRMATION: Are you sure you want to delete all students?</p>
            <button onClick={handleExecute} disabled={loading} className="w-full py-3 bg-red-900 text-white font-bold rounded-xl">
              {loading ? 'Executing...' : 'EXECUTE PERMANENT DELETE'}
            </button>
          </div>
        )}

        {status && <div className="mt-4 p-3 bg-slate-100 rounded-xl text-xs">{status}</div>}
      </div>
    </div>
  );
}
