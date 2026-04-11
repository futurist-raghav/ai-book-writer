'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Card,
  Button,
  TextField,
  Select,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Typography,
  Avatar,
  AvatarGroup,
  Chip,
  IconButton,
  InputAdornment,
  Box,
  Badge,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  People as PeopleIcon,
  ThumbUp as ThumbUpIcon,
  Comment as CommentIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import api from '@/lib/api';

interface WritingGroup {
  group_id: string;
  name: string;
  description: string;
  genre: string;
  member_count: number;
  is_public: boolean;
  created_at: string;
}

interface GroupPost {
  post_id: string;
  author_username: string;
  title: string;
  excerpt: string;
  word_count: number;
  likes: number;
  comments: number;
  created_at: string;
}

const WritingGroupsPage = () => {
  const [tab, setTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('all');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<WritingGroup | null>(null);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    genre: 'Fiction',
    max_members: 50,
    is_public: true,
  });

  // Queries
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ['writing-groups', genreFilter, searchQuery],
    queryFn: () =>
      api.get('/writing-groups', {
        params: { genre: genreFilter !== 'all' ? genreFilter : undefined, search: searchQuery },
      }),
  });

  const { data: groupDetail } = useQuery({
    queryKey: ['writing-groups', selectedGroup?.group_id],
    queryFn: () => api.get(`/writing-groups/${selectedGroup?.group_id}`),
    enabled: !!selectedGroup,
  });

  const { data: postsData } = useQuery({
    queryKey: ['writing-groups', selectedGroup?.group_id, 'posts'],
    queryFn: () => api.get(`/writing-groups/${selectedGroup?.group_id}/posts`),
    enabled: !!selectedGroup,
  });

  const { data: membersData } = useQuery({
    queryKey: ['writing-groups', selectedGroup?.group_id, 'members'],
    queryFn: () => api.get(`/writing-groups/${selectedGroup?.group_id}/members`),
    enabled: !!selectedGroup,
  });

  // Mutations
  const createGroupMutation = useMutation({
    mutationFn: (data: typeof createFormData) => api.post('/writing-groups', data),
    onSuccess: () => {
      setOpenCreateDialog(false);
      setCreateFormData({
        name: '',
        description: '',
        genre: 'Fiction',
        max_members: 50,
        is_public: true,
      });
    },
  });

  const joinGroupMutation = useMutation({
    mutationFn: (groupId: string) => api.post(`/writing-groups/${groupId}/join`, {}),
  });

  const leaveGroupMutation = useMutation({
    mutationFn: (groupId: string) => api.post(`/writing-groups/${groupId}/leave`, {}),
  });

  const postToGroupMutation = useMutation({
    mutationFn: ({ groupId, title, content }: { groupId: string; title: string; content: string }) =>
      api.post(`/writing-groups/${groupId}/posts`, { title, content }),
  });

  const likePostMutation = useMutation({
    mutationFn: ({ groupId, postId }: { groupId: string; postId: string }) =>
      api.post(`/writing-groups/${groupId}/posts/${postId}/like`, {}),
  });

  const genres = ['all', 'Fiction', 'Fantasy', 'Science Fiction', 'Romance', 'Mystery', 'Historical'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <Typography variant="h4" className="font-bold">
            Writing Groups
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Join communities of writers, get feedback, and inspire each other
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreateDialog(true)}
        >
          Create Group
        </Button>
      </div>

      <Tabs
        value={tab}
        onChange={(e, newTab) => setTab(newTab)}
        className="mb-6"
        sx={{ borderBottom: '1px solid #e0e0e0' }}
      >
        <Tab label="Discover Groups" />
        <Tab label="My Groups" />
      </Tabs>

      {tab === 0 ? (
        <div className="space-y-6">
          {/* Search & Filters */}
          <Card className="p-6">
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  placeholder="Search writing groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Select
                  fullWidth
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  label="Genre"
                >
                  {genres.map((g) => (
                    <option key={g} value={g}>
                      {g === 'all' ? 'All Genres' : g}
                    </option>
                  ))}
                </Select>
              </Grid>
            </Grid>
          </Card>

          {/* Groups Grid */}
          <Grid container spacing={3}>
            {groupsData?.groups?.map((group: WritingGroup) => (
              <Grid item xs={12} sm={6} md={4} key={group.group_id}>
                <Card
                  className="p-6 cursor-pointer hover:shadow-lg transition-shadow h-full"
                  onClick={() => {
                    setSelectedGroup(group);
                    setTab(1);
                  }}
                >
                  <Typography variant="h6" className="font-bold mb-2">
                    {group.name}
                  </Typography>

                  <Chip
                    label={group.genre}
                    size="small"
                    className="mb-3"
                    variant="outlined"
                  />

                  <Typography variant="body2" color="textSecondary" className="mb-4 line-clamp-2">
                    {group.description}
                  </Typography>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <PeopleIcon fontSize="small" />
                      <span className="text-sm">{group.member_count} members</span>
                    </div>
                    <Badge
                      badgeContent={group.is_public ? 'Public' : 'Private'}
                      color="primary"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="contained"
                      size="small"
                      fullWidth
                      onClick={() => joinGroupMutation.mutate(group.group_id)}
                    >
                      Join
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setSelectedGroup(group)}
                    >
                      Preview
                    </Button>
                  </div>
                </Card>
              </Grid>
            ))}
          </Grid>
        </div>
      ) : (
        <div className="space-y-6">
          {selectedGroup && (
            <>
              {/* Group Header */}
              <Card className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Typography variant="h5" className="font-bold">
                      {selectedGroup.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {selectedGroup.description}
                    </Typography>
                  </div>
                  <IconButton size="small">
                    <MoreVertIcon />
                  </IconButton>
                </div>

                <Divider className="my-4" />

                {/* Group Tabs */}
                <Tabs defaultValue={0} sx={{ mb: 4 }}>
                  <Tab label={`Posts (${postsData?.posts?.length || 0})`} />
                  <Tab label={`Members (${membersData?.members?.length || 0})`} />
                  <Tab label="Rules" />
                </Tabs>

                {/* Posts Tab */}
                <div className="space-y-4">
                  <Button variant="outlined" startIcon={<AddIcon />} fullWidth>
                    Share Writing
                  </Button>

                  {postsData?.posts?.map((post: GroupPost) => (
                    <Card key={post.post_id} className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <Typography variant="subtitle2" className="font-bold">
                            {post.title}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            by {post.author_username} • {post.word_count} words
                          </Typography>
                        </div>
                        <IconButton size="small">
                          <MoreVertIcon />
                        </IconButton>
                      </div>

                      <Typography variant="body2" className="mb-3 text-gray-600">
                        {post.excerpt}
                      </Typography>

                      <div className="flex items-center gap-4">
                        <Button
                          startIcon={<ThumbUpIcon />}
                          size="small"
                          variant="text"
                          onClick={() =>
                            likePostMutation.mutate({
                              groupId: selectedGroup.group_id,
                              postId: post.post_id,
                            })
                          }
                        >
                          {post.likes} Likes
                        </Button>
                        <Button startIcon={<CommentIcon />} size="small" variant="text">
                          {post.comments} Comments
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Members Tab */}
                <div className="mt-4">
                  <Typography variant="subtitle2" className="font-bold mb-3">
                    Group Members
                  </Typography>
                  <div className="space-y-2">
                    {membersData?.members?.map((member: any) => (
                      <div
                        key={member.user_id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar sx={{ width: 32, height: 32 }} />
                          <div>
                            <Typography variant="body2" className="font-semibold">
                              {member.username}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {member.role} • {member.post_count} posts
                            </Typography>
                          </div>
                        </div>
                        <Chip
                          label={member.role}
                          size="small"
                          variant="outlined"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Writing Group</DialogTitle>
        <DialogContent className="space-y-4 mt-4">
          <TextField
            fullWidth
            label="Group Name"
            value={createFormData.name}
            onChange={(e) =>
              setCreateFormData({ ...createFormData, name: e.target.value })
            }
            placeholder="e.g., Fantasy Writers Guild"
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={createFormData.description}
            onChange={(e) =>
              setCreateFormData({ ...createFormData, description: e.target.value })
            }
            placeholder="What is this group about?"
          />
          <Select
            fullWidth
            value={createFormData.genre}
            onChange={(e) =>
              setCreateFormData({ ...createFormData, genre: e.target.value })
            }
            label="Primary Genre"
          >
            {['Fiction', 'Fantasy', 'Science Fiction', 'Romance', 'Mystery'].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
          <TextField
            fullWidth
            type="number"
            label="Max Members"
            value={createFormData.max_members}
            onChange={(e) =>
              setCreateFormData({ ...createFormData, max_members: parseInt(e.target.value) })
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => createGroupMutation.mutate(createFormData)}
            disabled={createGroupMutation.isPending}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default WritingGroupsPage;
