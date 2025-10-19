import { useCallback, useEffect, useState } from 'react';
import { FlowchartNode, Task } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sparkles, Loader2, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import addContextPromptText from '@/prompts/addContextPrompt.txt?raw';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  addEdge,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface FlowchartViewProps {
  task: Task;
  onUpdateFlowchart: (nodes: FlowchartNode[]) => void;
}

type Subtask = {
  id: string;
  task_id: string;
  name: string;
  completed: boolean;
  order_index: number;
};

type DatabaseTask = {
  id: string;
  task_name: string;
  description: string | null;
  importance: 'low' | 'medium' | 'high';
  duration: 'short' | 'medium' | 'long';
  is_complete: boolean;
  has_subtasks: boolean;
  user_id: string;
};

// Constants
const VERTICAL_NODE_SPACING = 150;
const PROGRESS_COMPLETE_COLOR = 'bg-green-500';

// Custom node component with subtle styling matching app theme
const FlowchartNodeComponent = ({ data, id, isConnecting }: NodeProps & { isConnecting?: boolean }) => {
  return (
    <div 
      className={`px-4 py-2.5 bg-card border border-border rounded-md shadow-sm hover:shadow-md min-w-[150px] cursor-pointer transition-all duration-200 ${
        isConnecting ? 'opacity-50' : 'opacity-100'
      }`}
      onClick={() => data.onNodeClick?.(id)}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} />
      <div className="font-medium text-sm text-foreground">{data.label}</div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

const nodeTypes = { flowchartNode: FlowchartNodeComponent };

export const FlowchartView = ({ task, onUpdateFlowchart }: FlowchartViewProps) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [dbTask, setDbTask] = useState<DatabaseTask | null>(null);
  const [hasExistingSubtasks, setHasExistingSubtasks] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rfInstance, setRfInstance] = useState<any>(null);
  const { toast } = useToast();

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleAddContextViaLLM = useCallback(async (contextPrompt: string): Promise<string> => {
    try {
      const fullPrompt = `${addContextPromptText}\n\n${contextPrompt}`;

      const { data, error } = await supabase.functions.invoke('unstuck-assistant', {
        body: {
          userPrompt: fullPrompt,
        },
      });

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to get context assistance',
          variant: 'destructive',
        });
        throw error;
      }

      if (data?.response) {
        return data.response;
      } else {
        throw new Error('No response received from assistant');
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to generate context',
        variant: 'destructive',
      });
      throw err;
    }
  }, [toast]);

  const convertToReactFlowWithHandlers = useCallback((nodes: FlowchartNode[]) => {
    const reactFlowNodes: Node[] = nodes.map((node, idx) => ({
      id: node.id,
      type: 'flowchartNode',
      position: { x: 0, y: idx * VERTICAL_NODE_SPACING },
      data: { 
        label: node.label,
        onNodeClick: handleNodeClick,
      },
    }));

    const reactFlowEdges: Edge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      reactFlowEdges.push({
        id: `e${i}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        type: 'straight',
      });
    }

    return { nodes: reactFlowNodes, edges: reactFlowEdges };
  }, [handleNodeClick]);

  const initialFlow = task.flowchart
    ? convertToReactFlowWithHandlers(task.flowchart)
    : { nodes: [], edges: [] };

  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow.edges);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, type: 'straight' }, eds));
  }, [setEdges]);

  const handleAddNode = useCallback(() => {
    const maxId = nodes.reduce<number>((acc, n) => {
      const asNum = parseInt(n.id, 10);
      return Number.isFinite(asNum) ? Math.max(acc, asNum) : acc;
    }, 0);
    const newId = String(maxId + 1);
    const newNode: Node = {
      id: newId,
      type: 'flowchartNode',
      position: { x: 0, y: nodes.length * VERTICAL_NODE_SPACING },
      data: { 
        label: `Step ${newId}`,
        onNodeClick: handleNodeClick,
      },
    };
    setNodes(nds => [...nds, newNode]);
  }, [nodes, setNodes, handleNodeClick]);

  const handleDeleteNode = useCallback((id: string) => {
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setNodes(nds => nds.filter(n => n.id !== id));
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const handleSaveSelected = useCallback((title: string, description: string = '') => {
    setNodes(nds => nds.map(n => 
      n.id === selectedNodeId 
        ? { 
            ...n, 
            data: { 
              ...n.data, 
              label: title,
              description,
              onNodeClick: handleNodeClick,
            } 
          }
        : n
    ));
    setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, handleNodeClick]);

  const createDatabaseTask = useCallback(async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const newTask = {
        id: task.id,
        task_name: task.title,
        description: task.description,
        importance: task.urgency as 'low' | 'medium' | 'high',
        duration: task.type as 'short' | 'medium' | 'long',
        is_complete: false,
        has_subtasks: false,
        user_id: user.user.id,
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert([newTask])
        .select()
        .single();

      if (error) throw error;
      setDbTask(data);
    } catch (error) {
      console.error('Error creating database task:', error);
    }
  }, [task.id, task.title, task.description, task.urgency, task.type]);


  // Load database task and subtasks on mount
  const loadDatabaseTask = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', task.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading database task:', error);
        return;
      }

      if (data) {
        setDbTask(data);
      } else {
        // Create database task if it doesn't exist
        await createDatabaseTask();
      }
    } catch (error) {
      console.error('Error loading database task:', error);
    }
  }, [task.id, createDatabaseTask]);

  const loadExistingSubtasks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', task.id)
        .order('order_index');

      if (error) throw error;
      
      if (data && data.length > 0) {
        setSubtasks(data);
        setHasExistingSubtasks(true);
        // Convert existing subtasks to flowchart nodes and display
        const nodes = data.map(subtask => ({
          id: subtask.order_index.toString(),
          label: subtask.name,
          context: `Subtask ${subtask.order_index}`
        }));
        
        const { nodes: reactFlowNodes, edges: reactFlowEdges } = convertToReactFlowWithHandlers(nodes);
        setNodes(reactFlowNodes);
        setEdges(reactFlowEdges);
        onUpdateFlowchart(nodes);
      }
    } catch (error) {
      console.error('Error loading subtasks:', error);
    }
  }, [task.id, setNodes, setEdges, onUpdateFlowchart, convertToReactFlowWithHandlers]);

  // Initialize on mount - load task and existing subtasks
  useEffect(() => {
    const initializeComponent = async () => {
      await loadDatabaseTask();
      await loadExistingSubtasks();
    };
    
    initializeComponent();
  }, []); // Empty dependency array to run only once

  const generateFlowchart = async () => {
    if (!prompt.trim() && !task.title) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-flowchart', {
        body: {
          taskId: task.id,
          taskName: task.title,
          importance: task.urgency,
          duration: task.type,
        },
      });

      if (error) throw error;

      if (data?.flowchart) {
        const flowchart: FlowchartNode[] = data.flowchart;
        const { nodes: newNodes, edges: newEdges } = convertToReactFlowWithHandlers(flowchart);
        setNodes(newNodes);
        setEdges(newEdges);
        onUpdateFlowchart(flowchart);
        
        toast({
          title: 'Flowchart Generated',
          description: 'Your task breakdown has been created.',
        });
        setPrompt('');
      }
    } catch (error) {
      console.error('Error generating flowchart:', error);
      toast({
        title: 'Generation Failed',
        description: 'Could not generate flowchart. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateSubtasks = async () => {
    if (!dbTask) return;

    setIsGenerating(true);
    try {
      // Delete existing subtasks
      await supabase
        .from('subtasks')
        .delete()
        .eq('task_id', dbTask.id);

      // Update task to mark as no subtasks
      await supabase
        .from('tasks')
        .update({ has_subtasks: false })
        .eq('id', dbTask.id);

      // Clear local state
      setSubtasks([]);
      setHasExistingSubtasks(false);
      setNodes([]);
      setEdges([]);

      // Generate new subtasks
      await generateFlowchart();
    } catch (error) {
      console.error('Error regenerating subtasks:', error);
      toast({
        title: 'Regeneration Failed',
        description: 'Failed to regenerate subtasks. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSubtaskStatus = async (subtaskId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('subtasks')
        .update({ completed })
        .eq('id', subtaskId);

      if (error) throw error;

      // Update local state
      setSubtasks(prev => 
        prev.map(subtask => 
          subtask.id === subtaskId ? { ...subtask, completed } : subtask
        )
      );

      toast({
        title: completed ? 'Subtask Completed!' : 'Subtask Reopened',
        description: completed ? 'Great progress!' : 'Subtask marked as incomplete',
      });
    } catch (error) {
      console.error('Error updating subtask:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update subtask status',
        variant: 'destructive',
      });
    }
  };

  const completedCount = subtasks.filter(s => s.completed).length;
  const totalCount = subtasks.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Task Info Header */}
      {dbTask && (
        <div className="p-4 border-b bg-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{dbTask.task_name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{dbTask.description}</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2 py-1 rounded">
                {dbTask.duration}
              </span>
              <span className="bg-orange-100 text-orange-800 border border-orange-200 px-2 py-1 rounded">
                {dbTask.importance}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Controls Section */}
      <div className="p-4 border-b bg-background space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-foreground">Task Breakdown</h4>
          
          {hasExistingSubtasks && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {subtasks.length} subtasks
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={regenerateSubtasks}
                disabled={isGenerating}
                className="gap-1 h-8"
              >
                {isGenerating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Regenerate
              </Button>
            </div>
          )}
        </div>

        {/* Generate Button for new tasks */}
        {!hasExistingSubtasks && dbTask?.duration !== 'short' && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Breakdown Strategy</Label>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe how to break down this task..."
              disabled={isGenerating}
              className="text-sm"
            />
            <Button
              onClick={generateFlowchart}
              disabled={isGenerating}
              className="gap-2 w-full"
              variant="default"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Graph
                </>
              )}
            </Button>
          </div>
        )}

        {/* Add Node Button */}
        {hasExistingSubtasks && (
          <Button 
            variant="outline" 
            className="gap-2 w-full"
            onClick={handleAddNode}
          >
            <Plus className="w-4 h-4" />
            Add Step
          </Button>
        )}

        {/* Short task message */}
        {dbTask?.duration === 'short' && (
          <div className="text-sm text-orange-800 bg-orange-50 p-3 rounded border border-orange-200">
            This is a short task - tackle it directly without breaking it down.
          </div>
        )}
      </div>

      {/* Flowchart/Subtasks Display */}
      <div className="flex-1 bg-background overflow-hidden">
        {nodes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-3">
              <p className="text-sm">
                {dbTask?.duration === 'short' 
                  ? 'Short tasks don\'t need subtasks'
                  : hasExistingSubtasks 
                    ? 'No subtasks found' 
                    : 'Generate graph to visualize task steps'
                }
              </p>
              {!hasExistingSubtasks && dbTask?.duration !== 'short' && (
                <Button
                  onClick={generateFlowchart}
                  disabled={isGenerating}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Get Started
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col sm:flex-row">
            {/* Flowchart Visualization */}
            <div className="flex-1 bg-background">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                nodeTypes={nodeTypes}
              >
                <Background />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </div>
            
            {/* Subtasks Checklist Sidebar */}
            {subtasks.length > 0 && (
              <div className="w-80 border-l bg-background flex flex-col">
                <div className="p-4 border-b">
                  <h4 className="font-semibold text-foreground">Progress Checklist</h4>
                </div>
                
                {/* Scrollable Checklist Items */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-3 space-y-2">
                    {subtasks.map((subtask) => (
                      <label 
                        key={subtask.id}
                        className="flex items-start gap-3 p-2 hover:bg-accent rounded-md cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={subtask.completed}
                          onChange={(e) => updateSubtaskStatus(subtask.id, e.target.checked)}
                          className="mt-1 rounded border-muted-foreground"
                        />
                        <div className="flex-grow min-w-0">
                          <p className={`text-sm font-medium ${
                            subtask.completed 
                              ? 'text-muted-foreground line-through' 
                              : 'text-foreground'
                          }`}>
                            {subtask.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Step {subtask.order_index}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Progress Summary - Sticky at Bottom */}
                <div className="border-t p-4 bg-card">
                  <div className="text-xs text-muted-foreground mb-2">
                    Progress: {completedCount} of {totalCount} ({Math.round(progressPercentage)}%)
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`${PROGRESS_COMPLETE_COLOR} h-2 rounded-full transition-all duration-300`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Node Sheet */}
      <Sheet open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNodeId(null)}>
        <SheetContent side="right" className="sm:max-w-lg w-full">
          <SheetHeader>
            <SheetTitle>Edit Step</SheetTitle>
          </SheetHeader>
          {selectedNode && (
            <EditNodeForm
              initialLabel={selectedNode.data.label}
              initialDescription={selectedNode.data.description || ''}
              onCancel={() => setSelectedNodeId(null)}
              onDelete={() => handleDeleteNode(selectedNode.id)}
              onSubmit={(label, description) => handleSaveSelected(label, description)}
              sendPromptToLLM={handleAddContextViaLLM}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

interface EditNodeFormProps {
  initialLabel: string;
  initialDescription?: string;
  onSubmit: (label: string, description: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
  sendPromptToLLM: (text: string) => Promise<string>;
}

const EditNodeForm = ({ initialLabel, initialDescription = '', onSubmit, onCancel, onDelete, sendPromptToLLM }: EditNodeFormProps) => {
  const [label, setLabel] = useState(initialLabel);
  const [description, setDescription] = useState(initialDescription);
  const [contextText, setContextText] = useState('');
  const [isSubmittingContext, setIsSubmittingContext] = useState(false);
  const { toast } = useToast();

  const handleAddContext = useCallback(async () => {
    if (!contextText.trim()) return;
    
    setIsSubmittingContext(true);
    try {
      const masterPrompt = `Title: ${label}

Description:
${description}

User Request: ${contextText}

Based on the above context, please provide additional helpful details and context that would improve this block.`;

      const responseText = await sendPromptToLLM(masterPrompt);
      
      // Update the description field with the LLM response
      setDescription(responseText);
      
      toast({
        title: 'Success',
        description: 'Context has been added to the description field',
      });
      setContextText('');
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to generate context',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingContext(false);
    }
  }, [contextText, label, description, toast, sendPromptToLLM, setDescription]);

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="step-title" className="text-sm font-medium">Step Title</Label>
        <Input 
          id="step-title"
          value={label} 
          onChange={(e) => setLabel(e.target.value)} 
          placeholder="Enter step title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="step-description" className="text-sm font-medium">Description</Label>
        <Textarea 
          id="step-description"
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          placeholder="Enter step description..."
          className="h-24"
        />
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t">
        <div className="flex gap-2">
          {onDelete && (
            <Button 
              type="button" 
              variant="destructive" 
              size="sm"
              className="gap-2" 
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="button" size="sm" onClick={() => onSubmit(label, description)}>Save</Button>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t">
        <Label htmlFor="context-input" className="text-sm font-medium">Add Context via LLM</Label>
        <Input
          id="context-input"
          value={contextText}
          onChange={(e) => setContextText(e.target.value)}
          placeholder="Type extra context here..."
        />
        <Button
          type="button"
          className="w-full gap-2"
          size="sm"
          disabled={isSubmittingContext || !contextText.trim()}
          onClick={handleAddContext}
        >
          {isSubmittingContext ? 'Submitting...' : 'Submit for more context'}
        </Button>
      </div>
    </div>
  );
};
