import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, TextInput, View } from "react-native";

import { SubScreen } from "../../components/profile/SubScreen";
import { PressableScale } from "../../components/flow/PressableScale";
import {
  getEmergencyContacts,
  setEmergencyContacts,
  type EmergencyContact,
} from "../../services/local-store";

function makeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function EmergencyContactsScreen() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const digitsOnlyPhone = phone.replace(/\D/g, "");
  const canAdd = name.trim().length >= 2 && digitsOnlyPhone.length >= 10;

  useEffect(() => {
    let mounted = true;
    getEmergencyContacts().then((stored) => {
      if (mounted) {
        setContacts(stored);
        setLoaded(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleAdd = () => {
    if (!canAdd) return;
    const next = [...contacts, { id: makeId(), name: name.trim(), phone: `+${digitsOnlyPhone}` }];
    setContacts(next);
    void setEmergencyContacts(next);
    setName("");
    setPhone("");
  };

  const handleDelete = (id: string) => {
    const next = contacts.filter((contact) => contact.id !== id);
    setContacts(next);
    void setEmergencyContacts(next);
  };

  const handleCall = (contact: EmergencyContact) => {
    Linking.openURL(`tel:${contact.phone}`).catch(() => {});
  };

  return (
    <SubScreen title="Emergency Contacts">
      <View style={styles.formCard}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Contact name"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Phone number</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone number"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          keyboardType="phone-pad"
        />

        <PressableScale
          scaleTo={0.97}
          onPress={handleAdd}
          disabled={!canAdd}
          style={[styles.addWrap, !canAdd ? styles.addDisabled : null]}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addText}>Add Contact</Text>
        </PressableScale>
      </View>

      {loaded && contacts.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No contacts yet</Text>
          <Text style={styles.emptySubtitle}>
            Add a trusted contact above so help is one tap away.
          </Text>
        </View>
      ) : (
        contacts.map((contact) => (
          <View key={contact.id} style={styles.row}>
            <View style={styles.iconBox}>
              <Ionicons name="call-outline" size={20} color="#6B7280" />
            </View>
            <View style={styles.texts}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {contact.name}
              </Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {contact.phone}
              </Text>
            </View>
            <PressableScale
              scaleTo={0.9}
              onPress={() => handleCall(contact)}
              style={styles.actionButton}
            >
              <Ionicons name="call-outline" size={18} color="#111111" />
            </PressableScale>
            <PressableScale
              scaleTo={0.9}
              onPress={() => handleDelete(contact.id)}
              style={styles.actionButton}
            >
              <Ionicons name="trash-outline" size={18} color="#6B7280" />
            </PressableScale>
          </View>
        ))
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 24,
  },
  label: {
    color: "#111111",
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
    color: "#111111",
    fontSize: 16,
    fontFamily: "GeneralSans-Regular",
  },
  addWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#111111",
    borderRadius: 18,
    height: 52,
  },
  addDisabled: {
    opacity: 0.45,
  },
  addText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "500",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  texts: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "500",
    color: "#111111",
  },
  rowSubtitle: {
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    color: "#6B7280",
    marginTop: 2,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: "#111111",
    fontSize: 18,
    fontFamily: "GeneralSans-Regular",
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#6B7280",
    fontSize: 14,
    fontFamily: "GeneralSans-Regular",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
