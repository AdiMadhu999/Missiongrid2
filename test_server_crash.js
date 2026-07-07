import { spawn } from 'child_process';
import fetch from "node-fetch";

const srv = spawn('npx', ['tsx', 'server.ts'], { stdio: 'inherit' });

setTimeout(async () => {
    try {
        const res = await fetch('http://localhost:3000/api/ai/budget-status');
        console.log('Got response:', res.status);
    } catch(e) {
        console.error('Fetch error:', e.message);
    }
    srv.kill();
}, 2000);
