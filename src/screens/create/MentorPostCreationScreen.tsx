import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit } from 'firebase/firestore';
import { useAuth } from '../../providers/AuthProvider';
import { MentorPostType } from '../../models/feed';
import { sendNotification } from '../../services/notifications';
import { BatchService } from '../../services/batch';

export default function MentorPostCreationScreen() {
    const { activityType } = useParams<{ activityType: string }>();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dayNumber, setDayNumber] = useState<number>(1);
    const [sendPush, setSendPush] = useState(true);
    const [category, setCategory] = useState<'Mentor Message' | 'Video Guidance' | 'Study Material'>('Mentor Message');
    const [batches, setBatches] = useState<any[]>([]);
    const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
    const [link, setLink] = useState('');
    const [embedVideo, setEmbedVideo] = useState(true);
    const [saving, setSaving] = useState(false);

    const [students, setStudents] = useState<any[]>([]);
    const [notifyMode, setNotifyMode] = useState<'all' | 'specific'>('all');
    const [notifiedStudentIds, setNotifiedStudentIds] = useState<string[]>([]);
    const [notifySearchTerm, setNotifySearchTerm] = useState('');

    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const data = await BatchService.getBatches();
                setBatches(data);
                if (data.length > 0) {
                    setSelectedBatchIds(data.map(b => b.id).filter(Boolean) as string[]);
                }
            } catch (error) {
                console.error("Error fetching batches:", error);
            }
        };
        fetchBatches();
    }, []);

    useEffect(() => {
        const fetchStudents = async () => {
            try {
                const q = query(collection(db, 'users'), where('role', '==', 'student'), limit(200));
                const snap = await getDocs(q);
                const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setStudents(list);
            } catch (error) {
                console.error("Error fetching students for notifications:", error);
            }
        };
        fetchStudents();
    }, []);

    const handlePublish = async (status: 'published' | 'draft') => {
        if (!title || !description) return;
        if (selectedBatchIds.length === 0) {
            alert('Please select at least one batch.');
            return;
        }
        setSaving(true);
        try {
            const isAllSelected = selectedBatchIds.length === batches.length;
            const docRef = await addDoc(collection(db, 'mentorPosts'), {
                title,
                content: description,
                postType: activityType as MentorPostType,
                type: 'MentorPost',
                authorId: userProfile?.id,
                authorName: userProfile?.name,
                visibility: isAllSelected ? 'global' : 'batch',
                batchId: selectedBatchIds[0] || null,
                batchIds: selectedBatchIds,
                dayNumber,
                sendPushNotification: sendPush,
                category,
                createdAt: serverTimestamp(),
                publishedStatus: status,
                pinnedStatus: false,
                youtubeLink: activityType === 'video' ? link : null,
                embedVideo: activityType === 'video' ? embedVideo : true,
                externalLink: activityType === 'link' ? link : null,
                notifyMode,
                notifiedStudentIds: notifyMode === 'specific' ? notifiedStudentIds : []
            });
            if (status === 'published' && sendPush) {
                let studentIdsToNotify: string[] = [];
                if (notifyMode === 'specific') {
                    studentIdsToNotify = notifiedStudentIds;
                } else {
                    const notifiedIds = new Set<string>();
                    students.forEach(student => {
                        const studentBatchId = student.batchId || '';
                        if (isAllSelected || selectedBatchIds.includes(studentBatchId)) {
                            const sId = student.id || student.uid;
                            if (sId && sId !== userProfile?.id && sId !== userProfile?.uid) {
                                notifiedIds.add(sId);
                            }
                        }
                    });
                    studentIdsToNotify = Array.from(notifiedIds);
                }

                for (const sId of studentIdsToNotify) {
                    await sendNotification(
                        sId,
                        userProfile?.uid || userProfile?.id || '',
                        'MentorPostCreated',
                        docRef.id,
                        `New Guide Post: ${title} 🔔`,
                        `Mentor ${userProfile?.name} posted a new guide entry: "${title}"`
                    );
                }
            }
            navigate('/app/guide');
        } catch (error) {
            console.error('Error publishing post:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 min-h-screen bg-slate-50">
            <button onClick={() => navigate('/app/guide')} className="flex items-center gap-2 text-slate-600 mb-6 font-bold">
                <ArrowLeft className="w-5 h-5" /> Back to Community
            </button>
            <h1 className="text-2xl font-black text-slate-900 capitalize tracking-tight mb-6">Create {activityType}</h1>
            
            <div className="space-y-4">
                <input 
                    type="text" 
                    placeholder="Title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 font-bold"
                />
                <textarea 
                    placeholder="Description" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 h-40 font-medium"
                />
                <div className="space-y-1">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Target Preparation Day Number</label>
                    <input 
                        type="number" 
                        placeholder="Target Day Number" 
                        value={dayNumber} 
                        onChange={(e) => setDayNumber(parseInt(e.target.value) || 1)}
                        className="w-full p-4 rounded-xl border border-slate-200 font-bold"
                    />
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer my-4">
                    <input 
                        type="checkbox" 
                        checked={sendPush} 
                        onChange={(e) => setSendPush(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                    />
                    Send Push Notification
                </label>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as 'Mentor Message' | 'Video Guidance' | 'Study Material')}
                    className="w-full p-4 rounded-xl border border-slate-200 font-bold"
                >
                    <option value="Mentor Message">Mentor Message</option>
                    <option value="Video Guidance">Video Guidance</option>
                    <option value="Study Material">Study Material</option>
                </select>
                {(activityType === 'video' || activityType === 'link') && (
                    <div className="space-y-4">
                        <input 
                            type="url" 
                            placeholder={activityType === 'video' ? "YouTube Link" : "External Link"}
                            value={link} 
                            onChange={(e) => setLink(e.target.value)}
                            className="w-full p-4 rounded-xl border border-slate-200"
                        />
                        {activityType === 'video' && (
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={embedVideo} 
                                    onChange={(e) => setEmbedVideo(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                                />
                                Embed video in application
                            </label>
                        )}
                        {activityType === 'video' && link && (() => {
                            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                            const match = link.match(regExp);
                            const videoId = (match && match[2].length === 11) ? match[2] : null;
                            if (videoId) {
                                return (
                                    <div className="rounded-xl overflow-hidden aspect-video bg-slate-100 relative">
                                        <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="YouTube Thumbnail" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play ml-1"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>
                )}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/85 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                            👥 Target Batches (Visibility)
                        </label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedBatchIds(batches.map(b => b.id).filter(Boolean) as string[])}
                                className="text-[10px] font-black text-indigo-600 uppercase tracking-wider hover:underline"
                            >
                                Select All
                            </button>
                            <span className="text-slate-300 text-xs">|</span>
                            <button
                                type="button"
                                onClick={() => setSelectedBatchIds([])}
                                className="text-[10px] font-black text-rose-500 uppercase tracking-wider hover:underline"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>
                    
                    {batches.length === 0 ? (
                        <p className="text-xs text-slate-500 font-bold italic">No active batches found.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {batches.map((batch) => {
                                const isChecked = selectedBatchIds.includes(batch.id || '');
                                return (
                                    <label 
                                        key={batch.id} 
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                                            isChecked 
                                                ? 'bg-indigo-50/55 border-indigo-200 text-indigo-900 font-extrabold' 
                                                : 'bg-slate-50 border-slate-200/60 hover:bg-slate-100/50 text-slate-600'
                                        }`}
                                    >
                                        <input 
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                                if (isChecked) {
                                                    setSelectedBatchIds(prev => prev.filter(id => id !== batch.id));
                                                } else {
                                                    setSelectedBatchIds(prev => [...prev, batch.id || '']);
                                                }
                                            }}
                                            className="w-4.5 h-4.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                        />
                                        <div className="flex flex-col text-left">
                                            <span className="text-xs font-bold leading-tight">{batch.batchName || batch.name}</span>
                                            <span className="text-[9px] text-slate-450 font-bold tracking-wide uppercase mt-0.5">{batch.batchCode || 'No Code'}</span>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                    {selectedBatchIds.length === 0 && (
                        <p className="text-[10px] text-rose-500 font-extrabold tracking-wide mt-1 animate-pulse">
                            ⚠️ Please select at least one batch for this post.
                        </p>
                    )}
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/85 shadow-sm space-y-3">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                        🔔 Student Notification Settings
                    </label>
                    <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                        Configure who should receive a notification when this guide post is published.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setNotifyMode('all')}
                            className={`flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl text-xs font-extrabold uppercase transition-all border ${
                                notifyMode === 'all'
                                    ? 'bg-indigo-600 text-white border-transparent shadow-md'
                                    : 'bg-white text-slate-650 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            🌐 All Batch Students
                        </button>
                        <button
                            type="button"
                            onClick={() => setNotifyMode('specific')}
                            className={`flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl text-xs font-extrabold uppercase transition-all border ${
                                notifyMode === 'specific'
                                    ? 'bg-indigo-600 text-white border-transparent shadow-md'
                                    : 'bg-white text-slate-650 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            🎯 Specific Students
                        </button>
                    </div>

                    {notifyMode === 'specific' && (
                        <div className="space-y-3 pt-2">
                            <input 
                                type="text"
                                placeholder="Search students by name..."
                                value={notifySearchTerm}
                                onChange={(e) => setNotifySearchTerm(e.target.value)}
                                className="w-full text-xs border border-slate-200 rounded-xl px-4 py-3 bg-slate-50 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />

                            {/* Selected Students Badges */}
                            {notifiedStudentIds.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {notifiedStudentIds.map(id => {
                                        const userObj = students.find(u => u.id === id);
                                        return (
                                            <span key={id} className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 font-extrabold px-3 py-1 rounded-full border border-indigo-100">
                                                <span>{userObj?.name || 'Student'}</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setNotifiedStudentIds(prev => prev.filter(x => x !== id))}
                                                    className="hover:bg-indigo-100 p-0.5 rounded-full"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Filtered Students List */}
                            <div className="max-h-52 overflow-y-auto border border-slate-200 bg-white rounded-xl divide-y divide-slate-100 shadow-inner">
                                {students
                                    .filter(user => {
                                        if (!notifySearchTerm.trim()) return true;
                                        return user.name?.toLowerCase().includes(notifySearchTerm.toLowerCase());
                                    })
                                    .map(user => {
                                        const isSelected = notifiedStudentIds.includes(user.id);
                                        return (
                                            <button
                                                key={user.id}
                                                type="button"
                                                onClick={() => {
                                                    if (isSelected) {
                                                        setNotifiedStudentIds(prev => prev.filter(id => id !== user.id));
                                                    } else {
                                                        setNotifiedStudentIds(prev => [...prev, user.id]);
                                                    }
                                                }}
                                                className={`w-full text-left px-4 py-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/50 font-black' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <img 
                                                        src={user.photoUrl || `https://ui-avatars.com/api/?name=${user.name}`} 
                                                        className="w-7 h-7 rounded-full object-cover border border-slate-100" 
                                                        alt="" 
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <div>
                                                        <p className="font-extrabold text-slate-900 leading-none">{user.name}</p>
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{user.batchCode || 'Student'}</p>
                                                    </div>
                                                </div>
                                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-black ${
                                                    isSelected ? 'bg-indigo-600 text-white border-transparent' : 'border-slate-300 text-transparent'
                                                }`}>
                                                    ✓
                                                </span>
                                            </button>
                                        );
                                    })}
                                {students.filter(user => {
                                    if (!notifySearchTerm.trim()) return true;
                                    return user.name?.toLowerCase().includes(notifySearchTerm.toLowerCase());
                                }).length === 0 && (
                                    <p className="p-4 text-slate-400 text-center text-xs font-bold">No students found</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex gap-4 mt-8">
                <button 
                    onClick={() => handlePublish('draft')}
                    disabled={saving}
                    className="flex-1 bg-slate-200 text-slate-700 py-4 rounded-xl font-bold"
                >
                    Save Draft
                </button>
                <button 
                    onClick={() => handlePublish('published')}
                    disabled={saving}
                    className="flex-1 bg-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                    {saving ? 'Publishing...' : <><Save className="w-5 h-5" /> Publish</>}
                </button>
            </div>
        </div>
    );
}
