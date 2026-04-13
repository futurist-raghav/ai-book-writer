'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  Send, 
  Trash2, 
  Reply, 
  Search,
  Clock,
  AlertCircle
} from 'lucide-react';

interface Message {
  message_id: string;
  sender_id: string;
  sender_username: string;
  recipient_id: string;
  subject: string;
  body: string;
  read: boolean;
  created_at: string;
}

interface NewMessage {
  recipient_id: string;
  subject: string;
  body: string;
}

export default function AuthorMessagingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [composeData, setComposeData] = useState({
    recipient_id: '',
    subject: '',
    body: '',
  });

  // Fetch inbox messages
  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['inbox-messages'],
    queryFn: async () => {
      const response = await api.get('/messages/inbox');
      return response.data as Message[];
    },
  });

  // Filter messages
  const filteredMessages = messages.filter(msg =>
    msg.sender_username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadCount = messages.filter(m => !m.read).length;

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: NewMessage) => {
      return api.post('/messages/send', data);
    },
    onSuccess: () => {
      setComposeData({ recipient_id: '', subject: '', body: '' });
      setShowCompose(false);
      refetch();
    },
  });

  // Mark message as read
  const markReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return api.put(`/messages/${messageId}/read`);
    },
    onSuccess: () => {
      refetch();
    },
  });

  const handleSendMessage = () => {
    if (!composeData.recipient_id || !composeData.subject || !composeData.body) {
      alert('Please fill in all fields');
      return;
    }
    sendMessageMutation.mutate(composeData);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
            <MessageCircle className="h-10 w-10" />
            Author Messages
          </h1>
          <p className="text-blue-100 text-lg">
            Connect with other writers, discuss collaborations, and organize beta reader requests
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Message List */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="inbox" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="inbox" className="relative">
                  Inbox
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-2 rounded-full">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sent">Sent</TabsTrigger>
              </TabsList>

              <TabsContent value="inbox">
                <Card>
                  <CardHeader>
                    <CardTitle>Inbox</CardTitle>
                    <CardDescription>
                      {messages.length} message{messages.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Search */}
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <Input
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Message List */}
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />
                      ))
                    ) : filteredMessages.length > 0 ? (
                      <div className="space-y-2">
                        {filteredMessages.map(message => (
                          <div
                            key={message.message_id}
                            onClick={() => {
                              setSelectedMessage(message);
                              if (!message.read) {
                                markReadMutation.mutate(message.message_id);
                              }
                            }}
                            className={`p-4 border rounded-lg cursor-pointer transition ${
                              message.read
                                ? 'bg-white hover:bg-gray-50'
                                : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className={`font-semibold ${!message.read ? 'text-blue-900' : 'text-gray-900'}`}>
                                  {message.sender_username}
                                </p>
                                <p className={`text-sm ${!message.read ? 'text-blue-800' : 'text-gray-600'}`}>
                                  {message.subject}
                                </p>
                                <p className={`text-xs mt-1 line-clamp-2 ${!message.read ? 'text-blue-700' : 'text-gray-500'}`}>
                                  {message.body}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2 ml-4">
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(message.created_at)}
                                </span>
                                {!message.read && (
                                  <div className="h-3 w-3 rounded-full bg-blue-600" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">
                          {searchQuery ? 'No messages found' : 'Your inbox is empty'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sent">
                <Card>
                  <CardContent className="py-12 text-center">
                    <Send className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Sent messages feature coming soon</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Message Detail / Compose */}
          <div className="lg:col-span-1">
            {selectedMessage ? (
              /* Message Detail View */
              <Card>
                <CardHeader>
                  <Button
                    variant="ghost"
                    className="w-full justify-start -ml-3 mb-2"
                    onClick={() => setSelectedMessage(null)}
                  >
                    ← Back to Inbox
                  </Button>
                  <CardTitle className="text-lg">{selectedMessage.sender_username}</CardTitle>
                  <CardDescription>{selectedMessage.subject}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-gray-600">
                    <p>From: <strong>{selectedMessage.sender_username}</strong></p>
                    <p>
                      Date: {new Date(selectedMessage.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded min-h-48">
                    <p className="text-gray-900 whitespace-pre-wrap">{selectedMessage.body}</p>
                  </div>

                  <div className="space-y-2 pt-4 border-t">
                    <Button className="w-full" size="sm">
                      <Reply className="h-4 w-4 mr-2" />
                      Reply
                    </Button>
                    <Button variant="outline" className="w-full" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : showCompose ? (
              /* Compose Message View */
              <Card>
                <CardHeader>
                  <Button
                    variant="ghost"
                    className="w-full justify-start -ml-3 mb-2"
                    onClick={() => setShowCompose(false)}
                  >
                    ← Cancel
                  </Button>
                  <CardTitle>New Message</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold block mb-2">To</label>
                    <Input
                      placeholder="Recipient username"
                      value={composeData.recipient_id}
                      onChange={(e) =>
                        setComposeData({ ...composeData, recipient_id: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold block mb-2">Subject</label>
                    <Input
                      placeholder="Message subject"
                      value={composeData.subject}
                      onChange={(e) =>
                        setComposeData({ ...composeData, subject: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold block mb-2">Message</label>
                    <textarea
                      placeholder="Your message..."
                      value={composeData.body}
                      onChange={(e) =>
                        setComposeData({ ...composeData, body: e.target.value })
                      }
                      className="w-full border rounded-md p-2 min-h-32 resize-none"
                    />
                  </div>

                  <Button
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendMessageMutation.isPending ? 'Sending...' : 'Send Message'}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              /* Empty State */
              <Card>
                <CardContent className="py-12 text-center flex flex-col items-center justify-center">
                  <MessageCircle className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-gray-600 mb-4">No message selected</p>
                  <Button onClick={() => setShowCompose(true)}>
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Compose New Message
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
