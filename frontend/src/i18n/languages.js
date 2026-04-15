const languages = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇬🇧' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', flag: '🇦🇪' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl', flag: '🇵🇰' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', dir: 'ltr', flag: '🇧🇩' },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino', dir: 'ltr', flag: '🇵🇭' },
];

export const getLanguage = (code) => languages.find((l) => l.code === code);
export const isRTL = (code) => getLanguage(code)?.dir === 'rtl';
export default languages;
