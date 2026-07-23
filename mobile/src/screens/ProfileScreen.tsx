import { StyleSheet, Text, View } from "react-native";

import { NativeScreenProps } from "./types";

const settings = [
  ["Profile", "View and update account details"],
  ["Appearance", "Switch dark and light mode everywhere"],
  ["Notifications", "Manage event reminders and tester updates"],
  ["Privacy", "Terms, policy, and account deletion"]
];

export function ProfileScreen({ theme, session, onSignOut }: NativeScreenProps) {
  return (
    <View style={styles.stack}>
      <View style={[styles.profileHero, { backgroundColor: theme.colors.greenPanel }]}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.avatar }]}>
          <Text style={[styles.avatarText, { color: theme.colors.text }]}>{session.displayName.slice(0, 1)}</Text>
        </View>
        <View>
          <Text style={[styles.name, { color: theme.colors.text }]}>{session.displayName}</Text>
          <Text style={[styles.email, { color: theme.colors.secondary }]}>{session.email}</Text>
          <Text style={[styles.role, { color: theme.colors.accent }]}>{session.role.toUpperCase()} · {session.plan.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.muted }]}>SETTINGS</Text>
      {settings.map(([title, caption]) => (
        <View key={title} style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View>
            <Text style={[styles.rowTitle, { color: theme.colors.text }]}>{title}</Text>
            <Text style={[styles.rowCaption, { color: theme.colors.secondary }]}>{caption}</Text>
          </View>
          <Text style={[styles.chevron, { color: theme.colors.muted }]}>›</Text>
        </View>
      ))}
      <Text style={[styles.signOut, { color: theme.colors.error }]} onPress={onSignOut}>
        Sign out of native demo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  profileHero: {
    alignItems: "center",
    borderRadius: 30,
    flexDirection: "row",
    gap: 18,
    padding: 22
  },
  avatar: {
    alignItems: "center",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "900"
  },
  name: {
    fontSize: 24,
    fontWeight: "900"
  },
  role: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 4
  },
  email: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.4,
    marginTop: 8
  },
  row: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18
  },
  rowTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  rowCaption: {
    fontSize: 14,
    marginTop: 4
  },
  chevron: {
    fontSize: 32
  },
  signOut: {
    fontSize: 15,
    fontWeight: "900",
    paddingHorizontal: 4,
    paddingVertical: 14,
    textAlign: "center"
  }
});
