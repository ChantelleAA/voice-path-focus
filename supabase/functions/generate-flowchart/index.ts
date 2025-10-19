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
    const { taskId, taskName, importance, duration } = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check if task already has subtasks
    console.log(`🔍 Checking for existing subtasks for task: ${taskId}`);
    const { data: existingTask, error: taskError } = await supabase
      .from('tasks')
      .select('has_subtasks')
      .eq('id', taskId)
      .single();

    if (taskError) {
      console.error('Task lookup error:', taskError);
      throw new Error(`Task not found: ${taskError.message}`);
    }

    console.log(`📋 Task has_subtasks flag: ${existingTask.has_subtasks}`);

    // If task already has subtasks, return existing ones
    if (existingTask.has_subtasks) {
      console.log('✅ Found existing subtasks, loading from database...');
      const { data: subtasks, error: subtasksError } = await supabase
        .from('subtasks')
        .select('id, name, order_index')
        .eq('task_id', taskId)
        .order('order_index');

      if (subtasksError) {
        console.error('Subtasks lookup error:', subtasksError);
        throw new Error(`Error fetching subtasks: ${subtasksError.message}`);
      }

      console.log(`📊 Returning ${subtasks.length} existing subtasks from database`);
      return new Response(
        JSON.stringify({ 
          flowchart: subtasks.map(st => ({
            id: st.order_index.toString(),
            label: st.name,
            context: `Subtask ${st.order_index} of ${taskName}`
          })),
          fromDatabase: true,
          message: `Loaded ${subtasks.length} existing subtasks from database`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check if task is "short" - don't generate subtasks for short tasks
    if (duration === 'short') {
      console.log('⚡ Short task detected - no subtasks needed');
      return new Response(
        JSON.stringify({ 
          flowchart: [{
            id: "1",
            label: taskName,
            context: "This is a short task - no subtasks needed. Complete it directly!"
          }],
          message: "Short tasks don't need subtasks - tackle it directly!",
          shortTask: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Generate subtasks using Gemini AI for medium/long tasks
    console.log('🤖 Generating new subtasks with Gemini AI...');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const systemPrompt = `You are a task breakdown expert. Break down the given task into sequential subtasks.

Generate 3-8 subtasks that are:
- Actionable and specific
- Sequential and logical
- Appropriate for a ${duration} duration task with ${importance} importance
- Each subtask should be a clear step toward completing the main task

Task to break down:
Name: ${taskName}
Duration: ${duration}
Importance: ${importance}

Return ONLY a JSON array in this exact format:
[
  { "id": "1", "label": "First subtask name", "context": "Brief context about this step" },
  { "id": "2", "label": "Second subtask name", "context": "Brief context about this step" }
]

Make each subtask a clear, actionable step that moves toward completing "${taskName}".`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: systemPrompt + '\n\nGenerate the flowchart now.'
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error('Gemini API error');
    }

    const data = await response.json();
    console.log('Gemini API response:', JSON.stringify(data, null, 2));
    
    // Check if response has expected structure
    if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
      console.error('Unexpected Gemini API response structure:', data);
      throw new Error('Invalid response from Gemini API');
    }
    
    const candidate = data.candidates[0];
    if (!candidate || !candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
      console.error('Unexpected candidate structure:', candidate);
      throw new Error('Invalid candidate structure from Gemini API');
    }
    
    let content = candidate.content.parts[0].text;

    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      content = jsonMatch[1].trim();
    }

    const flowchart = JSON.parse(content);

    // 4. Save subtasks to database
    const subtasksToInsert = flowchart.map((item: any, index: number) => ({
      task_id: taskId,
      name: item.label,
      order_index: index + 1,
      completed: false
    }));

    const { error: insertError } = await supabase
      .from('subtasks')
      .insert(subtasksToInsert);

    if (insertError) {
      console.error('Error inserting subtasks:', insertError);
      // Still return the flowchart even if DB insert fails
    } else {
      // Update task to mark it has subtasks
      await supabase
        .from('tasks')
        .update({ has_subtasks: true })
        .eq('id', taskId);
    }

    return new Response(
      JSON.stringify({ 
        flowchart,
        generated: true,
        saved: !insertError
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Flowchart generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
