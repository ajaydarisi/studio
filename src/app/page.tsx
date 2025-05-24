
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { Task } from "@/types";
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
             parsedDueDate = new Date(Date.UTC(year, month - 1, day)); 
        } else { // Assume it's a full ISO string
            parsedDueDate = dateCandidate; // Already UTC
        }
    } else {
      parsedDueDate = startOfToday(); 
    }
  } else if (row.dueDate instanceof Date) {
    parsedDueDate = row.dueDate; // Already a Date object
  } else {
    parsedDueDate = startOfToday(); 
  }

  let isTaskCompleted: boolean;
  // Robust boolean parsing
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

  return {
    id: row.id,
    userId: row.user_id,
    description: row.description,
    estimatedCompletionTime: Number(row.estimatedCompletionTime) || 0,
    priority: row.priority, 
    completed: isTaskCompleted,
    createdAt: row.createdAt ? parseISO(row.createdAt).getTime() : Date.now(),
    orderIndex: row.orderIndex,
    dueDate: startOfDay(parsedDueDate), 
  };
};


const initialTasksSeed: Omit<Task, 'id' | 'createdAt' | 'userId' | 'dueDate'>[] = [
  { description: "Morning workout session", estimatedCompletionTime: 45, priority: 'high', completed: true, orderIndex: 0 },
  { description: "Respond to urgent emails", estimatedCompletionTime: 60, priority: 'high', completed: false, orderIndex: 1 },
  { description: "Draft project proposal", estimatedCompletionTime: 120, priority: 'high', completed: false, orderIndex: 2 },
  { description: "Grocery shopping", estimatedCompletionTime: 75, priority: 'low', completed: false, orderIndex: 3 },
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
      return {
        description: editingTask.description,
        estimatedCompletionTime: editingTask.estimatedCompletionTime,
        dueDate: editingTask.dueDate instanceof Date ? editingTask.dueDate : startOfDay(new Date(editingTask.dueDate)),
      };
    }
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
          dueDate: format(addDays(startOfToday(), index + 1), "yyyy-MM-dd"), 
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
      toast({ title: "Error", description: `Could not load tasks: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [toast, user]); 

  useEffect(() => {
    if (session && user && isClient) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseUrl !== 'your_supabase_url_here' && supabaseUrl !== '' && 
          supabaseAnonKey && supabaseAnonKey !== 'your_supabase_anon_key_here' && supabaseAnonKey !== '') {
          loadTasksFromSupabase();
      } else {
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
      priority: 'medium', 
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
      toast({ title: "Add Task Error", description: `Could not add task: ${error.message || "Unknown error"}.`, variant: "destructive" });
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
      toast({ title: "Update Task Error", description: `Could not update task: ${error.message || "Unknown error"}.`, variant: "destructive" });
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
      // Errors are handled by TaskForm itself or toasted in handleActualAddTask/UpdateTask
    }
  }, [dialogMode, editingTask, handleActualAddTask, handleActualUpdateTask, toast, setIsDialogOpen, setEditingTask]);

  const handleOpenAddTaskDialog = useCallback(() => {
    setDialogMode('add');
    setEditingTask(null); 
    setIsDialogOpen(true);
  }, [setDialogMode, setEditingTask, setIsDialogOpen]); 

  const handleOpenEditDialog = useCallback((taskToEdit: Task) => {
    setDialogMode('edit');
    setEditingTask({...taskToEdit}); 
    setIsDialogOpen(true);
  }, [setDialogMode, setEditingTask, setIsDialogOpen]); 


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
      if (error) {
        toast({ title: "Update Error", description: `Could not update task: ${error.message}. Reverting.`, variant: "destructive" });
        throw error; 
      }
      toast({ title: "Task Updated" });
      await loadTasksFromSupabase(); 
    } catch (error: any) {
      await loadTasksFromSupabase(); 
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
      
      await loadTasksFromSupabase(); 
      toast({ title: "Task Deleted", description: `"${taskToDelete.description}" has been removed.`, variant: "destructive" });
    } catch (error: any) {
      toast({ title: "Delete Error", description: `Could not delete task: ${error.message}. Reverting.`, variant: "destructive" });
      await loadTasksFromSupabase(); 
    }
  }, [tasks, toast, user, loadTasksFromSupabase]); 


  const handleSetTasks = useCallback(async (newTasks: Task[]) => {
    if (!user) return;
    // Optimistically update UI first
    setTasks(newTasks);

    const tasksToSaveForOrder = newTasks.map((task, index) => ({
      id: task.id,
      orderIndex: index,
    }));

    try {
      await saveTaskOrderToSupabase(tasksToSaveForOrder);
      // No full reload here; trust the optimistic update for smoother UX for drag-n-drop.
      // If a full reload is desired after reorder, uncomment the line below:
      // await loadTasksFromSupabase(); 
    } catch (error: any) {
        toast({ title: "Reorder Failed", description: "Could not save new task order. Reverting.", variant: "destructive"});
        await loadTasksFromSupabase(); // Revert to DB state on error
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
        <p className="text-foreground ml-2">
          {authLoading ? "Authenticating..." : "Redirecting to login..."}
        </p>
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
              setTasks={handleSetTasks} 
              onToggleComplete={handleToggleComplete}
              onDelete={handleDeleteTask}
              onEditTask={handleOpenEditDialog} 
            />
          </div>
          <div className="sm:col-span-1 flex flex-col">
            {user && ( 
              <div className="hidden sm:flex mb-6 flex-col gap-2 w-full"> 
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

