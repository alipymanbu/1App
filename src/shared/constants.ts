import type { PlatformConfig } from './types'

export const PLATFORMS: PlatformConfig[] = [
  {
    id: 'xhs',
    name: '小红书',
    color: '#FF2442',
    loginUrl: 'https://www.xiaohongshu.com/login',
    icon: '📕'
  },
  {
    id: 'bilibili',
    name: 'B站',
    color: '#00A1D6',
    loginUrl: 'https://passport.bilibili.com/login',
    icon: '📺'
  },
  {
    id: 'douyin',
    name: '抖音',
    color: '#111111',
    loginUrl: 'https://www.douyin.com/',
    icon: '🎵'
  }
]

export const APP_NAME = '1App'
export const DB_NAME = '1app.db'
export const SESSION_PREFIX = 'persist:'
