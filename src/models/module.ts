export type ModuleStatus = 'active' | 'inactive' | 'maintenance' | 'hidden' | 'testing' | 'archived';

export interface ModuleConfig {
  id: string;
  name: string;
  status: ModuleStatus;
  updatedAt: string;
  updatedBy: string;
  maintenanceMessage?: string;
}
