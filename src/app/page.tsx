
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task, TaskPriority } from "@/types";
import { suggestOptimalTaskOrder, type TaskListInput, type TaskListOutput } from "@/ai/flows/suggest-optimal-task-order";
import AppHeader from "@/components/AppHeader";
import TaskForm from "@/components/TaskForm";
import TaskList from "@/components/TaskList";
import ProgressIndicator from "@/components/ProgressIndicator";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";

// Sample initial tasks
const initialTasks: Task[] = [
  { id: uuidv4(), description: "Morning workout session", estimatedCompletionTime: 45, priority: 'medium', completed: true, createdAt: Date.now() - 300000 },
  { id: uuidv4(), description: "Respond to urgent emails", estimatedCompletionTime: 60, priority: 'high', completed: false, createdAt: Date.now() - 200000 },
  { id: uuidv4(), description: "Draft project proposal", estimatedCompletionTime: 120, priority: 'high', completed: false, createdAt: Date.now() - 100000 },
  { id: uuidv4(), description: "Grocery shopping", estimatedCompletionTime: 75, priority: 'low', completed: false, createdAt: Date.now() },
];


export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    // Load tasks from local storage or use initialTasks
    const storedTasks = localStorage.getItem("dayArchitectTasks");
    if (storedTasks) {
      try {
        const parsedTasks = JSON.parse(storedTasks);
        // Basic validation
        if (Array.isArray(parsedTasks) && parsedTasks.every(task => task.id && typeof task.description === 'string')) {
          setTasks(parsedTasks);
        } else {
          setTasks(initialTasks);
        }
      } catch (error) {
        console.error("Failed to parse tasks from localStorage", error);
        setTasks(initialTasks);
      }
    } else {
      setTasks(initialTasks);
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem("dayArchitectTasks", JSON.stringify(tasks));
    }
  }, [tasks, isClient]);

  const handleAddTask = useCallback((description: string, estimatedTime: number) => {
    const newTask: Task = {
      id: uuidv4(),
      description,
      estimatedCompletionTime: estimatedTime,
      priority: 'medium', // Default priority
      completed: false,
      createdAt: Date.now(),
    };
    setTasks((prevTasks) => [...prevTasks, newTask]);
    toast({ title: "Task Added", description: `"${description}" has been added to your list.` });
    setIsAddTaskDialogOpen(false); // Close dialog after adding task
  }, [toast]);

  const handleToggleComplete = useCallback((id: string) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }, []);

  const handleDeleteTask = useCallback((id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
    if (taskToDelete) {
      toast({ title: "Task Deleted", description: `"${taskToDelete.description}" has been removed.`, variant: "destructive" });
    }
  }, [tasks, toast]);

  const handlePriorityChange = useCallback((id: string, priority: TaskPriority) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === id ? { ...task, priority } : task
      )
    );
  }, []);

  const handleSetTasks = useCallback((newTasks: Task[]) => {
    setTasks(newTasks);
  }, []);

  const handleSmartSchedule = async () => {
    if (tasks.length === 0) {
      toast({ title: "No Tasks", description: "Add some tasks before trying to schedule.", variant: "destructive" });
      return;
    }
    setIsScheduling(true);
    try {
      const inputForAI: TaskListInput = {
        tasks: tasks.map(task => ({
          id: task.id,
          description: task.description,
          estimatedCompletionTime: task.estimatedCompletionTime,
          priority: task.priority,
        })),
      };
      const result: TaskListOutput = await suggestOptimalTaskOrder(inputForAI);
      
      const newOrderedTasks = result.orderedTasks.map(aiTask => {
        const originalTask = tasks.find(t => t.id === aiTask.id);
        return {
          ...aiTask,
          completed: originalTask?.completed || false,
          createdAt: originalTask?.createdAt || Date.now(),
        };
      });

      setTasks(newOrderedTasks);
      toast({
        title: "Schedule Optimized!",
        description: result.reasoning || "Tasks have been reordered for optimal flow.",
        duration: 7000, 
      });
    } catch (error) {
      console.error("Error during smart scheduling:", error);
      toast({
        title: "Scheduling Error",
        description: "Could not optimize the schedule. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsScheduling(false);
    }
  };
  
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground">Loading Day Architect...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <AppHeader onSmartSchedule={handleSmartSchedule} isScheduling={isScheduling} />
        
        <div className="mb-6">
          <Dialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg" className="w-full md:w-auto shadow-sm hover:shadow-md transition-shadow">
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
              <TaskForm onAddTask={handleAddTask} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <TaskList
              tasks={tasks}
              setTasks={handleSetTasks}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTask}
              onPriorityChange={handlePriorityChange}
            />
          </div>
          <div className="md:col-span-1">
            <ProgressIndicator tasks={tasks} />
          </div>
        </div>
      </main>
      <footer className="text-center py-6 text-sm text-muted-foreground border-t mt-12">
        <p>&copy; {new Date().getFullYear()} Day Architect. Plan your success.</p>
      </footer>
    </div>
  );
}
