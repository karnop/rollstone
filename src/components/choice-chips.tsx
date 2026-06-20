import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Spacing } from '@/constants/theme';

interface ChoiceChipsProps<T> {
  value: T;
  options: readonly T[];
  onChange: (val: T) => void;
  getColors: (val: T) => { bg: string; text: string };
  theme: any;
}

export function ChoiceChips<T>({ value, options, onChange, getColors, theme }: ChoiceChipsProps<T>) {
  return (
    <View style={chipStyles.container}>
      {options.map((opt, idx) => {
        const isSelected = value === opt;
        const colors = getColors(opt);
        return (
          <Pressable
            key={idx}
            style={({ pressed }) => [
              chipStyles.chip,
              {
                backgroundColor: isSelected 
                  ? colors.bg 
                  : (pressed ? theme.backgroundSelected : theme.backgroundElement),
              }
            ]}
            onPress={() => onChange(opt)}>
            <Text
              style={[
                chipStyles.text,
                {
                  color: isSelected ? colors.text : theme.textSecondary,
                  fontFamily: isSelected ? 'Pliant-Bold' : 'Pliant-Regular',
                }
              ]}>
              {String(opt)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: Spacing.one,
  },
  chip: {
    borderRadius: 8,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
  },
});
