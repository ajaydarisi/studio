
"use client";

import React, { type FC, useState, useEffect } from 'react';
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
import { useToast } from "@/hooks/use-toast";


const taskFormSchema = z.object({
  description: z.string().min(1, { message: "Description is required." }).max(200, { message: "Description must be 200 characters or less." }),
  estimatedCompletionTime: z.coerce.number().min(0, { message: "Time must be 0 or greater."}).max(1440, { message: "Time cannot exceed 24 hours (1440 mins)."}),
  dueDate: z.date({ required_error: "Due date is required."}).nullable(false),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  onSubmit: (description: string, estimatedTime: number, dueDate: Date) => Promise<void>; 
  initialValues?: {
    description: string;
    estimatedCompletionTime: number;
    dueDate: Date; 
  };
  buttonText?: string;
}

const TaskForm: FC<TaskFormProps> = ({ onSubmit, initialValues, buttonText = "Add Task" }) => {
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: initialValues
      ? { 
          description: initialValues.description,
          estimatedCompletionTime: initialValues.estimatedCompletionTime,
          dueDate: initialValues.dueDate instanceof Date ? initialValues.dueDate : new Date(initialValues.dueDate),
        }
      : { 
          description: "",
          estimatedCompletionTime: 30,
          dueDate: new Date(), 
        },
  });

  useEffect(() => {
    if (initialValues) {
      form.reset({
        description: initialValues.description,
        estimatedCompletionTime: initialValues.estimatedCompletionTime,
        dueDate: initialValues.dueDate instanceof Date ? initialValues.dueDate : new Date(initialValues.dueDate),
      });
    } else {
      form.reset({
        description: "",
        estimatedCompletionTime: 30,
        dueDate: new Date(),
      });
    }
  }, [initialValues, form.reset]);

  const handleFormSubmit = async (data: TaskFormValues) => {
    setIsSubmittingForm(true);
    try {
      if (!data.dueDate) { 
        toast({title: "Error", description: "Due date is missing in form data.", variant: "destructive"});
        setIsSubmittingForm(false);
        return;
      }
      await onSubmit(data.description, data.estimatedCompletionTime, data.dueDate);
      if (!initialValues) { 
         form.reset({ description: "", estimatedCompletionTime: 30, dueDate: new Date() });
      }
    } catch (error) {
      // Error is handled by parent submit handler
    } finally {
      setIsSubmittingForm(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 pt-4">
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
              <FormLabel>Due Date</FormLabel> 
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
                        format(field.value instanceof Date ? field.value : new Date(field.value), "PPP")
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
                    selected={field.value instanceof Date ? field.value : (field.value ? new Date(field.value) : undefined)}
                    onSelect={(date) => field.onChange(date)} 
                    disabled={(date) =>
                      date < new Date(new Date().setDate(new Date().getDate() -1)) 
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" size="lg" disabled={isSubmittingForm || (!form.formState.isValid && form.formState.isSubmitted)}>
          {isSubmittingForm ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {initialValues ? "Saving..." : "Adding Task..."}
            </>
          ) : (
            buttonText
          )}
        </Button>
      </form>
    </Form>
  );
};

export default TaskForm;
