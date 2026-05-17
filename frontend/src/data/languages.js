// Priority languages representing the largest refugee populations
// BCP-47 code, native name, English name, flag emoji
export const PRIORITY_LANGUAGES = [
  { code: 'ar', name: 'العربية',    english: 'Arabic',    flag: '🇸🇦' },
  { code: 'fa', name: 'دری',        english: 'Dari',      flag: '🇦🇫' },
  { code: 'ps', name: 'پښتو',       english: 'Pashto',    flag: '🇦🇫' },
  { code: 'so', name: 'Soomaali',   english: 'Somali',    flag: '🇸🇴' },
  { code: 'ti', name: 'ትግርኛ',      english: 'Tigrinya',  flag: '🇪🇷' },
  { code: 'am', name: 'አማርኛ',      english: 'Amharic',   flag: '🇪🇹' },
  { code: 'uk', name: 'Українська', english: 'Ukrainian', flag: '🇺🇦' },
  { code: 'es', name: 'Español',    english: 'Spanish',   flag: '🇪🇸' },
  { code: 'fr', name: 'Français',   english: 'French',    flag: '🇫🇷' },
  { code: 'sw', name: 'Kiswahili',  english: 'Swahili',   flag: '🇰🇪' },
  { code: 'my', name: 'မြန်မာ',     english: 'Burmese',   flag: '🇲🇲' },
  { code: 'ku', name: 'Kurdî',      english: 'Kurdish',   flag: '🏳️' },
]

export const ALL_LANGUAGES = [
  ...PRIORITY_LANGUAGES,
  { code: 'en', name: 'English',    english: 'English',   flag: '🇬🇧' },
  { code: 'zh', name: '中文',       english: 'Chinese',   flag: '🇨🇳' },
  { code: 'hi', name: 'हिन्दी',    english: 'Hindi',     flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা',     english: 'Bengali',   flag: '🇧🇩' },
  { code: 'ur', name: 'اردو',      english: 'Urdu',      flag: '🇵🇰' },
  { code: 'tr', name: 'Türkçe',    english: 'Turkish',   flag: '🇹🇷' },
  { code: 'ru', name: 'Русский',   english: 'Russian',   flag: '🇷🇺' },
  { code: 'pt', name: 'Português', english: 'Portuguese',flag: '🇧🇷' },
  { code: 'de', name: 'Deutsch',   english: 'German',    flag: '🇩🇪' },
  { code: 'ha', name: 'Hausa',     english: 'Hausa',     flag: '🇳🇬' },
  { code: 'yo', name: 'Yorùbá',    english: 'Yoruba',    flag: '🇳🇬' },
]

export function getLanguageByCode(code) {
  return ALL_LANGUAGES.find(l => l.code === code) || { code, name: code, english: code, flag: '🌐' }
}
