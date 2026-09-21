import { api } from './api';

// Web Push for the business portal. On iPhone this only exists inside the
// installed home-screen app (iOS 16.4+); in Safari tabs PushManager is absent,
// so the UI asks the owner to add SelliX to the home screen first.

export function isIos() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

/** 'ready' | 'needs-install' | 'unsupported' | 'denied' */
export function pushSupport() {
  const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!hasApi) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ready';
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration('/');
  const reg = existing || (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  return reg;
}

export async function currentSubscription() {
  if (pushSupport() !== 'ready') return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Must be called from a tap: iOS only shows the permission prompt for a user gesture. */
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied'
    ? 'Njoftimet janë bllokuar. Lejoji te Cilësimet e telefonit → SelliX → Njoftimet.'
    : 'Leja për njoftime nuk u dha.');
  const reg = await registration();
  const { publicKey } = await api.portalPushKey();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  }
  await api.portalPushSubscribe(sub.toJSON());
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await api.portalPushUnsubscribe(sub.endpoint).catch(() => {});
  await sub.unsubscribe();
}
