import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Teumta } from '@/constants/theme';

/** 봤는지 여부만 기기에 남긴다 — 다른 저장 데이터와 달리 지워도 다시 뜨는 것뿐이라 전체 삭제에 안 묶는다. */
const STORAGE_KEY = 'teumta:onboarding-seen:v1';

const STEPS = [
  {
    key: 'check',
    title: '지금 얼마나 붐비는지 확인',
    body: '가려던 관광지의 실시간 혼잡도를 먼저 봐요.',
  },
  {
    key: 'detour',
    title: '붐비면 근처 로컬로 틈타기',
    body: '남는 시간에 맞춘 도보 코스로 주변을 둘러봐요.',
  },
  {
    key: 'return',
    title: '여유로워지면 다시 복귀',
    body: '돌아갈 시간이 되면 알려드려요. 여행은 그대로 이어져요.',
  },
] as const;

/**
 * 첫 실행 1장짜리 온보딩.
 *
 * 홈 위에 모달로 덮는다 — 라우트로 만들면 첫 프레임에 홈이 번쩍였다가 전환된다.
 * 저장값을 읽기 전에는 아무것도 띄우지 않는다(이미 본 사용자에게 깜빡임 방지).
 */
export function Onboarding() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((seen) => {
        if (!seen) {
          setVisible(true);
        }
      })
      .catch(() => {
        // 저장소를 못 읽으면 온보딩 없이 진행 — 본 사람에게 또 띄우는 쪽이 더 나쁘다
      });
  }, []);

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {});
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent={false} onRequestClose={dismiss}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <Image
              source={require('@/assets/images/teumta-logo.svg')}
              style={styles.brandLogo}
              contentFit="contain"
            />
            <Text style={styles.brandName}>틈타</Text>
          </View>

          <Text style={styles.title}>붐비는 시간은 비켜가고,{'\n'}여행은 그대로.</Text>
          <Text style={styles.subtitle}>
            관광객이 한곳에 몰린 사이, 걸어서 몇 분 거리의 로컬은 한산해요. 틈타가 그 사이를
            이어드려요.
          </Text>

          <View style={styles.steps}>
            {STEPS.map((step, index) => (
              <View key={step.key} style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeLabel}>{index + 1}</Text>
                </View>
                <View style={styles.stepTexts}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.privacyStrip}>
            <View style={styles.privacyDot} />
            <Text style={styles.privacyText}>
              로그인 없이 쓰고, 위치는 기기 밖으로 나가지 않아요.
            </Text>
          </View>
        </View>

        <Pressable style={styles.ctaButton} onPress={dismiss}>
          <Text style={styles.ctaLabel}>시작하기</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Teumta.background,
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    gap: 14,
    justifyContent: 'center',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  brandLogo: {
    height: 25,
    width: 32,
  },
  brandName: {
    color: Teumta.greenDark,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 32,
  },
  title: {
    color: Teumta.textPrimary,
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 38,
  },
  subtitle: {
    color: Teumta.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  steps: {
    gap: 12,
    marginTop: 10,
  },
  stepRow: {
    alignItems: 'center',
    backgroundColor: Teumta.surface,
    borderColor: Teumta.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: Teumta.greenLight,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepBadgeLabel: {
    color: Teumta.greenDark,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  stepTexts: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    color: Teumta.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  stepBody: {
    color: Teumta.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  privacyStrip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  privacyDot: {
    backgroundColor: Teumta.green,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  privacyText: {
    color: Teumta.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  ctaButton: {
    alignItems: 'center',
    backgroundColor: Teumta.green,
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    marginBottom: 12,
  },
  ctaLabel: {
    color: Teumta.surface,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
