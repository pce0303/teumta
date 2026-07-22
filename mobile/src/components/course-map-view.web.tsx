import { StyleSheet, Text, View } from 'react-native';

import type { DetourCourse } from '@/types/place';

type CourseMapViewProps = {
  detour?: DetourCourse;
};

export function CourseMapView({ detour }: CourseMapViewProps) {
  const coordinates = detour?.coordinates ?? [];

  return (
    <View style={styles.webFallback}>
      <Text style={styles.title}>{detour?.name}</Text>
      <Text style={styles.description}>웹에서는 지도 SDK 연결 전까지 코스 좌표만 확인합니다.</Text>
      {coordinates.map((coordinate, index) => (
        <Text key={`${coordinate.latitude}-${coordinate.longitude}`} style={styles.coordinate}>
          {index + 1}. {coordinate.latitude}, {coordinate.longitude}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  webFallback: {
    flex: 1,
    gap: 10,
    padding: 24,
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
  coordinate: {
    color: '#374151',
    fontSize: 14,
  },
});
