
"use client";

import React, { type FC } from 'react'; // Removed useState as it's no longer needed here for the dialog
import { Button } from "@/components/ui/button";
import { Sparkles, CalendarCheck2, PlusCircle, LogIn, LogOut, UserCircle, UserCog } from "lucide-react"; 
// Dialog related imports are removed as the dialog is now in page.tsx
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
// import TaskForm from "@/components/TaskForm"; // TaskForm is used in page.tsx's dialog
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
import { ThemeToggleButton } from '@/components/ThemeToggleButton';


interface AppHeaderProps {
  onSmartSchedule: () => void;
  isScheduling: boolean;
  onTriggerAddTask: () => void; // Renamed from onAddTask, this now just opens the dialog
}

const AppHeader: FC<AppHeaderProps> = ({ onSmartSchedule, isScheduling, onTriggerAddTask }) => {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({ title: 'Logout Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    }
  };

  const handleGoToProfile = () => {
    router.push('/profile');
  };

  const AuthButtonBlock = () => (
    <>
      {authLoading ? (
         <Button variant="outline" size="icon" disabled className="shadow-sm h-9 w-9 sm:h-10 sm:w-10">...</Button>
      ) : user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-full h-9 w-9 sm:h-10 sm:w-10 shadow-sm hover:shadow-md transition-shadow">
              <UserCircle className="h-5 w-5" />
               <span className="sr-only">User Menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user.user_metadata?.name || user.email}</DropdownMenuLabel>
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
        <Button onClick={() => router.push('/login')} variant="outline" size="default" className="shadow-sm hover:shadow-md transition-shadow h-9 sm:h-10 px-3 sm:px-4">
          <LogIn className="mr-0 sm:mr-2 h-5 w-5" />
          <span className="hidden sm:inline">Login</span>
        </Button>
      )}
    </>
  );

  return (
    <header className="mb-6 pb-4 border-b">
      <div className="flex flex-col sm:flex-row items-center justify-between w-full">
        {/* Top row for mobile: Logo and Auth/Theme */}
        <div className="w-full flex items-center justify-between mb-4 sm:mb-0">
            <div className="flex items-center space-x-3">
                <CalendarCheck2 className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold text-foreground">Day Architect</h1>
            </div>
            <div className="flex items-center space-x-2">
                <ThemeToggleButton />
                <AuthButtonBlock />
            </div>
        </div>

        {/* Bottom row for mobile (action buttons), part of right group for desktop */}
        {user && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                <Button onClick={onTriggerAddTask} variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow w-full sm:w-auto hidden sm:flex"> {/* Hidden on mobile, shown on sm+ */}
                    <PlusCircle className="mr-2 h-5 w-5 text-accent" />
                    Add New Task
                </Button>
                 <Button onClick={onSmartSchedule} disabled={isScheduling} variant="outline" size="lg" className="shadow-sm hover:shadow-md transition-shadow w-full sm:w-auto">
                    <Sparkles className={`mr-2 h-5 w-5 ${isScheduling ? 'animate-spin' : ''}`} />
                    {isScheduling ? "Optimizing..." : "Smart Schedule"}
                </Button>
            </div>
        )}
      </div>
    </header>
  );
};

export default React.memo(AppHeader);

    