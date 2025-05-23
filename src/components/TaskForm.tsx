
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { FC } from 'react';
import { useState } from 'react'; // Added useState
import { Loader2 } from "lucide-react"; // Added Loader2 for spinner

const taskFormSchema = z.object({
  description: z.string().min(1, { message: "Description is required." }).max(200, { message: "Description must be 200 characters or less." }),
  estimatedCompletionTime: z.coerce.number().min(0, { message: "Time must be 0 or greater."}).max(1440, { message: "Time cannot exceed 24 hours (1440 mins)."}),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  onAddTask: (description: string, estimatedTime: number) => Promise<void>; // Updated to return Promise<void>
}

const TaskForm: FC<TaskFormProps> = ({ onAddTask }) => {
  const [isSubmittingForm, setIsSubmittingForm] = useState(false); // Local loading state
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      description: "",
      estimatedCompletionTime: 30,
    },
  });

  const onSubmit = async (data: TaskFormValues) => {
    setIsSubmittingForm(true);
    try {
      await onAddTask(data.description, data.estimatedCompletionTime);
      form.reset(); // Reset form on successful submission
    } catch (error) {
      // Error handling might be done by the parent, or add a local error display
      console.error("Error in TaskForm onSubmit:", error);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Description</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Plan weekly meals" {...field} disabled={isSubmittingForm} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="estimatedCompletionTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estimated Time (minutes)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="e.g., 30" {...field} disabled={isSubmittingForm} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" size="lg" disabled={isSubmittingForm}>
          {isSubmittingForm ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Task...
            </>
          ) : (
            "Add Task"
          )}
        </Button>
      </form>
    </Form>
  );
};

export default TaskForm;
