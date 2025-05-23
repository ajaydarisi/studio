
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task, TaskPriority } from "@/types";
import { suggestOptimalTaskOrder, type TaskListInput, type TaskListOutput } from "@/ai/flows/suggest-optimal-task-order";
import AppHeader from "@/components/AppHeader";
import TaskList from "@/components/TaskList";
import ProgressIndicator from "@/components/ProgressIndicator";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { useAuth } from "@/contexts/AuthContext"; // Import useAuth
import { useRouter } from "next/navigation"; // Import useRouter

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
  const [isLoadingData, setIsLoadingData] = useState(true); // Renamed from isLoading to avoid conflict with authLoading
  const [isScheduling, setIsScheduling] = useState(false);
  const { toast } = useToast();
  const { session, user, isLoading: authLoading } = useAuth(); // Get auth state
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Effect for redirecting if not authenticated
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
      setTasks([]); // Clear tasks if no user
      return;
    }
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase
        .from(TASKS_TABLE)
        .select('*')
        .eq('user_id', user.id) // Filter by user_id
        .order('orderIndex', { ascending: true });

      if (error) throw error;

      let fetchedTasks: Task[] = data ? data.map(mapSupabaseRowToTask) : [];

      if (fetchedTasks.length === 0 && initialTasksSeed.length > 0 && user?.id) { // Ensure user.id for seeding
        const tasksToSeed = initialTasksSeed.map((taskSeed, index) => ({
          user_id: user.id, // Associate with current user
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

      if (supabaseUrl && supabaseUrl !== 'your_supabase_url_here' && supabaseAnonKey && supabaseAnonKey !== 'your_supabase_anon_key_here') {
          loadTasksFromSupabase();
      } else {
          console.warn("Supabase URL or Anon Key is not configured correctly.");
          toast({ title: "Supabase Not Configured", description: "Please check your Supabase credentials in .env.", variant: "destructive", duration: 10000});
          setIsLoadingData(false);
      }
    } else if (!authLoading && !session && isClient) {
        setIsLoadingData(false);
        setTasks([]);
    }
  }, [session, user, authLoading, loadTasksFromSupabase, toast, isClient]);


  const saveTaskOrderToSupabase = useCallback(async (tasksToSave: Task[]) => {
    if (!user) return;
    setIsLoadingData(true);
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
      setTasks(tasksToSave); // Optimistically update local state or confirm based on results
      // toast({ title: "Tasks Order Saved", description: "Your task order has been saved." }); // Consider if this toast is too frequent
    } catch (error) {
      console.error("Error saving task order to Supabase:", error);
      toast({ title: "Save Order Error", description: "Could not save task order.", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [toast, user]);


  const handleAddTask = useCallback(async (description: string, estimatedTime: number) => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to add tasks.", variant: "destructive" });
      return;
    }
    setIsLoadingData(true);
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
    } catch (error: any) { // Type assertion to access potential Supabase error properties
      console.error("Error adding task to Supabase:", error);
      let errorMessage = "Could not add task.";
      if (error && error.message) {
        errorMessage = error.message;
      }
      // You can also add more details from the error object if available and helpful
      // if (error && error.details) errorMessage += ` Details: ${error.details}`;
      // if (error && error.hint) errorMessage += ` Hint: ${error.hint}`;
      toast({ title: "Add Task Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoadingData(false);
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
    }
  }, [tasks, toast, user]);

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!user) return;
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    setIsLoadingData(true);
    try {
      const { error: deleteError } = await supabase
        .from(TASKS_TABLE)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (deleteError) throw deleteError;

      const remainingTasks = tasks.filter((task) => task.id !== id);
      const reorderedTasks = remainingTasks.map((task, index) => ({ ...task, orderIndex: index }));

      if (reorderedTasks.length > 0) {
        const updates = reorderedTasks.map(task =>
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
      }

      setTasks(reorderedTasks);
      toast({ title: "Task Deleted", description: `"${taskToDelete.description}" has been removed.`, variant: "destructive" });
    } catch (error) {
      console.error("Error deleting task from Supabase:", error);
      toast({ title: "Delete Error", description: "Could not delete task.", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [tasks, toast, user]);

  const handlePriorityChange = useCallback(async (id: string, priority: TaskPriority) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from(TASKS_TABLE)
        .update({ priority: priority })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) {throw error;} // Corrected missing brace

      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id === id ? { ...task, priority } : task))
      );
      toast({ title: "Priority Updated" });
    } catch (error) {
      console.error("Error updating task priority:", error);
      toast({ title: "Update Error", description: "Could not update priority.", variant: "destructive" });
    }
  }, [toast, user, tasks]);

  const handleSetTasks = useCallback(async (newTasks: Task[]) => {
    if (!user) return;
    const tasksToSave = newTasks.map((task, index) => ({
      ...task,
      orderIndex: index,
    }));
    setTasks(tasksToSave);
    await saveTaskOrderToSupabase(tasksToSave);
  }, [saveTaskOrderToSupabase, user]);

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

      const newOrderedTasksFromAI = result.orderedTasks.map((aiTask, index) => {
        const originalTask = tasks.find(t => t.id === aiTask.id);
        return {
          ...originalTask!,
          ...aiTask,
          userId: user.id,
          orderIndex: index,
          createdAt: originalTask?.createdAt || Date.now(),
        };
      });

      await saveTaskOrderToSupabase(newOrderedTasksFromAI);

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
    } finally {
      setIsScheduling(false);
    }
  };

  if (authLoading || (!session && isClient)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground">{authLoading ? "Authenticating..." : "Redirecting..."}</p>
      </div>
    );
  }

  if (isLoadingData && session && user) { // Ensure user is also checked here
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
