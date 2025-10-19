import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Task, ChatMessage } from '@/types/task';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import unstuckAssistantPromptText from '@/prompts/unstuckAssistantPrompt.txt?raw';
import { getFlowchartAsText, formatFlowchartAsText } from '@/lib/flowchartTextExtractor';

interface UnstuckChatProps {
  task: Task;
  onUpdateChat: (messages: ChatMessage[]) => void;
  onReturnToFocus: () => void;
}

export const UnstuckChat = ({ task, onUpdateChat, onReturnToFocus }: UnstuckChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>(task.chatHistory || []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Get flowchart data as text for better context
      let flowchartText = '';
      try {
        const flowchartData = await getFlowchartAsText(task.id);
        if (flowchartData) {
          flowchartText = formatFlowchartAsText(flowchartData);
        }
      } catch (error) {
        console.warn('Could not fetch flowchart data:', error);
        // Continue without flowchart data if it fails
      }

      const context = {
        title: task.title,
        description: task.description,
        type: task.type,
        urgency: task.urgency,
        subtasks: task.subtasks?.map(st => st.title),
        flowchart: task.flowchart?.map(n => n.label),
        progressNotes: task.progressNotes,
      };

      // Build enhanced prompt with flowchart data
      let enhancedPrompt = unstuckAssistantPromptText;
      
      if (flowchartText) {
        enhancedPrompt += `\n\nTASK BREAKDOWN CONTEXT:\n${flowchartText}`;
      }
      
      enhancedPrompt += `\n\nUser Question: ${input}`;

      const { data, error } = await supabase.functions.invoke('unstuck-assistant', {
        body: {
          userPrompt: enhancedPrompt,
          messages: updatedMessages,
          taskContext: context,
        },
      });

      if (error) throw error;

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message || data.response,
        timestamp: Date.now(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      onUpdateChat(finalMessages);
    } catch (error) {
      console.error('Error getting AI response:', error);
      toast({
        title: 'Error',
        description: 'Failed to get response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Unstuck Assistant</h2>
        <Button
          variant="ghost"
          onClick={onReturnToFocus}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Focus
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <p className="mb-2">I'm here to help you get unstuck!</p>
              <p className="text-sm">
                I have full context of your task. What's blocking you?
              </p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                // Render assistant responses as Markdown so code blocks, lists, links, etc. display properly
                <div className="prose max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe what's blocking you..."
            disabled={isLoading}
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
