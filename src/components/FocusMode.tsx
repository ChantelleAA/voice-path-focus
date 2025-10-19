import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Play, Pause, X, ArrowLeft } from 'lucide-react';
import { ProgressCheckIn } from './ProgressCheckIn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FocusModeProps {
  task: Task;
  onExitFocus: () => void;
  onOpenUnstuck: () => void;
  onUpdateFocusTime: (time: number) => void;
  onMinimize?: () => void;
  externalElapsedTime?: number;
  externalIsActive?: boolean;
  onTimerActiveChange?: (isActive: boolean) => void;
}

export const FocusMode = ({ task, onExitFocus, onOpenUnstuck, onUpdateFocusTime, onMinimize, externalElapsedTime, externalIsActive, onTimerActiveChange, initialCheckInOpen }: FocusModeProps & { initialCheckInOpen?: boolean }) => {
  const [isActive, setIsActive] = useState(externalIsActive ?? false);
  const [elapsedTime, setElapsedTime] = useState(externalElapsedTime ?? task.focusTime ?? 0);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState(Date.now());
  // Always start in full-screen mode, not minimized
  const [isMinimized, setIsMinimized] = useState(false);
  const [checkInMinutes, setCheckInMinutes] = useState(task.checkInInterval || 1);
  
  const checkInInterval = checkInMinutes * 60 * 1000;

  // Sync with external elapsed time if provided
  useEffect(() => {
    if (externalElapsedTime !== undefined) {
      setElapsedTime(externalElapsedTime);
    }
  }, [externalElapsedTime]);

  // Sync with external active state if provided
  useEffect(() => {
    if (externalIsActive !== undefined) {
      setIsActive(externalIsActive);
    }
  }, [externalIsActive]);

  // Notify parent when timer active state changes
  useEffect(() => {
    if (onTimerActiveChange) {
      onTimerActiveChange(isActive);
    }
  }, [isActive, onTimerActiveChange]);

  // Log to debug - remove this after testing
  useEffect(() => {
    console.log('FocusMode mounted, isMinimized:', isMinimized);
  }, []);

  useEffect(() => {
    console.log('isMinimized changed to:', isMinimized);
  }, [isMinimized]);

  useEffect(() => {
    if (initialCheckInOpen) {
      setShowCheckIn(true);
      setIsActive(false);
    }
  }, [initialCheckInOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isActive) {
      interval = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          onUpdateFocusTime(newTime);
          return newTime;
        });
        
        const timeSinceCheckIn = Date.now() - lastCheckIn;
        if (timeSinceCheckIn >= checkInInterval) {
          setShowCheckIn(true);
          setIsActive(false);
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              const title = "How's it going?!";
              const body = `Tap to check in on "${task.title}"`;
              const notif = new Notification(title, { body });
              notif.onclick = () => {
                try {
                  window.focus();
                  // Use the correct task route
                  window.location.href = `/task/${task.id}?checkin=1`;
                } catch (e) {
                }
              };
            }
          } catch (e) {}
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isActive, lastCheckIn, checkInInterval, onUpdateFocusTime]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTick = () => {
    setShowCheckIn(false);
    setLastCheckIn(Date.now());
    setIsActive(true);
  };

  const ensureNotificationPermission = async (): Promise<boolean> => {
    try {
      if (typeof Notification === 'undefined') return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch (e) {
      return false;
    }
  };

  const handleUnstuck = () => {
    setShowCheckIn(false);
    onOpenUnstuck();
  };

  // When minimized, render only the compact overlay in top-right
  if (isMinimized) {
    console.log('Rendering MINIMIZED overlay');
    return (
      <>
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-card border border-border rounded-lg p-2.5 px-4 flex items-center gap-3 shadow-lg">
            <div 
              className="font-mono font-semibold text-base cursor-pointer hover:text-primary transition-colors"
              onClick={() => setIsMinimized(false)}
              title="Click to expand focus mode"
            >
              {formatTime(elapsedTime)}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsActive(prev => !prev)}
              className="h-8 w-8 p-0"
              aria-label={isActive ? 'Pause timer' : 'Start timer'}
            >
              {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={onExitFocus}
              aria-label="Exit focus mode"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <ProgressCheckIn
          open={showCheckIn}
          onTick={handleTick}
          onUnstuck={handleUnstuck}
        />
      </>
    );
  }

  console.log('Rendering FULL SCREEN focus mode');
  return (
    <div className="fixed inset-0 z-50 min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex flex-col overflow-auto">
      <div className="p-6 flex justify-between items-center border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => {
            // Notify parent to show minimized overlay and exit focus view
            if (onMinimize) {
              onMinimize();
            }
            onExitFocus();
          }} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </Button>

          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Focus Mode</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{task.title}</h1>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={onExitFocus}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-8 max-w-2xl">
          {task.description && (
            <p className="text-lg text-gray-700 dark:text-gray-300">
              {task.description}
            </p>
          )}

          <div className="space-y-4">
            <div className="text-7xl font-mono font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {formatTime(elapsedTime)}
            </div>
            
            <div className="flex gap-4 justify-center">
              {!isActive ? (
                <Button
                  size="lg"
                  onClick={async () => {
                    const granted = await ensureNotificationPermission();
                    if (!granted) {
                      alert('Notification permission is required to use Focus Mode. Please enable notifications in your browser settings.');
                      return;
                    }
                    setIsActive(true);
                  }}
                  className="gap-2 px-8"
                >
                  <Play className="w-5 h-5" />
                  Start Focus
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => setIsActive(false)}
                  className="gap-2 px-8"
                >
                  <Pause className="w-5 h-5" />
                  Pause
                </Button>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center justify-center gap-2">
            Check-in reminder every 
            <Select 
              value={checkInMinutes.toString()} 
              onValueChange={(value) => setCheckInMinutes(parseInt(value))}
            >
              <SelectTrigger className="w-20 h-7 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="45">45</SelectItem>
                <SelectItem value="60">60</SelectItem>
              </SelectContent>
            </Select>
            {checkInMinutes === 1 ? 'minute' : 'minutes'}
          </p>
        </div>
      </div>

      <ProgressCheckIn
        open={showCheckIn}
        onTick={handleTick}
        onUnstuck={handleUnstuck}
      />
    </div>
  );
};
