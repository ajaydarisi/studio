
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import type { FC } from 'react';

const taskFormSchema = z.object({
  description: z.string().min(1, { message: "Description is required." }).max(200, { message: "Description must be 200 characters or less." }),
  estimatedCompletionTime: z.coerce.number().min(0, { message: "Time must be 0 or greater."}).max(1440, { message: "Time cannot exceed 24 hours (1440 mins)."}),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  onAddTask: (description: string, estimatedTime: number) => void;
}

const TaskForm: FC<TaskFormProps> = ({ onAddTask }) => {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      description: "",
      estimatedCompletionTime: 30,
    },
  });

  const onSubmit = (data: TaskFormValues) => {
    onAddTask(data.description, data.estimatedCompletionTime);
    form.reset();
  };

  return (
    <Card className="mb-6 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <PlusCircle className="mr-2 h-6 w-6 text-accent" />
          Add New Task
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Plan weekly meals" {...field} />
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
                    <Input type="number" placeholder="e.g., 30" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full sm:w-auto" size="lg">
              Add Task
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default TaskForm;
