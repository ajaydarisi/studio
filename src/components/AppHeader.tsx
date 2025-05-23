
"use client";

import type { FC } from 'react';
import { Button } from "@/components/ui/button";
import { Sparkles, CalendarCheck2 } from "lucide-react";

interface AppHeaderProps {
  onSmartSchedule: () => void;
  isScheduling: boolean;
}

const AppHeader: FC<AppHeaderProps> = ({ onSmartSchedule, isScheduling }) => {
  return (
    <header className="flex items-center justify-between mb-6 pb-4 border-b">
      <div className="flex items-center space-x-3">
        <CalendarCheck2 className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">Day Architect</h1>
      </div>
      <Button onClick={onSmartSchedule} disabled={isScheduling} variant="outline" size="lg">
        <Sparkles className={`mr-2 h-5 w-5 ${isScheduling ? 'animate-spin' : ''}`} />
        {isScheduling ? "Optimizing..." : "Smart Schedule"}
      </Button>
    </header>
  );
};

export default AppHeader;
