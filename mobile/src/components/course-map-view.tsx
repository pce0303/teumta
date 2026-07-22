import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import type { DetourCourse } from '@/types/place';

type CourseMapViewProps = {
  detour?: DetourCourse;
};

export function CourseMapView({ detour }: CourseMapViewProps) {
  const coordinates = detour?.coordinates ?? [];
  const firstCoordinate = coordinates[0] ?? { latitude: 37.5796, longitude: 126.977 };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: firstCoordinate.latitude,
          longitude: firstCoordinate.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}>
        {coordinates.map((coordinate, index) => (
          <Marker
            key={`${coordinate.latitude}-${coordinate.longitude}`}
            coordinate={coordinate}
            title={index === 0 ? '출발' : index === coordinates.length - 1 ? '도착' : '경유'}
          />
        ))}
        <Polyline coordinates={coordinates} strokeColor="#1f7a68" strokeWidth={5} />
      </MapView>
      <View style={styles.overlay}>
        <Text style={styles.title}>{detour?.name}</Text>
        <Text style={styles.description}>{detour?.description}</Text>
      </View>
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
  overlay: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    bottom: 24,
    left: 20,
    padding: 16,
    position: 'absolute',
    right: 20,
  },
  title: {
    color: '#121417',
    fontSize: 22,
    fontWeight: '900',
  },
  description: {
    color: '#4a5563',
    fontSize: 15,
    lineHeight: 22,
  },
});
