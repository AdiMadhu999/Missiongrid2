import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Calendar, Upload, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { requestLeave } from '../../services/leave';
import { User } from '../../models/user';
import { uploadFile } from '../../services/storage';
import { toast } from 'react-hot-toast';
import imageCompression from 'browser-image-compression';

interface ApplyLeaveModalProps {
  onClose: () => void;
  userProfile: User;
}

const ApplyLeaveModal = ({ onClose, userProfile }: ApplyLeaveModalProps) => {
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [numberOfDays, setNumberOfDays] = useState(1);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (file.type.startsWith('image/')) {
      try {
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        setAttachment(compressedFile);
        setAttachmentPreview(URL.createObjectURL(compressedFile));
      } catch (error) {
        console.error('Compression failed, using original:', error);
        setAttachment(file);
        setAttachmentPreview(URL.createObjectURL(file));
      }
    } else {
      setAttachment(file);
      setAttachmentPreview('');
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
      setAttachmentPreview('');
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Please enter a reason for the leave');
      return;
    }
    if (!startDate) {
      toast.error('Please select a leave start date');
      return;
    }
    if (numberOfDays <= 0) {
      toast.error('Number of days must be at least 1');
      return;
    }

    setLoading(true);
    try {
      let attachmentUrl = '';
      if (attachment) {
        const timestamp = Date.now();
        const sanitizedName = attachment.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `leaves/${userProfile.id || userProfile.uid}/${timestamp}_${sanitizedName}`;
        const { url } = await uploadFile(path, attachment);
        attachmentUrl = url;
      }

      await requestLeave({
        studentId: userProfile.id!,
        studentName: userProfile.name!,
        reason,
        startDate,
        numberOfDays,
        attachmentUrl,
        uid: userProfile.uid || ''
      });

      toast.success('Leave request submitted successfully!');
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Calendar size={18} />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Apply for Leave</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-1">
          {/* Leave Start Date */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Leave Date</label>
            <div className="relative">
              <input 
                type="date" 
                className="w-full bg-slate-50 border border-slate-150 rounded-2xl p-4 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-100/50 transition-all"
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
              />
            </div>
          </div>

          {/* Number of Days */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Number of Days</label>
            <input 
              type="number" 
              min="1"
              max="30"
              className="w-full bg-slate-50 border border-slate-150 rounded-2xl p-4 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-100/50 transition-all"
              value={numberOfDays} 
              onChange={e => setNumberOfDays(Math.max(1, parseInt(e.target.value) || 1))} 
            />
          </div>

          {/* Reason for Leave */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason</label>
            <textarea 
              placeholder="Why are you applying for emergency leave?" 
              className="w-full bg-slate-50 border border-slate-150 rounded-2xl p-4 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-100/50 min-h-[90px] transition-all" 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
            />
          </div>

          {/* Optional Attachment */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Optional Attachment</label>
            <div className="flex gap-3 items-center">
              {attachment ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-xs shrink-0 group">
                  {attachment.type.startsWith('image/') ? (
                    <img src={attachmentPreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-rose-50 p-1 text-center">
                      <FileText className="w-6 h-6 text-rose-500 mb-0.5" />
                      <p className="text-[7px] font-black text-rose-700 truncate w-full">{attachment.name}</p>
                    </div>
                  )}
                  <button 
                    onClick={removeAttachment}
                    className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-black transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <label className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group shrink-0">
                  <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 mb-0.5" />
                  <span className="text-[7px] font-black uppercase text-slate-400">Upload</span>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf" 
                    className="hidden" 
                    onChange={handleFileChange} 
                  />
                </label>
              )}
              <p className="text-[10px] font-medium text-slate-400 leading-normal">
                If you have a medical certificate, prescription, or travel ticket, upload it here to support your emergency request.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 mt-6 shrink-0">
          <button 
            onClick={handleSubmit} 
            disabled={loading} 
            className="w-full bg-slate-950 hover:bg-slate-900 text-white rounded-2xl p-4 font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 active:scale-97 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Submitting Request...
              </>
            ) : (
              'Apply Emergency Leave'
            )}
          </button>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="w-full p-4 text-slate-500 hover:text-slate-700 font-bold text-xs border rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ApplyLeaveModal;
