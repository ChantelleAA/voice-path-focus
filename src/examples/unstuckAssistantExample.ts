/**
 * Example: How the Unstuck Assistant now includes flowchart data
 */

import { getFlowchartAsText, formatFlowchartAsText } from '@/lib/flowchartTextExtractor';

/**
 * Example of how the Unstuck Assistant now works with flowchart data
 */
export const demonstrateUnstuckAssistantEnhancement = async (taskId: string, userQuestion: string) => {
  try {
    // 1. Get the flowchart data as text
    const flowchartData = await getFlowchartAsText(taskId);
    
    if (!flowchartData) {
      console.log('No flowchart data found for task:', taskId);
      return null;
    }

    // 2. Format the flowchart data as readable text
    const flowchartText = formatFlowchartAsText(flowchartData);
    console.log('Flowchart Data:', flowchartText);

    // 3. This is what gets sent to the Unstuck Assistant
    const enhancedPrompt = `
You are a helpful productivity assistant helping users overcome blockers and get unstuck.

Your role:
- Help the user work through specific blockers
- Ask clarifying questions
- Suggest concrete next steps
- Be concise but helpful
- Focus on action over theory
- Use any provided task breakdown context to give more targeted advice
- Reference specific subtasks or progress when relevant

TASK BREAKDOWN CONTEXT:
${flowchartText}

User Question: ${userQuestion}
`;

    console.log('Enhanced Prompt:', enhancedPrompt);
    
    return {
      flowchartData,
      flowchartText,
      enhancedPrompt
    };
  } catch (error) {
    console.error('Error demonstrating Unstuck Assistant enhancement:', error);
    return null;
  }
};

/**
 * Example of what the user will see in the Unstuck Assistant
 */
export const exampleUserExperience = () => {
  const exampleFlowchartText = `
📋 TASK: Build a React App
📝 Description: Create a modern web application
⚡ Importance: HIGH
⏱️ Duration: MEDIUM
📊 Progress: 2/5 (40%)

📋 SUBTASKS:
⏳ 1. Set up project structure
✅ 2. Install dependencies
⏳ 3. Create components
⏳ 4. Add styling
⏳ 5. Deploy application
`;

  const exampleUserQuestion = "I'm stuck on step 3. I don't know how to create components properly.";

  const exampleResponse = `
Based on your task breakdown, I can see you're working on "Build a React App" and you've completed setting up the project structure and installing dependencies. You're currently stuck on step 3: "Create components".

Here's how to move forward:

1. **Start with a simple component**: Create a basic functional component like a Button or Card
2. **Use the project structure you set up**: Place components in a dedicated folder
3. **Follow React best practices**: Use proper naming conventions and export/import statements
4. **Test as you go**: Make sure each component renders before moving to the next

Since you've already completed the setup steps, you have a solid foundation. Focus on creating one component at a time rather than trying to build everything at once.

Would you like me to help you with the specific structure for your first component?
`;

  console.log('Example Flowchart Context:', exampleFlowchartText);
  console.log('User Question:', exampleUserQuestion);
  console.log('AI Response:', exampleResponse);
  
  return {
    flowchartContext: exampleFlowchartText,
    userQuestion: exampleUserQuestion,
    aiResponse: exampleResponse
  };
};
