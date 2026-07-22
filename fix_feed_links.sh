sed -i "s|/app/feed|/app/guide|g" src/screens/create/ActivityCreationScreen.tsx
sed -i "s|/app/feed|/app/guide|g" src/screens/create/MentorPostCreationScreen.tsx
sed -i "s|/app/feed|/app/doubt|g" src/screens/Splash.tsx
sed -i "s|/app/feed|/app/doubt|g" src/screens/CompleteProfile.tsx
sed -i "s|/app/feed|/app/doubt|g" src/screens/ProfileSetup.tsx
sed -i "s|/app/feed|/app/doubt|g" src/screens/UnifiedRegistration.tsx
sed -i "s|/app/feed|/app/doubt|g" src/screens/Login.tsx
sed -i 's|to={isMentor ? "home" : "feed"}|to={isMentor ? "home" : "doubt"}|g' src/App.tsx
