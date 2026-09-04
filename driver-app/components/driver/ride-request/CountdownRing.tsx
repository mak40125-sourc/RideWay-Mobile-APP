import { memo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { velosColors, fontFamily } from '../../../constants/theme';

const SIZE = 46;

type Props = {
  secondsLeft: number;
  urgent: boolean;
};

// Circular countdown chip. Pure RN views — no SVG dependency. Urgency is
// communicated by a single, calm color shift (mint → drop orange) rather than
// flashing or pulsing.
const CountdownRingComponent = ({ secondsLeft, urgent }: Props) => (
  <Text
    style={[styles.number, urgent && styles.numberUrgent]}
    maxFontSizeMultiplier={1.2}
    accessibilityLabel={`${Math.max(0, secondsLeft)} seconds remaining`}
  >
    {Math.max(0, secondsLeft)}
  </Text>
);

export const CountdownRing = memo(CountdownRingComponent);

const styles = StyleSheet.create({
  number: {
    width: SIZE,
    height: SIZE,
    lineHeight: SIZE - 4,
    textAlign: 'center',
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
    borderColor: velosColors.borderSoft,
    backgroundColor: velosColors.mintSoft,
    color: velosColors.navy,
    fontFamily: fontFamily.bold,
    fontSize: 17,
    overflow: 'hidden',
  },
  numberUrgent: {
    borderColor: velosColors.dropOrange,
    color: velosColors.dropOrange,
  },
});
