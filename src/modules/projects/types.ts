export type ProjectStatus = 'active' | 'on-hold' | 'completed' | 'cancelled';

export interface ProjectMember {
  empId: string;
  name: string;
  role: string;
  estimatedHours: number;
  loggedHours: number;
  hourlyRate: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  client: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  estimatedHours: number;
  estimatedCost: number;
  actualCost: number;
  members: Record<string, ProjectMember>;
  createdAt: string;
}
