import { type LLMService, type SummaryOptions } from './llm';

export class ChromeAIService implements LLMService {
    name = 'Chrome Built-in AI';

    async validateKey(_key: string): Promise<boolean> {
        return true; // No key needed
    }

    async getAvailability(): Promise<'AVAILABLE' | 'API_MISSING' | 'MODEL_NOT_READY'> {
        const ai = (self as any).ai || (window as any).ai;
        if (!ai?.languageModel) {
            console.log("Chrome AI: languageModel API is missing");
            return 'API_MISSING';
        }

        try {
            const capabilities = await ai.languageModel.capabilities();
            if (capabilities.available === 'no') {
                console.log("Chrome AI: capabilities.available is 'no'");
                return 'MODEL_NOT_READY';
            }
            return 'AVAILABLE';
        } catch (e) {
            console.error("Chrome AI capability check failed", e);
            return 'API_MISSING'; // If check fails, assume API is broken/missing
        }
    }

    async getModels(_apiKey?: string): Promise<string[]> {
        const status = await this.getAvailability();
        return status === 'AVAILABLE' ? ['gemini-nano'] : [];
    }

    async *summarize(content: string, options: SummaryOptions): AsyncGenerator<string> {
        const ai = (self as any).ai;
        if (!ai?.languageModel) {
            throw new Error("Chrome Built-in AI is not available in this browser. Please enable flags.");
        }

        try {
            const capabilities = await ai.languageModel.capabilities();
            if (capabilities.available === 'no') {
                throw new Error("Chrome AI is available but model is not ready.");
            }

            // Create a session
            const session = await ai.languageModel.create({
                systemPrompt: options.customPrompt
                    ? options.customPrompt
                    : "You are a helpful assistant that summarizes web articles. Provide a concise markdown summary with a Title."
            });

            // Prompt
            const prompt = `Please summarize the following content:\n\n${content}`;

            const stream = session.promptStreaming(prompt);
            for await (const chunk of stream) {
                yield chunk;
            }

            // Cleanup
            session.destroy();

        } catch (e: any) {
            console.error("Chrome AI Error:", e);
            throw new Error(`Chrome AI failed: ${e.message}`);
        }
    }
}

export const ChromeAI = new ChromeAIService();
