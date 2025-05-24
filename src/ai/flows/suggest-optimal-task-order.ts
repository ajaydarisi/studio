
'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting the optimal order of tasks
 * to minimize context switching based on user-defined priorities, estimated completion times, and due dates.
 *
 * - suggestOptimalTaskOrder - A function that suggests the optimal task order.
 * - Task - The interface for a task (schema defined here).
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
  dueDate: z.string().datetime({ message: "dueDate must be a valid ISO 8601 date-time string" }).describe('Due date of the task, as an ISO 8601 string.'),
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
  prompt: `You are an AI task scheduler that takes a list of tasks and suggests an optimal order to complete them to minimize context switching and respect deadlines.

You will order the tasks based on their description, estimated completion time, priority, and due date.
- Tasks with earlier due dates should generally be scheduled sooner, especially if they are also high priority.
- High priority tasks should be prioritized over medium and low priority tasks, considering due dates.
- Tasks with similar descriptions should be grouped together to minimize context switching, if possible without jeopardizing high priority tasks or near due dates.

Tasks:
{{#each tasks}}
  - id: {{this.id}}
    description: {{this.description}}
    estimatedCompletionTime: {{this.estimatedCompletionTime}}
    priority: {{this.priority}}
    dueDate: {{this.dueDate}}
{{/each}}

Provide the ordered list of tasks and a brief reasoning for your suggested order.
The output 'orderedTasks' array should contain all original tasks, just reordered.
The 'dueDate' in the output tasks must be an ISO 8601 date-time string, identical to the input format.
`,
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

