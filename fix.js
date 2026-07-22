const fs = require('fs');
let code = fs.readFileSync('src/screens/test/TestResultView.tsx', 'utf-8');
const search = `                        <div className="flex items-center space-x-2 mb-4">
                           <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                             <Lightbulb className="w-4 h-4 text-indigo-600" />
                           </div>
                           <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Multimedia Solved Details</h4>
                        </div>
                                 {/* Custom Parsed Solution Details */}
                            {(q.ruleOrTheorem || q.ruleOrTheorem_bn) && (
                              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-4">
                                <div className="flex items-center text-purple-700 font-bold text-[10px] uppercase mb-2">
                                  <Shield className="w-3" /> Rule / Theorem
                                </div>
                                <div className="text-purple-900 text-xs leading-relaxed"><MathRenderer content={language === 'bn' && q.ruleOrTheorem_bn ? q.ruleOrTheorem_bn : (q.ruleOrTheorem || '')} /></div>
                              </div>
                            )}
                            {(q.examApproach || q.examApproach_bn) && (
                              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-4">
                                <div className="flex items-center text-amber-700 font-bold text-[10px] uppercase mb-2">
                                  <Zap className="w-3" /> Exam Approach / Shortcut
                                </div>
                                <div className="text-amber-900 text-xs leading-relaxed"><MathRenderer content={language === 'bn' && q.examApproach_bn ? q.examApproach_bn : (q.examApproach || '')} /></div>
                              </div>
                            )}          </div>
                            )}
`;

const replace = `                        <div className="flex items-center space-x-2 mb-4">
                           <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                             <Lightbulb className="w-4 h-4 text-indigo-600" />
                           </div>
                           <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Multimedia Solved Details</h4>
                        </div>
                        <div className="space-y-6">
                            {/* Custom Parsed Solution Details */}
                            {(q.ruleOrTheorem || q.ruleOrTheorem_bn) && (
                              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-4">
                                <div className="flex items-center text-purple-700 font-bold text-[10px] uppercase mb-2">
                                  <Shield className="w-3" /> Rule / Theorem
                                </div>
                                <div className="text-purple-900 text-xs leading-relaxed"><MathRenderer content={language === 'bn' && q.ruleOrTheorem_bn ? q.ruleOrTheorem_bn : (q.ruleOrTheorem || '')} /></div>
                              </div>
                            )}
                            {(q.examApproach || q.examApproach_bn) && (
                              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-4">
                                <div className="flex items-center text-amber-700 font-bold text-[10px] uppercase mb-2">
                                  <Zap className="w-3" /> Exam Approach / Shortcut
                                </div>
                                <div className="text-amber-900 text-xs leading-relaxed"><MathRenderer content={language === 'bn' && q.examApproach_bn ? q.examApproach_bn : (q.examApproach || '')} /></div>
                              </div>
                            )}
`;
code = code.replace(search, replace);
fs.writeFileSync('src/screens/test/TestResultView.tsx', code);
