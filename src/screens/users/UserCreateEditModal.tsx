import React, { useState } from 'react';
import { User } from '../../models/user';
import { createUserProfile, updateUserProfile, deleteUserProfile } from '../../services/users';
import { X, Loader2, Trash2 } from 'lucide-react';
import { BatchService } from '../../services/batch';

export default function UserCreateEditModal({ user, onClose }: { user?: User, onClose: () => void }) {
    const [formData, setFormData] = useState<Partial<User>>(user || { 
        name: '', mobile: '', role: 'student', status: 'active', batchId: '' 
    });
    const [loading, setLoading] = useState(false);
    const [batches, setBatches] = useState<any[]>([]);
    const [error, setError] = useState('');

    React.useEffect(() => {
        BatchService.getBatches().then(setBatches);
    }, []);

    const handleDelete = async () => {
        const idToDelete = user?.mobile || user?.id;
        console.log('Delete button clicked for:', idToDelete);
        if (!idToDelete) {
             setError('Cannot determine user ID to delete.');
             return;
        }
        if (!window.confirm('Permanently remove this user? This cannot be undone.')) return;
        
        setLoading(true);
        try {
            await deleteUserProfile(idToDelete);
            onClose();
        } catch (e: any) {
            console.error('Delete failed:', e);
            setError(e.message || 'Failed to delete user.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.mobile || !formData.role) {
            setError('Please fill all required fields.');
            return;
        }

        const sanitizedMobile = formData.mobile.replace(/\D/g, '');
        if (sanitizedMobile.length < 10) {
            setError('Mobile number must be at least 10 digits.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const finalData = { ...formData, mobile: sanitizedMobile };
            if (user) {
                await updateUserProfile(user.id || user.mobile!, finalData);
            } else {
                await createUserProfile({ ...finalData, pin: '123456' });
            }
            onClose();
        } catch (e: any) {
            setError(e.message || 'Failed to save user.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 p-4 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-3xl w-full max-w-sm space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-xl">{user ? 'Edit' : 'Enroll'} User</h2>
                    <div className="flex gap-2">
                        {user && (
                            <button onClick={handleDelete} className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-all">
                                <Trash2 size={18}/>
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                    </div>
                </div>
                {error && <p className="text-rose-600 text-sm">{error}</p>}
                
                <input className="w-full p-3 border rounded-xl" placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}/>
                <input className="w-full p-3 border rounded-xl" placeholder="Mobile Number" disabled={!!user} value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})}/>
                <select className="w-full p-3 border rounded-xl" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})}>
                    <option value="student">Student</option>
                    <option value="mentor">Mentor</option>
                    <option value="examiner">Examiner</option>
                </select>
                <select className="w-full p-3 border rounded-xl" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                </select>

                {formData.role === 'student' && (
                    <select className="w-full p-3 border rounded-xl" value={formData.batchId} onChange={e => setFormData({...formData, batchId: e.target.value})}>
                        <option value="">-- Select Batch --</option>
                        {batches.map((b, idx) => (
                            <option key={`${b.id || 'b'}-${idx}`} value={b.id}>{b.batchName} ({b.batchCode})</option>
                        ))}
                    </select>
                )}

                <button onClick={handleSubmit} disabled={loading} className="w-full p-3 bg-indigo-600 text-white rounded-xl font-bold">
                    {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Save User'}
                </button>
            </div>
        </div>
    );
}
