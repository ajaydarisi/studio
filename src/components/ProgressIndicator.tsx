
"use client";

import type { FC } from 'react'; // Removed React import as it's not directly used for React.memo anymore
import type { Task } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ListChecks, Clock } from "lucide-react";

interface ProgressIndicatorProps {
  tasks: Task[];
}

// React.memo temporarily removed for debugging prop updates
const ProgressIndicator: FC<ProgressIndicatorProps> = ({ tasks }) => {
  console.log('[ProgressIndicator] Received tasks for render:', JSON.stringify(tasks.map(t => ({id: t.id, completed: t.completed, est: t.estimatedCompletionTime}))));

  const totalTasks = tasks.length;
  
  const completedTasksArray = tasks.filter((task) => task.completed === true);
  const completedTasks = completedTasksArray.length;

  console.log('[ProgressIndicator] Total tasks:', totalTasks);
  console.log('[ProgressIndicator] Filtered completedTasksArray count:', completedTasks);
  // Detailed log of 'completed' status for each task as seen by ProgressIndicator
  if (tasks.length > 0) {
    console.log('[ProgressIndicator] Individual task completed statuses:', tasks.map(t => ({ id: t.id, description: t.description.substring(0,15), completed: t.completed })));
  }


  const tasksProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  console.log('[ProgressIndicator] Calculated tasksProgress:', tasksProgress);


  const totalEstimatedTime = tasks.reduce((sum, task) => sum + (Number(task.estimatedCompletionTime) || 0), 0);
  // Use the already filtered completedTasksArray for consistency and minor optimization
  const completedEstimatedTime = completedTasksArray
    .reduce((sum, task) => sum + (Number(task.estimatedCompletionTime) || 0), 0);
  
  const timeProgress = totalEstimatedTime > 0 ? (completedEstimatedTime / totalEstimatedTime) * 100 : 0;

  console.log('[ProgressIndicator] Total estimated time:', totalEstimatedTime);
  console.log('[ProgressIndicator] Completed estimated time (from filtered array):', completedEstimatedTime);
  console.log('[ProgressIndicator] Calculated timeProgress:', timeProgress);


  const formatTime = (minutes: number) => {
    if (isNaN(minutes) || minutes < 0) minutes = 0;
    if (minutes < 60) return `${Math.round(minutes)}m`; // Round to nearest minute
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60); // Round minutes part
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
        {/* Clarified this message condition */}
        {totalTasks > 0 && completedTasks < totalTasks && completedEstimatedTime > 0 && completedEstimatedTime > tasks.filter(t=> !t.completed).reduce((sum, task) => sum + (Number(task.estimatedCompletionTime) || 0), 0) && (
           <p className="text-center text-sm text-destructive pt-2">
            Keep it up! You&apos;re making good progress on time.
           </p>
        )}
      </CardContent>
    </Card>
  );
};

// ProgressIndicator.displayName = 'ProgressIndicator'; // Not needed if React.memo is removed
export default ProgressIndicator;
