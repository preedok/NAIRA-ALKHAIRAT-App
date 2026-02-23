import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../constants';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Keluar', 'Yakin ingin keluar?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.avatarPlaceholder}>
        <Text style={styles.avatarText}>
          {(user?.name || user?.company_name || 'O').charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={styles.name}>{user?.name || user?.company_name || '-'}</Text>
      <Text style={styles.role}>Owner</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Nama / Perusahaan</Text>
          <Text style={styles.value}>{user?.name || user?.company_name || '-'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || '-'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{user?.role || 'owner'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Keluar</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Bintang Global Group</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 40, alignItems: 'center' },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  role: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 24 },
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: { paddingVertical: 12 },
  label: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  value: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border },
  logoutButton: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: { color: COLORS.error, fontSize: 16, fontWeight: '600' },
  footer: { marginTop: 24 },
  footerText: { fontSize: 12, color: COLORS.textSecondary },
});
