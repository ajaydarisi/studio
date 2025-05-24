
"use client";

import React, { type FC } from 'react';
import { Button } from "@/components/ui/button";
import { CalendarCheck2, LogIn, LogOut, UserCircle, UserCog, PlusCircle, Sparkles } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import type { Task } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggleButton } from '@/components/ThemeToggleButton';


interface AppHeaderProps {
  // No props needed as actions are moved to page.tsx
}

const AppHeader: FC<AppHeaderProps> = React.memo(() => {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleSignOut = React.useCallback(async () => {
    const { error } = await signOut();
    if (error) {
      toast({ title: 'Logout Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    }
  }, [signOut, toast]);

  const handleGoToProfile = React.useCallback(() => {
    router.push('/profile');
  }, [router]);

  const AuthButtonBlock = React.useCallback(() => (
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
  ), [user, authLoading, handleGoToProfile, handleSignOut, router]);

  return (
    <header className="py-4 px-4 border-b mb-8"> {/* Consistent padding and bottom margin */}
      <div className="container mx-auto flex items-center justify-between w-full"> {/* Centered container */}
        <div className="flex items-center space-x-3">
            <CalendarCheck2 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Day Architect</h1>
        </div>
        <div className="flex items-center space-x-2">
            <ThemeToggleButton />
            <AuthButtonBlock />
        </div>
      </div>
    </header>
  );
});

AppHeader.displayName = 'AppHeader';
export default AppHeader;
