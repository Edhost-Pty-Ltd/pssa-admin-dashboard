import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, PageHeader } from "../components/ui/Badge";
import { adminApi } from "../lib/adminApi";
import type { NotificationItem } from "../types/admin";

export default function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = () => adminApi.listNotifications().then(setItems);

  useEffect(() => {
    load();
  }, []);

  const markAll = async () => {
    await adminApi.markAllNotificationsRead();
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Inbox"
        title="Notifications"
        description="Alerts for new verification submissions, high-severity cases, and category milestones."
        actions={
          <button
            type="button"
            onClick={markAll}
            className="rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-semibold text-navy hover:bg-soft"
          >
            Mark all as read
          </button>
        }
      />

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted">
            No notifications yet. New member registrations and verification submissions will appear here.
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={`rounded-2xl border p-4 ${
                n.read ? "border-line bg-white" : "border-green/35 bg-green-soft/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-navy">{n.title}</h2>
                  {!n.read && <Badge tone="green">New</Badge>}
                </div>
                <span className="text-xs text-muted">{n.createdAt}</span>
              </div>
              <p className="mt-1 text-sm text-ink">{n.body}</p>
              {n.link && (
                <Link to={n.link} className="mt-2 inline-block text-xs font-semibold text-green-dark underline">
                  Open in Dashboard
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
