export type TaskType = 'short' | 'medium' | 'long';
export type UrgencyLevel = 'low' | 'medium' | 'high';

export interface FlowchartNode {
  id: string;
  label: string;
  context?: string;
  x?: number;
  y?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  type: TaskType;
  urgency: UrgencyLevel;
  createdAt: number;
  updatedAt: number;
  subtasks?: Task[];
  flowchart?: FlowchartNode[];
  progressNotes?: string[];
  chatHistory?: ChatMessage[];
  checkInInterval?: number; // in minutes
  focusTime?: number; // total time spent in focus mode
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
