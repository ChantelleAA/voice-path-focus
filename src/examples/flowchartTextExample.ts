/**
 * Example: How to get flowchart data as text in your code
 */

import { 
  getFlowchartAsText, 
  getAllFlowchartsAsText,
  formatFlowchartAsText,
  formatAllFlowchartsAsText,
  getFlowchartAsJson,
  getAllFlowchartsAsJson
} from '@/lib/flowchartTextExtractor';

// Example 1: Get flowchart data for a specific task
export const getTaskFlowchartText = async (taskId: string) => {
  try {
    // Get the raw data
    const data = await getFlowchartAsText(taskId);
    
    if (!data) {
      console.log('No flowchart data found for task:', taskId);
      return null;
    }

    // Get formatted text
    const formattedText = formatFlowchartAsText(data);
    console.log('Formatted Text:', formattedText);

    // Get JSON data
    const jsonText = getFlowchartAsJson(data);
    console.log('JSON Data:', jsonText);

    return {
      data,
      formattedText,
      jsonText
    };
  } catch (error) {
    console.error('Error getting task flowchart:', error);
    return null;
  }
};

// Example 2: Get all user flowcharts as text
export const getAllUserFlowchartsText = async (userId: string) => {
  try {
    // Get all flowchart data
    const allData = await getAllFlowchartsAsText(userId);
    
    if (allData.length === 0) {
      console.log('No flowcharts found for user');
      return null;
    }

    // Get formatted text for all
    const formattedText = formatAllFlowchartsAsText(allData);
    console.log('All Flowcharts Formatted:', formattedText);

    // Get JSON for all
    const jsonText = getAllFlowchartsAsJson(allData);
    console.log('All Flowcharts JSON:', jsonText);

    return {
      data: allData,
      formattedText,
      jsonText
    };
  } catch (error) {
    console.error('Error getting all flowcharts:', error);
    return null;
  }
};

// Example 3: Save flowchart data to file
export const saveFlowchartDataToFile = async (taskId: string, filename?: string) => {
  try {
    const result = await getTaskFlowchartText(taskId);
    
    if (!result) {
      throw new Error('No data to save');
    }

    const defaultFilename = `flowchart-${taskId}-${new Date().toISOString().split('T')[0]}.txt`;
    const finalFilename = filename || defaultFilename;

    // Create and download file
    const blob = new Blob([result.formattedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Flowchart data saved as: ${finalFilename}`);
    return true;
  } catch (error) {
    console.error('Error saving flowchart data:', error);
    return false;
  }
};

// Example 4: Copy flowchart data to clipboard
export const copyFlowchartToClipboard = async (taskId: string) => {
  try {
    const result = await getTaskFlowchartText(taskId);
    
    if (!result) {
      throw new Error('No data to copy');
    }

    await navigator.clipboard.writeText(result.formattedText);
    console.log('Flowchart data copied to clipboard');
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
};

// Example 5: Get specific task progress
export const getTaskProgress = async (taskId: string) => {
  try {
    const data = await getFlowchartAsText(taskId);
    
    if (!data) {
      return null;
    }

    return {
      taskName: data.taskName,
      progress: `${data.completedSteps}/${data.totalSteps}`,
      percentage: Math.round(data.progressPercentage),
      subtasks: data.subtasks.map(s => ({
        name: s.name,
        completed: s.completed,
        order: s.order
      }))
    };
  } catch (error) {
    console.error('Error getting task progress:', error);
    return null;
  }
};
