// Configuration management for the multilingual chat application
export interface ApiConfig {
  openaiApiKey: string;
  geminiApiKey: string;
  claudeApiKey: string;
  twilioConfig: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  smtpConfig: {
    host: string;
    port: string;
    user: string;
    pass: string;
  };
}

// Default configuration from environment variables
export const config: ApiConfig = {
  openaiApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  geminiApiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
  claudeApiKey: process.env.NEXT_PUBLIC_CLAUDE_API_KEY || '',
  twilioConfig: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },
  smtpConfig: {
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT || '587',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};

// Supported languages for the chat application
// Official languages of European Union member states + additional languages
export const SUPPORTED_LANGUAGES = {
  // European Union Official Languages
  'bg': 'Bulgarian (Български)',
  'hr': 'Croatian (Hrvatski)',
  'cs': 'Czech (Čeština)',
  'da': 'Danish (Dansk)',
  'nl': 'Dutch (Nederlands)',
  'en': 'English',
  'et': 'Estonian (Eesti)',
  'fi': 'Finnish (Suomi)',
  'fr': 'French (Français)',
  'de': 'German (Deutsch)',
  'el': 'Greek (Ελληνικά)',
  'hu': 'Hungarian (Magyar)',
  'ga': 'Irish (Gaeilge)',
  'it': 'Italian (Italiano)',
  'lv': 'Latvian (Latviešu)',
  'lt': 'Lithuanian (Lietuvių)',
  'mt': 'Maltese (Malti)',
  'pl': 'Polish (Polski)',
  'pt': 'Portuguese (Português)',
  'ro': 'Romanian (Română)',
  'sk': 'Slovak (Slovenčina)',
  'sl': 'Slovenian (Slovenščina)',
  'es': 'Spanish (Español)',
  'sv': 'Swedish (Svenska)',
  
  // Balkan Languages (including Albania and neighboring countries)
  'sq': 'Albanian (Shqip)',
  'mk': 'Macedonian (Македонски)',
  'me': 'Montenegrin (Crnogorski)',
  'sr': 'Serbian (Српски)',
  'bs': 'Bosnian (Bosanski)',
  
  // Additional Major Languages
  'ar': 'Arabic (العربية)',
  'he': 'Hebrew (עברית)',
  'zh': 'Chinese (中文)',
  'ja': 'Japanese (日本語)',
  'ko': 'Korean (한국어)',
  'ru': 'Russian (Русский)',
  'tr': 'Turkish (Türkçe)',
  'uk': 'Ukrainian (Українська)',
  'no': 'Norwegian (Norsk)',
  'is': 'Icelandic (Íslenska)',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Validation functions
export const validateConfig = (): { isValid: boolean; missingKeys: string[] } => {
  const missingKeys: string[] = [];
  
  if (!config.openaiApiKey) missingKeys.push('NEXT_PUBLIC_OPENAI_API_KEY');
  if (!config.geminiApiKey) missingKeys.push('NEXT_PUBLIC_GEMINI_API_KEY');
  if (!config.claudeApiKey) missingKeys.push('NEXT_PUBLIC_CLAUDE_API_KEY');
  
  return {
    isValid: missingKeys.length === 0,
    missingKeys,
  };
};

// Runtime configuration that can be updated via admin panel
let runtimeConfig: Partial<ApiConfig> = {};

export const updateRuntimeConfig = (newConfig: Partial<ApiConfig>) => {
  runtimeConfig = { ...runtimeConfig, ...newConfig };
};

export const getRuntimeConfig = (): ApiConfig => {
  return { ...config, ...runtimeConfig };
};

// Helper function to get language name
export const getLanguageName = (code: SupportedLanguage): string => {
  return SUPPORTED_LANGUAGES[code] || code;
};

// Helper function to validate language code
export const isValidLanguage = (code: string): code is SupportedLanguage => {
  return code in SUPPORTED_LANGUAGES;
};
