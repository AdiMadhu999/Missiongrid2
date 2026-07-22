import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card';
import { MessageSquare, BookOpen, ClipboardList, Megaphone, ThumbsUp, Trash2, Pin, Clock, Play, Pause, Edit3, MoreVertical, Trash2 as TrashIcon, Image, Video, FileText, Link } from 'lucide-react';
import { doc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../providers/AuthProvider';
import { DiscussionEngine } from '../discussion/DiscussionEngine';
import { sendNotification } from '../../services/notifications';
import { TelegramChatRoom } from './TelegramChatRoom';
import { getUsersByBatch } from '../../services/users';

// Dynamic Seen By Tracker Section
export const SeenBySection = ({ item, collectionName }: { item: any, collectionName: string }) => {
    const { userProfile } = useAuth();
    
    useEffect(() => {
        if (!userProfile?.id || !item.id) return;
        const seenBy = item.seenBy || [];
        if (!seenBy.includes(userProfile.id)) {
            const docRef = doc(db, collectionName, item.id);
            updateDoc(docRef, {
                seenBy: arrayUnion(userProfile.id),
                seenByDetails: arrayUnion({
                    uid: userProfile.id,
                    name: userProfile.name || 'Unknown',
                    photoUrl: userProfile.photoUrl || ''
                })
            }).catch(err => console.error("Error updating seen status", err));
        }
    }, [item.id, userProfile?.id, collectionName, item.seenBy]);

    const seenByDetails = item.seenByDetails || [];
    if (seenByDetails.length === 0) return null;

    return (
        <div className="flex items-center gap-1.5 mt-2 px-1 text-[10px] text-slate-400 font-bold border-t border-slate-50 pt-2">
            <div className="flex -space-x-1.5 overflow-hidden">
                {seenByDetails.slice(0, 4).map((user: any, idx: number) => (
                    <img 
                        key={idx}
                        src={user.photoUrl || `https://ui-avatars.com/api/?name=${user.name}`} 
                        className="inline-block h-4.5 w-4.5 rounded-full ring-2 ring-white object-cover" 
                        alt={user.name}
                        title={user.name}
                    />
                ))}
            </div>
            <span>
                Seen by {seenByDetails.length} {seenByDetails.length === 1 ? 'student' : 'students'}
                {seenByDetails.length > 0 && ` (${seenByDetails.slice(0, 2).map((u: any) => u.name).join(', ')}${seenByDetails.length > 2 ? '...' : ''})`}
            </span>
        </div>
    );
};

export const extractYoutubeId = (text?: string): string | null => {
    if (!text) return null;
    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = text.match(regExp);
    return (match && match[1]) ? match[1] : null;
};

export const InlineYoutubePlayer = ({ text, fallbackUrl, embedAllowed = true }: { text?: string, fallbackUrl?: string, embedAllowed?: boolean }) => {
    const [playVideo, setPlayVideo] = useState(false);
    
    const videoId = extractYoutubeId(text) || extractYoutubeId(fallbackUrl || '');
    
    if (!videoId) {
        if (fallbackUrl) {
            return (
                <div className="mb-3 rounded-2xl overflow-hidden aspect-video bg-slate-50 border border-slate-100 flex items-center justify-center p-4">
                    <a href={fallbackUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-red-600 font-bold hover:underline text-xs">
                        <Play className="w-5 h-5 fill-red-600 text-red-600" /> Open External Link
                    </a>
                </div>
            );
        }
        return null;
    }

    if (playVideo && embedAllowed) {
        return (
            <div 
                className="mb-3 rounded-2xl overflow-hidden aspect-video bg-slate-100 border border-slate-100 relative"
                onClick={(e) => e.stopPropagation()}
            >
                <iframe 
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                />
            </div>
        );
    }

    return (
        <div 
            className="mb-3 rounded-2xl overflow-hidden aspect-video bg-slate-100 relative group border border-slate-100 cursor-pointer" 
            onClick={(e) => {
                e.stopPropagation();
                if (embedAllowed) {
                    setPlayVideo(true);
                } else {
                    window.open(`https://youtube.com/watch?v=${videoId}`, '_blank');
                }
            }}
        >
            <img 
                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} 
                alt="YouTube Thumbnail" 
                className="w-full h-full object-cover" 
                loading="lazy"
            />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/35 transition">
                 <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                     <Play className="w-5 h-5 fill-white text-white ml-1" />
                 </div>
            </div>
        </div>
    );
};

const CardHeader = ({ item, collectionName }: { item: any, collectionName: string }) => {
    const { userProfile } = useAuth();
    const date = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt || 0);
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
                <img src={item.authorPhoto || `https://ui-avatars.com/api/?name=${item.authorName}`} className="w-8 h-8 rounded-full object-cover" alt={item.authorName} />
                <div>
                    <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm text-slate-900 leading-none">{item.authorName}</p>
                        {item.authorRole === 'mentor' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded leading-none font-bold">Mentor</span>}
                        {item.pinnedStatus && <Pin className="w-3 h-3 text-indigo-600 fill-indigo-600 ml-1" />}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">{date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
            </div>
            
            {(userProfile?.role === 'mentor' || userProfile?.id === item.authorId) && (
                <div className="relative">
                    <button onClick={() => setMenuOpen(!menuOpen)} className="text-slate-400 hover:text-slate-600 p-2 font-black">...</button>
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

const CardActions = ({ item, type, onCommentClick }: { item: any, type: 'mentorPost' | 'doubt' | 'dailyTest' | 'article' | 'voiceNote' | 'poll', onCommentClick?: () => void }) => {
    const { userProfile } = useAuth();
    
    // Fix collection resolution mapping (articles, voicenotes, and polls are in mentorPosts collection)
    const collectionName = (type === 'mentorPost' || type === 'article' || type === 'voiceNote' || type === 'poll') 
        ? 'mentorPosts' 
        : type === 'doubt' 
            ? 'discussions' 
            : type === 'dailyTest' 
                ? 'dailyTests' 
                : 'mentorPosts';
    
    const handleLike = async () => {
        const docRef = doc(db, collectionName, item.id);
        const likes = item.likes || [];
        const newLikes = likes.includes(userProfile?.id) 
            ? likes.filter((id: string) => id !== userProfile?.id)
            : [...likes, userProfile?.id];
        await updateDoc(docRef, { likes: newLikes });
    };

    const handleSave = async () => {
        const docRef = doc(db, collectionName, item.id);
        const saves = item.saves || [];
        const newSaves = saves.includes(userProfile?.id) 
            ? saves.filter((id: string) => id !== userProfile?.id)
            : [...saves, userProfile?.id];
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
            // Silently copy URL as elegant fallback rather than aggressive alert
            try {
                await navigator.clipboard.writeText(window.location.href);
                // Temporary console trace for verification
                console.log("[FeedCards] Link copied to clipboard!");
            } catch (clipErr) {
                console.warn("[FeedCards] Clipboard fallback failed:", clipErr);
            }
        }
    };

    const commentsCount = type === 'doubt' ? (item.replyCount || 0) : (item.comments || 0);

    return (
        <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100">
            <button onClick={handleLike} className={`flex items-center justify-center gap-2 text-xs font-bold ${item.likes?.includes(userProfile?.id) ? 'text-indigo-600' : 'text-slate-600'} hover:bg-slate-50 py-1 rounded-md transition`}>
                <ThumbsUp className="w-4 h-4" /> {item.likes?.length || 0}
            </button>
            <button onClick={() => { onCommentClick && onCommentClick(); }} className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600 hover:bg-slate-50 py-1 rounded-md transition">
                <MessageSquare className="w-4 h-4" /> {commentsCount}
            </button>
            <button onClick={handleShare} className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600 hover:bg-slate-50 py-1 rounded-md transition"><span className="w-4 h-4">📤</span></button>
            <button onClick={handleSave} className={`flex items-center justify-center gap-2 text-xs font-bold ${item.saves?.includes(userProfile?.id) ? 'text-indigo-600' : 'text-slate-600'} hover:bg-slate-50 py-1 rounded-md transition`}><span className="w-4 h-4">🔖</span></button>
        </div>
    );
};

export const DoubtCard = React.memo(({ item }: { item: any }) => {
    const { userProfile } = useAuth();
    const isMentor = userProfile?.role === 'mentor';
    const [expanded, setExpanded] = useState(false);
    
    const isSolved = item.status === 'Solved';
    const isPrivate = item.privacy === 'private';
    const itemOwnerId = item.authorId || item.studentId || item.uid;
    const isSharedWithMe = item.sharedWith && Array.isArray(item.sharedWith) && (item.sharedWith.includes(userProfile?.id) || item.sharedWith.includes(userProfile?.uid));
    const canView = !isPrivate || userProfile?.id === itemOwnerId || userProfile?.uid === itemOwnerId || isMentor || isSharedWithMe;

    const toggleSolved = async () => {
        const isNowSolved = !isSolved;
        await updateDoc(doc(db, 'discussions', item.id), { status: isNowSolved ? 'Solved' : 'Unsolved' });
        if (isNowSolved && itemOwnerId !== userProfile?.id) {
            sendNotification(itemOwnerId, userProfile!.uid, 'Solved', item.id, 'Doubt Solved', `Your doubt "${item.title}" was marked as solved.`);
        }
    };

    const [isSendingManualNotify, setIsSendingManualNotify] = useState(false);

    const handleSendManualNotification = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isSendingManualNotify) return;
        setIsSendingManualNotify(true);
        try {
            if (isPrivate) {
                // Notify all sharedWith and the original author if different from current user
                const targets = new Set<string>();
                if (item.sharedWith && Array.isArray(item.sharedWith)) {
                    item.sharedWith.forEach((id: string) => {
                        if (id && id !== userProfile?.id && id !== userProfile?.uid) {
                            targets.add(id);
                        }
                    });
                }
                if (itemOwnerId && itemOwnerId !== userProfile?.id && itemOwnerId !== userProfile?.uid) {
                    targets.add(itemOwnerId);
                }

                if (targets.size === 0) {
                    alert("No other members in this room to notify.");
                    setIsSendingManualNotify(false);
                    return;
                }

                for (const targetId of targets) {
                    await sendNotification(
                        targetId,
                        userProfile?.uid || userProfile?.id || '',
                        'PrivateDoubtNudge',
                        item.id,
                        'Doubt Room Attention Requested 🔔',
                        `Mentor ${userProfile?.name} is requesting your attention in the private doubt: "${item.title}"`
                    );
                }
                alert(`Notification sent successfully to ${targets.size} member(s)!`);
            } else {
                // Public room: Notify everyone in the batch(es) of this doubt
                const batchIds = item.batchIds || (item.batchId ? [item.batchId] : []);
                if (batchIds.length === 0) {
                    alert("This public doubt is not assigned to any batch.");
                    setIsSendingManualNotify(false);
                    return;
                }

                const studentsToNotify: any[] = [];
                for (const bId of batchIds) {
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
                            'PublicDoubtNudge',
                            item.id,
                            'Doubt Discussion Nudge 🔔',
                            `Mentor ${userProfile?.name} requested attention on public doubt: "${item.title}"`
                        );
                    }
                }

                alert(`Notification sent successfully to ${notifiedIds.size} batch student(s)!`);
            }
        } catch (err) {
            console.error("Error sending manual notification:", err);
            alert("Failed to send notification.");
        } finally {
            setIsSendingManualNotify(false);
        }
    };
    
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(item.title || '');
    const [editContent, setEditContent] = useState(item.content || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this doubt?')) {
            await deleteDoc(doc(db, 'discussions', item.id));
        }
    };

    const handleSaveEdit = async () => {
        if (!editTitle.trim() || !editContent.trim()) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'discussions', item.id), {
                title: editTitle,
                content: editContent,
                updatedAt: new Date().toISOString()
            });
            setIsEditing(false);
        } catch (err) {
            console.error("Failed to update doubt", err);
        } finally {
            setIsSaving(false);
        }
    };

    if (!canView) {
        return (
            <div className="py-2.5 px-4 mb-2 text-slate-500 text-xs font-bold select-none border-b border-slate-150/45">
                • Mentor guide count ...
            </div>
        );
    }

    const canEditOrDelete = (userProfile?.id === itemOwnerId) || (userProfile?.uid === itemOwnerId) || isMentor;

    return (
        <div className="p-4 mb-3 bg-white border border-indigo-100 rounded-2xl shadow-sm relative overflow-hidden transition-all duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-500 to-purple-500"></div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <img src={item.authorPhoto || `https://ui-avatars.com/api/?name=${item.authorName}`} className="w-8 h-8 rounded-full object-cover" alt={item.authorName} />
                    <div>
                        <div className="flex items-center gap-1.5">
                            <p className="font-bold text-sm text-slate-900 leading-none">{item.authorName}</p>
                            {item.authorRole === 'mentor' && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold leading-none">Mentor</span>}
                        </div>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                            {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : new Date(item.createdAt || 0).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {isPrivate ? (
                        <span className="text-[9px] font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full uppercase tracking-wider">🔒 Private</span>
                    ) : (
                        <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">🌐 Public</span>
                    )}
                    {isSolved && <span className="text-[9px] font-black text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Solved</span>}
                    {canEditOrDelete && (
                        <div className="flex items-center gap-1">
                            <button onClick={() => setIsEditing(!isEditing)} className="text-indigo-400 hover:text-indigo-600 p-1" title="Edit">
                                <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={handleDelete} className="text-rose-400 hover:text-rose-600 p-1" title="Delete">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            {isEditing ? (
                <div className="mb-3 mt-2 pl-[40px] space-y-2">
                    <input 
                        type="text" 
                        value={editTitle} 
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold"
                        placeholder="Doubt Title"
                    />
                    <textarea 
                        value={editContent} 
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs"
                        rows={3}
                        placeholder="Describe your doubt..."
                    />
                    <div className="flex gap-2">
                        <button onClick={handleSaveEdit} disabled={isSaving} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button onClick={() => setIsEditing(false)} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold">
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div 
                    className="mb-1.5 mt-2 pl-[40px] cursor-pointer opacity-85 hover:opacity-100 transition-opacity"
                    onClick={() => setExpanded(true)}
                >
                    <p className="text-sm text-slate-900 font-bold mb-1 leading-snug">{item.title}</p>
                    <p className="text-xs text-slate-600 leading-relaxed mb-1.5 line-clamp-2">
                        {item.content}
                    </p>
                    <p className="text-[10px] font-bold text-indigo-500 mt-1">Tap to read more...</p>
                </div>
            )}

            <div className="pl-[40px] mt-2">
                <InlineYoutubePlayer text={item.content} fallbackUrl={item.youtubeLink} embedAllowed={false} />
            </div>
            
            <div className="flex gap-2 items-center mt-3 pl-[40px] flex-wrap">
                <button onClick={() => setExpanded(true)} className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-3 py-1.5 rounded-lg shadow-sm">
                    Join Room ({item.replyCount || 0})
                </button>
                {isMentor && (
                    <button 
                        onClick={handleSendManualNotification} 
                        disabled={isSendingManualNotify}
                        className="text-[10px] font-bold px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-md border border-rose-200 transition disabled:opacity-50 flex items-center gap-1"
                        title="Instantly notify students associated with this doubt"
                    >
                        <span>{isSendingManualNotify ? '⚡ Sending...' : '🔔 Press Notify'}</span>
                    </button>
                )}
                {isMentor && (
                    <button onClick={toggleSolved} className={`text-[10px] font-bold px-2 py-1.5 rounded-md ${isSolved ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
                        {isSolved ? 'Reopen Room' : 'Close Room (Mark Solved)'}
                    </button>
                )}
            </div>
            
            {expanded && createPortal(
                <TelegramChatRoom 
                    item={item} 
                    isSolved={isSolved} 
                    toggleSolved={toggleSolved} 
                    isMentor={isMentor} 
                    onClose={() => setExpanded(false)} 
                />,
                document.body
            )}

            <SeenBySection item={item} collectionName="discussions" />
        </div>
    );
});

export const MissionReportCard = React.memo(({ item }: { item: any }) => (
    <div className="p-4 mb-3 bg-white rounded-xl shadow-sm border border-slate-100">
        <CardHeader item={item} collectionName="dailyMissionReports" />
        <p className="text-sm text-slate-800 mb-2 mt-2">Submitted a mission report.</p>
        <button className="w-full text-center bg-green-50 text-green-700 py-2 rounded-xl text-xs font-bold mb-2">View Mission Report</button>
        <SeenBySection item={item} collectionName="dailyMissionReports" />
        <CardActions item={item} type="article" />
    </div>
));

export const DailyTestCard = React.memo(({ item }: { item: any }) => {
    const getExpiryDate = (val: any): Date | null => {
        if (!val) return null;
        if (typeof val.toDate === 'function') return val.toDate();
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    };
    const expiryDateObj = getExpiryDate(item.expiryDate);
    const isExpired = expiryDateObj ? expiryDateObj < new Date() : false;
    const [expanded, setExpanded] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="p-4 mb-3 bg-white rounded-xl shadow-sm border border-slate-100">
            <CardHeader item={item} collectionName="dailyTests" />
            
            <div className="my-2">
                <p className="text-sm font-black text-slate-900 mb-1 leading-snug">{item.testName}</p>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mb-2">
                    <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5"/> {item.questionCount} Qs</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> {item.duration} Mins</span>
                </div>
            </div>
            
            {!isExpired && (
                <button 
                    onClick={() => navigate(`/app/tests/attempt/${item.testId || item.id}`)}
                    className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-700 transition"
                >
                    ▶ Attempt Test
                </button>
            )}
            
            <button onClick={() => setExpanded(!expanded)} className="text-xs font-bold text-indigo-600 hover:underline mt-2">
                {expanded ? 'Hide Discussion' : `${item.comments || 0} Comments`}
            </button>

            {expanded && <DiscussionEngine activityId={item.id} activityType="dailyTest" />}
            
            <SeenBySection item={item} collectionName="dailyTests" />
            
            <CardActions item={item} type="dailyTest" onCommentClick={() => setExpanded(!expanded)} />
        </div>
    );
});

export const MentorPostCard = React.memo(({ item }: { item: any }) => {
    const { userProfile } = useAuth();
    const isMentor = userProfile?.role === 'mentor';
    const [expanded, setExpanded] = useState(false);
    const [playVideo, setPlayVideo] = useState(false);

    const renderPostTypeBadge = () => {
        switch (item.postType) {
            case 'announcement':
                return (
                    <>
                        <Megaphone className="w-4 h-4 text-indigo-600" />
                        <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Announcement</span>
                    </>
                );
            case 'video':
                return (
                    <>
                        <Video className="w-4 h-4 text-indigo-600" />
                        <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Video</span>
                    </>
                );
            case 'image':
                return (
                    <>
                        <Image className="w-4 h-4 text-indigo-600" />
                        <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Image</span>
                    </>
                );
            case 'pdf':
                return (
                    <>
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">PDF Document</span>
                    </>
                );
            case 'link':
                return (
                    <>
                        <Link className="w-4 h-4 text-indigo-600" />
                        <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Link</span>
                    </>
                );
            default:
                return (
                    <>
                        <Megaphone className="w-4 h-4 text-indigo-600" />
                        <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Announcement</span>
                    </>
                );
        }
    };
    
    return (
        <div className={`p-4 mb-3 bg-white rounded-xl shadow-sm border border-slate-100 transition-all ${item.pinnedStatus ? 'border-l-4 border-l-indigo-600' : ''}`}>
            <CardHeader item={item} collectionName="mentorPosts" />
            
            <div className="mb-2 mt-2">
                {item.pinnedStatus && <div className="flex items-center gap-1 text-[10px] font-black text-indigo-700 mb-1"><Pin className="w-3 h-3" /> Pinned</div>}
                <div className="flex items-center gap-2 mb-1.5">
                    {renderPostTypeBadge()}
                    <p className="text-sm text-slate-900 font-bold leading-none">{item.title}</p>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">{item.content}</p>
            </div>
            
            {item.imageUrl && <img src={item.imageUrl} className="w-full rounded-2xl mb-3 object-cover max-h-[350px]" alt="Post" />}
            
            <InlineYoutubePlayer text={item.content} fallbackUrl={item.youtubeLink} embedAllowed={item.embedVideo !== false} />
            
            {item.externalLink && item.postType === 'pdf' && (
                <a href={item.externalLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl mb-3 hover:bg-slate-100 transition text-xs font-bold text-slate-700">
                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                    View PDF Document
                </a>
            )}
            
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-2 border-t border-slate-50 pt-2">
                <button onClick={() => setExpanded(!expanded)} className="text-indigo-600 hover:underline">{expanded ? 'Hide Discussion' : `${item.comments || 0} Comments`}</button>
            </div>

            {expanded && <DiscussionEngine activityId={item.id} activityType="mentorPost" />}

            <SeenBySection item={item} collectionName="mentorPosts" />

            <CardActions item={item} type="mentorPost" onCommentClick={() => setExpanded(!expanded)} />
        </div>
    );
});

export const ArticleCard = React.memo(({ item }: { item: any }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="p-4 mb-3 bg-white rounded-xl shadow-sm border border-slate-100">
            <CardHeader item={item} collectionName="mentorPosts" />
            <div className="flex gap-3 mb-2 mt-2">
                <div className="flex-1">
                    <p className="font-extrabold text-slate-900 leading-snug mb-1">{item.title}</p>
                    <p className="text-xs text-slate-650 line-clamp-2 mb-2">{item.content}</p>
                    <p className="text-[9px] text-slate-400 font-black tracking-wide uppercase">{item.readingTime || '5 min'} read</p>
                </div>
                {item.imageUrl && (
                    <img src={item.imageUrl} className="w-20 h-20 rounded-2xl object-cover border border-slate-100 shrink-0" alt="Article" />
                )}
            </div>
            
            <InlineYoutubePlayer text={item.content} fallbackUrl={item.youtubeLink} embedAllowed={item.embedVideo !== false} />
            
            <button onClick={() => setExpanded(!expanded)} className="text-xs font-bold text-indigo-600 hover:underline mb-2">
                {expanded ? 'Hide Discussion' : `${item.comments || 0} Comments`}
            </button>

            {expanded && <DiscussionEngine activityId={item.id} activityType="mentorPost" />}

            <SeenBySection item={item} collectionName="mentorPosts" />

            <CardActions item={item} type="article" onCommentClick={() => setExpanded(!expanded)} />
        </div>
    );
});

export const VoiceNoteCard = React.memo(({ item }: { item: any }) => {
    const { userProfile } = useAuth();
    const [expanded, setExpanded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = () => {
        if (!item.audioUrl) return;
        
        if (!audioRef.current) {
            audioRef.current = new Audio(item.audioUrl);
            
            audioRef.current.addEventListener('timeupdate', () => {
                setCurrentTime(audioRef.current?.currentTime || 0);
            });
            
            audioRef.current.addEventListener('loadedmetadata', () => {
                setDuration(audioRef.current?.duration || 0);
            });
            
            audioRef.current.addEventListener('ended', () => {
                setIsPlaying(false);
                setCurrentTime(0);
            });
        }

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.playbackRate = playbackRate;
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setCurrentTime(time);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    };

    const cyclePlaybackRate = () => {
        let nextRate = 1;
        if (playbackRate === 1) nextRate = 1.5;
        else if (playbackRate === 1.5) nextRate = 2;
        else nextRate = 1;
        
        setPlaybackRate(nextRate);
        if (audioRef.current) {
            audioRef.current.playbackRate = nextRate;
        }
    };

    const formatTime = (secs: number) => {
        if (isNaN(secs)) return '0:00';
        const mins = Math.floor(secs / 60);
        const remainingSecs = Math.floor(secs % 60);
        return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
    };

    // Calculate active audio wave bars
    const totalBars = 25;
    const activeBarsCount = duration > 0 ? Math.floor((currentTime / duration) * totalBars) : 0;

    return (
        <div className="p-4 mb-3 bg-white rounded-xl shadow-sm border border-slate-100">
            <CardHeader item={item} collectionName="mentorPosts" />
            
            <div className="mb-2 mt-2">
                <p className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider flex items-center gap-1 mb-1">
                    <span>🎙️ Voice Post</span>
                </p>
                <p className="text-sm text-slate-900 font-bold leading-tight mb-3">{item.title}</p>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl mb-3 border border-slate-100">
                <button 
                    onClick={togglePlay}
                    className="w-12 h-12 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shrink-0 transition"
                >
                    {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-1" />}
                </button>
                <div className="flex-1">
                    {/* Dynamic Active Color Waveform */}
                    <div className="flex items-end justify-between gap-0.5 h-8">
                        {Array.from({ length: totalBars }).map((_, i) => {
                            const isActive = i <= activeBarsCount;
                            const barHeight = i % 3 === 0 ? 'h-6' : i % 5 === 0 ? 'h-8' : 'h-4';
                            return (
                                <div 
                                    key={i} 
                                    className={`w-1 rounded-full ${barHeight} transition-all duration-300 ${
                                        isActive ? 'bg-emerald-600 scale-y-110' : 'bg-emerald-200'
                                    }`}
                                />
                            );
                        })}
                    </div>
                    {/* Seek bar */}
                    <input 
                        type="range" 
                        min={0}
                        max={duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1 mt-2 accent-emerald-600 bg-slate-200 rounded-lg cursor-pointer" 
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold mt-1">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration) || item.duration || '0:00'}</span>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-between items-center mb-3">
                <button 
                    onClick={cyclePlaybackRate}
                    className="text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-lg transition"
                >
                    Speed: {playbackRate}x
                </button>
                
                {item.audioUrl && (
                    <a 
                        href={item.audioUrl} 
                        download={`voicenote_${item.id}.wav`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 text-xs font-extrabold flex items-center gap-1 transition"
                    >
                        <span>📥 Download</span>
                    </a>
                )}
            </div>

            <SeenBySection item={item} collectionName="mentorPosts" />
            
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-2 mb-1">
                <button onClick={() => setExpanded(!expanded)} className="text-indigo-600 hover:underline">
                    {expanded ? 'Hide Discussion' : `${item.comments || 0} Comments`}
                </button>
            </div>

            {expanded && <DiscussionEngine activityId={item.id} activityType="mentorPost" />}

            <CardActions item={item} type="voiceNote" onCommentClick={() => setExpanded(!expanded)} />
        </div>
    );
});

export const PollCard = React.memo(({ item }: { item: any }) => {
    const { userProfile } = useAuth();
    const [expanded, setExpanded] = useState(false);
    
    const pollOptions = item.pollOptions || [];
    const totalVotes = pollOptions.reduce((acc: number, opt: any) => acc + (opt.votes?.length || 0), 0);
    
    // Check if current user has voted
    const hasVoted = pollOptions.some((opt: any) => opt.votes?.includes(userProfile?.id));
    const userVoteId = pollOptions.find((opt: any) => opt.votes?.includes(userProfile?.id))?.id;

    const handleVote = async (optionId: string) => {
        if (hasVoted) return; // Only allow voting once
        
        try {
            const updatedOptions = pollOptions.map((opt: any) => {
                if (opt.id === optionId) {
                    return {
                        ...opt,
                        votes: [...(opt.votes || []), userProfile?.id]
                    };
                }
                return opt;
            });
            
            await updateDoc(doc(db, 'mentorPosts', item.id), {
                pollOptions: updatedOptions
            });
        } catch (err) {
            console.error("Error casting vote:", err);
        }
    };

    return (
        <div className="p-4 mb-3 bg-white border border-indigo-50/50 rounded-2xl shadow-sm relative overflow-hidden transition-all duration-300">
            <CardHeader item={item} collectionName="mentorPosts" />
            
            <div className="mb-3 mt-2">
                <span className="text-xl mb-1.5 block">📊 Poll</span>
                <p className="text-sm text-slate-900 font-extrabold mb-1 leading-snug">{item.title}</p>
                {item.content && <p className="text-xs text-slate-650 mb-3">{item.content}</p>}
                
                <InlineYoutubePlayer text={item.content} fallbackUrl={item.youtubeLink} embedAllowed={item.embedVideo !== false} />
                
                <div className="space-y-2 mt-3">
                    {pollOptions.map((opt: any) => {
                        const votesCount = opt.votes?.length || 0;
                        const percentage = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                        const isUserVote = opt.id === userVoteId;

                        return (
                            <div key={opt.id} className="relative z-10">
                                {hasVoted ? (
                                    /* Result Progress Display UI */
                                    <div className={`p-3 rounded-xl border text-xs font-bold flex justify-between items-center overflow-hidden relative transition-all ${
                                        isUserVote ? 'border-emerald-400 bg-emerald-50/20 text-emerald-900' : 'border-slate-150 bg-slate-50/40 text-slate-700'
                                    }`}>
                                        {/* Colored Progress Fill Background */}
                                        <div 
                                            className={`absolute left-0 top-0 bottom-0 transition-all duration-500 -z-10 ${
                                                isUserVote ? 'bg-emerald-100/40' : 'bg-slate-100'
                                            }`} 
                                            style={{ width: `${percentage}%` }}
                                        />
                                        
                                        <div className="flex items-center gap-2">
                                            <span>{opt.text}</span>
                                            {isUserVote && <span className="text-[9px] bg-emerald-150 text-emerald-800 px-1.5 py-0.5 rounded-full font-black uppercase">Selected</span>}
                                        </div>
                                        <span className="font-extrabold">{percentage}% ({votesCount})</span>
                                    </div>
                                ) : (
                                    /* Interactive Option Button UI */
                                    <button
                                        onClick={() => handleVote(opt.id)}
                                        className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/35 text-xs font-bold text-slate-700 transition"
                                    >
                                        {opt.text}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
                
                <p className="text-[10px] text-slate-400 font-extrabold mt-3 tracking-wider uppercase">
                    Total: {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                </p>
            </div>

            <SeenBySection item={item} collectionName="mentorPosts" />
            
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-2.5 mb-1 border-t border-slate-50 pt-2">
                <button onClick={() => setExpanded(!expanded)} className="text-indigo-600 hover:underline">
                    {expanded ? 'Hide Discussion' : `${item.comments || 0} Comments`}
                </button>
            </div>

            {expanded && <DiscussionEngine activityId={item.id} activityType="mentorPost" />}

            <CardActions item={item} type="poll" onCommentClick={() => setExpanded(!expanded)} />
        </div>
    );
});
