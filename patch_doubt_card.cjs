const fs = require('fs');

let code = fs.readFileSync('src/components/feed/FeedCards.tsx', 'utf8');

const oldDoubtCard = `export const DoubtCard = React.memo(({ item }: { item: any }) => {
    const { userProfile } = useAuth();
    const isMentor = userProfile?.role === 'mentor';
    const [expanded, setExpanded] = useState(false);
    
    const isSolved = item.status === 'Solved';
    const isPrivate = item.privacy === 'private';
    const canView = !isPrivate || userProfile?.id === item.authorId || isMentor;

    const toggleSolved = async () => {
        const isNowSolved = !isSolved;
        await updateDoc(doc(db, 'discussions', item.id), { status: isNowSolved ? 'Solved' : 'Unsolved' });
        if (isNowSolved && item.authorId !== userProfile?.id) {
            sendNotification(item.authorId, userProfile!.uid, 'Solved', item.id, 'Doubt Solved', \`Your doubt "\${item.title}" was marked as solved.\`);
        }
    };
    
    if (!canView) {
        return (
            <div className="p-4 mb-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <p className="text-sm text-slate-500 font-bold">Personal Guide No ...</p>
            </div>
        );
    }

    return (
        <div className="p-4 mb-3 bg-white border border-indigo-100 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-500 to-purple-500"></div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <img src={item.authorPhoto || \`https://ui-avatars.com/api/?name=\${item.authorName}\`} className="w-8 h-8 rounded-full" alt={item.authorName} />
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
            
            <div className="flex gap-2 items-center mt-3 pl-[40px] flex-wrap">
                <button onClick={() => setExpanded(!expanded)} className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-3 py-1.5 rounded-lg shadow-sm">
                    {expanded ? 'Leave Room' : \`Enter Discussion Room (\${item.replyCount || 0})\`}
                </button>
                {isMentor && (
                    <button onClick={toggleSolved} className={\`text-[10px] font-bold px-2 py-1 rounded-md \${isSolved ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}\`}>
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
});`;

const newDoubtCard = `export const DoubtCard = React.memo(({ item }: { item: any }) => {
    const { userProfile } = useAuth();
    const isMentor = userProfile?.role === 'mentor';
    const [expanded, setExpanded] = useState(false);
    
    const isSolved = item.status === 'Solved';
    const isPrivate = item.privacy === 'private';
    const canView = !isPrivate || userProfile?.id === item.authorId || isMentor;

    const toggleSolved = async () => {
        const isNowSolved = !isSolved;
        await updateDoc(doc(db, 'discussions', item.id), { status: isNowSolved ? 'Solved' : 'Unsolved' });
        if (isNowSolved && item.authorId !== userProfile?.id) {
            sendNotification(item.authorId, userProfile!.uid, 'Solved', item.id, 'Doubt Solved', \`Your doubt "\${item.title}" was marked as solved.\`);
        }
    };
    
    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this doubt?')) {
            await deleteDoc(doc(db, 'discussions', item.id));
        }
    };

    if (!canView) {
        return (
            <div className="p-4 mb-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <p className="text-sm text-slate-500 font-bold">Personal Guide No ...</p>
            </div>
        );
    }

    const canEditOrDelete = item.authorId === userProfile?.id || isMentor;

    return (
        <div className="p-4 mb-3 bg-white border border-indigo-100 rounded-2xl shadow-sm relative overflow-hidden transition-all duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-500 to-purple-500"></div>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <img src={item.authorPhoto || \`https://ui-avatars.com/api/?name=\${item.authorName}\`} className="w-8 h-8 rounded-full" alt={item.authorName} />
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
                
                <div className="flex items-center gap-2">
                    {isSolved && <span className="text-[9px] font-black text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Solved</span>}
                    {canEditOrDelete && (
                        <div className="flex items-center gap-1">
                            <button onClick={handleDelete} className="text-rose-400 hover:text-rose-600 p-1" title="Delete">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            <div 
                className={\`mb-1.5 mt-2 pl-[40px] cursor-pointer \${!expanded ? 'opacity-80 hover:opacity-100 transition-opacity' : ''}\`}
                onClick={() => setExpanded(true)}
            >
                <p className="text-sm text-slate-900 font-bold mb-1 leading-snug">{item.title}</p>
                <p className={\`text-xs text-slate-600 leading-relaxed mb-1.5 \${!expanded ? 'line-clamp-2' : ''}\`}>
                    {item.content}
                </p>
                {!expanded && (
                     <p className="text-[10px] font-bold text-indigo-500 mt-1">Tap to read more...</p>
                )}
            </div>
            
            <div className="flex gap-2 items-center mt-3 pl-[40px] flex-wrap">
                <button onClick={() => setExpanded(!expanded)} className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-3 py-1.5 rounded-lg shadow-sm">
                    {expanded ? 'Leave Room' : \`Enter Discussion Room (\${item.replyCount || 0})\`}
                </button>
                {isMentor && (
                    <button onClick={toggleSolved} className={\`text-[10px] font-bold px-2 py-1 rounded-md \${isSolved ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}\`}>
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
});`;

code = code.replace(oldDoubtCard, newDoubtCard);
fs.writeFileSync('src/components/feed/FeedCards.tsx', code);
console.log("Patched DoubtCard successfully");
