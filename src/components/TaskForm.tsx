
"use client";

import React, { type FC, useState } from 'react'; // Added React
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";

const taskFormSchema = z.object({
  description: z.string().min(1, { message: "Description is required." }).max(200, { message: "Description must be 200 characters or less." }),
  estimatedCompletionTime: z.coerce.number().min(0, { message: "Time must be 0 or greater."}).max(1440, { message: "Time cannot exceed 24 hours (1440 mins)."}),
  dueDate: z.date().optional().nullable(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  onAddTask: (description: string, estimatedTime: number, dueDate?: Date | null) => Promise<void>;
}

const TaskForm: FC<TaskFormProps> = ({ onAddTask }) => {
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      description: "",
      estimatedCompletionTime: 30,
      dueDate: null,
    },
  });

  const onSubmit = async (data: TaskFormValues) => {
    setIsSubmittingForm(true);
    try {
      await onAddTask(data.description, data.estimatedCompletionTime, data.dueDate);
      form.reset();
    } catch (error) {
      console.error("Error in TaskForm onSubmit:", error);
      // Toast for this error is likely handled by the parent
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
        <FormField
          control={form.control}
          name="dueDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Due Date (Optional)</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                      disabled={isSubmittingForm}
                    >
                      {field.value ? (
                        format(new Date(field.value), "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date < new Date(new Date().setDate(new Date().getDate() -1)) // Disable past dates, allowing today
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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

export default React.memo(TaskForm);
