
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Task, TaskPriority } from "@/types";
import { suggestOptimalTaskOrder, type TaskListInput, type TaskListOutput } from "@/ai/flows/suggest-optimal-task-order";
import AppHeader from "@/components/AppHeader";
import TaskList from "@/components/TaskList";
import ProgressIndicator from "@/components/ProgressIndicator";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

// Sample initial tasks if Firestore is empty
const initialTasksSeed: Omit<Task, 'id' | 'createdAt'>[] = [
  { description: "Morning workout session", estimatedCompletionTime: 45, priority: 'medium', completed: true, orderIndex: 0 },
  { description: "Respond to urgent emails", estimatedCompletionTime: 60, priority: 'high', completed: false, orderIndex: 1 },
  { description: "Draft project proposal", estimatedCompletionTime: 120, priority: 'high', completed: false, orderIndex: 2 },
  { description: "Grocery shopping", estimatedCompletionTime: 75, priority: 'low', completed: false, orderIndex: 3 },
];

const TASKS_COLLECTION = "tasks";

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [isScheduling, setIsScheduling] = useState(false);
  const { toast } = useToast();

  const mapFirestoreDocToTask = (docSnapshot: any): Task => {
    const data = docSnapshot.data();
    return {
      id: docSnapshot.id,
      description: data.description,
      estimatedCompletionTime: data.estimatedCompletionTime,
      priority: data.priority,
      completed: data.completed,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
      orderIndex: data.orderIndex,
    };
  };

  const loadTasksFromFirestore = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, TASKS_COLLECTION), orderBy("orderIndex", "asc"));
      const querySnapshot = await getDocs(q);
      let fetchedTasks: Task[] = [];
      querySnapshot.forEach((doc) => {
        fetchedTasks.push(mapFirestoreDocToTask(doc));
      });

      if (fetchedTasks.length === 0 && initialTasksSeed.length > 0) {
        const batch = writeBatch(db);
        const seededTasks: Task[] = [];
        initialTasksSeed.forEach((taskSeed, index) => {
          const newDocRef = doc(collection(db, TASKS_COLLECTION));
          batch.set(newDocRef, {
            ...taskSeed,
            createdAt: serverTimestamp(),
            orderIndex: index,
          });
          seededTasks.push({
            id: newDocRef.id,
            ...taskSeed,
            createdAt: Date.now(),
            orderIndex: index
          });
        });
        await batch.commit();
        const seededQuerySnapshot = await getDocs(q);
        fetchedTasks = [];
        seededQuerySnapshot.forEach((doc) => {
          fetchedTasks.push(mapFirestoreDocToTask(doc));
        });
        toast({ title: "Welcome!", description: "Sample tasks loaded." });
      }
      setTasks(fetchedTasks);
    } catch (error) {
      console.error("Error loading tasks from Firestore:", error);
      toast({ title: "Error", description: "Could not load tasks.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setIsClient(true);
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    if (typeof window !== "undefined" && apiKey && apiKey !== 'your_api_key_here') {
        loadTasksFromFirestore();
    } else if (apiKey === 'your_api_key_here') {
        console.warn("Firebase API key is the placeholder. Please update .env file.");
        toast({ title: "Firebase Not Configured", description: "Using placeholder Firebase API key. Please set up your Firebase API key in .env to connect to the database.", variant: "destructive", duration: 10000});
        setIsLoading(false);
        const localInitialTasks = initialTasksSeed.map((t, i) => ({
          ...t,
          id: uuidv4(),
          createdAt: Date.now() - (initialTasksSeed.length - 1 - i) * 100000,
          orderIndex: i
        }));
        setTasks(localInitialTasks);
    } else { // Handles apiKey being undefined or an empty string
        console.warn("Firebase API key is not set or is invalid. Please update .env file.");
        toast({ title: "Firebase Not Configured", description: "Firebase is not configured. Tasks will not be saved. Please set up your Firebase API key in .env.", variant: "destructive", duration: 10000});
        setIsLoading(false);
        const localInitialTasks = initialTasksSeed.map((t, i) => ({
          ...t,
          id: uuidv4(),
          createdAt: Date.now() - (initialTasksSeed.length - 1 - i) * 100000,
          orderIndex: i
        }));
        setTasks(localInitialTasks);
    }
  }, [loadTasksFromFirestore, toast]);


  const saveTasksToFirestore = useCallback(async (tasksToSave: Task[]) => {
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      tasksToSave.forEach((task, index) => {
        const taskRef = doc(db, TASKS_COLLECTION, task.id);
        let createdAtValue = task.createdAt;
        if (typeof task.createdAt === 'number') {
          createdAtValue = Timestamp.fromMillis(task.createdAt);
        } else if (!(task.createdAt instanceof Timestamp) && typeof task.createdAt !== 'function') {
          createdAtValue = serverTimestamp();
        }

        batch.set(taskRef, {
            description: task.description,
            estimatedCompletionTime: task.estimatedCompletionTime,
            priority: task.priority,
            completed: task.completed,
            createdAt: createdAtValue,
            orderIndex: index
        }, { merge: true });
      });
      await batch.commit();
      setTasks(tasksToSave.map((task, index) => ({...task, orderIndex: index})));
      toast({ title: "Tasks Saved", description: "Your task order has been saved." });
    } catch (error) {
      console.error("Error saving tasks to Firestore:", error);
      toast({ title: "Save Error", description: "Could not save task order.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


  const handleAddTask = useCallback(async (description: string, estimatedTime: number) => {
    setIsLoading(true);
    const newTaskData = {
      description,
      estimatedCompletionTime: estimatedTime,
      priority: 'medium' as TaskPriority,
      completed: false,
      createdAt: serverTimestamp(),
      orderIndex: tasks.length,
    };
    try {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (!apiKey || apiKey === 'your_api_key_here') {
        toast({ title: "Firebase Not Configured", description: "Cannot add task. Please configure Firebase.", variant: "destructive" });
        setIsLoading(false); // Ensure loading stops if Firebase isn't set up
        return;
      }
      await addDoc(collection(db, TASKS_COLLECTION), newTaskData);
      toast({ title: "Task Added", description: `"${description}" has been added.` });
      await loadTasksFromFirestore();
    } catch (error) {
      console.error("Error adding task to Firestore:", error);
      toast({ title: "Add Error", description: "Could not add task.", variant: "destructive" });
      setIsLoading(false); // Also ensure loading stops on error
    }
    // loadTasksFromFirestore has its own finally block that calls setIsLoading(false)
    // So, no explicit setIsLoading(false) needed here for the success path.
  }, [tasks.length, toast, loadTasksFromFirestore]);

  const handleToggleComplete = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newCompletedStatus = !task.completed;
    try {
      const taskRef = doc(db, TASKS_COLLECTION, id);
      await updateDoc(taskRef, { completed: newCompletedStatus });
      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === id ? { ...t, completed: newCompletedStatus } : t))
      );
      toast({ title: "Task Updated" });
    } catch (error) {
      console.error("Error updating task completion:", error);
      toast({ title: "Update Error", description: "Could not update task.", variant: "destructive" });
    }
  }, [tasks, toast]);

  const handleDeleteTask = useCallback(async (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    setIsLoading(true);
    try {
      await deleteDoc(doc(db, TASKS_COLLECTION, id));
      const remainingTasks = tasks.filter((task) => task.id !== id);
      const reorderedTasks = remainingTasks.map((task, index) => ({ ...task, orderIndex: index }));

      if (reorderedTasks.length > 0) {
        const batch = writeBatch(db);
        reorderedTasks.forEach(task => {
          const taskRef = doc(db, TASKS_COLLECTION, task.id);
          batch.update(taskRef, { orderIndex: task.orderIndex });
        });
        await batch.commit();
      }

      setTasks(reorderedTasks);
      toast({ title: "Task Deleted", description: `"${taskToDelete.description}" has been removed.`, variant: "destructive" });
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({ title: "Delete Error", description: "Could not delete task.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [tasks, toast]);

  const handlePriorityChange = useCallback(async (id: string, priority: TaskPriority) => {
    try {
      const taskRef = doc(db, TASKS_COLLECTION, id);
      await updateDoc(taskRef, { priority });
      setTasks((prevTasks) =>
        prevTasks.map((task) => (task.id === id ? { ...task, priority } : task))
      );
      toast({ title: "Priority Updated" });
    } catch (error) {
      console.error("Error updating task priority:", error);
      toast({ title: "Update Error", description: "Could not update priority.", variant: "destructive" });
    }
  }, [toast]);

  const handleSetTasks = useCallback(async (newTasks: Task[]) => {
    const tasksToSave = newTasks.map((task, index) => ({
      ...task,
      orderIndex: index,
    }));
    setTasks(tasksToSave);
    await saveTasksToFirestore(tasksToSave);
  }, [saveTasksToFirestore]);

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

      const newOrderedTasksFromAI = result.orderedTasks.map((aiTask, index) => {
        const originalTask = tasks.find(t => t.id === aiTask.id);
        return {
          ...aiTask,
          completed: originalTask?.completed || false,
          createdAt: originalTask?.createdAt || serverTimestamp(),
          orderIndex: index,
        };
      });

      setTasks(newOrderedTasksFromAI);
      await saveTasksToFirestore(newOrderedTasksFromAI);

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

  if (!isClient || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground">{isLoading ? "Loading tasks..." : "Initializing Day Architect..."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
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
      <footer className="text-center py-6 text-sm text-muted-foreground border-t mt-12">
        <p>&copy; {new Date().getFullYear()} Day Architect. Plan your success.</p>
      </footer>
    </div>
  );
}
