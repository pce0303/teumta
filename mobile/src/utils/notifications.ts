import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { withRoJosa } from '@/utils/text';

/**
 * 코스 진행용 **로컬 알림** 헬퍼.
 *
 * 서버 발송 푸시는 구조적으로 불가능하다 — 앱이 Trip API를 호출하지 않아
 * 서버는 누가 코스 진행 중인지 모른다(team-todo 확정 정책, location-privacy.md).
 * 예약·발송 전부 단말 안에서 끝나고 푸시 토큰을 만들지 않으므로
 * 스토어 App Privacy "Data Not Collected" 신고에 영향이 없다.
 *
 * 미지원 환경(웹 등)에서 실패해도 코스 진행은 계속되어야 하므로 전부 조용히 무시한다.
 */

Notifications.setNotificationHandler({
  // 앱을 보고 있는 동안에도 배너로 보여준다 — 지도를 띄운 채 걷는 화면이라 배너가 통로다.
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const ANDROID_CHANNEL_ID = 'course';

let channelReady = false;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) {
    return;
  }
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: '코스 진행 알림',
    importance: Notifications.AndroidImportance.HIGH,
  });
  channelReady = true;
}

/** 알림 권한 확보. 거부·미지원이면 false — 알림 없이 진행한다. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      await ensureAndroidChannel();
      return true;
    }
    const requested = await Notifications.requestPermissionsAsync();
    if (requested.granted) {
      await ensureAndroidChannel();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * "슬슬 돌아갈 시간" 예약 알림.
 *
 * 복귀 출발 시각(전체 시간 − 복귀 도보) 5분 전에 울린다. 이미 그 시각을 지나
 * 예약이 1분도 안 남으면 예약하지 않는다(코스가 짧으면 화면 안내로 충분).
 * 반환값은 취소용 식별자, 실패·무의미 시 null.
 */
export async function scheduleReturnReminder(input: {
  destinationName: string;
  totalMinutes: number;
  returnWalkMinutes: number;
}): Promise<string | null> {
  const REMINDER_LEAD_MINUTES = 5;
  const minutesUntilFire =
    input.totalMinutes - input.returnWalkMinutes - REMINDER_LEAD_MINUTES;
  const seconds = Math.round(minutesUntilFire * 60);
  if (seconds < 60) {
    return null;
  }
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: '슬슬 돌아갈 시간이에요',
        body: `${withRoJosa(input.destinationName)} 걸어서 약 ${input.returnWalkMinutes}분 — 지금 나서면 계획한 복귀 시각에 맞아요.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  } catch {
    return null;
  }
}

/** 예약 알림 취소(코스 종료·복귀 완료·화면 이탈 시). */
export async function cancelScheduledCourseNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // 이미 발송됐거나 미지원 — 무시
  }
}

/**
 * 예약 알림 전체 취소. 이 앱의 예약 알림은 복귀 리마인더 하나뿐이라
 * "전체"가 곧 "그 하나" — 재예약 직전에 불러 고아 알림을 원천 차단한다.
 */
export async function cancelAllScheduledCourseNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // 미지원 환경 — 무시
  }
}

/** 즉시 로컬 알림(혼잡 해소 등). 권한 없으면 조용히 실패한다. */
export async function presentCourseNotification(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {
    // 알림은 보조 수단 — 실패해도 화면 배너가 있다
  }
}
