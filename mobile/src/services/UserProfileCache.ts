/**
 * 用户资料缓存服务
 * 用于在腾讯云 IM 资料不完整时使用本地缓存的用户信息
 */

interface CachedUserProfile {
    userID: string;
    nickname: string;
    avatar: string;
}

class UserProfileCacheService {
    private cache: Map<string, CachedUserProfile> = new Map();

    /**
     * 缓存用户资料（从详情页跳转聊天时调用）
     */
    set(userID: string, nickname: string, avatar: string): void {
        this.cache.set(userID, { userID, nickname, avatar });
    }

    /**
     * 获取缓存的用户资料
     */
    get(userID: string): CachedUserProfile | undefined {
        return this.cache.get(userID);
    }

    /**
     * 合并 IM 资料和本地缓存
     * IM 资料优先，无值时使用本地缓存
     */
    mergeProfile(userID: string, imProfile: { nick?: string; avatar?: string }): { nickname: string; avatar: string } {
        const cached = this.get(userID);
        return {
            nickname: imProfile.nick || cached?.nickname || userID,
            avatar: imProfile.avatar || cached?.avatar || 'https://via.placeholder.com/100',
        };
    }
}

export default new UserProfileCacheService();
