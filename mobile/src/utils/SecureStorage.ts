import * as Keychain from 'react-native-keychain';

const TOKEN_SERVICE = 'home_decoration_auth';

export const SecureStorage = {
  /**
   * 保存 Tinode Token 到 Keychain
   */
  async saveTinodeToken(token: string): Promise<boolean> {
    try {
      await Keychain.setGenericPassword('tinodeToken', token, {
        service: `${TOKEN_SERVICE}_tinode`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      });
      return true;
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to save tinode token to Keychain:', error);
      }
      return false;
    }
  },

  /**
   * 保存 Token 到 Keychain
   */
  async saveToken(token: string): Promise<boolean> {
    try {
      await Keychain.setGenericPassword('token', token, {
        service: TOKEN_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      });
      return true;
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to save token to Keychain:', error);
      }
      return false;
    }
  },

  /**
   * 保存 RefreshToken 到 Keychain
   */
  async saveRefreshToken(refreshToken: string): Promise<boolean> {
    try {
      await Keychain.setGenericPassword('refreshToken', refreshToken, {
        service: `${TOKEN_SERVICE}_refresh`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      });
      return true;
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to save refresh token to Keychain:', error);
      }
      return false;
    }
  },

  /**
   * 保存用户信息到 Keychain（加密存储）
   */
  async saveUser(user: any): Promise<boolean> {
    try {
      await Keychain.setGenericPassword('user', JSON.stringify(user), {
        service: `${TOKEN_SERVICE}_user`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      });
      return true;
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to save user to Keychain:', error);
      }
      return false;
    }
  },

  /**
   * 从 Keychain 获取 Tinode Token
   */
  async getTinodeToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: `${TOKEN_SERVICE}_tinode`,
      });
      if (credentials && credentials.password) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to get tinode token from Keychain:', error);
      }
      return null;
    }
  },

  /**
   * 从 Keychain 获取 Token
   */
  async getToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: TOKEN_SERVICE,
      });
      if (credentials && credentials.password) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to get token from Keychain:', error);
      }
      return null;
    }
  },

  /**
   * 从 Keychain 获取 RefreshToken
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: `${TOKEN_SERVICE}_refresh`,
      });
      if (credentials && credentials.password) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to get refresh token from Keychain:', error);
      }
      return null;
    }
  },

  /**
   * 从 Keychain 获取用户信息
   */
  async getUser(): Promise<any | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: `${TOKEN_SERVICE}_user`,
      });
      if (credentials && credentials.password) {
        return JSON.parse(credentials.password);
      }
      return null;
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to get user from Keychain:', error);
      }
      return null;
    }
  },

  /**
   * 清除所有认证信息
   */
  async clearAll(): Promise<boolean> {
    try {
      await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
      await Keychain.resetGenericPassword({ service: `${TOKEN_SERVICE}_refresh` });
      await Keychain.resetGenericPassword({ service: `${TOKEN_SERVICE}_user` });
      await Keychain.resetGenericPassword({ service: `${TOKEN_SERVICE}_tinode` });
      return true;
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to clear credentials from Keychain:', error);
      }
      return false;
    }
  },
};
