
# 🗓️ Day Architect - Smart Task Manager

Day Architect is a modern, responsive task management application designed to help you plan your day effectively. It leverages AI to suggest an optimal order for your tasks and uses Supabase for backend services.

## ✨ Key Features

*   **Task Management**: Create, edit, delete, and mark tasks as complete.
*   **Drag & Drop Reordering**: Easily reorder your tasks.
*   **Due Dates**: Assign due dates to tasks, with visual cues for urgency.
*   **AI-Powered Smart Scheduling**: Get AI suggestions for the optimal order to complete your tasks, minimizing context switching and respecting deadlines.
*   **User Authentication**: Secure user accounts with email/password login and signup, powered by Supabase Auth.
*   **User Profiles**: Manage your personal details (name, phone).
*   **Persistent Storage**: Tasks and user data are stored securely using Supabase.
*   **Progress Tracking**: Visual indicators for task completion and time progress.
*   **Dark Mode**: Switch between light and dark themes based on system preference or manual selection.
*   **Responsive Design**: A clean and intuitive UI that works across devices, built with ShadCN UI and Tailwind CSS.

## 🛠️ Tech Stack

*   **Frontend**:
    *   [Next.js](https://nextjs.org/) (App Router)
    *   [React](https://reactjs.org/)
    *   [TypeScript](https://www.typescriptlang.org/)
    *   [ShadCN UI](https://ui.shadcn.com/) (Component Library)
    *   [Tailwind CSS](https://tailwindcss.com/) (Styling)
    *   [Lucide React](https://lucide.dev/) (Icons)
    *   `react-hook-form` & `zod` (Form handling & validation)
    *   `date-fns` (Date utility)
*   **Backend & AI**:
    *   [Supabase](https://supabase.io/) (Database, Authentication, Storage)
    *   [Genkit (Firebase Genkit)](https://firebase.google.com/docs/genkit) (AI Integration, using Google AI models)
*   **Development**:
    *   Next.js Dev Server (Turbopack enabled)
    *   ESLint & Prettier (Linting & Formatting - implied, standard for Next.js)

## 🚀 Getting Started

1.  **Clone the repository** (if applicable, or use this project in Firebase Studio).

2.  **Install dependencies**:
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

3.  **Set up Supabase**:
    *   Create a project on [Supabase](https://supabase.io/).
    *   In your Supabase project, go to the SQL Editor and run the schema provided in the project (or ensure you have a `tasks` table compatible with the application's needs, including `user_id` linked to `auth.users`).
    *   Enable Row Level Security (RLS) on your `tasks` table and set up policies to allow authenticated users to manage their own tasks.

4.  **Configure Environment Variables**:
    *   Create a `.env` file in the root of your project by copying `.env.example` (if one exists) or creating it from scratch.
    *   Add your Supabase project URL and Anon Key:
        ```env
        NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
        NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
        ```
    *   If using Genkit with Google AI, you might also need `GOOGLE_API_KEY` or other relevant API keys for the AI models. Refer to Genkit documentation for configuration if you are running it locally.

5.  **Run the development server**:
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:9002` (or another port if 9002 is in use).

6.  **Run Genkit development server (for AI features)**:
    In a separate terminal, run:
    ```bash
    npm run genkit:dev
    # or for auto-reloading on changes:
    # npm run genkit:watch
    ```
    This starts the Genkit development server, usually on port 3400, which the Next.js app will call for AI flows.

## 📜 Available Scripts

*   `npm run dev`: Starts the Next.js development server (with Turbopack).
*   `npm run genkit:dev`: Starts the Genkit development server.
*   `npm run genkit:watch`: Starts the Genkit development server with file watching.
*   `npm run build`: Builds the application for production.
*   `npm run start`: Starts a Next.js production server.
*   `npm run lint`: Runs ESLint for code linting.
*   `npm run typecheck`: Runs TypeScript for type checking.

## 🎨 UI & Styling

*   The UI is built primarily with **ShadCN UI components**.
*   Styling is managed by **Tailwind CSS**.
*   Color theming (light/dark) is controlled via CSS variables in `src/app/globals.css`.

---

Happy Task Architecting!
