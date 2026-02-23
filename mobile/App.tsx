import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProductsScreen from './src/screens/ProductsScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import InvoiceDetailScreen from './src/screens/InvoiceDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const headerOptions = {
  headerStyle: { backgroundColor: '#047857' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600' as const },
};

function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen name="OrdersList" component={OrdersScreen} options={{ title: 'Order & Invoice' }} />
      <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} options={{ title: 'Detail Invoice' }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        ...headerOptions,
        tabBarActiveTintColor: '#047857',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#e2e8f0' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Dashboard', headerShown: true }} />
      <Tab.Screen name="Products" component={ProductsScreen} options={{ title: 'Produk' }} />
      <Tab.Screen name="Orders" component={OrdersStack} options={{ title: 'Order & Invoice', headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#047857" />
        <Text style={styles.loadingText}>Memuat...</Text>
      </View>
    );
  }

  return user ? <MainTabs /> : <AuthStack />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
        <StatusBar barStyle="dark-content" backgroundColor="#047857" />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { marginTop: 12, color: '#64748b' },
});
