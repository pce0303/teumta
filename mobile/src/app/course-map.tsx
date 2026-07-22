import { useLocalSearchParams } from 'expo-router';

import { CourseMapView } from '@/components/course-map-view';
import { getMockPlaceById } from '@/mocks/places';

export default function CourseMapScreen() {
  const { placeId, detourId } = useLocalSearchParams<{ placeId?: string; detourId?: string }>();
  const place = getMockPlaceById(placeId) ?? getMockPlaceById('gyeongbokgung');
  const detour = place?.detours.find((item) => item.id === detourId) ?? place?.detours[0];

  return <CourseMapView detour={detour} />;
}
