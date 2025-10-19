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
    const { transcribedText, userId } = await req.json();
    
    if (!transcribedText || !userId) {
      throw new Error('Missing required fields: transcribedText and userId');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use Gemini AI to extract tasks from the transcribed text
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const systemPrompt = `You are a task extraction expert. Analyze the following voice transcription and extract individual, actionable tasks.

Instructions:
- Identify each distinct task or action item mentioned
- Ignore contradictions (if someone says "call mom" then "scratch that, call dad" - only include "call dad")
- Determine appropriate importance level: low, medium, or high
- Determine appropriate duration: short (< 30 min), medium (30min - 3hrs), or long (> 3hrs)
- Create clear, actionable task names
- Ignore filler words, hesitations, and casual speech

Voice transcription to analyze:
"${transcribedText}"

Return ONLY a JSON array of task objects in this exact format:
[
  {
    "task_name": "Clear, actionable task name",
    "importance": "low|medium|high",
    "duration": "short|medium|long",
    "is_complete": false,
    "has_subtasks": false
  }
]

If no clear tasks are found, return an empty array: []

Extract the tasks now:`;

    console.log('Processing transcription:', transcribedText);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: systemPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.3, // Lower temperature for more consistent extraction
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
    console.log('Raw Gemini response content:', content);

    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      content = jsonMatch[1].trim();
    }

    // Parse the extracted tasks
    let extractedTasks;
    try {
      extractedTasks = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', content);
      throw new Error('Invalid JSON response from AI');
    }

    if (!Array.isArray(extractedTasks)) {
      console.error('Expected array of tasks, got:', extractedTasks);
      throw new Error('AI did not return a valid task array');
    }

    console.log('Extracted tasks:', extractedTasks);

    // If no tasks were extracted, return early
    if (extractedTasks.length === 0) {
      return new Response(
        JSON.stringify({ 
          tasks: [],
          message: 'No clear tasks were identified in the transcription.',
          transcribedText
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and prepare tasks for database insertion
    const tasksToInsert = extractedTasks.map((task: any) => {
      // Validate required fields
      if (!task.task_name || typeof task.task_name !== 'string') {
        throw new Error('Invalid task: missing or invalid task_name');
      }
      
      // Validate importance
      if (!['low', 'medium', 'high'].includes(task.importance)) {
        console.warn(`Invalid importance "${task.importance}" for task "${task.task_name}", defaulting to medium`);
        task.importance = 'medium';
      }
      
      // Validate duration
      if (!['short', 'medium', 'long'].includes(task.duration)) {
        console.warn(`Invalid duration "${task.duration}" for task "${task.task_name}", defaulting to medium`);
        task.duration = 'medium';
      }

      return {
        user_id: userId,
        task_name: task.task_name.trim(),
        importance: task.importance,
        duration: task.duration,
        is_complete: false,
        has_subtasks: false
      };
    });

    // Insert tasks into database
    const { data: insertedTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select('*');

    if (insertError) {
      console.error('Error inserting tasks:', insertError);
      
      // If it's a foreign key constraint error, provide helpful message
      if (insertError.message.includes('foreign key constraint')) {
        throw new Error(`User ID ${userId} does not exist in the system. Please ensure the user is properly authenticated.`);
      }
      
      throw new Error(`Database error: ${insertError.message}`);
    }

    console.log('Successfully inserted tasks:', insertedTasks);

    return new Response(
      JSON.stringify({ 
        tasks: insertedTasks,
        message: `Successfully created ${insertedTasks?.length || 0} tasks from your voice note.`,
        transcribedText,
        extractedCount: extractedTasks.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Voice task processing error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        tasks: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});