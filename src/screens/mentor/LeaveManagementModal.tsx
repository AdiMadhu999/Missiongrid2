import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Calendar } from 'lucide-react';
import { User } from '../../models/user';
import { updateUserProfile } from '../../services/users';

const LeaveManagementModal = ({ users, onClose, onUpdated }: { users: User[], onClose: () => void, onUpdated: () => void }) => {
    const [loading, setLoading] = useState(false);

    const toggleLeaveStatus = async (user: User) => {
        setLoading(true);
        try {
            await updateUserProfile(user.id || user.mobile!, { 
                excusedFromAttendance: !user.excusedFromAttendance 
            });
            onUpdated();
        } catch (e) {
            console.error(e);
            alert('Failed to update leave status');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 -xs flex items-center justify-center z-[70] p-4 font-sans">
            <motion.div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Leave Management</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {users.map(u => (
                        <div key={u.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                            <span className="text-xs font-bold text-slate-800">{u.name}</span>
                            <button 
                                onClick={() => toggleLeaveStatus(u)}
                                disabled={loading}
                                className={`text-[10px] font-black px-3 py-1 rounded-full ${u.excusedFromAttendance ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}
                            >
                                {u.excusedFromAttendance ? 'On Leave' : 'Active'}
                            </button>
                        </div>
                    ))}
                </div>
                <button onClick={onClose} className="w-full mt-4 p-4 text-slate-500 font-bold border rounded-2xl bg-slate-50">Close</button>
            </motion.div>
        </div>
    );
};

export default LeaveManagementModal;
