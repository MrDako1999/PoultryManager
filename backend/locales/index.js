import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const en = JSON.parse(readFileSync(join(__dirname, 'invoice.en.json'), 'utf-8'));
const transferEn = JSON.parse(readFileSync(join(__dirname, 'transfer.en.json'), 'utf-8'));
const statementEn = JSON.parse(readFileSync(join(__dirname, 'statement.en.json'), 'utf-8'));

const locales = { en };
const transferLocales = { en: transferEn };
const statementLocales = { en: statementEn };

export function getInvoiceLabels(lang = 'en') {
  return locales[lang] || locales.en;
}

export function getTransferLabels(lang = 'en') {
  return transferLocales[lang] || transferLocales.en;
}

export function getStatementLabels(lang = 'en') {
  return statementLocales[lang] || statementLocales.en;
}
