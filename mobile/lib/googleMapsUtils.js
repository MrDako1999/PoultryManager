// Mirrors frontend/src/lib/googleMapsUtils.js so the mobile address autofill
// behaves the same way: pulls street/city/state/postalCode/country/formattedAddress
// out of a Google Place or Geocoder result, with sensible fallbacks for sparse
// data (rural areas, plus-codes, partial place hits).

export const UAE_CENTER = { lat: 25.2048, lng: 55.2708 };

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

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export function extractAddressComponents(place, placeName) {
  const components = place?.address_components || [];
  const get = (type) =>
    components.find((c) => c.types?.includes(type))?.long_name || '';

  const streetNumber = get('street_number');
  const route = get('route');
  const structuredStreet = [streetNumber, route].filter(Boolean).join(' ');

  const plusCode = place?.plus_code?.compound_code || place?.plus_code?.global_code || '';
  const formattedAddress = place?.formatted_address || '';
  const formattedFirstPart = formattedAddress.split(',')[0]?.trim() || '';

  const street =
    structuredStreet
    || get('premise')
    || get('subpremise')
    || placeName
    || get('neighborhood')
    || get('sublocality')
    || get('sublocality_level_1')
    || plusCode
    || formattedFirstPart
    || '';

  const city =
    get('locality')
    || get('administrative_area_level_2')
    || get('sublocality_level_1')
    || get('sublocality')
    || get('neighborhood')
    || '';

  return {
    street,
    city,
    state: get('administrative_area_level_1'),
    postalCode: get('postal_code'),
    country: get('country'),
    formattedAddress,
    placeId: place?.place_id || '',
  };
}

/**
 * Reverse geocode a lat/lng to a structured address using the Geocoding API.
 * Returns null on failure (network, no key, no results).
 */
export async function reverseGeocode(lat, lng) {
  if (!GOOGLE_API_KEY || lat == null || lng == null) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== 'OK' || !Array.isArray(json.results) || json.results.length === 0) return null;
    return extractAddressComponents(json.results[0]);
  } catch {
    return null;
  }
}
