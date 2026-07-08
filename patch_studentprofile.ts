import fs from 'fs';

let content = fs.readFileSync('src/screens/profile/StudentProfile.tsx', 'utf8');

const target = `        <button
          onClick={() => window.dispatchEvent(new Event('open-pwa-install'))}
          className="mt-4 w-full py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs transition-all hover:bg-indigo-700 active:scale-95 flex items-center justify-center gap-2"
        >
          <Download size={14} />
          INSTALL APP
        </button>`;

const replacement = `        <button
          onClick={() => window.dispatchEvent(new Event('open-pwa-install'))}
          className="mt-4 w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-2xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Download size={14} />
          INSTALL AS WEB APP (PWA)
        </button>

        <a
          href={\`/app-release.apk?t=\${Date.now()}\`}
          download="app-release.apk"
          className="mt-2 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-indigo-600/15"
        >
          <Download size={14} />
          DOWNLOAD NATIVE ANDROID APP
        </a>`;

content = content.replace(target, replacement);
fs.writeFileSync('src/screens/profile/StudentProfile.tsx', content);
