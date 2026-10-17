import type { ApiError, ChallengeListResponse, ChallengeResponse, CreateChallengeRequest } from '../shared/contracts';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body = await response.json();
  if (!response.ok) {
    const error = (body as ApiError).error;
    const details = error.fields ? Object.values(error.fields).flat().join(' ') : '';
    throw new Error(`${error.message} ${details}`.trim());
  }
  return body as T;
}

export const listChallenges = () => request<ChallengeListResponse>('/api/challenges');
export const createChallenge = (input: CreateChallengeRequest) => request<ChallengeResponse>('/api/challenges', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
});
