import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../providers/AuthProvider';
import { MentorPostType } from '../../models/feed';
import { uploadFile } from '../../services/storage';
import { BatchService } from '../../services/batch';

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
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [batches, setBatches] = useState<any[]>([]);
    const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && postType !== 'doubt') {
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
    }, [isOpen, postType]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let finalImageUrl = imageUrl;
            
            if (selectedFile) {
                const path = `posts/${userProfile?.id}/${Date.now()}_${selectedFile.name}`;
                const result = await uploadFile(path, selectedFile);
                finalImageUrl = result.url;
            }

            if (postType === 'doubt') {
                await addDoc(collection(db, 'discussions'), {
                    type: 'Doubt',
                    title,
                    content,
                    privacy,
                    authorId: userProfile?.id,
                    authorName: userProfile?.name || 'Unknown',
                    authorPhoto: userProfile?.photoUrl || '',
                    authorRole: userProfile?.role || 'student',
                    batchId: userProfile?.batchId || '',
                    visibility: 'global',
                    status: 'Unsolved',
                    createdAt: serverTimestamp(),
                    replyCount: 0,
                    likes: [],
                    saves: [],
                    comments: 0,
                    imageUrl: finalImageUrl || '',
                    mentorId: userProfile?.mentorId || ''
                });
            } else {
                if (selectedBatchIds.length === 0) {
                    alert('Please select at least one batch.');
                    setLoading(false);
                    return;
                }
                const isAllSelected = selectedBatchIds.length === batches.length;
                await addDoc(collection(db, 'mentorPosts'), {
                    type: 'MentorPost',
                    postType,
                    title,
                    content,
                    authorId: userProfile?.id,
                    authorName: userProfile?.name || 'Unknown',
                    authorPhoto: userProfile?.photoUrl || '',
                    authorRole: userProfile?.role || 'mentor',
                    batchId: selectedBatchIds[0] || '',
                    batchIds: selectedBatchIds,
                    visibility: isAllSelected ? 'global' : 'batch',
                    publishedStatus: 'published',
                    pinnedStatus: false,
                    youtubeLink: postType === 'video' ? link : '',
                    externalLink: postType === 'pdf' ? link : '',
                    imageUrl: finalImageUrl || '',
                    createdAt: serverTimestamp(),
                    likes: [],
                    saves: [],
                    comments: 0,
                    views: 0
                });
            }

            onClose();
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Failed to create post');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="font-bold text-slate-900 capitalize text-lg">
                        Create {postType === 'doubt' ? 'Doubt' : postType}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Title</label>
                            <input 
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                                placeholder="Enter a descriptive title..."
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Content</label>
                            <textarea 
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                                placeholder="Write your content here..."
                                required
                            />
                        </div>

                        {postType === 'doubt' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Privacy</label>
                                <div className="flex gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setPrivacy('public')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${privacy === 'public' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                                    >
                                        Public
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setPrivacy('private')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${privacy === 'private' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                                    >
                                        Private
                                    </button>
                                </div>
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
                                    placeholder="https://youtube.com/..."
                                    required
                                />
                            </div>
                        )}

                        {(postType === 'pdf') && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">PDF URL</label>
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

                        {postType === 'doubt' && (
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2">
                                    <input 
                                        type="radio" 
                                        name="privacy" 
                                        value="public" 
                                        checked={privacy === 'public'}
                                        onChange={() => setPrivacy('public')}
                                        className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-slate-700">Public</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input 
                                        type="radio" 
                                        name="privacy" 
                                        value="private" 
                                        checked={privacy === 'private'}
                                        onChange={() => setPrivacy('private')}
                                        className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-slate-700">Private</span>
                                </label>
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
                                <div className="mt-2 text-center text-xs text-slate-400 font-medium">OR</div>
                                <input 
                                    type="url"
                                    value={imageUrl}
                                    onChange={e => setImageUrl(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 mt-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                                    placeholder="Enter image URL directly..."
                                    required={postType === 'image' && !selectedFile}
                                />
                            </div>
                        )}

                        {postType !== 'doubt' && userProfile?.role === 'mentor' && (
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
                    </div>
                    
                    <div className="mt-6 flex gap-3">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-200 transition"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={loading || !title || !content}
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
