export const REF_FIELDS = {
  batch: 'batches',
  source: 'sources',
  feedOrder: 'feedOrders',
  saleOrder: 'saleOrders',
  tradingCompany: 'businesses',
  sourceFrom: 'businesses',
  farm: 'farms',
  house: 'houses',
  business: 'businesses',
  contact: 'contacts',
  feedCompany: 'businesses',
  feedItem: 'feedItems',
  buyer: 'businesses',
  customer: 'businesses',
  existingBusinessId: 'businesses',
  existingContactId: 'contacts',
};

export const ARRAY_REF_FIELDS = {
  contacts: 'contacts',
  businesses: 'businesses',
  farmAssignments: 'farms',
  houseAssignments: 'houses',
};

export const SINGLE_MEDIA_FIELDS = [
  'logo',
  'photo',
  'trnCertificate',
  'tradeLicense',
  'eidFront',
  'eidBack',
  'visa',
  'passportPage',
];

export const ARRAY_MEDIA_FIELDS = [
  'invoiceDocs',
  'transferProofs',
  'taxInvoiceDocs',
  'deliveryNoteDocs',
  'receipts',
  'reportDocs',
  'photos',
];

export const ITEM_ARRAYS = {
  items: {
    feedItem: 'feedItems',
  },
  houses: {
    house: 'houses',
  },
};

export const NESTED_REF_OBJECTS = {
  slaughter: {
    refFields: {
      slaughterhouse: 'businesses',
      relatedExpense: 'expenses',
    },
    mediaArrayFields: ['reportDocs'],
  },
};

export const OTHER_DOC_ARRAY_MEDIA_KEY = 'media_id';
