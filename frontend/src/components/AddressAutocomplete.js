import { useCallback, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
} from '@react-google-maps/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, AlertTriangle, Expand } from 'lucide-react';
import InfoTip from '@/components/InfoTip';
import PlacesSearchInput from '@/components/PlacesSearchInput';
import {
  UAE_CENTER,
  EMPTY_ADDRESS,
  extractAddressComponents,
  ensurePacHidden,
} from '@/lib/googleMapsUtils';

const libraries = ['places'];

const inlineMapStyle = {
  width: '100%',
  height: '180px',
  borderRadius: '0.375rem',
};

const expandedMapStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.375rem',
};

function useReverseGeocoder(onChange) {
  const geocoderRef = useRef(null);

  const ensureGeocoder = useCallback(() => {
    if (!geocoderRef.current) {
      geocoderRef.current = new window.google.maps.Geocoder();
    }
    return geocoderRef.current;
  }, []);

  const reverseGeocode = useCallback((position) => {
    const geocoder = ensureGeocoder();
    geocoder.geocode({ location: position }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const result = results[0];
        const placeName = result.plus_code?.compound_code ||
          result.formatted_address?.split(',')[0]?.trim() || '';
        const parsed = extractAddressComponents(result, placeName);
        onChange({ ...parsed, lat: position.lat, lng: position.lng });
      } else {
        onChange({
          ...EMPTY_ADDRESS,
          lat: position.lat,
          lng: position.lng,
          formattedAddress: `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`,
        });
      }
    });
  }, [ensureGeocoder, onChange]);

  return reverseGeocode;
}

function AddressMap({ lat, lng, onChange, containerStyle, expandButton }) {
  const [map, setMap] = useState(null);
  const reverseGeocode = useReverseGeocoder(onChange);

  const center = lat != null && lng != null ? { lat, lng } : UAE_CENTER;
  const hasPin = lat != null && lng != null;

  useEffect(() => {
    if (map && lat != null && lng != null) {
      map.panTo({ lat, lng });
    }
  }, [map, lat, lng]);

  const handleLoad = useCallback((m) => {
    setMap(m);
    m.setMapTypeId('satellite');
  }, []);

  const handleMapClick = useCallback((e) => {
    reverseGeocode({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }, [reverseGeocode]);

  const handleMarkerDragEnd = useCallback((e) => {
    reverseGeocode({ lat: e.latLng.lat(), lng: e.latLng.lng() });
  }, [reverseGeocode]);

  return (
    <div className="relative h-full">
      {expandButton}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={hasPin ? 16 : 10}
        mapTypeId="satellite"
        onLoad={handleLoad}
        onClick={handleMapClick}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {hasPin && (
          <MarkerF
            position={{ lat, lng }}
            draggable
            onDragEnd={handleMarkerDragEnd}
          />
        )}
      </GoogleMap>
    </div>
  );
}

function ExpandedAddressMap({ lat, lng, onChange, onPlaceSelect, onCoordsSelect, searchValue, onSearchChange, t }) {
  return (
    <div className="flex flex-col h-full gap-2">
      <PlacesSearchInput
        value={searchValue}
        onValueChange={onSearchChange}
        onSelect={onPlaceSelect}
        onCoordsSelect={onCoordsSelect}
        placeholder={t('businesses.addressSearchPlaceholder')}
        searchTypes={['establishment', 'geocode']}
      />
      <div className="flex-1 min-h-0">
        <AddressMap
          lat={lat}
          lng={lng}
          onChange={onChange}
          containerStyle={expandedMapStyle}
        />
      </div>
      {lat != null && lng != null && (
        <div className="flex items-start gap-2 shrink-0">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AddressAutocomplete({ value, onChange, disabled }) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const [expanded, setExpanded] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    libraries,
  });

  const addr = value || EMPTY_ADDRESS;

  useEffect(() => { ensurePacHidden(); }, []);

  useEffect(() => {
    if (addr.formattedAddress && !searchValue) {
      setSearchValue(addr.formattedAddress);
    }
  }, [addr.formattedAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlaceSelect = useCallback(({ lat, lng, placeName, address }) => {
    const hasAddressFields = address.street || address.city || address.country;
    if (!hasAddressFields && lat != null && lng != null && window.google?.maps?.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const rich = extractAddressComponents(results[0], placeName);
          setSearchValue(rich.formattedAddress || address.formattedAddress);
          onChange({ ...rich, lat, lng });
        } else {
          setSearchValue(address.formattedAddress);
          onChange({ ...address, lat, lng });
        }
      });
    } else {
      setSearchValue(address.formattedAddress);
      onChange({ ...address, lat, lng });
    }
  }, [onChange]);

  const handleCoordsSelect = useCallback((coords) => {
    if (!window.google?.maps?.Geocoder) {
      onChange({ ...EMPTY_ADDRESS, lat: coords.lat, lng: coords.lng });
      return;
    }
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: coords }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const parsed = extractAddressComponents(results[0]);
        setSearchValue(parsed.formattedAddress);
        onChange({ ...parsed, lat: coords.lat, lng: coords.lng });
      } else {
        onChange({ ...EMPTY_ADDRESS, lat: coords.lat, lng: coords.lng });
      }
    });
  }, [onChange]);

  const handleMapChange = useCallback((addrWithCoords) => {
    setSearchValue(addrWithCoords.formattedAddress || `${addrWithCoords.lat?.toFixed(6)}, ${addrWithCoords.lng?.toFixed(6)}`);
    onChange(addrWithCoords);
  }, [onChange]);

  const handleFieldChange = useCallback(
    (field, val) => {
      onChange({ ...addr, [field]: val });
    },
    [addr, onChange]
  );

  const hasAddress = addr.street || addr.city || addr.country;

  if (!apiKey) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border-2 border-dashed p-4 text-center">
          <MapPin className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">
            Google Maps API key not configured — enter the address manually.
          </p>
        </div>
        <AddressFields addr={addr} onChange={handleFieldChange} disabled={disabled} t={t} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Failed to load Google Maps.</p>
        <AddressFields addr={addr} onChange={handleFieldChange} disabled={disabled} t={t} />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 rounded-md border p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
      </div>
    );
  }

  const expandBtn = (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className="absolute top-2 right-2 h-8 w-8 shadow-md z-10"
      onClick={() => setExpanded(true)}
      title={t('common.expandMap')}
    >
      <Expand className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label>{t('businesses.addressLookup')}</Label>
          <InfoTip>{t('businesses.addressLookupHint')}</InfoTip>
        </div>
        <PlacesSearchInput
          value={searchValue}
          onValueChange={setSearchValue}
          onSelect={handlePlaceSelect}
          onCoordsSelect={handleCoordsSelect}
          disabled={disabled}
          placeholder={t('businesses.addressSearchPlaceholder')}
          searchTypes={['establishment', 'geocode']}
        />
      </div>

      <AddressMap
        lat={addr.lat}
        lng={addr.lng}
        onChange={handleMapChange}
        containerStyle={inlineMapStyle}
        expandButton={expandBtn}
      />

      {addr.lat != null && addr.lng != null && (
        <div className="flex items-start gap-2">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {addr.lat.toFixed(6)}, {addr.lng.toFixed(6)}
          </p>
        </div>
      )}

      <AddressFields addr={addr} onChange={handleFieldChange} disabled={disabled} t={t} />

      {!hasAddress && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-bg px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
          <p className="text-xs text-warning leading-relaxed">
            {t('businesses.addressVatWarning')}
          </p>
        </div>
      )}

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[calc(100vw-2rem)] w-full h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] flex flex-col p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t('businesses.addressSection')}</DialogTitle>
            <DialogDescription>{t('businesses.addressSectionHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <ExpandedAddressMap
              lat={addr.lat}
              lng={addr.lng}
              onChange={handleMapChange}
              onPlaceSelect={handlePlaceSelect}
              onCoordsSelect={handleCoordsSelect}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              t={t}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddressFields({ addr, onChange, disabled, t }) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="biz-street">{t('businesses.street')}</Label>
        <Input
          id="biz-street"
          value={addr.street}
          onChange={(e) => onChange('street', e.target.value)}
          placeholder={t('businesses.streetPlaceholder')}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="biz-city">{t('businesses.city')}</Label>
          <Input
            id="biz-city"
            value={addr.city}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder={t('businesses.cityPlaceholder')}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="biz-state">{t('businesses.state')}</Label>
          <Input
            id="biz-state"
            value={addr.state}
            onChange={(e) => onChange('state', e.target.value)}
            placeholder={t('businesses.statePlaceholder')}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="biz-postalCode">{t('businesses.postalCode')}</Label>
          <Input
            id="biz-postalCode"
            value={addr.postalCode}
            onChange={(e) => onChange('postalCode', e.target.value)}
            placeholder={t('businesses.postalCodePlaceholder')}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="biz-country">{t('businesses.country')}</Label>
          <Input
            id="biz-country"
            value={addr.country}
            onChange={(e) => onChange('country', e.target.value)}
            placeholder={t('businesses.countryPlaceholder')}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
