
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
import { Plus, PlusCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

// Sample initial tasks if Supabase is empty or not configured
const initialTasksSeed: Omit<Task, 'id' | 'createdAt' | 'userId' | 'dueDate'>[] = [
  { description: "Morning workout session", estimatedCompletionTime: 45, priority: 'medium', completed: true, orderIndex: 0 },
  { description: "Respond to urgent emails", estimatedCompletionTime: 60, priority: 'high', completed: false, orderIndex: 1 },
  { description: "Draft project proposal", estimatedCompletionTime: 120, priority: 'high', completed: false, orderIndex: 2 },
  { description: "Grocery shopping", estimatedCompletionTime: 75, priority: 'low', completed: false, orderIndex: 3 },
];

const TASKS_TABLE = "tasks";

const mapSupabaseRowToTask = (row: any): Task => {
  let parsedDueDate: Date;
  if (row.dueDate && typeof row.dueDate === 'string') {
    // Attempt to parse various common date string formats robustly
    const date = new Date(row.dueDate);
    if (!isNaN(date.getTime())) {
        // If it's a full ISO string like "2023-10-26T00:00:00.000Z", new Date() handles it.
        // If it's "yyyy-MM-dd", new Date() will interpret it as UTC, so adjust for local timezone if needed.
        // For simplicity, we'll assume the date stored is the intended local date.
        // To ensure it's treated as local date, we can parse parts:
        const parts = row.dueDate.split(/[-T]/); // Split by hyphen or T
        parsedDueDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
        console.warn(`Invalid date string from Supabase for dueDate: ${row.dueDate}. Defaulting to now.`);
        parsedDueDate = new Date();
    }
  } else if (row.dueDate instanceof Date) {
      parsedDueDate = row.dueDate;
  } else {
    console.warn(`dueDate missing or not a string/Date from Supabase: ${row.dueDate}. Defaulting to now.`);
    parsedDueDate = new Date();
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
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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
          dueDate: format(new Date(new Date().setDate(new Date().getDate() + index)), "yyyy-MM-dd"), // Seed with varied future dates
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
  }, [toast, user]); // Removed `tasks` from dependencies as it caused infinite loops

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
      throw error; 
    }
  }, [toast, user]);

  const handleActualAddTask = useCallback(async (description: string, estimatedTime: number, dueDate: Date): Promise<void> => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to add tasks.", variant: "destructive" });
      return Promise.reject(new Error("User not authenticated"));
    }
    if (!dueDate) {
        toast({ title: "Missing Due Date", description: "Due date is required.", variant: "destructive" });
        return Promise.reject(new Error("Due date is required"));
    }

    const newTaskData = {
      user_id: user.id,
      description,
      estimatedCompletionTime: estimatedTime,
      priority: 'medium' as TaskPriority,
      completed: false,
      orderIndex: tasks.length, // This might need adjustment if tasks can be deleted and orderIndex is not contiguous
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
        // To ensure createdAt and other server-generated fields are correct, and orderIndex is consistent.
        await loadTasksFromSupabase(); 
        toast({ title: "Task Added", description: `"${description}" has been added.` });
      } else {
        await loadTasksFromSupabase(); 
        toast({ title: "Task Added", description: `"${description}" has been added. List refreshed.` });
      }
    } catch (error: any) {
      console.error("Error adding task to Supabase:", error);
      toast({ title: "Add Task Error", description: error.message || "Could not add task.", variant: "destructive" });
      return Promise.reject(error);
    }
  }, [tasks.length, toast, loadTasksFromSupabase, user]);

  const handleActualUpdateTask = useCallback(async (taskId: string, description: string, estimatedTime: number, dueDate: Date): Promise<void> => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to update tasks.", variant: "destructive" });
      return Promise.reject(new Error("User not authenticated"));
    }
     if (!dueDate) {
        toast({ title: "Missing Due Date", description: "Due date is required for update.", variant: "destructive" });
        return Promise.reject(new Error("Due date is required for update"));
    }

    const updatedTaskData = {
      description,
      estimatedCompletionTime: estimatedTime,
      dueDate: format(dueDate, "yyyy-MM-dd"),
    };

    try {
      const { data: updatedTaskResult, error } = await supabase
        .from(TASKS_TABLE)
        .update(updatedTaskData)
        .eq('id', taskId)
        .eq('user_id', user.id)
        .select()
        .single();
      
      if (error) throw error;

      if (updatedTaskResult) {
         await loadTasksFromSupabase(); // Refresh list to get the updated item
        toast({ title: "Task Updated", description: `"${description}" has been updated.` });
      } else {
        await loadTasksFromSupabase();
        toast({ title: "Task Updated", description: `"${description}" has been updated. List refreshed.` });
      }
    } catch (error: any) {
      console.error("Error updating task in Supabase:", error);
      toast({ title: "Update Task Error", description: error.message || "Could not update task.", variant: "destructive" });
      return Promise.reject(error);
    }
  }, [toast, user, loadTasksFromSupabase]);

  const handleDialogSubmit = useCallback(async (description: string, estimatedTime: number, dueDate: Date | null | undefined) => {
    if (!dueDate) { 
        toast({ title: "Due Date Required", description: "Please select a due date.", variant: "destructive" });
        return Promise.reject(new Error("Due date required"));
    }
    try {
      if (dialogMode === 'add') {
        await handleActualAddTask(description, estimatedTime, dueDate);
      } else if (dialogMode === 'edit' && editingTask) {
        await handleActualUpdateTask(editingTask.id, description, estimatedTime, dueDate);
      }
      setIsDialogOpen(false);
      setEditingTask(null); // Reset editing task
    } catch (error) {
      // Errors are already toasted within handleActualAddTask/UpdateTask
    }
  }, [dialogMode, editingTask, handleActualAddTask, handleActualUpdateTask, setIsDialogOpen, setEditingTask, toast]);

  const handleOpenAddTaskDialog = useCallback(() => {
    setDialogMode('add');
    setEditingTask(null);
    setIsDialogOpen(true);
  }, [setDialogMode, setEditingTask, setIsDialogOpen]);

  const handleOpenEditDialog = useCallback((taskToEdit: Task) => {
    setDialogMode('edit');
    setEditingTask(taskToEdit);
    setIsDialogOpen(true);
  }, [setDialogMode, setEditingTask, setIsDialogOpen]);


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
      // No need to call loadTasksFromSupabase() here if it's already in the error block's catch
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
      // To ensure UI reflects the exact state after potential concurrent updates or trigger effects:
      await loadTasksFromSupabase(); 
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
          priority: task.priority,
          dueDate: task.dueDate, 
        })),
      };
      const result: TaskListOutput = await suggestOptimalTaskOrder(inputForAI);

      const taskOrderUpdates = result.orderedTasks.map((aiTask, index) => ({
        id: aiTask.id,
        orderIndex: index,
      }));

      await saveTaskOrderToSupabase(taskOrderUpdates);
      await loadTasksFromSupabase(); // Refresh after saving order

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-foreground ml-2">{authLoading ? "Authenticating..." : "Redirecting..."}</p>
      </div>
    );
  }

  if (isLoadingData && session && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-foreground ml-2">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8 max-w-4xl flex-grow">
        <AppHeader
          onSmartSchedule={handleSmartSchedule}
          isScheduling={isScheduling}
          onTriggerAddTaskDialog={handleOpenAddTaskDialog}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-8">
          <div className="sm:col-span-2">
            <TaskList
              tasks={tasks}
              setTasks={handleSetTasks}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTask}
              onEditTask={handleOpenEditDialog} 
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
          onClick={handleOpenAddTaskDialog}
          aria-label="Add New Task"
        >
          <Plus className="h-8 w-8" />
        </Button>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
            setEditingTask(null); // Reset editing task when dialog closes
            setDialogMode('add'); // Reset dialog mode
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <PlusCircle className="mr-2 h-6 w-6 text-accent" />
              {dialogMode === 'add' ? 'Add New Task' : 'Edit Task'}
            </DialogTitle>
          </DialogHeader>
          <TaskForm 
            onSubmit={handleDialogSubmit}
            initialValues={dialogMode === 'edit' && editingTask ? {
              description: editingTask.description,
              estimatedCompletionTime: editingTask.estimatedCompletionTime,
              dueDate: editingTask.dueDate,
            } : undefined}
            buttonText={dialogMode === 'add' ? 'Add Task' : 'Save Changes'}
          />
        </DialogContent>
      </Dialog>

      <footer className="text-center py-6 text-sm text-muted-foreground border-t mt-auto">
        <p>&copy; {new Date().getFullYear()} Day Architect. Plan your success.</p>
      </footer>
    </div>
  );
}

