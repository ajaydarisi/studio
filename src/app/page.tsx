
"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Task, TaskPriority } from "@/types";
import { suggestOptimalTaskOrder, type TaskListInput, type TaskListOutput } from "@/ai/flows/suggest-optimal-task-order";
import AppHeader from "@/components/AppHeader";
import TaskList from "@/components/TaskList";
import ProgressIndicator from "@/components/ProgressIndicator";
import TaskForm from "@/components/TaskForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

// Sample initial tasks if Supabase is empty or not configured
const initialTasksSeed: Omit<Task, 'id' | 'createdAt' | 'userId'>[] = [
  { description: "Morning workout session", estimatedCompletionTime: 45, priority: 'medium', completed: true, orderIndex: 0, dueDate: new Date() },
  { description: "Respond to urgent emails", estimatedCompletionTime: 60, priority: 'high', completed: false, orderIndex: 1, dueDate: new Date() },
  { description: "Draft project proposal", estimatedCompletionTime: 120, priority: 'high', completed: false, orderIndex: 2, dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
  { description: "Grocery shopping", estimatedCompletionTime: 75, priority: 'low', completed: false, orderIndex: 3, dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
];

const TASKS_TABLE = "tasks";

const mapSupabaseRowToTask = (row: any): Task => {
  let parsedDueDate: Date;
  if (row.dueDate && typeof row.dueDate === 'string') {
      const parts = row.dueDate.split('-');
      if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; 
          const day = parseInt(parts[2], 10);
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
              parsedDueDate = new Date(year, month, day);
          } else {
              console.warn(`Invalid date string from Supabase for dueDate: ${row.dueDate}`);
              parsedDueDate = new Date(); // Fallback, though dueDate is now mandatory
          }
      } else {
           console.warn(`Unexpected dueDate string format from Supabase: ${row.dueDate}`);
           parsedDueDate = new Date(); // Fallback
      }
  } else if (row.dueDate instanceof Date) {
      parsedDueDate = row.dueDate;
  }
  else {
    console.warn(`dueDate missing or not a string/Date from Supabase: ${row.dueDate}`);
    parsedDueDate = new Date(); // Fallback as it's mandatory
  }


  return {
    id: row.id,
    userId: row.user_id,
    description: row.description,
    estimatedCompletionTime: row.estimatedCompletionTime,
    priority: row.priority,
    completed: row.completed,
    createdAt: row.createdAt ? Date.parse(row.createdAt) : Date.now(),
    orderIndex: row.orderIndex,
    dueDate: parsedDueDate,
  };
};

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
  const { toast } = useToast();
  const { session, user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!authLoading && !session && isClient) {
      router.push('/login');
    }
  }, [authLoading, session, router, isClient]);

  const loadTasksFromSupabase = useCallback(async () => {
    if (!user) {
      setIsLoadingData(false);
      setTasks([]);
      return;
    }
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase
        .from(TASKS_TABLE)
        .select('*')
        .eq('user_id', user.id)
        .order('orderIndex', { ascending: true });

      if (error) throw error;

      let fetchedTasks: Task[] = data ? data.map(mapSupabaseRowToTask) : [];

      if (fetchedTasks.length === 0 && initialTasksSeed.length > 0 && user?.id) {
        const tasksToSeed = initialTasksSeed.map((taskSeed, index) => ({
          user_id: user.id,
          description: taskSeed.description,
          estimatedCompletionTime: taskSeed.estimatedCompletionTime,
          priority: taskSeed.priority,
          completed: taskSeed.completed,
          orderIndex: index,
          dueDate: format(taskSeed.dueDate, "yyyy-MM-dd"), // dueDate is now mandatory
        }));

        const { error: insertError } = await supabase.from(TASKS_TABLE).insert(tasksToSeed);
        if (insertError) throw insertError;

        const { data: seededData, error: fetchSeededError } = await supabase
          .from(TASKS_TABLE)
          .select('*')
          .eq('user_id', user.id)
          .order('orderIndex', { ascending: true });
        if (fetchSeededError) throw fetchSeededError;
        fetchedTasks = seededData ? seededData.map(mapSupabaseRowToTask) : [];
        toast({ title: "Welcome!", description: "Sample tasks loaded." });
      }
      setTasks(fetchedTasks);
    } catch (error: any) {
      console.error("Error loading tasks from Supabase:", error);
      toast({ title: "Error", description: `Could not load tasks: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (session && user && isClient) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseUrl !== 'your_supabase_url_here' && supabaseUrl !== '' && supabaseAnonKey && supabaseAnonKey !== 'your_supabase_anon_key_here' && supabaseAnonKey !== '') {
          loadTasksFromSupabase();
      } else {
          console.warn("Supabase URL or Anon Key is not configured correctly or is a placeholder.");
          toast({ title: "Supabase Not Configured", description: "Please check your Supabase credentials in .env and restart the server.", variant: "destructive", duration: 10000});
          setIsLoadingData(false);
      }
    } else if (!authLoading && !session && isClient) {
        setIsLoadingData(false);
        setTasks([]);
    }
  }, [session, user, authLoading, loadTasksFromSupabase, toast, isClient]);


  const saveTaskOrderToSupabase = useCallback(async (tasksToSave: Pick<Task, 'id' | 'orderIndex'>[]) => {
    if (!user) return;
    try {
      const updates = tasksToSave.map(task =>
        supabase
          .from(TASKS_TABLE)
          .update({ orderIndex: task.orderIndex })
          .eq('id', task.id)
          .eq('user_id', user.id)
      );
      const results = await Promise.all(updates);
      results.forEach(result => {
        if (result.error) throw result.error;
      });
    } catch (error: any) {
      console.error("Error saving task order to Supabase:", error);
      toast({ title: "Save Order Error", description: `Could not save task order: ${error.message}`, variant: "destructive" });
      // Consider re-fetching to ensure UI consistency after error
      await loadTasksFromSupabase();
    }
  }, [toast, user, loadTasksFromSupabase]);


  const handleAddTask = useCallback(async (description: string, estimatedTime: number, dueDate: Date): Promise<void> => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to add tasks.", variant: "destructive" });
      return Promise.reject(new Error("User not authenticated"));
    }
     if (!dueDate) { // Should not happen with form validation, but good to check
        toast({ title: "Missing Due Date", description: "Due date is required.", variant: "destructive" });
        return Promise.reject(new Error("Due date is required"));
    }


    const newTaskData = {
      user_id: user.id,
      description,
      estimatedCompletionTime: estimatedTime,
      priority: 'medium' as TaskPriority, // Default priority
      completed: false,
      orderIndex: tasks.length,
      dueDate: format(dueDate, "yyyy-MM-dd"),
    };

    try {
      const { data: insertedTask, error } = await supabase
        .from(TASKS_TABLE)
        .insert(newTaskData)
        .select()
        .single();

      if (error) throw error;

      if (insertedTask) {
        // Optimistically add to local state, or refetch if strict consistency is needed
        setTasks((prevTasks) => [...prevTasks, mapSupabaseRowToTask(insertedTask)]);
        toast({ title: "Task Added", description: `"${description}" has been added.` });
      } else {
        // Fallback if single() doesn't return data as expected, refetch list
        await loadTasksFromSupabase();
        toast({ title: "Task Added", description: `"${description}" has been added. List refreshed.` });
      }
    } catch (error: any) {
      console.error("Error adding task to Supabase:", error);
      let errorMessage = "Could not add task.";
      if (error && error.message) {
        errorMessage = error.message;
      }
      toast({ title: "Add Task Error", description: errorMessage, variant: "destructive" });
      return Promise.reject(error);
    }
  }, [tasks.length, toast, loadTasksFromSupabase, user]);

  const handleFormSubmitAddTask = async (description: string, estimatedTime: number, dueDate: Date) => { // dueDate is now mandatory
    try {
      await handleAddTask(description, estimatedTime, dueDate);
      setIsAddTaskDialogOpen(false);
    } catch (error) {
      // Error is already toasted by handleAddTask
    }
  };

  const handleToggleComplete = useCallback(async (id: string) => {
    if (!user) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newCompletedStatus = !task.completed;

    setTasks((prevTasks) =>
      prevTasks.map((t) => (t.id === id ? { ...t, completed: newCompletedStatus } : t))
    );

    try {
      const { error } = await supabase
        .from(TASKS_TABLE)
        .update({ completed: newCompletedStatus })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) {
        setTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === id ? { ...t, completed: task.completed } : t))
        );
        toast({ title: "Update Error", description: `Could not update task: ${error.message}. Reverting.`, variant: "destructive" });
        await loadTasksFromSupabase();
        throw error;
      }
      toast({ title: "Task Updated" });
    } catch (error: any) {
      console.error("Error updating task completion in Supabase:", error);
    }
  }, [tasks, toast, user, loadTasksFromSupabase]);

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!user) return;
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    const originalTasks = [...tasks];
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));

    try {
      const { error: deleteError } = await supabase
        .from(TASKS_TABLE)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (deleteError) throw deleteError;
      
      toast({ title: "Task Deleted", description: `"${taskToDelete.description}" has been removed.`, variant: "destructive" });
      await loadTasksFromSupabase(); 
    } catch (error: any) {
      console.error("Error deleting task from Supabase:", error);
      toast({ title: "Delete Error", description: `Could not delete task: ${error.message}. Reverting.`, variant: "destructive" });
      setTasks(originalTasks);
      await loadTasksFromSupabase();
    }
  }, [tasks, toast, user, loadTasksFromSupabase]);

  // handlePriorityChange function removed as priority dropdown is removed

  const handleSetTasks = useCallback(async (newTasks: Task[]) => {
    if (!user) return;

    const tasksToSaveForOrder = newTasks.map((task, index) => ({
      id: task.id,
      orderIndex: index,
    }));

    const originalTasks = [...tasks];
    setTasks(newTasks); 

    try {
      await saveTaskOrderToSupabase(tasksToSaveForOrder);
      // No immediate refetch here, rely on optimistic update and saveTaskOrderToSupabase to refetch on error.
    } catch (error: any) {
        toast({ title: "Reorder Error", description: `Could not save new task order: ${error.message}. Reverting.`, variant: "destructive" });
        setTasks(originalTasks); 
        await loadTasksFromSupabase();
    }
  }, [saveTaskOrderToSupabase, user, loadTasksFromSupabase, toast, tasks]);

  const handleSmartSchedule = useCallback(async () => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to schedule tasks.", variant: "destructive" });
      return;
    }
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
          priority: task.priority, // Priority is still used by AI
          dueDate: task.dueDate, // dueDate is now mandatory
        })),
      };
      const result: TaskListOutput = await suggestOptimalTaskOrder(inputForAI);

      const taskOrderUpdates = result.orderedTasks.map((aiTask, index) => ({
        id: aiTask.id,
        orderIndex: index,
      }));

      await saveTaskOrderToSupabase(taskOrderUpdates);
      await loadTasksFromSupabase();

      toast({
        title: "Schedule Optimized!",
        description: result.reasoning || "Tasks have been reordered for optimal flow.",
        duration: 7000,
      });
    } catch (error: any) {
      console.error("Error during smart scheduling with Supabase:", error);
      toast({
        title: "Scheduling Error",
        description: `Could not optimize the schedule: ${error.message}. Please try again.`,
        variant: "destructive",
      });
       await loadTasksFromSupabase();
    } finally {
      setIsScheduling(false);
    }
  }, [user, tasks, toast, saveTaskOrderToSupabase, loadTasksFromSupabase]);

  if (authLoading || (!session && isClient && router.pathname !== '/login' && router.pathname !== '/signup')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground">{authLoading ? "Authenticating..." : "Redirecting..."}</p>
      </div>
    );
  }

  if (isLoadingData && session && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8 max-w-4xl flex-grow">
        <AppHeader
          onSmartSchedule={handleSmartSchedule}
          isScheduling={isScheduling}
          onTriggerAddTaskDialog={() => setIsAddTaskDialogOpen(true)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-8">
          <div className="sm:col-span-2">
            <TaskList
              tasks={tasks}
              setTasks={handleSetTasks}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTask}
              // onPriorityChange prop removed
            />
          </div>
          <div className="sm:col-span-1">
            <ProgressIndicator tasks={tasks} />
          </div>
        </div>
      </main>

      {user && (
        <Button
          className="sm:hidden fixed bottom-6 right-6 rounded-full h-16 w-16 shadow-xl z-50 flex items-center justify-center"
          size="icon"
          onClick={() => setIsAddTaskDialogOpen(true)}
          aria-label="Add New Task"
        >
          <Plus className="h-8 w-8" />
        </Button>
      )}

      <Dialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <PlusCircle className="mr-2 h-6 w-6 text-accent" />
              Add New Task
            </DialogTitle>
          </DialogHeader>
          {/* Ensure TaskForm receives dueDate as Date, not Date | null or Date | undefined */}
          <TaskForm onAddTask={(desc, time, date) => handleFormSubmitAddTask(desc, time, date as Date)} />
        </DialogContent>
      </Dialog>

      <footer className="text-center py-6 text-sm text-muted-foreground border-t mt-auto">
        <p>&copy; {new Date().getFullYear()} Day Architect. Plan your success.</p>
      </footer>
    </div>
  );
}
