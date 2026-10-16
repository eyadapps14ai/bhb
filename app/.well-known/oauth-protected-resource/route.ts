import {resourceMetadata} from '@/lib/oauth';
// Tells Claude which authorization server issues tokens for /api/mcp (RFC 9728).
export function GET(req:Request){return Response.json(resourceMetadata(new URL(req.url).origin),{headers:{'Cache-Control':'public, max-age=300','Access-Control-Allow-Origin':'*'}});}
