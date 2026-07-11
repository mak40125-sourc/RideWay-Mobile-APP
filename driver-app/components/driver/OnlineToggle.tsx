import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { useDriverStore } from '../../store/driverStore';

interface OnlineToggleProps {
  onToggle: (online: boolean) => void;
}

export default function OnlineToggle({ onToggle }: OnlineToggleProps) {
  const { is_online } = useDriverStore();

  return (
    <TouchableOpacity
      style={[styles.toggle, is_online ? styles.on : styles.off]}
      onPress={() => onToggle(!is_online)}
      activeOpacity={0.7}
    >
      <View style={[styles.thumb, is_online && styles.thumbOn]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  off: {
    backgroundColor: '#8E8E93',
  },
  on: {
    backgroundColor: '#34C759',
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbOn: {
    alignSelf: 'flex-end',
  },
});
