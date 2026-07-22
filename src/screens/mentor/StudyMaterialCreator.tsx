import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Download, Printer, X, Upload, FileText, Trash2, Share2, Smile, Zap, HelpCircle, Layers, Activity } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import mermaid from 'mermaid';
import { useAuth } from '../../providers/AuthProvider';
import { auth, storage } from '../../services/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import toast from 'react-hot-toast';
import { GenerationCenter } from '../../components/GenerationCenter';
import { downloadPdfStream } from '../../utils/downloadHelper';

interface UploadQueueItem {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'text' | 'youtube';
  data: string;
  mimeType?: string;
  ocrText?: string;
  isUploading: boolean;
  isOcrProcessing?: boolean;
  uploadProgress: number;
}

export default function StudyMaterialCreator() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('formal');
  const [depth, setDepth] = useState('detailed');
  const [language, setLanguage] = useState('english');
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [isNoteMaking, setIsNoteMaking] = useState(false);
  const [includeMindmap, setIncludeMindmap] = useState(false);
  const [isFunnyMemoryMode, setIsFunnyMemoryMode] = useState(true);
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'ocr' | 'generating' | 'complete'>('idle');
  const [showPreview, setShowPreview] = useState(false);
  const [showGenCenter, setShowGenCenter] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartBackgroundJob = async () => {
    if (!topic.trim() && uploadQueue.length === 0) {
      toast.error('Please enter a topic or upload source files');
      return;
    }
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/mentor/study-jobs/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          topic, 
          tone, 
          depth, 
          language, 
          isEnhanced, 
          isNoteMaking, 
          includeMindmap, 
          isFunnyMemoryMode, 
          uploadQueue 
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start background job');
      }

      const { jobId } = await res.json();
      toast.success(`🚀 Background PDF generation started for "${topic}"! You can continue working while it processes in the background.`, { duration: 6000 });
      setShowGenCenter(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start background generation');
    }
  };

  const Timeline = () => {
    if (status === 'idle') return null;
    const steps = [
        { id: 'uploading', label: 'File Upload' },
        { id: 'ocr', label: 'OCR Processing' },
        { id: 'generating', label: 'Content Generation' }
    ];
    return (
        <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
                {steps.map((step, index) => (
                    <div key={step.id} className={`flex flex-col items-center flex-1 ${index < steps.findIndex(s => s.id === status) ? 'text-emerald-600' : (step.id === status ? 'text-indigo-600' : 'text-slate-300')}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mb-1 ${index < steps.findIndex(s => s.id === status) ? 'bg-emerald-600 border-emerald-600 text-white' : (step.id === status ? 'border-indigo-600 text-indigo-600' : 'border-slate-300')}`}>
                            {index + 1}
                        </div>
                        <span className="text-[10px] font-bold uppercase">{step.label}</span>
                    </div>
                ))}
            </div>
            <div className="h-1 bg-slate-200 rounded-full w-full">
                <div className={`h-1 bg-indigo-600 rounded-full transition-all duration-500`} style={{ width: `${(steps.findIndex(s => s.id === status) + 1) * (100 / steps.length)}%` }}></div>
            </div>
        </div>
    );
  };

  const Mermaid = ({ chart }: { chart: string }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      mermaid.initialize({
        startOnLoad: true,
        theme: 'neutral',
        securityLevel: 'loose',
        fontFamily: 'Inter',
      });
      if (ref.current && chart) {
        mermaid.contentLoaded();
        mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, chart).then((res) => {
          if (ref.current) {
            ref.current.innerHTML = res.svg;
          }
        });
      }
    }, [chart]);

    return <div key={chart} ref={ref} className="mermaid-chart flex justify-center my-8 overflow-hidden rounded-xl border border-slate-100 p-4 bg-slate-50/30" />;
  };

  const processAndOcrFile = async (file: File, id: string, type: 'pdf' | 'image' | 'text') => {
    // 1. Read file as Base64 Data URL
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      
      setUploadQueue(prev => prev.map(item => 
        item.id === id 
          ? { ...item, data: base64Data, mimeType: file.type, isUploading: false, isOcrProcessing: true, uploadProgress: 100 } 
          : item
      ));

      setStatus('ocr');
      const ocrToastId = toast.loading(`🔍 AI OCR: Extracting text & formulas from ${file.name}...`);

      try {
        const idToken = await auth.currentUser?.getIdToken();
        const response = await fetch('/api/ai/ocr-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            upload: {
              id,
              name: file.name,
              type,
              mimeType: file.type,
              data: base64Data
            }
          })
        });

        if (response.ok) {
          const { text } = await response.json();
          setUploadQueue(prev => prev.map(item => 
            item.id === id 
              ? { ...item, ocrText: text, isOcrProcessing: false } 
              : item
          ));
          toast.success(`✨ OCR Complete for ${file.name}! (${(text || '').length} chars extracted)`, { id: ocrToastId });
        } else {
          throw new Error("OCR extraction request failed");
        }
      } catch (err: any) {
        console.error("OCR Error:", err);
        toast.error(`⚠️ OCR note for ${file.name}: Raw file will be processed during AI generation.`, { id: ocrToastId });
        setUploadQueue(prev => prev.map(item => 
          item.id === id ? { ...item, isOcrProcessing: false } : item
        ));
      } finally {
        setStatus('idle');
      }
    };

    reader.readAsDataURL(file);

    // 2. Optional background upload to Firebase Storage
    try {
      const fileRef = ref(storage, `study_files/${id}_${file.name}`);
      const uploadTask = uploadBytesResumable(fileRef, file);
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadQueue(prev => prev.map(item => item.id === id ? { ...item, uploadProgress: progress } : item));
        },
        (error) => {
          console.warn("Firebase Storage direct upload skipped:", error.message);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            setUploadQueue(prev => prev.map(item => item.id === id && !item.data ? { ...item, data: downloadUrl } : item));
          } catch (e) {}
        }
      );
    } catch (e) {
      console.warn("Storage upload notice:", e);
    }
  };

  const handleFileUpload = (files: FileList) => {
    setStatus('uploading');
    Array.from(files).forEach((file, index) => {
      const id = `${Date.now()}-${index}`;
      const type = file.type.startsWith("image/") ? 'image' : (file.type === "application/pdf" ? 'pdf' : 'text');
      const placeholderItem: UploadQueueItem = {
        id,
        name: file.name,
        type,
        mimeType: file.type,
        data: "",
        isUploading: true,
        isOcrProcessing: false,
        uploadProgress: 0
      };
      setUploadQueue(prev => [...prev, placeholderItem]);
      processAndOcrFile(file, id, type);
    });
  };

  const handlePreview = async () => {
    if (!topic.trim() && uploadQueue.length === 0) {
      toast.error('Please enter a topic or upload files');
      return;
    }
    setIsGenerating(true);
    setStatus('ocr');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      
      // 1. Combine OCR processing / pre-extracted texts for each file
      let combinedText = '';
      for (const item of uploadQueue) {
        if (item.ocrText) {
          combinedText += `\n\n--- OCR Context from ${item.name} ---\n${item.ocrText}`;
        } else if (item.data) {
          const ocrResponse = await fetch('/api/ai/ocr-file', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ upload: item })
          });
          if (ocrResponse.ok) {
            const { text } = await ocrResponse.json();
            combinedText += `\n\n${text}`;
          }
        }
      }

      // 2. Generate content using topic + combined text
      setStatus('generating');
      const response = await fetch('/api/mentor/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ topic, tone, depth, language, isEnhanced, isNoteMaking, includeMindmap, isFunnyMemoryMode, content: combinedText })
      });
      
      if (!response.ok) throw new Error('Failed to generate content');
      
      const { content: generatedContent } = await response.json();
      setContent(generatedContent);
      setShowPreview(true);
      setStatus('complete');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate study material');
      setStatus('idle');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateShortNotes = async () => {
    if (!topic.trim() && uploadQueue.length === 0) {
      toast.error('Please enter a topic or upload files');
      return;
    }
    setIsGenerating(true);
    setStatus('ocr');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      
      // 1. OCR processing for each file
      let combinedText = '';
      for (const item of uploadQueue) {
        if (item.ocrText) {
          combinedText += `\n\n--- OCR Context from ${item.name} ---\n${item.ocrText}`;
        } else if (item.data) {
          const ocrResponse = await fetch('/api/ai/ocr-file', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ upload: item })
          });
          if (ocrResponse.ok) {
            const { text } = await ocrResponse.json();
            combinedText += `\n\n${text}`;
          }
        }
      }

      // 2. Generate content using topic + combined text
      setStatus('generating');
      const response = await fetch('/api/mentor/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ topic, tone, depth, language, isEnhanced, isNoteMaking: true, includeMindmap, isFunnyMemoryMode, content: combinedText })
      });
      
      if (!response.ok) throw new Error('Failed to generate content');
      
      const { content: generatedContent } = await response.json();
      setContent(generatedContent);
      setShowPreview(true);
      setStatus('complete');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate short notes');
      setStatus('idle');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    try {
      const sanitizedTopic = (topic || 'Study_Guide').replace(/[^a-zA-Z0-9_-]/g, '_');
      await downloadPdfStream('/api/mentor/generate-pdf', `${sanitizedTopic}_MissionGrid.pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { content, topic }
      });
      toast.success('📥 PDF download initiated!');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to download PDF');
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gradient-to-tr from-slate-100 via-slate-50 to-indigo-50/40 min-h-screen pb-32">
        <div className="flex items-center justify-between mb-6 max-w-4xl mx-auto">
          <button onClick={() => navigate('/app/home')} className="flex items-center gap-2 text-slate-600 font-black text-xs uppercase tracking-widest hover:text-indigo-600 transition-colors">
              <ArrowLeft size={16} /> Back to Dashboard
          </button>
        </div>
        
        <div className="bg-white/95 p-6 sm:p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm shadow-indigo-100/20 max-w-4xl mx-auto mb-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-black text-slate-900">Study Material Creator</h1>
              <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full flex items-center gap-1">
                <Sparkles size={12} className="animate-pulse" /> Non-Blocking AI Engine
              </span>
            </div>
            <p className="text-slate-500 text-sm mb-6">Create publication-quality study materials with background AI PDF generation.</p>
            
            <Timeline />

            <div className="space-y-4">
                <textarea 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter the topic or content you want to create study material for..."
                    className="w-full h-32 p-4 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none resize-none font-sans"
                />

                {/* Upload Area */}
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center">
                  <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && handleFileUpload(e.target.files)} className="hidden" multiple />
                  <button onClick={() => fileInputRef.current?.click()} className="text-indigo-600 font-bold flex items-center justify-center gap-2 mx-auto">
                    <Upload size={20} /> Upload Files (PDF/Image)
                  </button>
                  <div className="mt-4 space-y-2">
                    {uploadQueue.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl text-sm border border-slate-200/60">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-[300px]">{item.name}</span>
                          {item.isOcrProcessing && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                              <Sparkles size={11} className="animate-spin" /> OCR Extracting...
                            </span>
                          )}
                          {item.ocrText && !item.isOcrProcessing && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✨ OCR Ready ({item.ocrText.length} chars)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.isUploading ? (
                            <span className="text-xs font-semibold text-slate-500">{item.uploadProgress}%</span>
                          ) : (
                            <button 
                              onClick={() => setUploadQueue(prev => prev.filter(i => i.id !== item.id))} 
                              className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                              title="Remove file"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Quick Subject Tag Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-2 uppercase tracking-wider">Quick Subject Selector</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'English Vocabulary', 'English Grammar', 'Mathematics', 'Reasoning', 
                      'Static GK & Current Affairs', 'Physics', 'Chemistry', 'Biology', 
                      'History', 'Geography', 'Polity', 'Economy', 'Computer Awareness', 
                      'Environment', 'SSC CGL / CHSL', 'Railway RRB NTPC / Group D', 'Banking IBPS / SBI', 'State PSC Exams'
                    ].map(subj => (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setTopic(prev => prev ? `${prev} - ${subj}` : subj)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 border border-slate-200 transition-colors"
                      >
                        + {subj}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Tone</label>
                    <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-medium">
                      <option value="formal">Exam-Oriented & Formal</option>
                      <option value="casual">Conversational & Engaging</option>
                      <option value="child-friendly">Child-Friendly & Simplified</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Depth</label>
                    <select value={depth} onChange={(e) => setDepth(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-medium">
                      <option value="detailed">Detailed Book Chapter (Comprehensive)</option>
                      <option value="summary">Quick Summary & Key Formulae</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">Language Edition</label>
                    <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm font-medium font-semibold text-indigo-900">
                      <option value="english">📘 English Edition Only</option>
                      <option value="bengali">📗 Bengali Edition Only (বাংলা সংস্করণ)</option>
                      <option value="both">📘 English + 📗 Bengali (Two Separate PDFs)</option>
                    </select>
                  </div>
                </div>

                {/* Strict Language Policy Notice */}
                <div className="p-3 bg-indigo-50/80 border border-indigo-200/80 rounded-xl text-xs text-indigo-950 flex items-start gap-2">
                  <Sparkles size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block text-indigo-900">STRICT LANGUAGE POLICY ENFORCED</strong>
                    <span>English and Bengali are <strong>NEVER mixed</strong> inside the same PDF document. Selecting 'Both' will synthesize and generate <strong>TWO completely separate, publication-grade PDF books</strong> (📘 English Edition & 📗 Bengali Edition) with proper Unicode rendering and color themes. No Hindi is used anywhere.</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button 
                    onClick={() => setIsEnhanced(!isEnhanced)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${isEnhanced ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    <Sparkles size={20} className={isEnhanced ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="text-[10px] font-black uppercase tracking-wider text-center leading-none">Enhanced AI</span>
                    <div className={`w-8 h-1 rounded-full ${isEnhanced ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                  </button>

                  <button 
                    onClick={() => setIsNoteMaking(!isNoteMaking)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${isNoteMaking ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    <FileText size={20} className={isNoteMaking ? 'text-emerald-600' : 'text-slate-400'} />
                    <span className="text-[10px] font-black uppercase tracking-wider text-center leading-none">Short Notes</span>
                    <div className={`w-8 h-1 rounded-full ${isNoteMaking ? 'bg-emerald-600' : 'bg-slate-200'}`} />
                  </button>

                  <button 
                    onClick={() => setIncludeMindmap(!includeMindmap)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${includeMindmap ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    <Share2 size={20} className={includeMindmap ? 'text-amber-600' : 'text-slate-400'} />
                    <span className="text-[10px] font-black uppercase tracking-wider text-center leading-none">Mindmap</span>
                    <div className={`w-8 h-1 rounded-full ${includeMindmap ? 'bg-amber-600' : 'bg-slate-200'}`} />
                  </button>

                  <button 
                    onClick={() => setIsFunnyMemoryMode(!isFunnyMemoryMode)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${isFunnyMemoryMode ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    title="Funny Memory Mode: Generates funny tricks, stories, and phonetic associations for vocabulary topics (Synonyms, Idioms, OWS, etc.)"
                  >
                    <Smile size={20} className={isFunnyMemoryMode ? 'text-rose-600' : 'text-slate-400'} />
                    <span className="text-[10px] font-black uppercase tracking-wider text-center leading-none">😂 Funny Memory</span>
                    <div className={`w-8 h-1 rounded-full ${isFunnyMemoryMode ? 'bg-rose-600' : 'bg-slate-200'}`} />
                  </button>
                </div>

                {isFunnyMemoryMode && (
                  <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                    <Zap size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block mb-0.5">😂 Funny Memory Mode Active</strong>
                      <span>Automatically appends funny stories, phonetic sound associations, and visual mnemonics when <strong>Vocabulary</strong> topics (Synonyms, Antonyms, OWS, Idioms, Phrasal Verbs) are detected. Auto-skipped for non-vocab subjects like Maths or GK.</span>
                    </div>
                  </div>
                )}
                
                {/* Background Generation Primary Button */}
                <button 
                    onClick={handleStartBackgroundJob}
                    className="w-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white font-black py-4 rounded-2xl text-sm hover:from-indigo-500 hover:to-purple-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transform hover:-translate-y-0.5"
                >
                    <Zap size={18} className="text-amber-300 animate-bounce" />
                    ⚡ Start Background PDF Generation (Non-Blocking)
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <button 
                      onClick={handlePreview}
                      disabled={isGenerating}
                      className="w-full bg-slate-100 text-slate-800 font-bold py-3 rounded-xl text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                      {isGenerating ? 'Generating...' : '👁️ Interactive Web Preview'}
                  </button>
                  
                  <button 
                      onClick={handleGenerateShortNotes}
                      disabled={isGenerating}
                      className="w-full bg-slate-100 text-slate-800 font-bold py-3 rounded-xl text-xs hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                      {isGenerating ? 'Generating...' : '📝 Generate Short Notes'}
                  </button>
                </div>
            </div>
        </div>

        {/* Directly Embedded Generation Center Queue on Page */}
        <div className="max-w-4xl mx-auto">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Generation Queue & Completed Study Guides
            </h2>
            <span className="text-xs text-slate-500 font-medium">Auto-refreshing live status</span>
          </div>
          <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
            <GenerationCenter />
          </div>
        </div>

        {showPreview && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center p-4 border-b">
                <h2 className="font-bold">Print Preview</h2>
                <button onClick={() => setShowPreview(false)}><X size={20}/></button>
              </div>
              <div id="print-preview-modal" className="p-8 overflow-y-auto flex-grow prose prose-slate max-w-none relative bg-white">
                {/* Print Branding */}
                <div className="print-header hidden print:flex items-center justify-between border-b-2 border-indigo-600 pb-4 mb-8">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">M</div>
                    <div>
                      <h1 className="text-xl font-black text-indigo-900 leading-tight">MissionGrid</h1>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Premium Study Material</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generated by</p>
                    <p className="text-xs font-black text-slate-700">{userProfile?.name || 'Academic Mentor'}</p>
                  </div>
                </div>

                <div className="print-watermark hidden print:flex fixed inset-0 items-center justify-center pointer-events-none z-0 opacity-[0.03] rotate-[-45deg] select-none">
                  <span className="text-[120px] font-black tracking-tighter uppercase text-slate-900 whitespace-nowrap">MissionGrid</span>
                </div>

                <div className="relative z-10">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        if (!inline && match && match[1] === 'mermaid') {
                          return <Mermaid chart={String(children).replace(/\n$/, '')} />;
                        }
                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="p-4 border-t flex gap-2">
                <button onClick={() => window.print()} className="flex-1 bg-slate-100 py-2 rounded-xl flex items-center justify-center gap-2 font-bold"><Printer size={16}/> Print</button>
                <button onClick={handleDownload} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl flex items-center justify-center gap-2 font-bold"><Download size={16}/> Download PDF</button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
