import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ar from './locales/ar.json';

const baseResources = {
  en: { translation: { ...en } },
  ar: { translation: { ...ar } },
};

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    // Caller passed a primitive (or array) where we expected an object; nothing
    // sensible to merge into. Returning the source-shaped value keeps the
    // namespaced copy useful while leaving the colliding scalar alone upstream.
    return { ...source };
  }
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

export function addModuleResources(moduleId, bundlesByLang, { mirrorToRoot = true, namespaceUnderModuleResources = true } = {}) {
  if (!moduleId || !bundlesByLang) return;
  for (const [lang, bundle] of Object.entries(bundlesByLang)) {
    const existing = i18n.getResourceBundle(lang, 'translation') || {};
    const next = { ...existing };

    // Canonical namespaced copy under `moduleResources.<id>.*`. We deliberately
    // do NOT nest under `modules.<id>` because the existing shell i18n stores
    // human labels under `modules.<id>` (e.g. `modules.broiler === 'Broiler
    // Management'`), which would collide with the namespaced bundle.
    if (namespaceUnderModuleResources) {
      if (!next.moduleResources || typeof next.moduleResources !== 'object') {
        next.moduleResources = {};
      }
      const slot = next.moduleResources[moduleId];
      next.moduleResources[moduleId] = deepMerge(
        slot && typeof slot === 'object' && !Array.isArray(slot) ? slot : {},
        bundle,
      );
    }

    // Back-compat mirror: expose the module's keys at the top level so
    // consumer code calling t('batches.foo') keeps working. Remove this branch
    // once every call-site has been migrated to t('moduleResources.<id>.batches.foo').
    if (mirrorToRoot) {
      for (const [rootKey, rootValue] of Object.entries(bundle)) {
        if (rootValue && typeof rootValue === 'object' && !Array.isArray(rootValue)) {
          if (!next[rootKey] || typeof next[rootKey] !== 'object' || Array.isArray(next[rootKey])) {
            next[rootKey] = {};
          }
          deepMerge(next[rootKey], rootValue);
        } else if (!(rootKey in next)) {
          next[rootKey] = rootValue;
        }
      }
    }

    i18n.addResourceBundle(lang, 'translation', next, true, true);
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: baseResources,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'pm-language',
    },
  });

// Module i18n bundles are registered via `addModuleResources` at module-registry load time
// (see frontend/src/modules/registry.js eager-importing each module, which in turn calls
// addModuleResources from its index.js bootstrap).

export default i18n;
