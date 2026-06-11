export const bilibiliNavLoggedIn = {
  code: 0,
  data: {
    isLogin: true,
    mid: 123456,
    uname: 'TestUser',
    face: 'https://i0.hdslb.com/bfs/face/avatar.jpg',
    level_info: { current_level: 5 }
  }
}

export const bilibiliNavLoggedOut = {
  code: 0,
  data: { isLogin: false }
}

export const bilibiliFeedRcmd = {
  code: 0,
  data: {
    item: [
      {
        bvid: 'BV1xx411c7mD',
        title: 'Test Video 1',
        pic: 'https://i0.hdslb.com/bfs/archive/pic1.jpg',
        owner: { mid: 1, name: 'Author1', face: 'https://face1.jpg' },
        stat: { like: 100, reply: 20, share: 5 },
        ctime: 1600000000,
        aid: 1001
      },
      {
        bvid: 'BV2xx411c7mE',
        title: 'Test Video 2',
        pic: 'https://i0.hdslb.com/bfs/archive/pic2.jpg',
        owner: { mid: 2, name: 'Author2', face: 'https://face2.jpg' },
        stat: { like: 200, reply: 30, share: 10 },
        ctime: 1600000001,
        aid: 1002
      }
    ]
  }
}

export const bilibiliRelationStat = {
  code: 0,
  data: { following: 50, follower: 100 }
}

export const bilibiliUpStat = {
  code: 0,
  data: { likes: 500, archive: { view: 10000 }, article: { view: 2000 } }
}

export const bilibiliFollowingsList = {
  code: 0,
  data: {
    list: [
      { mid: 10, uname: 'Follow1', face: 'https://face10.jpg', sign: 'bio1' },
      { mid: 11, uname: 'Follow2', face: 'https://face11.jpg', sign: 'bio2' }
    ],
    total: 2
  }
}

export const bilibiliVideoDetail = {
  code: 0,
  data: {
    bvid: 'BV1xx411c7mD',
    aid: 1001,
    title: 'Detail Title',
    desc: 'Video description here',
    pic: 'https://pic.jpg',
    owner: { mid: 1, name: 'Owner', face: 'https://ownerface.jpg' },
    stat: { view: 5000, like: 300, coin: 50, favorite: 100, reply: 30 },
    cid: 2001,
    pages: [{ page: 1, part: 'P1', cid: 2001 }],
    pubdate: 1600000000
  }
}
