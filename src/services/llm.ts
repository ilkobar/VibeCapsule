export interface SummaryOptions {
    language: string;
    model: string;
    customPrompt?: string;
    apiKey: string;
}

export interface LLMService {
    name: string;
    summarize(text: string, options: SummaryOptions): AsyncGenerator<string, void, unknown>;
    validateKey(key: string): Promise<boolean>;
    getModels(apiKey: string): Promise<string[]>;
}

export const SYSTEM_PROMPT = `
You are a professional content distiller. Your goal is to summarize the following text into 3 sections:
1. One-sentence TL;DR.
2. Key Takeaways (bullet points).
3. Action Items or Conclusion.

IMPORTANT: The article may be in any language, but you MUST provide the summary in {{LANGUAGE}}.
`;

export function constructPrompt(options: SummaryOptions, content: string): string {
    const promptTemplate = options.customPrompt || SYSTEM_PROMPT;
    const systemInstruction = promptTemplate.replace('{{LANGUAGE}}', options.language);
    return `${systemInstruction}\n\n---\n\n${content}`;
}
