import { useTranslation } from 'react-i18next';
import ProductionTraySheet from './ProductionTraySheet';

export default function ProductionGibletSheet(props) {
  const { t } = useTranslation();
  return (
    <ProductionTraySheet
      {...props}
      table="productionGiblets"
      kind="giblet"
      shelfLifeKey="giblets"
      chipKind="giblet"
      titles={{
        create: t('production.addGiblet', 'Add giblet'),
        edit: t('production.editGiblet', 'Edit giblet'),
        desc: t('production.gibletDesc', 'Log a tray of giblets (liver, gizzard or heart).'),
      }}
    />
  );
}
