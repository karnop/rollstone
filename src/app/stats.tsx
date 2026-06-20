import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, BottomTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ACCENT_COLOR = '#E63462';

export default function StatsScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <View style={{ height: safeAreaInsets.top, backgroundColor: theme.background }} />

      {/* Uniform Header Row */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <AnimatedIcon />
        </View>
        <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 18, color: theme.text }}>Stats</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four }
        ]}>
        
        <View style={styles.emptyStateContainer}>
          <View style={[styles.iconCircle, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="analytics-outline" size={42} color={ACCENT_COLOR} />
          </View>
          <ThemedText type="subtitle" style={styles.emptyTitle}>Performance Analytics</ThemedText>
          <ThemedText style={styles.emptySubtitle} themeColor="textSecondary">
            Your sparring flow statistics, position control ratios, and submission trends will appear here as you log more rounds.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

// Inline Text import support
import { Text } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    marginTop: -80,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  emptyTitle: {
    fontFamily: 'Pliant-Bold',
    fontSize: 20,
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'Pliant-Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.two,
  },
});
