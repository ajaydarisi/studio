
export interface Task {
  id: string; // UUID from Supabase
  userId: string; // Foreign key to auth.users.id
  description: string;
  estimatedCompletionTime: number; // in minutes
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  createdAt: number; // Unix timestamp in milliseconds (converted from ISO string)
  orderIndex: number;
}

export type TaskPriority = Task['priority'];

export const PRIORITIES: ReadonlyArray<TaskPriority> = ['high', 'medium', 'low'];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};
