import React, { useState } from 'react';
import { ChevronLeft, Save, Plus, Trash2, CheckCircle, HelpCircle, Star, Sparkles, Link, Video, FileText, Image } from 'lucide-react';
import { Question, QuestionType, Difficulty, QuestionStatus } from '../../models/question';
import { addQuestion, updateQuestion } from '../../services/question';
import { auth } from '../../services/firebase';
import { toast } from 'react-hot-toast';

export default function QuestionCreateEdit({ 
  question, 
  onClose, 
  onSaved 
}: { 
  question?: Question | null; 
  onClose: () => void; 
  onSaved: () => void; 
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Question>>(() => {
    if (question) {
      return {
        ...question,
        tags: question.tags || [],
        options: question.options || [],
        subtopic: question.subtopic || '',
        youtubeLink: question.youtubeLink || '',
        pdfLink: question.pdfLink || '',
        driveLink: question.driveLink || '',
        websiteLink: question.websiteLink || '',
        imageUrl: question.imageUrl || '',
        solutionImageUrl: question.solutionImageUrl || '',
      };
    }
    return {
      text: '',
      type: 'single_mcq',
      subject: '',
      chapter: '',
      topic: '',
      subtopic: '',
      difficulty: 'medium',
      marks: 2,
      status: 'draft',
      tags: [],
      options: [
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }
      ],
      correctAnswer: '',
      explanation: '',
      exam: '',
      language: 'English',
      source: '',
      youtubeLink: '',
      pdfLink: '',
      driveLink: '',
      websiteLink: '',
      imageUrl: '',
      solutionImageUrl: '',
      createdBy: auth.currentUser?.email || auth.currentUser?.uid || 'System Mentor',
      createdAt: new Date().toISOString()
    };
  });

  const [tagInput, setTagInput] = useState((question?.tags || []).join(', '));

  const handleTypeChange = (newType: QuestionType) => {
    let defaultOptions = formData.options || [];
    if (newType === 'true_false') {
      defaultOptions = [
        { text: 'True', isCorrect: false },
        { text: 'False', isCorrect: false }
      ];
    } else if (defaultOptions.length === 0) {
      defaultOptions = [
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }
      ];
    }
    setFormData({
      ...formData,
      type: newType,
      options: defaultOptions
    });
  };

  const handleOptionTextChange = (index: number, val: string) => {
    const updatedOptions = [...(formData.options || [])];
    if (updatedOptions[index]) {
      updatedOptions[index] = { ...updatedOptions[index], text: val };
    }
    setFormData({ ...formData, options: updatedOptions });
  };

  const handleOptionCorrectChange = (index: number, isChecked: boolean) => {
    const updatedOptions = [...(formData.options || [])];
    
    // For single MCQ, only one can be correct
    if (formData.type === 'single_mcq' || formData.type === 'true_false') {
      updatedOptions.forEach((opt, idx) => {
        updatedOptions[idx] = { ...opt, isCorrect: idx === index };
      });
      setFormData({ 
        ...formData, 
        options: updatedOptions,
        correctAnswer: String(index) 
      });
    } else {
      // Multiple MCQ (MSQ) allows multiple correct answers
      updatedOptions[index] = { ...updatedOptions[index], isCorrect: isChecked };
      const correctIndices = updatedOptions
        .map((opt, idx) => opt.isCorrect ? String(idx) : null)
        .filter(Boolean);
      setFormData({ 
        ...formData, 
        options: updatedOptions,
        correctAnswer: correctIndices.join(',') 
      });
    }
  };

  const handleAddOption = () => {
    const updatedOptions = [...(formData.options || []), { text: '', isCorrect: false }];
    setFormData({ ...formData, options: updatedOptions });
  };

  const handleRemoveOption = (index: number) => {
    const updatedOptions = [...(formData.options || [])];
    updatedOptions.splice(index, 1);
    setFormData({ ...formData, options: updatedOptions });
  };

  const handleSubmit = async () => {
    if (!formData.text?.trim()) {
      toast.error("Question text is required");
      return;
    }
    if (!formData.subject?.trim()) {
      toast.error("Subject classification is required");
      return;
    }

    // Process tags
    const processedTags = tagInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    setLoading(true);
    try {
      const payload = {
        ...formData,
        tags: processedTags,
        updatedAt: new Date().toISOString()
      };

      if (question) {
        await updateQuestion(question.id, payload);
        toast.success("Question updated inside library");
      } else {
        await addQuestion(payload as Omit<Question, 'id'>);
        toast.success("Added new question to library");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save library question");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-4 pb-24 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onClose} 
          className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft size={18} className="text-slate-600"/>
        </button>
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            {question ? 'Modify Question Library Entry' : 'Create Library Question'}
          </h1>
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">MissionGrid Central Storage</p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5 max-w-3xl">
        
        {/* Row 1: Type, Subject, Language */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Question Type</label>
            <select 
              value={formData.type} 
              onChange={e => handleTypeChange(e.target.value as QuestionType)}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            >
              <option value="single_mcq">Single Correct MCQ</option>
              <option value="multiple_mcq">Multiple Correct MCQ / MSQ</option>
              <option value="true_false">True/False</option>
              <option value="assertion_reason">Assertion & Reason</option>
              <option value="match_following">Match the Following</option>
              <option value="numerical">Numerical / Integer</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Subject</label>
            <input 
              type="text" 
              placeholder="e.g. Mathematics, History" 
              value={formData.subject} 
              onChange={e => setFormData({...formData, subject: e.target.value})}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Language</label>
            <input 
              type="text" 
              placeholder="English, Hindi, Bengali" 
              value={formData.language || ''} 
              onChange={e => setFormData({...formData, language: e.target.value})}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Row 2: Chapter, Topic, Subtopic, Target Exam */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Chapter</label>
            <input 
              type="text" 
              placeholder="e.g. Percentages, Algebra" 
              value={formData.chapter || ''} 
              onChange={e => setFormData({...formData, chapter: e.target.value})}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Topic</label>
            <input 
              type="text" 
              placeholder="e.g. Ratios, Simplification" 
              value={formData.topic || ''} 
              onChange={e => setFormData({...formData, topic: e.target.value})}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Subtopic</label>
            <input 
              type="text" 
              placeholder="e.g. Ratio of 3 numbers" 
              value={formData.subtopic || ''} 
              onChange={e => setFormData({...formData, subtopic: e.target.value})}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Target Exam</label>
            <input 
              type="text" 
              placeholder="e.g. SSC CGL, Railway NTPC" 
              value={formData.exam || formData.examCategory || ''} 
              onChange={e => setFormData({...formData, exam: e.target.value, examCategory: e.target.value})}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Row 3: Difficulty, Marks, Status, Source */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Difficulty</label>
            <select 
              value={formData.difficulty} 
              onChange={e => setFormData({...formData, difficulty: e.target.value as Difficulty})}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Marks Allocated</label>
            <input 
              type="number" 
              placeholder="2" 
              value={formData.marks || 2} 
              onChange={e => setFormData({...formData, marks: Number(e.target.value)})}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
            <select 
              value={formData.status} 
              onChange={e => setFormData({...formData, status: e.target.value as QuestionStatus})}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            >
              <option value="draft">Draft</option>
              <option value="verified">Verified</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Source / Origin</label>
            <input 
              type="text" 
              placeholder="e.g. PYQ 2024 Shift 2" 
              value={formData.source || ''} 
              onChange={e => setFormData({...formData, source: e.target.value})}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Text Input (Supports LaTeX) */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Question Core Text (Supports LaTeX math equations using $)</span>
            <span className="text-[9px] font-bold text-indigo-600 tracking-normal capitalize flex items-center gap-0.5">
              <Sparkles size={10} />
              {"e.g. \"Calculate $\\sqrt{x^2 + y^2}$\""}
            </span>
          </label>
          <textarea 
            rows={4}
            placeholder="Type your question body here..." 
            value={formData.text} 
            onChange={e => setFormData({...formData, text: e.target.value})}
            className="w-full p-3 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-500 leading-relaxed"
          />
        </div>

        {/* Options Builder (Conditional on MCQ/MSQ/True-False) */}
        {(formData.type === 'single_mcq' || formData.type === 'multiple_mcq' || formData.type === 'true_false') && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Answer Options & Correct Key</h3>
              {formData.type !== 'true_false' && (
                <button 
                  type="button" 
                  onClick={handleAddOption}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-wider flex items-center gap-1"
                >
                  <Plus size={12} />
                  <span>Add Option</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {(formData.options || []).map((opt, oIdx) => {
                const isSelected = opt.isCorrect;
                return (
                  <div key={oIdx} className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => handleOptionCorrectChange(oIdx, !isSelected)}
                      className={`p-2 rounded-xl border flex items-center gap-1 text-[10px] font-black uppercase transition-colors shrink-0 ${isSelected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                    >
                      <CheckCircle size={14} className={isSelected ? 'text-emerald-600' : 'text-slate-300'} />
                      <span>{isSelected ? 'Correct Key' : 'Incorrect'}</span>
                    </button>

                    <input 
                      type="text" 
                      placeholder={`Option ${String.fromCharCode(65 + oIdx)} text...`}
                      value={opt.text}
                      disabled={formData.type === 'true_false'}
                      onChange={e => handleOptionTextChange(oIdx, e.target.value)}
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    />

                    {formData.type !== 'true_false' && (formData.options || []).length > 2 && (
                      <button 
                        type="button"
                        onClick={() => handleRemoveOption(oIdx)}
                        className="p-2 text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 rounded-xl transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Integer/Numerical Correct Answer String */}
        {(formData.type === 'numerical' || formData.type === 'assertion_reason' || formData.type === 'match_following') && (
          <div className="pt-3 border-t border-slate-100">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Direct Correct Answer string / key</label>
            <input 
              type="text" 
              placeholder={formData.type === 'numerical' ? 'e.g. 42' : 'e.g. A-1, B-2, C-3'}
              value={formData.correctAnswer || ''}
              onChange={e => setFormData({ ...formData, correctAnswer: e.target.value, correctAnswers: [e.target.value] })}
              className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {/* Stepwise Explanation / Solution */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Detailed explanation & Stepwise Solution</label>
          <textarea 
            rows={4}
            placeholder="Type your stepwise solution here so students understand the concept completely..." 
            value={formData.explanation || ''} 
            onChange={e => setFormData({...formData, explanation: e.target.value})}
            className="w-full p-3 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-500 leading-relaxed"
          />
        </div>

        {/* Rich Media & Dynamic Learning Resources Section */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Link size={14} className="text-indigo-600" />
            <span>Rich Media & Dynamic Learning Resources</span>
          </h3>
          <p className="text-[10px] text-slate-400 -mt-2">Provide optional visual diagrams, videos, or study sheets to assist students</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Images */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Image size={12} className="text-indigo-500" />
                <span>Question Image URL</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g. https://domain.com/diagram.png" 
                value={formData.imageUrl || ''} 
                onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Image size={12} className="text-indigo-500" />
                <span>Solution Image URL</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g. https://domain.com/solution-step.png" 
                value={formData.solutionImageUrl || ''} 
                onChange={e => setFormData({...formData, solutionImageUrl: e.target.value})}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Links */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Video size={12} className="text-rose-500" />
                <span>YouTube Link (Video Explanation)</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g. https://youtube.com/watch?v=..." 
                value={formData.youtubeLink || ''} 
                onChange={e => setFormData({...formData, youtubeLink: e.target.value})}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <FileText size={12} className="text-amber-500" />
                <span>PDF Link (Reference Material)</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g. https://domain.com/lesson-note.pdf" 
                value={formData.pdfLink || ''} 
                onChange={e => setFormData({...formData, pdfLink: e.target.value})}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Link size={12} className="text-blue-500" />
                <span>Google Drive Link</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g. https://drive.google.com/file/d/..." 
                value={formData.driveLink || ''} 
                onChange={e => setFormData({...formData, driveLink: e.target.value})}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Link size={12} className="text-emerald-500" />
                <span>Website Reference Link</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g. https://wikipedia.org/wiki/..." 
                value={formData.websiteLink || ''} 
                onChange={e => setFormData({...formData, websiteLink: e.target.value})}
                className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Search Tags (Comma-separated)</label>
          <input 
            type="text" 
            placeholder="geometry, pyq, ratio, ssc-cgl" 
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Submit */}
        <button 
          onClick={handleSubmit} 
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50"
        >
          <Save size={16} /> 
          <span>{loading ? 'STORING QUESTION...' : 'COMMIT QUESTION TO QUESTION LIBRARY'}</span>
        </button>
      </div>
    </div>
  );
}
