import { useEffect, useState } from "react";

import { SubScreen } from "../../components/profile/SubScreen";
import { SettingRow } from "../../components/profile/SettingRow";
import {
  getNotificationPrefs,
  setNotificationPrefs,
  type NotificationPrefs,
} from "../../services/local-store";

export function NotificationsScreen() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    let mounted = true;
    getNotificationPrefs().then((stored) => {
      if (mounted) setPrefs(stored);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const update = (patch: Partial<NotificationPrefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    void setNotificationPrefs(next);
  };

  if (!prefs) return <SubScreen title="Notifications" />;

  return (
    <SubScreen title="Notifications">
      <SettingRow
        icon="notifications-outline"
        title="Ride updates"
        subtitle="Booking confirmations, driver assignment and trip status"
        value={prefs.rideUpdates}
        onValueChange={(value) => update({ rideUpdates: value })}
      />
      <SettingRow
        icon="pricetags-outline"
        title="Promotions"
        subtitle="Offers, discounts and fare deals"
        value={prefs.promotions}
        onValueChange={(value) => update({ promotions: value })}
      />
      <SettingRow
        icon="megaphone-outline"
        title="Service alerts"
        subtitle="Important updates about your account and the app"
        value={prefs.serviceAlerts}
        onValueChange={(value) => update({ serviceAlerts: value })}
      />
    </SubScreen>
  );
}
