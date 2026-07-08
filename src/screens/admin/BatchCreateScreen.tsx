import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BatchService } from '../../services/batch';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';

export default function BatchCreateScreen() {
    const [formData, setFormData] = useState({ 
        batchName: '', batchCode: '', description: '', communityLink: '', status: 'active' as 'active' | 'inactive' | 'archived' 
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { userProfile } = useAuth();

    const handleSubmit = async () => {
        if (!formData.batchName || !formData.batchCode) {
            setError('Please fill Name and Code.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await BatchService.createBatch({
                ...formData,
                mentorId: userProfile!.id!,
                examinerIds: [],
                studentIds: [],
                createdBy: userProfile!.id!
            });
            navigate('/app/batches');
        } catch (e: any) {
            setError('Failed to create batch.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-black text-slate-900">Create Batch</h1>
                <button onClick={() => navigate(-1)}><X size={24}/></button>
            </div>
            
            <div className="bg-white p-6 rounded-3xl space-y-4 shadow-sm border border-slate-100">
                {error && <p className="text-rose-600 text-sm">{error}</p>}
                <input className="w-full p-3 border rounded-xl" placeholder="Batch Name" value={formData.batchName} onChange={e => setFormData({...formData, batchName: e.target.value})}/>
                <input className="w-full p-3 border rounded-xl" placeholder="Batch Code" value={formData.batchCode} onChange={e => setFormData({...formData, batchCode: e.target.value})}/>
                <textarea className="w-full p-3 border rounded-xl" placeholder="Description" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}/>
                <input className="w-full p-3 border rounded-xl" placeholder="Telegram/Community Link" value={formData.communityLink} onChange={e => setFormData({...formData, communityLink: e.target.value})}/>
                <select className="w-full p-3 border rounded-xl" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                </select>

                <button onClick={handleSubmit} disabled={loading} className="w-full p-3 bg-indigo-600 text-white rounded-xl font-bold">
                    {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Create Batch'}
                </button>
            </div>
        </div>
    );
}
