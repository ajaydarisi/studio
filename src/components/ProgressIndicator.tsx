
"use client";

import React, { type FC } from 'react';
import type { Task } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ListChecks, Clock } from "lucide-react";

interface ProgressIndicatorProps {
  tasks: Task[];
}

const ProgressIndicator: FC<ProgressIndicatorProps> = React.memo(({ tasks }) => {
  // Log the received tasks to the browser console for debugging
  console.log('ProgressIndicator tasks received:', JSON.stringify(tasks, null, 2));

  const totalTasks = tasks.length;
  // Ensure we are strictly checking for true boolean
  const completedTasks = tasks.filter((task) => task.completed === true).length;
  const tasksProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Ensure estimatedCompletionTime is treated as a number in sums
  const totalEstimatedTime = tasks.reduce((sum, task) => sum + (Number(task.estimatedCompletionTime) || 0), 0);
  const completedEstimatedTime = tasks
    .filter((task) => task.completed === true) // Strict check for completed
    .reduce((sum, task) => sum + (Number(task.estimatedCompletionTime) || 0), 0); // Ensure time is a number
  
  const timeProgress = totalEstimatedTime > 0 ? (completedEstimatedTime / totalEstimatedTime) * 100 : 0;

  const formatTime = (minutes: number) => {
    if (minutes < 0 || isNaN(minutes)) minutes = 0; // Ensure minutes is not negative or NaN
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m > 0 ? `${m}m` : ""}`.trim();
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <ListChecks className="mr-2 h-6 w-6 text-primary" />
          Daily Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-foreground">Tasks Completed</span>
            <span className="text-sm text-muted-foreground">
              {completedTasks} of {totalTasks}
            </span>
          </div>
          <Progress value={tasksProgress} aria-label={`${tasksProgress.toFixed(0)}% tasks completed`} className="h-3" />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-foreground">Time Progress</span>
            <span className="text-sm text-muted-foreground">
              {formatTime(completedEstimatedTime)} of {formatTime(totalEstimatedTime)}
            </span>
          </div>
          <Progress value={timeProgress} aria-label={`${timeProgress.toFixed(0)}% time completed`} className="h-3" indicatorClassName="bg-accent" />
        </div>
         {totalTasks > 0 && completedTasks === totalTasks && (
          <p className="text-center text-lg font-semibold text-accent pt-2">
            🎉 All tasks completed! Well done! 🎉
          </p>
        )}
        {totalTasks > 0 && completedTasks < totalTasks && completedEstimatedTime > totalEstimatedTime && (
           <p className="text-center text-sm text-destructive pt-2">
            You're spending more time than planned.
           </p>
        )}
      </CardContent>
    </Card>
  );
});

ProgressIndicator.displayName = 'ProgressIndicator';
export default ProgressIndicator;
