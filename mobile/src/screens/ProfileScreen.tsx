import { StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../theme";

type ScreenProps = {
  theme: AppTheme;
};

const settings = [
  ["Profile", "View and update account details"],
  ["Appearance", "Switch dark and light mode everywhere"],
  ["Notifications", "Manage event reminders and tester updates"],
  ["Privacy", "Terms, policy, and account deletion"]
];

export function ProfileScreen({ theme }: ScreenProps) {
  return (
    <View style={styles.stack}>
      <View style={[styles.profileHero, { backgroundColor: theme.colors.greenPanel }]}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.avatar }]}>
          <Text style={[styles.avatarText, { color: theme.colors.text }]}>E</Text>
        </View>
        <View>
          <Text style={[styles.name, { color: theme.colors.text }]}>EventSlot</Text>
          <Text style={[styles.role, { color: theme.colors.accent }]}>SUPER ADMIN</Text>
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
  }
});

