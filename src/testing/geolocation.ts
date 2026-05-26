export function mockGeolocationPosition(
  latitude = 25.033,
  longitude = 121.565,
): GeolocationPosition {
  const coords: GeolocationCoordinates = {
    latitude,
    longitude,
    accuracy: 10,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({ latitude, longitude, accuracy: 10 }),
  };

  return {
    coords,
    timestamp: 0,
    toJSON: () => ({ coords, timestamp: 0 }),
  };
}
