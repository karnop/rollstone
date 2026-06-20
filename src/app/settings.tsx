import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, BottomTabInset } from '@/constants/theme';
import { useThemeContext, ThemeMode } from '@/context/theme-context';
import { useAuth } from '@/context/auth-context';

export default function SettingsScreen() {
  const { themeMode, setThemeMode, theme } = useThemeContext();
  const { user, signOut } = useAuth();
  const safeAreaInsets = useSafeAreaInsets();

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const isSupabaseConfigured = !!process.env.EXPO_PUBLIC_SUPABASE_URL && 
    !process.env.EXPO_PUBLIC_SUPABASE_URL.includes('your-project-id');

  const themeOptions: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: 'Light Mode', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark Mode', icon: 'moon-outline' },
    { value: 'system', label: 'System Default', icon: 'phone-portrait-outline' },
  ];

  return (
    <ThemedView style={styles.container}>
      <View style={{ height: safeAreaInsets.top, backgroundColor: theme.background }} />

      {/* Uniform Header Row */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <AnimatedIcon />
        </View>
        <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 18, color: theme.text }}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four }
        ]}>

        {/* User Account Info */}
        {user && (
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              Account
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.staticRow}>
                <View style={styles.rowLabelContainer}>
                  <Ionicons name="person-outline" size={20} color={theme.text} />
                  <View style={{ marginLeft: Spacing.three }}>
                    <ThemedText>Logged in as</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">{user.email}</ThemedText>
                  </View>
                </View>
              </View>
            </ThemedView>
          </View>
        )}

        {/* Theme Preference Group */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            Appearance
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            {themeOptions.map((opt, idx) => {
              const isSelected = themeMode === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.row,
                    idx !== themeOptions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.background }
                  ]}
                  onPress={() => handleThemeChange(opt.value)}
                  activeOpacity={0.7}>
                  <View style={styles.rowLabelContainer}>
                    <Ionicons name={opt.icon as any} size={20} color={theme.text} />
                    <ThemedText style={{ marginLeft: Spacing.three }}>{opt.label}</ThemedText>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={theme.text} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ThemedView>
        </View>

        {/* Supabase Status Card */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            Database
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.statusRow}>
              <View style={styles.rowLabelContainer}>
                <Ionicons name="cloud-outline" size={20} color={theme.text} />
                <View style={{ marginLeft: Spacing.three }}>
                  <ThemedText>Supabase Cloud</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {isSupabaseConfigured ? 'Keys configured' : 'Using offline local state'}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.badgeContainer}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isSupabaseConfigured ? '#10B981' : theme.textSecondary }
                  ]}
                />
                <ThemedText type="smallBold" style={{ marginLeft: Spacing.one }}>
                  {isSupabaseConfigured ? 'CONNECTED' : 'OFFLINE'}
                </ThemedText>
              </View>
            </View>
          </ThemedView>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            App Info
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={[styles.staticRow, { borderBottomWidth: 1, borderBottomColor: theme.background }]}>
              <ThemedText>Version</ThemedText>
              <ThemedText themeColor="textSecondary">1.0.0 (SDK 54)</ThemedText>
            </View>
            <View style={styles.staticRow}>
              <ThemedText>Developer</ThemedText>
              <ThemedText themeColor="textSecondary">Antigravity AI</ThemedText>
            </View>
          </ThemedView>
        </View>

        {/* Sign Out Button */}
        {user && (
          <TouchableOpacity
            style={[styles.signOutBtn, { borderColor: theme.textSecondary }]}
            onPress={signOut}
            activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color={theme.text} />
            <ThemedText style={styles.signOutBtnText}>Sign Out</ThemedText>
          </TouchableOpacity>
        )}

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    marginBottom: Spacing.five,
  },
  sectionTitle: {
    marginBottom: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  card: {
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  rowLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  signOutBtnText: {
    fontWeight: '700',
  },
});
