import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Play, Pause, X } from 'lucide-react';
import { ProgressCheckIn } from './ProgressCheckIn';

interface FocusModeProps {
  task: Task;
  onExitFocus: () => void;
  onOpenUnstuck: () => void;
  onUpdateFocusTime: (time: number) => void;
}

export const FocusMode = ({ task, onExitFocus, onOpenUnstuck, onUpdateFocusTime, initialCheckInOpen }: FocusModeProps & { initialCheckInOpen?: boolean }) => {
  const [isActive, setIsActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(task.focusTime || 0);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState(Date.now());
  
  const checkInInterval = (task.checkInInterval || 1) * 60 * 1000;

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
                  window.location.href = `/tasks/${task.id}?checkin=1`;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/30 flex flex-col">
      <div className="p-6 flex justify-between items-center border-b">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Focus Mode</p>
          <h1 className="text-2xl font-bold">{task.title}</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={onExitFocus}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-8 max-w-2xl">
          {task.description && (
            <p className="text-lg text-muted-foreground">
              {task.description}
            </p>
          )}

          <div className="space-y-4">
            <div className="text-7xl font-mono font-bold tracking-tight">
              {formatTime(elapsedTime)}
            </div>
            
            <div className="flex gap-4 justify-center">
              {!isActive ? (
                <Button
                  size="lg"
                  onClick={async () => {
                    const granted = await ensureNotificationPermission();
                    if (!granted) {
                      // If permission denied, don't allow focus mode to start
                      // Use a window alert or you can integrate toast if available
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

          <p className="text-sm text-muted-foreground">
            Check-in reminder every {task.checkInInterval || 1} minutes
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
