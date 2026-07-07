import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Megaphone, FileText, Mic, Video, HelpCircle } from 'lucide-react';
import { AlarmClock } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../services/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { FeedSkeleton } from '../components/feed/FeedSkeleton';
import { EmptyState } from '../components/feed/EmptyState';

import { MentorPostCard, DoubtCard, DailyTestCard, ArticleCard, VoiceNoteCard } from '../components/feed/FeedCards';
import { MentorPost, Doubt, DailyTest, MentorPostType } from '../models/feed';
import { useAuth } from '../providers/AuthProvider';
import { NotificationBell } from '../components/NotificationBell';
import { CreatePostModal } from '../components/feed/CreatePostModal';
import { useCachedQuery } from '../hooks/useCachedQuery';

export default function MissionFeedScreen() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPostType, setSelectedPostType] = useState<MentorPostType | 'doubt'>('doubt');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [showSearch, setShowSearch] = useState(false);

  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();

  const postsQuery = useCachedQuery<MentorPost[]>({
    queryKey: ['feedPosts', userProfile?.batchId || ''],
    queryFn: async () => [],
    enabled: !!currentUser && !!userProfile?.id,
    persistKey: userProfile?.uid ? `feed_posts_cache_${userProfile.uid}` : undefined,
    subscribeFn: (callback) => {
      const qPosts = query(collection(db, 'mentorPosts'), orderBy('createdAt', 'desc'), limit(50));
      return onSnapshot(qPosts, (snap) => {
        const allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() } as MentorPost));
        const filteredPosts = allPosts.filter(post => 
            post.visibility === 'global' || post.batchId === userProfile?.batchId
        );
        const sortedPosts = filteredPosts.sort((a, b) => (b.pinnedStatus ? 1 : 0) - (a.pinnedStatus ? 1 : 0));
        callback(sortedPosts);
      }, (error) => {
        console.error("Posts error:", error);
      });
    }
  });

  const doubtsQuery = useCachedQuery<Doubt[]>({
    queryKey: ['feedDoubts', userProfile?.batchId || ''],
    queryFn: async () => [],
    enabled: !!currentUser && !!userProfile?.id,
    persistKey: userProfile?.uid ? `feed_doubts_cache_${userProfile.uid}` : undefined,
    subscribeFn: (callback) => {
      const qDoubts = query(collection(db, 'discussions'), orderBy('createdAt', 'desc'), limit(50));
      return onSnapshot(qDoubts, (snap) => {
        const allDoubts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Doubt));
        const filteredDoubts = allDoubts.filter(doubt => 
            doubt.visibility === 'global' || doubt.batchId === userProfile?.batchId
        );
        callback(filteredDoubts);
      }, (error) => {
        console.error("Doubts error:", error);
      });
    }
  });

  const testsQuery = useCachedQuery<DailyTest[]>({
    queryKey: ['feedTests', userProfile?.batchId || ''],
    queryFn: async () => [],
    enabled: !!currentUser && !!userProfile?.id,
    persistKey: userProfile?.uid ? `feed_tests_cache_${userProfile.uid}` : undefined,
    subscribeFn: (callback) => {
      const qTests = query(collection(db, 'dailyTests'), orderBy('createdAt', 'desc'), limit(30));
      return onSnapshot(qTests, (snap) => {
        const allTests = snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyTest));
        const filteredTests = allTests.filter(test => 
            (test.visibility === 'global' || test.batchId === userProfile?.batchId) && test.shareToCommunity
        );
        
        const seenTestIds = new Set<string>();
        const uniqueTests = filteredTests.filter(test => {
            const tid = test.testId || test.id;
            if (!tid) return true;
            if (seenTestIds.has(tid)) return false;
            seenTestIds.add(tid);
            return true;
        });

        const sortedTests = uniqueTests.sort((a, b) => {
            const getMillis = (dateVal: any): number => {
                if (!dateVal) return 0;
                if (typeof dateVal.toMillis === 'function') return dateVal.toMillis();
                if (typeof dateVal.toDate === 'function') return dateVal.toDate().getTime();
                const d = new Date(dateVal);
                return isNaN(d.getTime()) ? 0 : d.getTime();
            };
            return getMillis(b.createdAt) - getMillis(a.createdAt);
        });

        callback(sortedTests);
      }, (error) => {
        console.error("Tests error:", error);
      });
    }
  });

  const posts = postsQuery.data || [];
  const doubts = doubtsQuery.data || [];
  const tests = testsQuery.data || [];

  const loading = (postsQuery.isLoading && posts.length === 0) || 
                  (doubtsQuery.isLoading && doubts.length === 0) || 
                  (testsQuery.isLoading && tests.length === 0);

  const showHeroCard = tests.length > 0 && (filterType === 'All' || filterType === 'Tests') && !searchQuery;
  const testsToFeed = showHeroCard ? tests.slice(1) : tests;

  const filteredItems = [...posts, ...doubts, ...testsToFeed]
    .filter(item => {
        const title = (item as any).title || (item as any).testName || '';
        const content = (item as any).content || '';
        const author = (item as any).authorName || '';
        const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             content.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             author.toLowerCase().includes(searchQuery.toLowerCase());
                             
        let matchesFilter = filterType === 'All';
        if (filterType === 'Announcements') matchesFilter = item.type === 'MentorPost' && (item as MentorPost).postType === 'announcement';
        if (filterType === 'Articles') matchesFilter = item.type === 'MentorPost' && (item as MentorPost).postType === 'article';
        if (filterType === 'Voice Notes') matchesFilter = item.type === 'MentorPost' && (item as MentorPost).postType === 'voiceNote';
        if (filterType === 'Videos') matchesFilter = item.type === 'MentorPost' && (item as MentorPost).postType === 'video';
        if (filterType === 'Doubts') matchesFilter = item.type === 'Doubt';
        if (filterType === 'Tests') matchesFilter = item.type === 'DailyTest';
        if (filterType === 'Bookmarks') matchesFilter = (item as any).saves?.includes(userProfile?.uid);

        return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
        const getMillis = (dateVal: any): number => {
            if (!dateVal) return 0;
            if (typeof dateVal.toMillis === 'function') return dateVal.toMillis();
            if (typeof dateVal.toDate === 'function') return dateVal.toDate().getTime();
            const d = new Date(dateVal);
            return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        const dateA = getMillis(a.createdAt);
        const dateB = getMillis(b.createdAt);
        return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-gradient-to-tr from-slate-50 via-white to-indigo-50/30 pointer-events-none -z-10" />

      <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-[70px] flex items-center justify-between">
            <div className="flex items-center gap-2">
                <img
                    src="/src/assets/images/app_logo_1783375653854.jpg"
                    alt="MissionGrid Logo"
                    className="w-8 h-8 rounded-lg object-cover"
                    referrerPolicy="no-referrer"
                />
                <h1 className="text-xl font-bold text-slate-900 tracking-tighter">MISSIONGRID</h1>
            </div>
            
            <div className="flex items-center gap-4">
                {showSearch ? (
                    <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5 animate-in fade-in slide-in-from-right-4 duration-200">
                        <input 
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none focus:outline-none text-sm w-32 md:w-48"
                            autoFocus
                        />
                        <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="text-slate-400 hover:text-slate-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                ) : (
                    <button onClick={() => setShowSearch(true)} className="p-2 text-slate-700 hover:bg-slate-100 rounded-full transition">
                        <Search className="w-5 h-5" />
                    </button>
                )}
                
                <NotificationBell />
                <img src={userProfile?.photoUrl || 'https://ui-avatars.com/api/?name=' + (userProfile?.name || 'U')} alt="Profile" className="w-8 h-8 rounded-full border-2 border-slate-100 shadow-sm cursor-pointer" onClick={() => navigate('/app/profile')} />
            </div>
        </div>
        

        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide border-t border-slate-50 bg-white">
            {['All', 'Announcements', 'Articles', 'Doubts', 'Tests', 'Voice Notes', 'Videos', 'Bookmarks'].map(type => {
                const isActive = filterType === type;
                return (
                    <button 
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                            isActive 
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'
                        }`}
                    >
                        {type}
                    </button>
                );
            })}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
         {/* 3. Live Test Hero Card */}
        {showHeroCard && (
            <div className="bg-gradient-to-br from-rose-50/80 via-white to-amber-50/60 p-2.5 rounded-xl shadow-sm border border-rose-100/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
                <div className="flex justify-between items-start">
                   <div className="flex gap-2 items-center">
                      <div className="w-8 h-8 rounded-full border border-rose-200 flex items-center justify-center bg-rose-50 shrink-0">
                         <motion.div
                           animate={{ rotate: [-10, 10, -10] }}
                           transition={{ repeat: Infinity, duration: 0.25, ease: "easeInOut" }}
                         >
                            <AlarmClock className="w-4.5 h-4.5 text-rose-600" />
                         </motion.div>
                      </div>
                      <div>
                         <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm line-clamp-1">{tests[0].testName}</h3>
                            <span className="bg-rose-100 text-rose-700 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                              <span className="w-1 h-1 rounded-full bg-rose-600 inline-block"></span>
                              Ringing
                            </span>
                         </div>
                         <p className="text-[10px] text-slate-500 font-medium">Daily Practice Mock Test</p>
                      </div>
                   </div>
                   <button className="text-slate-400 hover:text-rose-600 p-0.5 shrink-0 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                   </button>
                </div>
                
                <div className="grid grid-cols-3 gap-1.5 my-2 text-center">
                    <div className="bg-rose-50/40 border border-rose-100/20 rounded-lg py-1 px-1.5"><p className="text-[9px] text-rose-700 font-bold leading-tight">Questions</p><p className="text-xs font-extrabold text-slate-900">{tests[0].questionCount || 0}</p></div>
                    <div className="bg-amber-50/40 border border-amber-100/20 rounded-lg py-1 px-1.5"><p className="text-[9px] text-amber-700 font-bold leading-tight">Duration</p><p className="text-xs font-extrabold text-slate-900">{tests[0].duration || 0}m</p></div>
                    <div className="bg-slate-50/60 border border-slate-100 rounded-lg py-1 px-1.5"><p className="text-[9px] text-slate-500 font-bold leading-tight">Type</p><p className="text-xs font-extrabold text-slate-900 capitalize">Objective</p></div>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => navigate(`/app/tests/attempt/${tests[0].testId || tests[0].id}`)} className="flex-1 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-extrabold py-1.5 text-xs rounded-lg transition-all shadow-sm active:scale-[0.98]">Solve Now</button>
                   <button onClick={() => {
                        if (navigator.share) {
                            navigator.share({
                                title: tests[0].testName,
                                text: 'Check out this test on MissionGrid!',
                                url: window.location.href,
                            });
                        }
                   }} className="border border-rose-200 hover:bg-rose-50 text-rose-700 font-extrabold py-1.5 px-3.5 text-xs rounded-lg transition-colors">Share</button>
                </div>
            </div>
        )}

        {/* 4. Community Feed */}
        <main className="space-y-2">
            
            {loading ? (
                <FeedSkeleton />
            ) : filteredItems.length === 0 ? (
                <EmptyState message="No matching activities found." />
            ) : (
                filteredItems.map(item => {
                    if (item.type === 'MentorPost') {
                        const post = item as MentorPost;
                        if (post.postType === 'article') return <ArticleCard key={post.id} item={post} />;
                        if (post.postType === 'voiceNote') return <VoiceNoteCard key={post.id} item={post} />;
                        return <MentorPostCard key={post.id} item={post} />;
                    }
                    if (item.type === 'Doubt') return <DoubtCard key={item.id} item={item as Doubt} />;
                    if (item.type === 'DailyTest') return <DailyTestCard key={item.id} item={item as DailyTest} />;
                    return null;
                })
            )}
        </main>
      </div>

      {/* 5. Floating Action Button */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setIsOpen(false)} />
      )}
      <div className="fixed bottom-20 right-6 z-50 flex flex-col items-end gap-3">
        {isOpen && (
          <div className="bg-white p-2 rounded-2xl shadow-xl border border-slate-100 flex flex-col gap-1 w-48 animate-in fade-in zoom-in duration-200">
            {userProfile?.role === 'mentor' && (
              <>
                <button onClick={() => { setSelectedPostType('announcement'); setModalOpen(true); setIsOpen(false); }} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-900"><Megaphone className="w-5 h-5 text-indigo-600" /> Announcement</button>
                <button onClick={() => { setSelectedPostType('article'); setModalOpen(true); setIsOpen(false); }} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-900"><FileText className="w-5 h-5 text-indigo-600" /> Article</button>
                <button onClick={() => { setSelectedPostType('voiceNote'); setModalOpen(true); setIsOpen(false); }} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-900"><Mic className="w-5 h-5 text-indigo-600" /> Voice Note</button>
                <button onClick={() => { setSelectedPostType('video'); setModalOpen(true); setIsOpen(false); }} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-900"><Video className="w-5 h-5 text-indigo-600" /> Video</button>
                <button onClick={() => { setSelectedPostType('pdf'); setModalOpen(true); setIsOpen(false); }} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-900"><FileText className="w-5 h-5 text-indigo-600" /> PDF Document</button>
                <button onClick={() => { setSelectedPostType('image'); setModalOpen(true); setIsOpen(false); }} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-900"><Video className="w-5 h-5 text-indigo-600" /> Image</button>
              </>
            )}
            <button onClick={() => { setSelectedPostType('doubt'); setModalOpen(true); setIsOpen(false); }} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-900"><HelpCircle className="w-5 h-5 text-indigo-600" /> Doubt</button>
          </div>
        )}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 bg-purple-600 rounded-full shadow-lg flex items-center justify-center text-white transition-transform ${isOpen ? 'rotate-45' : ''}`}
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      <CreatePostModal 
          isOpen={modalOpen} 
          onClose={() => setModalOpen(false)} 
          postType={selectedPostType} 
      />

    </div>
  );
}
