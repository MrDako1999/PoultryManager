import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'pm_auth_token';

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);

export const setToken = (token) => SecureStore.setItemAsync(TOKEN_KEY, token);

export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
