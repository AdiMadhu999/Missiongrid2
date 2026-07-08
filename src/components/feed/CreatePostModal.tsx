import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../providers/AuthProvider';
import { MentorPostType } from '../../models/feed';
import { uploadFile } from '../../services/storage';

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
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                    imageUrl: finalImageUrl || ''
                });
            } else {
                await addDoc(collection(db, 'mentorPosts'), {
                    type: 'MentorPost',
                    postType,
                    title,
                    content,
                    authorId: userProfile?.id,
                    authorName: userProfile?.name || 'Unknown',
                    authorPhoto: userProfile?.photoUrl || '',
                    authorRole: userProfile?.role || 'mentor',
                    batchId: userProfile?.batchId || '',
                    visibility: 'global',
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
