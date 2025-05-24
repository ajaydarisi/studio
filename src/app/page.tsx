
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
        if (row.dueDate.length === 10) {
             const [year, month, day] = row.dueDate.split('-').map(Number);
             parsedDueDate = new Date(year, month - 1, day);
        } else {
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
  // Ensure the 'completed' field is a strict boolean
  // console.log(`[mapSupabaseRowToTask] Task ID: ${row.id}, Raw row.completed: ${row.completed}, typeof row.completed: ${typeof row.completed}`);
  return {
    id: row.id,
    userId: row.user_id,
    description: row.description,
    estimatedCompletionTime: row.estimatedCompletionTime,
    priority: row.priority as TaskPriority,
    completed: !!row.completed, // Explicitly ensure it's a boolean true/false
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
        dueDate: new Date(),
    };
  }, [dialogMode, editingTask]);


  useEffect(() => {
    setIsClient(true);
  }, []);


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
      setTasks([]);
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
          dueDate: format(taskSeed.dueDate instanceof Date ? taskSeed.dueDate : new Date(taskSeed.dueDate), "yyyy-MM-dd"), 
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
  }, [toast, user]); // Removed 'tasks' from dependencies to avoid potential loops if tasks were part of the logic determining if loadTasks should run

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
      throw error; 
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
      priority: 'medium' as TaskPriority,
      completed: false,
      orderIndex: tasks.length,
      dueDate: format(startOfDay(dueDate), "yyyy-MM-dd"),
    };

    try {
      const { data: insertedTaskResult, error } = await supabase
        .from(TASKS_TABLE)
        .insert(newTaskData)
        .select() 
        .single(); 

      if (error) throw error;
      if (!insertedTaskResult) throw new Error("Failed to retrieve inserted task data.");
      
      await loadTasksFromSupabase(); 
      toast({ title: "Task Added", description: `"${description}" has been added.` });
      
    } catch (error: any) {
      console.error("Error adding task to Supabase:", error);
      toast({ title: "Add Task Error", description: error.message || "Could not add task.", variant: "destructive" });
      await loadTasksFromSupabase(); 
      return Promise.reject(error); 
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
      dueDate: format(startOfDay(dueDate), "yyyy-MM-dd"), 
    };

    try {
      const { error } = await supabase
        .from(TASKS_TABLE)
        .update(updatedTaskData)
        .eq('id', taskId)
        .eq('user_id', user.id) 
        .select() 
        .single(); 
      
      if (error) throw error;

      await loadTasksFromSupabase(); 
      toast({ title: "Task Updated", description: `"${description}" has been updated.` });
      
    } catch (error: any) {
      console.error("Error updating task in Supabase:", error);
      toast({ title: "Update Task Error", description: error.message || "Could not update task.", variant: "destructive" });
      await loadTasksFromSupabase(); 
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
      setEditingTask(null); 
    } catch (error) {
      // Error toast is handled within handleActualAddTask/UpdateTask
      console.error("Dialog submit error:", error);
    }
  }, [dialogMode, editingTask, handleActualAddTask, handleActualUpdateTask, toast, setIsDialogOpen, setEditingTask]);

  const handleOpenAddTaskDialog = useCallback(() => {
    setDialogMode('add');
    setEditingTask(null); 
    setIsDialogOpen(true);
  }, [setDialogMode, setEditingTask, setIsDialogOpen]); 

  const handleOpenEditDialog = useCallback((taskToEdit: Task) => {
    // console.log("Opening edit dialog for task:", taskToEdit);
    setDialogMode('edit');
    setEditingTask({...taskToEdit}); 
    setIsDialogOpen(true);
  }, [setDialogMode, setEditingTask, setIsDialogOpen]); 


  const handleToggleComplete = useCallback(async (id: string) => {
    if (!user) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newCompletedStatus = !task.completed;
    
    const originalTasks = [...tasks];
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
        setTasks(originalTasks); 
        toast({ title: "Update Error", description: `Could not update task: ${error.message}. Reverting.`, variant: "destructive" });
        throw error;
      }
      toast({ title: "Task Updated" });
    } catch (error: any) {
      console.error("Error updating task completion in Supabase:", error);
    }
  }, [tasks, toast, user, setTasks]); 

  const handleDeleteTask = useCallback(async (id: string) => {
    if (!user) return;
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;
    
    // Optimistic update: Remove task from local state immediately
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id)); 

    try {
      const { error: deleteError } = await supabase
        .from(TASKS_TABLE)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); 
      if (deleteError) throw deleteError; // This will be caught by the catch block
      
      toast({ title: "Task Deleted", description: `"${taskToDelete.description}" has been removed.`, variant: "destructive" });
      // No need to call loadTasksFromSupabase() here if optimistic update is sufficient,
      // unless there's a need to re-sync orderIndex or other derived states.
      // For now, assume order recalculation might be needed if order is strict.
      await loadTasksFromSupabase(); // Or a more lightweight re-order if applicable
    } catch (error: any) {
      console.error("Error deleting task from Supabase:", error);
      toast({ title: "Delete Error", description: `Could not delete task: ${error.message}. Reverting.`, variant: "destructive" });
      // Revert optimistic update by re-fetching all tasks
      await loadTasksFromSupabase(); 
    }
  }, [tasks, toast, user, loadTasksFromSupabase, setTasks]); 


  const handleSetTasks = useCallback(async (newTasks: Task[]) => {
    if (!user) return;

    setTasks(newTasks); // Optimistic update for drag-and-drop

    const tasksToSaveForOrder = newTasks.map((task, index) => ({
      id: task.id,
      orderIndex: index,
    }));

    try {
      await saveTaskOrderToSupabase(tasksToSaveForOrder);
      // After saving order, re-fetch to ensure consistency,
      // especially if saveTaskOrderToSupabase doesn't return the full updated tasks.
      await loadTasksFromSupabase(); 
    } catch (error: any) {
        // If saving order fails, revert to the state from DB
        await loadTasksFromSupabase(); 
    }
  }, [saveTaskOrderToSupabase, user, loadTasksFromSupabase, setTasks]); 

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
          dueDate: task.dueDate.toISOString(),
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
  }, [user, tasks, toast, saveTaskOrderToSupabase, loadTasksFromSupabase, setIsScheduling]); 


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
      <AppHeader />

      <main className="container mx-auto px-4 py-8 max-w-4xl flex-grow">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="sm:col-span-2">
            <TaskList
              tasks={tasks}
              setTasks={handleSetTasks}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTask}
              onEditTask={handleOpenEditDialog} 
            />
          </div>
          <div className="sm:col-span-1 flex flex-col">
            {user && ( 
              <div className="mb-6 flex flex-col gap-2 w-full"> 
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
            setEditingTask(null); 
            setDialogMode('add'); 
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


    