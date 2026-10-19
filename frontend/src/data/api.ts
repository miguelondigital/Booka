import type {
  Account,
  AccountProfile,
  BookOverview,
  BookSummary,
  ClubCard,
  ClubDetail,
  Discussion,
  InvitePreview,
  LoginInput,
  NewBookInput,
  NewClubInput,
  NewReplyInput,
  NewThreadInput,
  ProgressResult,
  Reply,
  SignupInput,
  VisibleThread,
} from '@shared/types'
import { ApiError, requestJson } from './http'

const club = (clubId: string) => `/api/clubs/${encodeURIComponent(clubId)}`
const book = (clubId: string, bookId: string) =>
  `${club(clubId)}/books/${encodeURIComponent(bookId)}`

/**
 * The client's only door to data. Discussion arrives already filtered by the
 * server for the signed-in member; the client never decides visibility.
 */
export const api = {
  // ---- Auth -------------------------------------------------------------
  async me(): Promise<Account | null> {
    try {
      return (await requestJson<{ account: Account }>('/api/auth/me', { allowUnauthorized: true }))
        .account
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },

  async login(input: LoginInput): Promise<Account> {
    return (
      await requestJson<{ account: Account }>('/api/auth/login', {
        method: 'POST',
        body: input,
        allowUnauthorized: true,
      })
    ).account
  },

  async signup(input: SignupInput): Promise<Account> {
    return (
      await requestJson<{ account: Account }>('/api/auth/signup', {
        method: 'POST',
        body: input,
        allowUnauthorized: true,
      })
    ).account
  },

  logout(): Promise<void> {
    return requestJson('/api/auth/logout', { method: 'POST', allowUnauthorized: true })
  },

  // ---- Account ----------------------------------------------------------
  profile(): Promise<AccountProfile> {
    return requestJson('/api/account')
  },

  async updateName(name: string): Promise<Account> {
    return (
      await requestJson<{ account: Account }>('/api/account', { method: 'PATCH', body: { name } })
    ).account
  },

  async changeEmail(email: string, password: string): Promise<Account> {
    return (
      await requestJson<{ account: Account }>('/api/account/email', {
        method: 'PUT',
        body: { email, password },
      })
    ).account
  },

  deleteAccount(password: string): Promise<void> {
    return requestJson('/api/account', { method: 'DELETE', body: { password } })
  },

  // ---- Clubs ------------------------------------------------------------
  async clubs(): Promise<ClubCard[]> {
    return (await requestJson<{ clubs: ClubCard[] }>('/api/clubs')).clubs
  },

  createClub(input: NewClubInput): Promise<ClubCard> {
    return requestJson('/api/clubs', { method: 'POST', body: input })
  },

  clubDetail(clubId: string): Promise<ClubDetail> {
    return requestJson(club(clubId))
  },

  renameClub(clubId: string, name: string): Promise<void> {
    return requestJson(club(clubId), { method: 'PATCH', body: { name } })
  },

  deleteClub(clubId: string): Promise<void> {
    return requestJson(club(clubId), { method: 'DELETE' })
  },

  async resetInvite(clubId: string): Promise<string> {
    return (
      await requestJson<{ inviteCode: string }>(`${club(clubId)}/invite/reset`, { method: 'POST' })
    ).inviteCode
  },

  startBook(clubId: string, input: NewBookInput): Promise<BookSummary> {
    return requestJson(`${club(clubId)}/books`, { method: 'POST', body: input })
  },

  leaveClub(clubId: string): Promise<{ clubDeleted: boolean }> {
    return requestJson(`${club(clubId)}/leave`, { method: 'POST' })
  },

  transferOwnership(clubId: string, memberId: string): Promise<void> {
    return requestJson(`${club(clubId)}/owner`, { method: 'POST', body: { memberId } })
  },

  removeMember(clubId: string, memberId: string): Promise<void> {
    return requestJson(`${club(clubId)}/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    })
  },

  unblock(clubId: string, memberId: string): Promise<void> {
    return requestJson(`${club(clubId)}/blocks/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    })
  },

  // ---- Invites ----------------------------------------------------------
  previewInvite(code: string): Promise<InvitePreview> {
    return requestJson(`/api/invites/${encodeURIComponent(code)}`)
  },

  joinWithInvite(code: string): Promise<{ clubId: string }> {
    return requestJson(`/api/invites/${encodeURIComponent(code)}/join`, { method: 'POST' })
  },

  // ---- Books ------------------------------------------------------------
  book(clubId: string, bookId: string): Promise<BookOverview> {
    return requestJson(book(clubId, bookId))
  },

  discussion(clubId: string, bookId: string): Promise<Discussion> {
    return requestJson(`${book(clubId, bookId)}/discussion`)
  },

  updateProgress(clubId: string, bookId: string, checkpointIndex: number): Promise<ProgressResult> {
    return requestJson(`${book(clubId, bookId)}/progress`, {
      method: 'PUT',
      body: { checkpointIndex },
    })
  },

  // Only title and body are sent; the server stamps the checkpoint.
  createThread(
    clubId: string,
    bookId: string,
    { title, body }: NewThreadInput,
  ): Promise<VisibleThread> {
    return requestJson(`${book(clubId, bookId)}/threads`, {
      method: 'POST',
      body: { title, body },
    })
  },

  createReply(
    clubId: string,
    bookId: string,
    threadId: string,
    { body }: NewReplyInput,
  ): Promise<Reply> {
    return requestJson(`${book(clubId, bookId)}/threads/${encodeURIComponent(threadId)}/replies`, {
      method: 'POST',
      body: { body },
    })
  },
}

export type Api = typeof api
