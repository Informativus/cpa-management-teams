/**
 * 版本相关 API
 */

import { apiClient } from './client';

export const versionApi = {
  checkLatest: () => apiClient.get<Record<string, unknown>>('/server/latest-version'),
};

export interface ServerUpdateStatus {
  supported: boolean;
  available: boolean;
  current_version: string;
  latest_version?: string;
  release?: string;
  check_error?: string;
  job: {
    status:
      | 'idle'
      | 'queued'
      | 'downloading'
      | 'backing_up'
      | 'deploying'
      | 'verifying'
      | 'succeeded'
      | 'failed'
      | 'unknown';
    version?: string;
    error?: string;
  };
}

export const captureVersionApi = () => {
  const revision = apiClient.getConnectionRevision();
  const client = apiClient.captureConnection();
  return {
    isCurrent: () => apiClient.getConnectionRevision() === revision,
    status: (refresh = false) =>
      client.get<ServerUpdateStatus>(`/server/update${refresh ? '?refresh=1' : ''}`),
    install: (release: string) =>
      client.post<{ job: ServerUpdateStatus['job'] }>('/server/update', { release }),
    latest: async () => {
      const data = await client.get<Record<string, unknown>>('/server/latest-version');
      const value = data['latest-version'] ?? data.latest_version ?? data.latest;
      return typeof value === 'string' ? value : '';
    },
  };
};
