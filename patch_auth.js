const fs = require('fs');
let code = fs.readFileSync('src/services/auth.ts', 'utf8');
code = code.replace(
  `        if (auth.currentUser) {
            await auth.currentUser.getIdToken(true);
        }
        await new Promise(resolve => setTimeout(resolve, 500));`,
  `        // Wait for the auth state to propagate to Firestore
        await new Promise<void>((resolve) => {
            const unsubscribe = auth.onIdTokenChanged(async (user) => {
                if (user && user.uid === uid) {
                    unsubscribe();
                    await user.getIdToken(true);
                    setTimeout(resolve, 1000); // Give Firestore client time to reconnect
                }
            });
            // Fallback timeout in case it already fired synchronously
            setTimeout(() => {
                unsubscribe();
                resolve();
            }, 3000);
        });`
);
fs.writeFileSync('src/services/auth.ts', code);
console.log("Patched auth.ts");
