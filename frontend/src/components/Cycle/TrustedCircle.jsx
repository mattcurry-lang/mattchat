import React, { useState, useEffect } from 'react'
import { IconX, IconUserPlus, IconTrash } from '../Icons'
import TrustedPersonDashboard from './TrustedPersonDashboard'
import {
  listTrustedPeople,
  createTrustedInvite,
  updateTrustedPermission,
  revokeTrustedPerson,
  searchProfilesByUsername
} from '../../lib/cycleTrust'

const PERMISSION_LEVELS = [
  { level: 1, label: 'Minimal', desc: 'Can see you added them, but no cycle status details' },
  { level: 2, label: 'Overview', desc: 'Can see if your period is approaching or if you need support' },
  { level: 3, label: 'Detailed', desc: 'Can see current phase and estimated next period' },
]

export default function TrustedCircle({
  userId,
  conversations,
  getConvoName,
  getOtherUserId,
  onClose,
  onOpenConversation
}) {
  const [activeTab, setActiveTab] = useState('my_circle') // 'my_circle' | 'supporting'
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState(null)

  const loadPeople = async () => {
    try {
      const data = await listTrustedPeople(userId)
      setPeople(data || [])
    } catch (e) {
      console.error('Error loading trusted circle:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'my_circle') {
      loadPeople()
    }
  }, [userId, activeTab])

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchProfilesByUsername(searchQuery, userId)
        setSearchResults(results || [])
      } catch (e) {
        console.error('Error searching profiles:', e)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, userId])

  const handleAdd = async (targetUserId) => {
    setAddingId(targetUserId)
    try {
      await createTrustedInvite(userId, targetUserId)
      setShowAdd(false)
      setSearchQuery('')
      setSearchResults([])
      await loadPeople()
    } catch (e) {
      alert(e.message || 'Failed to add trusted person')
    } finally {
      setAddingId(null)
    }
  }

  const handlePermissionChange = async (id, level) => {
    try {
      await updateTrustedPermission(id, { permission_level: level })
      setPeople(prev => prev.map(p => p.id === id ? { ...p, permission_level: level } : p))
    } catch (e) {
      alert('Failed to update permission')
    }
  }

  const handleRevoke = async (id) => {
    if (!confirm('Remove this person from your Trusted Circle?')) return
    try {
      await revokeTrustedPerson(id)
      await loadPeople()
    } catch (e) {
      alert('Failed to remove person')
    }
  }

  if (activeTab === 'supporting') {
    return (
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.06)', padding: 4, borderRadius: 24 }}>
            <button
              type="button"
              onClick={() => setActiveTab('my_circle')}
              style={{
                background: activeTab === 'my_circle' ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : 'transparent',
                border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              My Circle
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('supporting')}
              style={{
                background: activeTab === 'supporting' ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : 'transparent',
                border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              People I Support
            </button>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconX size={15} />
          </button>
        </div>

        <TrustedPersonDashboard
          onOpenConversation={onOpenConversation}
          onClose={onClose}
        />
      </div>
    )
  }

  return (
    <div 
      onClick={(e) => e.stopPropagation()}
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'linear-gradient(160deg, #1b1730 0%, #14121f 55%)', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.06)', padding: 4, borderRadius: 24 }}>
          <button
            type="button"
            onClick={() => setActiveTab('my_circle')}
            style={{
              background: activeTab === 'my_circle' ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : 'transparent',
              border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            My Circle
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('supporting')}
            style={{
              background: activeTab === 'supporting' ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : 'transparent',
              border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            People I Support
          </button>
        </div>
        <button type="button" onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconX size={15} />
        </button>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 18px 90px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12.5, lineHeight: 1.5 }}>
          Share select cycle info with up to two people you trust. You control exactly what each person sees, and you can revoke access anytime.
        </div>

        {loading && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: 20 }}>Loading…</div>}

        {!loading && (
          <>
            {people.map(person => {
              const name = person.profiles?.username || 'User'
              return (
                <div key={person.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{name}</div>
                      <div style={{ fontSize: 11.5, color: person.status === 'accepted' ? '#4ade80' : '#facc15' }}>
                        {person.status === 'accepted' ? '• Connected' : '• Pending invite'}
                      </div>
                    </div>
                    <button type="button" onClick={() => handleRevoke(person.id)} style={{ background: 'rgba(239,68,68,0.12)', border: 'none', borderRadius: 10, padding: '6px 10px', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <IconTrash size={12} /> Remove
                    </button>
                  </div>

                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Sharing Permission Level
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {PERMISSION_LEVELS.map(p => (
                      <button
                        key={p.level}
                        type="button"
                        onClick={() => handlePermissionChange(person.id, p.level)}
                        style={{
                          textAlign: 'left',
                          background: person.permission_level === p.level ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${person.permission_level === p.level ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.06)'}`,
                          borderRadius: 12, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit'
                        }}
                      >
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: person.permission_level === p.level ? '#c4b5fd' : '#fff' }}>
                          Level {p.level}: {p.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}

            {people.length < 2 && !showAdd && (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'rgba(167,139,250,0.12)', border: '1px dashed rgba(167,139,250,0.4)',
                  borderRadius: 16, padding: '14px', color: '#c4b5fd', fontSize: 13.5, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit', width: '100%'
                }}
              >
                <IconUserPlus size={16} /> Add a trusted person
              </button>
            )}

            {showAdd && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>Search by username</div>
                  <button type="button" onClick={() => setShowAdd(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                </div>

                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type username..."
                  autoFocus
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 12px', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}
                />

                {searching && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Searching…</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {searchResults.map(user => (
                    <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 10 }}>
                      <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{user.username}</span>
                      <button
                        type="button"
                        onClick={() => handleAdd(user.id)}
                        disabled={addingId === user.id}
                        style={{ background: 'linear-gradient(135deg,#6c63ff,#a78bfa)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: addingId === user.id ? 0.6 : 1 }}
                      >
                        {addingId === user.id ? 'Adding…' : 'Invite'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
