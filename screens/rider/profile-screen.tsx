import { ProfileCreationScreen } from "../../components/profile/profile-creation-screen";

type Props = {
  onComplete?: () => void;
};

export function RiderProfileScreen({ onComplete }: Props) {
  return <ProfileCreationScreen onComplete={onComplete} />;
}
