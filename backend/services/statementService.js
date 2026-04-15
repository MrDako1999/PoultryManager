import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import Business from '../models/Business.js';
import SaleOrder from '../models/SaleOrder.js';
import Expense from '../models/Expense.js';
import FeedOrder from '../models/FeedOrder.js';
import Source from '../models/Source.js';
import Transfer from '../models/Transfer.js';
import User from '../models/User.js';
import Batch from '../models/Batch.js';
import Media from '../models/Media.js';
import { uploadFile, deleteFile } from './storageService.js';
import StatementPDF from '../templates/StatementPDF.js';
import { getStatementLabels } from '../locales/index.js';

async function fetchImageBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

const TRANSFER_TYPE_KEY = {
  BANK_TRANSFER: 'bankTransfer',
  CASH: 'cash',
  CHEQUE: 'cheque',
  CREDIT: 'credit',
};

export async function generateStatement(businessId, userId, dateFrom, dateTo) {
  const business = await Business.findById(businessId);
  if (!business) throw new Error('Business not found');

  const user = await User.findById(userId).populate({
    path: 'accountBusiness',
    populate: { path: 'logo' },
  });

  const sellerBiz = user?.accountBusiness;

  let logoSrc = null;
  if (sellerBiz?.logo?.url) {
    const buf = await fetchImageBuffer(sellerBiz.logo.url);
    if (buf) logoSrc = buf;
  }

  const labels = getStatementLabels(user?.invoiceLanguage || 'en');
  const currency = user?.currency || 'AED';
  const isTrader = business.businessType !== 'SUPPLIER';

  const dateQuery = {};
  if (dateFrom) dateQuery.$gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    dateQuery.$lte = end;
  }

  const entries = [];

  if (isTrader) {
    const salesQuery = { user_id: userId, customer: businessId };
    if (dateFrom || dateTo) salesQuery.saleDate = dateQuery;
    const sales = await SaleOrder.find(salesQuery).populate('batch', 'batchName');

    for (const sale of sales) {
      const chickenCount = (sale.counts?.chickensSent || 0) + (sale.live?.birdCount || 0);
      const batchRef = sale.batch?.batchName || '';
      const memo = sale.slaughter?.slaughterMemo || '';
      let desc = labels.saleOf.replace('{{count}}', chickenCount.toLocaleString());
      if (batchRef) desc += ` - ${batchRef}`;
      if (memo) desc += `\n${memo}`;

      entries.push({
        date: sale.saleDate,
        debit: sale.totals?.grandTotal || 0,
        credit: 0,
        description: desc,
      });
    }
  }

  const expenseQuery = { user_id: userId, tradingCompany: businessId };
  if (dateFrom || dateTo) expenseQuery.expenseDate = dateQuery;
  const expenses = await Expense.find(expenseQuery);

  for (const exp of expenses) {
    if (isTrader) {
      entries.push({
        date: exp.expenseDate,
        debit: 0,
        credit: exp.totalAmount || 0,
        description: `${labels.slaughterProcessing?.replace('{{count}}', '') || labels.expense} - ${exp.description || exp.category || ''}`,
      });
    } else {
      entries.push({
        date: exp.expenseDate,
        debit: exp.totalAmount || 0,
        credit: 0,
        description: `${labels.expense} - ${exp.description || exp.category || ''}`,
      });
    }
  }

  if (!isTrader) {
    const feedQuery = { user_id: userId, feedCompany: businessId };
    if (dateFrom || dateTo) feedQuery.orderDate = dateQuery;
    const feedOrders = await FeedOrder.find(feedQuery);

    for (const fo of feedOrders) {
      entries.push({
        date: fo.orderDate,
        debit: fo.grandTotal || 0,
        credit: 0,
        description: labels.feedOrder,
      });
    }

    const sourceQuery = { user_id: userId, sourceFrom: businessId };
    if (dateFrom || dateTo) sourceQuery.invoiceDate = dateQuery;
    const sources = await Source.find(sourceQuery);

    for (const src of sources) {
      entries.push({
        date: src.invoiceDate,
        debit: src.grandTotal || 0,
        credit: 0,
        description: labels.sourceOrder.replace('{{count}}', (src.totalChicks || 0).toLocaleString()),
      });
    }
  }

  const transferQuery = { user_id: userId, business: businessId, deletedAt: null };
  if (dateFrom || dateTo) transferQuery.transferDate = dateQuery;
  const transfers = await Transfer.find(transferQuery);

  for (const tr of transfers) {
    const typeLabel = labels[TRANSFER_TYPE_KEY[tr.transferType]] || tr.transferType;
    entries.push({
      date: tr.transferDate,
      debit: 0,
      credit: tr.amount || 0,
      description: `${typeLabel} - `,
    });
  }

  entries.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  const amountDue = totalDebits - totalCredits;

  const soaNumber = `${business._id.toString().slice(-8)}`;
  const generatedDate = new Date();

  const fromDate = dateFrom || (entries.length > 0 ? entries[0].date : generatedDate);
  const toDate = dateTo || generatedDate;

  const data = {
    seller: {
      companyName: sellerBiz?.companyName || user?.companyName || '',
      address: sellerBiz?.address?.formattedAddress || '',
      trnNumber: sellerBiz?.trnNumber || '',
    },
    customer: {
      companyName: business.companyName || '',
      address: business.address?.formattedAddress || '',
      trnNumber: business.trnNumber || '',
    },
    soaNumber,
    generatedDate,
    dateFrom: fromDate,
    dateTo: toDate,
    entries,
    totalDebits,
    totalCredits,
    amountDue,
    currency,
    logoSrc,
    labels,
  };

  const pdfBuffer = await renderToBuffer(
    React.createElement(StatementPDF, { data })
  );

  const existingStatements = await Media.find({
    user_id: userId,
    entity_type: 'business',
    entity_id: businessId,
    media_type: 'document',
    category: 'statements',
  });

  for (const doc of existingStatements) {
    try {
      await deleteFile(doc._id, userId);
    } catch {
      // best-effort
    }
  }

  const media = await uploadFile({
    file: {
      buffer: pdfBuffer,
      originalname: `SOA_${business.companyName.replace(/\s+/g, '_')}_${soaNumber}.pdf`,
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
    },
    userId: userId.toString(),
    category: 'statements',
    entityType: 'business',
    entityId: businessId.toString(),
    mediaType: 'document',
    customPrefix: 'STMT_',
  });

  return media;
}
