import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeInboxItem } from "../domain/inbox";
import { EventSlotPageHeader } from "../components/EventSlotPageHeader";
import { EventSlotPanel } from "../components/EventSlotPanel";
import { EventSlotPill } from "../components/EventSlotPill";
import { EventSlotTabs } from "../components/EventSlotTabs";
import { buildNativeInbox, loadReadInboxItemIds, markAllInboxItemsRead, markInboxItemRead } from "../services/inbox";
import { fontFamily, typeScale } from "../typography";
import { NativeScreenProps } from "./types";

export function NotificationsScreen({ theme, events, navigate }: NativeScreenProps) {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [markedRead, setMarkedRead] = useState<string[]>([]);

  useEffect(() => {
    loadReadInboxItemIds()
      .then(setMarkedRead)
      .catch(() => setMarkedRead([]));
  }, []);

  const notifications = useMemo<NativeInboxItem[]>(() => buildNativeInbox(events, markedRead), [events, markedRead]);

  const visibleNotifications = showUnreadOnly ? notifications.filter((item) => item.unread) : notifications;
  const unreadCount = notifications.filter((item) => item.unread).length;

  return (
    <View style={styles.stack}>
      <EventSlotPageHeader
        theme={theme}
        title="Notifications"
        actionLabel="Mark all as read"
        onActionPress={() => {
          markAllInboxItemsRead(notifications)
            .then(setMarkedRead)
            .catch(() => setMarkedRead(notifications.map((item) => item.id)));
        }}
      />

      <EventSlotTabs
        items={[
          { key: "all", label: `All (${notifications.length})` },
          { key: "unread", label: `Unread (${unreadCount})` }
        ]}
        activeKey={showUnreadOnly ? "unread" : "all"}
        onSelect={(key) => setShowUnreadOnly(key === "unread")}
        theme={theme}
      />

      {visibleNotifications.length === 0 ? (
        <EventSlotPanel theme={theme} style={styles.emptyCard}>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>All caught up</Text>
          <Text style={[styles.emptyBody, { color: theme.colors.secondary }]}>
            {showUnreadOnly
              ? "There are no unread alerts right now."
              : "New registrations, capacity changes, and organiser alerts will appear here."}
          </Text>
        </EventSlotPanel>
      ) : (
        <View style={styles.list}>
          {visibleNotifications.map((item) => (
            <EventSlotPanel key={item.id} theme={theme} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.dot, { backgroundColor: item.unread ? theme.colors.accent : theme.colors.border }]} />
                <View style={styles.copy}>
                  <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{item.title}</Text>
                  <Text style={[styles.cardBody, { color: theme.colors.secondary }]}>{item.body}</Text>
                  <View style={styles.metaRow}>
                    <EventSlotPill
                      label={item.category.toUpperCase()}
                      theme={theme}
                      tone={item.tone === "warning" ? "error" : item.tone === "success" ? "success" : item.tone === "muted" ? "muted" : "accent"}
                      size="xs"
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      markInboxItemRead(item.id)
                        .then(setMarkedRead)
                        .catch(() => setMarkedRead((current) => [...new Set([...current, item.id])]))
                        .finally(() => {
                          navigate(item.route);
                        });
                    }}
                  >
                    <Text style={[styles.openLink, { color: theme.colors.accent }]}>Open {"->"}</Text>
                  </Pressable>
                  <Text style={[styles.age, { color: theme.colors.muted }]}>{item.ageLabel}</Text>
                </View>
              </View>
            </EventSlotPanel>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  list: {
    gap: 12
  },
  emptyCard: {
    gap: 8,
    minHeight: 132
  },
  emptyTitle: {
    ...typeScale.sectionTitle
  },
  emptyBody: {
    ...typeScale.body
  },
  card: {
    borderLeftWidth: 3,
    paddingLeft: 14
  },
  cardRow: {
    flexDirection: "row",
    gap: 12
  },
  dot: {
    borderRadius: 999,
    height: 10,
    marginTop: 7,
    width: 10
  },
  copy: {
    flex: 1,
    gap: 6
  },
  metaRow: {
    flexDirection: "row",
    gap: 8
  },
  cardTitle: {
    ...typeScale.bodyStrong
  },
  cardBody: {
    ...typeScale.body
  },
  openLink: {
    ...typeScale.bodyStrong
  },
  age: {
    fontFamily: fontFamily.body,
    fontSize: 13
  }
});
