import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, FileText, Check, AlertTriangle, Eye, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { LeaveRequest } from '../../models/leave';
import { subscribeLeaveRequests, updateLeaveRequest } from '../../services/leave';
import { toast } from 'react-hot-toast';

interface LeaveRequestApprovalModalProps {
  onClose: () => void;
}

const LeaveRequestApprovalModal = ({ onClose }: LeaveRequestApprovalModalProps) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    // Real-time subscription so approval updates instantly with no refresh
    const unsubscribe = subscribeLeaveRequests((data) => {
      setRequests(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAction = async (id: string, status: 'approved' | 'rejected' | 'cancelled') => {
    try {
      await updateLeaveRequest(id, status);
      toast.success(`Leave request successfully ${status}!`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to update leave request status to ${status}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2.5 py-1 text-[9px] font-black tracking-widest bg-emerald-100 text-emerald-700 rounded-full uppercase">Approved</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 text-[9px] font-black tracking-widest bg-rose-100 text-rose-700 rounded-full uppercase">Rejected</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 text-[9px] font-black tracking-widest bg-amber-100 text-amber-700 rounded-full uppercase">Cancelled</span>;
      case 'pending':
      default:
        return <span className="px-2.5 py-1 text-[9px] font-black tracking-widest bg-blue-100 text-blue-700 rounded-full uppercase animate-pulse">Pending</span>;
    }
  };

  const filteredRequests = requests.filter(r => {
    if (activeTab === 'pending') {
      return r.status === 'pending';
    }
    return true; // all
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-2xl shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Leave Approvals</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Real-Time Leave Management</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 bg-slate-50 p-1.5 rounded-2xl shrink-0">
          <button 
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2 rounded-xl text-center font-black text-[10px] uppercase tracking-widest transition-all ${
              activeTab === 'pending' ? 'bg-slate-950 text-white' : 'text-slate-400'
            }`}
          >
            Pending Requests ({requests.filter(r => r.status === 'pending').length})
          </button>
          <button 
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 rounded-xl text-center font-black text-[10px] uppercase tracking-widest transition-all ${
              activeTab === 'all' ? 'bg-slate-950 text-white' : 'text-slate-400'
            }`}
          >
            All Requests ({requests.length})
          </button>
        </div>

        {/* Requests List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-1 min-h-[250px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
              <Loader2 className="animate-spin text-emerald-500 w-8 h-8 mb-2" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Fetching requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] border-2 border-dashed border-slate-100 rounded-3xl p-6">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No Leave Requests Found</p>
              <p className="text-xs font-semibold text-slate-400 mt-1">Leave requests will appear here in real-time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map(r => (
                <div key={r.id} className="p-5 bg-slate-50/80 border border-slate-100 rounded-3xl flex flex-col sm:flex-row justify-between gap-4 transition-all hover:bg-slate-50">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-slate-900 truncate">{r.studentName}</span>
                      {getStatusBadge(r.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Leave Date</span>
                        <span className="font-bold text-slate-700">{r.startDate}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Duration</span>
                        <span className="font-bold text-slate-700">{r.numberOfDays} {r.numberOfDays === 1 ? 'Day' : 'Days'}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Reason</span>
                      <p className="text-xs font-semibold text-slate-600 whitespace-pre-wrap">"{r.reason}"</p>
                    </div>

                    {r.attachmentUrl && (
                      <div className="pt-1.5">
                        <a 
                          href={r.attachmentUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-indigo-600 hover:text-indigo-800 hover:bg-slate-50 transition-all uppercase tracking-widest"
                        >
                          <FileText size={12} />
                          <span>View Attachment</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex sm:flex-col justify-end gap-2 shrink-0 sm:min-w-[120px]">
                    {r.status === 'pending' ? (
                      <>
                        <button 
                          onClick={() => handleAction(r.id!, 'approved')} 
                          className="flex-1 sm:flex-none py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => handleAction(r.id!, 'rejected')} 
                          className="flex-1 sm:flex-none py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Reject
                        </button>
                      </>
                    ) : r.status === 'approved' ? (
                      <button 
                        onClick={() => handleAction(r.id!, 'cancelled')} 
                        className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Cancel Leave
                      </button>
                    ) : (
                      <span className="text-[8px] font-black text-slate-400 uppercase text-center sm:text-right block w-full">Processed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button 
          onClick={onClose} 
          className="w-full mt-6 p-4 text-slate-500 hover:text-slate-700 font-bold text-xs border rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors shrink-0"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
};

export default LeaveRequestApprovalModal;
