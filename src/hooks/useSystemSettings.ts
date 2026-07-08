import { useCachedQuery } from '../hooks/useCachedQuery';
import { getSystemSettings, subscribeToSystemSettings } from '../services/system';
import { SystemSettings } from '../models/system';

export function useSystemSettings() {
  return useCachedQuery<SystemSettings>({
    queryKey: ['systemSettings'],
    queryFn: getSystemSettings,
    persistKey: 'system_settings_cache',
    subscribeFn: subscribeToSystemSettings,
  });
}
