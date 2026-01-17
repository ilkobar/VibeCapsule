import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Settings, Sparkles, AlertCircle, Wand2, RefreshCw, ExternalLink, Bookmark, CheckCircle2, BookOpen, Trash2, Calendar, ArrowRight, Bot, Copy } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import ReactMarkdown from 'react-markdown'
import { useStorage } from "@/hooks/useStorage"
import { OpenAI } from "@/services/openai"
import { Anthropic } from "@/services/anthropic"
import { Gemini } from "@/services/gemini"
import { ChromeAI } from "@/services/chrome_ai"
import { type LLMService } from "@/services/llm"

const SERVICES: Record<string, LLMService> = {
  openai: OpenAI,
  anthropic: Anthropic,
  gemini: Gemini,
  chrome: ChromeAI
};

const DEFAULT_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o'],
  anthropic: ['claude-3-5-sonnet-20240620'],
  gemini: ['gemini-1.5-pro'],
  chrome: ['gemini-nano']
};

interface SavedArticle {
  id: string;
  title: string;
  url: string;
  savedAt: string;
  summary?: string;
}

function App() {
  // Provider Keys
  const { value: openaiKey, setValue: setOpenaiKey } = useStorage<string>('openai_key', '');
  const { value: anthropicKey, setValue: setAnthropicKey } = useStorage<string>('anthropic_key', '');
  const { value: geminiKey, setValue: setGeminiKey } = useStorage<string>('gemini_key', '');

  // Settings
  const { value: selectedProvider, setValue: setProvider } = useStorage<string>('selected_provider', 'openai');
  const { value: selectedModel, setValue: setModel } = useStorage<string>('selected_model', 'gpt-4o-mini');
  const { value: customPrompt, setValue: setCustomPrompt } = useStorage<string>('custom_prompt', '');

  // Storage
  const { value: cachedModels, setValue: setCachedModels } = useStorage<Record<string, string[]>>('cached_models', {});
  const { value: savedArticles, setValue: setSavedArticles } = useStorage<SavedArticle[]>('saved_articles', []);

  // State
  const [view, setView] = useState<'main' | 'settings' | 'library'>('main');
  const [status, setStatus] = useState<'idle' | 'loading' | 'streaming' | 'error'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [summary, setSummary] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [currentTabUrl, setCurrentTabUrl] = useState<string>('');

  // Chrome AI State
  const [chromeAIStatus, setChromeAIStatus] = useState<'AVAILABLE' | 'API_MISSING' | 'MODEL_NOT_READY'>('API_MISSING');
  const isChromeAIAvailable = chromeAIStatus === 'AVAILABLE';

  // Debounce timers
  const openaiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anthropicTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geminiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentKey = selectedProvider === 'openai' ? openaiKey : (selectedProvider === 'anthropic' ? anthropicKey : (selectedProvider === 'gemini' ? geminiKey : 'CHROME_AI'));
  const currentModels = (cachedModels && cachedModels[selectedProvider]?.length > 0)
    ? cachedModels[selectedProvider]
    : DEFAULT_MODELS[selectedProvider];

  useEffect(() => {
    // Get current tab URL for "isSaved" check
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url) setCurrentTabUrl(tab.url);
    });

    // Check Chrome AI
    checkChromeAI();
  }, []);

  const checkChromeAI = async () => {
    const status = await ChromeAI.getAvailability();
    setChromeAIStatus(status);

    if (status === 'AVAILABLE') {
      // Auto-enable if no other keys are set and provider is not set to a valid one
      if (!openaiKey && !anthropicKey && !geminiKey && selectedProvider === 'openai') {
        setProvider('chrome');
        setModel('gemini-nano');
      }
    }
  };

  const isArticleSaved = savedArticles.some(a => a.url === currentTabUrl);

  useEffect(() => {
    // Ensure selected model is valid for the current provider
    if (currentModels && !currentModels.includes(selectedModel) && currentModels.length > 0) {
      setModel(currentModels[0]);
    }
  }, [selectedProvider, currentModels, selectedModel, setModel]);

  // Reset 'saved' status after a delay
  useEffect(() => {
    if (saveStatus === 'saved') {
      // Refresh current tab url check
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab?.url) setCurrentTabUrl(tab.url);
      });

      const timer = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const fetchModels = async (provider: string, apiKey: string) => {
    if (!apiKey) return;
    setIsFetchingModels(true);
    try {
      const service = SERVICES[provider];
      if (!service) return;
      const models = await service.getModels(apiKey);
      if (models && models.length > 0) {
        setCachedModels(prev => ({
          ...prev,
          [provider]: models
        }));
      }
    } catch (e) {
      console.error(`Failed to refresh models for ${provider}`, e);
    } finally {
      setIsFetchingModels(false);
    }
  };

  // Auto-fetch effects with debounce
  useEffect(() => {
    if (openaiTimer.current) clearTimeout(openaiTimer.current);
    if (openaiKey && openaiKey.startsWith('sk-')) {
      openaiTimer.current = setTimeout(() => fetchModels('openai', openaiKey), 1000);
    }
    return () => { if (openaiTimer.current) clearTimeout(openaiTimer.current); };
  }, [openaiKey]);

  useEffect(() => {
    if (anthropicTimer.current) clearTimeout(anthropicTimer.current);
    if (anthropicKey && anthropicKey.startsWith('sk-ant-')) {
      anthropicTimer.current = setTimeout(() => fetchModels('anthropic', anthropicKey), 1000);
    }
    return () => { if (anthropicTimer.current) clearTimeout(anthropicTimer.current); };
  }, [anthropicKey]);

  useEffect(() => {
    if (geminiTimer.current) clearTimeout(geminiTimer.current);
    if (geminiKey && geminiKey.length > 10) {
      geminiTimer.current = setTimeout(() => fetchModels('gemini', geminiKey), 1000);
    }
    return () => { if (geminiTimer.current) clearTimeout(geminiTimer.current); };
  }, [geminiKey]);


  const handleSummarize = async () => {
    if (!currentKey) {
      setView('settings');
      return;
    }

    setStatus('loading');
    setSummary('');
    setErrorMsg('');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab");
      if (tab.url) setCurrentTabUrl(tab.url);

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' })
        .catch(err => {
          // Translate common connection errors into user-friendly messages
          if (err.message.includes("Receiving end does not exist") || err.message.includes("Could not establish connection")) {
            throw new Error("Extension not active on this page. Please REFRESH the page and try again.");
          }
          throw err;
        });

      if (!response || response.error) {
        throw new Error(response?.error || 'Failed to extract content (refresh page?)');
      }

      setStatus('streaming');
      const lang = chrome.i18n.getUILanguage();
      const service = SERVICES[selectedProvider];

      // Enforce title in prompt if not custom
      const effectivePrompt = customPrompt
        ? customPrompt
        : `Analyze the following ${lang} text. Generate a clear, translated title in ${lang} starting with '# ', followed by a concise summary in ${lang}.`;

      const stream = service.summarize(response.content, {
        apiKey: currentKey,
        language: lang,
        model: selectedModel,
        customPrompt: effectivePrompt
      });

      for await (const chunk of stream) {
        setSummary(prev => prev + chunk);
      }
      setStatus('idle');

    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setErrorMsg(e.message || 'Unknown error');
    }
  };

  const handleSaveToLibrary = async () => {
    setSaveStatus('saving');
    setErrorMsg('');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url || !tab.title) {
        throw new Error("Cannot save: missing tab info");
      }

      let titleToSave = tab.title;
      if (summary) {
        const titleMatch = summary.match(/^#\s+(.*?)(\n|$)/);
        if (titleMatch && titleMatch[1]) {
          titleToSave = titleMatch[1].trim();
        }
      }

      const newArticle: SavedArticle = {
        id: crypto.randomUUID(),
        title: titleToSave,
        url: tab.url,
        savedAt: new Date().toISOString(),
        summary: summary || undefined
      };

      const exists = savedArticles.some(a => a.url === newArticle.url);
      if (exists) {
        setSaveStatus('saved');
        return;
      }

      setSavedArticles(prev => [newArticle, ...prev]);
      setSaveStatus('saved');

    } catch (e: any) {
      console.error(e);
      setSaveStatus('idle');
      setErrorMsg('Failed to save link');
    }
  };

  const handleDeleteArticle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedArticles(prev => prev.filter(a => a.id !== id));
  };

  const openLink = (url: string) => {
    chrome.tabs.create({ url });
  };

  const [verifyingProvider, setVerifyingProvider] = useState<string | null>(null);
  const [verifiedProvider, setVerifiedProvider] = useState<string | null>(null);

  const pickBestModel = (models: string[], provider: string): string => {
    if (!models || models.length === 0) return '';
    if (provider === 'chrome') return 'gemini-nano';

    // Low cost / text-first preferences
    const preferences: Record<string, string[]> = {
      'openai': ['gpt-4o-mini', 'gpt-3.5-turbo'],
      'anthropic': ['claude-3-haiku-20240307', 'claude-3-5-haiku-20241022'],
      'gemini': ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-001']
    };

    const preferredList = preferences[provider] || [];

    // 1. Try to find a preferred model
    for (const pref of preferredList) {
      if (models.includes(pref)) return pref;
    }

    // 2. Fallback: Filter out "vision", "embed", "exp" if possible. 
    // Actually, explicit logic is better. If we can't find preferred, pick the first one that looks like a standard model.
    // Simpler heuristic: Prefer models containing 'flash', 'mini', 'haiku', 'turbo'.
    const goodKeywords = ['flash', 'mini', 'haiku', 'turbo'];
    const candidates = models.filter(m => goodKeywords.some(k => m.includes(k)));
    if (candidates.length > 0) return candidates[0];

    // 3. Absolute fallback
    return models[0];
  };

  const handleVerifyKey = async (provider: string, apiKey: string) => {
    if (!apiKey) return;
    setVerifyingProvider(provider);
    setVerifiedProvider(null);
    try {
      const service = SERVICES[provider];
      if (!service) throw new Error("Unknown provider");
      const models = await service.getModels(apiKey);

      if (models && models.length > 0) {
        // Success!
        setCachedModels(prev => ({ ...prev, [provider]: models }));
        setVerifiedProvider(provider);

        // Auto Select
        setProvider(provider);
        const bestModel = pickBestModel(models, provider);
        if (bestModel) setModel(bestModel);

        // Navigate back after delay
        setTimeout(() => {
          setVerifiedProvider(null);
          setVerifyingProvider(null);
          setView('main');
        }, 1000);
      } else {
        throw new Error("No models returned. Key might be invalid.");
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(`Verification failed: ${e.message}`);
      // Optionally clear the key? No, let user fix it.
    } finally {
      setVerifyingProvider(null);
    }
  };


  // --- VIEWS ---

  if (view === 'settings') {
    const isVerifying = (p: string) => verifyingProvider === p;
    const isVerified = (p: string) => verifiedProvider === p;

    return (
      <div className="w-full h-screen bg-background text-foreground p-4 flex flex-col overflow-y-auto">
        <header className="flex justify-between items-center mb-6 shrink-0">
          <h1 className="text-xl font-bold">Settings</h1>
          <Button variant="ghost" onClick={() => setView('main')}>Close</Button>
        </header>

        {errorMsg && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded flex items-center justify-between">
            <span>{errorMsg}</span>
            <Button variant="ghost" size="sm" onClick={() => setErrorMsg('')} className="h-6 w-6 p-0 hover:bg-transparent"><ExternalLink className="h-0 w-0" />x</Button>
          </div>
        )}

        <div className="space-y-6 pb-8">
          {/* Chrome AI Built-in Opt */}
          <Card className={selectedProvider === 'chrome' ? 'border-indigo-500 bg-indigo-500/5' : ''}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span className="flex items-center gap-2"><Bot className="h-5 w-5" /> Chrome Built-in AI <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full ml-1">Free</span></span>
                {selectedProvider === 'chrome' && <CheckCircle2 className="h-5 w-5 text-indigo-500" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground flex justify-between items-center">
                  <div className="flex flex-col">
                    <span>Status: {chromeAIStatus === 'AVAILABLE' ? <span className="text-green-500 font-bold">Available</span> :
                      chromeAIStatus === 'MODEL_NOT_READY' ? <span className="text-orange-500 font-bold flex items-center gap-1"><span className="animate-pulse">●</span> Downloading Model...</span> :
                        <span className="text-yellow-500 font-bold">Not Enabled</span>}</span>
                  </div>
                  {chromeAIStatus === 'AVAILABLE' && selectedProvider !== 'chrome' && (
                    <Button size="sm" onClick={() => { setProvider('chrome'); setModel('gemini-nano'); }}>Enable (Free)</Button>
                  )}
                </div>

                {/* Model Downloading State */}
                {chromeAIStatus === 'MODEL_NOT_READY' && (
                  <div className="bg-orange-500/10 p-2 rounded text-xs text-orange-600 space-y-2 mt-2">
                    <p className="font-semibold">Chrome is downloading the AI model (Gemini Nano).</p>
                    <p>This may take a few minutes.</p>
                    <div className="space-y-1 pt-1">
                      <p>To check progress:</p>
                      <div className="flex items-center justify-between gap-2 bg-orange-500/10 p-1.5 rounded">
                        <code className="break-all select-all">chrome://components</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:bg-orange-500/20 shrink-0"
                          onClick={() => navigator.clipboard.writeText('chrome://components')}
                          title="Copy URL"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-[10px]">Find <b>Optimization Guide On Device Model</b> and click "Check for update".</p>
                    </div>
                  </div>
                )}

                {/* API Missing State */}
                {chromeAIStatus === 'API_MISSING' && (
                  <div className="bg-yellow-500/10 p-2 rounded text-xs text-yellow-600 space-y-2 mt-2">
                    <div className="p-2 border border-red-500/20 rounded bg-red-500/5 flex items-start gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold text-red-700">Chrome Canary or Dev required!</p>
                        <p className="text-red-600/80">Built-in AI is currently experimental and not available in standard Chrome.</p>
                      </div>
                    </div>
                    <p className="font-semibold px-1">How to enable (in Canary/Dev):</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 bg-yellow-500/10 p-1.5 rounded">
                        <code className="break-all select-all">chrome://flags/#optimization-guide-on-device-model</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:bg-yellow-500/20"
                          onClick={() => {
                            navigator.clipboard.writeText('chrome://flags/#optimization-guide-on-device-model');
                          }}
                          title="Copy URL"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-[10px] pl-1">Set to <b>Enabled BypassPerfRequirement</b></p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 bg-yellow-500/10 p-1.5 rounded">
                        <code className="break-all select-all">chrome://flags/#prompt-api-for-gemini-nano</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:bg-yellow-500/20"
                          onClick={() => {
                            navigator.clipboard.writeText('chrome://flags/#prompt-api-for-gemini-nano');
                          }}
                          title="Copy URL"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-[10px] pl-1">Set to <b>Enabled</b></p>
                    </div>

                    <p className="font-semibold pt-1">Then click "Relaunch" at the bottom.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* OpenAI */}
          <Card className={isVerified('openai') ? 'border-green-500 bg-green-500/5 transition-all' : ''}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>OpenAI</span>
                {isVerified('openai') && <CheckCircle2 className="h-5 w-5 text-green-500 animate-in zoom-in" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="openai_key">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="openai_key"
                    type="password"
                    placeholder="sk-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                  />
                  <Button
                    onClick={() => handleVerifyKey('openai', openaiKey)}
                    disabled={!openaiKey || isVerifying('openai')}
                    className={isVerified('openai') ? 'bg-green-600 hover:bg-green-700' : ''}
                  >
                    {isVerifying('openai') ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Check'}
                  </Button>
                </div>
                <p className="text-xs text-indigo-500 cursor-pointer hover:underline flex items-center gap-1" onClick={() => openLink('https://platform.openai.com/api-keys')}>
                  Get API Key <ExternalLink className="h-3 w-3" />
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Anthropic */}
          <Card className={isVerified('anthropic') ? 'border-green-500 bg-green-500/5 transition-all' : ''}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Anthropic</span>
                {isVerified('anthropic') && <CheckCircle2 className="h-5 w-5 text-green-500 animate-in zoom-in" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="anthropic_key">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="anthropic_key"
                    type="password"
                    placeholder="sk-ant-..."
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                  />
                  <Button
                    onClick={() => handleVerifyKey('anthropic', anthropicKey)}
                    disabled={!anthropicKey || isVerifying('anthropic')}
                    className={isVerified('anthropic') ? 'bg-green-600 hover:bg-green-700' : ''}
                  >
                    {isVerifying('anthropic') ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Check'}
                  </Button>
                </div>
                <p className="text-xs text-indigo-500 cursor-pointer hover:underline flex items-center gap-1" onClick={() => openLink('https://console.anthropic.com/settings/keys')}>
                  Get API Key <ExternalLink className="h-3 w-3" />
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Gemini */}
          <Card className={isVerified('gemini') ? 'border-green-500 bg-green-500/5 transition-all' : ''}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Google Gemini</span>
                {isVerified('gemini') && <CheckCircle2 className="h-5 w-5 text-green-500 animate-in zoom-in" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="gemini_key">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="gemini_key"
                    type="password"
                    placeholder="Abc..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                  />
                  <Button
                    onClick={() => handleVerifyKey('gemini', geminiKey)}
                    disabled={!geminiKey || isVerifying('gemini')}
                    className={isVerified('gemini') ? 'bg-green-600 hover:bg-green-700' : ''}
                  >
                    {isVerifying('gemini') ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Check'}
                  </Button>
                </div>
                <p className="text-xs text-indigo-500 cursor-pointer hover:underline flex items-center gap-1" onClick={() => openLink('https://aistudio.google.com/app/apikey')}>
                  Get API Key <ExternalLink className="h-3 w-3" />
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Global Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Global Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="custom_prompt">Custom System Prompt</Label>
                  <textarea
                    id="custom_prompt"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="You are a professional content distiller..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Overrides the default summarization instructions. Use {"{{LANGUAGE}}"} placeholder.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (view === 'library') {
    return (
      <div className="w-full h-screen bg-background text-foreground flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            <h1 className="text-lg font-bold">Library</h1>
          </div>
          <Button variant="ghost" onClick={() => setView('main')}>Close</Button>
        </header>

        <ScrollArea className="flex-1 p-4">
          {savedArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center space-y-4 mt-10 text-muted-foreground">
              <BookOpen className="h-10 w-10 opacity-20" />
              <p>No articles saved yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedArticles.map(article => (
                <Card
                  key={article.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors group"
                  onClick={() => openLink(article.url)}
                >
                  <CardContent className="p-4 flex gap-3 items-start">
                    <div className="flex-1 space-y-1">
                      <h3 className="font-medium text-sm leading-snug line-clamp-2">{article.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(article.savedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDeleteArticle(article.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  // MAIN VIEW
  return (
    <div className="w-full h-screen bg-background text-foreground flex flex-col">
      <header className="p-4 flex justify-between items-center border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-indigo-500" />
          <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
            VibeCapsule
          </h1>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSaveToLibrary}
            title="Save to Library"
            disabled={saveStatus === 'saving' || saveStatus === 'saved'}
          >
            {saveStatus === 'saving' ? (
              <Bookmark className="h-5 w-5 animate-pulse text-indigo-500" />
            ) : isArticleSaved || saveStatus === 'saved' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Bookmark className="h-5 w-5" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setView('library')} title="Open Library">
            <BookOpen className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setView('settings')} title="Settings">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="p-3 border-b border-border/40 bg-muted/10 shrink-0 flex gap-2">
        <Select value={selectedProvider} onValueChange={(v: string) => {
          if (v === 'chrome' && !isChromeAIAvailable) {
            // If Chrome AI is selected but not available, go to settings for instructions
            setProvider(v);
            setView('settings');
            return;
          }
          setProvider(v);
        }}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chrome" className="text-green-600 font-medium">Chrome AI (Free)</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="gemini">Gemini</SelectItem>
          </SelectContent>
        </Select>

        {selectedProvider === 'chrome' ? (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground italic border rounded px-2 h-8 bg-muted/20">
            Built-in (Free)
          </div>
        ) : currentKey ? (
          <div className="flex flex-1 gap-1">
            <Select value={selectedModel} onValueChange={setModel}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {currentModels?.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => currentKey && fetchModels(selectedProvider, currentKey)}
              disabled={!currentKey || isFetchingModels}
              title="Refresh Models"
            >
              <RefreshCw className={`h-3 w-3 ${isFetchingModels ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground italic border rounded px-2 h-8 bg-muted/20">
            Enter API Key
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        {status === 'idle' && !summary && (
          <div className="flex flex-col h-full">
            {/* Empty State / Dashboard */}
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 min-h-[200px]">
              <Sparkles className="h-10 w-10 text-indigo-400 opacity-50" />
              <p className="text-sm text-muted-foreground w-3/4">
                Navigate to an article and click Summarize.
              </p>
              {!currentKey && (
                <Button variant="outline" size="sm" onClick={() => setView('settings')}>
                  Set API Key
                </Button>
              )}
            </div>

            {/* Recent Articles (if any) */}
            {savedArticles.length > 0 && (
              <div className="mt-auto pt-6 border-t border-border/40">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recently Saved</h3>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setView('library')}>
                    View All <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {savedArticles.slice(0, 3).map(article => (
                    <div
                      key={article.id}
                      className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => openLink(article.url)}
                    >
                      <div className="mt-0.5 bg-indigo-500/10 p-1 rounded">
                        <BookOpen className="h-3 w-3 text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{article.title}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(article.savedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex gap-2 items-start text-sm">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {(status === 'streaming' || summary) && (
          <div className="pb-8">
            {selectedProvider === 'chrome' && <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Bot className="h-3 w-3" /> Generated by Chrome Built-in AI</div>}
            <div className="prose prose-sm dark:prose-invert max-w-none 
                  prose-headings:text-indigo-400 prose-headings:font-bold prose-headings:mb-2 prose-headings:mt-4
                  prose-h1:text-xl prose-h1:bg-gradient-to-r prose-h1:from-indigo-400 prose-h1:to-violet-400 prose-h1:bg-clip-text prose-h1:text-transparent prose-h1:border-b prose-h1:border-indigo-500/20 prose-h1:pb-2
                  prose-h2:text-lg prose-h2:text-indigo-300
                  prose-strong:text-indigo-200
                  prose-ul:list-disc prose-ul:pl-4 prose-li:my-0.5">
              <ReactMarkdown>{summary}</ReactMarkdown>
              {status === 'streaming' && <span className="animate-pulse inline-block w-2 h-4 bg-indigo-500 ml-1" />}
            </div>

            {status === 'idle' && summary && (
              <div className="mt-8 pt-6 border-t border-border/40 flex flex-col items-center">
                {/* UI Feedback Logic:
                        - If SAVING: Show Button (pulsing)
                        - If JUST SAVED (saveStatus='saved'): Show Green "Saved" feedback (temporary)
                        - If ALREADY SAVED (isArticleSaved) & NOT 'saved': Show LIST
                        - Else: Show Button
                     */}

                {saveStatus === 'saved' ? (
                  <div className="flex flex-col items-center gap-2 text-green-500 animate-in fade-in zoom-in duration-300 py-4">
                    <div className="bg-green-500/10 p-3 rounded-full">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <span className="font-medium text-sm">Saved to Library</span>
                  </div>
                ) : isArticleSaved ? (
                  <div className="w-full bg-muted/30 rounded-lg p-3 animate-in fade-in slide-in-from-bottom-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <BookOpen className="h-3 w-3" /> In your Library
                    </h3>
                    {savedArticles.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {/* Show the top 3, similar to dashboard */}
                        {savedArticles.slice(0, 3).map(article => (
                          <div
                            key={article.id}
                            className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border/40 bg-background/50"
                            onClick={() => openLink(article.url)}
                          >
                            <div className="mt-0.5">
                              <BookOpen className="h-3 w-3 text-indigo-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{article.title}</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(article.savedAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setView('library')}>Open Full Library</Button>
                  </div>
                ) : (
                  <Button
                    className="w-full bg-secondary/80 hover:bg-secondary text-secondary-foreground"
                    onClick={handleSaveToLibrary}
                    disabled={saveStatus === 'saving'}
                  >
                    {saveStatus === 'saving' ? (
                      <Bookmark className="mr-2 h-4 w-4 animate-pulse" />
                    ) : (
                      <Bookmark className="mr-2 h-4 w-4" />
                    )}
                    Save to Library
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <footer className="p-4 border-t border-border/40 bg-muted/20 shrink-0">
        <Button
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition-all"
          onClick={handleSummarize}
          disabled={status === 'loading' || status === 'streaming'}
        >
          {status === 'loading' ? 'Analyzing...' : status === 'streaming' ? 'Streaming...' : 'Summarize Page'}
          <Sparkles className="ml-2 h-4 w-4" />
        </Button>
      </footer>
    </div>
  )
}

export default App
