const languages = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇬🇧' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', flag: '🇦🇪' },
];

export const getLanguage = (code) => languages.find((l) => l.code === code);
export const isRTL = (code) => getLanguage(code)?.dir === 'rtl';
export default languages;
