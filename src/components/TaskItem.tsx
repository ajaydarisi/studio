
"use client";

import React, { type FC, type DragEvent } from 'react';
import type { Task } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2, GripVertical, Clock3, CalendarDays, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, startOfDay, startOfToday, addDays, isSameDay } from "date-fns";

interface TaskItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>, taskId: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, taskId: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, taskId: string) => void;
  isDragging: boolean;
}

const TaskItem: FC<TaskItemProps> = React.memo(({
  task,
  onToggleComplete,
  onDelete,
  onEdit,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging
}) => {
  const handleCheckboxChange = React.useCallback(() => {
    onToggleComplete(task.id);
  }, [onToggleComplete, task.id]);

  const priorityBorderColorClass = React.useCallback(() => {
    const today = startOfToday();
    const dueDate = task.dueDate instanceof Date ? startOfDay(task.dueDate) : startOfDay(new Date(task.dueDate));

    if (isPast(dueDate) && !isSameDay(dueDate, today)) return 'border-l-[hsl(var(--border-priority-high))]';
    if (isSameDay(dueDate, today)) return 'border-l-[hsl(var(--border-priority-high))]';

    const tomorrow = addDays(today, 1);
    const dayAfterTomorrow = addDays(today, 2);

    if (isSameDay(dueDate, tomorrow) || isSameDay(dueDate, dayAfterTomorrow)) {
      return 'border-l-[hsl(var(--border-priority-medium))]';
    }
    return 'border-l-[hsl(var(--border-priority-low))]';
  }, [task.dueDate]);

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
        "border-l-4",
        priorityBorderColorClass()
      )}
    >
      <CardContent className="p-4 flex items-start space-x-3">
        <GripVertical
          className="h-5 w-5 text-muted-foreground cursor-grab shrink-0 mt-1"
          aria-label="Drag to reorder task"
        />
        <Checkbox
          id={`task-${task.id}`}
          checked={task.completed}
          onCheckedChange={handleCheckboxChange}
          aria-labelledby={`desc-${task.id}`}
          className="shrink-0 mt-[5px]"
        />

        <div className="flex-grow flex flex-col sm:flex-row sm:items-center sm:justify-between min-w-0">

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
                <div className="flex flex-col sm:flex-row sm:items-center">
                    <div className="text-xs text-muted-foreground flex items-center mt-1">
                        <Clock3 className="h-3 w-3 mr-1" />
                        {task.estimatedCompletionTime} min
                    </div>
                    {task.dueDate && (
                      <div className="text-xs text-muted-foreground flex items-center mt-1 sm:mt-1 sm:ml-3">
                        <CalendarDays className="h-3 w-3 mr-1 text-primary" />
                        Due: {format(task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate), "MMM d, yyyy")}
                      </div>
                    )}
                </div>
            </div>

            {/* Action buttons container - always flex-row */}
            <div className="mt-3 sm:mt-0 flex flex-row items-center space-x-2 shrink-0">
                <Button
                    variant="ghost"
                    onClick={() => onEdit(task)}
                    aria-label={`Edit task: ${task.description}`}
                    className={cn(
                        "text-muted-foreground hover:text-primary",
                        "flex items-center",
                        "w-9 h-9 p-0 justify-center" // Icon button style for all sizes
                    )}
                >
                    <Pencil className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Edit Task</span> {/* Visually hidden, for accessibility */}
                </Button>

                <Button
                    variant="ghost"
                    onClick={() => onDelete(task.id)}
                    aria-label={`Delete task: ${task.description}`}
                    className={cn(
                        "text-muted-foreground hover:text-destructive",
                        "flex items-center",
                        "w-9 h-9 p-0 justify-center"  // Icon button style for all sizes
                    )}
                >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span className="sr-only">Delete Task</span> {/* Visually hidden, for accessibility */}
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
});
TaskItem.displayName = 'TaskItem';
export default TaskItem;
