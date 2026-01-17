import { type LLMService, type SummaryOptions, constructPrompt } from './llm';

export const OpenAI: LLMService = {
    name: 'OpenAI',

    async validateKey(key: string): Promise<boolean> {
        // Quick validation check (cost 0 typically) by listing models with limit 1 or just check prefix
        if (!key.startsWith('sk-')) return false;
        try {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { Authorization: `Bearer ${key}` }
            });
            return res.ok;
        } catch {
            return false;
        }
    },

    async getModels(apiKey: string): Promise<string[]> {
        try {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { Authorization: `Bearer ${apiKey}` }
            });
            if (!res.ok) return [];
            const data = await res.json();
            return data.data
                .map((m: any) => m.id)
                .filter((id: string) => id.includes('gpt') || id.startsWith('o1') || id.startsWith('o3'))
                .sort((a: string, b: string) => b.localeCompare(a));
        } catch (e) {
            console.error("Failed to fetch OpenAI models", e);
            return [];
        }
    },

    async *summarize(text: string, options: SummaryOptions): AsyncGenerator<string, void, unknown> {
        const prompt = constructPrompt(options, text);

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${options.apiKey}`
            },
            body: JSON.stringify({
                model: options.model || 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                stream: true
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`OpenAI API Error: ${res.status} ${errorText}`);
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
                if (line.trim() === 'data: [DONE]') return;
                if (line.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(line.slice(6));
                        const content = json.choices[0]?.delta?.content;
                        if (content) yield content;
                    } catch (e) {
                        console.warn('Parse error', e);
                    }
                }
            }
        }
    }
};
