import { type LLMService, type SummaryOptions, constructPrompt } from './llm';

export const Anthropic: LLMService = {
    name: 'Anthropic',

    async validateKey(key: string): Promise<boolean> {
        // Anthropic doesn't have a simple auth check endpoint that is cheap/free without model call usually,
        // but we can try listing models if available or just assume true for BYOK if format matches.
        // For now, simple check.
        return key.startsWith('sk-ant-');
    },

    async getModels(apiKey: string): Promise<string[]> {
        try {
            const res = await fetch('https://api.anthropic.com/v1/models', {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }
            });
            if (!res.ok) return [];
            const data = await res.json();
            return data.data
                .map((m: any) => m.id)
                .sort((a: string, b: string) => b.localeCompare(a));
        } catch (e) {
            console.error("Failed to fetch Anthropic models", e);
            return [];
        }
    },

    async *summarize(text: string, options: SummaryOptions): AsyncGenerator<string, void, unknown> {
        const prompt = constructPrompt(options, text);

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': options.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
                'anthropic-dangerous-direct-browser-access': 'true' // Required for browser calls
            },
            body: JSON.stringify({
                model: options.model || 'claude-3-5-sonnet-20240620',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }],
                stream: true
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Anthropic API Error: ${res.status} ${err}`);
        }

        if (!res.body) throw new Error('No response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.startsWith('event: ')) continue;
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    if (dataStr === '[DONE]') return;
                    try {
                        const event = JSON.parse(dataStr);
                        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                            yield event.delta.text;
                        }
                    } catch (e) {
                        console.warn(e);
                    }
                }
            }
        }
    }
};
