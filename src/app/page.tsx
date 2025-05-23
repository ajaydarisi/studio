
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task, TaskPriority } from "@/types";
import { suggestOptimalTaskOrder, type TaskListInput, type TaskListOutput } from "@/ai/flows/suggest-optimal-task-order";
import AppHeader from "@/components/AppHeader";
import TaskList from "@/components/TaskList";
import ProgressIndicator from "@/components/ProgressIndicator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

// Sample initial tasks if Supabase is empty or not configured
const initialTasksSeed: Omit<Task, 'id' | 'createdAt' | 'userId'>[] = [
  { description: "Morning workout session", estimatedCompletionTime: 45, priority: 'medium', completed: true, orderIndex: 0 },
  { description: "Respond to urgent emails", estimatedCompletionTime: 60, priority: 'high', completed: false, orderIndex: 1 },
  { description: "Draft project proposal", estimatedCompletionTime: 120, priority: 'high', completed: false, orderIndex: 2 },
  { description: "Grocery shopping", estimatedCompletionTime: 75, priority: 'low', completed: false, orderIndex: 3 },
];

const TASKS_TABLE = "tasks";

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);
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


  const mapSupabaseRowToTask = (row: any): Task => {
    return {
      id: row.id,
      userId: row.user_id,
      description: row.description,
      estimatedCompletionTime: row.estimatedCompletionTime,
      priority: row.priority,
      completed: row.completed,
      createdAt: row.createdAt ? Date.parse(row.createdAt) : Date.now(),
      orderIndex: row.orderIndex,
    };
  };

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
    } catch (error) {
      console.error("Error loading tasks from Supabase:", error);
      toast({ title: "Error", description: "Could not load tasks.", variant: "destructive" });
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
    // This function no longer manages isLoadingData or setTasks directly.
    // It only performs DB operations.
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
    } catch (error) {
      console.error("Error saving task order to Supabase:", error);
      toast({ title: "Save Order Error", description: "Could not save task order.", variant: "destructive" });
      throw error; // Re-throw to be caught by caller
    }
  }, [toast, user]);


  const handleAddTask = useCallback(async (description: string, estimatedTime: number): Promise<void> => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to add tasks.", variant: "destructive" });
      return Promise.reject(new Error("User not authenticated"));
    }
    
    const newTaskData = {
      user_id: user.id,
      description,
      estimatedCompletionTime: estimatedTime,
      priority: 'medium' as TaskPriority,
      completed: false,
      orderIndex: tasks.length,
    };
    try {
      const { error } = await supabase.from(TASKS_TABLE).insert(newTaskData);
      if (error) throw error;

      toast({ title: "Task Added", description: `"${description}" has been added.` });
      await loadTasksFromSupabase(); 
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

  const handleToggleComplete = useCallback(async (id: string) => {
    if (!user) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newCompletedStatus = !task.completed;
    try {
      const { error } = await supabase
        .from(TASKS_TABLE)
        .update({ completed: newCompletedStatus })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;

      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === id ? { ...t, completed: newCompletedStatus } : t))
      );
      toast({ title: "Task Updated" });
    } catch (error) {
      console.error("Error updating task completion in Supabase:", error);
      toast({ title: "Update Error", description: "Could not update task.", variant: "destructive" });
      await loadTasksFromSupabase(); // Refetch on error to ensure consistency
    }
  }, [tasks, toast, user, loadTasksFromSupabase]);

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!user) return;
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    try {
      const { error: deleteError } = await supabase
        .from(TASKS_TABLE)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (deleteError) throw deleteError;

      const remainingTasks = tasks.filter((task) => task.id !== id);
      const taskOrderUpdates = remainingTasks.map((task, index) => ({ id: task.id, orderIndex: index }));

      if (taskOrderUpdates.length > 0) {
        await saveTaskOrderToSupabase(taskOrderUpdates);
      }
      
      toast({ title: "Task Deleted", description: `"${taskToDelete.description}" has been removed.`, variant: "destructive" });
      await loadTasksFromSupabase(); // Refetch tasks after successful delete and reorder
    } catch (error) {
      console.error("Error deleting task from Supabase:", error);
      toast({ title: "Delete Error", description: "Could not delete task.", variant: "destructive" });
      await loadTasksFromSupabase(); // Refetch on error to ensure consistency
    }
  }, [tasks, toast, user, saveTaskOrderToSupabase, loadTasksFromSupabase]);

  const handlePriorityChange = useCallback(async (id: string, priority: TaskPriority) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from(TASKS_TABLE)
        .update({ priority: priority })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) {throw error;}

      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id === id ? { ...task, priority } : task))
      );
      toast({ title: "Priority Updated" });
    } catch (error) {
      console.error("Error updating task priority:", error);
      toast({ title: "Update Error", description: "Could not update priority.", variant: "destructive" });
      await loadTasksFromSupabase(); // Refetch on error
    }
  }, [toast, user, loadTasksFromSupabase, tasks]); 

  const handleSetTasks = useCallback(async (newTasks: Task[]) => {
    if (!user) return;
    
    const tasksToSaveForOrder = newTasks.map((task, index) => ({
      id: task.id, // Only id and orderIndex needed for saveTaskOrderToSupabase
      orderIndex: index,
    }));
    
    setTasks(newTasks); // Optimistic update for UI responsiveness during drag
    try {
      await saveTaskOrderToSupabase(tasksToSaveForOrder);
      // No explicit loadTasksFromSupabase needed here if optimistic update is sufficient
      // and saveTaskOrderToSupabase doesn't fail often. 
      // For ultimate consistency, uncomment below:
      // await loadTasksFromSupabase(); 
    } catch (error) {
        // If save failed, local state might be out of sync. Reload.
        toast({ title: "Reorder Error", description: "Could not save new task order. Reverting.", variant: "destructive" });
        await loadTasksFromSupabase();
    }
  }, [saveTaskOrderToSupabase, user, loadTasksFromSupabase, toast]);

  const handleSmartSchedule = async () => {
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
        })),
      };
      const result: TaskListOutput = await suggestOptimalTaskOrder(inputForAI);

      const taskOrderUpdates = result.orderedTasks.map((aiTask, index) => ({
        id: aiTask.id,
        orderIndex: index,
      }));

      await saveTaskOrderToSupabase(taskOrderUpdates);
      await loadTasksFromSupabase(); // Refetch to get the newly ordered tasks

      toast({
        title: "Schedule Optimized!",
        description: result.reasoning || "Tasks have been reordered for optimal flow.",
        duration: 7000,
      });
    } catch (error) {
      console.error("Error during smart scheduling with Supabase:", error);
      toast({
        title: "Scheduling Error",
        description: "Could not optimize the schedule. Please try again.",
        variant: "destructive",
      });
       await loadTasksFromSupabase(); // Ensure consistent state on error
    } finally {
      setIsScheduling(false);
    }
  };

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
          onAddTask={handleAddTask}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-8">
          <div className="sm:col-span-2">
            <TaskList
              tasks={tasks}
              setTasks={handleSetTasks}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTask}
              onPriorityChange={handlePriorityChange}
            />
          </div>
          <div className="sm:col-span-1">
            <ProgressIndicator tasks={tasks} />
          </div>
        </div>
      </main>
      <footer className="text-center py-6 text-sm text-muted-foreground border-t mt-auto">
        <p>&copy; {new Date().getFullYear()} Day Architect. Plan your success.</p>
      </footer>
    </div>
  );
}
