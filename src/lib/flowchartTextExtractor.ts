import { supabase } from '@/integrations/supabase/client';
import { FlowchartNode } from '@/types/task';

/**
 * Utility functions to extract flowchart data as text
 */

export interface FlowchartTextData {
  taskName: string;
  taskDescription?: string;
  importance: string;
  duration: string;
  subtasks: Array<{
    order: number;
    name: string;
    completed: boolean;
  }>;
  totalSteps: number;
  completedSteps: number;
  progressPercentage: number;
}

/**
 * Get all flowchart data for a specific task as text
 */
export const getFlowchartAsText = async (taskId: string): Promise<FlowchartTextData | null> => {
  try {
    // Get task details
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      console.error('Error fetching task:', taskError);
      return null;
    }

    // Get subtasks for this task
    const { data: subtasks, error: subtasksError } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('order_index');

    if (subtasksError) {
      console.error('Error fetching subtasks:', subtasksError);
      return null;
    }

    const completedSteps = subtasks?.filter(s => s.completed).length || 0;
    const totalSteps = subtasks?.length || 0;
    const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    return {
      taskName: task.task_name,
      taskDescription: task.description,
      importance: task.importance,
      duration: task.duration,
      subtasks: subtasks?.map(s => ({
        order: s.order_index,
        name: s.name,
        completed: s.completed
      })) || [],
      totalSteps,
      completedSteps,
      progressPercentage
    };
  } catch (error) {
    console.error('Error getting flowchart as text:', error);
    return null;
  }
};

/**
 * Get all flowchart data for all user tasks as text
 */
export const getAllFlowchartsAsText = async (userId: string): Promise<FlowchartTextData[]> => {
  try {
    // Get all tasks for user
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (tasksError || !tasks) {
      console.error('Error fetching tasks:', tasksError);
      return [];
    }

    const results: FlowchartTextData[] = [];

    for (const task of tasks) {
      const flowchartData = await getFlowchartAsText(task.id);
      if (flowchartData) {
        results.push(flowchartData);
      }
    }

    return results;
  } catch (error) {
    console.error('Error getting all flowcharts as text:', error);
    return [];
  }
};

/**
 * Convert flowchart data to formatted text string
 */
export const formatFlowchartAsText = (data: FlowchartTextData): string => {
  const lines: string[] = [];
  
  lines.push(`📋 TASK: ${data.taskName}`);
  lines.push(`📝 Description: ${data.taskDescription || 'No description'}`);
  lines.push(`⚡ Importance: ${data.importance.toUpperCase()}`);
  lines.push(`⏱️ Duration: ${data.duration.toUpperCase()}`);
  lines.push(`📊 Progress: ${data.completedSteps}/${data.totalSteps} (${Math.round(data.progressPercentage)}%)`);
  lines.push('');
  
  if (data.subtasks.length === 0) {
    lines.push('No subtasks available');
  } else {
    lines.push('📋 SUBTASKS:');
    data.subtasks.forEach((subtask, index) => {
      const status = subtask.completed ? '✅' : '⏳';
      lines.push(`${status} ${subtask.order}. ${subtask.name}`);
    });
  }
  
  return lines.join('\n');
};

/**
 * Convert all user flowcharts to formatted text string
 */
export const formatAllFlowchartsAsText = (dataArray: FlowchartTextData[]): string => {
  if (dataArray.length === 0) {
    return 'No tasks with flowcharts found.';
  }

  const lines: string[] = [];
  lines.push('🎯 ALL TASK BREAKDOWNS');
  lines.push('='.repeat(50));
  lines.push('');

  dataArray.forEach((data, index) => {
    lines.push(formatFlowchartAsText(data));
    if (index < dataArray.length - 1) {
      lines.push('');
      lines.push('─'.repeat(30));
      lines.push('');
    }
  });

  return lines.join('\n');
};

/**
 * Get flowchart data as JSON string
 */
export const getFlowchartAsJson = (data: FlowchartTextData): string => {
  return JSON.stringify(data, null, 2);
};

/**
 * Get all flowcharts as JSON string
 */
export const getAllFlowchartsAsJson = (dataArray: FlowchartTextData[]): string => {
  return JSON.stringify(dataArray, null, 2);
};
