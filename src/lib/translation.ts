import { getRuntimeConfig, SupportedLanguage, isValidLanguage } from './config';

export interface TranslationResult {
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage: string;
  confidence?: number;
}

export interface TranslationError {
  error: string;
  code: string;
  details?: string;
}

// OpenAI Translation Service (for direct text translation)
export async function translateTextOpenAI(
  text: string,
  targetLang: SupportedLanguage,
  sourceLang?: SupportedLanguage
): Promise<TranslationResult> {
  try {
    const config = getRuntimeConfig();
    
    if (!config.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = sourceLang 
      ? `Translate the following text from ${sourceLang} to ${targetLang}: "${text}"`
      : `Translate the following text to ${targetLang}: "${text}"`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Provide only the translated text without any additional commentary or explanation.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const translatedText = data.choices[0]?.message?.content?.trim();

    if (!translatedText) {
      throw new Error('No translation received from OpenAI');
    }

    return {
      translatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      confidence: 0.95, // OpenAI generally has high confidence
    };
  } catch (error) {
    console.error('OpenAI translation error:', error);
    throw {
      error: 'Translation failed',
      code: 'OPENAI_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as TranslationError;
  }
}

// Gemini Translation Service (for document translation)
export async function translateDocumentGemini(
  documentContent: string,
  targetLang: SupportedLanguage,
  sourceLang?: SupportedLanguage
): Promise<TranslationResult> {
  try {
    const config = getRuntimeConfig();
    
    if (!config.geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    const prompt = sourceLang
      ? `Translate this document from ${sourceLang} to ${targetLang}. Maintain the document structure and formatting:\n\n${documentContent}`
      : `Translate this document to ${targetLang}. Maintain the document structure and formatting:\n\n${documentContent}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${config.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const translatedText = data.candidates[0]?.content?.parts[0]?.text;

    if (!translatedText) {
      throw new Error('No translation received from Gemini');
    }

    return {
      translatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      confidence: 0.92,
    };
  } catch (error) {
    console.error('Gemini translation error:', error);
    throw {
      error: 'Document translation failed',
      code: 'GEMINI_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as TranslationError;
  }
}

// Claude Translation Service (for strict/formal requests)
export async function translateTextClaude(
  text: string,
  targetLang: SupportedLanguage,
  sourceLang?: SupportedLanguage,
  context?: 'formal' | 'business' | 'legal'
): Promise<TranslationResult> {
  try {
    const config = getRuntimeConfig();
    
    if (!config.claudeApiKey) {
      throw new Error('Claude API key not configured');
    }

    const contextInstruction = context 
      ? `This is a ${context} translation. Use appropriate formal language and terminology.`
      : 'This is a formal translation. Maintain professional tone.';

    const prompt = sourceLang
      ? `${contextInstruction} Translate the following text from ${sourceLang} to ${targetLang}: "${text}"`
      : `${contextInstruction} Translate the following text to ${targetLang}: "${text}"`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.claudeApiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const translatedText = data.content[0]?.text;

    if (!translatedText) {
      throw new Error('No translation received from Claude');
    }

    return {
      translatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      confidence: 0.98, // Claude is very reliable for formal translations
    };
  } catch (error) {
    console.error('Claude translation error:', error);
    throw {
      error: 'Formal translation failed',
      code: 'CLAUDE_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
    } as TranslationError;
  }
}

// Auto-detect language and choose appropriate translation service
export async function autoTranslate(
  text: string,
  targetLang: SupportedLanguage,
  messageType: 'casual' | 'document' | 'formal' = 'casual'
): Promise<TranslationResult> {
  try {
    switch (messageType) {
      case 'document':
        return await translateDocumentGemini(text, targetLang);
      case 'formal':
        return await translateTextClaude(text, targetLang, undefined, 'formal');
      case 'casual':
      default:
        return await translateTextOpenAI(text, targetLang);
    }
  } catch (error) {
    console.error('Auto-translation error:', error);
    // Fallback to OpenAI if other services fail
    if (messageType !== 'casual') {
      try {
        return await translateTextOpenAI(text, targetLang);
      } catch (fallbackError) {
        throw error; // Throw original error if fallback also fails
      }
    }
    throw error;
  }
}

// Detect language of text (using OpenAI)
export async function detectLanguage(text: string): Promise<SupportedLanguage | null> {
  try {
    const config = getRuntimeConfig();
    
    if (!config.openaiApiKey) {
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a language detection expert. Respond with only the ISO 639-1 language code (2 letters) of the detected language. Supported codes: sq, bg, el, mk, me, sr, en, ar, he, zh, ja'
          },
          {
            role: 'user',
            content: `Detect the language of this text: "${text}"`
          }
        ],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const detectedLang = data.choices[0]?.message?.content?.trim().toLowerCase();

    return isValidLanguage(detectedLang) ? detectedLang : null;
  } catch (error) {
    console.error('Language detection error:', error);
    return null;
  }
}

// Batch translation for multiple messages
export async function batchTranslate(
  messages: Array<{ text: string; type?: 'casual' | 'document' | 'formal' }>,
  targetLang: SupportedLanguage
): Promise<TranslationResult[]> {
  const results: TranslationResult[] = [];
  
  for (const message of messages) {
    try {
      const result = await autoTranslate(message.text, targetLang, message.type);
      results.push(result);
    } catch (error) {
      results.push({
        translatedText: message.text, // Fallback to original text
        targetLanguage: targetLang,
        confidence: 0,
      });
    }
  }
  
  return results;
}
