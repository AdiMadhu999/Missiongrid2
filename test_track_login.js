const { readFileSync, writeFileSync } = require('fs');
let code = readFileSync('server.ts', 'utf8');

code = code.replace(
  'await restSetDoc("users_private", userId, {',
  'console.log("Setting users_private"); await restSetDoc("users_private", userId, {'
);

code = code.replace(
  'await restSetDoc("users", userId, {',
  'console.log("Setting users"); await restSetDoc("users", userId, {'
);

code = code.replace(
  'await restAddDoc("login_history", {',
  'console.log("Adding login_history"); await restAddDoc("login_history", {'
);

writeFileSync('server.ts', code);
