import React, { useState, useEffect } from 'react';
import { Dimensions, StyleSheet, View, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

const LOGO_SIZE = 120;
const HOME_LOGO_SIZE = 32;
const ANIMATION_DURATION = 1800; // 1.8 seconds for liquid fill

export function AnimatedSplashOverlay() {
  const theme = useTheme();
  const [visible, setVisible] = useState(true);

  // Animation values
  const fillHeight = useSharedValue(0); // 0 to LOGO_SIZE
  const opacity = useSharedValue(1);    // Screen opacity

  useEffect(() => {
    // Start liquid fill animation
    fillHeight.value = withTiming(LOGO_SIZE, {
      duration: ANIMATION_DURATION,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    }, (finished) => {
      if (finished) {
        // Fade out screen after fill completes
        opacity.value = withDelay(
          200,
          withTiming(0, { duration: 400 }, (fadeOutFinished) => {
            if (fadeOutFinished) {
              runOnJS(setVisible)(false);
            }
          })
        );
      }
    });
  }, []);

  // Animated styles
  const liquidStyle = useAnimatedStyle(() => {
    return {
      height: fillHeight.value,
    };
  });

  const screenStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlayContainer, { backgroundColor: theme.background }, screenStyle]}>
      <View style={styles.logoWrapper}>
        {/* Background "Empty" Logo */}
        <Image
          source={require('@/assets/images/coal.png')}
          style={[styles.logoImage, { tintColor: theme.textSecondary, opacity: 0.15 }]}
          resizeMode="contain"
        />

        {/* Foreground "Filled" Logo revealed by height */}
        <Animated.View style={[styles.liquidContainer, liquidStyle]}>
          <Image
            source={require('@/assets/images/coal.png')}
            style={[styles.logoImage, { tintColor: theme.text, height: LOGO_SIZE }]}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export function AnimatedIcon() {
  const theme = useTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1000, easing: Easing.ease }),
        withTiming(1, { duration: 1000, easing: Easing.ease })
      ),
      -1, // Infinite repeat
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulse.value }],
    };
  });

  return (
    <Animated.View style={[styles.homeLogoWrapper, animatedStyle]}>
      <Image
        source={require('@/assets/images/coal.png')}
        style={[styles.homeLogoImage, { tintColor: theme.text }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logoWrapper: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  liquidContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: LOGO_SIZE,
    overflow: 'hidden',
  },
  homeLogoWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeLogoImage: {
    width: HOME_LOGO_SIZE,
    height: HOME_LOGO_SIZE,
  },
});
