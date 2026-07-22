import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colorScheme === 'dark' ? '#111111' : '#ffffff' },
          headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#111111',
          contentStyle: { backgroundColor: colorScheme === 'dark' ? '#111111' : '#f6f7f9' },
        }}>
        <Stack.Screen name="index" options={{ title: 'teumta' }} />
        <Stack.Screen name="search" options={{ title: '관광지 검색' }} />
        <Stack.Screen name="places/[id]" options={{ title: '관광지 상세' }} />
        <Stack.Screen name="detours" options={{ title: '우회 코스 선택' }} />
        <Stack.Screen name="course-map" options={{ title: '코스 진행 지도' }} />
      </Stack>
    </ThemeProvider>
  );
}
