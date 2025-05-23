
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Sparkles, CalendarCheck2, PlusCircle, LogIn, LogOut, UserCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';


interface AppHeaderProps {
  onSmartSchedule: () => void;
  isScheduling: boolean;
  onAddTask: (description: string, estimatedTime: number) => void;
}

const AppHeader: FC<AppHeaderProps> = ({ onSmartSchedule, isScheduling, onAddTask }) => {
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
  const { user, signOut, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleInternalAddTask = (description: string, estimatedTime: number) => {
    onAddTask(description, estimatedTime);
    setIsAddTaskDialogOpen(false); // Close dialog after adding task
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({ title: 'Logout Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      // Router push to /login is handled by AuthProvider
    }
  };

  const AuthButtonBlock = () => (
    <>
      {authLoading ? (
         <Button variant="outline" size="lg" disabled>Loading...</Button>
      ) : user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow">
              <UserCircle className="mr-2 h-5 w-5" />
              {user.email?.split('@')[0] || 'Account'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button onClick={() => router.push('/login')} variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow">
          <LogIn className="mr-2 h-5 w-5" />
          Login
        </Button>
      )}
    </>
  );

  return (
    // Main header container: stacks vertically on mobile, becomes a row on sm+ screens, justifies space between main children
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 pb-4 border-b gap-4">
      {/* Top section for mobile (Logo + Auth Button), Left section for desktop (Logo) */}
      <div className="flex items-center justify-between w-full sm:w-auto">
        {/* Logo and Title */}
        <div className="flex items-center space-x-3">
          <CalendarCheck2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Day Architect</h1>
        </div>
        {/* Auth Button: Visible only on mobile screens (<sm) */}
        <div className="sm:hidden">
          <AuthButtonBlock />
        </div>
      </div>

      {/* Action Buttons & Desktop Auth Button: Stacks on mobile below logo, groups to right on desktop */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
        {user && (
          <>
            <Button onClick={onSmartSchedule} disabled={isScheduling} variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow w-full sm:w-auto">
              <Sparkles className={`mr-2 h-5 w-5 ${isScheduling ? 'animate-spin' : ''}`} />
              {isScheduling ? "Optimizing..." : "Smart Schedule"}
            </Button>
            
            <Dialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow w-full sm:w-auto">
                  <PlusCircle className="mr-2 h-5 w-5 text-accent" />
                  Add New Task
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center">
                    <PlusCircle className="mr-2 h-6 w-6 text-accent" />
                    Add New Task
                  </DialogTitle>
                </DialogHeader>
                <TaskForm onAddTask={handleInternalAddTask} />
              </DialogContent>
            </Dialog>
          </>
        )}
        {/* Auth Button: Hidden on mobile (<sm), visible on sm screens and up */}
        <div className="hidden sm:flex sm:items-center">
          <AuthButtonBlock />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
