
"use client";

import React, { type FC, type DragEvent, useState } from 'react';
import type { Task } from "@/types";
import TaskItem from "./TaskItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, Edit3 } from "lucide-react"; // Added Edit3 for potential future use or consistency

interface TaskListProps {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEditTask: (task: Task) => void; // Ensure this prop is defined
}

const TaskList: FC<TaskListProps> = ({
  tasks,
  setTasks,
  onToggleComplete,
  onDelete,
  onEditTask, // Ensure this prop is destructured
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const handleDragStart = (event: DragEvent<HTMLDivElement>, taskId: string) => {
    setDraggedTaskId(taskId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId); 
  };
  
  const handleDragOver = (event: DragEvent<HTMLDivElement>, taskId: string) => {
    event.preventDefault(); 
    if (taskId !== dragOverTaskId) {
      setDragOverTaskId(taskId);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetTaskId: string) => {
    event.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      return;
    }

    const newTasks = [...tasks];
    const draggedItemIndex = newTasks.findIndex(t => t.id === draggedTaskId);
    const targetItemIndex = newTasks.findIndex(t => t.id === targetTaskId);

    if (draggedItemIndex === -1 || targetItemIndex === -1) return;

    const [draggedItem] = newTasks.splice(draggedItemIndex, 1);
    newTasks.splice(targetItemIndex, 0, draggedItem);
    
    setTasks(newTasks); // This calls handleSetTasksOptimistic from page.tsx
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };
  
  if (tasks.length === 0) {
    return (
      <Card className="mt-6 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center">
            <CheckSquare className="mr-2 h-6 w-6 text-primary" />
            Your Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No tasks yet. Add some tasks to get started!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <CheckSquare className="mr-2 h-6 w-6 text-primary" />
          Your Tasks
        </CardTitle>
      </CardHeader>
      <CardContent onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
          // This outer onDrop is a fallback if drop doesn't happen on a TaskItem directly
          // For example, if dropped onto padding space between items.
          // Here, we primarily just want to reset dragging state.
          handleDragEnd();
        }}>
        {tasks.map((task) => (
          <div key={task.id} onDragEnd={handleDragEnd}> {/* Ensures drag state resets if dragged off an item and then released */}
             {dragOverTaskId === task.id && draggedTaskId !== task.id && (
              <div className="h-1 my-1 bg-primary rounded-full" /> // Visual cue for drop target
            )}
            <TaskItem
              task={task}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onEdit={onEditTask} // Pass the onEditTask function to TaskItem's onEdit prop
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragging={draggedTaskId === task.id}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default React.memo(TaskList);

