
export interface Task {
  id: string;
  description: string;
  estimatedCompletionTime: number; // in minutes
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  createdAt: number; // timestamp for sorting
}

export type TaskPriority = Task['priority'];

export const PRIORITIES: ReadonlyArray<TaskPriority> = ['high', 'medium', 'low'];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};
