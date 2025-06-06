
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
  const totalTasks = tasks.length;
  const completedTasksArray = tasks.filter((task) => task.completed === true);
  const completedTasks = completedTasksArray.length;
  const tasksProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const totalEstimatedTime = tasks.reduce((sum, task) => sum + (Number(task.estimatedCompletionTime) || 0), 0);
  const completedEstimatedTime = completedTasksArray
    .reduce((sum, task) => sum + (Number(task.estimatedCompletionTime) || 0), 0);

  const timeProgress = totalEstimatedTime > 0 ? (completedEstimatedTime / totalEstimatedTime) * 100 : 0;

  const formatTime = (minutes: number) => {
    if (isNaN(minutes) || minutes < 0) minutes = 0;
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
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
        {totalTasks > 0 && completedTasks < totalTasks && completedEstimatedTime > 0 && totalEstimatedTime > 0 &&
         (completedEstimatedTime / totalEstimatedTime) >= 0.5 && ( // Example: if more than 50% of time is done
           <p className="text-center text-sm text-muted-foreground pt-2">
            Keep it up! You&apos;re making good progress.
           </p>
        )}
      </CardContent>
    </Card>
  );
});

ProgressIndicator.displayName = 'ProgressIndicator';
export default ProgressIndicator;
