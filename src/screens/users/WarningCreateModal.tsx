import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { addWarning } from '../../services/warning';
import { useAuth } from '../../providers/AuthProvider';

interface Props {
    studentId: string;
    studentName: string;
    onClose: () => void;
    onSaved: () => void;
}

export default function WarningCreateModal({ studentId, studentName, onClose, onSaved }: Props) {
    const { userProfile } = useAuth();
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!reason.trim() || !userProfile) return;
        setLoading(true);
        try {
            await addWarning({
                studentId,
                studentName,
                mentorId: userProfile.uid,
                mentorName: userProfile.name || 'Mentor',
                reason
            });
            onSaved();
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 p-4 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-3xl w-full max-w-sm space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="text-rose-600" size={24}/>
                        <h2 className="font-bold text-xl text-slate-900">Issue Warning</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                
                <p className="text-sm text-slate-600">You are issuing an official warning to <span className="font-bold text-slate-900">{studentName}</span>. This action will be recorded in their history.</p>
                
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reason for Warning</label>
                    <textarea 
                        rows={4} 
                        value={reason} 
                        onChange={e => setReason(e.target.value)} 
                        className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none resize-none" 
                        placeholder="Describe why this warning is being issued..."
                    />
                </div>

                <div className="flex gap-2 pt-2">
                    <button onClick={onClose} className="flex-1 p-3 bg-slate-100 text-slate-900 rounded-2xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={loading || !reason.trim()} 
                        className="flex-[2] p-3 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-500 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Issuing...' : 'Issue Warning'}
                    </button>
                </div>
            </div>
        </div>
    );
}
