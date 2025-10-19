import { Task } from '@/types/task';
import { FileText, Clock, Flag, MoreVertical, Pencil, Trash2, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useConfetti } from '@/hooks/use-confetti';

interface TaskCardProps {
  task: Task;
  onTaskUpdate: () => void; // Callback to refresh tasks
}

// Helper function to get duration display text
const getDurationDisplay = (type: string) => {
  switch (type) {
    case 'short':
      return 'Short Term';
    case 'medium':
      return 'Medium Term';
    case 'long':
      return 'Long Term';
    default:
      return type;
  }
};

// Color mapping for importance levels
const getImportanceColor = (urgency: string) => {
  switch (urgency) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200 cursor-pointer';
    case 'medium':
      return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200 cursor-pointer';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200 cursor-pointer';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200 cursor-pointer';
  }
};

// Color mapping for timeframe/duration
const getTimeframeColor = (type: string) => {
  switch (type) {
    case 'long':
      return 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200';
    case 'medium':
      return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
    case 'short':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200 hover:bg-cyan-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200';
  }
};

export const TaskCard = ({ task, onTaskUpdate }: TaskCardProps) => {
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showCompleteAlert, setShowCompleteAlert] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { triggerConfetti } = useConfetti();

  // Handle field updates (importance or duration)
  const handleFieldUpdate = async (field: 'importance' | 'duration', value: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ [field]: value })
        .eq('id', task.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Task Updated',
        description: `Task ${field} updated successfully.`,
      });

      // Refresh the task list
      onTaskUpdate();

    } catch (error) {
      console.error('Field update error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : `Failed to update ${field}`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskAction = async (action: 'delete' | 'complete' | 'rename') => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-task', {
        body: {
          taskId: task.id,
          userId: user.id,
          action,
          ...(action === 'rename' && { newTaskName }),
        },
      });

      if (error) throw error;

      if (action === 'complete') {
        triggerConfetti(); // 🎉 Confetti for task completion!
        toast({
          title: 'Task Completed! 🎉',
          description: 'Congratulations on finishing your task!',
        });
      } else if (action === 'delete') {
        toast({
          title: 'Task Deleted',
          description: 'Task has been removed successfully.',
        });
      } else if (action === 'rename') {
        toast({
          title: 'Task Renamed',
          description: `Task renamed to "${newTaskName}".`,
        });
        setShowRenameDialog(false);
      }

      // Refresh the task list
      onTaskUpdate();

    } catch (error) {
      console.error('Task action error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to perform action',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openRenameDialog = () => {
    setNewTaskName(task.title);
    setShowRenameDialog(true);
  };

  return (
    <>
      <div className="py-3 px-2 hover:bg-accent/50 transition-colors rounded-md flex items-center gap-3 group">
        {/* Task Link - Only covers icon and title */}
        <Link to={`/task/${task.id}`} className="flex items-center gap-3 flex-1 min-w-0">
          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-foreground flex-1 truncate group-hover:text-primary transition-colors">
            {task.title}
          </span>
        </Link>
        
        {/* Badges for importance and timeframe */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="p-0 h-auto hover:bg-transparent"
              >
                <Badge 
                  variant="outline" 
                  className={`text-xs px-2 py-1 flex items-center gap-1 ${getImportanceColor(task.urgency)}`}
                >
                  <Flag className="w-3 h-3" />
                  {task.urgency}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px]">
              <DropdownMenuItem 
                className="flex items-center gap-2" 
                onClick={() => handleFieldUpdate('importance', 'high')}
              >
                <Badge variant="outline" className={getImportanceColor('high')}>
                  High Priority
                </Badge>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2"
                onClick={() => handleFieldUpdate('importance', 'medium')}
              >
                <Badge variant="outline" className={getImportanceColor('medium')}>
                  Medium Priority
                </Badge>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2"
                onClick={() => handleFieldUpdate('importance', 'low')}
              >
                <Badge variant="outline" className={getImportanceColor('low')}>
                  Low Priority
                </Badge>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="p-0 h-auto hover:bg-transparent"
              >
                <Badge 
                  variant="outline" 
                  className={`text-xs px-2 py-1 flex items-center gap-1 ${getTimeframeColor(task.type)}`}
                >
                  <Clock className="w-3 h-3" />
                  {task.type}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px]">
              <DropdownMenuItem 
                className="flex items-center gap-2"
                onClick={() => handleFieldUpdate('duration', 'short')}
              >
                <Badge variant="outline" className={getTimeframeColor('short')}>
                  Short Term
                </Badge>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2"
                onClick={() => handleFieldUpdate('duration', 'medium')}
              >
                <Badge variant="outline" className={getTimeframeColor('medium')}>
                  Medium Term
                </Badge>
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2"
                onClick={() => handleFieldUpdate('duration', 'long')}
              >
                <Badge variant="outline" className={getTimeframeColor('long')}>
                  Long Term
                </Badge>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Three-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={openRenameDialog} className="gap-2">
              <Pencil className="w-4 h-4" />
              Rename Task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowCompleteAlert(true)} className="gap-2">
              <Check className="w-4 h-4" />
              Complete Task
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setShowDeleteAlert(true)} 
              className="gap-2 text-red-600 focus:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
              Delete Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{task.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleTaskAction('delete')}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={showCompleteAlert} onOpenChange={setShowCompleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark "{task.title}" as completed? The task will be removed from your list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleTaskAction('complete')}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Completing...' : 'Complete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Enter new task name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTaskName.trim()) {
                  handleTaskAction('rename');
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => handleTaskAction('rename')}
                disabled={isLoading || !newTaskName.trim()}
              >
                {isLoading ? 'Renaming...' : 'Rename'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
