import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Download, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAllFlowchartsText } from '@/hooks/useFlowchartText';

/**
 * Component to display all flowchart data as text
 */
export const FlowchartTextDisplay = () => {
  const { data, loading, error, refresh, getFormattedText, getJsonText } = useAllFlowchartsText();
  const [activeTab, setActiveTab] = useState<'formatted' | 'json'>('formatted');
  const { toast } = useToast();

  const handleCopy = async () => {
    const text = activeTab === 'formatted' ? getFormattedText() : getJsonText();
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: 'Flowchart data copied to clipboard',
      });
    } catch (err) {
      toast({
        title: 'Copy Failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = () => {
    const text = activeTab === 'formatted' ? getFormattedText() : getJsonText();
    const filename = `flowchart-data-${new Date().toISOString().split('T')[0]}.${activeTab === 'json' ? 'json' : 'txt'}`;
    
    const blob = new Blob([text], { 
      type: activeTab === 'json' ? 'application/json' : 'text/plain' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Downloaded!',
      description: `File saved as ${filename}`,
    });
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading flowchart data...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <div className="text-center text-red-600">
            <p>Error loading flowchart data:</p>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
            <Button onClick={refresh} className="mt-4" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <p>No tasks with flowcharts found.</p>
            <p className="text-sm mt-2">Create some tasks and generate flowcharts to see data here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formattedText = getFormattedText();
  const jsonText = getJsonText();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Task Breakdown Data</CardTitle>
          <div className="flex gap-2">
            <Button onClick={refresh} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleCopy} size="sm">
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
            <Button onClick={handleDownload} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'formatted' | 'json')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="formatted">Formatted Text</TabsTrigger>
            <TabsTrigger value="json">JSON Data</TabsTrigger>
          </TabsList>
          
          <TabsContent value="formatted" className="mt-4">
            <Textarea
              value={formattedText}
              readOnly
              className="min-h-[400px] font-mono text-sm"
              placeholder="No formatted data available"
            />
          </TabsContent>
          
          <TabsContent value="json" className="mt-4">
            <Textarea
              value={jsonText}
              readOnly
              className="min-h-[400px] font-mono text-sm"
              placeholder="No JSON data available"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
