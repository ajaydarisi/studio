'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting the optimal order of tasks
 * to minimize context switching based on user-defined priorities and estimated completion times.
 *
 * - suggestOptimalTaskOrder - A function that suggests the optimal task order.
 * - Task - The interface for a task.
 * - TaskListInput - The input type for the suggestOptimalTaskOrder function.
 * - TaskListOutput - The return type for the suggestOptimalTaskOrder function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TaskSchema = z.object({
  id: z.string().describe('Unique identifier for the task.'),
  description: z.string().describe('Description of the task.'),
  estimatedCompletionTime: z
    .number()
    .describe('Estimated completion time in minutes.'),
  priority: z.enum(['high', 'medium', 'low']).describe('Priority of the task.'),
});

export type Task = z.infer<typeof TaskSchema>;

const TaskListInputSchema = z.object({
  tasks: z.array(TaskSchema).describe('List of tasks to be ordered.'),
});

export type TaskListInput = z.infer<typeof TaskListInputSchema>;

const TaskListOutputSchema = z.object({
  orderedTasks: z
    .array(TaskSchema)
    .describe('List of tasks ordered by optimal completion order.'),
  reasoning: z
    .string()
    .describe(
      'Explanation of why the tasks were ordered in the suggested order.'
    ),
});

export type TaskListOutput = z.infer<typeof TaskListOutputSchema>;

export async function suggestOptimalTaskOrder(
  input: TaskListInput
): Promise<TaskListOutput> {
  return suggestOptimalTaskOrderFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestOptimalTaskOrderPrompt',
  input: {schema: TaskListInputSchema},
  output: {schema: TaskListOutputSchema},
  prompt: `You are an AI task scheduler that takes a list of tasks and suggests an optimal order to complete them to minimize context switching.

You will order the tasks based on their description, estimated completion time, and priority.  Tasks with similar descriptions should be grouped together to minimize context switching. High priority tasks should be done first.

Tasks:
{{#each tasks}}
  - id: {{this.id}}
    description: {{this.description}}
    estimatedCompletionTime: {{this.estimatedCompletionTime}}
    priority: {{this.priority}}
{{/each}}`,
});

const suggestOptimalTaskOrderFlow = ai.defineFlow(
  {
    name: 'suggestOptimalTaskOrderFlow',
    inputSchema: TaskListInputSchema,
    outputSchema: TaskListOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
