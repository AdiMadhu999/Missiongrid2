import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card';
import { MessageSquare, BookOpen, ClipboardList, Megaphone, ThumbsUp, Trash2, Pin, Clock, Play } from 'lucide-react';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../providers/AuthProvider';
import { DiscussionEngine } from '../discussion/DiscussionEngine';
import { sendNotification } from '../../services/notifications';

const CardHeader = ({ item, collectionName }: { item: any, collectionName: string }) => {
    const { userProfile } = useAuth();
    const date = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
    const [menuOpen, setMenuOpen] = useState(false);

    const handleDelete = async () => {
        if (confirm('Delete this post?')) {
            await deleteDoc(doc(db, collectionName, item.id));
        }
    };

    const handlePin = async () => {
        await updateDoc(doc(db, collectionName, item.id), {
            pinnedStatus: !item.pinnedStatus
        });
        setMenuOpen(false);
    };

    return (
        <div className="flex items-center justify-between mb-1 relative">
            <div className="flex items-center gap-2">
                <img src={item.authorPhoto || `https://ui-avatars.com/api/?name=${item.authorName}`} className="w-8 h-8 rounded-full" alt={item.authorName} />
                <div>
                    <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm text-slate-900">{item.authorName}</p>
                        {item.authorRole === 'mentor' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Mentor</span>}
                        {item.pinnedStatus && <Pin className="w-3 h-3 text-indigo-600 fill-indigo-600 ml-1" />}
                    </div>
                    <p className="text-[10px] text-slate-400">{date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
            </div>
            
            {(userProfile?.role === 'mentor' || userProfile?.uid === item.authorId) && (
                <div className="relative">
                    <button onClick={() => setMenuOpen(!menuOpen)} className="text-slate-400 hover:text-slate-600 p-2">...</button>
                    {menuOpen && (
                        <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden z-20">
                            {userProfile?.role === 'mentor' && collectionName === 'mentorPosts' && (
                                <button onClick={handlePin} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-50 flex items-center gap-2">
                                    <Pin className="w-3 h-3" /> {item.pinnedStatus ? 'Unpin' : 'Pin Post'}
                                </button>
                            )}
                            <button onClick={handleDelete} className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-slate-50 flex items-center gap-2">
                                <Trash2 className="w-3 h-3" /> Delete
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const CardActions = ({ item, type }: { item: any, type: 'mentorPost' | 'doubt' | 'dailyTest' | 'article' | 'voiceNote' }) => {
    const { userProfile } = useAuth();
    const collectionName = type === 'mentorPost' ? 'mentorPosts' : type === 'doubt' ? 'discussions' : type === 'dailyTest' ? 'dailyTests' : 'articles';
    
    const handleLike = async () => {
        const docRef = doc(db, collectionName, item.id);
        const likes = item.likes || [];
        const newLikes = likes.includes(userProfile?.uid) 
            ? likes.filter((id: string) => id !== userProfile?.uid)
            : [...likes, userProfile?.uid];
        await updateDoc(docRef, { likes: newLikes });
    };

    const handleSave = async () => {
        const docRef = doc(db, collectionName, item.id);
        const saves = item.saves || [];
        const newSaves = saves.includes(userProfile?.uid) 
            ? saves.filter((id: string) => id !== userProfile?.uid)
            : [...saves, userProfile?.uid];
        await updateDoc(docRef, { saves: newSaves });
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: item.title || item.testName,
                    text: 'Check out this post on MissionGrid!',
                    url: window.location.href,
                });
            } catch (err) {
                console.error('Error sharing:', err);
            }
        } else {
            alert('Sharing not supported on this browser');
        }
    };

    return (
        <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100">
            <button onClick={handleLike} className={`flex items-center justify-center gap-2 text-xs font-bold ${item.likes?.includes(userProfile?.uid) ? 'text-indigo-600' : 'text-slate-600'} hover:bg-slate-50 py-1 rounded-md transition`}>
                <ThumbsUp className="w-4 h-4" /> {item.likes?.length || 0}
            </button>
            <button className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600 hover:bg-slate-50 py-1 rounded-md transition"><MessageSquare className="w-4 h-4" /> {item.comments || 0}</button>
            <button onClick={handleShare} className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600 hover:bg-slate-50 py-1 rounded-md transition"><span className="w-4 h-4">📤</span></button>
            <button onClick={handleSave} className={`flex items-center justify-center gap-2 text-xs font-bold ${item.saves?.includes(userProfile?.uid) ? 'text-indigo-600' : 'text-slate-600'} hover:bg-slate-50 py-1 rounded-md transition`}><span className="w-4 h-4">🔖</span></button>
        </div>
    );
};

export const DoubtCard = ({ item }: { item: any }) => {
    const { userProfile } = useAuth();
    const isMentor = userProfile?.role === 'mentor';
    const [expanded, setExpanded] = useState(false);
    
    const isSolved = item.status === 'Solved';

    const toggleSolved = async () => {
        const isNowSolved = !isSolved;
        await updateDoc(doc(db, 'discussions', item.id), { status: isNowSolved ? 'Solved' : 'Unsolved' });
        if (isNowSolved && item.authorId !== userProfile?.uid) {
            sendNotification(item.authorId, userProfile!.uid, 'Solved', item.id, 'Doubt Solved', `Your doubt "${item.title}" was marked as solved.`);
        }
    };
    
    return (
        <div className="py-2 border-b border-slate-100 bg-white">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <img src={item.authorPhoto || `https://ui-avatars.com/api/?name=${item.authorName}`} className="w-8 h-8 rounded-full" alt={item.authorName} />
                    <div>
                        <div className="flex items-center gap-1.5">
                            <p className="font-bold text-sm text-slate-900">{item.authorName}</p>
                            {item.authorRole === 'mentor' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Mentor</span>}
                        </div>
                        <p className="text-[10px] text-slate-400">
                            {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : new Date(item.createdAt || 0).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                    </div>
                </div>
                
                {isSolved && <span className="text-[9px] font-black text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Solved</span>}
            </div>
            
            <div className="mb-1.5 mt-2 pl-[40px]">
                <p className="text-sm text-slate-900 font-bold mb-1 leading-snug">{item.title}</p>
                <p className="text-xs text-slate-600 leading-relaxed mb-1.5">{item.content}</p>
            </div>
            
            <div className="flex gap-2 items-center pl-[40px]">
                <button onClick={() => setExpanded(!expanded)} className="text-xs font-bold text-indigo-600 hover:underline">
                    {expanded ? 'Hide Discussion' : `Join Discussion Room (${item.replyCount || 0})`}
                </button>
                {isMentor && (
                    <button onClick={toggleSolved} className={`text-[10px] font-bold ${isSolved ? 'text-amber-700' : 'text-slate-500 hover:text-indigo-600'}`}>
                        {isSolved ? 'Reopen Room' : 'Close Room (Mark Solved)'}
                    </button>
                )}
            </div>

            {expanded && (
                <div className="mt-4 pl-[40px]">
                    {item.imageUrl && (
                        <div className="mb-2">
                            <p className="text-xs font-bold text-slate-500 mb-2">Attachment:</p>
                            <img src={item.imageUrl} alt="Attachment" className="max-w-full rounded-xl max-h-64 object-contain border border-slate-100 bg-slate-50" />
                        </div>
                    )}
                    <DiscussionEngine activityId={item.id} activityType="Doubt" isClosed={isSolved} />
                </div>
            )}
        </div>
    );
};

export const MissionReportCard = ({ item }: { item: any }) => (
        <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
            <CardHeader item={item} collectionName="missionReports" />
            <p className="text-sm text-slate-800 mb-2">Submitted a mission report.</p>
            <button className="w-full text-center bg-green-50 text-green-700 py-2 rounded-xl text-xs font-bold">View Mission Report</button>
            <CardActions item={item} type="article" />
        </div>
);

export const DailyTestCard = ({ item }: { item: any }) => {
    const isExpired = item.expiryDate && new Date(item.expiryDate.toDate()) < new Date();
    const [expanded, setExpanded] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
            <CardHeader item={item} collectionName="dailyTests" />
            
            <div className='my-1'>
                <p className="text-sm font-black text-slate-900 mb-1 leading-snug">{item.testName}</p>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mb-2">
                    <span className='flex items-center gap-1'><BookOpen className='w-3 h-3'/> {item.questionCount} Qs</span>
                    <span className='flex items-center gap-1'><Clock className='w-3 h-3'/> {item.duration} Mins</span>
                </div>
            </div>
            
            {!isExpired && (
                <button 
                    onClick={() => navigate(`/app/tests/attempt/${item.testId || item.id}`)}
                    className="w-full bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-700"
                >
                    ▶ Attempt Test
                </button>
            )}
            
            <button onClick={() => setExpanded(!expanded)} className="text-xs font-bold text-indigo-600 hover:underline mt-2">
                {expanded ? 'Hide Discussion' : `${item.comments || 0} Comments`}
            </button>

            {expanded && <DiscussionEngine activityId={item.id} activityType="dailyTest" />}
            
            <CardActions item={item} type="dailyTest" />
        </div>
    );
};

export const MentorPostCard = ({ item }: { item: any }) => {
    const { userProfile } = useAuth();
    const isMentor = userProfile?.role === 'mentor';
    const [expanded, setExpanded] = useState(false);
    
    const handleDelete = async () => {
        if(confirm('Delete this post?')) {
            await deleteDoc(doc(db, 'mentorPosts', item.id));
        }
    };
    
    const handlePin = async () => {
        await updateDoc(doc(db, 'mentorPosts', item.id), { pinnedStatus: !item.pinnedStatus });
    };
    
    return (
        <div className={`p-2 bg-white rounded-xl shadow-sm border border-slate-100 ${item.pinnedStatus ? 'border-l-4 border-l-indigo-600' : ''}`}>
            <div className="flex items-center justify-between mb-2">
                <CardHeader item={item} collectionName="mentorPosts" />
                {isMentor && (
                    <div className="flex gap-1">
                        <button onClick={handlePin} className={`p-1.5 rounded-lg ${item.pinnedStatus ? 'bg-indigo-100' : 'bg-slate-100'}`}><Pin className="w-3 h-3 text-indigo-600" /></button>
                        <button onClick={handleDelete} className="p-1.5 rounded-lg bg-red-50 text-red-600 font-bold text-[9px]">Delete</button>
                    </div>
                )}
            </div>
            
            <div className='mb-2'>
                {item.pinnedStatus && <div className="flex items-center gap-1 text-[10px] font-black text-indigo-700 mb-1"><Pin className="w-3 h-3" /> Pinned</div>}
                <div className='flex items-center gap-2 mb-1'>
                    <Megaphone className="w-5 h-5 text-indigo-600" />
                    <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Important</span>
                    <p className="text-sm text-slate-900 font-bold leading-snug">{item.title}</p>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{item.content}</p>
            </div>
            
            {item.imageUrl && <img src={item.imageUrl} className="w-full rounded-2xl mb-1.5" alt="Post" />}
            {item.youtubeLink && (
                <div className="mb-2 rounded-2xl overflow-hidden aspect-video bg-slate-100 relative group cursor-pointer" onClick={() => window.open(item.youtubeLink, '_blank')}>
                   {(() => {
                       const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
                       const match = item.youtubeLink.match(regExp);
                       const videoId = (match && match[2].length === 11) ? match[2] : null;
                       if (videoId) {
                           return (
                               <>
                                   <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="YouTube Thumbnail" className="w-full h-full object-cover" />
                                   <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/30 transition">
                                        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                                            <Play className="w-6 h-6 fill-white text-white ml-1" />
                                        </div>
                                   </div>
                               </>
                           );
                       }
                       return (
                           <div className="w-full h-full flex items-center justify-center">
                               <a href={item.youtubeLink} target="_blank" onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 text-red-600 font-bold hover:underline">
                                  <Play className="w-6 h-6 fill-red-600" /> Watch YouTube Video
                               </a>
                           </div>
                       );
                   })()}
                </div>
            )}
            {item.externalLink && item.postType === 'pdf' && (
                <a href={item.externalLink} target="_blank" className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-xl mb-1.5 hover:bg-slate-100 transition text-sm font-bold text-slate-700">
                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                    View PDF Document
                </a>
            )}
            
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-2">
                <button onClick={() => setExpanded(!expanded)} className="text-indigo-600 hover:underline">{expanded ? 'Hide Discussion' : `${item.comments || 0} Comments`}</button>
                <div className='flex gap-2'>
                    <span>👁️ {item.views || 0}</span>
                </div>
            </div>

            {expanded && <DiscussionEngine activityId={item.id} activityType="mentorPost" />}

            <CardActions item={item} type="mentorPost" />
        </div>
    );
};

export const ArticleCard = ({ item }: { item: any }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
            <CardHeader item={item} collectionName="mentorPosts" />
            <div className="flex gap-2 mb-2">
                <div className="flex-1">
                    <p className="font-bold text-slate-900 leading-snug mb-1">{item.title}</p>
                    <p className="text-xs text-slate-600 line-clamp-2 mb-2">{item.content}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{item.readingTime || '5 min'} read</p>
                </div>
                <img src={item.imageUrl} className="w-24 h-24 rounded-2xl object-cover" alt="Article" />
            </div>
            
            <button onClick={() => setExpanded(!expanded)} className="text-xs font-bold text-indigo-600 hover:underline mb-2">
                {expanded ? 'Hide Discussion' : `${item.comments || 0} Comments`}
            </button>

            {expanded && <DiscussionEngine activityId={item.id} activityType="article" />}

            <CardActions item={item} type="article" />
        </div>
    );
};

export const VoiceNoteCard = ({ item }: { item: any }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
            <CardHeader item={item} collectionName="mentorPosts" />
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl mb-2">
                <button className="w-12 h-12 flex items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shrink-0">
                    <Play className="w-6 h-6 fill-white ml-1" />
                </button>
                <div className="flex-1">
                    {/* Waveform */}
                    <div className="flex items-center gap-1 h-8">
                        {Array.from({ length: 25 }).map((_, i) => (
                            <div key={i} className={`w-1 rounded-full ${i % 3 === 0 ? 'h-8' : 'h-5'} bg-indigo-200`}></div>
                        ))}
                    </div>
                    {/* Seek bar */}
                    <input type="range" className="w-full h-1 mt-2 accent-indigo-600" />
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold mt-1">
                        <span>0:00</span>
                        <span>{item.duration || '0:00'}</span>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                   <span className="bg-slate-100 px-2 py-0.5 rounded-md">1x</span>
                </div>
                <div className="flex gap-2">
                    <button className="p-2 bg-slate-100 rounded-full text-slate-600">⬇️</button>
                    <button className="p-2 bg-slate-100 rounded-full text-slate-600">📤</button>
                </div>
            </div>
            
            <button onClick={() => setExpanded(!expanded)} className="text-xs font-bold text-indigo-600 hover:underline mb-2">
                {expanded ? 'Hide Discussion' : `${item.comments || 0} Comments`}
            </button>

            {expanded && <DiscussionEngine activityId={item.id} activityType="voiceNote" />}

            <CardActions item={item} type="voiceNote" />
        </div>
    );
};
