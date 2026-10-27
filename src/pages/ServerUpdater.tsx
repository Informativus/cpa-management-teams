import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useAuthStore, useNotificationStore } from '@/stores';
import { apiClient } from '@/services/api/client';
import { captureVersionApi, type ServerUpdateStatus } from '@/services/api/version';

const activeStates = new Set([
  'queued',
  'downloading',
  'backing_up',
  'deploying',
  'verifying',
  'unknown',
]);

export function ServerUpdater() {
  const { t } = useTranslation();
  const { showNotification, showConfirmation } = useNotificationStore();
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const serverVersion = useAuthStore((state) => state.serverVersion);
  const [status, setStatus] = useState<ServerUpdateStatus>();
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const session = useRef<ReturnType<typeof captureVersionApi> | null>(null);
  const busy = starting || Boolean(status && activeStates.has(status.job.status));

  useEffect(() => {
    const revision = apiClient.getConnectionRevision();
    const connection = captureVersionApi();
    session.current = connection;
    let alive = true;
    let supported = true;
    let timer: ReturnType<typeof setTimeout>;
    const current = () => alive && revision === apiClient.getConnectionRevision();
    const poll = async () => {
      try {
        const next = await connection.status();
        if (!current()) return;
        setStatus(next);
        setError('');
      } catch (cause) {
        if (!current()) return;
        // An ordinary CPA without the controller retains its version-check action.
        if ((cause as { status?: number }).status === 404) {
          supported = false;
        } else {
          setError(t('system_info.update_status_unavailable'));
        }
      } finally {
        if (current() && supported) timer = setTimeout(poll, 5000);
      }
    };
    setStatus(undefined);
    setError('');
    setChecking(false);
    setStarting(false);
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
      if (session.current === connection) session.current = null;
    };
  }, [apiBase, managementKey, t]);

  const check = useCallback(async () => {
    const connection = session.current;
    if (!connection) return;
    setChecking(true);
    try {
      let next: ServerUpdateStatus;
      try {
        next = await connection.status(true);
      } catch (cause) {
        if ((cause as { status?: number }).status !== 404) throw cause;
        const latest = await connection.latest();
        if (session.current !== connection || !connection.isCurrent()) return;
        showNotification(
          t('system_info.update_manual', { version: latest || serverVersion }),
          'warning'
        );
        return;
      }
      if (session.current !== connection || !connection.isCurrent()) return;
      setStatus(next);
      setError('');
      if (next.check_error) {
        showNotification(t('system_info.update_catalog_unavailable'), 'error');
      } else {
        showNotification(
          next.available
            ? t('system_info.version_update_available', { version: next.latest_version })
            : t('system_info.version_is_latest'),
          next.available ? 'warning' : 'success'
        );
      }
    } catch {
      if (session.current === connection && connection.isCurrent()) {
        setError(t('system_info.version_check_error'));
      }
    } finally {
      if (session.current === connection && connection.isCurrent()) setChecking(false);
    }
  }, [serverVersion, showNotification, t]);

  const install = () => {
    const connection = session.current;
    const release = status?.release;
    if (!connection || !release || !status?.available || busy) return;
    showConfirmation({
      title: t('system_info.update_button', { version: status.latest_version }),
      message: t('system_info.update_confirm'),
      confirmText: t('system_info.update_install'),
      onConfirm: async () => {
        if (session.current !== connection || !connection.isCurrent()) return;
        setStarting(true);
        setError('');
        try {
          const result = await connection.install(release);
          if (session.current !== connection || !connection.isCurrent()) return;
          setStatus((previous) => previous && { ...previous, available: false, job: result.job });
        } catch {
          if (session.current !== connection || !connection.isCurrent()) return;
          // A lost response is not evidence that installation did not start.
          setError(t('system_info.update_status_unavailable'));
          try {
            const next = await connection.status();
            if (session.current === connection && connection.isCurrent()) setStatus(next);
          } catch {
            // Polling will reconcile the accepted job; never repeat POST automatically.
          }
        } finally {
          if (session.current === connection && connection.isCurrent()) setStarting(false);
        }
      },
    });
  };

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void check()}
        loading={checking}
        disabled={busy}
      >
        {t('system_info.version_check_button')}
      </Button>
      {status?.available && (
        <Button size="sm" onClick={install} loading={starting} disabled={busy || Boolean(error)}>
          {t('system_info.update_button', { version: status.latest_version })}
        </Button>
      )}
      <div role="status" aria-live="polite">
        {error || (status?.check_error ? t('system_info.update_catalog_unavailable') : '')}
        {status && status.job.status !== 'idle' && (
          <div>
            {t(`system_info.update_states.${status.job.status}`, { version: status.job.version })}
          </div>
        )}
        {status?.job.status === 'succeeded' && (
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            {t('system_info.update_reload')}
          </Button>
        )}
      </div>
    </div>
  );
}
