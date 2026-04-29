import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react-native';
import useOfflineMutation from '@/hooks/useOfflineMutation';
import useLocalQuery from '@/hooks/useLocalQuery';
import useSettings from '@/hooks/useSettings';
import SheetInput, { SheetCurrencyInput } from '@/components/SheetInput';
import PhoneInput from '@/components/PhoneInput';
import EnumButtonSelect from '@/components/ui/EnumButtonSelect';
import DatePicker from '@/components/ui/DatePicker';
import FormSheet from '@/components/FormSheet';
import { FormSection, FormField } from '@/components/FormSheetParts';
import FarmAssignmentList from '@/components/FarmAssignmentList';
import { useIsRTL } from '@/stores/localeStore';
import { useToast } from '@/components/ui/Toast';
import api from '@/lib/api';
import { rowDirection } from '@/lib/rtl';

const WORKER_ROLES = ['manager', 'supervisor', 'labourer', 'driver', 'other'];

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  role: z.enum(WORKER_ROLES).default('labourer'),
  phone: z.string().optional(),
  compensation: z.string().optional(),
  emiratesIdNumber: z.string().optional(),
  emiratesIdExpiry: z.string().optional(),
  passportNumber: z.string().optional(),
  passportCountry: z.string().optional(),
  passportExpiry: z.string().optional(),
});

const defaultValues = {
  firstName: '', lastName: '', role: 'labourer',
  phone: '', compensation: '',
  emiratesIdNumber: '', emiratesIdExpiry: '',
  passportNumber: '', passportCountry: '', passportExpiry: '',
};

export default function WorkerSheet({
  open,
  onClose,
  onCreated,
  editData = null,
  onDelete,
  canDelete = false,
}) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { toast } = useToast();
  const accounting = useSettings('accounting');
  const currency = accounting?.currency || 'AED';

  const [saving, setSaving] = useState(false);
  const { create, update } = useOfflineMutation('workers');
  const isEditing = !!editData?._id;

  const [farms] = useLocalQuery('farms');
  const [assignedFarmIds, setAssignedFarmIds] = useState([]);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    if (editData) {
      reset({
        firstName: editData.firstName || '',
        lastName: editData.lastName || '',
        role: WORKER_ROLES.includes(editData.role) ? editData.role : 'labourer',
        phone: editData.phone || '',
        compensation: editData.compensation != null ? String(editData.compensation) : '',
        emiratesIdNumber: editData.emiratesIdNumber || '',
        emiratesIdExpiry: editData.emiratesIdExpiry
          ? new Date(editData.emiratesIdExpiry).toISOString().slice(0, 10)
          : '',
        passportNumber: editData.passportNumber || '',
        passportCountry: editData.passportCountry || '',
        passportExpiry: editData.passportExpiry
          ? new Date(editData.passportExpiry).toISOString().slice(0, 10)
          : '',
      });
      const initial = Array.isArray(editData.farmAssignments) ? editData.farmAssignments : [];
      setAssignedFarmIds(initial.map((f) => (typeof f === 'object' ? f._id : f)));
    } else {
      reset(defaultValues);
      setAssignedFarmIds([]);
    }
  }, [open, editData, reset]);

  const roleOptions = useMemo(
    () => WORKER_ROLES.map((role) => ({
      value: role,
      label: t(`workers.workerRoles.${role}`, role),
    })),
    [t]
  );

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName || '',
        role: data.role,
        phone: data.phone || '',
        compensation: data.compensation ? Number(data.compensation) : 0,
        emiratesIdNumber: data.emiratesIdNumber || '',
        emiratesIdExpiry: data.emiratesIdExpiry || null,
        passportNumber: data.passportNumber || '',
        passportCountry: data.passportCountry || '',
        passportExpiry: data.passportExpiry || null,
        farmAssignments: assignedFarmIds,
      };

      let savedId;
      if (isEditing) {
        await update(editData._id, { ...editData, ...payload });
        savedId = editData._id;
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await create(tempId, payload);
        savedId = tempId;
      }

      // Mirror farm assignments to the linked user account when present
      // so ground-staff data scoping stays in sync immediately, before
      // the next deltaSync pulls it back.
      if (editData?.linkedUser) {
        try {
          const linkedUserId = typeof editData.linkedUser === 'object'
            ? editData.linkedUser._id
            : editData.linkedUser;
          await api.put(`/users/${linkedUserId}`, { farmAssignments: assignedFarmIds });
        } catch (err) {
          console.warn('[WorkerSheet] failed to sync user farmAssignments', err?.message);
        }
      }

      onCreated?.({ _id: savedId, ...payload });
      toast({
        title: isEditing
          ? t('workers.workerUpdated', 'Worker updated')
          : t('workers.workerCreated', 'Worker created'),
      });
      onClose();
    } catch (err) {
      console.error('[WorkerSheet] save failed', err);
      toast({
        variant: 'destructive',
        title: isEditing
          ? t('workers.updateError', 'Failed to update worker')
          : t('workers.createError', 'Failed to create worker'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={isEditing
        ? t('workers.editWorker', 'Edit Worker')
        : t('workers.addWorker', 'Add Worker')
      }
      subtitle={isEditing
        ? t('workers.editWorkerDesc', 'Update this worker\'s details')
        : t('workers.addWorkerDesc', 'Add a new worker to your directory')
      }
      icon={Users}
      onSubmit={handleSubmit(onSubmit)}
      submitLabel={isEditing ? t('common.save', 'Save') : t('common.create', 'Create')}
      loading={saving}
      disabled={saving}
      deleteLabel={isEditing && canDelete && onDelete ? t('workers.deleteWorker', 'Delete Worker') : undefined}
      onDelete={isEditing && canDelete && onDelete
        ? () => { onClose(); onDelete(); }
        : undefined
      }
    >
      <FormSection title={t('workers.personalSection', 'Personal Information')}>
        <View style={{ flexDirection: rowDirection(isRTL), gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormField label={t('workers.firstName', 'First Name')} required error={errors.firstName?.message}>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { value, onChange, onBlur } }) => (
                  <SheetInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t('workers.firstName', 'First Name')}
                    autoCapitalize="words"
                    dense
                  />
                )}
              />
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField label={t('workers.lastName', 'Last Name')}>
              <Controller
                control={control}
                name="lastName"
                render={({ field: { value, onChange, onBlur } }) => (
                  <SheetInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t('workers.lastName', 'Last Name')}
                    autoCapitalize="words"
                    dense
                  />
                )}
              />
            </FormField>
          </View>
        </View>

        <FormField label={t('workers.role', 'Role')} required error={errors.role?.message}>
          <Controller
            control={control}
            name="role"
            render={({ field: { value, onChange } }) => (
              <EnumButtonSelect
                options={roleOptions}
                value={value}
                onChange={onChange}
                columns={3}
                compact
              />
            )}
          />
        </FormField>

        <FormField label={t('workers.phone', 'Phone Number')}>
          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange } }) => (
              <PhoneInput value={value} onChange={onChange} />
            )}
          />
        </FormField>

        <FormField label={t('workers.compensation', 'Monthly Salary')}>
          <Controller
            control={control}
            name="compensation"
            render={({ field: { value, onChange, onBlur } }) => (
              <SheetCurrencyInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={t('workers.compensationPlaceholder', 'e.g. 2500')}
                currency={currency}
              />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection title={t('workers.uaeResidencySection', 'UAE Residency')}>
        <FormField label={t('workers.emiratesIdNumber', 'Emirates ID Number')}>
          <Controller
            control={control}
            name="emiratesIdNumber"
            render={({ field: { value, onChange, onBlur } }) => (
              <SheetInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="784-XXXX-XXXXXXX-X"
                keyboardType="numbers-and-punctuation"
              />
            )}
          />
        </FormField>

        <FormField label={t('workers.emiratesIdExpiry', 'EID Expiry')}>
          <Controller
            control={control}
            name="emiratesIdExpiry"
            render={({ field: { value, onChange } }) => (
              <DatePicker
                value={value}
                onChange={onChange}
                placeholder={t('workers.emiratesIdExpiry', 'EID Expiry')}
              />
            )}
          />
        </FormField>
      </FormSection>

      <FormSection title={t('workers.passportSection', 'Passport')}>
        <View style={{ flexDirection: rowDirection(isRTL), gap: 10 }}>
          <View style={{ flex: 1 }}>
            <FormField label={t('workers.passportNumber', 'Passport Number')}>
              <Controller
                control={control}
                name="passportNumber"
                render={({ field: { value, onChange, onBlur } }) => (
                  <SheetInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t('workers.passportNumber', 'Passport Number')}
                    autoCapitalize="characters"
                    dense
                  />
                )}
              />
            </FormField>
          </View>
          <View style={{ flex: 1 }}>
            <FormField label={t('workers.passportCountry', 'Passport Country')}>
              <Controller
                control={control}
                name="passportCountry"
                render={({ field: { value, onChange, onBlur } }) => (
                  <SheetInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder={t('workers.passportCountry', 'Country')}
                    dense
                  />
                )}
              />
            </FormField>
          </View>
        </View>

        <FormField label={t('workers.passportExpiry', 'Passport Expiry')}>
          <Controller
            control={control}
            name="passportExpiry"
            render={({ field: { value, onChange } }) => (
              <DatePicker
                value={value}
                onChange={onChange}
                placeholder={t('workers.passportExpiry', 'Passport Expiry')}
              />
            )}
          />
        </FormField>
      </FormSection>

      {farms.length > 0 ? (
        <FormSection
          title={t('workers.assignedFarms', 'Farm Assignments')}
          description={t(
            'workers.editFarmAssignmentsHelp',
            'Pick the farms this worker is responsible for. They will only see data for those farms.'
          )}
          padded={false}
          style={{ padding: 14, gap: 10 }}
        >
          <FarmAssignmentList
            farms={farms}
            value={assignedFarmIds}
            onChange={setAssignedFarmIds}
          />
        </FormSection>
      ) : null}
    </FormSheet>
  );
}
