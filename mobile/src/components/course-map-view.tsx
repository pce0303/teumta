import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Teumta } from '@/constants/theme';
import type { DetourCourse } from '@/types/place';

type CourseMapViewProps = {
  detour?: DetourCourse;
  /** 지도에 내 위치(파란 점)를 표시. 위치 권한이 허용된 화면에서만 켠다. */
  showsUserLocation?: boolean;
};

const MARKER_ANCHOR = { x: 0.5, y: 0.5 };

function markerColor(index: number, lastIndex: number) {
  if (index === 0) {
    return '#FF9175';
  }
  return index === lastIndex ? Teumta.greenDark : Teumta.green;
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

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region} showsUserLocation={showsUserLocation}>
        {coordinates.map((coordinate, index) => (
          <Marker
            key={`${coordinate.latitude}-${coordinate.longitude}`}
            coordinate={coordinate}
            anchor={MARKER_ANCHOR}
            title={
              detour?.stops?.[index] ??
              (index === 0 ? '출발' : index === coordinates.length - 1 ? '도착' : '경유')
            }>
            <View
              style={[
                styles.markerDot,
                { backgroundColor: markerColor(index, coordinates.length - 1) },
              ]}
            />
          </Marker>
        ))}
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
  markerDot: {
    borderColor: Teumta.surface,
    borderRadius: 8,
    borderWidth: 3,
    height: 16,
    width: 16,
  },
});
