
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
      <CardContent className="p-4 flex items-center space-x-4">
        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab shrink-0" aria-label="Drag to reorder task"/>
        <Checkbox
          id={`task-${task.id}`}
          checked={task.completed}
          onCheckedChange={handleCheckboxChange}
          aria-labelledby={`desc-${task.id}`}
          className="shrink-0"
        />
        <div className="flex-grow">
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
        
        <div className="flex items-center space-x-2 shrink-0">
          <Select value={task.priority} onValueChange={handlePriorityChange}>
            <SelectTrigger className="w-[110px] h-9 text-xs" aria-label={`Priority: ${PRIORITY_LABELS[task.priority]}`}>
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
            size="icon"
            onClick={() => onDelete(task.id)}
            aria-label={`Delete task: ${task.description}`}
            className="h-9 w-9 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskItem;
