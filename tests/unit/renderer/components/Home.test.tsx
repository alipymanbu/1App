// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Home } from '../../../../src/renderer/src/pages/Home'

vi.mock('../../../../src/renderer/src/components/PlatformTabs', () => ({
  PlatformTabs: vi.fn(({ selected, onSelect, loginStates }) => (
    <div data-testid="platform-tabs">
      <span data-testid="selected-platform">{selected}</span>
      <span data-testid="login-states">{JSON.stringify(loginStates)}</span>
      <button data-testid="switch-to-xhs" onClick={() => onSelect('xhs')}>Switch to XHS</button>
      <button data-testid="switch-to-douyin" onClick={() => onSelect('douyin')}>Switch to Douyin</button>
    </div>
  ))
}))

vi.mock('../../../../src/renderer/src/components/UserCard', () => ({
  UserCard: vi.fn(({ profile, platform, onLogout }) => (
    <div data-testid="user-card">
      <span data-testid="user-card-profile-nickname">{profile?.nickname}</span>
      <span data-testid="user-card-platform">{platform}</span>
      <button data-testid="logout-button" onClick={onLogout}>Logout</button>
    </div>
  ))
}))

vi.mock('../../../../src/renderer/src/components/FeedGrid', () => ({
  FeedGrid: vi.fn(({ items, loading, error, onPlay }) => (
    <div data-testid="feed-grid">
      {loading && <span data-testid="feed-loading">Loading...</span>}
      {error && <span data-testid="feed-error">{error}</span>}
      {!loading && items.length > 0 && <span data-testid="feed-items-count">{items.length}</span>}
      <button data-testid="play-bili-item" onClick={() => onPlay({ id: '1', platform: 'bilibili', title: 'Bili Video', url: 'https://bilibili.com/video/BV1', author: 'Author', bvid: 'BV1xx' })}>Play Bili</button>
      <button data-testid="play-xhs-item" onClick={() => onPlay({ id: '2', platform: 'xhs', title: 'XHS Note', url: 'https://xhs.com/note/1', author: 'Author' })}>Play XHS</button>
      <button data-testid="play-other-item" onClick={() => onPlay({ id: '3', platform: 'douyin', title: 'Douyin Video', url: 'https://douyin.com/video/1', author: 'Author' })}>Play Other</button>
    </div>
  ))
}))

vi.mock('../../../../src/renderer/src/components/FollowGrid', () => ({
  FollowGrid: vi.fn(({ items, loading, error, onSelectUser }) => (
    <div data-testid="follow-grid">
      {loading && <span data-testid="follow-loading">Loading...</span>}
      {error && <span data-testid="follow-error">{error}</span>}
      {!loading && items.length > 0 && <span data-testid="follow-items-count">{items.length}</span>}
      <button data-testid="select-up" onClick={() => onSelectUser?.({ platform: 'bilibili', nickname: 'TestUP', avatar: 'https://example.com/up.jpg', uid: 'up123', url: 'https://bilibili.com/space/up123' })}>Select UP</button>
      <button data-testid="select-up-no-avatar" onClick={() => onSelectUser?.({ platform: 'bilibili', nickname: 'X', avatar: '', uid: 'noav', url: 'test' })}>Select UP No Avatar</button>
    </div>
  ))
}))

vi.mock('../../../../src/renderer/src/components/Pagination', () => ({
  Pagination: vi.fn(({ page, pageSize, total, loading, onPageChange }) => (
    <div data-testid="pagination">
      <button data-testid="page-prev" onClick={() => onPageChange?.(page - 1)} disabled={page <= 1}>Prev</button>
      <span>Pg {page}/{Math.ceil(total / pageSize)}</span>
      <button data-testid="page-next" onClick={() => onPageChange?.(page + 1)} disabled={page >= Math.ceil(total / pageSize) || loading}>Next</button>
    </div>
  ))
}))

vi.mock('../../../../src/renderer/src/pages/LoginView', () => ({
  LoginView: vi.fn(({ platform, onLogin }) => (
    <div data-testid="login-view">
      <span>Platform: {platform}</span>
      <button data-testid="login-button" onClick={onLogin}>Login</button>
    </div>
  ))
}))

vi.mock('../../../../src/renderer/src/components/VideoPlayerModal', () => ({
  VideoPlayerModal: vi.fn(({ item, onClose, onFavoriteFoldersChanged }) => (
    <div data-testid="video-player-modal">
      <span>{item?.title}</span>
      <button data-testid="close-video-player" onClick={onClose}>Close Player</button>
      <button data-testid="fav-folders-changed" onClick={onFavoriteFoldersChanged}>Fav Folders</button>
    </div>
  ))
}))

vi.mock('../../../../src/renderer/src/components/XhsNoteModal', () => ({
  XhsNoteModal: vi.fn(({ item, onClose }) => (
    <div data-testid="xhs-note-modal">
      <span>{item?.title}</span>
      <button data-testid="close-xhs-note" onClick={onClose}>Close XHS</button>
    </div>
  ))
}))

vi.mock('../../../../src/renderer/src/components/SettingsModal', () => ({
  SettingsModal: vi.fn(({ onClose }) => (
    <div data-testid="settings-modal">
      <button data-testid="close-settings" onClick={onClose}>Close Settings</button>
    </div>
  ))
}))

vi.mock('../../../../src/shared/constants', () => ({
  PLATFORMS: [
    { id: 'bilibili', name: 'Bilibili', color: '#00A1D6', loginUrl: 'https://passport.bilibili.com/login', icon: 'icon' },
    { id: 'xhs', name: 'Xiaohongshu', color: '#FF2442', loginUrl: 'https://www.xiaohongshu.com/login', icon: 'icon' },
    { id: 'douyin', name: 'Douyin', color: '#111111', loginUrl: 'https://www.douyin.com/', icon: 'icon' }
  ]
}))

const baseProfile = {
  platform: 'bilibili' as const,
  nickname: 'TestUser',
  avatar: 'https://example.com/avatar.jpg',
  uid: '12345',
  bio: 'Test bio'
}

const mockFeedItem = {
  id: 'feed-1',
  platform: 'bilibili' as const,
  title: 'Test Video',
  url: 'https://bilibili.com/video/BV1',
  author: 'TestAuthor',
  bvid: 'BV1xx',
  mediaType: 'video' as const
}

const mockPageResult = {
  items: [mockFeedItem],
  page: 1,
  pageSize: 10,
  total: 1,
  hasMore: false
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('open', vi.fn())
  window.electronApi.checkLogin.mockResolvedValue({ loggedIn: false, profile: null })
  window.electronApi.openLogin.mockResolvedValue({ loggedIn: false, profile: null })
  window.electronApi.getProfile.mockResolvedValue(null)
  window.electronApi.getFeed.mockResolvedValue([])
  window.electronApi.logout.mockResolvedValue(undefined)
  window.electronApi.getFollowings.mockResolvedValue([])
  window.electronApi.getFollowingFeed.mockResolvedValue([])
  window.electronApi.getFollowingsPage.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, hasMore: false })
  window.electronApi.getFollowingFeedPage.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, hasMore: false, nextOffset: undefined })
  window.electronApi.getUserVideosPage.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, hasMore: false })
  window.electronApi.getFavoriteFolders.mockResolvedValue([])
  window.electronApi.getFavoriteVideosPage.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0, hasMore: false })
  window.electronApi.onLoginStatusChanged.mockReturnValue(vi.fn())
})

describe('Home', () => {
  // ===== 1. Initial Load & Login Check =====
  describe('1. Initial Load & Login Check', () => {
    it('should render header with 1App title', async () => {
      render(<Home />)
      await waitFor(() => {
        expect(screen.getByText('1App')).toBeInTheDocument()
      })
    })

    it('should call checkLogin for all 3 platforms on mount', async () => {
      render(<Home />)
      await waitFor(() => {
        expect(window.electronApi.checkLogin).toHaveBeenCalledWith('xhs')
        expect(window.electronApi.checkLogin).toHaveBeenCalledWith('bilibili')
        expect(window.electronApi.checkLogin).toHaveBeenCalledWith('douyin')
      })
    })

    it('should show LoginView when not logged in', async () => {
      render(<Home />)
      const loginView = await screen.findByTestId('login-view')
      expect(loginView).toBeInTheDocument()
      expect(screen.queryByTestId('user-card')).not.toBeInTheDocument()
    })

    it('should show UserCard when logged in with profile', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      render(<Home />)
      const userCard = await screen.findByTestId('user-card')
      expect(userCard).toBeInTheDocument()
      expect(screen.queryByTestId('login-view')).not.toBeInTheDocument()
    })

    it('should show logged-in-no-profile UI when isLoggedIn but no profile', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: null })
      render(<Home />)
      await waitFor(() => {
        expect(screen.getByText('\u5df2\u767b\u5f55\uff0c\u4f46\u7528\u6237\u8d44\u6599\u8bfb\u53d6\u5931\u8d25')).toBeInTheDocument()
      })
      expect(screen.getByText('\u91cd\u65b0\u8bfb\u53d6\u8d44\u6599')).toBeInTheDocument()
      expect(screen.getByText('\u91cd\u65b0\u767b\u5f55')).toBeInTheDocument()
      expect(screen.getByText('\u9000\u51fa\u767b\u5f55')).toBeInTheDocument()
    })
  })

  // ===== 2. Platform Tabs =====
  describe('2. Platform Tabs', () => {
    it('should render PlatformTabs with correct selected platform', async () => {
      render(<Home />)
      const selected = await screen.findByTestId('selected-platform')
      expect(selected.textContent).toBe('bilibili')
    })

    it('should pass loginStates to PlatformTabs', async () => {
      render(<Home />)
      const loginStatesEl = await screen.findByTestId('login-states')
      const states = JSON.parse(loginStatesEl.textContent || '{}')
      expect(states).toHaveProperty('xhs', false)
      expect(states).toHaveProperty('bilibili', false)
      expect(states).toHaveProperty('douyin', false)
    })

    it('should reset feed state when switching platform', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByTestId('switch-to-xhs'))
      await waitFor(() => {
        expect(screen.getByTestId('selected-platform').textContent).toBe('xhs')
      })
      expect(window.electronApi.getFeed).toHaveBeenCalledWith('xhs', 1)
    })
  })

  // ===== 3. Feed Tabs (bilibili) =====
  describe('3. Feed Tabs (bilibili)', () => {
    it('should show all 4 type buttons for bilibili', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      render(<Home />)
      await screen.findByTestId('user-card')

      expect(screen.getByText('\u63a8\u8350\u5185\u5bb9')).toBeInTheDocument()
      expect(screen.getByText('\u5173\u6ce8\u52a8\u6001')).toBeInTheDocument()
      expect(screen.getByText('\u5173\u6ce8\u5217\u8868')).toBeInTheDocument()
      expect(screen.getByText('\u6211\u7684\u6536\u85cf')).toBeInTheDocument()
    })

    it('should not show type button bar for non-bilibili platforms', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByTestId('switch-to-xhs'))
      await waitFor(() => {
        expect(screen.getByTestId('selected-platform').textContent).toBe('xhs')
      })
      expect(screen.queryByText('\u63a8\u8350\u5185\u5bb9')).not.toBeInTheDocument()
      expect(screen.queryByText('\u5173\u6ce8\u52a8\u6001')).not.toBeInTheDocument()
    })

    it('should set feedType to recommend when clicking recommend tab', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u63a8\u8350\u5185\u5bb9'))
      await waitFor(() => {
        expect(window.electronApi.getFeed).toHaveBeenCalledWith('bilibili', 1)
      })
    })

    it('should call getFollowingFeedPage when clicking following tab', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingFeedPage.mockResolvedValue({ items: [mockFeedItem], page: 1, pageSize: 10, total: 1, hasMore: false })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u52a8\u6001'))
      await waitFor(() => {
        expect(window.electronApi.getFollowingFeedPage).toHaveBeenCalledWith('bilibili', undefined, 10)
      })
    })

    it('should call getFollowingsPage when clicking followings tab', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 5, hasMore: false })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(window.electronApi.getFollowingsPage).toHaveBeenCalledWith('bilibili', 1, 10)
      })
    })

    it('should call loadFavoriteFolders when clicking favorites tab', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFavoriteFolders.mockResolvedValue([{ id: 'fav1', title: 'Fav 1', count: 5 }])
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u6211\u7684\u6536\u85cf'))
      await waitFor(() => {
        expect(window.electronApi.getFavoriteFolders).toHaveBeenCalledWith('bilibili')
      })
    })
  })

  // ===== 4. Feed Loading =====
  describe('4. Feed Loading', () => {
    it('should show loading state in FeedGrid when feedLoading is true', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockImplementation(() => new Promise(() => {}))
      render(<Home />)
      await screen.findByTestId('user-card')

      await waitFor(() => {
        expect(screen.getByTestId('feed-loading')).toBeInTheDocument()
      })
    })

    it('should show FeedGrid with items when feed loads successfully', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      render(<Home />)
      await screen.findByTestId('user-card')

      await waitFor(() => {
        expect(screen.getByTestId('feed-items-count')).toBeInTheDocument()
      })
    })

    it('should show rate-limit formatted error in following feed when rate limit hit', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingFeedPage.mockRejectedValue(new Error('RATE_LIMITED:5000'))
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u52a8\u6001'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error')).toBeInTheDocument()
        expect(screen.getByTestId('feed-error').textContent).toContain('\u64cd\u4f5c\u8fc7\u5feb')
      })
    })

    it('should show generic error for recommend when regular error occurs', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockRejectedValue(new Error('network error'))
      render(<Home />)
      await screen.findByTestId('user-card')

      await waitFor(() => {
        const errorEl = screen.getByTestId('feed-error')
        expect(errorEl.textContent).toBe('\u63a8\u8350\u5185\u5bb9\u52a0\u8f7d\u5931\u8d25')
      })
    })
  })

  // ===== 5. Refresh/Recommend Pagination =====
  describe('5. Refresh/Recommend Pagination', () => {
    it('should handleRefreshRecommend increment page and call getFeed', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u6362\u4e00\u6279'))
      await waitFor(() => {
        expect(window.electronApi.getFeed).toHaveBeenCalledWith('bilibili', 2)
      })
    })

    it('should show no-more message when getFeed returns empty on refresh', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValueOnce([mockFeedItem]).mockResolvedValueOnce([])
      render(<Home />)
      await screen.findByTestId('user-card')
      await waitFor(() => {
        expect(window.electronApi.getFeed).toHaveBeenCalledWith('bilibili', 1)
      })

      fireEvent.click(screen.getByText('\u6362\u4e00\u6279'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toBe('\u6682\u65f6\u6ca1\u6709\u66f4\u591a\u63a8\u8350\u5185\u5bb9')
      })
    })

    it('should show error when refresh fails', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValueOnce([mockFeedItem]).mockRejectedValueOnce(new Error('fail'))
      render(<Home />)
      await screen.findByTestId('user-card')
      await waitFor(() => {
        expect(window.electronApi.getFeed).toHaveBeenCalledWith('bilibili', 1)
      })

      fireEvent.click(screen.getByText('\u6362\u4e00\u6279'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toBe('\u6362\u4e00\u6279\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5')
      })
    })
  })

  // ===== 6. Followings Tab =====
  describe('6. Followings Tab', () => {
    it('should render FollowGrid with followItems', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
        expect(screen.getByTestId('follow-items-count')).toBeInTheDocument()
      })
    })

    it('should render Pagination with followPage/followTotal', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 25, hasMore: true })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument()
      })
      expect(screen.getByTestId('pagination').textContent).toContain('1/3')
    })

    it('should handleFollowPageChange calls getFollowingsPage with correct page', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 25, hasMore: true })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument()
      })

      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [], page: 2, pageSize: 10, total: 25, hasMore: true })
      fireEvent.click(screen.getByTestId('page-next'))
      await waitFor(() => {
        expect(window.electronApi.getFollowingsPage).toHaveBeenCalledWith('bilibili', 2, 10)
      })
    })

    it('should handle rate-limit error for followings', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockRejectedValue(new Error('RATE_LIMITED:3000'))
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-error').textContent).toContain('\u64cd\u4f5c\u8fc7\u5feb')
      })
    })
  })

  // ===== 7. UP Main Videos =====
  describe('7. UP Main Videos', () => {
    it('should handleSelectUp selects user and loads videos', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      window.electronApi.getUserVideosPage.mockResolvedValue({ items: [mockFeedItem], page: 1, pageSize: 10, total: 1, hasMore: false })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('select-up'))
      await waitFor(() => {
        expect(window.electronApi.getUserVideosPage).toHaveBeenCalledWith('bilibili', 'up123', 1, 10)
      })
      expect(screen.getByTestId('feed-grid')).toBeInTheDocument()
      expect(screen.queryByTestId('follow-grid')).not.toBeInTheDocument()
    })

    it('should show no-public-videos message when items empty with errorCode', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      window.electronApi.getUserVideosPage.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, hasMore: false, errorCode: -403 })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('select-up'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toContain('\u6295\u7a3f\u63a5\u53e3\u9274\u6743\u5931\u8d25')
      })
    })

    it('should show rate-limit error for UP videos', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      window.electronApi.getUserVideosPage.mockRejectedValue(new Error('RATE_LIMITED:5000'))
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('select-up'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toContain('\u64cd\u4f5c\u8fc7\u5feb')
      })
    })

    it('should show generic error for UP videos on regular error', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      window.electronApi.getUserVideosPage.mockRejectedValue(new Error('generic'))
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('select-up'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toBe('\u6295\u7a3f\u52a0\u8f7d\u5931\u8d25')
      })
    })

    it('should handleUpVideoPageChange paginate UP videos', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      const manyItems = Array.from({ length: 10 }, (_, i) => ({ ...mockFeedItem, id: `u${i}`, title: `V${i}` }))
      window.electronApi.getUserVideosPage.mockResolvedValue({ items: manyItems, page: 1, pageSize: 10, total: 25, hasMore: true })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('select-up'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-grid')).toBeInTheDocument()
      })

      window.electronApi.getUserVideosPage.mockResolvedValue({ items: manyItems, page: 2, pageSize: 10, total: 25, hasMore: true })
      fireEvent.click(screen.getByTestId('page-next'))
      await waitFor(() => {
        expect(window.electronApi.getUserVideosPage).toHaveBeenCalledWith('bilibili', 'up123', 2, 10)
      })
    })

    it('should show back button and return to followings list', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      window.electronApi.getUserVideosPage.mockResolvedValue({ items: [mockFeedItem], page: 1, pageSize: 10, total: 1, hasMore: false })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await screen.findByTestId('follow-grid')

      fireEvent.click(screen.getByTestId('select-up'))
      const backBtn = await screen.findByText('\u2190 \u8fd4\u56de\u5173\u6ce8\u5217\u8868')
      expect(backBtn).toBeInTheDocument()

      fireEvent.click(backBtn)
      await waitFor(() => {
        expect(screen.queryByText('\u2190 \u8fd4\u56de\u5173\u6ce8\u5217\u8868')).not.toBeInTheDocument()
      })
      expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
    })

    it('should render UP avatar or initial fallback', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      window.electronApi.getUserVideosPage.mockResolvedValue({ items: [mockFeedItem], page: 1, pageSize: 10, total: 1, hasMore: false })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('select-up-no-avatar'))
      await waitFor(() => {
        expect(screen.getAllByText('X').length).toBeGreaterThanOrEqual(2)
      })
    })
  })

  // ===== 8. Following Feed (Dynamic) =====
  describe('8. Following Feed (Dynamic)', () => {
    it('should handleDynamicPageChange with offset-based pagination', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingFeedPage.mockResolvedValue({
        items: [mockFeedItem],
        page: 1,
        pageSize: 10,
        total: 1,
        hasMore: true,
        nextOffset: 'offset2'
      })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u52a8\u6001'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-items-count')).toBeInTheDocument()
      })

      window.electronApi.getFollowingFeedPage.mockResolvedValue({
        items: [mockFeedItem],
        page: 2,
        pageSize: 10,
        total: 1,
        hasMore: false,
        nextOffset: undefined
      })
      fireEvent.click(screen.getByText('\u4e0b\u4e00\u9875'))
      await waitFor(() => {
        expect(window.electronApi.getFollowingFeedPage).toHaveBeenCalledWith('bilibili', 'offset2', 10)
      })
    })

    it('should show prev/next buttons for following feed', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingFeedPage.mockResolvedValue({
        items: [mockFeedItem],
        page: 1,
        pageSize: 10,
        total: 1,
        hasMore: true,
        nextOffset: 'offset2'
      })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u52a8\u6001'))
      await waitFor(() => {
        expect(screen.getByText('\u4e0a\u4e00\u9875')).toBeInTheDocument()
        expect(screen.getByText('\u4e0b\u4e00\u9875')).toBeInTheDocument()
      })
    })

    it('should disable prev on first page and next when !dynamicHasMore', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingFeedPage.mockResolvedValue({
        items: [mockFeedItem],
        page: 1,
        pageSize: 10,
        total: 1,
        hasMore: false,
        nextOffset: undefined
      })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u52a8\u6001'))
      await waitFor(() => {
        const prevBtn = screen.getByText('\u4e0a\u4e00\u9875').closest('button')
        const nextBtn = screen.getByText('\u4e0b\u4e00\u9875').closest('button')
        expect(prevBtn).toBeDisabled()
        expect(nextBtn).toBeDisabled()
      })
    })

    it('should handle rate-limit error for dynamic feed', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingFeedPage.mockRejectedValue(new Error('RATE_LIMITED:5000'))
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u52a8\u6001'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toContain('\u64cd\u4f5c\u8fc7\u5feb')
      })
    })
  })

  // ===== 9. Favorites Tab =====
  describe('9. Favorites Tab', () => {
    it('should load folders and show them as buttons', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFavoriteFolders.mockResolvedValue([
        { id: 'f1', title: 'Folder 1', count: 3 },
        { id: 'f2', title: 'Folder 2', count: 7 }
      ])
      window.electronApi.getFavoriteVideosPage.mockResolvedValue({ items: [mockFeedItem], page: 1, pageSize: 20, total: 3, hasMore: false })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u6211\u7684\u6536\u85cf'))
      await waitFor(() => {
        expect(screen.getByText('Folder 1 (3)')).toBeInTheDocument()
        expect(screen.getByText('Folder 2 (7)')).toBeInTheDocument()
      })
    })

    it('should handleSelectFavoriteFolder switch folder and load videos', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFavoriteFolders.mockResolvedValue([
        { id: 'f1', title: 'Folder 1', count: 3 },
        { id: 'f2', title: 'Folder 2', count: 7 }
      ])
      window.electronApi.getFavoriteVideosPage.mockResolvedValue({ items: [mockFeedItem], page: 1, pageSize: 20, total: 3, hasMore: false })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u6211\u7684\u6536\u85cf'))
      await waitFor(() => {
        expect(screen.getByText('Folder 1 (3)')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Folder 2 (7)'))
      await waitFor(() => {
        expect(window.electronApi.getFavoriteVideosPage).toHaveBeenCalledWith('bilibili', 'f2', 1, 20)
      })
    })

    it('should handleFavoritePageChange paginate favorites', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFavoriteFolders.mockResolvedValue([{ id: 'f1', title: 'F1', count: 25 }])
      const manyItems = Array.from({ length: 20 }, (_, i) => ({ ...mockFeedItem, id: `fav${i}`, title: `F${i}` }))
      window.electronApi.getFavoriteVideosPage.mockResolvedValue({ items: manyItems, page: 1, pageSize: 20, total: 25, hasMore: true })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u6211\u7684\u6536\u85cf'))
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument()
      })

      window.electronApi.getFavoriteVideosPage.mockResolvedValue({ items: manyItems, page: 2, pageSize: 20, total: 25, hasMore: false })
      fireEvent.click(screen.getByTestId('page-next'))
      await waitFor(() => {
        expect(window.electronApi.getFavoriteVideosPage).toHaveBeenCalledWith('bilibili', 'f1', 2, 20)
      })
    })

    it('should show error when favorite loading fails', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFavoriteFolders.mockRejectedValue(new Error('fail'))
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u6211\u7684\u6536\u85cf'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toBe('\u6536\u85cf\u52a0\u8f7d\u5931\u8d25')
      })
    })

    it('should show empty state when no folders', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFavoriteFolders.mockResolvedValue([])
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u6211\u7684\u6536\u85cf'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-grid')).toBeInTheDocument()
      })
    })
  })

  // ===== 10. Play/Interaction =====
  describe('10. Play/Interaction', () => {
    it('should handlePlay for bilibili item sets playingVideo', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByTestId('play-bili-item'))
      await waitFor(() => {
        expect(screen.getByTestId('video-player-modal')).toBeInTheDocument()
      })
      expect(screen.getByText('Bili Video')).toBeInTheDocument()
    })

    it('should handlePlay for xhs item sets selectedXhsItem', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByTestId('play-xhs-item'))
      await waitFor(() => {
        expect(screen.getByTestId('xhs-note-modal')).toBeInTheDocument()
      })
      expect(screen.getByText('XHS Note')).toBeInTheDocument()
    })

    it('should handlePlay for other platforms calls window.open', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByTestId('play-other-item'))
      await waitFor(() => {
        expect(window.open).toHaveBeenCalledWith('https://douyin.com/video/1', '_blank')
      })
    })

    it('should handleClosePlayer clears playingVideo', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByTestId('play-bili-item'))
      await waitFor(() => {
        expect(screen.getByTestId('video-player-modal')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('close-video-player'))
      await waitFor(() => {
        expect(screen.queryByTestId('video-player-modal')).not.toBeInTheDocument()
      })
    })

    it('should handleCloseXhsNote clears selectedXhsItem', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByTestId('play-xhs-item'))
      await waitFor(() => {
        expect(screen.getByTestId('xhs-note-modal')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('close-xhs-note'))
      await waitFor(() => {
        expect(screen.queryByTestId('xhs-note-modal')).not.toBeInTheDocument()
      })
    })
  })

  // ===== 11. Login/Logout =====
  describe('11. Login/Logout', () => {
    it('should handleLogin call openLogin and load profile', async () => {
      window.electronApi.openLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      render(<Home />)
      await screen.findByTestId('login-view')

      fireEvent.click(screen.getByTestId('login-button'))
      await waitFor(() => {
        expect(window.electronApi.openLogin).toHaveBeenCalledWith('bilibili')
      })
      await waitFor(() => {
        expect(screen.getByTestId('user-card')).toBeInTheDocument()
      })
    })

    it('should handleLogin fetch profile when openLogin returns no profile', async () => {
      window.electronApi.openLogin.mockResolvedValue({ loggedIn: true, profile: null })
      window.electronApi.getProfile.mockResolvedValue(baseProfile)
      render(<Home />)
      await screen.findByTestId('login-view')

      fireEvent.click(screen.getByTestId('login-button'))
      await waitFor(() => {
        expect(window.electronApi.getProfile).toHaveBeenCalledWith('bilibili')
      })
      await waitFor(() => {
        expect(screen.getByTestId('user-card')).toBeInTheDocument()
      })
    })

    it('should handleLogout call logout and reset to LoginView', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByTestId('logout-button'))
      await waitFor(() => {
        expect(window.electronApi.logout).toHaveBeenCalledWith('bilibili')
      })
      await waitFor(() => {
        expect(screen.getByTestId('login-view')).toBeInTheDocument()
      })
    })

    it('should handleRetryProfile retry getProfile', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: null })
      render(<Home />)
      await screen.findByText('\u5df2\u767b\u5f55\uff0c\u4f46\u7528\u6237\u8d44\u6599\u8bfb\u53d6\u5931\u8d25')

      window.electronApi.getProfile.mockResolvedValue(baseProfile)
      fireEvent.click(screen.getByText('\u91cd\u65b0\u8bfb\u53d6\u8d44\u6599'))
      await waitFor(() => {
        expect(screen.getByTestId('user-card')).toBeInTheDocument()
      })
    })
  })

  // ===== 12. Events =====
  describe('12. Events', () => {
    it('should subscribe onLoginStatusChanged on mount and unsubscribe on unmount', async () => {
      const cleanup = vi.fn()
      window.electronApi.onLoginStatusChanged.mockReturnValue(cleanup)
      const { unmount } = render(<Home />)
      await waitFor(() => {
        expect(window.electronApi.onLoginStatusChanged).toHaveBeenCalledTimes(1)
      })
      const callback = window.electronApi.onLoginStatusChanged.mock.calls[0][0]
      expect(typeof callback).toBe('function')

      unmount()
      expect(cleanup).toHaveBeenCalledTimes(1)
    })

    it('should update loginStates and profiles on success with profile', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: false, profile: null })
      render(<Home />)
      await screen.findByTestId('login-view')

      const callback = window.electronApi.onLoginStatusChanged.mock.calls[0][0]
      callback({ platform: 'bilibili', success: true, profile: baseProfile })
      await waitFor(() => {
        expect(screen.getByTestId('user-card')).toBeInTheDocument()
      })
    })

    it('should clear profile on login event with !success', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      render(<Home />)
      await screen.findByTestId('user-card')

      const callback = window.electronApi.onLoginStatusChanged.mock.calls[0][0]
      callback({ platform: 'bilibili', success: false })
      await waitFor(() => {
        expect(screen.getByTestId('login-view')).toBeInTheDocument()
      })
    })

    it('should call getProfile on success when no profile provided', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: false, profile: null })
      window.electronApi.getProfile.mockResolvedValue(baseProfile)
      render(<Home />)
      await screen.findByTestId('login-view')

      const callback = window.electronApi.onLoginStatusChanged.mock.calls[0][0]
      callback({ platform: 'bilibili', success: true })
      await waitFor(() => {
        expect(window.electronApi.getProfile).toHaveBeenCalledWith('bilibili')
      })
    })
  })

  // ===== 13. Settings =====
  describe('13. Settings', () => {
    it('should show SettingsModal when settings button clicked', async () => {
      render(<Home />)
      const settingsBtn = document.querySelector('button[title="\u8bbe\u7f6e"]')
      expect(settingsBtn).toBeInTheDocument()

      fireEvent.click(settingsBtn!)
      await waitFor(() => {
        expect(screen.getByTestId('settings-modal')).toBeInTheDocument()
      })
    })

    it('should close SettingsModal when onClose is called', async () => {
      render(<Home />)
      const settingsBtn = document.querySelector('button[title="\u8bbe\u7f6e"]')
      fireEvent.click(settingsBtn!)
      await waitFor(() => {
        expect(screen.getByTestId('settings-modal')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('close-settings'))
      await waitFor(() => {
        expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument()
      })
    })
  })

  // ===== 14. Recommend Error Text =====
  describe('14. Recommend Error Text', () => {
    it('should show bilibili-specific message when recommend returns empty', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([])
      render(<Home />)
      await screen.findByTestId('user-card')
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toBe('\u63a8\u8350\u5185\u5bb9\u6682\u4e0d\u53ef\u7528\uff0c\u5df2\u5c1d\u8bd5\u591a\u4e2a\u6570\u636e\u6e90')
      })
    })
  })

  // ===== 15. Favorite Error Paths =====
  describe('15. Favorite Error Paths', () => {
    it('should show error when selecting favorite folder fails', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFavoriteFolders.mockResolvedValue([
        { id: 'f1', title: 'Folder 1', count: 3 },
        { id: 'f2', title: 'Folder 2', count: 7 }
      ])
      window.electronApi.getFavoriteVideosPage
        .mockResolvedValueOnce({ items: [], page: 1, pageSize: 20, total: 0, hasMore: false })
        .mockRejectedValueOnce(new Error('fail'))
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u6211\u7684\u6536\u85cf'))
      await waitFor(() => {
        expect(screen.getByText('Folder 1 (3)')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Folder 2 (7)'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toBe('\u6536\u85cf\u89c6\u9891\u52a0\u8f7d\u5931\u8d25')
      })
    })
  })

  // ===== 16. UP Video Guards =====
  describe('16. UP Video Guards', () => {
    it('should show no-public-videos when UP has no items without errorCode', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      window.electronApi.getUserVideosPage.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, hasMore: false })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('select-up'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toBe('\u8be5 UP \u4e3b\u6682\u65e0\u516c\u5f00\u89c6\u9891')
      })
    })

    it('should show rate-limit error when UP video pagination is rate-limited', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      const manyItems = Array.from({ length: 10 }, (_, i) => ({ ...mockFeedItem, id: `u${i}`, title: `V${i}` }))
      window.electronApi.getUserVideosPage
        .mockResolvedValueOnce({ items: manyItems, page: 1, pageSize: 10, total: 25, hasMore: true })
        .mockRejectedValueOnce(new Error('RATE_LIMITED:5000'))
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('select-up'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-grid')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId('page-next'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toContain('\u64cd\u4f5c\u8fc7\u5feb')
      })
    })
  })

  // ===== 17. Login Edge Branches =====
  describe('17. Login Edge Branches', () => {
    it('should not update state when openLogin returns loggedIn false', async () => {
      window.electronApi.openLogin.mockResolvedValue({ loggedIn: false, profile: null })
      render(<Home />)
      await screen.findByTestId('login-view')

      fireEvent.click(screen.getByTestId('login-button'))
      await waitFor(() => {
        expect(window.electronApi.openLogin).toHaveBeenCalledWith('bilibili')
      })
      expect(screen.getByTestId('login-view')).toBeInTheDocument()
    })

    it('should not set profile when getProfile returns null after login', async () => {
      window.electronApi.openLogin.mockResolvedValue({ loggedIn: true, profile: null })
      window.electronApi.getProfile.mockResolvedValue(null)
      render(<Home />)
      await screen.findByTestId('login-view')

      fireEvent.click(screen.getByTestId('login-button'))
      await waitFor(() => {
        expect(window.electronApi.getProfile).toHaveBeenCalledWith('bilibili')
      })
      expect(screen.queryByTestId('user-card')).not.toBeInTheDocument()
    })

    it('should not set profile when retry profile returns null', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: null })
      window.electronApi.getProfile.mockResolvedValue(null)
      render(<Home />)
      await screen.findByText('\u5df2\u767b\u5f55\uff0c\u4f46\u7528\u6237\u8d44\u6599\u8bfb\u53d6\u5931\u8d25')

      fireEvent.click(screen.getByText('\u91cd\u65b0\u8bfb\u53d6\u8d44\u6599'))
      await waitFor(() => {
        expect(window.electronApi.getProfile).toHaveBeenCalledWith('bilibili')
      })
      expect(screen.queryByTestId('user-card')).not.toBeInTheDocument()
    })

    it('should not set profile when login event success with no profile and getProfile returns null', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: false, profile: null })
      window.electronApi.getProfile.mockResolvedValue(null)
      render(<Home />)
      await screen.findByTestId('login-view')

      const callback = window.electronApi.onLoginStatusChanged.mock.calls[0][0]
      callback({ platform: 'bilibili', success: true })
      await waitFor(() => {
        expect(window.electronApi.getProfile).toHaveBeenCalledWith('bilibili')
      })
      expect(screen.queryByTestId('user-card')).not.toBeInTheDocument()
    })
  })

  // ===== 18. Rate Limit Error Formatting =====
  describe('18. Rate Limit Error Formatting', () => {
    it('should use formatRateLimitError for rate-limit errors in following feed', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingFeedPage.mockRejectedValue(new Error('RATE_LIMITED:5000'))
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u52a8\u6001'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toBe('\u64cd\u4f5c\u8fc7\u5feb\uff0c\u8bf7 5.0 \u79d2\u540e\u518d\u8bd5')
      })
    })

    it('should use default message for regular errors in followings tab', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockRejectedValue(new Error('some error'))
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('follow-error')).not.toBeInTheDocument()
    })

    it('should use formatVideoError with errorCode -403 for UP videos', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      window.electronApi.getUserVideosPage.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, hasMore: false, errorCode: -403 })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('select-up'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toBe('\u6295\u7a3f\u63a5\u53e3\u9274\u6743\u5931\u8d25\uff0c\u6b63\u5728\u5c1d\u8bd5\u5176\u4ed6\u65b9\u5f0f...')
      })
    })

    it('should use formatVideoError with errorCode -799 for UP videos', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      window.electronApi.getUserVideosPage.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, hasMore: false, errorCode: -799 })
      render(<Home />)
      await screen.findByTestId('user-card')

      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => {
        expect(screen.getByTestId('follow-grid')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('select-up'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toBe('\u8bf7\u6c42\u8fc7\u4e8e\u9891\u7e41\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5')
      })
    })

    it('should use formatVideoError with generic errorCode for UP videos', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 1, hasMore: false })
      window.electronApi.getUserVideosPage.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, hasMore: false, errorCode: -500 })
      render(<Home />)
      await screen.findByTestId('user-card')
      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => { expect(screen.getByTestId('follow-grid')).toBeInTheDocument() })
      fireEvent.click(screen.getByTestId('select-up'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toContain('\u6295\u7a3f\u63a5\u53e3\u9519\u8bef')
      })
    })
  })

  // ===== 19. Generic Feed Error Branches =====
  describe('19. Generic Feed Error Branches', () => {
    it('should handle non-rate-limit error in following feed', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingFeedPage.mockRejectedValue(new Error('generic error'))
      render(<Home />)
      await screen.findByTestId('user-card')
      fireEvent.click(screen.getByText('\u5173\u6ce8\u52a8\u6001'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-grid')).toBeInTheDocument()
      })
    })

    it('should handle non-rate-limit error during following feed pagination', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingFeedPage.mockResolvedValue({
        items: [mockFeedItem],
        page: 1, pageSize: 10, total: 1, hasMore: true, nextOffset: 'o2'
      })
      render(<Home />)
      await screen.findByTestId('user-card')
      fireEvent.click(screen.getByText('\u5173\u6ce8\u52a8\u6001'))
      await waitFor(() => { expect(screen.getByTestId('feed-items-count')).toBeInTheDocument() })
      window.electronApi.getFollowingFeedPage.mockRejectedValue(new Error('generic'))
      fireEvent.click(screen.getByText('\u4e0b\u4e00\u9875'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-grid')).toBeInTheDocument()
      })
    })

    it('should handle non-rate-limit error during UP video pagination', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFollowingsPage.mockResolvedValue({ items: [{ platform: 'bilibili', nickname: 'U1', avatar: '', uid: '1', url: 'test' }], page: 1, pageSize: 10, total: 25, hasMore: true })
      const manyItems = Array.from({ length: 10 }, (_, i) => ({ ...mockFeedItem, id: `u${i}`, title: `V${i}` }))
      window.electronApi.getUserVideosPage
        .mockResolvedValueOnce({ items: manyItems, page: 1, pageSize: 10, total: 25, hasMore: true })
        .mockRejectedValueOnce(new Error('generic'))
      render(<Home />)
      await screen.findByTestId('user-card')
      fireEvent.click(screen.getByText('\u5173\u6ce8\u5217\u8868'))
      await waitFor(() => { expect(screen.getByTestId('follow-grid')).toBeInTheDocument() })
      fireEvent.click(screen.getByTestId('select-up'))
      await waitFor(() => { expect(screen.getByTestId('feed-grid')).toBeInTheDocument() })
      fireEvent.click(screen.getByTestId('page-next'))
      await waitFor(() => {
        expect(screen.getByTestId('feed-error').textContent).toBe('\u6295\u7a3f\u52a0\u8f7d\u5931\u8d25')
      })
    })
  })

  // ===== 20. handleFavoriteFoldersChanged =====
  describe('20. handleFavoriteFoldersChanged', () => {
    it('should reload favorite folders when callback triggered', async () => {
      window.electronApi.checkLogin.mockResolvedValue({ loggedIn: true, profile: baseProfile })
      window.electronApi.getFeed.mockResolvedValue([mockFeedItem])
      window.electronApi.getFavoriteFolders.mockResolvedValue([{ id: 'f1', title: 'F1', count: 3 }])
      render(<Home />)
      await screen.findByTestId('user-card')
      fireEvent.click(screen.getByTestId('play-bili-item'))
      await screen.findByTestId('video-player-modal')
      window.electronApi.getFavoriteFolders.mockClear()
      fireEvent.click(screen.getByTestId('fav-folders-changed'))
      await waitFor(() => {
        expect(window.electronApi.getFavoriteFolders).toHaveBeenCalledWith('bilibili')
      })
    })
  })
})
