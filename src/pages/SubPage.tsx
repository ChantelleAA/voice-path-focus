import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  NodeProps,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { z } from 'zod';
import addContextPromptText from '@/prompts/addContextPrompt.txt?raw';
import unstuckAssistantPromptText from '@/prompts/unstuckAssistantPrompt.txt?raw';

// Constants
const VERTICAL_NODE_SPACING = 140;
const DEFAULT_NODE_OFFSET_X = 150;
const SNAP_GRID: [number, number] = [16, 16];
const LLM_CONFIG = {
  model: 'gemini-2.5-flash',
  temperature: 0.2,
  maxOutputTokens: 400,
} as const;

// Schema validation
const LLMResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.array(z.object({ text: z.string() })).optional()
  })).optional(),
  output: z.array(z.object({
    content: z.array(z.object({ text: z.string() })).optional()
  })).optional(),
}).passthrough();

type Step = {
  id: string;
  title: string;
  details: string[];
};

type StepsJson = {
  steps: Step[];
};

type StepNodeData = {
  title: string;
  details: string[];
  completed?: boolean;
  onToggleComplete?: (nodeId: string) => void;
};

const StepNode = ({ data, selected, isConnecting, id }: NodeProps<StepNodeData> & { isConnecting?: boolean }) => {
  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onToggleComplete?.(id);
  };

  return (
    <div 
      className={`
        border rounded-md shadow-md min-w-[220px] max-w-[360px] 
        transition-all duration-300 ease-out
        ${data.completed ? 'bg-emerald-50 border-emerald-300' : 'bg-card'}
        ${selected ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-lg'}
        ${isConnecting ? 'opacity-50' : ''}
        cursor-grab active:cursor-grabbing
      `}
      style={{
        userSelect: 'none',
      }}
    >
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <div className={`font-semibold flex-1 ${data.completed ? 'text-emerald-700' : 'text-foreground'}`}>{data.title}</div>
        <button
          onClick={handleToggleComplete}
          className="flex-shrink-0 hover:scale-110 transition-transform duration-150 cursor-pointer"
          title={data.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {data.completed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
          )}
        </button>
      </div>
      {data.details?.length ? (
        <ul className={`p-3 text-sm list-disc list-inside space-y-1 ${data.completed ? 'text-emerald-600 line-through' : 'text-muted-foreground'}`}>
          {data.details.map((d, i) => (
            <li key={`${d}-${i}`}>{d}</li>
          ))}
        </ul>
      ) : (
        <div className={`p-3 text-sm italic ${data.completed ? 'text-emerald-600 line-through' : 'text-muted-foreground'}`}>No details</div>
      )}
      <Handle type="target" position={Position.Top} id="top-target" className="w-2 h-2" />
      <Handle type="source" position={Position.Top} id="top-source" className="w-2 h-2" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="w-2 h-2" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="w-2 h-2" />
      <Handle type="target" position={Position.Left} id="left-target" className="w-2 h-2" />
      <Handle type="source" position={Position.Left} id="left-source" className="w-2 h-2" />
      <Handle type="target" position={Position.Right} id="right-target" className="w-2 h-2" />
      <Handle type="source" position={Position.Right} id="right-source" className="w-2 h-2" />
    </div>
  );
};

const nodeTypes = { stepNode: StepNode } as const;

const SubPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<'text' | 'json'>('text');
  const [fillMissing, setFillMissing] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [repromptInput, setRepromptInput] = useState('');
  const [isReprompting, setIsReprompting] = useState(false);
  const toggleListenerRef = useRef<(e: Event) => void>();

  const [nodes, setNodes, onNodesChange] = useNodesState<StepNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [isUnstuckAssistantEnabled, setIsUnstuckAssistantEnabled] = useState(false);
  const [unstuckPrompt, setUnstuckPrompt] = useState('');
  const [isUnstuckReprompting, setIsUnstuckReprompting] = useState(false);
  const [unstuckResponse, setUnstuckResponse] = useState('');

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) as Node<StepNodeData> | undefined, [nodes, selectedNodeId]);

  const parseTextToSteps = useCallback((raw: string, shouldFillMissing: boolean): Step[] => {
    const lines = raw.split(/\r?\n/);
    const steps: Step[] = [];
    const stepRegex = /^\s*(\d+)\.\s*(.+)$/;
    let current: Step | null = null;
    let lastNumber: number | null = null;

    for (const line of lines) {
      const m = line.match(stepRegex);
      if (m) {
        const num = parseInt(m[1], 10);
        const title = m[2].trim();
        if (current) steps.push(current);
        if (shouldFillMissing && lastNumber !== null && num > lastNumber + 1) {
          for (let missing = lastNumber + 1; missing < num; missing++) {
            steps.push({ id: String(missing), title: `Step ${missing}`, details: [] });
          }
        }
        current = { id: String(num), title, details: [] };
        lastNumber = num;
      } else {
        const content = line.trim();
        if (content && current) current.details.push(content);
      }
    }
    if (current) steps.push(current);
    return steps;
  }, []);

  const stepsToFlow = useCallback((steps: Step[]): { nodes: Node<StepNodeData>[]; edges: Edge[] } => {
    const n: Node<StepNodeData>[] = steps.map((s, i) => ({
      id: s.id,
      type: 'stepNode',
      position: { x: 0, y: i * VERTICAL_NODE_SPACING },
      data: { 
        title: s.title, 
        details: s.details, 
        completed: false,
        onToggleComplete: handleToggleNodeCompletion,
      },
    }));
    const e: Edge[] = steps.slice(0, -1).map((s, i) => ({
      id: `e-${s.id}-${steps[i + 1].id}`,
      source: s.id,
      target: steps[i + 1].id,
      type: 'default',
    }));
    return { nodes: n, edges: e };
  }, []);

  const handleToggleNodeCompletion = useCallback((nodeId: string) => {
    setNodes(nds => nds.map(n => 
      n.id === nodeId 
        ? { ...n, data: { ...n.data, completed: !n.data.completed } } 
        : n
    ));
  }, [setNodes]);

  const createFlowFromSteps = useCallback((steps: Step[]) => {
    const { nodes: newNodes, edges: newEdges } = stepsToFlow(steps);
    setNodes(newNodes);
    setEdges(newEdges);
    setTimeout(() => rfInstance?.fitView({ padding: 0.2 }), 0);
  }, [stepsToFlow, setNodes, setEdges, rfInstance]);

  const parseJsonFlow = useCallback((jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && Array.isArray(parsed.steps)) {
        const steps: Step[] = parsed.steps.map((s: any) => ({
          id: String(s.id),
          title: String(s.title || ''),
          details: Array.isArray(s.details) ? s.details.map((d: any) => String(d)) : [],
        }));
        createFlowFromSteps(steps);
        return true;
      } else if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
        // Import full graph
        const importedNodes: Node<StepNodeData>[] = parsed.nodes.map((n: any) => ({
          id: String(n.id),
          type: n.type === 'stepNode' ? 'stepNode' : 'stepNode',
          position: n.position || { x: 0, y: 0 },
          data: {
            title: n.data?.title ?? n.data?.label ?? 'Untitled',
            details: Array.isArray(n.data?.details) ? n.data.details : [],
            completed: n.data?.completed ?? false,
            onToggleComplete: handleToggleNodeCompletion,
          },
        }));
        const importedEdges: Edge[] = parsed.edges.map((e: any) => ({
          id: String(e.id ?? `e-${e.source}-${e.target}`),
          source: String(e.source),
          target: String(e.target),
          type: e.type || 'default',
        }));
        setNodes(importedNodes);
        setEdges(importedEdges);
        setTimeout(() => rfInstance?.fitView({ padding: 0.2 }), 0);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [createFlowFromSteps, setNodes, setEdges, rfInstance, handleToggleNodeCompletion]);

  const parseAndBuild = useCallback(() => {
    if (mode === 'text') {
      const steps = parseTextToSteps(textInput, fillMissing);
      createFlowFromSteps(steps);
    } else {
      const success = parseJsonFlow(jsonInput);
      if (!success) {
        toast({
          title: 'Invalid JSON',
          description: 'Please provide valid JSON with steps array or nodes/edges arrays',
          variant: 'destructive',
        });
      }
    }
  }, [mode, textInput, jsonInput, fillMissing, parseTextToSteps, createFlowFromSteps, parseJsonFlow, toast]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node<StepNodeData>) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleImportFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setJsonInput(reader.result);
        setMode('json');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleAddNode = useCallback(() => {
    const maxId = nodes.reduce<number>((acc, n) => {
      const asNum = parseInt(n.id, 10);
      return Number.isFinite(asNum) ? Math.max(acc, asNum) : acc;
    }, 0);
    const newId = String(maxId + 1);
    const center = rfInstance?.project({ x: window.innerWidth / 2 - DEFAULT_NODE_OFFSET_X, y: 120 }) || { x: 0, y: 0 };
    const newNode: Node<StepNodeData> = {
      id: newId,
      type: 'stepNode',
      position: center,
      data: { 
        title: `Step ${newId}`, 
        details: [], 
        completed: false,
        onToggleComplete: handleToggleNodeCompletion,
      },
    };
    setNodes(nds => [...nds, newNode]);
  }, [nodes, rfInstance, setNodes, handleToggleNodeCompletion]);

  const handleDeleteNode = useCallback((id: string) => {
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setNodes(nds => nds.filter(n => n.id !== id));
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const handleSaveSelected = useCallback((title: string, detailsText: string) => {
    const details = detailsText
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
    setNodes(nds => nds.map(n => 
      n.id === selectedNodeId 
        ? { 
            ...n, 
            data: { 
              ...n.data, 
              title, 
              details,
              onToggleComplete: handleToggleNodeCompletion,
            } 
          } as Node<StepNodeData>
        : n
    ));
    setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, handleToggleNodeCompletion]);

  const handleReprompt = useCallback(async () => {
    if (!repromptInput.trim()) return;
    
    setIsReprompting(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-flowchart', {
        body: {
          taskTitle: 'Flow Refinement',
          taskDescription: repromptInput,
          taskType: 'medium',
          prompt: repromptInput,
        },
      });

      if (error) {
        toast({
          title: 'Reprompt Failed',
          description: 'Failed to generate flowchart. Please try again.',
          variant: 'destructive',
        });
      } else if (data?.flowchart) {
        const newFlowchart = data.flowchart;
        const newNodes: Node<StepNodeData>[] = newFlowchart.map((s: any, i: number) => ({
          id: s.id || `node-${i}`,
          type: 'stepNode',
          position: { x: 0, y: i * VERTICAL_NODE_SPACING },
          data: { 
            title: s.label || s.title || `Step ${i + 1}`, 
            details: s.context ? [s.context] : [], 
            completed: false,
            onToggleComplete: handleToggleNodeCompletion,
          },
        }));
        const newEdges: Edge[] = newFlowchart.slice(0, -1).map((s: any, i: number) => ({
          id: `e-${s.id || `node-${i}`}-${newFlowchart[i + 1]?.id || `node-${i + 1}`}`,
          source: s.id || `node-${i}`,
          target: newFlowchart[i + 1]?.id || `node-${i + 1}`,
          type: 'default',
        }));
        setNodes(newNodes);
        setEdges(newEdges);
        toast({
          title: 'Success',
          description: 'Flowchart updated successfully',
        });
        setRepromptInput('');
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to process reprompt request',
        variant: 'destructive',
      });
    } finally {
      setIsReprompting(false);
    }
  }, [repromptInput, setNodes, setEdges, handleToggleNodeCompletion, toast]);

  const sendPromptToLLM = useCallback(async (text: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-flowchart', {
        body: { prompt: text }
      });

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to get LLM response',
          variant: 'destructive',
        });
        throw error;
      }

      return data?.response;
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to invoke LLM function',
        variant: 'destructive',
      });
      throw err;
    }
  }, [toast]);

  const handleUnstuckAssistant = useCallback(async () => {
    if (!unstuckPrompt.trim()) return;

    setIsUnstuckReprompting(true);
    try {
      const fullPrompt = `${unstuckAssistantPromptText}\n\nUser: ${unstuckPrompt}`;

      const { data, error } = await supabase.functions.invoke('unstuck-assistant', {
        body: {
          userPrompt: fullPrompt,
        },
      });

      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to get assistance',
          variant: 'destructive',
        });
        return;
      }

      if (data?.response) {
        setIsUnstuckAssistantEnabled(true);
        setUnstuckPrompt('');
        setUnstuckResponse(data.response);
        toast({
          title: 'Success',
          description: 'Got response from assistant',
        });
      } else {
        toast({
          title: 'No Response',
          description: 'No response received from assistant',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to invoke unstuck assistant',
        variant: 'destructive',
      });
    } finally {
      setIsUnstuckReprompting(false);
    }
  }, [unstuckPrompt, toast]);

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

  // Fixed event listener with proper cleanup
  useEffect(() => {
    toggleListenerRef.current = (e: Event) => {
      const customEvent = e as CustomEvent;
      handleToggleNodeCompletion(customEvent.detail.nodeId);
    };
    
    window.addEventListener('toggleNodeCompletion', toggleListenerRef.current);
    
    return () => {
      if (toggleListenerRef.current) {
        window.removeEventListener('toggleNodeCompletion', toggleListenerRef.current);
      }
    };
  }, [handleToggleNodeCompletion]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Flow Editor</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Label>Numbered Steps</Label>
            <Textarea
              placeholder={"4. Design the UI/UX\nFocus on simple, intuitive navigation.\nCreate clickable prototypes to test flow.\nKeep design consistent: fonts, colors, button styles.\n6. Build the App\nStart with core functionality (MVP features first).\nImplement frontend (UI) and backend (database, APIs) if needed.\nUse proper state management (React Native → Redux/Context, Flutter → Provider/Bloc)."}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="h-48"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" className="accent-primary" checked={fillMissing} onChange={(e) => setFillMissing(e.target.checked)} />
                Fill Missing Step Numbers
              </label>
              <Button className="gap-2" onClick={parseAndBuild}>Parse</Button>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button variant="secondary" className="gap-2" onClick={handleAddNode}>
                <Plus className="w-4 h-4" /> Add Block
              </Button>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox 
                id="snap-to-grid"
                checked={snapToGrid} 
                onCheckedChange={(checked) => setSnapToGrid(checked as boolean)} 
              />
              <Label htmlFor="snap-to-grid" className="text-sm text-muted-foreground cursor-pointer">
                Snap To Grid
              </Label>
            </div>

            <div className="space-y-2 pt-4 border-t mt-4 pt-4">
              <Label>Unstuck Assistant</Label>
              <Input
                placeholder="Ask for help or get unstuck..."
                className="text-sm"
                value={unstuckPrompt}
                onChange={(e) => setUnstuckPrompt(e.target.value)}
                disabled={isUnstuckReprompting}
              />
              <Button 
                className="w-full gap-2" 
                disabled={isUnstuckReprompting || !unstuckPrompt.trim()}
                onClick={handleUnstuckAssistant}
              >
                {isUnstuckReprompting ? 'Getting help...' : 'Ask Assistant'}
              </Button>
              {isUnstuckAssistantEnabled && unstuckResponse && (
                <div className="p-3 bg-muted rounded-md border border-border">
                  <p className="text-sm text-muted-foreground font-semibold mb-2">Assistant Response:</p>
                  <p className="text-sm whitespace-pre-wrap">{unstuckResponse}</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="border rounded-lg h-[600px] bg-muted/30 overflow-hidden">
              <ReactFlow
                nodeTypes={nodeTypes}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onInit={(inst) => setRfInstance(inst)}
                snapToGrid={snapToGrid}
                snapGrid={SNAP_GRID}
                attributionPosition="bottom-left"
              >
                <Background />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Node Sheet */}
      <Sheet open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNodeId(null)}>
        <SheetContent side="right" className="sm:max-w-lg w-full">
          <SheetHeader>
            <SheetTitle>Edit Block</SheetTitle>
          </SheetHeader>
          {selectedNode && (
            <AddOrEditNodeForm
              initialTitle={selectedNode.data.title}
              initialDetails={selectedNode.data.details.join('\n')}
              onCancel={() => setSelectedNodeId(null)}
              onDelete={() => handleDeleteNode(selectedNode.id)}
              onSubmit={(title, details) => handleSaveSelected(title, details)}
              sendPromptToLLM={handleAddContextViaLLM}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

type AddOrEditNodeFormProps = {
  initialTitle: string;
  initialDetails: string;
  onSubmit: (title: string, details: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
  sendPromptToLLM: (text: string) => Promise<string>;
};

const parseLLMResponse = (result: unknown): string => {
  try {
    const parsed = LLMResponseSchema.parse(result);
    if (parsed.candidates?.[0]?.content?.[0]?.text) {
      return parsed.candidates[0].content[0].text;
    } else if (parsed.output?.[0]?.content?.[0]?.text) {
      return parsed.output[0].content[0].text;
    }
  } catch {
    // Fall back to string conversion
  }

  if (typeof result === 'string') {
    return result;
  }
  
  return JSON.stringify(result);
};

const AddOrEditNodeForm = ({ initialTitle, initialDetails, onSubmit, onCancel, onDelete, sendPromptToLLM }: AddOrEditNodeFormProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [details, setDetails] = useState(initialDetails);
  const [contextText, setContextText] = useState('');
  const [isSubmittingContext, setIsSubmittingContext] = useState(false);
  const { toast } = useToast();

  const handleAddContext = useCallback(async () => {
    if (!contextText.trim()) return;
    
    setIsSubmittingContext(true);
    try {
      // Build master prompt combining title, details, and user request
      const masterPrompt = `Title: ${title}

Current Details:
${details}

User Request: ${contextText}

Based on the above context, please provide additional helpful details and context that would improve or expand on the current information.`;

      const responseText = await sendPromptToLLM(masterPrompt);

      const responseLines = responseText
        .split(/\r?\n/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      
      if (responseLines.length) {
        const existing = details.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const combined = [...existing, ...responseLines];
        setDetails(combined.join('\n'));
        toast({
          title: 'Success',
          description: 'Context added successfully',
        });
      } else {
        toast({
          title: 'No Content',
          description: 'No response content was generated',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to generate context',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingContext(false);
      setContextText('');
    }
  }, [contextText, details, title, toast, sendPromptToLLM]);

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter title" />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} className="h-40" placeholder="Enter step description..." />
      </div>
      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex gap-2">
          {onDelete && (
            <Button type="button" variant="destructive" className="gap-2" onClick={onDelete}><Trash2 className="w-4 h-4" />Delete</Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={() => onSubmit(title, details)} className="gap-2">Save</Button>
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <Label>Add Context via LLM</Label>
        <Input
          value={contextText}
          onChange={(e) => setContextText(e.target.value)}
          placeholder="Type extra context here..."
        />
        <Button
          type="button"
          className="w-full gap-2"
          disabled={isSubmittingContext || !contextText.trim()}
          onClick={handleAddContext}
        >
          {isSubmittingContext ? 'Submitting...' : 'Submit for more context'}
        </Button>
      </div>
    </div>
  );
};

export default SubPage;
