
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { Task, TaskPriority } from "@/types";
import { suggestOptimalTaskOrder, type TaskListInput, type TaskListOutput } from "@/ai/flows/suggest-optimal-task-order";
import AppHeader from "@/components/AppHeader";
import TaskList from "@/components/TaskList";
import ProgressIndicator from "@/components/ProgressIndicator";
import TaskForm from "@/components/TaskForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, PlusCircle, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { format, parseISO, isValid as isValidDate, startOfDay, addDays, isSameDay, isPast, isToday, startOfToday } from "date-fns";


const TASKS_TABLE = "tasks";

const mapSupabaseRowToTask = (row: any): Task => {
  let parsedDueDate: Date;

  if (row.dueDate && typeof row.dueDate === 'string') {
    let dateCandidate = parseISO(row.dueDate);
    if (isValidDate(dateCandidate)) {
        // Check if it's just a date string "YYYY-MM-DD"
        if (row.dueDate.length === 10) { 
             // Parse as local date then treat as start of day UTC for consistency
             const [year, month, day] = row.dueDate.split('-').map(Number);
             parsedDueDate = new Date(year, month - 1, day); // Local time, midnight
        } else { // Assume it's a full ISO string
            parsedDueDate = dateCandidate; // Already UTC
        }
    } else {
      console.warn(`[mapSupabaseRowToTask] Unparseable ISO date string for dueDate from Supabase: ${row.dueDate}. Defaulting to today.`);
      parsedDueDate = startOfToday(); // Default to start of today UTC
    }
  } else if (row.dueDate instanceof Date) {
    parsedDueDate = row.dueDate; // Already a Date object
  } else {
    console.warn(`[mapSupabaseRowToTask] dueDate is not a string or Date from Supabase for task ID ${row.id}: ${row.dueDate}. Defaulting to today.`);
    parsedDueDate = startOfToday(); // Default to start of today UTC
  }

  let isTaskCompleted: boolean;
  if (typeof row.completed === 'boolean') {
    isTaskCompleted = row.completed;
  } else if (typeof row.completed === 'string') {
    isTaskCompleted = row.completed.toLowerCase() === 'true';
  } else if (typeof row.completed === 'number') {
    isTaskCompleted = row.completed === 1;
  } else {
    // Handles null, undefined, or any other type by defaulting to false
    isTaskCompleted = false; 
  }
  console.log(`[mapSupabaseRowToTask] Task ID: ${row.id}, Raw row.completed: "${row.completed}" (type: ${typeof row.completed}), Mapped completed: ${isTaskCompleted}`);


  return {
    id: row.id,
    userId: row.user_id,
    description: row.description,
    estimatedCompletionTime: Number(row.estimatedCompletionTime) || 0,
    priority: row.priority as TaskPriority, // Keep for AI/backend
    completed: isTaskCompleted,
    createdAt: row.createdAt ? parseISO(row.createdAt).getTime() : Date.now(),
    orderIndex: row.orderIndex,
    dueDate: startOfDay(parsedDueDate), // Ensure it's always start of day, UTC
  };
};


const initialTasksSeed: Omit<Task, 'id' | 'createdAt' | 'userId'>[] = [
  { description: "Morning workout session", estimatedCompletionTime: 45, priority: 'high', completed: true, orderIndex: 0, dueDate: startOfDay(new Date()) },
  { description: "Respond to urgent emails", estimatedCompletionTime: 60, priority: 'high', completed: false, orderIndex: 1, dueDate: startOfDay(addDays(new Date(), 1)) },
  { description: "Draft project proposal", estimatedCompletionTime: 120, priority: 'high', completed: false, orderIndex: 2, dueDate: startOfDay(addDays(new Date(), 2)) },
  { description: "Grocery shopping", estimatedCompletionTime: 75, priority: 'low', completed: false, orderIndex: 3, dueDate: startOfDay(addDays(new Date(), 5)) },
];

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true); // For initial load and major refetches
  const [isScheduling, setIsScheduling] = useState(false); // For Smart Schedule button
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { toast } = useToast();
  const { session, user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Moved useMemo for formInitialValues before any early returns
  const formInitialValues = useMemo(() => {
    if (dialogMode === 'edit' && editingTask) {
      console.log("[HomePage useMemo] Creating initialValues for EDIT mode:", editingTask);
      return {
        description: editingTask.description,
        estimatedCompletionTime: editingTask.estimatedCompletionTime,
        // Ensure dueDate is a valid Date object. editingTask.dueDate is already a Date.
        dueDate: editingTask.dueDate instanceof Date ? editingTask.dueDate : startOfDay(new Date(editingTask.dueDate)),
      };
    }
    console.log("[HomePage useMemo] Creating initialValues for ADD mode (default).");
    return {
        description: "",
        estimatedCompletionTime: 30,
        dueDate: new Date(), // Default to today for new tasks as it's required
    };
  }, [dialogMode, editingTask]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!authLoading && !session && isClient) {
      // Avoid redirecting if already on login/signup to prevent loops
      if (router.pathname !== '/login' && router.pathname !== '/signup') {
        router.push('/login');
      }
    }
  }, [authLoading, session, router, isClient]); // Added router to dependencies

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
        .eq('user_id', user.id)
        .order('orderIndex', { ascending: true });

      if (error) throw error;

      let fetchedTasks: Task[] = data ? data.map(mapSupabaseRowToTask) : [];
      
      // Seed initial tasks if none exist for the user
      if (fetchedTasks.length === 0 && initialTasksSeed.length > 0 && user?.id) {
        const tasksToSeed = initialTasksSeed.map((taskSeed, index) => ({
          user_id: user.id,
          description: taskSeed.description,
          estimatedCompletionTime: taskSeed.estimatedCompletionTime,
          priority: taskSeed.priority,
          completed: taskSeed.completed, // This 'completed' comes from `initialTasksSeed`
          orderIndex: index,
          // Format dueDate to "yyyy-MM-dd" for Supabase 'date' column
          dueDate: format(taskSeed.dueDate instanceof Date ? taskSeed.dueDate : new Date(taskSeed.dueDate), "yyyy-MM-dd"),
        }));

        const { error: insertError } = await supabase.from(TASKS_TABLE).insert(tasksToSeed);
        if (insertError) throw insertError;

        // Fetch again after seeding
        const { data: seededData, error: fetchSeededError } = await supabase
          .from(TASKS_TABLE)
          .select('*')
          .eq('user_id', user.id)
          .order('orderIndex', { ascending: true });
        if (fetchSeededError) throw fetchSeededError;
        fetchedTasks = seededData ? seededData.map(mapSupabaseRowToTask) : [];
        toast({ title: "Welcome!", description: "Sample tasks loaded." });
      }
      console.log('[loadTasksFromSupabase] Tasks to be set in state:', fetchedTasks.map(t => ({id: t.id, completed: t.completed, description: t.description.substring(0,15) })));
      setTasks(fetchedTasks);
    } catch (error: any) {
      console.error("Error loading tasks from Supabase:", error);
      toast({ title: "Error", description: `Could not load tasks: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [toast, user]); // Removed `tasks` from dependencies to avoid potential loops

  useEffect(() => {
    if (session && user && isClient) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Check if Supabase is configured (not placeholder or empty)
      if (supabaseUrl && supabaseUrl !== 'your_supabase_url_here' && supabaseUrl !== '' && 
          supabaseAnonKey && supabaseAnonKey !== 'your_supabase_anon_key_here' && supabaseAnonKey !== '') {
          loadTasksFromSupabase();
      } else {
          console.warn("Supabase URL or Anon Key is not configured correctly or is a placeholder. Cannot load tasks.");
          toast({ title: "Supabase Not Configured", description: "Please check your Supabase credentials in .env and restart the server.", variant: "destructive", duration: 10000});
          setIsLoadingData(false); // Ensure loading stops
      }
    } else if (!authLoading && !session && isClient) {
        // No session, not authenticating, client-side: stop loading, clear tasks
        setIsLoadingData(false);
        setTasks([]); // Clear tasks for non-logged-in users
    }
    // Dependency on `session`, `user`, `authLoading`, `isClient` ensures this runs when auth state changes or client mounts
  }, [session, user, authLoading, loadTasksFromSupabase, toast, isClient]);

  // Saves only the order of tasks
  const saveTaskOrderToSupabase = useCallback(async (tasksToSave: Pick<Task, 'id' | 'orderIndex'>[]) => {
    if (!user) return;
    try {
      const updates = tasksToSave.map(task =>
        supabase
          .from(TASKS_TABLE)
          .update({ orderIndex: task.orderIndex })
          .eq('id', task.id)
          .eq('user_id', user.id) // Ensure user can only update their own tasks
      );
      const results = await Promise.all(updates);
      results.forEach(result => {
        if (result.error) throw result.error;
      });
      // Do not call loadTasksFromSupabase here; let the caller decide if a full refetch is needed
    } catch (error: any) {
      console.error("Error saving task order to Supabase:", error);
      toast({ title: "Save Order Error", description: `Could not save task order: ${error.message}`, variant: "destructive" });
      throw error; // Re-throw to allow caller to handle (e.g., revert optimistic UI)
    }
  }, [toast, user]);

  const handleActualAddTask = useCallback(async (description: string, estimatedTime: number, dueDate: Date): Promise<void> => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to add tasks.", variant: "destructive" });
      return Promise.reject(new Error("User not authenticated"));
    }
   
    const newTaskData = {
      user_id: user.id,
      description,
      estimatedCompletionTime: estimatedTime,
      priority: 'medium' as TaskPriority, // Default priority
      completed: false,
      orderIndex: tasks.length, // Add to the end
      dueDate: format(startOfDay(dueDate), "yyyy-MM-dd"), // Format for Supabase 'date' column
    };

    try {
      // Insert and immediately select the new task to get its generated ID and createdAt
      const { data: insertedTaskResult, error } = await supabase
        .from(TASKS_TABLE)
        .insert(newTaskData)
        .select() // Select all columns of the inserted row
        .single(); // Expect a single row

      if (error) throw error;
      if (!insertedTaskResult) throw new Error("Failed to retrieve inserted task data.");
      
      // Instead of full reload, map and add the new task to local state (more optimistic)
      // const newTask = mapSupabaseRowToTask(insertedTaskResult);
      // setTasks((prevTasks) => [...prevTasks, newTask]); 
      // For now, let's rely on loadTasksFromSupabase for simplicity and consistency
      await loadTasksFromSupabase(); 
      toast({ title: "Task Added", description: `"${description}" has been added.` });
      
    } catch (error: any) {
      console.error("Error adding task to Supabase:", error);
      toast({ title: "Add Task Error", description: error.message || "Could not add task.", variant: "destructive" });
      await loadTasksFromSupabase(); // Ensure UI consistency on error
      return Promise.reject(error); // Propagate error for TaskForm to handle its loading state
    }
  }, [tasks.length, toast, loadTasksFromSupabase, user]);

  const handleActualUpdateTask = useCallback(async (taskId: string, description: string, estimatedTime: number, dueDate: Date): Promise<void> => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to update tasks.", variant: "destructive" });
      return Promise.reject(new Error("User not authenticated"));
    }
    
    const updatedTaskData = {
      description,
      estimatedCompletionTime: estimatedTime,
      dueDate: format(startOfDay(dueDate), "yyyy-MM-dd"), // Format for Supabase 'date' column
    };

    try {
      const { error } = await supabase
        .from(TASKS_TABLE)
        .update(updatedTaskData)
        .eq('id', taskId)
        .eq('user_id', user.id) // Ensure user can only update their own tasks
        .select() // Select to confirm update (optional, but good practice)
        .single(); // Expect a single row
      
      if (error) throw error;

      // const updatedTask = mapSupabaseRowToTask(data);
      // setTasks((prevTasks) => prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t));
      // For now, let's rely on loadTasksFromSupabase for simplicity and consistency
      await loadTasksFromSupabase(); 
      toast({ title: "Task Updated", description: `"${description}" has been updated.` });
      
    } catch (error: any) {
      console.error("Error updating task in Supabase:", error);
      toast({ title: "Update Task Error", description: error.message || "Could not update task.", variant: "destructive" });
      await loadTasksFromSupabase(); // Ensure UI consistency on error
      return Promise.reject(error); // Propagate error
    }
  }, [toast, user, loadTasksFromSupabase]);

  const handleDialogSubmit = useCallback(async (description: string, estimatedTime: number, dueDate: Date | null | undefined) => {
    // dueDate is now required by TaskForm and schema, so direct use is fine.
    if (!dueDate) { // Should not happen if form validation works, but as a safeguard
        toast({ title: "Due Date Required", description: "Please select a due date.", variant: "destructive" });
        return Promise.reject(new Error("Due date required"));
    }
    try {
      if (dialogMode === 'add') {
        await handleActualAddTask(description, estimatedTime, dueDate);
      } else if (dialogMode === 'edit' && editingTask) {
        await handleActualUpdateTask(editingTask.id, description, estimatedTime, dueDate);
      }
      setIsDialogOpen(false); // Close dialog on success
      setEditingTask(null); // Clear editing task
    } catch (error) {
      // Errors are toasted within handleActualAddTask/UpdateTask
      // The TaskForm's internal loading state will be reset by its own logic.
      // We don't close the dialog on error here, to let user correct.
      console.error("Dialog submit error:", error);
      // Do not re-throw here, as it's handled by TaskForm already
    }
  }, [dialogMode, editingTask, handleActualAddTask, handleActualUpdateTask, toast, setIsDialogOpen, setEditingTask]);

  const handleOpenAddTaskDialog = useCallback(() => {
    setDialogMode('add');
    setEditingTask(null); // Important to clear any previous editing task
    setIsDialogOpen(true);
  }, [setDialogMode, setEditingTask, setIsDialogOpen]); // Dependencies are stable setters

  const handleOpenEditDialog = useCallback((taskToEdit: Task) => {
    setDialogMode('edit');
    setEditingTask({...taskToEdit}); // Spread to ensure a new object for editingTask state
    setIsDialogOpen(true);
  }, [setDialogMode, setEditingTask, setIsDialogOpen]); // Dependencies are stable setters


  const handleToggleComplete = useCallback(async (id: string) => {
    if (!user) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const newCompletedStatus = !task.completed;
    console.log(`[handleToggleComplete] Task ID: ${id}, Current completed: ${task.completed}, New status: ${newCompletedStatus}`);
    
    // No optimistic UI update for 'completed' status here; rely on refetch
    // const originalTasks = [...tasks]; 
    // setTasks((prevTasks) => 
    //   prevTasks.map((t) => (t.id === id ? { ...t, completed: newCompletedStatus } : t))
    // );

    try {
      const { error } = await supabase
        .from(TASKS_TABLE)
        .update({ completed: newCompletedStatus }) // newCompletedStatus is a boolean
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) {
        // If optimistic update was used, it would be reverted here: setTasks(originalTasks);
        toast({ title: "Update Error", description: `Could not update task: ${error.message}. Reverting.`, variant: "destructive" });
        throw error; // This throw will be caught by the outer catch block
      }
      toast({ title: "Task Updated" });
      await loadTasksFromSupabase(); // Refetch from Supabase to ensure consistency
    } catch (error: any) {
      console.error("Error updating task completion in Supabase:", error);
      // Ensure UI consistency by refetching even on caught error
      await loadTasksFromSupabase(); 
    }
  }, [tasks, toast, user, loadTasksFromSupabase]); // `tasks` is needed to find the task, `loadTasksFromSupabase` for refetch

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!user) return;
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;
    
    // No optimistic UI update for deletion here; rely on refetch
    // const originalTasks = [...tasks];
    // setTasks(prevTasks => prevTasks.filter(t => t.id !== id));

    try {
      const { error: deleteError } = await supabase
        .from(TASKS_TABLE)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // Ensure user can only delete their own tasks
      if (deleteError) throw deleteError; 
      
      // No need to recalculate orderIndex here for other tasks.
      // The order is maintained on load. If a full re-order is needed, it's a separate feature.
      await loadTasksFromSupabase(); // Refetch to get the updated list
      toast({ title: "Task Deleted", description: `"${taskToDelete.description}" has been removed.`, variant: "destructive" });
    } catch (error: any) {
      console.error("Error deleting task from Supabase:", error);
      toast({ title: "Delete Error", description: `Could not delete task: ${error.message}. Reverting.`, variant: "destructive" });
      // Revert optimistic update by re-fetching all tasks
      await loadTasksFromSupabase(); // Ensure UI consistency
    }
  }, [tasks, toast, user, loadTasksFromSupabase]); // `tasks` is needed to find taskToDelete, `loadTasksFromSupabase` for refetch


  // This function is for drag-and-drop reordering
  const handleSetTasks = useCallback(async (newTasks: Task[]) => {
    if (!user) return;
    // Optimistically update the UI
    setTasks(newTasks);

    const tasksToSaveForOrder = newTasks.map((task, index) => ({
      id: task.id,
      orderIndex: index,
    }));

    try {
      await saveTaskOrderToSupabase(tasksToSaveForOrder);
      // After saving order, refetch to ensure data is fully consistent
      // This might seem redundant if saveTaskOrderToSupabase worked perfectly,
      // but it ensures UI reflects the absolute source of truth.
      await loadTasksFromSupabase(); 
    } catch (error: any) {
        // Error is already toasted in saveTaskOrderToSupabase
        // Revert optimistic update by refetching from Supabase
        toast({ title: "Reorder Failed", description: "Could not save new task order. Reverting.", variant: "destructive"});
        await loadTasksFromSupabase(); // Load original order
    }
  }, [saveTaskOrderToSupabase, user, loadTasksFromSupabase, setTasks]); // setTasks for optimistic update

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
          priority: task.priority, // Keep for AI
          dueDate: task.dueDate.toISOString(), // Ensure ISO string for AI
        })),
      };
      const result: TaskListOutput = await suggestOptimalTaskOrder(inputForAI);

      // Create an array of updates for Supabase based on AI's order
      const taskOrderUpdates = result.orderedTasks.map((aiTask, index) => ({
        id: aiTask.id,
        orderIndex: index,
      }));

      await saveTaskOrderToSupabase(taskOrderUpdates); // Save the new order
      await loadTasksFromSupabase(); // Refetch the reordered tasks

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
       // Ensure UI is consistent with the database state before the error
       await loadTasksFromSupabase(); 
    } finally {
      setIsScheduling(false);
    }
  }, [user, tasks, toast, saveTaskOrderToSupabase, loadTasksFromSupabase, setIsScheduling]); // `tasks` for input to AI, `loadTasksFromSupabase` for refetch

  // Loading state for initial page load or when auth status is undetermined
  if (authLoading || isLoadingData && (!session || !user) && isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-foreground ml-2">
          {authLoading ? "Authenticating..." : "Loading tasks..."}
        </p>
      </div>
    );
  }
  
  // If not authenticated and done loading auth state, redirect is handled by useEffect
  // This specific block might be redundant if the useEffect for redirection is robust
  if (!authLoading && !session && isClient && router.pathname !== '/login' && router.pathname !== '/signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-foreground ml-2">Redirecting to login...</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 max-w-4xl flex-grow">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="sm:col-span-2">
            <TaskList
              tasks={tasks}
              setTasks={handleSetTasks} // For drag-and-drop
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTask}
              onEditTask={handleOpenEditDialog} // Prop for edit
            />
          </div>
          <div className="sm:col-span-1 flex flex-col">
            {user && ( // Only show these buttons if user is logged in
              <div className="mb-6 flex flex-col sm:flex-col gap-2 w-full"> 
                <Button onClick={handleOpenAddTaskDialog} variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow w-full">
                  <PlusCircle className="mr-2 h-5 w-5 text-accent" />
                  Add New Task
                </Button>
                <Button onClick={handleSmartSchedule} disabled={isScheduling || tasks.length === 0} variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow w-full">
                  <Sparkles className={`mr-2 h-5 w-5 ${isScheduling ? 'animate-spin text-primary' : 'text-accent'}`} />
                  {isScheduling ? "Optimizing..." : "Smart Schedule"}
                </Button>
              </div>
            )}
            <ProgressIndicator tasks={tasks} />
            {/* Mobile-only Smart Schedule button, if needed */}
            {user && ( 
              <Button 
                onClick={handleSmartSchedule} 
                disabled={isScheduling || tasks.length === 0} 
                variant="outline" 
                size="lg" 
                className="mt-4 shadow-sm hover:shadow-md transition-shadow w-full sm:hidden" 
              >
                <Sparkles className={`mr-2 h-5 w-5 ${isScheduling ? 'animate-spin text-primary' : 'text-accent'}`} />
                {isScheduling ? "Optimizing..." : "Smart Schedule"}
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Floating Action Button for Add Task - Mobile Only */}
      {user && ( // Only show FAB if user is logged in
        <Button
          className="sm:hidden fixed bottom-20 right-6 rounded-full h-16 w-16 shadow-xl z-50 flex items-center justify-center text-primary-foreground hover:text-primary-foreground bg-primary hover:bg-primary/90"
          variant={"default"} // explicit default, could be omitted
          size="icon"
          onClick={handleOpenAddTaskDialog}
          aria-label="Add New Task"
        >
          <Plus className="h-8 w-8" />
        </Button>
      )}

      {/* Dialog for Add/Edit Task */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
            // Reset state when dialog is closed, regardless of how
            setEditingTask(null); 
            setDialogMode('add'); // Default back to 'add' mode
        }
      }}>
        <DialogContent 
          className="top-0 translate-y-0 data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top sm:top-[50%] sm:translate-y-[-50%] sm:data-[state=open]:slide-in-from-top-[48%] sm:data-[state=closed]:slide-out-to-top-[48%] sm:max-w-[425px]"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <PlusCircle className="mr-2 h-6 w-6 text-accent" />
              {dialogMode === 'add' ? 'Add New Task' : 'Edit Task'}
            </DialogTitle>
          </DialogHeader>
          <TaskForm 
            onSubmit={handleDialogSubmit} 
            // Key forces re-mount of TaskForm when switching between add/edit or editing different tasks
            // This ensures react-hook-form re-initializes with new defaultValues correctly.
            key={dialogMode === 'edit' && editingTask ? editingTask.id : 'add-task-form'}
            initialValues={formInitialValues} 
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

    
