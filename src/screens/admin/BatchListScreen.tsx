import React, { useState, useEffect } from 'react';
import { Search, Plus, BookOpen, MoreVertical, Loader2 } from 'lucide-react';
import { Batch } from '../../models/mission';
import { BatchService } from '../../services/batch';
import { useNavigate } from 'react-router-dom';

export default function BatchListScreen() {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        loadBatches();
    }, []);

    const loadBatches = async () => {
        setLoading(true);
        try {
            const data = await BatchService.getBatches();
            setBatches(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredBatches = batches.filter(b => 
        b.batchName.toLowerCase().includes(search.toLowerCase()) ||
        b.batchCode.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-4 bg-slate-50 min-h-screen">
            <h1 className="text-2xl font-black text-slate-900 mb-6">Batch Management</h1>
            
            <div className="flex gap-2 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400"/>
                  <input 
                      className="w-full pl-10 p-3 rounded-2xl border border-slate-200 bg-white"
                      placeholder="Search batches..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <button onClick={() => navigate('/app/batches/create')} className="p-3 bg-indigo-600 text-white rounded-2xl">
                    <Plus/>
                </button>
            </div>

            {loading ? <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-600"/></div> : (
                <div className="space-y-3">
                    {filteredBatches.map(batch => (
                        <div key={batch.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                {batch.batchCode.substring(0, 2)}
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-slate-900">{batch.batchName}</p>
                                <p className="text-xs text-slate-500 uppercase">{batch.batchCode} • {batch.status}</p>
                            </div>
                            <button onClick={() => navigate(`/app/batches/${batch.id}`)} className="p-2 text-slate-500"><MoreVertical/></button>
                        </div>
                    ))}
                    {filteredBatches.length === 0 && (
                        <p className="text-center text-slate-500 py-10">No batches found.</p>
                    )}
                </div>
            )}
        </div>
    );
}
