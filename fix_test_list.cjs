const fs = require('fs');
let content = fs.readFileSync('src/screens/test/MentorTestList.tsx', 'utf8');

const handlers = `  const handleShareToStudents = async (test: Test) => {
    let link = '';
    if (test.shareableId) {
       link = \`\${window.location.origin}/live/\${test.shareableId}\`;
    } else {
       link = \`\${window.location.origin}/test/\${test.id}\`;
    }
    
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Student test link copied to clipboard!");
    } catch (e) {
      toast.error("Failed to copy link");
    }
  };

  const handleShareToCommunity = async (test: Test) => {
    try {
      setLoading(true);
      await addDoc(collection(db, 'dailyTests'), {
          type: 'DailyTest',
          testName: test.title,
          duration: test.duration,
          questionCount: test.questions?.length || test.totalQuestions || 0,
          shareToCommunity: true,
          authorId: userProfile?.uid || 'mentor',
          authorName: userProfile?.name || 'Mentor',
          createdAt: new Date().toISOString(),
          visibility: 'global',
          testId: test.id
      });
      toast.success("Test shared to community successfully!");
    } catch (e) {
      toast.error("Failed to share to community");
    } finally {
      setLoading(false);
      loadData();
    }
  };

  const handleMigrateScoring = async () => {`;

content = content.replace('  const handleMigrateScoring = async () => {', handlers);

const imports2 = `import {
  FileText,
  Clock,
  Users,
  Edit2,
  Copy,
  Trash2,
  Share2,
  Globe,
  Share,
`;
content = content.replace(`import {
  FileText,
  Clock,
  Users,
  Edit2,
  Copy,
  Trash2,`, imports2);

fs.writeFileSync('src/screens/test/MentorTestList.tsx', content);
