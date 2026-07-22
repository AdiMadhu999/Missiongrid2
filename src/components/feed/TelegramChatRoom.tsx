import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../providers/AuthProvider';
import { 
  ArrowLeft, 
  Send, 
  Paperclip, 
  X, 
  CornerUpLeft, 
  Trash2, 
  Edit3, 
  ThumbsUp, 
  Check, 
  CheckCheck, 
  Pin, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
  HelpCircle,
  MoreVertical
} from 'lucide-react';
import { sendNotification } from '../../services/notifications';
import { uploadFile } from '../../services/storage';
import { getUsersByBatch, getUsersByRole } from '../../services/users';

interface TelegramChatRoomProps {
  item: any; // The original doubt object
  isSolved: boolean;
  toggleSolved: () => Promise<void>;
  isMentor: boolean;
  onClose: () => void;
}

export const TelegramChatRoom: React.FC<TelegramChatRoomProps> = ({
  item,
  isSolved,
  toggleSolved,
  isMentor,
  onClose
}) => {
  const { userProfile } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  
  // Advanced Telegram features
  const [replyToComment, setReplyToComment] = useState<any | null>(null);
  const [editComment, setEditComment] = useState<any | null>(null);
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);

  // Attachment states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // Manage Room Members states
  const [showManageMembers, setShowManageMembers] = useState(false);
  const [potentialParticipants, setPotentialParticipants] = useState<any[]>([]);
  const [roomParticipantIds, setRoomParticipantIds] = useState<string[]>(item.sharedWith || []);
  const [participantSearchTerm, setParticipantSearchTerm] = useState('');
  const [isUpdatingMembers, setIsUpdatingMembers] = useState(false);
  const [isSendingManualNotify, setIsSendingManualNotify] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageMenuRef = useRef<HTMLDivElement>(null);

  // Sync roomParticipantIds with parent item updates
  useEffect(() => {
    if (item.sharedWith) {
      setRoomParticipantIds(item.sharedWith);
    }
  }, [item.sharedWith]);

  // Load potential participants for sharing/management
  useEffect(() => {
    if (showManageMembers) {
      const fetchParticipants = async () => {
        try {
          let participantsList: any[] = [];
          
          // Fetch same-batch students
          if (userProfile?.batchId) {
            const batchStudents = await getUsersByBatch(userProfile.batchId);
            participantsList = [...participantsList, ...batchStudents];
          }
          
          // Fetch mentors
          const mentors = await getUsersByRole('mentor');
          participantsList = [...participantsList, ...mentors];

          // Remove current user
          participantsList = participantsList.filter(u => u.id !== userProfile?.id && u.id !== userProfile?.uid);

          // De-duplicate
          const uniqueMap: Record<string, any> = {};
          participantsList.forEach(p => {
            if (p.id) uniqueMap[p.id] = p;
          });

          setPotentialParticipants(Object.values(uniqueMap));
        } catch (error) {
          console.error("Error fetching room participants:", error);
        }
      };
      fetchParticipants();
    }
  }, [showManageMembers, userProfile?.batchId, userProfile?.id, userProfile?.uid]);

  // 1. Subscribe to comments
  useEffect(() => {
    if (!item.id) return;
    const q = query(collection(db, 'comments'), where('activityId', '==', item.id));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      // Sort chronologically (oldest first like Telegram)
      data.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeA - timeB;
      });
      setComments(data);
    });

    return () => unsubscribe();
  }, [item.id]);

  // 2. Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Close message action menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (messageMenuRef.current && !messageMenuRef.current.contains(e.target as Node)) {
        setActiveMessageMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // 3. Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // 4. Send Message (Text / Image / Reply)
  const handleSendMessage = async () => {
    if (!text.trim() && !selectedFile) return;
    if (isSolved && userProfile?.role !== 'mentor') {
      alert("This doubt group has been solved and closed by a mentor.");
      return;
    }

    setIsPosting(true);
    try {
      let imageUrl = '';
      if (selectedFile) {
        const path = `comments/${userProfile?.id || 'anonymous'}/${Date.now()}_${selectedFile.name}`;
        const result = await uploadFile(path, selectedFile);
        imageUrl = result.url;
      }

      // If we are editing, update instead of create
      if (editComment) {
        await updateDoc(doc(db, 'comments', editComment.id), {
          text: text,
          updatedAt: serverTimestamp()
        });
        setEditComment(null);
      } else {
        // Create new comment
        await addDoc(collection(db, 'comments'), {
          activityId: item.id,
          activityType: 'Doubt',
          authorId: userProfile?.id || userProfile?.uid || 'anonymous',
          authorName: userProfile?.name || 'Student',
          authorRole: userProfile?.role || 'student',
          authorPhoto: userProfile?.photoUrl || '',
          text: text,
          imageUrl: imageUrl,
          parentId: replyToComment ? replyToComment.id : null,
          parentAuthorName: replyToComment ? replyToComment.authorName : null,
          parentSnippet: replyToComment ? (replyToComment.text ? replyToComment.text.slice(0, 50) : 'Photo Attachment') : null,
          createdAt: serverTimestamp(),
          likes: []
        });

        // Increment replyCount
        try {
          const parentRef = doc(db, 'discussions', item.id);
          await updateDoc(parentRef, {
            replyCount: increment(1)
          });
        } catch (e) {
          console.error("Error incrementing comment count:", e);
        }

        // Send notifications to parent comment owner if active reply
        if (replyToComment && replyToComment.authorId && replyToComment.authorId !== userProfile?.id) {
          sendNotification(
            replyToComment.authorId, 
            userProfile?.id || userProfile?.uid || 'system', 
            'Reply', 
            item.id, 
            'New Reply', 
            `${userProfile?.name || 'A student'} replied to your comment.`
          );
        } else if (item.authorId && item.authorId !== userProfile?.id) {
          // Notify doubt owner of a new message
          sendNotification(
            item.authorId,
            userProfile?.id || userProfile?.uid || 'system',
            'Comment',
            item.id,
            'New Chat Message',
            `${userProfile?.name || 'A student'} messaged in your doubt room.`
          );
        }
      }

      // Reset input states
      setText('');
      setReplyToComment(null);
      setSelectedFile(null);
      setPreviewUrl('');
    } catch (err) {
      console.error('Error posting message:', err);
    } finally {
      setIsPosting(false);
    }
  };

  // 5. Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      try {
        await deleteDoc(doc(db, 'comments', commentId));
        const parentRef = doc(db, 'discussions', item.id);
        await updateDoc(parentRef, {
          replyCount: increment(-1)
        });
      } catch (e) {
        console.error("Error deleting comment:", e);
      }
    }
    setActiveMessageMenu(null);
  };

  // 6. Like Comment
  const handleLikeComment = async (comment: any) => {
    const likes = comment.likes || [];
    const myId = userProfile?.id || userProfile?.uid || '';
    const newLikes = likes.includes(myId) 
      ? likes.filter((id: string) => id !== myId)
      : [...likes, myId];
    
    try {
      await updateDoc(doc(db, 'comments', comment.id), { likes: newLikes });
    } catch (err) {
      console.error("Error liking comment:", err);
    }
    setActiveMessageMenu(null);
  };

  // 7. Accept Answer
  const handleAcceptAnswer = async (comment: any) => {
    try {
      await updateDoc(doc(db, 'comments', comment.id), { isAcceptedAnswer: true });
    } catch (err) {
      console.error("Error accepting answer:", err);
    }
    setActiveMessageMenu(null);
  };

  const handleSaveMembers = async () => {
    setIsUpdatingMembers(true);
    try {
      await updateDoc(doc(db, 'discussions', item.id), {
        sharedWith: roomParticipantIds
      });
      setShowManageMembers(false);
    } catch (error) {
      console.error("Error updating room members:", error);
      alert("Failed to update members");
    } finally {
      setIsUpdatingMembers(false);
    }
  };

  const handleSendManualNotification = async () => {
    if (isSendingManualNotify) return;
    setIsSendingManualNotify(true);
    try {
      if (item.privacy === 'private') {
        // Private room: Notify all roomParticipantIds and the original author if different from the sender
        const targets = new Set<string>();
        roomParticipantIds.forEach(id => {
          if (id && id !== userProfile?.id && id !== userProfile?.uid) {
            targets.add(id);
          }
        });
        if (item.authorId && item.authorId !== userProfile?.id && item.authorId !== userProfile?.uid) {
          targets.add(item.authorId);
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

  // Helper to generate consistent avatar color based on username
  const getNameColor = (name: string = '') => {
    const colors = [
      'text-rose-500', 
      'text-emerald-500', 
      'text-blue-500', 
      'text-amber-500', 
      'text-purple-500', 
      'text-teal-500', 
      'text-indigo-500', 
      'text-orange-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Format timestamp like Telegram (e.g. 12:35 PM)
  const formatTime = (createdAt: any) => {
    if (!createdAt) return '';
    const date = createdAt.seconds ? new Date(createdAt.seconds * 1000) : new Date(createdAt);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#eef1f4] text-slate-800 font-sans animate-in fade-in duration-200">
      
      {/* 1. Telegram App Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
            title="Leave Doubt Room"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <img 
              src={item.authorPhoto || `https://ui-avatars.com/api/?name=${item.authorName || 'Student'}&background=random`} 
              className="w-10 h-10 rounded-full object-cover border border-slate-200"
              alt="Group Avatar"
              referrerPolicy="no-referrer"
            />
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${isSolved ? 'bg-green-500' : 'bg-indigo-500'}`}></span>
          </div>

          {/* Title & Info */}
          <div className="min-w-0">
            <h2 className="font-extrabold text-sm text-slate-900 truncate leading-tight flex items-center gap-1.5">
              <span>{item.authorName || 'Student'}'s Doubt</span>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                {item.privacy === 'private' ? '🔒 Private' : '🌐 Group'}
              </span>
            </h2>
            <p className="text-[10px] text-slate-500 font-bold truncate mt-0.5 flex items-center gap-1.5">
              <span>{comments.length} messages</span>
              <span>•</span>
              <span className={isSolved ? 'text-green-600 font-extrabold' : 'text-indigo-600 font-extrabold'}>
                {isSolved ? 'Solved & Closed' : 'Active Discussion'}
              </span>
            </p>
          </div>
        </div>

        {/* Action Header Button */}
        <div className="flex items-center gap-2">
          {item.privacy === 'private' && (userProfile?.id === item.authorId || userProfile?.uid === item.authorId || isMentor) && (
            <button 
              onClick={() => setShowManageMembers(true)}
              className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-250 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>👥 Members</span>
              {roomParticipantIds.length > 0 && <span className="bg-indigo-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black">{roomParticipantIds.length}</span>}
            </button>
          )}
          {isMentor && (
            <button 
              onClick={handleSendManualNotification}
              disabled={isSendingManualNotify}
              className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-250 transition-all flex items-center gap-1 shadow-sm disabled:opacity-50"
              title="Press to instantly send a notification to members/batch students"
            >
              <span>{isSendingManualNotify ? '⚡ Sending...' : '🔔 Press Notify'}</span>
            </button>
          )}
          {isMentor && (
            <button 
              onClick={toggleSolved} 
              className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full transition-all border ${
                isSolved 
                  ? 'bg-amber-50 text-amber-800 border-amber-200' 
                  : 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200'
              }`}
            >
              {isSolved ? '🔓 Reopen Room' : '✅ Mark Solved'}
            </button>
          )}
          <button 
            onClick={onClose}
            className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-all"
          >
            Leave
          </button>
        </div>
      </div>

      {/* 2. Telegram Pinned Message Bar */}
      <div className="bg-[#f0f4f8] border-b border-slate-200/80 px-4 py-2 flex flex-col z-30 shadow-xs">
        <div 
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={() => setIsPinnedExpanded(!isPinnedExpanded)}
        >
          <div className="flex gap-2.5 items-start min-w-0 flex-1">
            <div className="w-1 bg-indigo-500 self-stretch rounded-full flex-shrink-0"></div>
            <div className="min-w-0 flex-1 py-0.5">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                <Pin className="w-3 h-3 fill-indigo-600" /> Pinned Doubt Context
              </span>
              <p className="text-xs font-extrabold text-slate-800 truncate mt-0.5">
                {item.title}
              </p>
              {!isPinnedExpanded && (
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  {item.content}
                </p>
              )}
            </div>
          </div>
          <button 
            className="p-1 rounded-full text-slate-500 hover:bg-slate-200/50 mt-1 transition-colors"
            title={isPinnedExpanded ? "Collapse context" : "Expand context"}
          >
            {isPinnedExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded Pinned Doubt Context */}
        {isPinnedExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-200 pl-3.5 space-y-3 animate-in slide-in-from-top-2 duration-150">
            <div className="bg-white/80 border border-slate-200/55 p-3.5 rounded-2xl max-w-2xl">
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                {item.content}
              </p>

              {item.imageUrl && (
                <div className="mt-3">
                  <p className="text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">Original Attachment:</p>
                  <a href={item.imageUrl} target="_blank" rel="noreferrer" className="inline-block relative group">
                    <img 
                      src={item.imageUrl} 
                      alt="Attachment" 
                      className="max-w-full rounded-xl max-h-48 object-contain border border-slate-200 bg-white shadow-sm transition-opacity group-hover:opacity-90" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center transition-opacity">
                      <ExternalLink className="w-5 h-5 text-white" />
                    </div>
                  </a>
                </div>
              )}
            </div>
            
            <div className="flex gap-4 items-center text-[10px] font-bold text-slate-400 pl-1">
              <span>Asked by <strong className="text-slate-600">{item.authorName}</strong></span>
              <span>•</span>
              <span>
                {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : new Date(item.createdAt || Date.now()).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Chat Room Message Timeline Area */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-[#e5ddd5]" 
        style={{
          backgroundImage: `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")`,
          backgroundBlendMode: 'overlay',
          backgroundSize: '340px'
        }}
      >
        
        {/* Welcome Info Message */}
        <div className="mx-auto max-w-sm bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-slate-150 text-center space-y-1.5">
          <span className="inline-flex p-1.5 bg-indigo-50 text-indigo-600 rounded-xl mb-1">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </span>
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Doubt Room Activated</h3>
          <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
            Welcome to the live chatbox. Discuss and find solutions instantly. Only members of your batch and coordinators can access.
          </p>
        </div>

        {/* Doubt First Message Placeholder (Simulates original question bubble) */}
        <div className="flex justify-start">
          <div className="flex items-end gap-2.5 max-w-[80%]">
            <img 
              src={item.authorPhoto || `https://ui-avatars.com/api/?name=${item.authorName || 'Student'}`} 
              className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0 mb-1"
              alt=""
              referrerPolicy="no-referrer"
            />
            <div className="bg-white rounded-2xl rounded-bl-none p-3.5 shadow-sm border border-slate-200/50 relative flex flex-col">
              <span className={`text-xs font-black leading-none mb-1.5 ${getNameColor(item.authorName)}`}>
                {item.authorName}
                {item.authorRole === 'mentor' && (
                  <span className="ml-1 text-[8px] bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded font-black uppercase">Mentor</span>
                )}
              </span>
              <p className="text-xs font-black text-indigo-600 leading-snug mb-1">{item.title}</p>
              <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{item.content}</p>
              {item.imageUrl && (
                <div className="mt-2.5 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                  <img src={item.imageUrl} alt="Doubt Context" className="max-h-56 object-contain w-full" referrerPolicy="no-referrer" />
                </div>
              )}
              <span className="text-[9px] text-slate-400 font-bold self-end mt-2 leading-none">
                {formatTime(item.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Real-time message list */}
        {comments.map((comment) => {
          const isSelf = comment.authorId === (userProfile?.id || userProfile?.uid);
          const isAccepted = !!comment.isAcceptedAnswer;
          const bubbleColor = isSelf 
            ? (isAccepted ? 'bg-[#D2F3C4] border border-green-300' : 'bg-[#E2F7CB]') 
            : (isAccepted ? 'bg-[#EAFADC] border border-green-200' : 'bg-white');

          return (
            <div key={comment.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'} group`}>
              <div className={`flex items-end gap-2.5 max-w-[80%] ${isSelf ? 'flex-row-reverse' : ''}`}>
                
                {/* User Profile Avatar */}
                {!isSelf && (
                  <img 
                    src={comment.authorPhoto || `https://ui-avatars.com/api/?name=${comment.authorName || 'Student'}&background=random`} 
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0 mb-1"
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                )}

                {/* Message Bubble */}
                <div className={`${bubbleColor} rounded-2xl ${isSelf ? 'rounded-tr-none' : 'rounded-bl-none'} p-3 shadow-xs border border-slate-200/30 relative flex flex-col group`}>
                  
                  {/* Sender Name (Only for others) */}
                  {!isSelf && (
                    <span className={`text-[11px] font-black leading-none mb-1 ${getNameColor(comment.authorName)}`}>
                      {comment.authorName}
                      {comment.authorRole === 'mentor' && (
                        <span className="ml-1 text-[8px] bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded font-black uppercase">Mentor</span>
                      )}
                      {isAccepted && (
                        <span className="ml-1 text-[8px] bg-green-100 text-green-700 px-1 py-0.5 rounded font-black uppercase">Accepted Answer</span>
                      )}
                    </span>
                  )}

                  {/* Reply Reference Preview inside bubble */}
                  {comment.parentId && (
                    <div 
                      className={`border-l-2 pl-2 py-1 pr-1.5 rounded mb-2 text-[10px] cursor-pointer flex flex-col ${
                        isSelf 
                          ? 'border-[#5FA442] bg-[#D6F0BF]/50 text-slate-800' 
                          : 'border-indigo-500 bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span className="font-black text-[9px] uppercase tracking-wide">
                        Replying to {comment.parentAuthorName || 'User'}
                      </span>
                      <span className="truncate opacity-80 mt-0.5 font-medium">
                        {comment.parentSnippet || 'Attached File'}
                      </span>
                    </div>
                  )}

                  {/* Attached Image inside bubble */}
                  {comment.imageUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-slate-100/50 max-h-56 bg-slate-50">
                      <img src={comment.imageUrl} alt="Attached attachment" className="max-h-56 object-contain w-full" referrerPolicy="no-referrer" />
                    </div>
                  )}

                  {/* Message Content */}
                  <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                    {comment.text}
                  </p>

                  {/* Bubble Footer details: Time + Like count + Ticks */}
                  <div className="flex items-center justify-between gap-3 mt-1.5 self-end leading-none">
                    {/* Likes/Hearts status */}
                    {(comment.likes?.length > 0) && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full">
                        ❤️ {comment.likes.length}
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <span className="text-[8.5px] text-slate-400 font-bold">
                        {formatTime(comment.createdAt)}
                      </span>
                      {isSelf && (
                        <span className="text-indigo-600/70">
                          <CheckCheck className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hover Actions Trigger / Context Menu Button */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMessageMenu(activeMessageMenu === comment.id ? null : comment.id);
                      }}
                      className="p-1 rounded-full bg-black/5 hover:bg-black/10 text-slate-600"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Custom Floating Action Dropdown Menu for this bubble */}
                  {activeMessageMenu === comment.id && (
                    <div 
                      ref={messageMenuRef}
                      className="absolute right-0 top-7 z-30 bg-white border border-slate-200 rounded-xl shadow-xl p-1 w-36 py-1.5 animate-in zoom-in-95 duration-100 text-left"
                    >
                      {/* Reply option */}
                      <button 
                        onClick={() => {
                          setReplyToComment(comment);
                          setEditComment(null);
                          setActiveMessageMenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <CornerUpLeft className="w-3.5 h-3.5 text-slate-500" /> Reply
                      </button>

                      {/* Like option */}
                      <button 
                        onClick={() => handleLikeComment(comment)}
                        className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <ThumbsUp className="w-3.5 h-3.5 text-slate-500" /> 
                        {comment.likes?.includes(userProfile?.id || userProfile?.uid) ? 'Unlike' : 'Like'}
                      </button>

                      {/* Mentor option to Accept Answer */}
                      {isMentor && !isAccepted && (
                        <button 
                          onClick={() => handleAcceptAnswer(comment)}
                          className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-green-600 hover:bg-green-50/50 flex items-center gap-2"
                        >
                          <Check className="w-3.5 h-3.5 text-green-600" /> Accept Answer
                        </button>
                      )}

                      {/* Edit option (only if owner) */}
                      {isSelf && (
                        <button 
                          onClick={() => {
                            setEditComment(comment);
                            setReplyToComment(null);
                            setText(comment.text);
                            setActiveMessageMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" /> Edit Message
                        </button>
                      )}

                      {/* Delete option (owner or mentor) */}
                      {(isSelf || isMentor) && (
                        <button 
                          onClick={() => handleDeleteComment(comment.id)}
                          className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Delete
                        </button>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>
          );
        })}

        <div ref={chatEndRef} />
      </div>

      {/* 4. Bottom Telegram Input & Attachments Section */}
      <div className="bg-white border-t border-slate-200 p-3 pb-safe z-30 flex flex-col shadow-lg">
        
        {/* Reply To Preview Container */}
        {replyToComment && (
          <div className="mb-2 bg-slate-50 border-l-4 border-indigo-500 p-2 rounded-r-xl flex justify-between items-center animate-in slide-in-from-bottom-2 duration-150">
            <div className="min-w-0">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wide">
                Replying to {replyToComment.authorName}
              </span>
              <p className="text-xs text-slate-600 truncate mt-0.5">
                {replyToComment.text || 'Photo Attachment'}
              </p>
            </div>
            <button 
              onClick={() => setReplyToComment(null)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Edit Message Preview Container */}
        {editComment && (
          <div className="mb-2 bg-slate-50 border-l-4 border-amber-500 p-2 rounded-r-xl flex justify-between items-center animate-in slide-in-from-bottom-2 duration-150">
            <div className="min-w-0">
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-wide">
                Editing Message
              </span>
              <p className="text-xs text-slate-600 truncate mt-0.5">
                {editComment.text}
              </p>
            </div>
            <button 
              onClick={() => {
                setEditComment(null);
                setText('');
              }}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Selected Image Preview Container */}
        {previewUrl && (
          <div className="mb-2 relative inline-block">
            <img src={previewUrl} alt="Preview Attachment" className="h-24 rounded-xl object-contain border border-slate-200 bg-slate-50" />
            <button 
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl('');
              }} 
              className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-1 shadow-md hover:bg-rose-700 active:scale-95 transition-transform"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Message Input Controls Bar */}
        <div className="flex items-end gap-2.5">
          {/* File Picker / Attach Paperclip Button */}
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()} 
            className="p-2.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-500 rounded-full transition-all active:scale-95 flex-shrink-0 shadow-sm"
            title="Attach Image"
          >
            <Paperclip className="w-5 h-5" />
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
            />
          </button>

          {/* Text Input Container (Telegram rounded capsule style) */}
          <div className="flex-1 bg-slate-100 hover:bg-slate-150/70 border border-slate-200/50 rounded-2xl px-3 py-2 flex items-center gap-2 max-h-32 transition-colors">
            <textarea 
              value={text} 
              onChange={e => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none font-medium max-h-24 pr-1 leading-relaxed" 
              placeholder={isSolved && userProfile?.role !== 'mentor' ? "Doubt room is solved. Replies closed." : "Write a message..."} 
              disabled={isPosting || (isSolved && userProfile?.role !== 'mentor')}
              rows={1}
              style={{ minHeight: '24px' }}
            />
          </div>

          {/* Send / Paper airplane Floating Button */}
          <button 
            type="button"
            disabled={isPosting || (!text.trim() && !selectedFile) || (isSolved && userProfile?.role !== 'mentor')}
            onClick={handleSendMessage}
            className={`p-3 rounded-full text-white transition-all flex-shrink-0 shadow-md active:scale-90 ${
              (!text.trim() && !selectedFile) || (isSolved && userProfile?.role !== 'mentor')
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200/50'
            }`}
          >
            <Send className="w-5 h-5 fill-white" />
          </button>
        </div>

        {/* MANAGE ROOM MEMBERS DIALOG */}
        {showManageMembers && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
              
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                    <span>👥 Manage Doubt Room Members</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                    Add or remove participants who can view and participate in this doubt.
                  </p>
                </div>
                <button 
                  onClick={() => setShowManageMembers(false)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                
                {/* Search input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                    🔍 Search Batchmates or Mentors
                  </label>
                  <input 
                    type="text"
                    placeholder="Search by name..."
                    value={participantSearchTerm}
                    onChange={(e) => setParticipantSearchTerm(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Selected Count / Info */}
                <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider pt-1">
                  <span>Selected Participants ({roomParticipantIds.length})</span>
                  {roomParticipantIds.length > 0 && (
                    <button 
                      type="button" 
                      onClick={() => setRoomParticipantIds([])}
                      className="text-red-500 hover:text-red-600 transition-colors uppercase animate-pulse"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Participant Badges */}
                {roomParticipantIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-150 max-h-24 overflow-y-auto">
                    {roomParticipantIds.map(id => {
                      const userObj = potentialParticipants.find(u => u.id === id);
                      return (
                        <span key={id} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 font-black px-2 py-0.5 rounded-full border border-indigo-100">
                          <span>{userObj?.name || 'Loading participant...'}</span>
                          <button 
                            type="button" 
                            onClick={() => setRoomParticipantIds(prev => prev.filter(x => x !== id))}
                            className="hover:bg-indigo-100 p-0.5 rounded-full"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Filtered Search list */}
                <div className="border border-slate-200 bg-white rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {potentialParticipants
                    .filter(user => {
                      if (!participantSearchTerm.trim()) return true;
                      return user.name?.toLowerCase().includes(participantSearchTerm.toLowerCase());
                    })
                    .map(user => {
                      const isSelected = roomParticipantIds.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setRoomParticipantIds(prev => prev.filter(id => id !== user.id));
                            } else {
                              setRoomParticipantIds(prev => [...prev, user.id]);
                            }
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}
                        >
                          <div className="flex items-center gap-2">
                            <img 
                              src={user.photoUrl || `https://ui-avatars.com/api/?name=${user.name}`} 
                              className="w-6 h-6 rounded-full object-cover border border-slate-100" 
                              alt="" 
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="font-extrabold text-slate-800 leading-none">{user.name}</p>
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
                    <p className="p-3 text-slate-400 text-center text-xs font-bold">No participants found</p>
                  )}
                </div>

              </div>

              {/* Actions Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setShowManageMembers(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={isUpdatingMembers}
                  onClick={handleSaveMembers}
                  className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-all disabled:opacity-50"
                >
                  {isUpdatingMembers ? 'Saving...' : 'Save Members'}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
};
