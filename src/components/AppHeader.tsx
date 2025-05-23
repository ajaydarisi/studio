
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Sparkles, CalendarCheck2, PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";

interface AppHeaderProps {
  onSmartSchedule: () => void;
  isScheduling: boolean;
  onAddTask: (description: string, estimatedTime: number) => void;
}

const AppHeader: FC<AppHeaderProps> = ({ onSmartSchedule, isScheduling, onAddTask }) => {
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);

  const handleInternalAddTask = (description: string, estimatedTime: number) => {
    onAddTask(description, estimatedTime);
    setIsAddTaskDialogOpen(false); // Close dialog after adding task
  };

  return (
    <header className="flex flex-wrap items-center justify-between mb-6 pb-4 border-b gap-4">
      <div className="flex items-center space-x-3">
        <CalendarCheck2 className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">Day Architect</h1>
      </div>
      <div className="flex items-center space-x-2">
        <Dialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow">
              <PlusCircle className="mr-2 h-5 w-5 text-accent" />
              Add New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                 <PlusCircle className="mr-2 h-6 w-6 text-accent" />
                Add New Task
              </DialogTitle>
            </DialogHeader>
            <TaskForm onAddTask={handleInternalAddTask} />
          </DialogContent>
        </Dialog>

        <Button onClick={onSmartSchedule} disabled={isScheduling} variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <Sparkles className={`mr-2 h-5 w-5 ${isScheduling ? 'animate-spin' : ''}`} />
          {isScheduling ? "Optimizing..." : "Smart Schedule"}
        </Button>
      </div>
    </header>
  );
};

export default AppHeader;
