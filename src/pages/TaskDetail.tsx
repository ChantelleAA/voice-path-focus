import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Focus, Map } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FocusMode } from '@/components/FocusMode';
import { UnstuckChat } from '@/components/UnstuckChat';
import { FlowchartView } from '@/components/FlowchartView';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const TaskDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'detail' | 'focus' | 'unstuck'>('detail');
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialCheckInOpen, setInitialCheckInOpen] = useState(false);

  // Load task from Supabase
  useEffect(() => {
    const loadTask = async () => {
      setLoading(true);
      if (!id || !user) {
        navigate('/');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          const taskData: Task = {
            id: data.id,
            title: data.task_name,
            description: data.description || '',
            type: (data.duration as Task['type']) || 'medium',
            urgency: (data.importance as Task['urgency']) || 'medium',
            createdAt: new Date(data.created_at).getTime(),
            updatedAt: Date.now(),
            flowchart: data.flowchart || [],
            chatHistory: data.chat_history || [],
            focusTime: data.focus_time || 0,
          };
          setTask(taskData);
        } else {
          navigate('/');
        }
      } catch (err) {
        console.error('Error loading task:', err);
        navigate('/');
      } finally {
        setLoading(false);
        // If the page was opened with ?checkin=1, open the check-in after task loads
        if (searchParams.get('checkin') === '1') {
          setInitialCheckInOpen(true);
          setView('focus');
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('checkin');
          setSearchParams(newParams);
        }
      }
    };

    loadTask();
  }, [id, user, navigate, searchParams, setSearchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    );
  }

  const handleUpdateFocusTime = async (time: number) => {
    const { error } = await supabase
      .from('tasks')
      .update({ focus_time: time })
      .eq('id', task.id);

    if (!error) setTask({ ...task, focusTime: time });
  };

  const handleUpdateChat = (messages: Task['chatHistory']) => {
    setTask({ ...task, chatHistory: messages });
  };

  const handleUpdateFlowchart = (flowchart: Task['flowchart']) => {
    setTask({ ...task, flowchart });
  };

  if (view === 'focus') {
    return (
      <FocusMode
        task={task}
        onExitFocus={() => setView('detail')}
        onOpenUnstuck={() => setView('unstuck')}
        onUpdateFocusTime={handleUpdateFocusTime}
        initialCheckInOpen={initialCheckInOpen}
      />
    );
  }

  if (view === 'unstuck') {
    return (
      <div className="h-screen flex flex-col">
        <UnstuckChat
          task={task}
          onUpdateChat={handleUpdateChat}
          onReturnToFocus={() => setView('focus')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <Button onClick={() => setView('focus')} className="gap-2">
            <Focus className="w-4 h-4" />
            Start Focus Mode
          </Button>
        </div>

        {/* Task Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">{task.title}</h1>
          {task.description && (
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {task.description}
            </p>
          )}
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="flowchart" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="flowchart" className="gap-2">
              <Map className="w-4 h-4" />
              Visual Breakdown
            </TabsTrigger>
            <TabsTrigger value="chat">
              AI Assistant
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flowchart" className="h-[600px] border rounded-lg overflow-hidden">
            <FlowchartView
              task={task}
              onUpdateFlowchart={handleUpdateFlowchart}
            />
          </TabsContent>

          <TabsContent value="chat" className="h-[600px] border rounded-lg overflow-hidden">
            <UnstuckChat
              task={task}
              onUpdateChat={handleUpdateChat}
              onReturnToFocus={() => setView('focus')}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TaskDetail;