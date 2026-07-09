const fs = require('fs');
let content = fs.readFileSync('src/screens/test/TestCreateEdit.tsx', 'utf8');

content = content.replace(
  'alert("Share link copied to clipboard!");',
  'alert(testId ? "Share link copied to clipboard!" : "Share link copied! Please SAVE the test to activate it.");'
);

content = content.replace(
  '</button>\n                        </div>\n                      </div>\n                    )}',
  '</button>\n                        </div>\n                        <p className="text-[9px] text-amber-600 font-bold mt-1.5 px-1">\n                          ⚠️ Click Save at the top to activate this link.\n                        </p>\n                      </div>\n                    )}'
);

fs.writeFileSync('src/screens/test/TestCreateEdit.tsx', content);
