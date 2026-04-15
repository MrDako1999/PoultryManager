import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';

const h = React.createElement;

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZhrib2Bg-4.ttf', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Bg-4.ttf', fontWeight: 700 },
  ],
});

const COLORS = {
  primary: '#166534',
  primaryLight: '#f0fdf4',
  border: '#e5e7eb',
  textDark: '#111827',
  textMedium: '#374151',
  textLight: '#6b7280',
  white: '#ffffff',
  headerBg: '#166534',
  headerText: '#ffffff',
  rowAlt: '#f9fafb',
  red: '#dc2626',
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 8,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    color: COLORS.textDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logo: {
    width: 56,
    height: 56,
    objectFit: 'contain',
  },
  sellerInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 700,
    color: COLORS.primary,
    marginBottom: 2,
  },
  sellerDetail: {
    fontSize: 7,
    color: COLORS.textLight,
    lineHeight: 1.5,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 4,
    textDecoration: 'underline',
    color: COLORS.textDark,
  },
  subtitle: {
    fontSize: 8,
    textAlign: 'center',
    color: COLORS.textMedium,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metaBlock: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.textLight,
  },
  metaValue: {
    fontSize: 9,
    fontWeight: 600,
    color: COLORS.textDark,
  },
  thickDivider: {
    height: 2,
    backgroundColor: COLORS.primary,
    marginVertical: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.textDark,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: COLORS.textDark,
  },
  tableHeaderText: {
    fontSize: 7,
    fontWeight: 700,
    color: COLORS.white,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: COLORS.rowAlt,
  },
  tableCell: {
    fontSize: 7.5,
    color: COLORS.textMedium,
  },
  tableCellBold: {
    fontSize: 7.5,
    fontWeight: 600,
    color: COLORS.textDark,
  },
  totalsRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.rowAlt,
  },
  amountDueContainer: {
    marginTop: 8,
    backgroundColor: COLORS.rowAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  amountDueLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.textDark,
  },
  amountDueValue: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.textDark,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 7,
    color: COLORS.textLight,
  },
});

const COL = {
  date: '15%',
  debit: '17%',
  credit: '17%',
  description: '51%',
};

function fmtAmount(val, currency) {
  if (!val || val === 0) return '';
  const n = Number(val);
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency}${formatted}` : formatted;
}

function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function StatementPDF({ data }) {
  const {
    seller,
    customer,
    soaNumber,
    generatedDate,
    dateFrom,
    dateTo,
    entries,
    totalDebits,
    totalCredits,
    amountDue,
    currency,
    logoSrc,
    labels,
  } = data;

  const children = [];

  const headerLeftChildren = [];
  if (logoSrc) headerLeftChildren.push(h(Image, { key: 'logo', style: s.logo, src: logoSrc }));
  headerLeftChildren.push(
    h(View, { key: 'info', style: s.sellerInfo },
      h(Text, { style: s.companyName }, seller.companyName || ''),
      seller.address ? h(Text, { style: s.sellerDetail }, seller.address) : null,
      seller.trnNumber ? h(Text, { style: s.sellerDetail }, `${seller.trnNumber}`) : null,
    )
  );

  children.push(
    h(View, { key: 'header', style: s.header },
      h(View, { style: s.headerLeft }, ...headerLeftChildren),
    )
  );

  children.push(h(View, { key: 'div1', style: s.thickDivider }));

  children.push(h(Text, { key: 'title', style: s.title }, labels.statementOfAccount));
  children.push(
    h(Text, { key: 'subtitle', style: s.subtitle },
      labels.statementFor
        .replace('{{name}}', customer.companyName || '')
        .replace('{{from}}', formatDate(dateFrom))
        .replace('{{to}}', formatDate(dateTo))
    )
  );

  children.push(
    h(View, { key: 'meta', style: s.metaRow },
      h(View, { style: s.metaBlock },
        h(Text, { style: s.metaLabel }, labels.customer),
        h(Text, { style: s.metaValue }, customer.companyName || '—'),
        customer.trnNumber ? h(Text, { style: s.metaLabel }, `${labels.trn}    ${customer.trnNumber}`) : null,
      ),
      h(View, { style: [s.metaBlock, { alignItems: 'flex-end' }] },
        h(Text, { style: s.metaLabel }, `${labels.soaNumber}    ${soaNumber || '—'}`),
        h(Text, { style: s.metaLabel }, `${labels.date}    ${formatDate(generatedDate)}`),
      )
    )
  );

  children.push(
    h(View, { key: 'th', style: s.tableHeader },
      h(Text, { style: [s.tableHeaderText, { width: COL.date }] }, labels.dateColumn),
      h(Text, { style: [s.tableHeaderText, { width: COL.debit, textAlign: 'right' }] }, labels.debit),
      h(Text, { style: [s.tableHeaderText, { width: COL.credit, textAlign: 'right' }] }, labels.credit),
      h(Text, { style: [s.tableHeaderText, { width: COL.description }] }, labels.description),
    )
  );

  entries.forEach((entry, i) => {
    children.push(
      h(View, { key: `row-${i}`, style: [s.tableRow, i % 2 === 1 && s.tableRowAlt] },
        h(Text, { style: [s.tableCell, { width: COL.date }] }, formatDate(entry.date)),
        h(Text, { style: [s.tableCellBold, { width: COL.debit, textAlign: 'right' }] }, fmtAmount(entry.debit, currency)),
        h(Text, { style: [s.tableCellBold, { width: COL.credit, textAlign: 'right' }] }, fmtAmount(entry.credit, currency)),
        h(Text, { style: [s.tableCell, { width: COL.description }] }, entry.description || ''),
      )
    );
  });

  children.push(
    h(View, { key: 'totals', style: s.totalsRow },
      h(Text, { style: [s.tableCellBold, { width: COL.date }] }, ''),
      h(Text, { style: [s.tableCellBold, { width: COL.debit, textAlign: 'right' }] }, fmtAmount(totalDebits, currency)),
      h(Text, { style: [s.tableCellBold, { width: COL.credit, textAlign: 'right' }] }, fmtAmount(totalCredits, currency)),
      h(Text, { style: [s.tableCellBold, { width: COL.description }] }, ''),
    )
  );

  children.push(
    h(View, { key: 'due', style: s.amountDueContainer },
      h(Text, { style: s.amountDueLabel }, labels.amountDue),
      h(Text, { style: [s.amountDueValue, amountDue < 0 && { color: COLORS.red }] },
        `${amountDue < 0 ? '-' : ''}${currency}${Math.abs(amountDue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ),
    )
  );

  children.push(
    h(View, { key: 'footer', style: s.footer },
      h(Text, { style: s.footerText }, labels.footerGenerated),
      h(Text, { style: [s.footerText, { marginTop: 2 }] }, labels.footerCurrency.replace('{{currency}}', currency || 'AED'))
    )
  );

  return h(Document, null,
    h(Page, { size: 'A4', style: s.page }, ...children)
  );
}
