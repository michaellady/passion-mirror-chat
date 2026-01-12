import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { handleSignup, handleSignin, handleGetSession, verifyAuth } from './auth.js';
import { handleStartInterview, handleCheckInterviewStatus } from './interview.js';
import {
  handleGetProfile,
  handleGetProfiles,
  handleGetTraits,
  handleUpsertTraits,
  handleGetRooms,
  handleGetRoomBySlug,
  handleCreateRoom,
  handleGetUserRooms,
  handleAddRoomMember,
  handleGetMessages,
  handleCreateMessage,
} from './api.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }

  console.log(`${method} ${path}`);

  try {
    // Auth routes (no auth required)
    if (path === '/auth/signup' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await handleSignup(body);
      return response(result.error ? 400 : 200, result);
    }

    if (path === '/auth/signin' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await handleSignin(body);
      return response(result.error ? 401 : 200, result);
    }

    if (path === '/auth/session' && method === 'GET') {
      const token = event.headers.authorization?.replace('Bearer ', '');
      const result = await handleGetSession(token);
      return response(result.error ? 401 : 200, result);
    }

    // All routes below require authentication
    const authHeader = event.headers.authorization;
    const authResult = await verifyAuth(authHeader);
    if (!authResult.user) {
      return response(401, { error: authResult.error || 'Unauthorized' });
    }
    const userId = authResult.user.id;

    // Interview routes
    if (path === '/start-interview' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await handleStartInterview(userId, body);
      return response(result.error ? 500 : 200, result);
    }

    if (path === '/check-interview-status' && method === 'GET') {
      const result = await handleCheckInterviewStatus(userId);
      return response(200, result);
    }

    // Profile routes
    if (path === '/api/profiles' && method === 'GET') {
      const ids = event.queryStringParameters?.ids?.split(',');
      if (ids) {
        const result = await handleGetProfiles(ids);
        return response(200, result);
      }
      return response(400, { error: 'ids parameter required' });
    }

    if (path.match(/^\/api\/profiles\/[^/]+$/) && method === 'GET') {
      const id = path.split('/').pop()!;
      const result = await handleGetProfile(id);
      return response(result ? 200 : 404, result || { error: 'Not found' });
    }

    // Traits routes
    if (path.match(/^\/api\/traits\/[^/]+$/) && method === 'GET') {
      const id = path.split('/').pop()!;
      const result = await handleGetTraits(id);
      return response(result ? 200 : 404, result || { error: 'Not found' });
    }

    if (path === '/api/traits' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await handleUpsertTraits(userId, body);
      return response(result.error ? 500 : 200, result);
    }

    // Room routes
    if (path === '/api/rooms' && method === 'GET') {
      const slug = event.queryStringParameters?.slug;
      if (slug) {
        const result = await handleGetRoomBySlug(slug);
        return response(result ? 200 : 404, result || { error: 'Not found' });
      }
      const result = await handleGetRooms();
      return response(200, result);
    }

    if (path === '/api/rooms' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await handleCreateRoom(body);
      return response(result.error ? 500 : 201, result);
    }

    // User rooms (room_members)
    if (path === '/api/user-rooms' && method === 'GET') {
      const result = await handleGetUserRooms(userId);
      return response(200, result);
    }

    if (path === '/api/room-members' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await handleAddRoomMember(body.room_id, userId);
      return response(result.error ? 500 : 201, result);
    }

    // Messages routes
    if (path === '/api/messages' && method === 'GET') {
      const roomId = event.queryStringParameters?.room_id;
      if (!roomId) {
        return response(400, { error: 'room_id parameter required' });
      }
      const result = await handleGetMessages(roomId);
      return response(200, result);
    }

    if (path === '/api/messages' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await handleCreateMessage(userId, body);
      return response(result.error ? 500 : 201, result);
    }

    // Sessions routes (for updating session status)
    if (path === '/api/sessions' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      // Import and use session update handler
      const { handleUpdateSession } = await import('./api.js');
      const result = await handleUpdateSession(userId, body);
      return response(result.error ? 500 : 200, result);
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Handler error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return response(500, { error: message });
  }
}
