
"use client";

import React, { type FC, type DragEvent } from 'react';
import type { Task } from "@/types"; // TaskPriority removed as it's not used for UI selection here
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
// Select related imports removed
import { Trash2, GripVertical, Clock3, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, startOfDay, startOfToday, addDays, isSameDay } from "date-fns";

interface TaskItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  // onPriorityChange prop removed
  onDragStart: (event: DragEvent<HTMLDivElement>, taskId: string) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, taskId: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, taskId: string) => void;
  isDragging: boolean;
}

const TaskItem: FC<TaskItemProps> = ({
  task,
  onToggleComplete,
  onDelete,
  // onPriorityChange removed
  onDragStart,
  onDragOver,
  onDrop,
  isDragging
}) => {
  const handleCheckboxChange = () => {
    onToggleComplete(task.id);
  };

  // handlePriorityValueChange removed

  const priorityBorderColorClass = () => {
    const today = startOfToday();
    // Ensure dueDate is treated as a Date object for comparison
    const dueDate = task.dueDate ? startOfDay(new Date(task.dueDate)) : null;


    if (!dueDate) return 'border-l-border'; // Default if no due date (should not happen if required)

    // Check if the date is in the past (but not today)
    if (isPast(dueDate) && !isToday(dueDate)) return 'border-l-[hsl(var(--border-priority-high))]';
    // Check if the date is today
    if (isToday(dueDate)) return 'border-l-[hsl(var(--border-priority-high))]';

    const tomorrow = addDays(today, 1);
    const dayAfterTomorrow = addDays(today, 2);

    // Check if the date is tomorrow or the day after tomorrow
    if (isSameDay(dueDate, tomorrow) || isSameDay(dueDate, dayAfterTomorrow)) {
      return 'border-l-[hsl(var(--border-priority-medium))]';
    }

    // If it's none of the above, it's further in the future
    return 'border-l-[hsl(var(--border-priority-low))]';
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
        "border-l-4", // Base border width
        priorityBorderColorClass() // Dynamic border color based on due date
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
                    {task.dueDate && ( // dueDate is now mandatory, so this check might be redundant but safe
                      <div className="text-xs text-muted-foreground flex items-center mt-1 sm:mt-1 sm:ml-3">
                        <CalendarDays className="h-3 w-3 mr-1 text-primary" />
                        Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                      </div>
                    )}
                </div>
            </div>

            <div className="mt-3 sm:mt-0 flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 sm:shrink-0 w-full sm:w-auto">
                {/* Priority Select dropdown removed */}
                
                <Button
                    variant="ghost"
                    onClick={() => onDelete(task.id)}
                    aria-label={`Delete task: ${task.description}`}
                    className={cn(
                        "text-muted-foreground hover:text-destructive flex items-center", 
                        "w-full justify-start px-3 py-2 h-auto text-sm", 
                        "sm:w-9 sm:h-9 sm:p-0 sm:justify-center" 
                    )}
                >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span className="ml-2 sm:hidden">Delete Task</span>
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default React.memo(TaskItem);
