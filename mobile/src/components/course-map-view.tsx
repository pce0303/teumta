import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Teumta } from '@/constants/theme';
import type { Coordinate, DetourCourse } from '@/types/place';

type CourseMapViewProps = {
  detour?: DetourCourse;
  /** 지도에 내 위치(파란 점)를 표시. 위치 권한이 허용된 화면에서만 켠다. */
  showsUserLocation?: boolean;
};

const MARKER_ANCHOR = { x: 0.5, y: 0.5 };
const DESTINATION_COLOR = '#FF9175';

function sameCoordinate(first: Coordinate, second: Coordinate): boolean {
  return first.latitude === second.latitude && first.longitude === second.longitude;
}

export function CourseMapView({ detour, showsUserLocation }: CourseMapViewProps) {
  const coordinates = detour?.coordinates ?? [];
  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const region =
    coordinates.length > 0
      ? {
          latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
          longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
          latitudeDelta: Math.max((Math.max(...latitudes) - Math.min(...latitudes)) * 1.8, 0.01),
          longitudeDelta: Math.max((Math.max(...longitudes) - Math.min(...longitudes)) * 1.8, 0.01),
        }
      : { latitude: 37.5796, longitude: 126.977, latitudeDelta: 0.01, longitudeDelta: 0.01 };

  // 경로는 목적지 → 정류지들 → 목적지(복귀)라 첫·마지막 좌표가 같다.
  // 선은 그대로 그리되 마커는 한 번만 찍는다(같은 자리에 두 개가 겹치면 구분이 안 된다).
  const returnsToStart =
    coordinates.length > 1 && sameCoordinate(coordinates[0], coordinates[coordinates.length - 1]);
  const markerCoordinates = returnsToStart ? coordinates.slice(0, -1) : coordinates;

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region} showsUserLocation={showsUserLocation}>
        {markerCoordinates.map((coordinate, index) => {
          const isDestination = index === 0;
          const title = detour?.stops?.[index];
          return (
            <Marker
              key={`${index}-${coordinate.latitude}-${coordinate.longitude}`}
              coordinate={coordinate}
              anchor={MARKER_ANCHOR}
              title={
                title ?? (isDestination ? '목적지' : `${index}번째 들르는 곳`)
              }
              description={
                isDestination
                  ? returnsToStart
                    ? '출발하고 돌아오는 곳'
                    : '출발하는 곳'
                  : undefined
              }>
              <View
                style={[
                  styles.marker,
                  isDestination ? styles.markerDestination : styles.markerStop,
                ]}>
                {/* 정류지는 방문 순서를 숫자로 표시한다 — 색만으로는 구분이 안 된다. */}
                {!isDestination && <Text style={styles.markerLabel}>{index}</Text>}
              </View>
            </Marker>
          );
        })}
        <Polyline
          coordinates={coordinates}
          strokeColor={Teumta.green}
          strokeWidth={5}
          lineCap="round"
          lineDashPattern={[0, 12]}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  marker: {
    alignItems: 'center',
    borderColor: Teumta.surface,
    borderRadius: 13,
    borderWidth: 3,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  markerDestination: {
    backgroundColor: DESTINATION_COLOR,
  },
  markerStop: {
    backgroundColor: Teumta.greenDark,
  },
  markerLabel: {
    color: Teumta.surface,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
  },
});
