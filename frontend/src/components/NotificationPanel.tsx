"use client";

import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { useNotifications, type AppNotification } from "../providers/NotificationProvider";

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function notificationIcon(type: AppNotification["type"]): string {
  if (type === "loan-status") return "📋";
  if (type === "tx-confirmed") return "✅";
  return "🔔";
}

interface NotificationItemProps {
  notification: AppNotification;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
}

function NotificationItem({ notification, onRead, onDismiss }: NotificationItemProps): JSX.Element {
  const handleClick = (): void => {
    onRead(notification.id);
  };

  const inner = (
    <div
      className={`group relative flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
        notification.read
          ? "hover:bg-ink/5 dark:hover:bg-white/5"
          : "bg-primary/8 hover:bg-primary/12 dark:bg-primary/10 dark:hover:bg-primary/15"
      }`}
    >
      <span className="mt-0.5 text-base leading-none">{notificationIcon(notification.type)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-xs font-semibold leading-snug ${
              notification.read ? "text-ink/70 dark:text-white/65" : "text-ink dark:text-white"
            }`}
          >
            {notification.title}
          </p>
          <span className="shrink-0 text-[10px] text-ink/40 dark:text-white/35">
            {timeAgo(notification.timestamp)}
          </span>
        </div>
        {notification.body ? (
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink/55 dark:text-white/45">
            {notification.body}
          </p>
        ) : null}
      </div>
      {!notification.read && (
        <span className="absolute left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary" />
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        className="shrink-0 rounded-md p-0.5 text-ink/30 opacity-0 transition hover:text-ink/70 group-hover:opacity-100 dark:text-white/25 dark:hover:text-white/60"
      >
        <X size={12} />
      </button>
    </div>
  );

  if (notification.href) {
    return (
      <Link href={notification.href} onClick={handleClick} className="block">
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleClick} className="block w-full text-left">
      {inner}
    </button>
  );
}

interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps): JSX.Element {
  const { notifications, markRead, markAllRead, dismiss, clearAll } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent): void => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="animate-dialog-enter absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-[var(--fd-shadow-xl)] dark:border-white/15 dark:bg-slate-900"
      role="dialog"
      aria-label="Notifications"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3 dark:border-white/10">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
            <>
              <button
                type="button"
                onClick={markAllRead}
                aria-label="Mark all as read"
                title="Mark all as read"
                className="rounded-lg p-1.5 text-ink/50 transition hover:bg-ink/8 hover:text-ink dark:text-white/45 dark:hover:bg-white/8 dark:hover:text-white"
              >
                <CheckCheck size={14} />
              </button>
              <button
                type="button"
                onClick={clearAll}
                aria-label="Clear all notifications"
                title="Clear all"
                className="rounded-lg p-1.5 text-ink/50 transition hover:bg-ink/8 hover:text-ink dark:text-white/45 dark:hover:bg-white/8 dark:hover:text-white"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="rounded-lg p-1.5 text-ink/50 transition hover:bg-ink/8 hover:text-ink dark:text-white/45 dark:hover:bg-white/8 dark:hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      <div
        className="max-h-[400px] overflow-y-auto"
        role="list"
        aria-live="polite"
        aria-label="Notification list"
      >
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Bell size={32} className="text-ink/20 dark:text-white/20" />
            <p className="text-sm font-medium text-ink/50 dark:text-white/40">No notifications</p>
            <p className="text-xs text-ink/35 dark:text-white/30">
              Loan status changes and transaction confirmations will appear here.
            </p>
          </div>
        ) : (
          <div className="p-2">
            {notifications.map((n) => (
              <div key={n.id} role="listitem">
                <NotificationItem
                  notification={n}
                  onRead={markRead}
                  onDismiss={dismiss}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className = "" }: NotificationBellProps): JSX.Element {
  const { unreadCount } = useNotifications();
  return (
    <span className={`relative inline-flex ${className}`}>
      <Bell size={18} />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-fg leading-none">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </span>
  );
}
