// Re-export the broiler details/shared.js primitives so the slaughter
// module never duplicates them (per plan §0.1). When new primitives
// are added to broiler/details/shared.js they propagate here for free.
export {
  fmt,
  fmtDate,
  LABEL_CLS,
  VALUE_CLS,
  ROW_CLS,
  CARD_CLS,
  PARTY_CLS,
  LINK_ROW_CLS,
  TABLE_HEADER_CLS,
  TABLE_ROW_CLS,
  Row,
  DocRow,
  OtherDocsList,
} from '@/modules/broiler/details/shared';
