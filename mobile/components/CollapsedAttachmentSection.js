import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import MultiFileUpload from './MultiFileUpload';

/**
 * Wraps MultiFileUpload so that when there are zero files attached the section
 * collapses to a single thin pill ("+ Add receipts"). Tapping the pill expands
 * to the full upload UI. Once at least one file exists, the section stays
 * expanded permanently.
 */
export default function CollapsedAttachmentSection({
  label,
  files,
  onAdd,
  onRemove,
  entityType,
  entityId,
  category,
  mediaType,
  pickType,
  icon: Icon,
}) {
  const [expanded, setExpanded] = useState(false);
  const hasFiles = files?.length > 0;
  const showFull = hasFiles || expanded;

  if (!showFull) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        className="flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 active:bg-muted/30"
      >
        {Icon ? <Icon size={14} color="hsl(150, 10%, 45%)" /> : <Plus size={14} color="hsl(150, 10%, 45%)" />}
        <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
      </Pressable>
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <MultiFileUpload
        files={files}
        onAdd={onAdd}
        onRemove={onRemove}
        entityType={entityType}
        entityId={entityId}
        category={category}
        mediaType={mediaType}
        pickType={pickType}
      />
    </View>
  );
}
