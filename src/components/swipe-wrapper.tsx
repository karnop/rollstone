import React from 'react';
import { PanResponder, View, StyleSheet } from 'react-native';
import { useRouter, usePathname, useNavigation } from 'expo-router';
import { useAuth } from '@/context/auth-context';

interface SwipeWrapperProps {
  children: React.ReactNode;
  disableLeft?: boolean;
  disableRight?: boolean;
}

export function SwipeWrapper({ children, disableLeft = false, disableRight = false }: SwipeWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useNavigation() as any;
  const { isAdmin } = useAuth();

  // Primary tabs path order
  const tabs = ['/', '/stats', '/explore', '/admin', '/settings'];
  
  // Filter out admin if not admin
  const visibleTabs = tabs.filter(t => t !== '/admin' || isAdmin);

  // Screen name mapping for react-navigation
  const routeNameMap: Record<string, string> = {
    '/': 'index',
    '/stats': 'stats',
    '/explore': 'explore',
    '/admin': 'admin',
    '/settings': 'settings'
  };

  const panResponder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Capture horizontal swipes that are wider than vertical moves
      const isHorizontal = Math.abs(gestureState.dx) > 40 && Math.abs(gestureState.dy) < 30;
      if (!isHorizontal) return false;

      // If swiping Left (finger moves left, dx < 0) but left swipe is disabled
      if (gestureState.dx < 0 && disableLeft) return false;

      // If swiping Right (finger moves right, dx > 0) but right swipe is disabled
      if (gestureState.dx > 0 && disableRight) return false;

      return true;
    },
    onPanResponderRelease: (evt, gestureState) => {
      const currentIndex = visibleTabs.indexOf(pathname === '/index' ? '/' : pathname);
      if (currentIndex === -1) return;

      if (gestureState.dx < -50 && !disableLeft) {
        // Swiped Left -> Go to Next Tab
        const nextIndex = currentIndex + 1;
        if (nextIndex < visibleTabs.length) {
          const targetPath = visibleTabs[nextIndex];
          const targetScreen = routeNameMap[targetPath];
          if (targetScreen && navigation.navigate) {
            navigation.navigate(targetScreen);
          } else {
            router.replace(targetPath as any);
          }
        }
      } else if (gestureState.dx > 50 && !disableRight) {
        // Swiped Right -> Go to Prev Tab
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
          const targetPath = visibleTabs[prevIndex];
          const targetScreen = routeNameMap[targetPath];
          if (targetScreen && navigation.navigate) {
            navigation.navigate(targetScreen);
          } else {
            router.replace(targetPath as any);
          }
        }
      }
    }
  }), [pathname, isAdmin, visibleTabs, disableLeft, disableRight, navigation]);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  }
});
