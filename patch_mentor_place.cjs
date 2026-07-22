const fs = require('fs');
let code = fs.readFileSync('src/screens/mentor/MentorPlace.tsx', 'utf8');

// Add import
const importStr = "import StudentCheckWorkspace from './StudentCheckWorkspace';";
code = code.replace(
  /import { PremiumManagementDashboard } from '\.\/PremiumManagementDashboard';/g,
  "import { PremiumManagementDashboard } from './PremiumManagementDashboard';\n" + importStr
);

// Update state type
code = code.replace(
  /const \[view, setView\] = useState<'list' | 'review'>\(initialView\);/g,
  "const [view, setView] = useState<'list' | 'review' | 'check'>(initialView as any);"
);

// Add view block
const reviewBlock = "if (view === 'review') {\n    return <MissionReviewWorkspace batchId={userProfile?.batchId || 'all'} onBack={() => { setView('list'); loadUsers(); }} />;\n  }";

const checkBlock = `
  if (view === 'check') {
    return <StudentCheckWorkspace onBack={() => { setView('list'); loadUsers(); }} />;
  }
`;

code = code.replace(reviewBlock, reviewBlock + '\n' + checkBlock);

// Add button
const reviewButton = `
            <button 
              onClick={() => setView('review')}
              className="flex-1 sm:flex-initial px-3 sm:px-4 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-600 text-white flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-emerald-100 hover:scale-105 transition-all text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
            >
              <CheckCircle2 size={16} />
              Review Missions
            </button>
`;
const checkButton = `
            <button 
              onClick={() => setView('check')}
              className="flex-1 sm:flex-initial px-3 sm:px-4 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-600 text-white flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-indigo-100 hover:scale-105 transition-all text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
            >
              <UserCheck size={16} />
              Check
            </button>
`;

code = code.replace(
  /<CheckCircle2 size={16} \/>\s*Review Missions\s*<\/button>/g,
  "<CheckCircle2 size={16} />\n              Review Missions\n            </button>\n" + checkButton
);

fs.writeFileSync('src/screens/mentor/MentorPlace.tsx', code);
console.log("Patched MentorPlace.tsx");
