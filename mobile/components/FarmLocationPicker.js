import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Expand, MapPin, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlacesSearchInput from './PlacesSearchInput';
import { extractAddressComponents, reverseGeocode } from '@/lib/googleMapsUtils';

const MUTED = 'hsl(150, 10%, 45%)';

const UAE_CENTER = { latitude: 25.2048, longitude: 55.2708 };

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

function MapBlock({ value, onChange, markerLabel, height, showSearch = true, onExpand, onAddressResolved }) {
  const { t } = useTranslation();
  const mapRef = useRef(null);
  const [region, setRegion] = useState(() => {
    if (value?.lat != null && value?.lng != null) {
      return { latitude: value.lat, longitude: value.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    }
    return { ...UAE_CENTER, latitudeDelta: 0.5, longitudeDelta: 0.5 };
  });

  useEffect(() => {
    if (value?.lat != null && value?.lng != null && mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: value.lat, longitude: value.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        300
      );
    }
  }, [value?.lat, value?.lng]);

  const resolveAndEmit = async (lat, lng, placeFromSearch) => {
    if (!onAddressResolved) return;
    if (placeFromSearch) {
      // PlacesSearchInput already returned address_components; reuse them.
      const parsed = extractAddressComponents(
        { address_components: placeFromSearch.addressComponents, formatted_address: placeFromSearch.formattedAddress, place_id: placeFromSearch.placeId },
        placeFromSearch.placeName
      );
      onAddressResolved({ ...parsed, lat, lng });
      return;
    }
    // Marker drag / map tap → reverse geocode
    const parsed = await reverseGeocode(lat, lng);
    if (parsed) {
      onAddressResolved({ ...parsed, lat, lng });
    }
  };

  const handlePlaceSelect = (place) => {
    if (place.lat == null || place.lng == null) return;
    onChange?.({ lat: place.lat, lng: place.lng, placeName: place.placeName || '' });
    resolveAndEmit(place.lat, place.lng, place);
  };

  const handleMapPress = (e) => {
    const { coordinate } = e.nativeEvent;
    onChange?.({ lat: coordinate.latitude, lng: coordinate.longitude, placeName: '' });
    resolveAndEmit(coordinate.latitude, coordinate.longitude);
  };

  const handleMarkerDragEnd = (e) => {
    const { coordinate } = e.nativeEvent;
    onChange?.({ lat: coordinate.latitude, lng: coordinate.longitude, placeName: '' });
    resolveAndEmit(coordinate.latitude, coordinate.longitude);
  };

  const hasPin = value?.lat != null && value?.lng != null;

  return (
    <View style={{ flex: 1 }}>
      {showSearch && (
        <View className="mb-2">
          <PlacesSearchInput
            placeholder={t('farms.searchLocation', 'Search by area, address, or coordinates…')}
            onSelect={handlePlaceSelect}
          />
        </View>
      )}

      <View style={{ position: 'relative', flex: 1, minHeight: height || 240 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          mapType="satellite"
          style={{ flex: 1, borderRadius: 8 }}
          initialRegion={region}
          onPress={handleMapPress}
          showsCompass
          showsScale
        >
          {hasPin && (
            <Marker
              coordinate={{ latitude: value.lat, longitude: value.lng }}
              draggable
              onDragEnd={handleMarkerDragEnd}
              title={markerLabel || ''}
            />
          )}
        </MapView>

        {onExpand && (
          <Pressable
            onPress={onExpand}
            className="absolute top-2 right-2 rounded-md bg-card border border-border p-2 active:opacity-70"
            style={{ shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}
            accessibilityRole="button"
            accessibilityLabel={t('farms.expandMap', 'Expand map')}
          >
            <Expand size={16} color={MUTED} />
          </Pressable>
        )}
      </View>

      {hasPin && (
        <View className="flex-row items-start gap-2 mt-2">
          <MapPin size={12} color={MUTED} style={{ marginTop: 2 }} />
          <Text className="text-xs text-muted-foreground flex-1" numberOfLines={2}>
            {value.placeName
              ? `${value.placeName} (${value.lat.toFixed(6)}, ${value.lng.toFixed(6)})`
              : `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Reusable map + places picker for selecting a farm's geo-location.
 *
 * value: { lat: number|null, lng: number|null, placeName?: string }
 * onChange: (next) => void
 */
export default function FarmLocationPicker({ value, onChange, markerLabel, onAddressResolved }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);

  if (!GOOGLE_API_KEY) {
    return (
      <View className="rounded-md border-2 border-dashed border-border p-6 items-center">
        <MapPin size={24} color={MUTED} />
        <Text className="text-sm text-muted-foreground mt-2 text-center">
          {t('farms.mapKeyMissing', 'Google Maps API key not configured.')}
        </Text>
        <Text className="text-xs text-muted-foreground mt-1 text-center">
          {t('farms.mapKeyMissingHint', 'Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in mobile/.env and rebuild.')}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={{ height: 240 }}>
        <MapBlock
          value={value}
          onChange={onChange}
          markerLabel={markerLabel}
          height={240}
          onExpand={() => setExpanded(true)}
          onAddressResolved={onAddressResolved}
        />
      </View>

      <Modal visible={expanded} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setExpanded(false)}>
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
          <View className="px-4 pt-2 pb-3 flex-row items-center justify-between border-b border-border">
            <Text className="text-base font-semibold text-foreground">
              {t('farms.locationSection', 'Farm Location')}
            </Text>
            <Pressable onPress={() => setExpanded(false)} hitSlop={8}>
              <X size={22} color={MUTED} />
            </Pressable>
          </View>
          <View style={{ flex: 1, padding: 16, paddingBottom: insets.bottom + 16 }}>
            <MapBlock
              value={value}
              onChange={onChange}
              markerLabel={markerLabel}
              onAddressResolved={onAddressResolved}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// re-exported so the loading fallback in the sheet can be styled consistently
export function MapLoadingFallback({ height = 240 }) {
  return (
    <View
      className="rounded-md border border-border bg-muted/30 items-center justify-center"
      style={{ height }}
    >
      <ActivityIndicator size="small" color={MUTED} />
    </View>
  );
}
