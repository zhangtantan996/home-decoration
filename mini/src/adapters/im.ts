import TinodeService from '@/services/TinodeService';
import { refreshTinodeToken } from '@/services/tinode';

import type { IMAdapter } from './types';

const imAdapter: IMAdapter = {
  init: (token) => TinodeService.init(token),
  reconnect: (token) => TinodeService.reconnect(token),
  disconnect: () => TinodeService.disconnect(),
  isConnected: () => TinodeService.isConnected(),
  getConversationList: () => TinodeService.getConversationList(),
  subscribeToConversation: (topicName, limit) => TinodeService.subscribeToConversation(topicName, limit),
  getCachedMessages: (topic) => TinodeService.getCachedMessages(topic),
  loadEarlierMessages: (topic, limit) => TinodeService.loadEarlierMessages(topic, limit),
  sendTextMessage: (topicName, text) => TinodeService.sendTextMessage(topicName, text),
  markAsRead: (topicName, seq) => TinodeService.markAsRead(topicName, seq),
  resolveTinodeUserId: (appUserIdentifier) => TinodeService.resolveTinodeUserId(appUserIdentifier),
  refreshToken: () => refreshTinodeToken(),
};

export const miniIMAdapter = imAdapter;
