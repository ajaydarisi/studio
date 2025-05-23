
export interface Task {
  id: string; // UUID from Supabase
  userId: string; // Foreign key to auth.users.id
  description: string;
  estimatedCompletionTime: number; // in minutes
  priority: 'high' | 'medium' | 'low'; // Still used internally by AI and cron
  completed: boolean;
  createdAt: number; // Unix timestamp in milliseconds (converted from ISO string)
  orderIndex: number;
  dueDate: Date; // Due date is now mandatory
}

export type TaskPriority = Task['priority']; // Still needed for AI and potential backend logic

// PRIORITIES array and PRIORITY_LABELS object removed as they were for the UI dropdown.
