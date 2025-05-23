
"use client";

import React, { type FC, type DragEvent, useState } from 'react'; // Added React
import type { Task, TaskPriority } from "@/types";
import TaskItem from "./TaskItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare } from "lucide-react";

interface TaskListProps {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, priority: TaskPriority) => void;
}

const TaskList: FC<TaskListProps> = ({
  tasks,
  setTasks,
  onToggleComplete,
  onDelete,
  onPriorityChange,
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
    
    setTasks(newTasks); // This calls handleSetTasks from page.tsx, which handles DB update
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
          handleDragEnd();
        }}>
        {tasks.map((task) => (
          <div key={task.id} onDragEnd={handleDragEnd}>
             {dragOverTaskId === task.id && draggedTaskId !== task.id && (
              <div className="h-1 my-1 bg-primary rounded-full" />
            )}
            <TaskItem
              task={task}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onPriorityChange={onPriorityChange}
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

    