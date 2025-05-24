
"use client";

import React, { type FC, type DragEvent, useState, useCallback } from 'react';
import type { Task } from "@/types";
import TaskItem from "./TaskItem";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare } from "lucide-react";

interface TaskListProps {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEditTask: (task: Task) => void; 
}

const TaskList: FC<TaskListProps> = ({
  tasks,
  setTasks,
  onToggleComplete,
  onDelete,
  onEditTask, 
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragEvent<HTMLDivElement>, taskId: string) => {
    setDraggedTaskId(taskId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>, taskId: string) => {
    event.preventDefault();
    if (taskId !== dragOverTaskId) {
      setDragOverTaskId(taskId);
    }
  }, [dragOverTaskId]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>, targetTaskId: string) => {
    event.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      return;
    }

    const newTasks = [...tasks];
    const draggedItemIndex = newTasks.findIndex(t => t.id === draggedTaskId);
    const targetItemIndex = newTasks.findIndex(t => t.id === targetTaskId);

    if (draggedItemIndex === -1 || targetItemIndex === -1) {
      setDraggedTaskId(null); 
      setDragOverTaskId(null);
      return;
    }

    const [draggedItem] = newTasks.splice(draggedItemIndex, 1);
    newTasks.splice(targetItemIndex, 0, draggedItem);

    setTasks(newTasks);
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  }, [draggedTaskId, tasks, setTasks]);

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  }, []);

  if (tasks.length === 0) {
    return (
      <Card className="shadow-lg"> {/* Removed mt-6 */}
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
    <Card className="shadow-lg"> {/* Removed mt-6 */}
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <CheckSquare className="mr-2 h-6 w-6 text-primary" />
          Your Tasks
        </CardTitle>
      </CardHeader>
      <CardContent onDragOver={(e) => e.preventDefault()} onDrop={handleDragEnd}>
        {tasks.map((task) => (
          <div key={task.id} onDragEnd={handleDragEnd}>
             {dragOverTaskId === task.id && draggedTaskId !== task.id && (
              <div className="h-1 my-1 bg-primary rounded-full" />
            )}
            <TaskItem
              task={task}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onEdit={onEditTask} 
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

export default TaskList;
