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
};

const TRANSFER_TYPE_KEY = {
  BANK_TRANSFER: 'bankTransfer',
  CASH: 'cash',
  CHEQUE: 'cheque',
  CREDIT: 'credit',
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9,
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 30,
    color: COLORS.textDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logo: {
    width: 44,
    height: 44,
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
  docType: {
    backgroundColor: COLORS.headerBg,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  docTypeText: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.headerText,
    textTransform: 'uppercase',
  },
  thickDivider: {
    height: 2,
    backgroundColor: COLORS.primary,
    marginVertical: 12,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metaBlock: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    fontWeight: 600,
    color: COLORS.textDark,
  },
  partyRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  partyBlock: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
    padding: 10,
    borderRadius: 6,
  },
  partyTitle: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  partyName: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  partyDetail: {
    fontSize: 8,
    color: COLORS.textMedium,
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: COLORS.primary,
    marginBottom: 6,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 9,
    color: COLORS.textMedium,
  },
  detailValue: {
    fontSize: 9,
    fontWeight: 600,
    color: COLORS.textDark,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: COLORS.headerBg,
    borderRadius: 4,
    marginTop: 6,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.headerText,
  },
  amountValue: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.headerText,
  },
  notesSection: {
    marginTop: 14,
    padding: 8,
    backgroundColor: COLORS.rowAlt,
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  notesText: {
    fontSize: 8,
    color: COLORS.textMedium,
    lineHeight: 1.5,
  },
  badge: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 8,
    fontWeight: 600,
    color: COLORS.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 30,
    right: 30,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 7,
    color: COLORS.textLight,
  },
});

function fmt(val, currency) {
  const n = Number(val || 0);
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${formatted}` : formatted;
}

function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TransferReceiptPDF({ data }) {
  const {
    seller,
    counterparty,
    transferDate,
    amount,
    transferType,
    receiptNumber,
    currency,
    notes,
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
      seller.trnNumber ? h(Text, { style: s.sellerDetail }, `${labels.trn}: ${seller.trnNumber}`) : null,
    )
  );

  children.push(
    h(View, { key: 'header', style: s.header },
      h(View, { style: s.headerLeft }, ...headerLeftChildren),
      h(View, { style: s.docType },
        h(Text, { style: s.docTypeText }, labels.transferReceipt)
      )
    )
  );

  children.push(h(View, { key: 'divider1', style: s.thickDivider }));

  children.push(
    h(View, { key: 'meta', style: s.metaRow },
      h(View, { style: s.metaBlock },
        h(Text, { style: s.metaLabel }, labels.receiptNumber),
        h(Text, { style: s.metaValue }, receiptNumber || '—')
      ),
      h(View, { style: s.metaBlock },
        h(Text, { style: s.metaLabel }, labels.date),
        h(Text, { style: s.metaValue }, formatDate(transferDate))
      )
    )
  );

  const fromChildren = [
    h(Text, { key: 'ft', style: s.partyTitle }, labels.from),
    h(Text, { key: 'fn', style: s.partyName }, seller.companyName || '—'),
  ];
  if (seller.address) fromChildren.push(h(Text, { key: 'fa', style: s.partyDetail }, seller.address));
  if (seller.trnNumber) fromChildren.push(h(Text, { key: 'ftrn', style: s.partyDetail }, `${labels.trn}: ${seller.trnNumber}`));

  const toChildren = [
    h(Text, { key: 'tt', style: s.partyTitle }, labels.to),
    h(Text, { key: 'tn', style: s.partyName }, counterparty.companyName || '—'),
  ];
  if (counterparty.address) toChildren.push(h(Text, { key: 'ta', style: s.partyDetail }, counterparty.address));
  if (counterparty.trnNumber) toChildren.push(h(Text, { key: 'ttrn', style: s.partyDetail }, `${labels.trn}: ${counterparty.trnNumber}`));

  children.push(
    h(View, { key: 'parties', style: s.partyRow },
      h(View, { style: s.partyBlock }, ...fromChildren),
      h(View, { style: s.partyBlock }, ...toChildren)
    )
  );

  children.push(h(Text, { key: 'st', style: s.sectionTitle }, labels.transferDetails));

  children.push(
    h(View, { key: 'type-row', style: s.detailRow },
      h(Text, { style: s.detailLabel }, labels.transferType),
      h(View, { style: s.badge },
        h(Text, { style: s.badgeText }, labels[TRANSFER_TYPE_KEY[transferType]] || transferType)
      )
    )
  );

  children.push(
    h(View, { key: 'date-row', style: s.detailRow },
      h(Text, { style: s.detailLabel }, labels.date),
      h(Text, { style: s.detailValue }, formatDate(transferDate))
    )
  );

  children.push(
    h(View, { key: 'amount-row', style: s.amountRow },
      h(Text, { style: s.amountLabel }, labels.amount),
      h(Text, { style: s.amountValue }, fmt(amount, currency))
    )
  );

  if (notes) {
    children.push(
      h(View, { key: 'notes', style: s.notesSection },
        h(Text, { style: s.notesLabel }, labels.notes),
        h(Text, { style: s.notesText }, notes)
      )
    );
  }

  children.push(
    h(View, { key: 'footer', style: s.footer },
      h(Text, { style: s.footerText }, labels.footerGenerated),
      h(Text, { style: [s.footerText, { marginTop: 2 }] }, labels.footerCurrency.replace('{{currency}}', currency || 'AED'))
    )
  );

  return h(Document, null,
    h(Page, { size: { width: 419.53, height: 595.28 }, style: s.page }, ...children)
  );
}
