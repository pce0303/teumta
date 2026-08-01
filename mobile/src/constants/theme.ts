/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * 틈타 디자인 토큰 (Figma "틈타 사용자 앱" 파일 기준).
 * congestion.medium은 디자인에 정의가 없어 혼잡/여유 톤에 맞춰 보간한 값.
 */
export const Teumta = {
  background: '#FAFAF7',
  surface: '#FFFFFF',
  border: '#E5EAE6',
  textPrimary: '#202522',
  textSecondary: '#737B76',
  textTertiary: '#A3AAA5',
  green: '#55C89A',
  greenLight: '#EAF8F2',
  greenDark: '#24966D',
  imagePlaceholder: '#F2F5F3',
  congestion: {
    low: { text: '#24966D', background: '#EAF8F2', dot: '#35B779' },
    medium: { text: '#B98207', background: '#FFF6E3', dot: '#F1B84B' },
    high: { text: '#EF6D64', background: '#FFF0ED', dot: '#EF6D64' },
    veryHigh: { text: '#E0362C', background: '#FFECEA', dot: '#FF0000' },
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
