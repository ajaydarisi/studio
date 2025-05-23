
"use client";

import React, { type FC, useState } from 'react'; // Added React
import { Button } from "@/components/ui/button";
import { Sparkles, CalendarCheck2, PlusCircle, LogIn, LogOut, UserCircle, UserCog, Settings2 } from "lucide-react"; 
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
  onAddTask: (description: string, estimatedTime: number) => Promise<void>;
}

const AppHeader: FC<AppHeaderProps> = ({ onSmartSchedule, isScheduling, onAddTask }) => {
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
  const { user, signOut, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleInternalAddTask = async (description: string, estimatedTime: number): Promise<void> => {
    try {
      await onAddTask(description, estimatedTime);
      setIsAddTaskDialogOpen(false); // Close dialog on successful add
    } catch (error) {
      // Error is likely handled by onAddTask (toast shown there),
      // but we keep the dialog open for correction if needed.
      console.error("Error from onAddTask in AppHeader:", error);
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({ title: 'Logout Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      // router.push('/login'); // AuthContext handles redirect
    }
  };

  const handleGoToProfile = () => {
    router.push('/profile');
  };

  const AuthButtonBlock = () => (
    <>
      {authLoading ? (
         <Button variant="outline" size="lg" disabled className="shadow-sm">Loading...</Button>
      ) : user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow">
              <UserCircle className="mr-2 h-5 w-5" />
              {user.user_metadata?.name || user.email?.split('@')[0] || 'Account'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleGoToProfile} className="cursor-pointer">
              <UserCog className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
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
    <header className="mb-6 pb-4 border-b">
      {/* Top Row: Logo (Left) and Auth (Right) - Always this structure */}
      <div className="flex items-center justify-between w-full mb-2 sm:mb-0">
        <div className="flex items-center space-x-3">
          <CalendarCheck2 className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Day Architect</h1>
        </div>
        <div className="sm:hidden"> {/* Auth buttons shown here only on mobile, top right */}
          <AuthButtonBlock />
        </div>
        <div className="hidden sm:flex"> {/* Auth buttons shown here only on desktop */}
          <AuthButtonBlock />
        </div>
      </div>

      {/* Bottom Row on mobile / Right group on desktop: Action Buttons */}
      {/* This div will stack buttons vertically on mobile, and row on sm+ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 w-full mt-2 sm:mt-0">
        {user && (
          <>
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
            <Button onClick={onSmartSchedule} disabled={isScheduling} variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow w-full sm:w-auto">
              <Sparkles className={`mr-2 h-5 w-5 ${isScheduling ? 'animate-spin' : ''}`} />
              {isScheduling ? "Optimizing..." : "Smart Schedule"}
            </Button>
          </>
        )}
      </div>
    </header>
  );
};

export default React.memo(AppHeader);

    