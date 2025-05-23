
"use client";

import type { FC, DragEvent } from 'react';
import type { Task, TaskPriority } from "@/types";
import { PRIORITIES, PRIORITY_LABELS } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, GripVertical, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, priority: TaskPriority) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, taskId: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, taskId: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, taskId: string) => void;
  isDragging: boolean;
}

const TaskItem: FC<TaskItemProps> = ({
  task,
  onToggleComplete,
  onDelete,
  onPriorityChange,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging
}) => {
  const handleCheckboxChange = () => {
    onToggleComplete(task.id);
  };

  const handlePriorityChange = (value: string) => {
    onPriorityChange(task.id, value as TaskPriority);
  };

  const priorityColorClass = () => {
    switch (task.priority) {
      case 'high': return 'border-red-500';
      case 'medium': return 'border-yellow-500';
      case 'low': return 'border-green-500';
      default: return 'border-border';
    }
  };

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, task.id); }}
      onDrop={(e) => onDrop(e, task.id)}
      className={cn(
        "mb-3 p-0 transition-shadow duration-150 ease-in-out hover:shadow-md",
        task.completed ? "bg-secondary opacity-70" : "bg-card",
        isDragging ? "opacity-50 ring-2 ring-primary" : "",
        priorityColorClass() + " border-l-4"
      )}
    >
      <CardContent className="p-4 flex items-start space-x-3">
        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab shrink-0 mt-1" aria-label="Drag to reorder task"/>
        <Checkbox
          id={`task-${task.id}`}
          checked={task.completed}
          onCheckedChange={handleCheckboxChange}
          aria-labelledby={`desc-${task.id}`}
          className="shrink-0 mt-[5px]"
        />
        
        {/* Main content area: stacks on mobile, rows on sm+ */}
        <div className="flex-grow flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0">
            
            {/* Description and Time block (Top on mobile, Left on sm+) */}
            <div className="flex-grow min-w-0 sm:mr-4">
                <label
                    htmlFor={`task-${task.id}`}
                    id={`desc-${task.id}`}
                    className={cn(
                    "font-medium text-foreground break-words",
                    task.completed && "line-through text-muted-foreground"
                    )}
                >
                    {task.description}
                </label>
                <div className="text-xs text-muted-foreground flex items-center mt-1">
                    <Clock3 className="h-3 w-3 mr-1" />
                    {task.estimatedCompletionTime} min
                </div>
            </div>

            {/* Controls block (Priority & Delete) (Bottom on mobile, Right on sm+) */}
            <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 sm:shrink-0 w-full sm:w-auto">
                <Select value={task.priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger 
                        className="w-full sm:w-[120px] h-9 text-xs" 
                        aria-label={`Priority: ${PRIORITY_LABELS[task.priority]}`}
                    >
                    <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                    {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">
                        {PRIORITY_LABELS[p]}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                
                <Button
                    variant="ghost"
                    onClick={() => onDelete(task.id)}
                    aria-label={`Delete task: ${task.description}`}
                    className={cn(
                        "text-muted-foreground hover:text-destructive flex items-center", // Base styles
                        "w-full justify-start px-3 py-2 h-auto text-sm", // Mobile: looks like a normal button item
                        "sm:w-9 sm:h-9 sm:p-0 sm:justify-center" // Desktop: icon button style
                    )}
                >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span className="ml-2 sm:hidden">Delete Task</span> {/* Text only visible on mobile */}
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskItem;
