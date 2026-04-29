import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Search, MapPin, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { textInputFit } from '@/lib/textInputFit';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const MUTED = 'hsl(150, 10%, 45%)';

const SESSION_TOKEN_LENGTH = 32;
const generateSessionToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < SESSION_TOKEN_LENGTH; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};

async function fetchPredictions(input, sessionToken) {
  if (!GOOGLE_API_KEY || input.trim().length < 2) return [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_API_KEY}&sessiontoken=${sessionToken}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') return [];
    return (json.predictions || []).slice(0, 5).map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || p.description,
      secondaryText: p.structured_formatting?.secondary_text || '',
    }));
  } catch {
    return [];
  }
}

async function fetchPlaceDetails(placeId, sessionToken) {
  if (!GOOGLE_API_KEY) return null;
  try {
    const fields = 'geometry,name,formatted_address,address_components';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}&sessiontoken=${sessionToken}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== 'OK' || !json.result) return null;
    const r = json.result;
    return {
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
      placeName: r.name || r.formatted_address || '',
      formattedAddress: r.formatted_address || '',
      addressComponents: r.address_components || [],
    };
  } catch {
    return null;
  }
}

/**
 * Places autocomplete input that emits { lat, lng, placeName } on selection.
 * Uses Google Maps Places HTTP API (Autocomplete + Details) so no native SDK is needed.
 * Reads EXPO_PUBLIC_GOOGLE_MAPS_API_KEY at runtime.
 */
export default function PlacesSearchInput({ placeholder, onSelect, autoFocus = false }) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const sessionTokenRef = useRef(generateSessionToken());
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setPredictions([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchPredictions(query, sessionTokenRef.current);
      setPredictions(results);
      setLoading(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = async (prediction) => {
    Haptics.selectionAsync().catch(() => {});
    setQuery(prediction.mainText);
    setShowResults(false);
    setLoading(true);
    const details = await fetchPlaceDetails(prediction.placeId, sessionTokenRef.current);
    setLoading(false);
    sessionTokenRef.current = generateSessionToken();
    if (details && details.lat != null && details.lng != null) {
      onSelect?.(details);
    }
  };

  const handleClear = () => {
    setQuery('');
    setPredictions([]);
    setShowResults(false);
  };

  const showDropdown = showResults && (loading || predictions.length > 0);

  return (
    <View>
      <View className="flex-row items-center gap-2 rounded-md border border-border bg-card px-3" style={{ height: 40 }}>
        <Search size={16} color={MUTED} />
        <TextInput
          value={query}
          onChangeText={(v) => { setQuery(v); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          autoFocus={autoFocus}
          className="flex-1 text-sm text-foreground"
          style={[{ paddingVertical: 0 }, textInputFit]}
        />
        {loading && <ActivityIndicator size="small" color={MUTED} />}
        {query.length > 0 && !loading && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <X size={16} color={MUTED} />
          </Pressable>
        )}
      </View>

      {showDropdown && (
        <View className="rounded-md border border-border bg-card mt-1 overflow-hidden">
          {loading && predictions.length === 0 ? (
            <View className="px-3 py-3 flex-row items-center gap-2">
              <ActivityIndicator size="small" color={MUTED} />
              <Text className="text-xs text-muted-foreground">Searching…</Text>
            </View>
          ) : (
            predictions.map((p, i) => (
              <Pressable
                key={p.placeId}
                onPress={() => handleSelect(p)}
                className={`flex-row items-start gap-2 px-3 py-2.5 active:bg-accent/50 ${i < predictions.length - 1 ? 'border-b border-border' : ''}`}
              >
                <MapPin size={14} color={MUTED} style={{ marginTop: 2 }} />
                <View className="flex-1 min-w-0">
                  <Text className="text-sm text-foreground" numberOfLines={1}>{p.mainText}</Text>
                  {!!p.secondaryText && (
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {p.secondaryText}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}
