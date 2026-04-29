import { useTranslation } from 'react-i18next';
import ProductionTraySheet from './ProductionTraySheet';

export default function ProductionPortionSheet(props) {
  const { t } = useTranslation();
  return (
    <ProductionTraySheet
      {...props}
      table="productionPortions"
      kind="portion"
      shelfLifeKey="portions"
      chipKind="portion"
      titles={{
        create: t('production.addPortion', 'Add portion'),
        edit: t('production.editPortion', 'Edit portion'),
        desc: t('production.portionDesc', 'Log a tray of portion meat from a Grade-B bird.'),
      }}
    />
  );
}
