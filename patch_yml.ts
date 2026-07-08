import fs from 'fs';

let content = fs.readFileSync('.github/workflows/firebase-hosting-merge.yml', 'utf8');

const target = "      - name: Build Web Application\n        run: npm run build";
const replacement = `      - name: Build Web Application
        run: npm run build

      - name: Sync Capacitor Android
        run: npx cap sync android

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          
      - name: Generate Release Keystore
        run: |
          rm -f android/app/release.keystore
          keytool -genkey -v -keystore android/app/release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000 -storepass password -keypass password -dname "CN=MissionGrid, OU=Dev, O=Mission, L=City, ST=State, C=US"
          
      - name: Set executable permissions for Gradle Wrapper
        run: chmod +x gradlew
        working-directory: android

      - name: Clean and Build Android APKs
        run: |
          ./gradlew clean
          ./gradlew assembleDebug
          ./gradlew assembleRelease
        working-directory: android
        env:
          RELEASE_STORE_FILE: "release.keystore"
          RELEASE_STORE_PASSWORD: "password"
          RELEASE_KEY_ALIAS: "release"
          RELEASE_KEY_PASSWORD: "password"

      - name: Copy Compiled APKs to Web Dist Directory
        run: |
          cp android/app/build/outputs/apk/debug/app-debug.apk dist/app-debug.apk
          cp android/app/build/outputs/apk/release/app-release.apk dist/app-release.apk
`;

content = content.replace(target, replacement);

const target2 = `          projectId: mission-selection-ultimate`;
const replacement2 = `          projectId: mission-selection-ultimate

      - name: Upload Debug APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-debug
          path: android/app/build/outputs/apk/debug/app-debug.apk

      - name: Upload Release APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-release
          path: android/app/build/outputs/apk/release/app-release.apk`;

content = content.replace(target2, replacement2);

fs.writeFileSync('.github/workflows/firebase-hosting-merge.yml', content);
