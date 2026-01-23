/**
 * 腾讯云 IM 表情解析器
 * 将腾讯云的表情编码转换为原生 Emoji
 */

// 腾讯云 IM 表情映射表（根据官方文档整理）
const TENCENT_EMOJI_MAP: Record<string, string> = {
  // 笑脸类
  '[TUIEmoji_Expect]': '😀',
  '[TUIEmoji_Smile]': '😃',
  '[TUIEmoji_Grin]': '😄',
  '[TUIEmoji_Laugh]': '😁',
  '[TUIEmoji_Sweat]': '😅',
  '[TUIEmoji_Joy]': '😂',
  '[TUIEmoji_Rofl]': '🤣',
  '[TUIEmoji_Blush]': '😊',
  '[TUIEmoji_Innocent]': '😇',
  '[TUIEmoji_Wink]': '😉',
  '[TUIEmoji_Relieved]': '😌',

  // 爱心类
  '[TUIEmoji_HeartEyes]': '😍',
  '[TUIEmoji_Kissing]': '😘',
  '[TUIEmoji_KissingHeart]': '😗',
  '[TUIEmoji_KissingClosedEyes]': '😚',
  '[TUIEmoji_KissingSmilingEyes]': '😙',
  '[TUIEmoji_Yum]': '😋',

  // 舌头类
  '[TUIEmoji_Stuck]': '😛',
  '[TUIEmoji_StuckWink]': '😜',
  '[TUIEmoji_StuckClosed]': '😝',
  '[TUIEmoji_Moneymouth]': '🤑',

  // 手势类
  '[TUIEmoji_Hugs]': '🤗',
  '[TUIEmoji_Thinking]': '🤔',
  '[TUIEmoji_Zipper]': '🤐',
  '[TUIEmoji_Neutral]': '😐',
  '[TUIEmoji_Expressionless]': '😑',
  '[TUIEmoji_NoMouth]': '😶',

  // 墨镜/酷类
  '[TUIEmoji_Smirk]': '😏',
  '[TUIEmoji_Unamused]': '😒',
  '[TUIEmoji_Grimace]': '😬',
  '[TUIEmoji_LyingFace]': '🤥',
  '[TUIEmoji_Sunglasses]': '😎',

  // 伤心/哭泣类
  '[TUIEmoji_Pensive]': '😔',
  '[TUIEmoji_Confused]': '😕',
  '[TUIEmoji_SlightFrown]': '🙁',
  '[TUIEmoji_Frown]': '☹️',
  '[TUIEmoji_Persevere]': '😣',
  '[TUIEmoji_Confounded]': '😖',
  '[TUIEmoji_Tired]': '😫',
  '[TUIEmoji_Weary]': '😩',
  '[TUIEmoji_Cry]': '😢',
  '[TUIEmoji_Sob]': '😭',

  // 生气类
  '[TUIEmoji_Triumph]': '😤',
  '[TUIEmoji_Angry]': '😠',
  '[TUIEmoji_Rage]': '😡',
  '[TUIEmoji_Pouting]': '😾',

  // 惊讶/恐惧类
  '[TUIEmoji_Open]': '😮',
  '[TUIEmoji_Hushed]': '😯',
  '[TUIEmoji_Astonished]': '😲',
  '[TUIEmoji_Flushed]': '😳',
  '[TUIEmoji_Scream]': '😱',
  '[TUIEmoji_Fearful]': '😨',
  '[TUIEmoji_ColdSweat]': '😰',
  '[TUIEmoji_Disappointed]': '😞',

  // 生病/受伤类
  '[TUIEmoji_Dizzy]': '😵',
  '[TUIEmoji_Mask]': '😷',
  '[TUIEmoji_Thermometer]': '🤒',
  '[TUIEmoji_Bandage]': '🤕',
  '[TUIEmoji_Nauseated]': '🤢',
  '[TUIEmoji_Vomit]': '🤮',
  '[TUIEmoji_Sneeze]': '🤧',

  // 睡觉/疲倦类
  '[TUIEmoji_Sleep]': '😴',
  '[TUIEmoji_Sleepy]': '😪',
  '[TUIEmoji_Zzz]': '💤',

  // 恶魔/怪物类
  '[TUIEmoji_Smiling_Imp]': '😈',
  '[TUIEmoji_Imp]': '👿',
  '[TUIEmoji_Skull]': '💀',
  '[TUIEmoji_Ghost]': '👻',
  '[TUIEmoji_Alien]': '👽',
  '[TUIEmoji_Robot]': '🤖',

  // 猫脸类
  '[TUIEmoji_Smiley_Cat]': '😺',
  '[TUIEmoji_Smile_Cat]': '😸',
  '[TUIEmoji_Joy_Cat]': '😹',
  '[TUIEmoji_Heart_Eyes_Cat]': '😻',
  '[TUIEmoji_Smirk_Cat]': '😼',
  '[TUIEmoji_Kissing_Cat]': '😽',
  '[TUIEmoji_Scream_Cat]': '🙀',
  '[TUIEmoji_Crying_Cat]': '😿',

  // 手势符号
  '[TUIEmoji_Clap]': '👏',
  '[TUIEmoji_ThumbsUp]': '👍',
  '[TUIEmoji_ThumbsDown]': '👎',
  '[TUIEmoji_Fist]': '👊',
  '[TUIEmoji_Punch]': '👊',
  '[TUIEmoji_Wave]': '👋',
  '[TUIEmoji_Ok_Hand]': '👌',
  '[TUIEmoji_Victory]': '✌️',
  '[TUIEmoji_Pray]': '🙏',

  // 爱心符号
  '[TUIEmoji_Heart]': '❤️',
  '[TUIEmoji_Heartbeat]': '💓',
  '[TUIEmoji_Broken_Heart]': '💔',
  '[TUIEmoji_Two_Hearts]': '💕',
  '[TUIEmoji_Sparkling_Heart]': '💖',
  '[TUIEmoji_Heartpulse]': '💗',
  '[TUIEmoji_Cupid]': '💘',
  '[TUIEmoji_Blue_Heart]': '💙',
  '[TUIEmoji_Green_Heart]': '💚',
  '[TUIEmoji_Yellow_Heart]': '💛',
  '[TUIEmoji_Purple_Heart]': '💜',
  '[TUIEmoji_Gift_Heart]': '💝',

  // 其他常用符号
  '[TUIEmoji_Tada]': '🎉',
  '[TUIEmoji_Confetti]': '🎊',
  '[TUIEmoji_Fire]': '🔥',
  '[TUIEmoji_Star]': '⭐',
  '[TUIEmoji_Dizzy_Symbol]': '💫',
  '[TUIEmoji_Boom]': '💥',
  '[TUIEmoji_Sweat_Drops]': '💦',

  // 中文常用表情补充
  '[微笑]': '😊',
  '[撇嘴]': '😒',
  '[色]': '😍',
  '[发呆]': '😳',
  '[得意]': '😎',
  '[流泪]': '😢',
  '[害羞]': '😳',
  '[闭嘴]': '🤐',
  '[睡]': '😴',
  '[大哭]': '😭',
  '[尴尬]': '😅',
  '[发怒]': '😡',
  '[调皮]': '😜',
  '[呲牙]': '😁',
  '[惊讶]': '😲',
  '[难过]': '😞',
  '[酷]': '😎',
  '[冷汗]': '😰',
  '[抓狂]': '😫',
  '[吐]': '🤮',
  '[偷笑]': '😏',
  '[可爱]': '😊',
  '[白眼]': '🙄',
  '[傲慢]': '😤',
  '[饥饿]': '😋',
  '[困]': '😪',
  '[惊恐]': '😱',
  '[流汗]': '😅',
  '[憨笑]': '😄',
  '[大兵]': '🎖️',
  '[奋斗]': '💪',
  '[咒骂]': '🤬',
  '[疑问]': '❓',
  '[嘘]': '🤫',
  '[晕]': '😵',
  '[折磨]': '😖',
  '[衰]': '😔',
  '[骷髅]': '💀',
  '[敲打]': '🔨',
  '[再见]': '👋',
  '[擦汗]': '😅',
  '[抠鼻]': '🤧',
  '[鼓掌]': '👏',
  '[糗大了]': '😳',
  '[坏笑]': '😏',
  '[左哼哼]': '😤',
  '[右哼哼]': '😤',
  '[哈欠]': '😪',
  '[鄙视]': '😒',
  '[委屈]': '😢',
  '[快哭了]': '😭',
  '[阴险]': '😈',
  '[亲亲]': '😘',
  '[吓]': '😱',
  '[可怜]': '🥺',
  '[菜刀]': '🔪',
  '[西瓜]': '🍉',
  '[啤酒]': '🍺',
  '[篮球]': '🏀',
  '[乒乓]': '🏓',
  '[咖啡]': '☕',
  '[饭]': '🍚',
  '[猪头]': '🐷',
  '[玫瑰]': '🌹',
  '[凋谢]': '🥀',
  '[示爱]': '💘',
  '[爱心]': '❤️',
  '[心碎]': '💔',
  '[蛋糕]': '🎂',
  '[闪电]': '⚡',
  '[炸弹]': '💣',
  '[刀]': '🔪',
  '[足球]': '⚽',
  '[瓢虫]': '🐞',
  '[便便]': '💩',
  '[月亮]': '🌙',
  '[太阳]': '☀️',
  '[礼物]': '🎁',
  '[拥抱]': '🤗',
  '[强]': '👍',
  '[弱]': '👎',
  '[握手]': '🤝',
  '[胜利]': '✌️',
  '[抱拳]': '🙏',
  '[勾引]': '👉',
  '[拳头]': '👊',
  '[差劲]': '👎',
  '[爱你]': '🤟',
  '[NO]': '🙅',
  '[OK]': '👌',
  '[爱情]': '💑',
  '[飞吻]': '😘',
  '[跳跳]': '🦘',
  '[发抖]': '🥶',
  '[怄火]': '😤',
  '[转圈]': '🌀',
  '[磕头]': '🙇',
  '[回头]': '↩️',
  '[跳绳]': '🤸',
  '[挥手]': '👋',
};

/**
 * 解析文本中的腾讯云表情编码，转换为原生 Emoji
 * @param text - 包含表情编码的文本
 * @returns 转换后的文本
 */
export const parseEmojiText = (text: string): string => {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let result = text;

  // 使用正则表达式匹配所有 [xxx] 格式的表情编码
  const emojiRegex = /\[[\u4e00-\u9fa5\w_]+\]/g;

  result = result.replace(emojiRegex, (match) => {
    // 如果映射表中有对应的 emoji，则替换；否则保持原样
    return TENCENT_EMOJI_MAP[match] || match;
  });

  return result;
};

/**
 * 判断文本是否包含腾讯云表情编码
 * @param text - 要检查的文本
 * @returns 是否包含表情编码
 */
export const hasEmojiCode = (text: string): boolean => {
  if (!text || typeof text !== 'string') {
    return false;
  }
  return /\[[\u4e00-\u9fa5\w_]+\]/.test(text);
};

/**
 * 获取文本中所有的表情编码
 * @param text - 要提取的文本
 * @returns 表情编码数组
 */
export const extractEmojiCodes = (text: string): string[] => {
  if (!text || typeof text !== 'string') {
    return [];
  }
  const matches = text.match(/\[[\u4e00-\u9fa5\w_]+\]/g);
  return matches || [];
};

/**
 * 添加自定义表情映射
 * @param code - 表情编码
 * @param emoji - 对应的 emoji 字符
 */
export const addCustomEmoji = (code: string, emoji: string): void => {
  TENCENT_EMOJI_MAP[code] = emoji;
};

/**
 * 批量添加自定义表情映射
 * @param emojiMap - 表情映射对象
 */
export const addCustomEmojis = (emojiMap: Record<string, string>): void => {
  Object.assign(TENCENT_EMOJI_MAP, emojiMap);
};

export default {
  parseEmojiText,
  hasEmojiCode,
  extractEmojiCodes,
  addCustomEmoji,
  addCustomEmojis,
};
