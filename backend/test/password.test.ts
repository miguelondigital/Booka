import { describe, expect, it } from 'vitest'
import { hashPassword, rejectWithDummyCheck, verifyPassword } from '../src/auth/password.js'
import { readCookie } from '../src/auth/sessions.js'

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('correct horse battery')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(hash).not.toContain('correct horse battery')
    expect(await verifyPassword('correct horse battery', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'))
  })

  it('rejects malformed stored hashes and dummy checks', async () => {
    expect(await verifyPassword('x', 'plain-text')).toBe(false)
    expect(await rejectWithDummyCheck('anything')).toBe(false)
  })
})

describe('readCookie', () => {
  it('finds a named cookie among others', () => {
    expect(readCookie('a=1; booka_session=abc%3D; b=2', 'booka_session')).toBe('abc=')
    expect(readCookie('a=1', 'booka_session')).toBeUndefined()
    expect(readCookie(undefined, 'booka_session')).toBeUndefined()
    expect(readCookie('booka_session=%E0%A4%A', 'booka_session')).toBeUndefined()
  })
})
