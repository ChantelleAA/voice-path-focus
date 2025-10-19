import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getFlowchartAsText, 
  getAllFlowchartsAsText, 
  FlowchartTextData,
  formatFlowchartAsText,
  formatAllFlowchartsAsText,
  getFlowchartAsJson,
  getAllFlowchartsAsJson
} from '@/lib/flowchartTextExtractor';

/**
 * Hook to get flowchart data as text for a specific task
 */
export const useFlowchartText = (taskId: string) => {
  const [data, setData] = useState<FlowchartTextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!taskId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getFlowchartAsText(taskId);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flowchart data');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const getFormattedText = useCallback(() => {
    return data ? formatFlowchartAsText(data) : '';
  }, [data]);

  const getJsonText = useCallback(() => {
    return data ? getFlowchartAsJson(data) : '';
  }, [data]);

  return {
    data,
    loading,
    error,
    refresh,
    getFormattedText,
    getJsonText
  };
};

/**
 * Hook to get flowchart data as text for all user tasks
 */
export const useAllFlowchartsText = () => {
  const { user } = useAuth();
  const [data, setData] = useState<FlowchartTextData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getAllFlowchartsAsText(user.id);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flowchart data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const getFormattedText = useCallback(() => {
    return formatAllFlowchartsAsText(data);
  }, [data]);

  const getJsonText = useCallback(() => {
    return getAllFlowchartsAsJson(data);
  }, [data]);

  return {
    data,
    loading,
    error,
    refresh,
    getFormattedText,
    getJsonText
  };
};
