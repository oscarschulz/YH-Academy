import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../services/api/apiClient'
import FederationCommandWorkspace from './FederationCommandWorkspace'
import FederationConnectWorkspace from './FederationConnectWorkspace'
import FederationDealRoomsWorkspace from './FederationDealRoomsWorkspace'
import FederationDirectoryWorkspace from './FederationDirectoryWorkspace'
import FederationRequestsWorkspace from './FederationRequestsWorkspace'
import FederationReferralsWorkspace from './FederationReferralsWorkspace'
import FederationAccessWorkspace from './FederationAccessWorkspace'

export default function FederationWorkspace({
  workspaceKey = 'federation-command',
  onToast,
  onWorkspaceOpen,
}) {

  // YHU_FEDERATION_SHARED_REQUEST_PATCH01
  const inFlightRef = useRef(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const onDataChanged = useCallback(() => {
    inFlightRef.current = null;
    setRefreshVersion(version => version + 1);
  }, []);

  useEffect(() => {
    const refresh = () => { if (!document.hidden) onDataChanged(); };
    const timer = window.setInterval(refresh, 60000);
    const onStorage = event => {
      if ([
        'yh_federation_access_status_v1',
        'yh_federation_ladder_outcome_v1',
        'yh_federation_applications',
        'yh_federation_members',
        'yh_admin_panel_state_v3_live',
        'yh_plaza_access_status_v1',
        'yhPlazaDirectoryStatusV1'
      ].includes(event.key)) refresh();
    };

    window.addEventListener('focus', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [onDataChanged]);

  const activeKey = workspaceKey === 'federation'
    ? 'federation-command'
    : workspaceKey;

  const [visitedKeys, setVisitedKeys] = useState(
    () => [activeKey]
  );

  useEffect(() => {
    setVisitedKeys(previous =>
      previous.includes(activeKey)
        ? previous
        : [...previous, activeKey]
    );
  }, [activeKey]);

  const requestCommandData = useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current;

    const request = (async () => {
      const me = await apiFetch('/api/federation/me', {
        method: 'GET',
        cache: 'no-store'
      });

      const approved =
        me?.canEnterFederation === true ||
        String(me?.applicationStatus || '')
          .trim().toLowerCase() === 'approved';

      const urls = [
      "/api/federation/directory",
      "/api/federation/command",
      "/api/federation/referrals",
      "/api/federation/deal-rooms",
      "/api/federation/influence?limit=50",
      "/api/federation/connect/opportunities",
      "/api/federation/connect/my-requests"
];

      if (!approved) {
        return { me, urls, settled: [] };
      }

      const settled = await Promise.allSettled(
        urls.map(url => apiFetch(url, {
          method: 'GET',
          cache: 'no-store'
        }))
      );

      return { me, urls, settled };
    })();

    inFlightRef.current = request;

    const release = () => {
      if (inFlightRef.current === request) {
        inFlightRef.current = null;
      }
    };

    void request.then(release, release);
    return request;
  }, []);

  const sections = [
    {
      id: 'federation-command',
      content: (
        <>
          <FederationCommandWorkspace
            refreshVersion={refreshVersion}
            onDataChanged={onDataChanged}
            requestCommandData={requestCommandData}
            onToast={onToast}
            onWorkspaceOpen={onWorkspaceOpen}
          />
        </>
      )
    },
    {
      id: 'federation-connect',
      content: (
        <FederationConnectWorkspace
            refreshVersion={refreshVersion}
            onDataChanged={onDataChanged}
          onToast={onToast}
          onWorkspaceOpen={onWorkspaceOpen}
        />
      )
    },
    {
      id: 'federation-deal-rooms',
      content: (
        <FederationDealRoomsWorkspace
            refreshVersion={refreshVersion}
            onDataChanged={onDataChanged}
          onToast={onToast}
        />
      )
    },
    {
      id: 'federation-directory',
      content: (
        <FederationDirectoryWorkspace
            refreshVersion={refreshVersion}
            onDataChanged={onDataChanged}
          onToast={onToast}
          onWorkspaceOpen={onWorkspaceOpen}
        />
      )
    },
    {
      id: 'federation-requests',
      content: (
        <FederationRequestsWorkspace
            refreshVersion={refreshVersion}
            onDataChanged={onDataChanged}
          onToast={onToast}
          onWorkspaceOpen={onWorkspaceOpen}
        />
      )
    },
    {
      id: 'federation-referrals',
      content: (
        <FederationReferralsWorkspace
            refreshVersion={refreshVersion}
            onDataChanged={onDataChanged}
          onToast={onToast}
        />
      )
    },
    {
      id: 'federation-access',
      content: (
        <FederationAccessWorkspace
            refreshVersion={refreshVersion}
            onDataChanged={onDataChanged}
          onToast={onToast}
          onWorkspaceOpen={onWorkspaceOpen}
        />
      )
    }
  ];

  if (!sections.some(section => section.id === activeKey)) {
    return null;
  }

  return (
    <>
      {sections.map(({ id, content }) => {
        if (
          id !== activeKey &&
          !visitedKeys.includes(id)
        ) {
          return null;
        }

        return (
          <div
            key={id}
            aria-hidden={id !== activeKey}
            style={{
              display: id === activeKey
                ? 'contents'
                : 'none'
            }}
          >
            {content}
          </div>
        );
      })}
    </>
  );
}
