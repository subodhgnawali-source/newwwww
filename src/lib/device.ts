/**
 * Screen Wake Lock and Notification utilities
 */

class DeviceManager {
  private wakeLockSentinel: any = null;

  async requestWakeLock(): Promise<boolean> {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }
    try {
      this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener('release', () => {
        this.wakeLockSentinel = null;
      });
      return true;
    } catch {
      return false;
    }
  }

  releaseWakeLock(): void {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch {
        // ignore
      }
      this.wakeLockSentinel = null;
    }
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
    return false;
  }

  notify(title: string, body: string): void {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
        });
      } catch {
        // Fallback if Notification constructor fails inside iframe/mobile
      }
    }
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch {
        // ignore
      }
    }
  }
}

export const deviceManager = new DeviceManager();
