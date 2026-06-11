export const xhsProfileValid = {
  nickname: 'XHS_User',
  avatar: 'https://sns-avatar-qc.xhscdn.com/avatar/test.jpg',
  uid: 'user_12345',
  desc: 'A nice bio'
}

export const xhsInitialState = {
  user: {
    userInfo: {
      nickname: 'XHS_User',
      avatar: 'https://sns-avatar-qc.xhscdn.com/avatar/test.jpg',
      userId: 'user_12345',
      desc: 'A nice bio',
      followingCount: 10,
      followerCount: 20,
      likedCount: 30
    }
  }
}

export const xhsFeedItems = [
  {
    noteCard: {
      note_id: 'note_1',
      display_title: 'Note 1',
      cover: { urlDefault: 'https://cover1.jpg' },
      user: { nickname: 'Author1', avatar: 'https://avatar1.jpg' },
      liked_count: 50,
      comment_count: 10,
      share_count: 3
    }
  },
  {
    noteCard: {
      note_id: 'note_2',
      display_title: 'Note 2',
      cover: { urlDefault: 'https://cover2.jpg' },
      user: { nickname: 'Author2', avatar: 'https://avatar2.jpg' },
      liked_count: 100,
      comment_count: 20,
      share_count: 8
    }
  }
]
