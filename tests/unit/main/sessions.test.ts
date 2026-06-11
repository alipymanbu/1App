import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockClearStorageData, mockCookiesGet, mockSessionFromPartition } = vi.hoisted(() => {
  const mockClearStorageData = vi.fn(() => Promise.resolve())
  const mockCookiesGet = vi.fn(() => Promise.resolve([]))
  const mockSessionFromPartition = vi.fn(() => ({
    cookies: { get: mockCookiesGet },
    clearStorageData: mockClearStorageData
  }))
  return { mockClearStorageData, mockCookiesGet, mockSessionFromPartition }
})

vi.mock('electron', () => ({
  app: { getPath: vi.fn(), setPath: vi.fn(), on: vi.fn(), whenReady: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(),
  session: { fromPartition: mockSessionFromPartition },
  net: { request: vi.fn() },
  shell: { openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() }
}))

import { getSession, clearSession, getLoginCheckDomains } from '../../../src/main/sessions'

describe('sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should get session for each platform', () => {
    getSession('xhs')
    getSession('bilibili')
    getSession('douyin')

    expect(mockSessionFromPartition).toHaveBeenCalledWith('persist:xhs')
    expect(mockSessionFromPartition).toHaveBeenCalledWith('persist:bilibili')
    expect(mockSessionFromPartition).toHaveBeenCalledWith('persist:douyin')
  })

  it('should clear storage data for platform', async () => {
    await clearSession('bilibili')
    expect(mockClearStorageData).toHaveBeenCalled()
  })

  it('should return login check domains for each platform', () => {
    const xhsDomains = getLoginCheckDomains('xhs')
    expect(xhsDomains).toEqual(['xiaohongshu.com', 'xhscdn.com'])

    const biliDomains = getLoginCheckDomains('bilibili')
    expect(biliDomains).toEqual(['bilibili.com', 'hdslb.com'])

    const dyDomains = getLoginCheckDomains('douyin')
    expect(dyDomains).toEqual(['douyin.com', 'amemv.com'])
  })
})
