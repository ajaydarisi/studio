
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
        if (row.dueDate.length === 10) { // Handles "YYYY-MM-DD" format by ensuring it's treated as start of day in local timezone context by Date constructor
             const [year, month, day] = row.dueDate.split('-').map(Number);
             parsedDueDate = new Date(year, month - 1, day);
        } else { // Assumes ISO 8601 with time/timezone
            parsedDueDate = dateCandidate;
        }
    } else {
      console.warn(`Unparseable ISO date string for dueDate from Supabase: ${row.dueDate}. Defaulting to today.`);
      parsedDueDate = startOfToday();
    }
  } else if (row.dueDate instanceof Date) {
    parsedDueDate = row.dueDate;
  } else {
    console.warn(`dueDate is not a string or Date from Supabase for task ID ${row.id}: ${row.dueDate}. Defaulting to today.`);
    parsedDueDate = startOfToday();
  }

  let isTaskCompleted: boolean;
  if (typeof row.completed === 'boolean') {
    isTaskCompleted = row.completed;
  } else if (typeof row.completed === 'string') {
    isTaskCompleted = row.completed.toLowerCase() === 'true';
  } else if (typeof row.completed === 'number') {
    isTaskCompleted = row.completed === 1;
  } else {
    isTaskCompleted = false; // Default to false if type is unexpected or null/undefined
  }
  console.log(`[mapSupabaseRowToTask] Task ID: ${row.id}, Raw row.completed: "${row.completed}" (type: ${typeof row.completed}), Mapped completed: ${isTaskCompleted}`);

  return {
    id: row.id,
    userId: row.user_id,
    description: row.description,
    estimatedCompletionTime: Number(row.estimatedCompletionTime) || 0,
    priority: row.priority as TaskPriority,
    completed: isTaskCompleted,
    createdAt: row.createdAt ? parseISO(row.createdAt).getTime() : Date.now(),
    orderIndex: row.orderIndex,
    dueDate: startOfDay(parsedDueDate),
  };
};


const initialTasksSeed: Omit<Task, 'id' | 'createdAt' | 'userId'>[] = [
  { description: "Morning workout session", estimatedCompletionTime: 45, priority: 'medium', completed: true, orderIndex: 0, dueDate: startOfDay(new Date()) },
  { description: "Respond to urgent emails", estimatedCompletionTime: 60, priority: 'high', completed: false, orderIndex: 1, dueDate: startOfDay(addDays(new Date(), 1)) },
  { description: "Draft project proposal", estimatedCompletionTime: 120, priority: 'high', completed: false, orderIndex: 2, dueDate: startOfDay(addDays(new Date(), 2)) },
  { description: "Grocery shopping", estimatedCompletionTime: 75, priority: 'low', completed: false, orderIndex: 3, dueDate: startOfDay(addDays(new Date(), 5)) },
];

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

  const formInitialValues = useMemo(() => {
    if (dialogMode === 'edit' && editingTask) {
      // console.log("MEMO: Creating initialValues for EDIT mode:", editingTask);
      return {
        description: editingTask.description,
        estimatedCompletionTime: editingTask.estimatedCompletionTime,
        dueDate: editingTask.dueDate instanceof Date ? editingTask.dueDate : startOfDay(new Date(editingTask.dueDate)),
      };
    }
    // console.log("MEMO: Creating initialValues for ADD mode (default).");
    return {
        description: "",
        estimatedCompletionTime: 30,
        dueDate: new Date(), // Due date is required
    };
  }, [dialogMode, editingTask]);


  useEffect(() => {
    if (!authLoading && !session && isClient) {
      if (router.pathname !== '/login' && router.pathname !== '/signup') {
        router.push('/login');
      }
    }
  }, [authLoading, session, router, isClient]); 

  const loadTasksFromSupabase = useCallback(async () => {
    if (!user) {
      setIsLoadingData(false);
      setTasks([]); // Clear tasks if no user
      return;
    }
    // console.log("loadTasksFromSupabase called for user:", user.id);
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase
        .from(TASKS_TABLE)
        .select('*')
        .eq('user_id', user.id)
        .order('orderIndex', { ascending: true });

      if (error) throw error;

      let fetchedTasks: Task[] = data ? data.map(mapSupabaseRowToTask) : [];
      // console.log("Fetched tasks from Supabase:", fetchedTasks);
      
      if (fetchedTasks.length === 0 && initialTasksSeed.length > 0 && user?.id) {
        // console.log("No tasks found, seeding initial tasks for user:", user.id);
        const tasksToSeed = initialTasksSeed.map((taskSeed, index) => ({
          user_id: user.id,
          description: taskSeed.description,
          estimatedCompletionTime: taskSeed.estimatedCompletionTime,
          priority: taskSeed.priority,
          completed: taskSeed.completed,
          orderIndex: index,
          dueDate: format(taskSeed.dueDate instanceof Date ? taskSeed.dueDate : new Date(taskSeed.dueDate), "yyyy-MM-dd"), // Ensure dueDate is formatted as YYYY-MM-DD
        }));

        const { error: insertError } = await supabase.from(TASKS_TABLE).insert(tasksToSeed);
        if (insertError) throw insertError;
        // console.log("Initial tasks seeded successfully.");

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
      // console.log("Finished loading tasks. isLoadingData set to false.");
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
        setTasks([]); // Clear tasks if not authenticated
    }
  }, [session, user, authLoading, loadTasksFromSupabase, toast, isClient]);

  const saveTaskOrderToSupabase = useCallback(async (tasksToSave: Pick<Task, 'id' | 'orderIndex'>[]) => {
    if (!user) return;
    try {
      // console.log("Saving task order to Supabase:", tasksToSave);
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
      // console.log("Task order saved successfully.");
    } catch (error: any) {
      console.error("Error saving task order to Supabase:", error);
      toast({ title: "Save Order Error", description: `Could not save task order: ${error.message}`, variant: "destructive" });
      // Re-fetch to ensure UI consistency if order save fails
      // await loadTasksFromSupabase(); // Potentially revert or show error
      throw error; // Re-throw to be caught by calling function if needed
    }
  }, [toast, user]);

  const handleActualAddTask = useCallback(async (description: string, estimatedTime: number, dueDate: Date): Promise<void> => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to add tasks.", variant: "destructive" });
      return Promise.reject(new Error("User not authenticated"));
    }
   
    // Due date is now required, ensure it's formatted correctly for DB
    const newTaskData = {
      user_id: user.id,
      description,
      estimatedCompletionTime: estimatedTime,
      priority: 'medium' as TaskPriority, // Default priority
      completed: false,
      orderIndex: tasks.length, // Append to end of list
      dueDate: format(startOfDay(dueDate), "yyyy-MM-dd"), // Store as YYYY-MM-dd string
    };

    // console.log("Attempting to add new task to Supabase:", newTaskData);
    try {
      const { data: insertedTaskResult, error } = await supabase
        .from(TASKS_TABLE)
        .insert(newTaskData)
        .select() // Select the inserted row to get its generated ID and createdAt
        .single(); // Expecting a single row back

      if (error) throw error;
      if (!insertedTaskResult) throw new Error("Failed to retrieve inserted task data.");
      
      // Instead of full reload, optimistically add the new task to local state
      // The new task needs to be mapped correctly, similar to mapSupabaseRowToTask
      // However, for simplicity and consistency, a targeted reload or more complex state update is needed.
      // For now, we will reload all tasks to ensure createdAt and other defaults are accurate.
      await loadTasksFromSupabase(); // Re-fetch tasks to include the new one with server-generated values
      toast({ title: "Task Added", description: `"${description}" has been added.` });
      
    } catch (error: any) {
      console.error("Error adding task to Supabase:", error);
      toast({ title: "Add Task Error", description: error.message || "Could not add task.", variant: "destructive" });
      await loadTasksFromSupabase(); // Ensure UI consistency even on error
      return Promise.reject(error); // Propagate error
    }
  }, [tasks.length, toast, loadTasksFromSupabase, user]); // tasks.length is needed for orderIndex

  const handleActualUpdateTask = useCallback(async (taskId: string, description: string, estimatedTime: number, dueDate: Date): Promise<void> => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to update tasks.", variant: "destructive" });
      return Promise.reject(new Error("User not authenticated"));
    }
    
    // Due date is now required, ensure it's formatted correctly for DB
    const updatedTaskData = {
      description,
      estimatedCompletionTime: estimatedTime,
      dueDate: format(startOfDay(dueDate), "yyyy-MM-dd"), // Store as YYYY-MM-dd string
    };

    // console.log(`Attempting to update task ID ${taskId} in Supabase:`, updatedTaskData);
    try {
      const { error } = await supabase
        .from(TASKS_TABLE)
        .update(updatedTaskData)
        .eq('id', taskId)
        .eq('user_id', user.id) // Ensure user can only update their own tasks
        .select() // Select the updated row to confirm changes (optional)
        .single(); // Expecting a single row back
      
      if (error) throw error;

      // Optimistic update could be done here, but re-fetching ensures consistency
      await loadTasksFromSupabase(); // Re-fetch tasks to reflect updates
      toast({ title: "Task Updated", description: `"${description}" has been updated.` });
      
    } catch (error: any) {
      console.error("Error updating task in Supabase:", error);
      toast({ title: "Update Task Error", description: error.message || "Could not update task.", variant: "destructive" });
      await loadTasksFromSupabase(); // Ensure UI consistency even on error
      return Promise.reject(error); // Propagate error
    }
  }, [toast, user, loadTasksFromSupabase]);

  const handleDialogSubmit = useCallback(async (description: string, estimatedTime: number, dueDate: Date | null | undefined) => {
    if (!dueDate) { // Should not happen if form validation requires due date
        toast({ title: "Due Date Required", description: "Please select a due date.", variant: "destructive" });
        return Promise.reject(new Error("Due date required"));
    }
    try {
      if (dialogMode === 'add') {
        await handleActualAddTask(description, estimatedTime, dueDate);
      } else if (dialogMode === 'edit' && editingTask) {
        await handleActualUpdateTask(editingTask.id, description, estimatedTime, dueDate);
      }
      setIsDialogOpen(false); // Close dialog on successful submit
      setEditingTask(null); // Reset editing task
    } catch (error) {
      // Error toast is handled within handleActualAddTask/UpdateTask
      console.error("Dialog submit error:", error);
      // Do not close dialog on error, so user can try again
    }
  }, [dialogMode, editingTask, handleActualAddTask, handleActualUpdateTask, toast, setIsDialogOpen, setEditingTask]);

  const handleOpenAddTaskDialog = useCallback(() => {
    setDialogMode('add');
    setEditingTask(null); // Clear any existing editing task
    setIsDialogOpen(true);
  }, [setDialogMode, setEditingTask, setIsDialogOpen]); // Stable setters

  const handleOpenEditDialog = useCallback((taskToEdit: Task) => {
    // console.log("Opening edit dialog for task:", taskToEdit);
    setDialogMode('edit');
    setEditingTask({...taskToEdit}); // Set the task to be edited
    setIsDialogOpen(true);
  }, [setDialogMode, setEditingTask, setIsDialogOpen]); // Stable setters


  const handleToggleComplete = useCallback(async (id: string) => {
    if (!user) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newCompletedStatus = !task.completed;
    
    const originalTasks = [...tasks]; // Create a shallow copy for potential rollback
    setTasks((prevTasks) => // Optimistic UI update
      prevTasks.map((t) => (t.id === id ? { ...t, completed: newCompletedStatus } : t))
    );

    try {
      const { error } = await supabase
        .from(TASKS_TABLE)
        .update({ completed: newCompletedStatus }) // Save to Supabase
        .eq('id', id)
        .eq('user_id', user.id); // Ensure user can only update their own tasks
      if (error) {
        setTasks(originalTasks); // Rollback on error
        toast({ title: "Update Error", description: `Could not update task: ${error.message}. Reverting.`, variant: "destructive" });
        throw error;
      }
      toast({ title: "Task Updated" });
    } catch (error: any) {
      console.error("Error updating task completion in Supabase:", error);
      // Rollback is handled in the if(error) block if Supabase itself returns an error.
    }
  }, [tasks, toast, user, setTasks]); // `setTasks` is stable. `tasks` is the key dependency.

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!user) return;
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;
    
    // Optimistic update: Remove task from local state immediately
    // setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id)); // Hold off on optimistic UI update for delete until confirmed

    try {
      const { error: deleteError } = await supabase
        .from(TASKS_TABLE)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // Ensure user can only delete their own tasks
      if (deleteError) throw deleteError; // This will be caught by the catch block
      
      // If delete is successful, then reload tasks to reflect removal and potential reordering
      await loadTasksFromSupabase(); 
      toast({ title: "Task Deleted", description: `"${taskToDelete.description}" has been removed.`, variant: "destructive" });
    } catch (error: any) {
      console.error("Error deleting task from Supabase:", error);
      toast({ title: "Delete Error", description: `Could not delete task: ${error.message}. Reverting.`, variant: "destructive" });
      // Revert optimistic update by re-fetching all tasks
      await loadTasksFromSupabase(); // Ensure UI consistency
    }
  }, [tasks, toast, user, loadTasksFromSupabase, setTasks]); // tasks for find, setTasks for optimistic


  const handleSetTasks = useCallback(async (newTasks: Task[]) => {
    if (!user) return;

    // This function is primarily for drag-and-drop reordering.
    // Optimistically update the UI.
    setTasks(newTasks);

    const tasksToSaveForOrder = newTasks.map((task, index) => ({
      id: task.id,
      orderIndex: index,
    }));

    try {
      await saveTaskOrderToSupabase(tasksToSaveForOrder);
      // After saving order, re-fetch to ensure consistency from DB.
      await loadTasksFromSupabase(); 
    } catch (error: any) {
        // If saving order fails, revert to the state from DB to ensure consistency
        toast({ title: "Reorder Failed", description: "Could not save new task order. Reverting.", variant: "destructive"});
        await loadTasksFromSupabase(); 
    }
  }, [saveTaskOrderToSupabase, user, loadTasksFromSupabase, setTasks]); // setTasks is stable

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
          priority: task.priority, // AI flow still uses priority
          dueDate: task.dueDate.toISOString(), // Send as ISO string
        })),
      };
      const result: TaskListOutput = await suggestOptimalTaskOrder(inputForAI);

      // Create updates based on AI's ordered tasks
      const taskOrderUpdates = result.orderedTasks.map((aiTask, index) => ({
        id: aiTask.id,
        orderIndex: index,
      }));

      await saveTaskOrderToSupabase(taskOrderUpdates); // Save the new order
      await loadTasksFromSupabase(); // Reload tasks from DB to reflect new order

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
       await loadTasksFromSupabase(); // Ensure UI is consistent
    } finally {
      setIsScheduling(false);
    }
  }, [user, tasks, toast, saveTaskOrderToSupabase, loadTasksFromSupabase, setIsScheduling]); // tasks for mapping


  if (authLoading || (!session && isClient && router.pathname !== '/login' && router.pathname !== '/signup')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-foreground ml-2">{authLoading ? "Authenticating..." : "Redirecting..."}</p>
      </div>
    );
  }

  if (isLoadingData && session && user) { // Only show loading tasks if session and user are present
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-foreground ml-2">Loading tasks...</p>
      </div>
    );
  }

  // console.log('[HomePage Render] Tasks state before passing to children:', JSON.stringify(tasks, null, 2));

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 max-w-4xl flex-grow">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="sm:col-span-2">
            <TaskList
              tasks={tasks}
              setTasks={handleSetTasks}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTask}
              onEditTask={handleOpenEditDialog} // Pass the edit handler
            />
          </div>
          <div className="sm:col-span-1 flex flex-col">
            {user && ( // Only show these buttons if user is logged in
              <div className="mb-6 flex flex-col gap-2 w-full"> {/* Buttons stacked vertically */}
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
            {user && ( // Mobile Smart Schedule button
              <Button 
                onClick={handleSmartSchedule} 
                disabled={isScheduling || tasks.length === 0} 
                variant="outline" 
                size="lg" 
                className="mt-4 shadow-sm hover:shadow-md transition-shadow w-full sm:hidden" // Only show on mobile, hidden on sm+
              >
                <Sparkles className={`mr-2 h-5 w-5 ${isScheduling ? 'animate-spin text-primary' : 'text-accent'}`} />
                {isScheduling ? "Optimizing..." : "Smart Schedule"}
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* FAB for Add New Task - Mobile Only */}
      {user && ( 
        <Button
          className="sm:hidden fixed bottom-20 right-6 rounded-full h-16 w-16 shadow-xl z-50 flex items-center justify-center text-primary-foreground hover:text-primary-foreground bg-primary hover:bg-primary/90"
          variant={"default"} 
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
            // console.log("Dialog closed, resetting edit state.");
            setEditingTask(null); // Clear editing task when dialog closes
            setDialogMode('add'); // Default to add mode
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
            // Key ensures form re-initializes properly when switching between add/edit or editing different tasks
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

    