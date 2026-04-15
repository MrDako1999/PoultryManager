import React from 'react';
import { Document, Page, View, Text, Image, Link, StyleSheet, Font } from '@react-pdf/renderer';

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
  red: '#dc2626',
  headerBg: '#166534',
  headerText: '#ffffff',
  rowAlt: '#f9fafb',
};

const PORTION_KEY_MAP = {
  LIVER: 'portionLiver', GIZZARD: 'portionGizzard', HEART: 'portionHeart',
  BREAST: 'portionBreast', LEG: 'portionLeg', WING: 'portionWing',
  BONE: 'portionBone', THIGH: 'portionThigh', DRUMSTICK: 'portionDrumstick',
  BONELESS_THIGH: 'portionBonelessThigh', NECK: 'portionNeck', MINCE: 'portionMince',
};

const SALE_METHOD_KEY_MAP = {
  SLAUGHTERED: 'saleMethodSlaughtered',
  LIVE_BY_PIECE: 'saleMethodLiveByPiece',
  LIVE_BY_WEIGHT: 'saleMethodLiveByWeight',
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    color: COLORS.textDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
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
    fontSize: 16,
    fontWeight: 700,
    color: COLORS.primary,
    marginBottom: 2,
  },
  sellerDetail: {
    fontSize: 8,
    color: COLORS.textLight,
    lineHeight: 1.5,
  },
  docType: {
    backgroundColor: COLORS.headerBg,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 4,
  },
  docTypeText: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.headerText,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  thickDivider: {
    height: 2,
    backgroundColor: COLORS.primary,
    marginVertical: 14,
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
    gap: 24,
    marginBottom: 20,
  },
  partyBlock: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
    padding: 12,
    borderRadius: 6,
  },
  partyTitle: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  partyName: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.textDark,
    marginBottom: 3,
  },
  partyDetail: {
    fontSize: 8,
    color: COLORS.textMedium,
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.primary,
    marginBottom: 6,
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.headerBg,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 1,
  },
  tableHeaderText: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.headerText,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: COLORS.rowAlt,
  },
  tableCell: {
    fontSize: 9,
    color: COLORS.textMedium,
  },
  tableCellBold: {
    fontSize: 9,
    fontWeight: 600,
    color: COLORS.textDark,
  },
  totalsContainer: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  totalsBox: {
    width: 240,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  totalsLabel: {
    fontSize: 9,
    color: COLORS.textMedium,
  },
  totalsValue: {
    fontSize: 9,
    fontWeight: 500,
    color: COLORS.textDark,
  },
  totalsNegative: {
    fontSize: 9,
    fontWeight: 500,
    color: COLORS.red,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: COLORS.headerBg,
    borderRadius: 4,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.headerText,
  },
  grandTotalValue: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.headerText,
  },
  notesSection: {
    marginTop: 20,
    padding: 10,
    backgroundColor: COLORS.rowAlt,
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 8,
    color: COLORS.textMedium,
    lineHeight: 1.5,
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
  badge: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 7,
    fontWeight: 600,
    color: COLORS.primary,
  },
  reportSection: {
    marginTop: 16,
    padding: 10,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  reportTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: COLORS.primary,
    marginBottom: 4,
  },
  reportLink: {
    fontSize: 8,
    color: COLORS.primary,
    textDecoration: 'underline',
    marginBottom: 2,
  },
  reportNote: {
    fontSize: 7,
    color: COLORS.textLight,
    marginTop: 4,
  },
});

const colW = {
  desc: '40%',
  weight: '20%',
  rate: '20%',
  amount: '20%',
  partType: '30%',
  qty: '20%',
  portionRate: '25%',
  portionAmount: '25%',
};

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

function TableHeaderRow(columns) {
  return h(View, { style: s.tableHeader },
    ...columns.map((col, i) =>
      h(Text, { key: i, style: [s.tableHeaderText, { width: col.width, textAlign: col.align || 'left' }] }, col.label)
    )
  );
}

function DataRow(cells, columns, index) {
  return h(View, { style: [s.tableRow, index % 2 === 1 && s.tableRowAlt] },
    ...cells.map((cell, i) =>
      h(Text, {
        key: i,
        style: [
          columns[i].bold ? s.tableCellBold : s.tableCell,
          { width: columns[i].width, textAlign: columns[i].align || 'left' },
        ],
      }, cell)
    )
  );
}

function WholeChickenTable(items, currency, labels) {
  const cols = [
    { label: labels.description, width: colW.desc },
    { label: labels.weightKg, width: colW.weight, align: 'right' },
    { label: labels.ratePerKg, width: colW.rate, align: 'right' },
    { label: labels.amount, width: colW.amount, align: 'right', bold: true },
  ];

  return h(View, null,
    h(Text, { style: s.sectionTitle }, labels.wholeChicken),
    TableHeaderRow(cols),
    ...items.map((item, i) =>
      DataRow([
        item.description || labels.wholeChickensDefault,
        fmt(item.weightKg),
        fmt(item.ratePerKg),
        fmt(item.amount, currency),
      ], cols, i)
    )
  );
}

function PortionsTable(items, currency, labels) {
  const cols = [
    { label: labels.partType, width: colW.partType },
    { label: labels.qtyPcs, width: colW.qty, align: 'right' },
    { label: labels.rate, width: colW.portionRate, align: 'right' },
    { label: labels.amount, width: colW.portionAmount, align: 'right', bold: true },
  ];

  return h(View, null,
    h(Text, { style: s.sectionTitle }, labels.poultryPortions),
    TableHeaderRow(cols),
    ...items.map((item, i) =>
      DataRow([
        labels[PORTION_KEY_MAP[item.partType]] || item.partType,
        String(item.quantity || 0),
        fmt(item.rate),
        fmt(item.amount, currency),
      ], cols, i)
    )
  );
}

function LiveWeightTable(items, currency, labels) {
  const cols = [
    { label: labels.description, width: colW.desc },
    { label: labels.weightKg, width: colW.weight, align: 'right' },
    { label: labels.ratePerKg, width: colW.rate, align: 'right' },
    { label: labels.amount, width: colW.amount, align: 'right', bold: true },
  ];

  return h(View, null,
    h(Text, { style: s.sectionTitle }, labels.liveWeightTitle),
    TableHeaderRow(cols),
    ...items.map((item, i) =>
      DataRow([
        item.description || labels.liveChickensDefault,
        fmt(item.weightKg),
        fmt(item.ratePerKg),
        fmt(item.amount, currency),
      ], cols, i)
    )
  );
}

function LiveByPieceTable(birdCount, ratePerBird, currency, labels) {
  const amount = (birdCount || 0) * (ratePerBird || 0);
  const cols = [
    { label: labels.description, width: colW.desc },
    { label: labels.qtyBirds, width: colW.weight, align: 'right' },
    { label: labels.ratePerBird, width: colW.rate, align: 'right' },
    { label: labels.amount, width: colW.amount, align: 'right', bold: true },
  ];

  return h(View, null,
    h(Text, { style: s.sectionTitle }, labels.livePieceTitle),
    TableHeaderRow(cols),
    DataRow([
      labels.liveChickensDefault,
      String(birdCount || 0),
      fmt(ratePerBird),
      fmt(amount, currency),
    ], cols, 0)
  );
}

function TotalsSummary(totals, currency, showVat, vatRate, labels) {
  const hasTransport = (totals.transportDeduction || 0) !== 0;
  const hasDiscounts = (totals.discounts || 0) !== 0;

  const rows = [];

  rows.push(
    h(View, { key: 'gross', style: s.totalsRow },
      h(Text, { style: [s.totalsLabel, { fontWeight: 600 }] }, labels.grossSales),
      h(Text, { style: s.totalsValue }, fmt(totals.grossSales, currency))
    )
  );

  if (hasTransport) {
    rows.push(
      h(View, { key: 'transport', style: s.totalsRow },
        h(Text, { style: s.totalsLabel }, labels.transportDeduction),
        h(Text, { style: s.totalsNegative }, `-${fmt(Math.abs(totals.transportDeduction), currency)}`)
      )
    );
  }

  if (hasDiscounts) {
    rows.push(
      h(View, { key: 'discounts', style: s.totalsRow },
        h(Text, { style: s.totalsLabel }, labels.discounts),
        h(Text, { style: s.totalsNegative }, `-${fmt(Math.abs(totals.discounts), currency)}`)
      )
    );
  }

  rows.push(h(View, { key: 'div', style: [s.divider, { marginVertical: 4 }] }));

  rows.push(
    h(View, { key: 'subtotal', style: s.totalsRow },
      h(Text, { style: [s.totalsLabel, { fontWeight: 600 }] }, labels.subtotal),
      h(Text, { style: s.totalsValue }, fmt(totals.subtotal, currency))
    )
  );

  if (showVat) {
    rows.push(
      h(View, { key: 'vat', style: s.totalsRow },
        h(Text, { style: s.totalsLabel }, `${labels.vat} (${vatRate || 0}%)`),
        h(Text, { style: s.totalsValue }, fmt(totals.vat, currency))
      )
    );
  }

  rows.push(
    h(View, { key: 'grand', style: s.grandTotalRow },
      h(Text, { style: s.grandTotalLabel }, labels.grandTotal),
      h(Text, { style: s.grandTotalValue }, fmt(totals.grandTotal, currency))
    )
  );

  return h(View, { style: s.totalsContainer },
    h(View, { style: s.totalsBox }, ...rows)
  );
}

export default function SaleInvoicePDF({ data }) {
  const {
    seller,
    buyer,
    saleNumber,
    saleDate,
    saleMethod,
    invoiceType,
    wholeChickenItems,
    portions,
    live,
    totals,
    discounts,
    currency,
    vatRate,
    notes,
    logoSrc,
    labels,
    reportDocUrls,
  } = data;

  const docTitle = invoiceType === 'VAT_INVOICE' ? labels.taxInvoice : labels.cashMemo;
  const showVat = invoiceType === 'VAT_INVOICE' && (vatRate || 0) > 0;
  const isSlaughtered = saleMethod === 'SLAUGHTERED';
  const isLiveByWeight = saleMethod === 'LIVE_BY_WEIGHT';
  const isLiveByPiece = saleMethod === 'LIVE_BY_PIECE';

  const children = [];

  // Header
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
        h(Text, { style: s.docTypeText }, docTitle)
      )
    )
  );

  children.push(h(View, { key: 'divider1', style: s.thickDivider }));

  // Invoice metadata
  children.push(
    h(View, { key: 'meta', style: s.metaRow },
      h(View, { style: s.metaBlock },
        h(Text, { style: s.metaLabel }, labels.invoiceNumber),
        h(Text, { style: s.metaValue }, saleNumber || '—')
      ),
      h(View, { style: s.metaBlock },
        h(Text, { style: s.metaLabel }, labels.date),
        h(Text, { style: s.metaValue }, formatDate(saleDate))
      ),
      h(View, { style: s.metaBlock },
        h(Text, { style: s.metaLabel }, labels.saleMethod),
        h(View, { style: s.badge },
          h(Text, { style: s.badgeText }, labels[SALE_METHOD_KEY_MAP[saleMethod]] || saleMethod)
        )
      )
    )
  );

  // Party row (From / Bill To)
  const fromChildren = [
    h(Text, { key: 'ft', style: s.partyTitle }, labels.from),
    h(Text, { key: 'fn', style: s.partyName }, seller.companyName || '—'),
  ];
  if (seller.address) fromChildren.push(h(Text, { key: 'fa', style: s.partyDetail }, seller.address));
  if (seller.trnNumber) fromChildren.push(h(Text, { key: 'ftrn', style: s.partyDetail }, `${labels.trn}: ${seller.trnNumber}`));

  const toChildren = [
    h(Text, { key: 'tt', style: s.partyTitle }, labels.billTo),
    h(Text, { key: 'tn', style: s.partyName }, buyer.companyName || '—'),
  ];
  if (buyer.address) toChildren.push(h(Text, { key: 'ta', style: s.partyDetail }, buyer.address));
  if (buyer.trnNumber) toChildren.push(h(Text, { key: 'ttrn', style: s.partyDetail }, `${labels.trn}: ${buyer.trnNumber}`));
  if (buyer.contactName) toChildren.push(h(Text, { key: 'tc', style: s.partyDetail }, `${labels.contact}: ${buyer.contactName}`));
  if (buyer.phone) toChildren.push(h(Text, { key: 'tp', style: s.partyDetail }, `${labels.phone}: ${buyer.phone}`));

  children.push(
    h(View, { key: 'parties', style: s.partyRow },
      h(View, { style: s.partyBlock }, ...fromChildren),
      h(View, { style: s.partyBlock }, ...toChildren)
    )
  );

  // Line items
  if (isSlaughtered && wholeChickenItems?.length > 0) {
    children.push(h(View, { key: 'wc' }, WholeChickenTable(wholeChickenItems, currency, labels)));
  }
  if (isSlaughtered && portions?.length > 0) {
    children.push(h(View, { key: 'por' }, PortionsTable(portions, currency, labels)));
  }
  if (isLiveByWeight && live?.weightItems?.length > 0) {
    children.push(h(View, { key: 'lw' }, LiveWeightTable(live.weightItems, currency, labels)));
  }
  if (isLiveByPiece) {
    children.push(h(View, { key: 'lp' }, LiveByPieceTable(live?.birdCount, live?.ratePerBird, currency, labels)));
  }

  // Discounts detail
  if (discounts?.length > 0) {
    const discountRows = discounts.map((d, i) =>
      h(View, { key: i, style: [s.tableRow, i % 2 === 1 && s.tableRowAlt] },
        h(Text, { style: [s.tableCell, { width: '70%' }] }, d.description || labels.discountDefault),
        h(Text, { style: [s.tableCellBold, { width: '30%', textAlign: 'right', color: COLORS.red }] },
          `-${fmt(d.amount, currency)}`)
      )
    );
    children.push(
      h(View, { key: 'disc', style: { marginTop: 10 } },
        h(Text, { style: s.sectionTitle }, labels.discounts),
        ...discountRows
      )
    );
  }

  // Totals
  children.push(h(View, { key: 'totals' }, TotalsSummary(totals || {}, currency, showVat, vatRate, labels)));

  // Notes
  if (notes) {
    children.push(
      h(View, { key: 'notes', style: s.notesSection },
        h(Text, { style: s.notesLabel }, labels.notes),
        h(Text, { style: s.notesText }, notes)
      )
    );
  }

  // Processing report links
  if (reportDocUrls?.length > 0) {
    const linkChildren = [
      h(Text, { key: 'rt', style: s.reportTitle }, labels.processingReport),
      ...reportDocUrls.map((doc, i) =>
        h(Link, { key: `rl-${i}`, src: doc.url, style: s.reportLink },
          doc.name || `${labels.viewProcessingReport} ${reportDocUrls.length > 1 ? i + 1 : ''}`.trim()
        )
      ),
    ];
    if (reportDocUrls.some(d => d.isEmbeddable)) {
      linkChildren.push(
        h(Text, { key: 'rn', style: s.reportNote }, labels.processingReportAttached)
      );
    }
    children.push(h(View, { key: 'report', style: s.reportSection }, ...linkChildren));
  }

  // Footer
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
