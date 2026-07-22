import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Mic, Square, Play, Pause, Trash2, Plus } from 'lucide-react';
import { db, auth } from '../../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../providers/AuthProvider';
import { MentorPostType } from '../../models/feed';
import { uploadFile } from '../../services/storage';
import { BatchService } from '../../services/batch';
import { getUsersByBatch, getUsersByRole } from '../../services/users';
import { sendNotification } from '../../services/notifications';

interface CreatePostModalProps {
    isOpen: boolean;
    onClose: () => void;
    postType: MentorPostType | 'doubt';
}

export const CreatePostModal = ({ isOpen, onClose, postType }: CreatePostModalProps) => {
    const { userProfile } = useAuth();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [link, setLink] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
    const [potentialParticipants, setPotentialParticipants] = useState<any[]>([]);
    const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
    const [participantSearchTerm, setParticipantSearchTerm] = useState('');
    const [notifyMode, setNotifyMode] = useState<'all' | 'specific'>('all');
    const [notifiedStudentIds, setNotifiedStudentIds] = useState<string[]>([]);
    const [notifySearchTerm, setNotifySearchTerm] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [batches, setBatches] = useState<any[]>([]);
    const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Poll States
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    const [dayNumber, setDayNumber] = useState<number>(1);
    const [category, setCategory] = useState<'Mentor Message' | 'Video Guidance' | 'Study Material'>('Mentor Message');
    const [sendPush, setSendPush] = useState(true);

    // Voice Note States
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string>('');
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (isOpen && (postType !== 'doubt' || userProfile?.role === 'mentor')) {
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
        }
    }, [isOpen, postType, userProfile?.role]);

    useEffect(() => {
        if (isOpen && (postType === 'doubt' || userProfile?.role === 'mentor')) {
            const fetchParticipants = async () => {
                try {
                    let participantsList: any[] = [];
                    
                    // 1. Fetch students
                    if (userProfile?.role === 'mentor') {
                        const students = await getUsersByRole('student');
                        participantsList = [...participantsList, ...students];
                    } else if (userProfile?.batchId) {
                        const batchStudents = await getUsersByBatch(userProfile.batchId);
                        participantsList = [...participantsList, ...batchStudents];
                    }
                    
                    // 2. Fetch mentors
                    const mentors = await getUsersByRole('mentor');
                    participantsList = [...participantsList, ...mentors];

                    // Remove current user from the list
                    participantsList = participantsList.filter(u => u.id !== userProfile?.id && u.id !== userProfile?.uid);

                    // De-duplicate list by ID
                    const uniqueMap: Record<string, any> = {};
                    participantsList.forEach(p => {
                        if (p.id) uniqueMap[p.id] = p;
                    });

                    setPotentialParticipants(Object.values(uniqueMap));
                } catch (error) {
                    console.error("Error fetching participants:", error);
                }
            };
            fetchParticipants();
        }
    }, [isOpen, postType, userProfile?.batchId, userProfile?.id, userProfile?.uid, userProfile?.role]);

    // Cleanup recording and playing on close/unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (audioPlayerRef.current) {
                audioPlayerRef.current.pause();
            }
        };
    }, []);

    if (!isOpen) return null;

    // Reset Modal Form States on postType change
    const resetStates = () => {
        setTitle('');
        setContent('');
        setLink('');
        setImageUrl('');
        setSelectedFile(null);
        setPreviewUrl('');
        setPollOptions(['', '']);
        setDayNumber(1);
        setCategory('Mentor Message');
        setSendPush(true);
        setIsRecording(false);
        setRecordingDuration(0);
        setAudioBlob(null);
        setAudioPreviewUrl('');
        setIsPreviewPlaying(false);
        setSelectedParticipantIds([]);
        setParticipantSearchTerm('');
        setNotifyMode('all');
        setNotifiedStudentIds([]);
        setNotifySearchTerm('');
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    // Voice Recording Functions
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                setAudioBlob(blob);
                setAudioPreviewUrl(URL.createObjectURL(blob));
                // Stop all audio tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingDuration(0);
            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Please allow microphone access to record audio.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    const playPreview = () => {
        if (!audioPreviewUrl) return;
        if (!audioPlayerRef.current) {
            audioPlayerRef.current = new Audio(audioPreviewUrl);
            audioPlayerRef.current.onended = () => {
                setIsPreviewPlaying(false);
            };
        }
        if (isPreviewPlaying) {
            audioPlayerRef.current.pause();
            setIsPreviewPlaying(false);
        } else {
            audioPlayerRef.current.play();
            setIsPreviewPlaying(true);
        }
    };

    const deleteRecording = () => {
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current = null;
        }
        setAudioBlob(null);
        setAudioPreviewUrl('');
        setIsPreviewPlaying(false);
        setRecordingDuration(0);
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Poll Helper Functions
    const handlePollOptionChange = (index: number, value: string) => {
        const newOptions = [...pollOptions];
        newOptions[index] = value;
        setPollOptions(newOptions);
    };

    const addPollOption = () => {
        if (pollOptions.length < 6) {
            setPollOptions([...pollOptions, '']);
        }
    };

    const removePollOption = (index: number) => {
        if (pollOptions.length > 2) {
            setPollOptions(pollOptions.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let finalImageUrl = imageUrl;
            let finalAudioUrl = '';
            
            if (selectedFile) {
                const path = `posts/${userProfile?.id || userProfile?.uid}/${Date.now()}_${selectedFile.name}`;
                const result = await uploadFile(path, selectedFile);
                finalImageUrl = result.url;
            }

            if (postType === 'voiceNote' && audioBlob) {
                const file = new File([audioBlob], `voice_${Date.now()}.wav`, { type: 'audio/wav' });
                const path = `posts/${userProfile?.id || userProfile?.uid}/${Date.now()}_voice.wav`;
                const result = await uploadFile(path, file);
                finalAudioUrl = result.url;
            }

            if (postType === 'doubt') {
                const isMentor = userProfile?.role === 'mentor';
                if (isMentor && selectedBatchIds.length === 0) {
                    alert('Please select at least one batch.');
                    setLoading(false);
                    return;
                }
                const isAllSelected = isMentor && selectedBatchIds.length === batches.length;

                const docRef = await addDoc(collection(db, 'discussions'), {
                    type: 'Doubt',
                    title,
                    content,
                    privacy,
                    sharedWith: selectedParticipantIds,
                    userId: auth.currentUser?.uid || userProfile?.uid,
                    authorId: userProfile?.id || userProfile?.uid || auth.currentUser?.uid,
                    authorName: userProfile?.name || 'Unknown',
                    authorPhoto: userProfile?.photoUrl || '',
                    authorRole: userProfile?.role || 'student',
                    batchId: isMentor ? (selectedBatchIds[0] || '') : (userProfile?.batchId || ''),
                    batchIds: isMentor ? selectedBatchIds : [userProfile?.batchId || ''],
                    visibility: isMentor ? (isAllSelected ? 'global' : 'batch') : 'batch',
                    status: 'Unsolved',
                    createdAt: serverTimestamp(),
                    replyCount: 0,
                    likes: [],
                    saves: [],
                    comments: 0,
                    imageUrl: finalImageUrl || '',
                    mentorId: userProfile?.mentorId || '',
                    seenBy: [userProfile?.id || userProfile?.uid || auth.currentUser?.uid],
                    seenByDetails: [{
                        uid: userProfile?.id || userProfile?.uid || auth.currentUser?.uid,
                        name: userProfile?.name || 'Unknown',
                        photoUrl: userProfile?.photoUrl || ''
                    }]
                });

                // Trigger instant notifications for the concerned students
                if (isMentor) {
                    if (privacy === 'private' && selectedParticipantIds.length > 0) {
                        for (const studentId of selectedParticipantIds) {
                            await sendNotification(
                                studentId,
                                userProfile?.uid || userProfile?.id || '',
                                'PrivateDoubtInvitation',
                                docRef.id,
                                'New Private Doubt Room',
                                `Mentor ${userProfile?.name} opened a private doubt room with you: "${title}"`
                            );
                        }
                    } else if (privacy === 'public') {
                        try {
                            const studentsToNotify: any[] = [];
                            for (const bId of selectedBatchIds) {
                                const batchStudents = await getUsersByBatch(bId);
                                studentsToNotify.push(...batchStudents);
                            }
                            const notifiedIds = new Set<string>();
                            for (const student of studentsToNotify) {
                                const sId = student.id || student.uid;
                                if (sId && sId !== userProfile?.id && sId !== userProfile?.uid && !notifiedIds.has(sId)) {
                                    notifiedIds.add(sId);
                                    await sendNotification(
                                        sId,
                                        userProfile?.uid || userProfile?.id || '',
                                        'PublicDoubtCreated',
                                        docRef.id,
                                        'New Public Doubt',
                                        `Mentor ${userProfile?.name} posted a public doubt: "${title}"`
                                    );
                                }
                            }
                        } catch (notifyErr) {
                            console.error("Error sending batch notifications:", notifyErr);
                        }
                    }
                } else {
                    if (privacy === 'private' && selectedParticipantIds.length > 0) {
                        for (const pId of selectedParticipantIds) {
                            await sendNotification(
                                pId,
                                userProfile?.uid || userProfile?.id || '',
                                'PrivateDoubtInvitation',
                                docRef.id,
                                'New Private Doubt',
                                `${userProfile?.name} invited you to a private doubt: "${title}"`
                            );
                        }
                    }
                }
            } else {
                if (selectedBatchIds.length === 0) {
                    alert('Please select at least one batch.');
                    setLoading(false);
                    return;
                }
                const isAllSelected = selectedBatchIds.length === batches.length;
                
                const postPayload: any = {
                    type: 'MentorPost',
                    postType,
                    title,
                    content,
                    authorId: userProfile?.id || userProfile?.uid,
                    authorName: userProfile?.name || 'Unknown',
                    authorPhoto: userProfile?.photoUrl || '',
                    authorRole: userProfile?.role || 'mentor',
                    batchId: selectedBatchIds[0] || '',
                    batchIds: selectedBatchIds,
                    visibility: isAllSelected ? 'global' : 'batch',
                    publishedStatus: 'published',
                    pinnedStatus: false,
                    youtubeLink: postType === 'video' ? link : '',
                    externalLink: (postType === 'pdf' || postType === 'link') ? link : '',
                    imageUrl: finalImageUrl || '',
                    createdAt: serverTimestamp(),
                    likes: [],
                    saves: [],
                    comments: 0,
                    views: 1,
                    dayNumber,
                    category,
                    sendPushNotification: sendPush,
                    seenBy: [userProfile?.id || userProfile?.uid],
                    seenByDetails: [{
                        uid: userProfile?.id || userProfile?.uid,
                        name: userProfile?.name || 'Unknown',
                        photoUrl: userProfile?.photoUrl || ''
                    }],
                    notifyMode,
                    notifiedStudentIds: notifyMode === 'specific' ? notifiedStudentIds : []
                };

                if (postType === 'poll') {
                    postPayload.pollOptions = pollOptions
                        .filter(opt => opt.trim() !== '')
                        .map(opt => ({
                            id: Math.random().toString(36).substring(2, 11),
                            text: opt.trim(),
                            votes: []
                        }));
                }

                if (postType === 'voiceNote' && finalAudioUrl) {
                    postPayload.audioUrl = finalAudioUrl;
                    postPayload.duration = formatDuration(recordingDuration);
                }

                const docRef = await addDoc(collection(db, 'mentorPosts'), postPayload);

                // Send instant notifications to the students
                try {
                    let studentIdsToNotify: string[] = [];
                    if (notifyMode === 'specific') {
                        studentIdsToNotify = notifiedStudentIds;
                    } else {
                        const studentsToNotify: any[] = [];
                        for (const bId of selectedBatchIds) {
                            const batchStudents = await getUsersByBatch(bId);
                            studentsToNotify.push(...batchStudents);
                        }
                        const notifiedIds = new Set<string>();
                        for (const student of studentsToNotify) {
                            const sId = student.id || student.uid;
                            if (sId && sId !== userProfile?.id && sId !== userProfile?.uid && !notifiedIds.has(sId)) {
                                notifiedIds.add(sId);
                            }
                        }
                        studentIdsToNotify = Array.from(notifiedIds);
                    }

                    if (sendPush) {
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
                } catch (notifyErr) {
                    console.error("Error sending mentor post notifications:", notifyErr);
                }
            }

            resetStates();
            onClose();
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Failed to create post');
        } finally {
            setLoading(false);
        }
    };

    // Form validation check
    const isFormValid = () => {
        if (!title.trim()) return false;
        if (postType === 'doubt' && !content.trim()) return false;
        if (postType === 'article' && !content.trim()) return false;
        if (postType === 'announcement' && !content.trim()) return false;
        if (postType === 'video' && !link) return false;
        if (postType === 'pdf' && !link) return false;
        if (postType === 'poll') {
            const filledOptions = pollOptions.filter(o => o.trim() !== '');
            return filledOptions.length >= 2;
        }
        if (postType === 'voiceNote' && !audioBlob) return false;
        return true;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="font-extrabold text-slate-900 capitalize text-lg flex items-center gap-2">
                        {postType === 'voiceNote' && <Mic className="w-5 h-5 text-emerald-500" />}
                        {postType === 'poll' && <span className="text-xl">📊</span>}
                        Create {postType === 'doubt' ? 'Doubt' : postType === 'voiceNote' ? 'Voice Post' : postType === 'video' ? 'Video Post' : postType}
                    </h2>
                    <button onClick={() => { resetStates(); onClose(); }} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                {postType === 'poll' ? 'Poll Question' : 'Title'}
                            </label>
                            <input 
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                                placeholder={postType === 'poll' ? "e.g., Which topic do you want a session on tomorrow?" : "Enter a descriptive title..."}
                                required
                            />
                        </div>

                        {postType !== 'voiceNote' && postType !== 'poll' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Content / Description</label>
                                <textarea 
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                                    placeholder="Write your content details here..."
                                    required={postType === 'doubt' || postType === 'article' || postType === 'announcement'}
                                />
                            </div>
                        )}

                        {postType !== 'doubt' && (
                            <>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Target Preparation Day Number</label>
                                    <input 
                                        type="number" 
                                        placeholder="Target Day Number" 
                                        value={dayNumber} 
                                        onChange={(e) => setDayNumber(parseInt(e.target.value) || 1)}
                                        className="w-full p-3 rounded-xl border border-slate-200 font-bold text-sm"
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
                                    className="w-full p-3 rounded-xl border border-slate-200 font-bold text-sm"
                                >
                                    <option value="Mentor Message">Mentor Message</option>
                                    <option value="Video Guidance">Video Guidance</option>
                                    <option value="Study Material">Study Material</option>
                                </select>
                            </>
                        )}

                        {postType === 'doubt' && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-250 space-y-2">
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                                    🔒 Doubt Privacy
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPrivacy('public')}
                                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase transition-all border ${
                                            privacy === 'public'
                                                ? 'bg-indigo-600 text-white border-transparent shadow-md'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        🌐 Public Doubt
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPrivacy('private')}
                                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black uppercase transition-all border ${
                                            privacy === 'private'
                                                ? 'bg-rose-600 text-white border-transparent shadow-md'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        🔒 Private Doubt
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                                    {privacy === 'public' 
                                        ? "Public doubts are visible to all students in your batch. Mentors or other students can reply."
                                        : "Private doubts are only visible to you and your mentors. Perfect for confidential queries."
                                    }
                                </p>
                            </div>
                        )}

                        {postType === 'doubt' && privacy === 'private' && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-250 space-y-3">
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                                    👥 Invite specific batchmates / mentors (Optional)
                                </label>
                                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                                    Search and select people from your batch or coordinator list to invite them into this private doubt room.
                                </p>
                                
                                {/* Search Input */}
                                <input 
                                    type="text"
                                    placeholder="Search by name..."
                                    value={participantSearchTerm}
                                    onChange={(e) => setParticipantSearchTerm(e.target.value)}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />

                                {/* Selected Users Badges */}
                                {selectedParticipantIds.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {selectedParticipantIds.map(id => {
                                            const userObj = potentialParticipants.find(u => u.id === id);
                                            return (
                                                <span key={id} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 font-black px-2 py-0.5 rounded-full border border-indigo-100">
                                                    <span>{userObj?.name || 'User'}</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setSelectedParticipantIds(prev => prev.filter(x => x !== id))}
                                                        className="hover:bg-indigo-100 p-0.5 rounded-full"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Filtered Search List */}
                                <div className="max-h-40 overflow-y-auto border border-slate-200 bg-white rounded-xl divide-y divide-slate-100">
                                    {potentialParticipants
                                        .filter(user => {
                                            if (!participantSearchTerm.trim()) return true;
                                            return user.name?.toLowerCase().includes(participantSearchTerm.toLowerCase());
                                        })
                                        .map(user => {
                                            const isSelected = selectedParticipantIds.includes(user.id);
                                            return (
                                                <button
                                                    key={user.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedParticipantIds(prev => prev.filter(id => id !== user.id));
                                                        } else {
                                                            setSelectedParticipantIds(prev => [...prev, user.id]);
                                                        }
                                                    }}
                                                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <img 
                                                            src={user.photoUrl || `https://ui-avatars.com/api/?name=${user.name}`} 
                                                            className="w-6 h-6 rounded-full object-cover border border-slate-100" 
                                                            alt="" 
                                                            referrerPolicy="no-referrer"
                                                        />
                                                        <div>
                                                            <p className="font-extrabold text-slate-900 leading-none">{user.name}</p>
                                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                                                {user.role === 'mentor' ? 'Coordinating Mentor' : 'Batchmate'}
                                                            </p>
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
                                    {potentialParticipants.filter(user => {
                                        if (!participantSearchTerm.trim()) return true;
                                        return user.name?.toLowerCase().includes(participantSearchTerm.toLowerCase());
                                    }).length === 0 && (
                                        <p className="p-3 text-slate-400 text-center text-[11px] font-bold">No participants found</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* VOICE RECORDING CONTAINER */}
                        {postType === 'voiceNote' && (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                <label className="block text-xs font-bold text-slate-700 mb-2 text-center uppercase tracking-wider">
                                    🎤 Tap to Record Voice Post
                                </label>
                                
                                <div className="flex flex-col items-center justify-center py-4 gap-3">
                                    {isRecording ? (
                                        <div className="flex flex-col items-center gap-2">
                                            {/* Pulsing Recording Wave Animation */}
                                            <div className="flex items-center gap-1 h-10 mb-2">
                                                {Array.from({ length: 9 }).map((_, i) => (
                                                    <div 
                                                        key={i} 
                                                        className="w-1.5 bg-red-500 rounded-full animate-bounce"
                                                        style={{ 
                                                            height: `${20 + Math.random() * 20}px`,
                                                            animationDelay: `${i * 0.1}s`,
                                                            animationDuration: '0.6s'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-rose-600 text-sm font-black animate-pulse flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 bg-rose-600 rounded-full" />
                                                Recording: {formatDuration(recordingDuration)}
                                            </span>
                                            
                                            <button 
                                                type="button"
                                                onClick={() => stopRecording()}
                                                className="mt-3 p-4 bg-rose-600 text-white rounded-full hover:bg-rose-700 transition shadow-lg shadow-rose-200 hover:scale-105 active:scale-95"
                                            >
                                                <Square className="w-6 h-6 fill-white" />
                                            </button>
                                        </div>
                                    ) : audioPreviewUrl ? (
                                        <div className="w-full space-y-4">
                                            <div className="flex items-center gap-3 bg-white p-3 border border-slate-150 rounded-xl shadow-sm">
                                                <button 
                                                    type="button"
                                                    onClick={() => playPreview()}
                                                    className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition shrink-0"
                                                >
                                                    {isPreviewPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                                                </button>
                                                <div className="flex-1">
                                                    <p className="text-xs font-black text-slate-700">Voice Note Preview</p>
                                                    <p className="text-[10px] text-slate-400 font-bold">Duration: {formatDuration(recordingDuration)}</p>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => deleteRecording()}
                                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center">
                                            <button 
                                                type="button"
                                                onClick={() => startRecording()}
                                                className="p-5 bg-gradient-to-tr from-emerald-500 to-teal-500 text-white rounded-full hover:from-emerald-600 hover:to-teal-600 transition shadow-lg shadow-emerald-250 hover:scale-105 active:scale-95 mb-2"
                                            >
                                                <Mic className="w-8 h-8" />
                                            </button>
                                            <p className="text-xs text-slate-500 font-bold">Click button to begin recording</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* POLL OPTIONS CONTAINER */}
                        {postType === 'poll' && (
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                                    📝 Poll Options (Min 2, Max 6)
                                </label>
                                <div className="space-y-2">
                                    {pollOptions.map((option, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <span className="text-xs font-black text-slate-400 w-5 text-right">{idx + 1}.</span>
                                            <input 
                                                type="text"
                                                value={option}
                                                onChange={e => handlePollOptionChange(idx, e.target.value)}
                                                placeholder={`Option ${idx + 1}...`}
                                                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                                            />
                                            {pollOptions.length > 2 && (
                                                <button 
                                                    type="button"
                                                    onClick={() => removePollOption(idx)}
                                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {pollOptions.length < 6 && (
                                    <button 
                                        type="button"
                                        onClick={addPollOption}
                                        className="mt-2 flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-700 hover:underline px-1 py-1"
                                    >
                                        <Plus className="w-4 h-4" /> Add Poll Option
                                    </button>
                                )}
                            </div>
                        )}

                        {postType === 'video' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">YouTube Link</label>
                                <input 
                                    type="url"
                                    value={link}
                                    onChange={e => setLink(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                                    placeholder="https://youtube.com/watch?v=..."
                                    required
                                />
                            </div>
                        )}

                        {postType === 'pdf' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">PDF Document URL</label>
                                <input 
                                    type="url"
                                    value={link}
                                    onChange={e => setLink(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                                    placeholder="https://example.com/document.pdf"
                                    required
                                />
                            </div>
                        )}
                        
                        {(postType === 'doubt' || postType === 'image' || postType === 'article' || postType === 'announcement') && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Attach Image (Optional)</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 transition" onClick={() => fileInputRef.current?.click()}>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        ref={fileInputRef} 
                                        onChange={handleFileChange} 
                                    />
                                    {previewUrl ? (
                                        <div className="relative inline-block">
                                            <img src={previewUrl} alt="Preview" className="max-h-32 rounded-lg object-contain" />
                                            <button 
                                                type="button" 
                                                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPreviewUrl(''); }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="bg-indigo-50 p-2 rounded-full text-indigo-600">
                                                <ImageIcon className="w-5 h-5" />
                                            </div>
                                            <p className="text-xs text-slate-500">Click to upload an image</p>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-2 text-center text-xs text-slate-400 font-medium font-bold">OR</div>
                                <input 
                                    type="url"
                                    value={imageUrl}
                                    onChange={e => setImageUrl(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 mt-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                                    placeholder="Enter image URL directly..."
                                />
                            </div>
                        )}

                        {userProfile?.role === 'mentor' && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-2 max-h-48 overflow-y-auto">
                                <div className="flex justify-between items-center">
                                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                                        👥 Target Batches (Visibility)
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedBatchIds(batches.map(b => b.id).filter(Boolean) as string[])}
                                            className="text-[9px] font-black text-indigo-600 uppercase tracking-wider hover:underline"
                                        >
                                            All
                                        </button>
                                        <span className="text-slate-300 text-xs">|</span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedBatchIds([])}
                                            className="text-[9px] font-black text-rose-500 uppercase tracking-wider hover:underline"
                                        >
                                            None
                                        </button>
                                    </div>
                                </div>
                                
                                {batches.length === 0 ? (
                                    <p className="text-[11px] text-slate-500 font-bold italic">No active batches found.</p>
                                ) : (
                                    <div className="space-y-1.5 mt-1">
                                        {batches.map((batch) => {
                                            const isChecked = selectedBatchIds.includes(batch.id || '');
                                            return (
                                                <label 
                                                    key={batch.id} 
                                                    className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-all select-none ${
                                                        isChecked 
                                                            ? 'bg-indigo-50/40 border-indigo-200 text-indigo-900 font-extrabold' 
                                                            : 'bg-white border-slate-150 hover:bg-slate-100/50 text-slate-600'
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
                                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                                    />
                                                    <div className="flex flex-col text-left leading-none">
                                                        <span className="text-xs font-bold">{batch.batchName || batch.name}</span>
                                                        <span className="text-[8px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">{batch.batchCode || 'No Code'}</span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                                {selectedBatchIds.length === 0 && (
                                    <p className="text-[9px] text-rose-500 font-black tracking-wide mt-1 animate-pulse">
                                        ⚠️ Please select at least one batch.
                                    </p>
                                )}
                            </div>
                        )}

                        {userProfile?.role === 'mentor' && postType !== 'doubt' && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3 mt-4">
                                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                                    🔔 Student Notification Settings
                                </label>
                                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                                    Configure who should receive a notification when this guide post is published.
                                </p>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNotifyMode('all')}
                                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all border ${
                                            notifyMode === 'all'
                                                ? 'bg-indigo-600 text-white border-transparent shadow-xs'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        🌐 All Batch Students
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNotifyMode('specific')}
                                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all border ${
                                            notifyMode === 'specific'
                                                ? 'bg-indigo-600 text-white border-transparent shadow-xs'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        🎯 Specific Students
                                    </button>
                                </div>

                                {notifyMode === 'specific' && (
                                    <div className="space-y-2 pt-1">
                                        <input 
                                            type="text"
                                            placeholder="Search students to notify..."
                                            value={notifySearchTerm}
                                            onChange={(e) => setNotifySearchTerm(e.target.value)}
                                            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />

                                        {/* Selected Students Badges */}
                                        {notifiedStudentIds.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {notifiedStudentIds.map(id => {
                                                    const userObj = potentialParticipants.find(u => u.id === id);
                                                    return (
                                                        <span key={id} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                                                            <span>{userObj?.name || 'Student'}</span>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setNotifiedStudentIds(prev => prev.filter(x => x !== id))}
                                                                className="hover:bg-indigo-100 p-0.5 rounded-full"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Filtered Students List */}
                                        <div className="max-h-40 overflow-y-auto border border-slate-200 bg-white rounded-lg divide-y divide-slate-100">
                                            {potentialParticipants
                                                .filter(user => user.role === 'student')
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
                                                            className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <img 
                                                                    src={user.photoUrl || `https://ui-avatars.com/api/?name=${user.name}`} 
                                                                    className="w-5 h-5 rounded-full object-cover border border-slate-100" 
                                                                    alt="" 
                                                                    referrerPolicy="no-referrer"
                                                                />
                                                                <div>
                                                                    <p className="font-bold text-slate-800 leading-none">{user.name}</p>
                                                                    <p className="text-[8px] text-slate-450 font-bold uppercase mt-0.5">{user.batchCode || 'Student'}</p>
                                                                </div>
                                                            </div>
                                                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[8px] font-black ${
                                                                isSelected ? 'bg-indigo-600 text-white border-transparent' : 'border-slate-300 text-transparent'
                                                            }`}>
                                                                ✓
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            {potentialParticipants.filter(user => user.role === 'student').filter(user => {
                                                if (!notifySearchTerm.trim()) return true;
                                                return user.name?.toLowerCase().includes(notifySearchTerm.toLowerCase());
                                            }).length === 0 && (
                                                <p className="p-3 text-slate-400 text-center text-[10px] font-bold">No students found</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-6 flex gap-3">
                        <button 
                            type="button" 
                            onClick={() => { resetStates(); onClose(); }}
                            className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-200 transition"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={loading || !isFormValid()}
                            className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-md shadow-indigo-200 hover:bg-indigo-700 transition disabled:opacity-50"
                        >
                            {loading ? 'Publishing...' : 'Publish'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
