const fs = require('fs');
let code = fs.readFileSync('src/components/feed/FeedCards.tsx', 'utf8');

const targetStr = `
    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this doubt?')) {
            await deleteDoc(doc(db, 'discussions', item.id));
        }
    };

    if (!canView) {
`;

const replaceStr = `
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
`;
code = code.replace(targetStr, replaceStr);

const renderTarget = `
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
`;

const renderReplace = `
                <div className="flex items-center gap-2">
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
                    className={\`mb-1.5 mt-2 pl-[40px] cursor-pointer \${!expanded ? 'opacity-80 hover:opacity-100 transition-opacity' : ''}\`}
                    onClick={() => { if(!expanded) setExpanded(true); }}
                >
                    <p className="text-sm text-slate-900 font-bold mb-1 leading-snug">{item.title}</p>
                    <p className={\`text-xs text-slate-600 leading-relaxed mb-1.5 \${!expanded ? 'line-clamp-2' : ''}\`}>
                        {item.content}
                    </p>
                    {!expanded && (
                         <p className="text-[10px] font-bold text-indigo-500 mt-1">Tap to read more...</p>
                    )}
                </div>
            )}
`;
code = code.replace(renderTarget, renderReplace);

fs.writeFileSync('src/components/feed/FeedCards.tsx', code);
console.log("Patched DoubtCard inline editing successfully");
