import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Task, TaskType, UrgencyLevel } from '@/types/task';
import { getTasks } from '@/lib/taskStore';
import { TaskCard } from '@/components/TaskCard';
import { Button } from '@/components/ui/button';
import { Plus, ArrowUpDown, ExternalLink, Mic, Type, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { VoiceInput } from '@/components/VoiceInput';
import { addTask } from '@/lib/taskStore';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSortDialogOpen, setIsSortDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'importance' | 'timeframe' | 'none'>('none');
  const [inputMode, setInputMode] = useState<'audio' | 'type'>('audio');
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      navigate('/auth');
      return;
    }
    
    // Load tasks from Supabase if authenticated
    const loadTasksFromSupabase = async () => {
      console.log('🔍 Loading tasks from Supabase for user:', user.id);
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .order('id', { ascending: false });

        console.log('📊 Raw Supabase data:', data);
        console.log('❌ Supabase error:', error);

        if (error) throw error;

        // Convert Supabase tasks to the format expected by the frontend
        const convertedTasks: Task[] = data?.map(task => {
          console.log('🔄 Converting task:', task);
          return {
            id: task.id,
            title: task.task_name, // This should show the actual task name
            description: task.description || `${task.importance} priority • ${task.duration} duration`,
            type: task.duration as TaskType, // duration maps to type
            urgency: task.importance as UrgencyLevel, // importance maps to urgency
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
        }) || [];

        console.log('✅ Converted tasks:', convertedTasks);
        setTasks(convertedTasks);
      } catch (error) {
        console.error('💥 Error loading tasks from Supabase:', error);
        // Fallback to localStorage if Supabase fails
        console.log('🔄 Falling back to localStorage');
        setTasks(getTasks());
      }
    };

    loadTasksFromSupabase();
  }, [user, loading, navigate]);

  const loadTasks = () => {
    setTasks(getTasks());
  };

  // Function to refresh tasks from Supabase
  const refreshTasks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('id', { ascending: false });

      if (!error && data) {
        const convertedTasks: Task[] = data.map(task => ({
          id: task.id,
          title: task.task_name,
          description: task.description || `${task.importance} priority • ${task.duration} duration`,
          type: task.duration as TaskType,
          urgency: task.importance as UrgencyLevel,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));
        setTasks(convertedTasks);
      }
    } catch (error) {
      console.error('Error refreshing tasks:', error);
    }
  };

  const handleVoiceTranscription = (text: string) => {
    setNewTask(prev => ({ ...prev, description: text }));
  };

  const handleCreateTask = async () => {
    // Check if we have text to process
    const textToProcess = newTask.description.trim();
    if (!textToProcess) {
      toast({
        title: 'No Text to Process',
        description: 'Please provide some text or record audio first.',
        variant: 'destructive',
      });
      return;
    }

    // Check if user is authenticated
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to create tasks.',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingTasks(true);

    try {
      // Call our process-voice-tasks Edge Function
      const { data, error } = await supabase.functions.invoke('process-voice-tasks', {
        body: {
          transcribedText: textToProcess,
          userId: user.id
        }
      });

      if (error) {
        console.error('Edge Function error:', error);
        throw new Error(error.message || 'Failed to process voice input');
      }

      if (!data || !data.tasks) {
        throw new Error('No tasks were generated from the input');
      }

      // Success! Tasks were created in Supabase
      const createdTasks = data.tasks;
      
      // Clear the form
      setNewTask({
        title: '',
        description: '',
      });
      setIsDialogOpen(false);
      
      // Reload tasks from Supabase to show the new AI-generated tasks
      if (user) {
        try {
          const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('id', { ascending: false });

          if (!error && data) {
            const convertedTasks: Task[] = data.map(task => ({
              id: task.id,
              title: task.task_name, // This should be the actual task name from Gemini
              description: task.description || `${task.importance} priority • ${task.duration} duration`,
              type: task.duration as TaskType,
              urgency: task.importance as UrgencyLevel,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }));
            setTasks(convertedTasks);
          }
        } catch (error) {
          console.error('Error reloading tasks:', error);
        }
      }

      // Show success message
      toast({
        title: 'Tasks Generated!',
        description: `Successfully created ${createdTasks.length} tasks from your input using AI.`,
      });

    } catch (error) {
      console.error('Task generation error:', error);
      toast({
        title: 'Task Generation Failed',
        description: error instanceof Error ? error.message : 'Could not generate tasks. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingTasks(false);
    }
  };

  const handleSort = (type: 'importance' | 'timeframe') => {
    setSortBy(type);
    setIsSortDialogOpen(false);
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'importance') {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    } else if (sortBy === 'timeframe') {
      const typeOrder = { short: 0, medium: 1, long: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    }
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        {/* Header Section */}
        <div className="mb-16 space-y-6">
          <div className="space-y-2">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              VoicePath
            </h1>
            <p className="text-lg text-muted-foreground">Organize your thoughts, amplify your productivity</p>
          </div>
          
          <div className="flex flex-wrap gap-3 pt-2">
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setInputMode('audio');
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2 px-6 py-5 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
                  <Plus className="w-5 h-5" />
                  What's on your mind?
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">

                
                <div className="space-y-4 pt-4">
                  {/* Input Mode Toggle */}
                  <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <button
                      onClick={() => setInputMode('audio')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md font-medium transition-all ${
                        inputMode === 'audio'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                      Audio
                    </button>
                    <button
                      onClick={() => setInputMode('type')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md font-medium transition-all ${
                        inputMode === 'type'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Type className="w-4 h-4" />
                      Type
                    </button>
                  </div>

                  {/* Audio Input Mode */}
                  {inputMode === 'audio' ? (
                    <div className="space-y-4 flex flex-col items-center justify-center py-8">
                      <div className="space-y-2 w-full">
                        <div className="flex justify-center">
                          <VoiceInput onTranscription={handleVoiceTranscription} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Type Input Mode */
                    <div className="space-y-4 flex flex-col items-center justify-center py-8">
                      <div className="space-y-2 w-full">
                        <Textarea
                          value={newTask.description}
                          onChange={(e) => {
                            setNewTask({ ...newTask, description: e.target.value });
                            // Auto-expand textarea
                            const textarea = e.target;
                            textarea.style.height = 'auto';
                            textarea.style.height = Math.min(textarea.scrollHeight, 400) + 'px';
                          }}
                          placeholder="Add details..."
                          className="text-lg px-4 py-3 min-h-32 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <Button 
                      onClick={handleCreateTask} 
                      className="px-6 py-5 text-base font-semibold mt-2"
                      disabled={isGeneratingTasks || !newTask.description.trim()}
                    >
                      {isGeneratingTasks ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating Tasks...
                        </>
                      ) : (
                        'Upload!'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isSortDialogOpen} onOpenChange={setIsSortDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 px-6 py-5 text-base font-semibold hover:bg-primary/5 transition-colors duration-200">
                  <ArrowUpDown className="w-5 h-5" />
                  Sort
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-2xl">Sort Tasks</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-4">
                  <Button 
                    onClick={() => handleSort('importance')} 
                    variant="outline" 
                    className="w-full justify-start py-5 text-base hover:bg-primary/10 transition-colors duration-200"
                  >
                    Sort by Importance
                  </Button>
                  <Button 
                    onClick={() => handleSort('timeframe')} 
                    variant="outline" 
                    className="w-full justify-start py-5 text-base hover:bg-primary/10 transition-colors duration-200"
                  >
                    Sort by Timeframe
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            
          </div>
        </div>

        {/* Task List Section */}
        {sortedTasks.length === 0 ? (
          <div className="text-center py-24 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 backdrop-blur-sm">
            <p className="text-lg text-muted-foreground">No tasks yet. Create your first task to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-muted-foreground mb-4">
              {sortedTasks.length} {sortedTasks.length === 1 ? 'task' : 'tasks'}
            </div>
            {sortedTasks.map(task => (
              <div key={task.id} className="transition-all duration-200 hover:-translate-y-1">
                <TaskCard task={task} onTaskUpdate={refreshTasks} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
