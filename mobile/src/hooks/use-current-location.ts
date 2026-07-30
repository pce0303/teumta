import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { LOCATION_OPTIONS } from '@/constants/location';
import type { Coordinate } from '@/types/place';

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

/**
 * foreground 전용 현재 위치 훅.
 *
 * 개인정보 최소화 원칙:
 *  - 위치는 단말 내부 state로만 유지하고, 어떤 서버로도 전송하지 않는다.
 *  - background 위치를 사용하지 않는다(requestForegroundPermissionsAsync만 사용).
 *  - watch 구독은 unmount 시 반드시 해제한다 → 앱이 foreground를 벗어나거나 종료된 뒤
 *    지속적인 위치 추적이 발생하지 않는다.
 */
export function useCurrentLocation(options?: { watch?: boolean }) {
  const watch = options?.watch ?? false;
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const stop = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setStatus('requesting');

    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) {
      setStatus('denied');
      return;
    }
    setStatus('granted');

    try {
      if (watch) {
        subscriptionRef.current = await Location.watchPositionAsync(LOCATION_OPTIONS, (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        });
      } else {
        const position = await Location.getCurrentPositionAsync(LOCATION_OPTIONS);
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      }
    } catch {
      setStatus('error');
    }
  }, [watch]);

  useEffect(() => {
    // 컴포넌트 unmount 시 위치 구독 해제(지속 추적 방지).
    return () => stop();
  }, [stop]);

  return { location, status, start, stop };
}
