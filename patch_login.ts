import fs from 'fs';

let content = fs.readFileSync('src/screens/Login.tsx', 'utf8');

const target = "{/* Dynamic decorative branding subtitle */}";
const replacement = `
        {/* APK Download Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 bg-white/95 backdrop-blur-sm rounded-3xl border border-slate-200/80 p-5 shadow-md text-center flex flex-col items-center gap-3"
        >
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
            <span>⚡</span> Download Official Android App
          </div>
          <p className="text-[10px] text-slate-500 font-bold -mt-1 leading-snug">
            Get the latest high-performance native build with ultra-fast transitions.
          </p>
          <div className="flex gap-3 w-full">
            <a
              href={\`/app-release.apk?t=\${Date.now()}\`}
              download="app-release.apk"
              className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white text-xs font-black shadow-md shadow-indigo-600/20"
            >
              <Download size={13} />
              Release APK
            </a>
            <a
              href={\`/app-debug.apk?t=\${Date.now()}\`}
              download="app-debug.apk"
              className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 transition-all text-slate-700 text-xs font-bold border border-slate-200"
            >
              <Download size={13} />
              Debug APK
            </a>
          </div>
          <div className="w-full pt-3 mt-1 border-t border-slate-100 flex flex-col items-center gap-0.5 text-[9px] font-mono text-slate-400 font-bold">
            <p>WEB VER: {APP_VERSION} • APK VER: 1.2 (3)</p>
            <p>COMMIT: {GIT_COMMIT}</p>
            <p>BUILD: {BUILD_TIMESTAMP}</p>
          </div>
        </motion.div>

        {/* Dynamic decorative branding subtitle */}
`;

content = content.replace(target, replacement);
fs.writeFileSync('src/screens/Login.tsx', content);
