import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
  InfoWindowF,
} from '@react-google-maps/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, Expand } from 'lucide-react';
import PlacesSearchInput from '@/components/PlacesSearchInput';
import {
  UAE_CENTER,
  extractAddressComponents,
  ensurePacHidden,
} from '@/lib/googleMapsUtils';

const libraries = ['places'];

const inlineMapStyle = {
  width: '100%',
  height: '256px',
  borderRadius: '0.375rem',
};

const expandedMapStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.375rem',
};

const GLOBAL_STYLE_ID = 'farm-location-picker-styles';

function ensureMapStyles() {
  if (document.getElementById(GLOBAL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = GLOBAL_STYLE_ID;
  style.textContent = `
    .gm-style-iw-ch { padding-top: 0 !important; }
    .gm-style-iw button[aria-label="Close"] { display: none !important; }
    .gm-style-iw { padding: 4px 8px !important; }
    .gm-style-iw-d { overflow: hidden !important; }
  `;
  document.head.appendChild(style);
}

function MapView({ lat, lng, placeName, markerLabel, onChange, onAddressResolved, mapStyle, onMapLoad, expandButton }) {
  const { t } = useTranslation();
  const [map, setMap] = useState(null);

  useEffect(() => {
    ensureMapStyles();
    ensurePacHidden();
  }, []);

  const center = lat && lng ? { lat, lng } : UAE_CENTER;
  const hasPin = lat != null && lng != null;

  useEffect(() => {
    if (map && lat != null && lng != null) {
      map.panTo({ lat, lng });
    }
  }, [map, lat, lng]);

  const handleMarkerDragEnd = useCallback(
    (e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      onChange({ lat: newLat, lng: newLng, placeName: '' });
    },
    [onChange]
  );

  const handlePlaceSelect = useCallback(
    ({ lat: newLat, lng: newLng, placeName: name, address }) => {
      onChange({ lat: newLat, lng: newLng, placeName: name });
      map?.panTo({ lat: newLat, lng: newLng });
      map?.setZoom(16);

      if (onAddressResolved && address) {
        const hasFields = address.street || address.city || address.country;
        if (hasFields) {
          onAddressResolved({ ...address, lat: newLat, lng: newLng });
        } else {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, geoStatus) => {
            if (geoStatus === 'OK' && results?.[0]) {
              onAddressResolved({ ...extractAddressComponents(results[0], name), lat: newLat, lng: newLng });
            }
          });
        }
      }
    },
    [onChange, map, onAddressResolved]
  );

  const handleMapClick = useCallback(
    (e) => {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      onChange({ lat: newLat, lng: newLng, placeName: '' });
    },
    [onChange]
  );

  const handleLoad = useCallback(
    (m) => {
      setMap(m);
      m.setMapTypeId('satellite');
      onMapLoad?.(m);
    },
    [onMapLoad]
  );

  return (
    <div className="space-y-2 h-full flex flex-col">
      <PlacesSearchInput
        onSelect={handlePlaceSelect}
        placeholder={t('farms.searchLocation')}
      />

      <div className="flex-1 min-h-0 relative">
        {expandButton}
        <GoogleMap
          mapContainerStyle={mapStyle}
          center={center}
          zoom={hasPin ? 16 : 10}
          mapTypeId="satellite"
          onLoad={handleLoad}
          onClick={handleMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: false,
          }}
        >
          {hasPin && (
            <>
              <MarkerF
                position={{ lat, lng }}
                draggable
                onDragEnd={handleMarkerDragEnd}
              />
              {markerLabel && (
                <InfoWindowF
                  position={{ lat, lng }}
                  options={{
                    disableAutoPan: true,
                    pixelOffset: new window.google.maps.Size(0, -35),
                    maxWidth: 200,
                  }}
                >
                  <span style={{ fontWeight: 500, fontSize: '11px', whiteSpace: 'nowrap', padding: 0, margin: 0 }}>
                    {markerLabel}
                  </span>
                </InfoWindowF>
              )}
            </>
          )}
        </GoogleMap>
      </div>

      {hasPin && (
        <div className="flex items-start gap-2 shrink-0">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {placeName
              ? `${placeName} (${lat.toFixed(6)}, ${lng.toFixed(6)})`
              : `${lat.toFixed(6)}, ${lng.toFixed(6)}`}
          </p>
        </div>
      )}
    </div>
  );
}

export default function FarmLocationPicker({ lat, lng, placeName, markerLabel, onChange, onAddressResolved }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    libraries,
  });

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border-2 border-dashed p-8 text-center">
        <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Google Maps API key not configured.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Add VITE_GOOGLE_MAPS_API_KEY to your .env file.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center rounded-md border p-8">
        <p className="text-sm text-destructive">Failed to load Google Maps.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center rounded-md border p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading map...</span>
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
    <>
      <MapView
        lat={lat}
        lng={lng}
        placeName={placeName}
        markerLabel={markerLabel}
        onChange={onChange}
        onAddressResolved={onAddressResolved}
        mapStyle={inlineMapStyle}
        expandButton={expandBtn}
      />

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[calc(100vw-2rem)] w-full h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] flex flex-col p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t('farms.locationSection')}</DialogTitle>
            <DialogDescription>{t('farms.locationHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <MapView
              lat={lat}
              lng={lng}
              placeName={placeName}
              markerLabel={markerLabel}
              onChange={onChange}
              onAddressResolved={onAddressResolved}
              mapStyle={expandedMapStyle}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
