'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Card,
  Button,
  Switch,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Typography,
  Chip,
  IconButton,
  Box,
  Divider,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Link as LinkIcon,
  Unlink as UnlinkIcon,
  Check as CheckIcon,
  Clock as ClockIcon,
  CloudSync as CloudSyncIcon,
  Google as GoogleIcon,
  Database as DatabaseIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import api from '@/lib/api';

interface Integration {
  name: string;
  description: string;
  connected: boolean;
  icon: React.ReactNode;
  lastSync?: string;
  status?: string;
}

interface SyncHistory {
  sync_id: string;
  sync_type: string;
  status: string;
  items_synced: number;
  timestamp: string;
}

const IntegrationsPage = () => {
  const [tab, setTab] = useState(0);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  // Notion
  const { data: notionStatus } = useQuery({
    queryKey: ['integrations', 'notion', 'status'],
    queryFn: () => api.get('/integrations/notion/status'),
  });

  const { data: notionSettings } = useQuery({
    queryKey: ['integrations', 'notion', 'settings'],
    queryFn: () => api.get('/integrations/notion/sync-settings'),
    enabled: notionStatus?.connected,
  });

  // Google Docs
  const { data: googleStatus } = useQuery({
    queryKey: ['integrations', 'google-docs', 'status'],
    queryFn: () => api.get('/integrations/google-docs/status'),
  });

  const { data: syncHistory } = useQuery({
    queryKey: ['integrations', 'sync-history', selectedIntegration],
    queryFn: () => api.get('/integrations/notion/sync-history'),
  });

  // Mutations
  const notionOAuthMutation = useMutation({
    mutationFn: () => api.get('/integrations/notion/oauth'),
    onSuccess: (data) => {
      window.location.href = data.oauth_url;
    },
  });

  const notionSyncMutation = useMutation({
    mutationFn: (syncType: string) =>
      syncType === 'calendar'
        ? api.post('/integrations/notion/calendar/sync', {})
        : api.post('/integrations/notion/book-database/sync', {}),
  });

  const disconnectNotionMutation = useMutation({
    mutationFn: () => api.post('/integrations/notion/disconnect', {}),
  });

  const googleOAuthMutation = useMutation({
    mutationFn: () => api.get('/integrations/google-docs/oauth'),
    onSuccess: (data) => {
      window.location.href = data.oauth_url;
    },
  });

  const googleDocImportMutation = useMutation({
    mutationFn: ({ docId, bookId }: { docId: string; bookId: string }) =>
      api.post('/integrations/google-docs/import', { doc_id: docId, book_id: bookId }),
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: () => api.post('/integrations/google-docs/disconnect', {}),
  });

  const integrations: Record<string, Integration> = {
    notion: {
      name: 'Notion',
      description: 'Sync your writing calendar, book database, and story snippets',
      connected: notionStatus?.connected || false,
      icon: <DatabaseIcon />,
      lastSync: notionSettings?.calendar?.last_sync,
      status: notionStatus?.sync_enabled ? 'Syncing' : 'Disconnected',
    },
    'google-docs': {
      name: 'Google Docs',
      description: 'Import from Google Docs and export chapters for collaboration',
      connected: googleStatus?.connected || false,
      icon: <GoogleIcon />,
      lastSync: undefined,
      status: googleStatus?.connected ? 'Connected' : 'Disconnected',
    },
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <Typography variant="h4" className="font-bold">
          Integrations & API Connections
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Connect with external tools to sync your writing across platforms
        </Typography>
      </div>

      <Tabs
        value={tab}
        onChange={(e, newTab) => setTab(newTab)}
        className="mb-6"
        sx={{ borderBottom: '1px solid #e0e0e0' }}
      >
        <Tab label="Available Integrations" />
        <Tab label="Connected Apps" />
        <Tab label="Sync History" />
      </Tabs>

      {tab === 0 ? (
        <Grid container spacing={3}>
          {Object.entries(integrations).map(([key, integration]) => (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <Card className="p-6 h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl text-blue-500">{integration.icon}</div>
                  {integration.connected && (
                    <Chip
                      icon={<CheckIcon />}
                      label="Connected"
                      color="success"
                      size="small"
                    />
                  )}
                </div>

                <Typography variant="h6" className="font-bold mb-2">
                  {integration.name}
                </Typography>

                <Typography variant="body2" color="textSecondary" className="mb-4 flex-grow">
                  {integration.description}
                </Typography>

                {integration.connected && integration.lastSync && (
                  <Typography variant="caption" color="textSecondary" className="mb-3">
                    Last sync: {new Date(integration.lastSync).toLocaleDateString()}
                  </Typography>
                )}

                <div className="flex gap-2">
                  {!integration.connected ? (
                    <>
                      {key === 'notion' && (
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={() => notionOAuthMutation.mutate()}
                          disabled={notionOAuthMutation.isPending}
                        >
                          Connect
                        </Button>
                      )}
                      {key === 'google-docs' && (
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={() => googleOAuthMutation.mutate()}
                          disabled={googleOAuthMutation.isPending}
                        >
                          Connect
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={() => {
                          setSelectedIntegration(key);
                          setOpenDialog(true);
                        }}
                      >
                        Settings
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        fullWidth
                        onClick={() => {
                          if (key === 'notion') {
                            disconnectNotionMutation.mutate();
                          } else if (key === 'google-docs') {
                            disconnectGoogleMutation.mutate();
                          }
                        }}
                      >
                        Disconnect
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : tab === 1 ? (
        <Grid container spacing={3}>
          {/* Notion Settings */}
          {notionStatus?.connected && (
            <Grid item xs={12}>
              <Card className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <Typography variant="h6" className="font-bold">
                      Notion Calendar Sync
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Automatically sync your writing sessions to Notion calendar
                    </Typography>
                  </div>
                  <Chip label="Active" color="success" />
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <Typography variant="body2">Sync Interval</Typography>
                    <Chip label={notionSettings?.calendar?.sync_interval || 'Daily'} />
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <Typography variant="body2">Last Sync</Typography>
                    <Typography variant="caption">
                      {notionSettings?.calendar?.last_sync
                        ? new Date(notionSettings.calendar.last_sync).toLocaleString()
                        : 'Never'}
                    </Typography>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <Typography variant="body2">Auto Sync</Typography>
                    <Switch defaultChecked />
                  </div>
                </div>

                <Button
                  variant="contained"
                  startIcon={<CloudSyncIcon />}
                  fullWidth
                  onClick={() => notionSyncMutation.mutate('calendar')}
                  disabled={notionSyncMutation.isPending}
                >
                  Sync Now
                </Button>
              </Card>
            </Grid>
          )}

          {/* Google Docs Settings */}
          {googleStatus?.connected && (
            <Grid item xs={12}>
              <Card className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <Typography variant="h6" className="font-bold">
                      Google Docs Integration
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Import chapters from Google Docs or export for collaboration
                    </Typography>
                  </div>
                  <Chip label="Active" color="success" />
                </div>

                <div className="space-y-3 mb-6">
                  <Alert severity="info">
                    Connected as <strong>{googleStatus?.user_email}</strong>
                  </Alert>

                  <Button variant="outlined" fullWidth>
                    Import From Google Docs
                  </Button>

                  <Button variant="outlined" fullWidth>
                    Export Chapter to Google Docs
                  </Button>

                  <Button variant="outlined" fullWidth>
                    Start Real-time Sync
                  </Button>
                </div>
              </Card>
            </Grid>
          )}

          {/* No Connected Apps */}
          {!notionStatus?.connected && !googleStatus?.connected && (
            <Grid item xs={12}>
              <Card className="p-6 text-center">
                <Typography color="textSecondary">
                  No integrations connected yet. Go to &quot;Available Integrations&quot; to get started!
                </Typography>
              </Card>
            </Grid>
          )}
        </Grid>
      ) : (
        // Sync History Tab
        <Card className="p-6">
          <Typography variant="h6" className="font-bold mb-4">
            Recent Syncs
          </Typography>

          <List>
            {syncHistory?.syncs?.map((sync: SyncHistory, idx: number) => (
              <React.Fragment key={sync.sync_id}>
                <ListItem>
                  <ListItemText
                    primary={
                      <div className="flex items-center gap-2">
                        <Typography variant="body2" className="font-semibold">
                          {sync.sync_type === 'calendar' ? 'Calendar Sync' : 'Book Database Sync'}
                        </Typography>
                        <Chip
                          label={sync.status}
                          size="small"
                          color={sync.status === 'success' ? 'success' : 'error'}
                        />
                      </div>
                    }
                    secondary={
                      <div className="text-sm text-gray-600 mt-1">
                        {sync.items_synced} items • {new Date(sync.timestamp).toLocaleString()}
                      </div>
                    }
                  />
                </ListItem>
                {idx < syncHistory.syncs.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Card>
      )}

      {/* Settings Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>
          {selectedIntegration === 'notion' ? 'Notion Settings' : 'Google Docs Settings'}
        </DialogTitle>
        <DialogContent className="min-w-[400px]">
          {selectedIntegration === 'notion' && (
            <div className="space-y-4 mt-4">
              <Typography variant="subtitle2" className="font-bold">
                Calendar Sync
              </Typography>
              <div className="flex justify-between items-center">
                <Typography variant="body2">Auto-sync enabled</Typography>
                <Switch defaultChecked />
              </div>
              <Typography variant="body2" color="textSecondary">
                Sync interval: Daily
              </Typography>
            </div>
          )}
          {selectedIntegration === 'google-docs' && (
            <div className="space-y-4 mt-4">
              <Typography variant="subtitle2" className="font-bold">
                Import & Export Options
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Configure how to handle imports and sync directions
              </Typography>
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default IntegrationsPage;
