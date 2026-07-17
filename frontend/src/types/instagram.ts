// src/types/instagram.ts

export type ConnectionStatus = 'loading' | 'connected' | 'not_connected' | 'expired'

export interface InstagramAccount {
  id: string
  user_id: string
  provider: 'instagram'
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  profile_url: string | null
  status: 'connected' | 'expired' | 'revoked'
  connected_at: string
  updated_at: string
}

export interface InstagramPost {
  id: string
  caption: string
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  mediaUrl: string
  thumbnailUrl: string
  permalink: string
  timestamp: string
  likeCount: number | null
  commentCount: number | null
}

export interface InstagramSearchResult {
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  followerCount: number | null
  mediaCount: number | null
  website: string | null
  profileUrl: string
}

export type InstagramInteraction = 'like' | 'comment' | 'follow' | 'message' | 'save' | 'share'
