import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Task } from '@/types/task';
import { FocusMode } from '@/components/FocusMode';

type FocusOverlayContextType = {
  isOpen: boolean;
  isMinimized: boolean;
  task: Task | null;
  open: (task: Task, initialCheckInOpen?: boolean) => void;
  close: () => void;
  minimize: () => void;
  resume: () => void;
  updateFocusTime: (t: number) => void;
};

const FocusOverlayContext = createContext<FocusOverlayContextType | undefined>(undefined);

export const FocusOverlayProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [initialCheckInOpen, setInitialCheckInOpen] = useState(false);

  const open = (t: Task, initial = false) => {
    setTask(t);
    setInitialCheckInOpen(initial);
    setIsMinimized(false);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setIsMinimized(false);
    setTask(null);
    setInitialCheckInOpen(false);
  };

  const minimize = () => setIsMinimized(true);
  const resume = () => setIsMinimized(false);

  const updateFocusTime = (t: number) => {
    // Persist focus time on the task object so the overlay reflects updates
    setTask(prev => prev ? { ...prev, focusTime: t } : prev);
  };

  return (
    <FocusOverlayContext.Provider value={{ isOpen, isMinimized, task, open, close, minimize, resume, updateFocusTime }}>
      {children}
      {/* Render the actual FocusMode overlay globally so it persists across routes */}
      {isOpen && task && (
        <FocusMode
          task={task}
          onExitFocus={close}
          onOpenUnstuck={() => { /* no-op global handler; TaskDetail can render unstuck UI if needed */ }}
          onUpdateFocusTime={updateFocusTime}
          initialCheckInOpen={initialCheckInOpen}
        />
      )}
    </FocusOverlayContext.Provider>
  );
};

export const useFocusOverlay = () => {
  const ctx = useContext(FocusOverlayContext);
  if (!ctx) throw new Error('useFocusOverlay must be used within FocusOverlayProvider');
  return ctx;
};

export default FocusOverlayContext;
