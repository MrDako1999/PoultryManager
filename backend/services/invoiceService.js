import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { PDFDocument } from 'pdf-lib';
import SaleOrder from '../models/SaleOrder.js';
import Farm from '../models/Farm.js';
import User from '../models/User.js';
import Media from '../models/Media.js';
import { uploadFile, deleteFile } from './storageService.js';
import SaleInvoicePDF from '../templates/SaleInvoicePDF.js';
import { getInvoiceLabels } from '../locales/index.js';

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

async function fetchPdfBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return new Uint8Array(arrayBuf);
  } catch {
    return null;
  }
}

function getDocType(doc) {
  const mime = (doc.mime_type || '').toLowerCase();
  const url = (doc.url || '').toLowerCase();
  if (mime === 'application/pdf' || url.endsWith('.pdf')) return 'pdf';
  if (mime === 'image/png' || url.endsWith('.png')) return 'png';
  if (mime === 'image/jpeg' || mime === 'image/jpg' || url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'jpg';
  return null;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_PADDING = 40;

async function embedImagePage(merged, buf, type) {
  const img = type === 'png'
    ? await merged.embedPng(buf)
    : await merged.embedJpg(buf);

  const maxW = A4_WIDTH - PAGE_PADDING * 2;
  const maxH = A4_HEIGHT - PAGE_PADDING * 2;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * scale;
  const h = img.height * scale;

  const page = merged.addPage([A4_WIDTH, A4_HEIGHT]);
  page.drawImage(img, {
    x: (A4_WIDTH - w) / 2,
    y: (A4_HEIGHT - h) / 2,
    width: w,
    height: h,
  });
}

async function mergeWithReportDocs(invoiceBuffer, reportDocs) {
  const embeddable = reportDocs.filter(d => getDocType(d) !== null);
  if (embeddable.length === 0) return invoiceBuffer;

  const merged = await PDFDocument.create();
  const invoicePdf = await PDFDocument.load(invoiceBuffer);
  const invoicePages = await merged.copyPages(invoicePdf, invoicePdf.getPageIndices());
  invoicePages.forEach(p => merged.addPage(p));

  for (const doc of embeddable) {
    const buf = await fetchPdfBuffer(doc.url);
    if (!buf) continue;
    const type = getDocType(doc);
    try {
      if (type === 'pdf') {
        const reportPdf = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await merged.copyPages(reportPdf, reportPdf.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      } else {
        await embedImagePage(merged, buf, type);
      }
    } catch {
      // skip unreadable files
    }
  }

  const mergedBytes = await merged.save();
  return Buffer.from(mergedBytes);
}

/**
 * Generate a PDF invoice for a sale order, upload to S3, and return the Media doc.
 *
 * @param {string} saleOrderId - SaleOrder MongoDB ObjectId
 * @param {string} userId - Owner user ID
 * @returns {Promise<Object>} The created Media document
 */
export async function generateInvoice(saleOrderId, userId) {
  const saleOrder = await SaleOrder.findById(saleOrderId)
    .populate({
      path: 'customer',
      populate: { path: 'contacts', select: 'firstName phone' },
    })
    .populate('batch')
    .populate('slaughter.reportDocs');

  if (!saleOrder) throw new Error('Sale order not found');

  const batch = saleOrder.batch;
  const farm = batch?.farm
    ? await Farm.findById(batch.farm).populate({ path: 'business', populate: { path: 'logo' } })
    : null;

  const user = await User.findById(userId).populate({
    path: 'accountBusiness',
    populate: { path: 'logo' },
  });

  const sellerBiz = farm?.business || user?.accountBusiness;

  let logoSrc = null;
  if (sellerBiz?.logo?.url) {
    const buf = await fetchImageBuffer(sellerBiz.logo.url);
    if (buf) logoSrc = buf;
  }

  const labels = getInvoiceLabels(user?.invoiceLanguage || 'en');

  const customer = saleOrder.customer;
  const firstContact = customer?.contacts?.[0] || null;

  const reportDocs = saleOrder.slaughter?.reportDocs || [];
  const reportDocUrls = reportDocs
    .filter(d => d?.url)
    .map(d => ({
      url: d.url,
      name: d.original_filename || d.filename || '',
      isEmbeddable: getDocType(d) !== null,
    }));

  const data = {
    seller: {
      companyName: sellerBiz?.companyName || user?.companyName || '',
      address: sellerBiz?.address?.formattedAddress || '',
      trnNumber: sellerBiz?.trnNumber || '',
    },
    buyer: {
      companyName: customer?.companyName || '',
      address: customer?.address?.formattedAddress || '',
      trnNumber: customer?.trnNumber || '',
      contactName: firstContact?.firstName || '',
      phone: firstContact?.phone || '',
    },
    saleNumber: saleOrder.saleNumber,
    saleDate: saleOrder.saleDate,
    saleMethod: saleOrder.saleMethod,
    invoiceType: saleOrder.invoiceType,
    wholeChickenItems: saleOrder.wholeChickenItems || [],
    portions: saleOrder.portions || [],
    live: saleOrder.live || null,
    totals: saleOrder.totals || {},
    discounts: saleOrder.discounts || [],
    currency: user?.currency || 'AED',
    vatRate: user?.vatRate || 0,
    notes: saleOrder.notes || '',
    logoSrc,
    labels,
    reportDocUrls,
  };

  let pdfBuffer = await renderToBuffer(
    React.createElement(SaleInvoicePDF, { data })
  );

  if (reportDocs.length > 0) {
    pdfBuffer = await mergeWithReportDocs(pdfBuffer, reportDocs);
  }

  const existingInvoices = await Media.find({
    user_id: userId,
    entity_type: 'saleOrder',
    entity_id: saleOrderId,
    media_type: 'invoice',
  });

  for (const doc of existingInvoices) {
    try {
      await deleteFile(doc._id, userId);
    } catch {
      // best-effort cleanup
    }
  }

  const media = await uploadFile({
    file: {
      buffer: pdfBuffer,
      originalname: `${saleOrder.saleNumber || 'invoice'}.pdf`,
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
    },
    userId: userId.toString(),
    category: 'invoices',
    entityType: 'saleOrder',
    entityId: saleOrderId.toString(),
    mediaType: 'invoice',
    customPrefix: 'SALES_INV_',
  });

  return media;
}
