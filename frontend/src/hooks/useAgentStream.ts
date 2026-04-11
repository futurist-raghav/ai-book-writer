import { useCallback, useState } from 'react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface StreamChunk {
  data?: string;
  error?: string;
}

export function useAgentStream(agentType: 'research' | 'factcheck' | 'tone' | 'citation') {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [chunks, setChunks] = useState<string[]>([]);

  const stream = useCallback(
    async (input: Record<string, any>) => {
      setIsLoading(true);
      setResult('');
      setChunks([]);

      try {
        const endpointMap = {
          research: '/ai/agents/research/stream',
          factcheck: '/ai/agents/factcheck/stream',
          tone: '/ai/agents/tone/stream',
          citation: '/ai/agents/cite/stream',
        };

        const endpoint = endpointMap[agentType];
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error(`Agent request failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line) as StreamChunk;
                if (parsed.data) {
                  setChunks((prev) => [...prev, parsed.data]);
                  setResult((prev) => prev + parsed.data);
                }
                if (parsed.error) {
                  toast.error(parsed.error);
                }
              } catch (e) {
                // Skip parse errors
              }
            }
          }
        }

        toast.success(`${agentType} agent completed!`);
      } catch (error) {
        toast.error(`Agent request failed: ${error instanceof Error ? error.message : 'Unknown'}`);
      } finally {
        setIsLoading(false);
      }
    },
    [agentType]
  );

  return { isLoading, result, chunks, stream };
}

export function useAgentUsage() {
  const [stats, setStats] = useState<any>(null);
  const [remaining, setRemaining] = useState<number>(100);

  const getStats = useCallback(async (days = 30) => {
    try {
      const response = await api.get(`/ai/agents/usage/stats?days=${days}`);
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load usage stats');
    }
  }, []);

  const getRemaining = useCallback(async () => {
    try {
      const response = await api.get('/ai/agents/usage/remaining');
      setRemaining(response.data.remaining);
      return response.data;
    } catch (error) {
      toast.error('Failed to load usage quota');
      return null;
    }
  }, []);

  const logUsage = useCallback(
    async (agentType: string, inputText: string, tokensUsed = 0) => {
      try {
        const response = await api.post('/ai/agents/usage/log', {
          agent_type: agentType,
          input_text: inputText,
          tokens_used: tokensUsed,
        });
        setRemaining(response.data.remaining);
        return response.data;
      } catch (error) {
        if (error instanceof Error && error.message.includes('429')) {
          toast.error('Daily quota exceeded. Try again tomorrow.');
        } else {
          toast.error('Failed to log usage');
        }
        return null;
      }
    },
    []
  );

  return { stats, remaining, getStats, getRemaining, logUsage };
}
