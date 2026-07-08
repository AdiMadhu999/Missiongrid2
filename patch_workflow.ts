import fs from 'fs';
const workflowPath = '.github/workflows/android_build.yml';
let content = fs.readFileSync(workflowPath, 'utf8');

if (!content.includes('permissions:')) {
  content = content.replace('jobs:\n  build:\n', 'permissions:\n  contents: write\n\njobs:\n  build:\n');
}

if (!content.includes('Publish to GitHub Releases')) {
  content += `      - name: Publish to GitHub Releases
        if: github.ref == 'refs/heads/main'
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release delete latest -y || true
          git push origin :refs/tags/latest || true
          
          gh release create latest \\
            android/app/build/outputs/apk/debug/app-debug.apk \\
            android/app/build/outputs/apk/release/app-release.apk \\
            --title "Latest APK Build" \\
            --notes "Automated build of the latest code on the main branch."
`;
}
fs.writeFileSync(workflowPath, content);
