import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Calendar } from 'lucide-react';
import { getSystemSettings, updateSystemSettings } from '../../services/system';

const HolidayDeclarationModal = ({ onClose }: { onClose: () => void }) => {
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');

  const handleDeclare = async () => {
    if (!date || !label) return alert('Fill all fields');
    
    // Simplistic holiday storage
    const settings = await getSystemSettings();
    const holidays = [...(settings.institutionalHolidays || []), date];
    await updateSystemSettings({ institutionalHolidays: holidays });
    alert('Holiday declared');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 font-sans">
        <motion.div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-slate-100">
            <h3 className="text-xl font-black text-slate-900 mb-6">Declare Holiday</h3>
            <input type="date" className="w-full bg-slate-50 border rounded-2xl p-4 mb-4 outline-none" value={date} onChange={e => setDate(e.target.value)} />
            <input placeholder="Label" className="w-full bg-slate-50 border rounded-2xl p-4 mb-4 outline-none" value={label} onChange={e => setLabel(e.target.value)} />
            <button onClick={handleDeclare} className="w-full bg-indigo-600 text-white rounded-2xl p-4 font-black">Declare</button>
            <button onClick={onClose} className="w-full mt-4 p-4 text-slate-500 font-bold border rounded-2xl bg-slate-50">Close</button>
        </motion.div>
    </div>
  );
};

export default HolidayDeclarationModal;
