import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../providers/AuthProvider';
import { MessageSquare, Trash2, Edit2, Reply, Check, ThumbsUp, Image as ImageIcon, X } from 'lucide-react';
import { sendNotification } from '../../services/notifications';
import { uploadFile } from '../../services/storage';

export const DiscussionEngine = ({ activityId, activityType, isClosed = false }: { activityId: string, activityType: string, isClosed?: boolean }) => {
    const { userProfile } = useAuth();
    const [comments, setComments] = useState<any[]>([]);
    const [text, setText] = useState('');
    const [replyTo, setReplyTo] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'asc' | 'desc'>('asc');

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    useEffect(() => {
        const q = query(collection(db, 'comments'), where('activityId', '==', activityId));
        return onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            data.sort((a, b) => {
                const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                return sortBy === 'asc' ? timeA - timeB : timeB - timeA;
            });
            setComments(data);
        });
    }, [activityId, sortBy]);

    const handlePost = async (parentId?: string, parentAuthorId?: string) => {
        if (!text.trim() && !selectedFile) return;
        setIsPosting(true);
        try {
            let imageUrl = '';
            if (selectedFile) {
                const path = `comments/${userProfile?.uid}/${Date.now()}_${selectedFile.name}`;
                const result = await uploadFile(path, selectedFile);
                imageUrl = result.url;
            }

            await addDoc(collection(db, 'comments'), {
                activityId,
                activityType,
                authorId: userProfile?.uid,
                authorName: userProfile?.name,
                authorRole: userProfile?.role || 'student',
                text,
                imageUrl,
                parentId: parentId || null,
                createdAt: serverTimestamp(),
                likes: []
            });
            
            try {
                const collectionName = activityType === 'Doubt' ? 'discussions' : activityType === 'dailyTest' ? 'dailyTests' : 'mentorPosts';
                const parentRef = doc(db, collectionName, activityId);
                const fieldToUpdate = activityType === 'Doubt' ? 'replyCount' : 'comments';
                await updateDoc(parentRef, {
                    [fieldToUpdate]: increment(1)
                });
            } catch (e) {
                console.error(e);
            }
            
            if (parentId && parentAuthorId && parentAuthorId !== userProfile?.uid) {
                sendNotification(parentAuthorId, userProfile!.uid, 'Reply', activityId, 'New Reply', `${userProfile?.name} replied to your comment.`);
            }
            
            setText('');
            setReplyTo(null);
            setSelectedFile(null);
            setPreviewUrl('');
        } catch (err) {
            console.error('Error posting comment:', err);
        } finally {
            setIsPosting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this comment?')) {
            await deleteDoc(doc(db, 'comments', id));
            try {
                const collectionName = activityType === 'Doubt' ? 'discussions' : activityType === 'dailyTest' ? 'dailyTests' : 'mentorPosts';
                const parentRef = doc(db, collectionName, activityId);
                const fieldToUpdate = activityType === 'Doubt' ? 'replyCount' : 'comments';
                await updateDoc(parentRef, {
                    [fieldToUpdate]: increment(-1)
                });
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleEdit = async (id: string, newText: string) => {
        await updateDoc(doc(db, 'comments', id), { text: newText });
    };

    const rootComments = comments.filter(c => !c.parentId);

    const getReplies = (parentId: string) => {
        return comments.filter(c => c.parentId === parentId);
    };

    return (
        <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-900 text-sm">Discussion</h3>
                <select className="text-[10px] font-bold p-1 rounded bg-slate-100" onChange={(e) => setSortBy(e.target.value as 'asc' | 'desc')}>
                    <option value="asc">Oldest First</option>
                    <option value="desc">Newest First</option>
                </select>
            </div>
            
            <div className="space-y-4 mb-6">
                {rootComments.map(comment => (
                    <CommentNode 
                        key={comment.id} 
                        comment={comment} 
                        replies={getReplies(comment.id)} 
                        onDelete={() => handleDelete(comment.id)} 
                        onReply={() => setReplyTo(comment.id)} 
                        onEdit={handleEdit} 
                        isClosed={isClosed}
                    />
                ))}
            </div>
            
            {(!isClosed || userProfile?.role === 'mentor') ? (
                <div className="flex flex-col gap-2 border border-slate-100 p-2 rounded-xl bg-white shadow-sm">
                    {previewUrl && (
                        <div className="relative inline-block w-max">
                            <img src={previewUrl} alt="Preview" className="h-20 rounded object-contain border border-slate-100" />
                            <button onClick={() => { setSelectedFile(null); setPreviewUrl(''); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title="Attach image">
                            <ImageIcon className="w-4 h-4" />
                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                        </button>
                        <input 
                            value={text} 
                            onChange={e => setText(e.target.value)} 
                            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-slate-400" 
                            placeholder={replyTo ? "Add a reply..." : "Add a comment..."} 
                            disabled={isPosting}
                        />
                        <button disabled={isPosting} onClick={() => handlePost(replyTo || undefined, comments.find(c => c.id === replyTo)?.authorId)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50">
                            {isPosting ? 'Posting...' : 'Post'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="text-center p-2 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-bold">This discussion is closed.</p>
                </div>
            )}
        </div>
    );
};

const CommentNode = ({ comment, replies, onDelete, onReply, onEdit, isClosed }: any) => {
    return (
        <div>
            <CommentItem comment={comment} onDelete={onDelete} onReply={onReply} onEdit={onEdit} isClosed={isClosed} />
            {replies.length > 0 && (
                <div className="ml-8 mt-2 space-y-2">
                    {replies.map((reply: any) => (
                        <CommentNode 
                            key={reply.id} 
                            comment={reply} 
                            replies={[]} 
                            onDelete={onDelete} 
                            onEdit={onEdit} 
                            isClosed={isClosed}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const CommentItem = ({ comment, onDelete, onReply, onEdit, isClosed }: any) => {
    const { userProfile } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(comment.text);
    const canManage = userProfile?.role === 'mentor' || userProfile?.uid === comment.authorId;
    const canEdit = userProfile?.uid === comment.authorId || userProfile?.role === 'mentor';
    
    const handleLike = async () => {
        const likes = comment.likes || [];
        const newLikes = likes.includes(userProfile?.uid) 
            ? likes.filter((id: string) => id !== userProfile?.uid)
            : [...likes, userProfile?.uid];
        await updateDoc(doc(db, 'comments', comment.id), { likes: newLikes });
    };

    const handleAcceptAnswer = async () => {
         await updateDoc(doc(db, 'comments', comment.id), { isAcceptedAnswer: true });
    };

    const saveEdit = () => {
        onEdit(comment.id, editText);
        setIsEditing(false);
    };

    return (
        <div className={`p-2 bg-slate-50 rounded-2xl ${comment.isAcceptedAnswer ? 'border-2 border-green-500' : ''}`}>
            <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-xs flex items-center gap-1">
                    {comment.authorName} 
                    {comment.authorRole === 'mentor' && <span className='text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded'>Mentor</span>}
                    {comment.isAcceptedAnswer && <span className='text-[10px] bg-green-100 text-green-700 px-1 rounded'>Accepted</span>}
                </span>
                {canManage && (
                    <div className='flex gap-1'>
                        {canEdit && <button onClick={() => setIsEditing(!isEditing)} className="text-slate-400 hover:text-indigo-500"><Edit2 className="w-3 h-3" /></button>}
                        <button onClick={onDelete} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                    </div>
                )}
            </div>
            {isEditing ? (
                <div className='flex gap-1'>
                    <input value={editText} onChange={e => setEditText(e.target.value)} className='flex-1 p-1 rounded text-sm'/>
                    <button onClick={saveEdit}><Check className='w-4 h-4 text-green-600'/></button>
                </div>
            ) : (
                <>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{comment.text}</p>
                    {comment.imageUrl && (
                        <div className="mt-2">
                            <img src={comment.imageUrl} alt="Attached image" className="max-w-full max-h-48 object-contain rounded-xl border border-slate-200" />
                        </div>
                    )}
                </>
            )}
            
            <div className="flex items-center gap-3 mt-2">
                <button onClick={handleLike} className={`text-[10px] font-bold flex items-center gap-1 ${comment.likes?.includes(userProfile?.uid) ? 'text-indigo-600' : 'text-slate-500'}`}><ThumbsUp className="w-3 h-3" /> {comment.likes?.length || 0}</button>
                {!comment.parentId && onReply && (!isClosed || userProfile?.role === 'mentor') && <button onClick={onReply} className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Reply className="w-3 h-3" /> Reply</button>}
                {userProfile?.role === 'mentor' && !comment.isAcceptedAnswer && <button onClick={handleAcceptAnswer} className="text-[10px] font-bold text-green-600">Accept Answer</button>}
            </div>
        </div>
    );
};
