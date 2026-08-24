import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { supabase } from './supabase';

const FCM_TOKEN_KEY = 'bridge_fcm_token';

export async function setupPushNotifications(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token: Token) => {
      await saveTokenToSupabase(userId, token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.warn('Push registration error:', err);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // The realtime channel in useNotifications handles in-app toasts.
      // Native OS displays the banner when app is in background.
      void notification;
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data;
      if (data?.related_id) {
        // Store the order ID so the app can open it on resume
        Preferences.set({ key: 'pending_nav_order', value: data.related_id });
      }
    });
  } catch (err) {
    console.warn('Push notification setup failed:', err);
  }
}

async function saveTokenToSupabase(userId: string, token: string): Promise<void> {
  const { value: existing } = await Preferences.get({ key: FCM_TOKEN_KEY });
  if (existing === token) return;

  await Preferences.set({ key: FCM_TOKEN_KEY, value: token });

  await supabase.from('push_tokens').upsert(
    { user_id: userId, token, platform: Capacitor.getPlatform() },
    { onConflict: 'user_id,token' }
  );
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { value: token } = await Preferences.get({ key: FCM_TOKEN_KEY });
  if (token) {
    await supabase.from('push_tokens').delete().eq('token', token);
    await Preferences.remove({ key: FCM_TOKEN_KEY });
  }
}
