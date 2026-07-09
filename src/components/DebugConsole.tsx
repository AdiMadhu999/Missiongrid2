
import { useEffect, useState } from 'react';
import { debugLogger } from '../utils/debugLogger';

export function DebugConsole() {
  const [logs, setLogs] = useState(debugLogger.getLogs());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = debugLogger.subscribe(setLogs);
    return () => unsubscribe();
  }, []);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-black/80 text-white p-2 rounded text-xs"
      >
        Show Debug
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white p-4 overflow-auto font-mono text-[10px]">
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-bold">Debug Console</h2>
        <div className="flex gap-2">
            <button onClick={() => debugLogger.clear()} className="bg-gray-200 px-2 py-1">Clear</button>
            <button onClick={() => setIsOpen(false)} className="bg-red-500 text-white px-2 py-1">Close</button>
        </div>
      </div>
      {logs.map((log, i) => (
        <div key={i} className={`mb-1 p-1 ${log.type === 'ERROR' ? 'bg-red-100' : 'bg-gray-100'}`}>
          [{log.timestamp}] <span className="font-bold">{log.type}</span>: {log.message}
          {log.data && <pre className="mt-1 overflow-x-auto">{JSON.stringify(log.data, null, 2)}</pre>}
        </div>
      ))}
    </div>
  );
}
