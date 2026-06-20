import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth-context';
import { useThemeContext } from '@/context/theme-context';

const ACCENT_COLOR = '#E63462';

export default function AppTabs() {
  const { theme } = useThemeContext();
  const { isAdmin } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: false,
        tabBarActiveTintColor: ACCENT_COLOR,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarIconStyle: {
          marginTop: 6,
          marginBottom: 6,
        },
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.backgroundElement,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 80,
          paddingBottom: Platform.OS === 'ios' ? 24 : 16,
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? undefined : null, // Clean conditional tab hiding
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size - 2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
