import { useRef, useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Search } from 'lucide-react';
import { parseCoordinates, extractAddressComponents } from '@/lib/googleMapsUtils';

/**
 * Reusable Google Places search input with autocomplete dropdown.
 *
 * Supports controlled mode (value + onValueChange) or uncontrolled (internal state).
 * onSelect receives { lat, lng, placeName, address } where address is the full
 * extracted address object. onCoordsSelect fires when raw coordinates are entered.
 */
export default function PlacesSearchInput({
  value: controlledValue,
  onValueChange,
  onSelect,
  onCoordsSelect,
  disabled,
  placeholder,
  searchTypes,
}) {
  const [internalValue, setInternalValue] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [parsedCoords, setParsedCoords] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const acService = useRef(null);
  const placesService = useRef(null);
  const sessionToken = useRef(null);
  const debounceRef = useRef(null);
  const dummyDiv = useRef(null);

  const isControlled = controlledValue !== undefined;
  const inputValue = isControlled ? controlledValue : internalValue;
  const setInputValue = useCallback(
    (val) => {
      if (isControlled) {
        onValueChange?.(val);
      } else {
        setInternalValue(val);
      }
    },
    [isControlled, onValueChange]
  );

  useEffect(() => {
    dummyDiv.current = document.createElement('div');
    acService.current = new window.google.maps.places.AutocompleteService();
    placesService.current = new window.google.maps.places.PlacesService(dummyDiv.current);
    sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
  }, []);

  const fetchPredictions = useCallback(
    (input) => {
      if (!input.trim() || !acService.current) {
        setPredictions([]);
        return;
      }
      const request = { input, sessionToken: sessionToken.current };
      if (searchTypes) request.types = searchTypes;
      acService.current.getPlacePredictions(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results);
        } else {
          setPredictions([]);
        }
      });
    },
    [searchTypes]
  );

  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value;
      setInputValue(val);
      setActiveIndex(-1);

      const coords = parseCoordinates(val);
      setParsedCoords(coords);

      if (coords) {
        setPredictions([]);
        setShowDropdown(true);
      } else {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchPredictions(val), 250);
        setShowDropdown(true);
      }
    },
    [fetchPredictions, setInputValue]
  );

  const selectCoords = useCallback(
    (coords) => {
      setInputValue(`${coords.lat}, ${coords.lng}`);
      setShowDropdown(false);
      setParsedCoords(null);
      onCoordsSelect?.(coords);
    },
    [setInputValue, onCoordsSelect]
  );

  const selectPrediction = useCallback(
    (prediction) => {
      setShowDropdown(false);
      setPredictions([]);

      placesService.current.getDetails(
        {
          placeId: prediction.place_id,
          fields: ['geometry', 'name', 'formatted_address', 'address_components', 'place_id'],
          sessionToken: sessionToken.current,
        },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const placeName = place.name || '';
            const address = extractAddressComponents(place, placeName);
            setInputValue(address.formattedAddress || prediction.description);
            onSelect?.({ lat, lng, placeName, address });
          }
          sessionToken.current = new window.google.maps.places.AutocompleteSessionToken();
        }
      );
    },
    [onSelect, setInputValue]
  );

  const totalItems = (parsedCoords ? 1 : 0) + predictions.length;

  const handleKeyDown = useCallback(
    (e) => {
      if (!showDropdown || !totalItems) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i < totalItems - 1 ? i + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i > 0 ? i - 1 : totalItems - 1));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        if (parsedCoords && activeIndex === 0) {
          selectCoords(parsedCoords);
        } else {
          const predIdx = parsedCoords ? activeIndex - 1 : activeIndex;
          if (predictions[predIdx]) selectPrediction(predictions[predIdx]);
        }
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    },
    [showDropdown, totalItems, activeIndex, parsedCoords, predictions, selectCoords, selectPrediction]
  );

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (parsedCoords || predictions.length) setShowDropdown(true);
        }}
        onBlur={() => {
          setTimeout(() => setShowDropdown(false), 200);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="pl-9"
        disabled={disabled}
      />
      {showDropdown && (parsedCoords || predictions.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-60 overflow-auto">
          {parsedCoords && (
            <button
              type="button"
              className={`w-full text-left px-3 py-2 text-sm cursor-pointer flex items-start gap-2 ${
                activeIndex === 0 ? 'bg-accent' : 'hover:bg-accent'
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectCoords(parsedCoords)}
              onMouseEnter={() => setActiveIndex(0)}
            >
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <span>
                <span className="font-medium">Go to coordinates</span>{' '}
                <span className="text-muted-foreground text-xs">
                  {parsedCoords.lat.toFixed(6)}, {parsedCoords.lng.toFixed(6)}
                </span>
              </span>
            </button>
          )}
          {predictions.map((p, idx) => {
            const itemIdx = parsedCoords ? idx + 1 : idx;
            return (
              <button
                key={p.place_id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm cursor-pointer flex items-start gap-2 ${
                  itemIdx === activeIndex ? 'bg-accent' : 'hover:bg-accent'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPrediction(p)}
                onMouseEnter={() => setActiveIndex(itemIdx)}
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">{p.structured_formatting.main_text}</span>{' '}
                  <span className="text-muted-foreground text-xs">
                    {p.structured_formatting.secondary_text}
                  </span>
                </span>
              </button>
            );
          })}
          {predictions.length > 0 && (
            <div className="px-3 py-1 text-[10px] text-muted-foreground text-right border-t">
              powered by Google
            </div>
          )}
        </div>
      )}
    </div>
  );
}
