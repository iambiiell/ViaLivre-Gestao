
export class NotificationService {
  static async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações desktop');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  static async sendLocalNotification(title: string, options?: NotificationOptions) {
    if (Notification.permission === 'granted') {
      return new Notification(title, options);
    }
    return null;
  }
}
