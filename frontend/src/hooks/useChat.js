import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, getMessages, sendMessage as sendMsg } from '../lib/supabase'
import { playSound } from '../lib/mattchatSounds'
import { subscribeToChannel, getChannel } from '../lib/realtimeManager'
import {
  validateFile,
  buildStoragePath,
  createMediaAssetRow,
  updateMediaAssetStatus,
} from '../services/MediaAssetService'
import { uploadManager } from '../services/UploadManager'

export function useChat(conversationId, currentUserId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [typing, setTyping] = useState([])
  const [isEmailConvo, setIsEmailConvo] = useState(false)
  const typingRowActive = useRef(false)

  // messageId -> File, kept only long enough to support a retry without
  // re-picking the file. Memory-only: a hard reload clears it, which is
  // why retryMediaUpload below has an explicit "no file available" state
  // rather than silently no-op'ing.
  const fileStoreRef = useRef(new Map())

  const channelKey = conversationId ? `messages:${conversationId}` : null

  const loadMessages = useCallback(() => {
    if (!conversationId) return
    setLoading(true)
    getMessages(conversationId).then(data => {
      setMessages(data || [])
      setLoading(false)
    })
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) return
    typingRowActive.current = false
    loadMessages()

    supabase
      .from('conversations')
      .select('email_sender')
      .eq('id', conversationId)
      .single()
      .then(({ data }) => setIsEmailConvo(!!data?.email_sender))
  }, [conversationId, loadMessages])

  // Don't carry File blobs across a conversation switch.
  useEffect(() => () => fileStoreRef.current.clear(), [conversationId])

  useEffect(() => {
    if (!channelKey) return

    const unsubscribe = subscribeToChannel(
      channelKey,
      (channel, emit) => channel
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => emit('insert', payload))
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => emit('update', payload))
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'media_assets',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => emit('media_update', payload))
        .on('broadcast', { event: 'typing' }, ({ payload }) => emit('typing', payload)),
      {
        onEvent: async (type, payload) => {
          if (type === 'insert') {
            const { data: msgWithProfile } = await supabase
              .from('messages')
              .select('*, profiles!messages_sender_id_fkey(username, avatar_url), media_assets(*)')
              .eq('id', payload.new.id)
              .single()
            if (!msgWithProfile) return

            if (msgWithProfile.sender_id !== currentUserId) playSound('pulse')

            setMessages(prev => {
              if (msgWithProfile.sender_id === currentUserId && msgWithProfile.message_type === 'text') {
                const matchIdx = prev.findIndex(m => m._optimistic && m.message_type === 'text' && m.content === msgWithProfile.content)
                if (matchIdx !== -1) {
                  const next = [...prev]
                  next[matchIdx] = msgWithProfile
                  return next
                }
              }
              if (prev.some(m => m.id === msgWithProfile.id)) return prev
              const existing = prev.find(m => m.id === msgWithProfile.id || m._tempId === msgWithProfile.id)
              if (existing) {
                return prev.map(m => (m.id === msgWithProfile.id || m._tempId === msgWithProfile.id)
                  ? { ...msgWithProfile, _localPreviewUrl: existing._localPreviewUrl, media_assets: existing.media_assets || msgWithProfile.media_assets }
                  : m
                )
              }
              return [...prev, msgWithProfile]
            })
          } else if (type === 'update') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
          } else if (type === 'media_update') {
            const asset = payload.new
            setMessages(prev => prev.map(m => {
              if (m.id !== asset.message_id) return m
              const media_assets = (m.media_assets || []).map(a => a.id === asset.id ? asset : a)
              return { ...m, media_assets: media_assets.length ? media_assets : [asset] }
            }))
          } else if (type === 'typing') {
            if (payload.user_id === currentUserId) return
            setTyping(prev => {
              if (payload.is_typing) return prev.includes(payload.user_id) ? prev : [...prev, payload.user_id]
              return prev.filter(id => id !== payload.user_id)
            })
          }
        },
        onResync: loadMessages,
      }
    )

    return () => {
      if (typingRowActive.current && currentUserId) {
        typingRowActive.current = false
        supabase.from('typing_status')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('user_id', currentUserId)
          .then(({ error }) => { if (error) console.error('[useChat] typing_status cleanup failed:', error) })
      }
      unsubscribe()
    }
  }, [channelKey, conversationId, currentUserId, loadMessages])

  const sendMessage = useCallback(async (content) => {
    if (!conversationId || !currentUserId || !content.trim()) return
    const trimmed = content.trim()
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const optimisticMsg = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: trimmed,
      message_type: 'text',
      created_at: new Date().toISOString(),
      profiles: null,
      _optimistic: true,
      _status: 'sending',
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      await sendMsg(conversationId, currentUserId, trimmed)
    } catch (e) {
      console.error('sendMessage failed:', e)
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _status: 'failed' } : m))
      return
    }

    if (isEmailConvo) {
      try {
        await supabase.functions.invoke('send-email', {
          body: { conversationId, senderId: currentUserId, content: trimmed },
        })
      } catch (e) {
        console.error('send-email invoke failed:', e)
      }
    }
  }, [conversationId, currentUserId, isEmailConvo])

  /**
   * Sends one or more media files as messages. Non-blocking: inserts an
   * optimistic bubble per file immediately (preparing → uploading →
   * processing → sent → failed), then returns.
   *
   * @param files File[] - already validated/edited by MediaComposer
   * @param opts { mediaType, caption, isViewOnce, expiresAt }
   */
  const sendMediaMessage = useCallback(async (files, opts = {}) => {
    if (!conversationId || !currentUserId || !files?.length) return
    const { mediaType, caption = null, isViewOnce = false, expiresAt = null } = opts

    for (const file of files) {
      const tempId = `temp-media-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const localPreviewUrl = URL.createObjectURL(file)

      const optimisticMsg = {
        id: tempId,
        _tempId: tempId,
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: caption,
        message_type: 'media',
        created_at: new Date().toISOString(),
        profiles: null,
        _optimistic: true,
        _localPreviewUrl: localPreviewUrl,
        media_assets: [{
          media_type: mediaType,
          filename: file.name,
          size_bytes: file.size,
          upload_status: 'preparing',
          upload_progress: 0,
          is_view_once: isViewOnce,
        }],
      }
      setMessages(prev => [...prev, optimisticMsg])

      try {
        validateFile(file, mediaType)

        const { data: messageRow, error: msgErr } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_id: currentUserId,
            content: caption,
            message_type: 'media',
          })
          .select()
          .single()
        if (msgErr) throw msgErr

        const storagePath = buildStoragePath(currentUserId, mediaType, file.name)
        const asset = await createMediaAssetRow({
          conversationId,
          senderId: currentUserId,
          messageId: messageRow.id,
          mediaType,
          mimeType: file.type,
          filename: file.name,
          storagePath,
          sizeBytes: file.size,
          isViewOnce,
          expiresAt,
        })

        fileStoreRef.current.set(messageRow.id, file)

        setMessages(prev => prev.map(m => m._tempId === tempId
          ? { ...m, id: messageRow.id, media_assets: [asset] }
          : m
        ))

        uploadManager.start({
          file,
          assetId: asset.id,
          mediaType,
          storagePath,
          conversationId,
          onProgress: (pct) => {
            setMessages(prev => prev.map(m => m.id === messageRow.id
              ? { ...m, media_assets: [{ ...m.media_assets?.[0], upload_progress: pct }] }
              : m
            ))
          },
          onStatusChange: (status) => {
            setMessages(prev => prev.map(m => m.id === messageRow.id
              ? { ...m, media_assets: [{ ...m.media_assets?.[0], upload_status: status }] }
              : m
            ))
            if (status === 'processing') {
              updateMediaAssetStatus(asset.id, { upload_status: 'sent', processing_status: 'done' })
                .then(() => fileStoreRef.current.delete(messageRow.id))
                .catch(() => {})
            }
          },
        })
      } catch (e) {
        console.error('[useChat] sendMediaMessage failed:', e)
        setMessages(prev => prev.map(m => m._tempId === tempId
          ? { ...m, media_assets: [{ ...(m.media_assets?.[0] || {}), upload_status: 'failed' }] }
          : m
        ))
      }
    }
  }, [conversationId, currentUserId])

  /**
   * Sends multiple files as ONE grouped "Moment" message — all assets
   * share the same message_id and carry moment_order so MomentMessage /
   * MomentViewer render them as a single swipeable unit.
   *
   * @param items [{ file, mediaType }] — already edited/exported by MediaComposer
   * @param opts { title, coverIndex }
   */
  const sendMomentMessage = useCallback(async (items, opts = {}) => {
    if (!conversationId || !currentUserId || !items?.length) return
    const { title = null, coverIndex = 0 } = opts
    const tempId = `temp-moment-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const localPreviewUrls = items.map(({ file }) => URL.createObjectURL(file))

    const optimisticMsg = {
      id: tempId,
      _tempId: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: JSON.stringify({ title }),
      message_type: 'moment',
      created_at: new Date().toISOString(),
      profiles: null,
      _optimistic: true,
      _localPreviewUrls: localPreviewUrls,
      media_assets: items.map(({ file, mediaType }, i) => ({
        media_type: mediaType,
        filename: file.name,
        size_bytes: file.size,
        upload_status: 'preparing',
        upload_progress: 0,
        moment_order: i,
        is_moment_cover: i === coverIndex,
      })),
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      const { data: messageRow, error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: JSON.stringify({ title }),
          message_type: 'moment',
        })
        .select()
        .single()
      if (msgErr) throw msgErr

      setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, id: messageRow.id } : m))

      await Promise.all(items.map(async ({ file, mediaType }, i) => {
        try {
          validateFile(file, mediaType)
          const storagePath = buildStoragePath(currentUserId, mediaType, file.name)
          const asset = await createMediaAssetRow({
            conversationId,
            senderId: currentUserId,
            messageId: messageRow.id,
            mediaType,
            mimeType: file.type,
            filename: file.name,
            storagePath,
            sizeBytes: file.size,
            momentOrder: i,
            isMomentCover: i === coverIndex,
          })

          setMessages(prev => prev.map(m => m.id === messageRow.id
            ? { ...m, media_assets: (m.media_assets || []).map((a, idx) => idx === i ? asset : a) }
            : m
          ))

          uploadManager.start({
            file,
            assetId: asset.id,
            mediaType,
            storagePath,
            conversationId,
            onProgress: (pct) => {
              setMessages(prev => prev.map(m => m.id === messageRow.id
                ? { ...m, media_assets: (m.media_assets || []).map(a => a.id === asset.id ? { ...a, upload_progress: pct } : a) }
                : m
              ))
            },
            onStatusChange: (status) => {
              setMessages(prev => prev.map(m => m.id === messageRow.id
                ? { ...m, media_assets: (m.media_assets || []).map(a => a.id === asset.id ? { ...a, upload_status: status } : a) }
                : m
              ))
              if (status === 'processing') {
                updateMediaAssetStatus(asset.id, { upload_status: 'sent', processing_status: 'done' }).catch(() => {})
              }
            },
          })
        } catch (e) {
          console.error('[useChat] sendMomentMessage: item failed:', e)
          setMessages(prev => prev.map(m => m.id === messageRow.id
            ? { ...m, media_assets: (m.media_assets || []).map((a, idx) => idx === i ? { ...a, upload_status: 'failed' } : a) }
            : m
          ))
        }
      }))
    } catch (e) {
      console.error('[useChat] sendMomentMessage failed:', e)
      setMessages(prev => prev.map(m => m._tempId === tempId
        ? { ...m, media_assets: (m.media_assets || []).map(a => ({ ...a, upload_status: 'failed' })) }
        : m
      ))
    }
  }, [conversationId, currentUserId])

  /** Retries a failed upload. Pulls the File from the in-memory store
   * keyed by message id — if it isn't there (e.g. the page was reloaded,
   * the store is memory-only), fails clearly with _retryUnavailable
   * rather than silently no-op'ing. Note: this targets single-asset
   * media messages; per-item retry inside a Moment isn't wired yet. */
  const retryMediaUpload = useCallback((message) => {
    const asset = message.media_assets?.[0]
    if (!asset) return
    const file = fileStoreRef.current.get(message.id)

    if (!file) {
      console.error('[useChat] retryMediaUpload: no file in memory for', message.id, '(page reload clears this store)')
      setMessages(prev => prev.map(m => m.id === message.id
        ? { ...m, media_assets: [{ ...asset, upload_status: 'failed', _retryUnavailable: true }] }
        : m
      ))
      return
    }

    setMessages(prev => prev.map(m => m.id === message.id
      ? { ...m, media_assets: [{ ...asset, upload_status: 'uploading', upload_progress: 0 }] }
      : m
    ))

    uploadManager.retry({
      file,
      assetId: asset.id,
      mediaType: asset.media_type,
      storagePath: asset.storage_path,
      conversationId,
      onProgress: (pct) => {
        setMessages(prev => prev.map(m => m.id === message.id
          ? { ...m, media_assets: [{ ...m.media_assets?.[0], upload_progress: pct }] }
          : m
        ))
      },
      onStatusChange: (status) => {
        setMessages(prev => prev.map(m => m.id === message.id
          ? { ...m, media_assets: [{ ...m.media_assets?.[0], upload_status: status }] }
          : m
        ))
        if (status === 'processing') {
          updateMediaAssetStatus(asset.id, { upload_status: 'sent', processing_status: 'done' })
            .then(() => fileStoreRef.current.delete(message.id))
            .catch(() => {})
        }
      },
    })
  }, [conversationId])

  const broadcastTyping = useCallback((isTyping) => {
    if (channelKey) {
      getChannel(channelKey)?.send({
        type: 'broadcast', event: 'typing',
        payload: { user_id: currentUserId, is_typing: isTyping },
      })
    }

    if (!conversationId || !currentUserId) return

    if (isTyping && !typingRowActive.current) {
      typingRowActive.current = true
      supabase.from('typing_status')
        .upsert({ conversation_id: conversationId, user_id: currentUserId, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.error('[useChat] typing_status upsert failed:', error) })
    } else if (!isTyping && typingRowActive.current) {
      typingRowActive.current = false
      supabase.from('typing_status')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId)
        .then(({ error }) => { if (error) console.error('[useChat] typing_status delete failed:', error) })
    }
  }, [currentUserId, conversationId, channelKey])

  return { messages, loading, typing, sendMessage, sendMediaMessage, sendMomentMessage, retryMediaUpload, broadcastTyping }
}

export function useConversations(userId) {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [convoIds, setConvoIds] = useState([])

  const load = useCallback(async () => {
    if (!userId) return

    const { data: memberRows } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId)

    const conversationIds = memberRows?.map(r => r.conversation_id) || []
    if (conversationIds.length === 0) {
      setConversations([])
      setConvoIds([])
      setLoading(false)
      return
    }

    const { data: hiddenRows } = await supabase
      .from('hidden_conversations')
      .select('conversation_id')
      .eq('user_id', userId)

    const hiddenIds = new Set((hiddenRows || []).map(r => r.conversation_id))
    const visibleIds = conversationIds.filter(id => !hiddenIds.has(id))
    setConvoIds(conversationIds)

    if (visibleIds.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('conversations')
      .select(`
        id, updated_at, last_message, is_group, name, email_sender,
        conversation_members(
          user_id,
          profiles(id, username, email, avatar_url)
        )
      `)
      .in('id', visibleIds)
      .order('updated_at', { ascending: false })

    setConversations(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const idsKey = convoIds.slice().sort().join(',')

  useEffect(() => {
    if (!userId || !convoIds.length) return

    const unsubConvos = subscribeToChannel(
      `conversations:${userId}:${idsKey}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'conversations',
        filter: `id=in.(${convoIds.join(',')})`,
      }, (payload) => emit('update', payload)),
      { onEvent: load, onResync: load }
    )

    const unsubHidden = subscribeToChannel(
      `hidden_conversations:${userId}`,
      (channel, emit) => channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'hidden_conversations',
        filter: `user_id=eq.${userId}`,
      }, (payload) => emit('change', payload)),
      { onEvent: load, onResync: load }
    )

    return () => { unsubConvos(); unsubHidden() }
  }, [userId, idsKey, convoIds, load])

  return { conversations, loading, reload: load }
}
