import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { taskId, userId, action, newTaskName } = await req.json();
    
    if (!taskId || !userId) {
      throw new Error('Missing required fields: taskId and userId');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify task belongs to user
    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select('id, task_name')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingTask) {
      throw new Error('Task not found or access denied');
    }

    let result;
    let message;

    switch (action) {
      case 'delete':
        // Delete the task
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)
          .eq('user_id', userId);

        if (deleteError) throw deleteError;
        
        result = { deleted: true, taskId };
        message = 'Task deleted successfully';
        break;

      case 'complete':
        // Delete the task (same as delete, but different semantics)
        const { error: completeError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)
          .eq('user_id', userId);

        if (completeError) throw completeError;
        
        result = { completed: true, taskId };
        message = 'Task completed successfully';
        break;

      case 'rename':
        if (!newTaskName || typeof newTaskName !== 'string') {
          throw new Error('Missing or invalid newTaskName for rename action');
        }

        // Update task name
        const { data: updatedTask, error: updateError } = await supabase
          .from('tasks')
          .update({ task_name: newTaskName.trim() })
          .eq('id', taskId)
          .eq('user_id', userId)
          .select('*')
          .single();

        if (updateError) throw updateError;
        
        result = { renamed: true, task: updatedTask };
        message = 'Task renamed successfully';
        break;

      default:
        throw new Error('Invalid action. Must be "delete", "complete", or "rename"');
    }

    console.log(`Task ${action} successful:`, result);

    return new Response(
      JSON.stringify({ 
        success: true,
        message,
        ...result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Task management error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});