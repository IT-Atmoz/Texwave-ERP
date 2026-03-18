import { database } from './firebase';
import { ref, push, set } from 'firebase/database';

type NotificationType = 'expense' | 'leave' | 'ticket' | 'exit' | 'hr' | 'salary' | 'task';

/** Send notification to a specific employee by their Firebase key */
export async function sendNotification(
  employeeKey: string,
  title: string,
  body: string,
  type: NotificationType,
) {
  try {
    const notifRef = push(ref(database, `notifications/${employeeKey}`));
    await set(notifRef, { title, body, type, read: false, createdAt: Date.now() });
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}

/** Send notification to the admin/HR feed (visible to all admin/hr/manager roles) */
export async function notifyAdminFeed(
  title: string,
  body: string,
  type: NotificationType,
) {
  try {
    const notifRef = push(ref(database, 'notifications/adminFeed'));
    await set(notifRef, { title, body, type, read: false, createdAt: Date.now() });
  } catch (err) {
    console.error('Failed to send admin notification:', err);
  }
}
