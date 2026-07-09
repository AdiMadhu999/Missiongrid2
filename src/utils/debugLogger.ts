
type LogEntry = {
  timestamp: string;
  type: 'REQUEST' | 'RESPONSE' | 'ERROR' | 'INFO';
  message: string;
  data?: any;
};

let logs: LogEntry[] = [];
const listeners: ((logs: LogEntry[]) => void)[] = [];

export const debugLogger = {
  add: (type: LogEntry['type'], message: string, data?: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      data,
    };
    logs = [...logs, entry];
    listeners.forEach((l) => l(logs));
  },
  getLogs: () => logs,
  subscribe: (listener: (logs: LogEntry[]) => void) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  },
  clear: () => {
    logs = [];
    listeners.forEach((l) => l(logs));
  }
};
