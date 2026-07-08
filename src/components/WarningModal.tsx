import React, { useState } from 'react';
import { addWarning } from '../services/warning';
import { useAuth } from '../providers/AuthProvider';

export default function WarningModal({ studentId, studentName, onClose, onSaved }: { studentId: string, studentName: string, onClose: () => void, onSaved: () => void }) {
    const { userProfile } = useAuth();
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!userProfile || !reason) return;
        setLoading(true);
        try {
            await addWarning({
                studentId,
                studentName,
                reason,
                mentorId: userProfile.id,
                mentorName: userProfile.name
            });
            onSaved();
            onClose();
        } catch (e) {
            console.error('Failed to add warning:', e);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
                <h2 className="font-black text-xl mb-4">Give Warning to {studentName}</h2>
                <select className="w-full p-3 border border-slate-200 rounded-xl mb-4" value={reason} onChange={e => setReason(e.target.value)}>
                    <option value="">Select Reason</option>
                    <option value="Daily Target Missed">Daily Target Missed</option>
                    <option value="No Submission">No Submission</option>
                    <option value="Mock Test Missed">Mock Test Missed</option>
                    <option value="Rule Violation">Rule Violation</option>
                    <option value="Misconduct">Misconduct</option>
                    <option value="Other">Other</option>
                </select>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 p-3 bg-slate-100 rounded-xl font-bold text-slate-700">Cancel</button>
                    <button onClick={handleSubmit} disabled={loading || !reason} className="flex-1 p-3 bg-rose-600 text-white rounded-xl font-bold disabled:opacity-50">
                        {loading ? 'Saving...' : 'Give Warning'}
                    </button>
                </div>
            </div>
        </div>
    );
}
