export const UAE_CENTER = { lat: 25.2048, lng: 55.2708 };

export const COORD_RE = /^\s*(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)\s*$/;

export const EMPTY_ADDRESS = {
  street: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  formattedAddress: '',
  placeId: '',
  lat: null,
  lng: null,
};

export function parseCoordinates(text) {
  const m = text.match(COORD_RE);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Extract structured address fields from a Google place or geocoder result.
 * Falls back through multiple strategies to ensure we always get useful data,
 * even for remote locations with limited Google coverage.
 */
export function extractAddressComponents(place, placeName) {
  const components = place.address_components || [];
  const get = (type) =>
    components.find((c) => c.types.includes(type))?.long_name || '';

  const streetNumber = get('street_number');
  const route = get('route');
  const structuredStreet = [streetNumber, route].filter(Boolean).join(' ');

  const plusCode = place.plus_code?.compound_code || place.plus_code?.global_code || '';
  const formattedAddress = place.formatted_address || '';
  const formattedFirstPart = formattedAddress.split(',')[0]?.trim() || '';

  const street =
    structuredStreet ||
    get('premise') ||
    get('subpremise') ||
    placeName ||
    get('neighborhood') ||
    get('sublocality') ||
    get('sublocality_level_1') ||
    plusCode ||
    formattedFirstPart ||
    '';

  const city =
    get('locality') ||
    get('administrative_area_level_2') ||
    get('sublocality_level_1') ||
    get('sublocality') ||
    get('neighborhood') ||
    '';

  return {
    street,
    city,
    state: get('administrative_area_level_1'),
    postalCode: get('postal_code'),
    country: get('country'),
    formattedAddress,
    placeId: place.place_id || '',
  };
}

export function ensurePacHidden() {
  const id = 'pac-container-hide';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = '.pac-container { display: none !important; }';
  document.head.appendChild(style);
}
