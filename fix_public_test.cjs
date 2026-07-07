const fs = require('fs');
let content = fs.readFileSync('src/screens/test/TestCreateEdit.tsx', 'utf8');

content = content.replace(
  'if ((isPublic || visibility === "batch") && batchIds.length === 0) {',
  'if (visibility === "batch" && batchIds.length === 0) {'
);

content = content.replace(
  'batchId: (isPublic || visibility === "batch") ? primaryBatchId : undefined,',
  'batchId: visibility === "batch" ? primaryBatchId : undefined,'
);

content = content.replace(
  'batchName: (isPublic || visibility === "batch") ? selectedBatchName : undefined,',
  'batchName: visibility === "batch" ? selectedBatchName : undefined,'
);

content = content.replace(
  'batchIds: (isPublic || visibility === "batch") ? batchIds : [],',
  'batchIds: visibility === "batch" ? batchIds : [],'
);

content = content.replace(
  '{(visibility === "batch" || isPublic) && (',
  '{visibility === "batch" && ('
);

const targetText = `                    {isPublic 
                      ? "Every Public Live Test must be linked to at least one active batch."
                      : "Only students in the selected batches will be able to view and attempt this test."}`;

content = content.replace(targetText, `"Only students in the selected batches will be able to view and attempt this test."`);

const saveTarget = `      if (status === 'published') {
        const q = query(collection(db, 'users'), where('role', '==', 'student'));
        const usersSnap = await getDocs(q);
        usersSnap.forEach(user => {
            sendNotification(user.id, userProfile!.uid, 'DailyTest', finalTestId || 'new-test', 'New Daily Test Published', title);
        });
        
        if (shareToCommunity) {
            await addDoc(collection(db, 'dailyTests'), {
                type: 'DailyTest',
                testName: title,
                duration: duration,
                questionCount: questionsToPublish.length,
                shareToCommunity: true,
                authorId: userProfile!.uid,
                authorName: userProfile!.name || 'Mentor',
                createdAt: new Date().toISOString(),
                visibility: 'global',
                testId: finalTestId
            });
        }
      }`;

const saveReplacement = `      if (status === 'published') {
        const q = query(collection(db, 'users'), where('role', '==', 'student'));
        const usersSnap = await getDocs(q);
        usersSnap.forEach(user => {
            sendNotification(user.id, userProfile!.uid, 'DailyTest', finalTestId || 'new-test', 'New Daily Test Published', title);
        });
      }

      if (shareToCommunity) {
          const dtq = query(collection(db, 'dailyTests'), where('testId', '==', finalTestId));
          const dtSnap = await getDocs(dtq);
          if (dtSnap.empty) {
              await addDoc(collection(db, 'dailyTests'), {
                  type: 'DailyTest',
                  testName: title,
                  duration: duration,
                  questionCount: questionsToPublish.length,
                  shareToCommunity: true,
                  authorId: userProfile!.uid,
                  authorName: userProfile!.name || 'Mentor',
                  createdAt: new Date().toISOString(),
                  visibility: 'global',
                  testId: finalTestId
              });
          } else {
              // Update existing community post with latest details
              dtSnap.forEach(async (docSnap) => {
                  await updateDoc(doc(db, 'dailyTests', docSnap.id), {
                      testName: title,
                      duration: duration,
                      questionCount: questionsToPublish.length
                  });
              });
          }
      } else if (finalTestId) {
          const dtq = query(collection(db, 'dailyTests'), where('testId', '==', finalTestId));
          const dtSnap = await getDocs(dtq);
          dtSnap.forEach(async (docSnap) => {
              await deleteDoc(doc(db, 'dailyTests', docSnap.id));
          });
      }`;

content = content.replace(saveTarget, saveReplacement);
fs.writeFileSync('src/screens/test/TestCreateEdit.tsx', content);

// Add missing deleteDoc and updateDoc imports if necessary
let imports = fs.readFileSync('src/screens/test/TestCreateEdit.tsx', 'utf8');
if (!imports.includes('deleteDoc')) {
    imports = imports.replace('addDoc } from "firebase/firestore";', 'addDoc, deleteDoc, updateDoc } from "firebase/firestore";');
    fs.writeFileSync('src/screens/test/TestCreateEdit.tsx', imports);
}

console.log("Success");
