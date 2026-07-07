const fs = require('fs');
const path = require('path');

const filepath = './src/screens/test/AITestCreator.tsx';
let content = fs.readFileSync(filepath, 'utf8');

// Let's find the Grid of Large Touch Upload Actions block
const startGridIndex = content.indexOf('{/* Grid of Large Touch Upload Actions */}');
if (startGridIndex === -1) {
    console.error("Grid block not found!");
    process.exit(1);
}

// Find the end of this block by matching the </div> closing tag of the grid container.
// It starts with: <div className="grid grid-cols-2 gap-3">
// And has buttons. Let's find the exact end of the grid container by searching for index of Premium AI Instruction Workspace
const startWorkspaceIndex = content.indexOf('{/* PREMIUM AI INSTRUCTION WORKSPACE */}');
if (startWorkspaceIndex === -1) {
    console.error("Premium AI Instruction Workspace block not found!");
    process.exit(1);
}

// Extract grid block
const gridBlock = content.substring(startGridIndex, startWorkspaceIndex);

// Now find where PREMIUM AI INSTRUCTION WORKSPACE block ends. Reference: `{/* BUDGET GUARDIAN` is right after
const startBudgetIndex = content.indexOf('{/* BUDGET GUARDIAN');
if (startBudgetIndex === -1) {
    console.error("Budget block not found!");
    process.exit(1);
}

const workspaceBlock = content.substring(startWorkspaceIndex, startBudgetIndex);

// Let's create the newly rearranged block:
// 1. workspaceBlock
// 2. gridBlock
// 3. Saved Draft Progress Recovery Banner (which we previously removed and want to place under the grid)
const recoveryBannerBlock = `               {/* Saved Draft Progress Recovery Banner */}
               {savedProgress && (
                  <div className="bg-slate-905 border-2 border-indigo-500/30 p-4 rounded-3xl text-left space-y-3 shadow-xl relative overflow-hidden bg-slate-900">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-950/50 border border-indigo-800 flex items-center justify-center shrink-0 text-indigo-400">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xs font-black text-white uppercase tracking-wider">Unsaved Test Ingestion Detected</h3>
                        <p className="text-[10px] text-slate-400 leading-normal">
                          You have an active generation process on hold. We saved your progress up to <strong>{savedProgress.percent}% ({savedProgress.questions?.length || 0} questions parsed)</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1.5">
                      <button 
                        onClick={resumeAiAnalysis}
                        className="py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:from-indigo-500 active:scale-95 transition"
                      >
                        Resume Draft
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm("Discard saved draft and start fresh? This cannot be undone.")) {
                            localStorage.removeItem("ai_test_workspace_progress");
                            setSavedProgress(null);
                          }
                        }}
                        className="py-2.5 px-4 bg-slate-950 text-slate-400 border border-slate-800 rounded-xl text-[10px] font-bold uppercase transition hover:text-red-400 hover:bg-red-950/20"
                      >
                        Discard Draft
                      </button>
                    </div>
                  </div>
               )}\n\n`;

const rearrangedBlock = workspaceBlock + "\n" + gridBlock + "\n" + recoveryBannerBlock;

// Replace from startGridIndex to startBudgetIndex with rearrangedBlock
content = content.substring(0, startGridIndex) + rearrangedBlock + content.substring(startBudgetIndex);

fs.writeFileSync(filepath, content, 'utf8');
console.log("Rearrangement applied successfully!");
