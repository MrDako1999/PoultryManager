import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import Transfer from '../models/Transfer.js';
import User from '../models/User.js';
import Media from '../models/Media.js';
import { uploadFile, deleteFile } from './storageService.js';
import TransferReceiptPDF from '../templates/TransferReceiptPDF.js';
import { getTransferLabels } from '../locales/index.js';

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

export async function generateTransferReceipt(transferId, userId) {
  const transfer = await Transfer.findById(transferId)
    .populate({
      path: 'business',
      populate: { path: 'contacts', select: 'firstName phone' },
    });

  if (!transfer) throw new Error('Transfer not found');

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

  const labels = getTransferLabels(user?.invoiceLanguage || 'en');

  const business = transfer.business;

  const receiptNumber = `TRF-${transfer._id.toString().slice(-6).toUpperCase()}`;

  const data = {
    seller: {
      companyName: sellerBiz?.companyName || user?.companyName || '',
      address: sellerBiz?.address?.formattedAddress || '',
      trnNumber: sellerBiz?.trnNumber || '',
    },
    counterparty: {
      companyName: business?.companyName || '',
      address: business?.address?.formattedAddress || '',
      trnNumber: business?.trnNumber || '',
    },
    transferDate: transfer.transferDate,
    amount: transfer.amount,
    transferType: transfer.transferType,
    receiptNumber,
    currency: user?.currency || 'AED',
    notes: transfer.notes || '',
    logoSrc,
    labels,
  };

  const pdfBuffer = await renderToBuffer(
    React.createElement(TransferReceiptPDF, { data })
  );

  const existingReceipts = await Media.find({
    user_id: userId,
    entity_type: 'transfer',
    entity_id: transferId,
    media_type: 'receipt',
  });

  for (const doc of existingReceipts) {
    try {
      await deleteFile(doc._id, userId);
    } catch {
      // best-effort cleanup
    }
  }

  const media = await uploadFile({
    file: {
      buffer: pdfBuffer,
      originalname: `${receiptNumber}.pdf`,
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
    },
    userId: userId.toString(),
    category: 'transfer-receipts',
    entityType: 'transfer',
    entityId: transferId.toString(),
    mediaType: 'receipt',
    customPrefix: 'TRF_RCP_',
  });

  return media;
}
