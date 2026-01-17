import { type LLMService, type SummaryOptions, constructPrompt } from './llm';

export const Gemini: LLMService = {
    name: 'Gemini',

    async validateKey(key: string): Promise<boolean> {
        return key.length > 10; // Basic check
    },

    async getModels(apiKey: string): Promise<string[]> {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (!res.ok) return [];
            const data = await res.json();
            return data.models
                .map((m: any) => m.name.replace('models/', ''))
                .filter((id: string) => id.includes('gemini'))
                .sort((a: string, b: string) => b.localeCompare(a));
        } catch (e) {
            console.error("Failed to fetch Gemini models", e);
            return [];
        }
    },

    async *summarize(text: string, options: SummaryOptions): AsyncGenerator<string, void, unknown> {
        const prompt = constructPrompt(options, text);
        const model = options.model || 'gemini-1.5-pro';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${options.apiKey}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Gemini API Error: ${res.status} ${err}`);
        }

        if (!res.body) throw new Error('No response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Basic parsing strategy for Gemini's JSON array stream
            // The stream usually looks like: [{...},\n{...},\n{...}]
            // We want to extract objects that look like {"candidates": ...}

            let cursor = 0;
            while (cursor < buffer.length) {
                // Find start of an object (assuming it starts with {)
                const start = buffer.indexOf('{', cursor);
                if (start === -1) {
                    // No new object start found, keep buffer from cursor and wait for more data
                    // However, we might have garbage at the start (e.g. '[' or ',')
                    if (cursor === 0 && buffer.length > 20) { // arbitrary safety check to avoid infinite growth if garbage
                        // If we are at start and can't find '{' but buffer is big, trim
                        // actually, real stream starts with '['. 
                        // Just searching for '{' is safer.
                    }
                    break;
                }

                // Try to find the matching closing brace
                // This is simple brace counting
                let braceCount = 0;
                let end = -1;
                let inString = false;

                for (let i = start; i < buffer.length; i++) {
                    const char = buffer[i];
                    if (char === '"' && buffer[i - 1] !== '\\') {
                        inString = !inString;
                    }
                    if (!inString) {
                        if (char === '{') braceCount++;
                        if (char === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                end = i;
                                break;
                            }
                        }
                    }
                }

                if (end !== -1) {
                    // valid object found from start to end
                    const jsonStr = buffer.substring(start, end + 1);
                    cursor = end + 1; // move cursor past this object

                    try {
                        const json = JSON.parse(jsonStr);
                        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            yield text;
                        }
                    } catch (e) {
                        console.warn("Gemini JSON parse error", e);
                    }
                } else {
                    // No complete object found yet, need more data
                    break;
                }
            }

            // Keep only the unprocessed part of the buffer
            if (cursor > 0) {
                buffer = buffer.substring(cursor);
            }
        }
    }
};
